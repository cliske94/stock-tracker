FROM python:3.11-slim

ENV PYTHONUNBUFFERED=1
WORKDIR /app

# Install runtime system deps required for GUI (tk) and VNC
RUN apt-get update \
     && apt-get install -y --no-install-recommends \
         build-essential \
         git \
         python3-tk \
         tk-dev \
         tcl-dev \
         xvfb \
         x11vnc \
         fluxbox \
         x11-utils \
     && rm -rf /var/lib/apt/lists/*

# Install Python dependencies early so container starts fast at runtime
COPY requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir -r /app/requirements.txt websockify

# Copy application and start script
COPY . /app
COPY start.sh /app/start.sh
RUN git clone --depth 1 https://github.com/novnc/noVNC.git /opt/novnc || true
RUN chmod -R a+rX /opt/novnc || true
RUN chmod +x /app/start.sh

# Create a default VNC password file at build time so x11vnc can use it
# Do NOT create a VNC password at build time; the runtime container will
# create `/root/.vnc/passwd` from the `VNC_PASSWORD` env var to avoid baking
# secrets into the image.

EXPOSE 5901
EXPOSE 6080
EXPOSE 9090

CMD ["/app/start.sh"]
