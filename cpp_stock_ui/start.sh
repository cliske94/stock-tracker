#!/bin/sh
set -e

export DISPLAY=:1

# Clean stale X display locks/sockets for :1 to avoid "Server is already active" errors
if [ -e /tmp/.X1-lock ]; then
  pid=$(sed -n '1p' /tmp/.X1-lock 2>/dev/null || true)
  if [ -n "$pid" ] && kill -0 "$pid" 2>/dev/null; then
    echo "Display :1 appears active (pid $pid); leaving lock in place"
  else
    echo "Removing stale X lock and socket for :1"
    rm -f /tmp/.X1-lock /tmp/.X11-unix/X1 || true
  fi
fi

# Create VNC passwd if provided
if [ -n "${VNC_PASSWORD:-}" ]; then
  mkdir -p /root/.vnc
  x11vnc -storepasswd "$VNC_PASSWORD" /root/.vnc/passwd
  VNC_PASS_ARGS="-usepw"
else
  VNC_PASS_ARGS="-nopw"
fi

# Start Xvfb
Xvfb :1 -screen 0 1024x768x24 &
XVFB_PID=$!

# Start window manager
fluxbox &

# Start the Qt app
/opt/stock_ui >/tmp/stock_ui.log 2>&1 &
APP_PID=$!

# Give app a moment to create windows
sleep 1

# Start x11vnc
x11vnc -forever ${VNC_PASS_ARGS} -display :1 -shared -rfbport 5901 >/tmp/x11vnc.log 2>&1 &

# Start websockify (noVNC) on port 6082
# Supervise websockify: restart if it exits
WEBROOT=/opt/noVNC
WS_PORT=6082
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

# Start local health server early (serves /internal/heartbeat and /internal/healthcheck)
if [ -f /opt/health_server.py ]; then
  echo "Starting health server (/opt/health_server.py) in background..."
  nohup python3 /opt/health_server.py >/tmp/health_server.log 2>&1 &
  HEALTH_PID=$!
  echo "health server pid=${HEALTH_PID}"
  # give it a moment to bind
  sleep 0.5
fi

# Start a heartbeat agent to POST to backend and write a local timestamp
if [ -f /opt/cpp_heartbeat.py ]; then
  echo "Starting cpp heartbeat agent in background..."
  nohup python3 /opt/cpp_heartbeat.py >/tmp/cpp_heartbeat_agent.log 2>&1 &
  HB_PID=$!
  echo "cpp heartbeat pid=${HB_PID}"
fi

# Wait on app process so container keeps running
wait ${APP_PID}
