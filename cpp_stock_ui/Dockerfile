FROM debian:trixie-slim

ENV DEBIAN_FRONTEND=noninteractive
WORKDIR /opt

# Runtime deps: Qt5 widgets, X server, VNC, window manager, Git for noVNC
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        ca-certificates \
        libqt5widgets5 \
        libqt5gui5 \
        libqt5core5a \
        libxcb1 \
        libx11-6 \
        libgl1-mesa-dri \
        libglx-mesa0 \
        libglu1-mesa \
        libcurl4 \
        xvfb \
        x11vnc \
        fluxbox \
        git \
        python3 \
        websockify \
    && rm -rf /var/lib/apt/lists/*

# Copy the already-built binary and helper files from repo
COPY stock_ui /opt/stock_ui
# token.txt should not be baked into images. Mount at runtime or use Kubernetes Secrets.
# COPY token.txt /opt/token.txt
COPY watchlist.txt /opt/watchlist.txt
COPY start.sh /opt/start.sh
COPY health_server.py /opt/health_server.py
COPY cpp_heartbeat.py /opt/cpp_heartbeat.py
RUN chmod +x /opt/stock_ui /opt/start.sh || true

# Install noVNC
RUN git clone --depth 1 https://github.com/novnc/noVNC.git /opt/noVNC || true && chmod -R a+rX /opt/noVNC || true

EXPOSE 5901
EXPOSE 6082
EXPOSE 9090

CMD ["/opt/start.sh"]
