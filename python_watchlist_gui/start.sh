#!/bin/sh
set -e

# Clean stale X display locks/sockets for :1 to avoid "Server is already active" errors
if [ -e /tmp/.X1-lock ]; then
  pid=$(sed -n '1p' /tmp/.X1-lock 2>/dev/null || true)
  if [ -n "$pid" ] && kill -0 "$pid" 2>/dev/null; then
    echo "Display :1 appears active (pid $pid); leaving lock in place"
  else
    echo "Removing stale X lock and socket for :1"
    rm -f /tmp/.X1-lock /tmp/.X11-unix/X1
  fi
fi

# Start virtual X server on :1 and wait for its socket to appear
export DISPLAY=:1
Xvfb :1 -screen 0 1024x768x24 &
XVFB_PID=$!
# wait up to ~5 seconds for the X unix socket to be created
tries=10
count=0
while [ $count -lt $tries ]; do
  if [ -e /tmp/.X11-unix/X1 ]; then
    break
  fi
  sleep 0.5
  count=$((count+1))
done
if [ -e /tmp/.X11-unix/X1 ]; then
  echo "Xvfb started (pid=$XVFB_PID) and socket present"
else
  echo "Warning: Xvfb may not have created socket yet (pid=$XVFB_PID)"
fi

# Start a lightweight window manager
fluxbox &
sleep 0.5

# Start the health endpoint early so kube probes can see it before VNC is ready
if [ -f /app/healthcheck.py ]; then
  echo "Starting health server (/app/healthcheck.py) early in background..."
  nohup python3 /app/healthcheck.py >/tmp/health.log 2>&1 &
  EARLY_HEALTH_PID=$!
  echo "early health server pid=${EARLY_HEALTH_PID}"
  # give the health server a moment to bind its port
  sleep 0.5
fi

# Start x11vnc, prefer an explicit VNC_PASSWORD env var, otherwise
# fall back to an existing /root/.vnc/passwd file if present.
if [ -n "${VNC_PASSWORD:-}" ]; then
  mkdir -p /root/.vnc
  x11vnc -storepasswd "$VNC_PASSWORD" /root/.vnc/passwd
  x11vnc -forever -usepw -display :1 -shared -rfbport 5901 &
elif [ -f /root/.vnc/passwd ]; then
  x11vnc -forever -usepw -display :1 -shared -rfbport 5901 &
else
  x11vnc -forever -display :1 -shared -rfbport 5901 &
fi

# Start supervised GUI early (so Tk can initialize while noVNC/websockify
# perform readiness probes). This is idempotent via pidfile.
GUI_LOG=/tmp/gui.log
GUI_PIDFILE=/tmp/gui.pid
if [ ! -f "$GUI_PIDFILE" ]; then
  (
    while true; do
      echo "$(date) Starting GUI (early supervisor, DISPLAY=${DISPLAY})" >> "$GUI_LOG"
      env DISPLAY="$DISPLAY" python3 /app/main.py >> "$GUI_LOG" 2>&1 || true
      echo "$(date) GUI exited; restarting in 2s" >> "$GUI_LOG"
      sleep 2
    done
  ) &
  echo $! > "$GUI_PIDFILE" || true
else
  echo "GUI supervisor already running (pidfile exists)"
fi

# Start noVNC via websockify (serve /opt/novnc on port 6080) if available
if [ -d /opt/novnc ] && [ -d /opt/novnc/utils ]; then
  echo "Waiting for x11vnc on 127.0.0.1:5901 with exponential backoff..."
  # Exponential backoff: try a few times, doubling the sleep each attempt.
  max_attempts=12
  attempt=0
  sleep_time=1
  total_wait=0
  started=0
  while [ "$attempt" -lt "$max_attempts" ]; do
    # Prefer an IPv4-only probe to avoid hitting IPv6 sockets that may refuse
    # connections when x11vnc is only listening on IPv4. Try nc -4 first,
    # fall back to a small Python socket check if nc isn't available.
    # Use Python socket probe first (reliable), fall back to nc if Python fails.
    if python3 - >/dev/null 2>&1 <<'PY'
import socket,sys
s=socket.socket()
s.settimeout(2)
try:
    s.connect(('127.0.0.1',5901))
    # Read a small part of the VNC protocol version string to ensure server
    # has completed its startup and is ready for a proper handshake.
    data = s.recv(12)
    s.close()
    if data.startswith(b'RFB'):
        sys.exit(0)
    else:
        sys.exit(1)
except:
    sys.exit(1)
PY
    then
      started=1
      break
    elif command -v nc >/dev/null 2>&1; then
      if nc -4 -z 127.0.0.1 5901 >/dev/null 2>&1; then
        started=1
        break
      fi
    fi
    echo "x11vnc not ready, sleeping ${sleep_time}s (attempt $((attempt+1))/${max_attempts})"
    sleep "$sleep_time"
    total_wait=$((total_wait + sleep_time))
    attempt=$((attempt + 1))
    sleep_time=$((sleep_time * 2))
  done
  if [ "$started" -eq 1 ]; then
    echo "Starting websockify serving /opt/novnc on :6080"
    # brief pause to let x11vnc complete handshake routines
    sleep 2
    # Supervise websockify: restart if it exits
    WEBROOT=/opt/novnc
    WS_PORT=6080
    WS_TARGET=127.0.0.1:5901
    (
      while true; do
        echo "$(date) Starting websockify serving ${WEBROOT} on :${WS_PORT} (target=${WS_TARGET})" >> /tmp/websockify.log
        websockify --web "${WEBROOT}" --verbose --daemon --log-file=/tmp/websockify.log "${WS_PORT}" "${WS_TARGET}" || true
        sleep 0.5
        WEBSOCKIFY_PID=$(pgrep -f "websockify.*${WS_PORT}" | head -n1 || true)
        echo "${WEBSOCKIFY_PID}" > /tmp/websockify.pid
        # wait until the daemonized websockify process exits
        while pgrep -f "websockify.*${WS_PORT}" >/dev/null 2>&1; do
          sleep 1
        done
        echo "$(date) websockify (pid ${WEBSOCKIFY_PID}) exited; restarting in 2s" >> /tmp/websockify.log
        sleep 2
      done
    ) &
  else
    echo "ALERT: x11vnc did not start after ${total_wait}s; starting websockify anyway and emitting persistent alerts"
    # Background persistent alert logger (runs until container stops)
    (
      while true; do
        echo "ALERT: x11vnc not accepting connections after ${total_wait}s - check container logs and X server"
        sleep 30
      done
    ) &
    # give x11vnc a moment if it's just coming up
    sleep 2
    # Supervise websockify: restart if it exits
    WEBROOT=/opt/novnc
    WS_PORT=6080
    WS_TARGET=127.0.0.1:5901
    (
      while true; do
        echo "$(date) Starting websockify serving ${WEBROOT} on :${WS_PORT} (target=${WS_TARGET})" >> /tmp/websockify.log
        websockify --web "${WEBROOT}" --verbose "${WS_PORT}" "${WS_TARGET}" >> /tmp/websockify.log 2>&1 &
        WEBSOCKIFY_PID=$!
        echo "${WEBSOCKIFY_PID}" > /tmp/websockify.pid
        wait ${WEBSOCKIFY_PID} || true
        echo "$(date) websockify (pid ${WEBSOCKIFY_PID}) exited; restarting in 2s" >> /tmp/websockify.log
        sleep 2
      done
    ) &
  fi
else
  echo "noVNC not available in /opt/novnc, skipping web UI"
fi


# Wait a short while for x11vnc to become fully ready before launching
# the health endpoint and GUI app to avoid startup races causing immediate
# health-monitor failures and container restarts.
# Wait a short while for x11vnc to become fully ready before launching
# the health endpoint and GUI app to avoid startup races causing immediate
# health-monitor failures and container restarts. Increased to tolerate
# slower startups on constrained hosts.
wait_attempts=30
wait_count=0
while [ $wait_count -lt $wait_attempts ]; do
  if python3 - >/dev/null 2>&1 <<'PY'
import socket,sys
s=socket.socket()
s.settimeout(2)
try:
    s.connect(('127.0.0.1',5901))
    data=s.recv(12)
    s.close()
    if data.startswith(b'RFB'):
        sys.exit(0)
    else:
        sys.exit(1)
except:
    sys.exit(1)
PY
  then
    break
  fi
  sleep 1
  wait_count=$((wait_count+1))
done

# Start the health endpoint in background
if [ -f /app/healthcheck.py ]; then
  echo "Starting health server (/app/healthcheck.py) in background..."
  nohup python3 /app/healthcheck.py >/tmp/health.log 2>&1 &
  HEALTH_PID=$!
  echo "health server pid=${HEALTH_PID}"
  # give the health server a moment to bind its port and emit a startup log
  sleep 0.5
fi

# GUI supervised earlier (see above)

# Monitor the health endpoint in the foreground; if it fails N times consecutively,
# exit non-zero so Docker can restart the container (restart policy must be set).
consec_fail=0
# Allow a larger failure threshold to tolerate brief startup races and
# transient connection refusals under load.
max_fail=12
interval=10
echo "Starting health monitor (polling http://127.0.0.1:9090/health)..."
while true; do
  if python3 -c "import sys,urllib.request
try:
    r=urllib.request.urlopen('http://127.0.0.1:9090/health', timeout=3)
    sys.exit(0)
except:
    sys.exit(1)
" >/dev/null 2>&1; then
    consec_fail=0
  else
    consec_fail=$((consec_fail+1))
    echo "health check failed ($consec_fail/$max_fail)"
  fi
  if [ "$consec_fail" -ge "$max_fail" ]; then
    echo "Health failed $consec_fail times; exiting to trigger container restart"
    # allow logs to flush
    sleep 1
    exit 1
  fi
  sleep $interval
done
