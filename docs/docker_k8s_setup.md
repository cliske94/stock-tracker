# Docker and Kubernetes: container and deployment notes

This page documents how to build and run the GUI container locally, common docker-compose usage, and example steps for deploying the GUI using Kubernetes manifests in `k8s/`.

## Build the image

From the repository root, build the image (example tag `watchlist:local`):

```bash
# from /home/cody/Projects
docker build -t watchlist:local -f python_watchlist_gui/Dockerfile python_watchlist_gui/
```

Adjust the `-f` path if your Dockerfile is elsewhere.

## Running locally with Docker

Quick example that mounts a local token file and exposes noVNC/websockify ports:

```bash
# host token path: /home/cody/Projects/token.txt
docker run --rm \
  -e BACKEND_URL=http://host.docker.internal:8080 \
  -e BACKEND_WS=ws://host.docker.internal:8080/ws-plain \
  -v /home/cody/Projects/token.txt:/app/token.txt:ro \
  -p 6081:6081 \
  -p 5901:5901 \
  --name python_watchlist_gui_local \
  watchlist:local
```

Notes:
- `BACKEND_URL`/`BACKEND_WS` override where the GUI connects to your backend. When the backend runs on the same host, use `host.docker.internal` (Docker Desktop) or map host networking appropriately.
- The container's `start.sh` attempts to launch `Xvfb`, `x11vnc`, and `websockify`. Running these as root can cause port conflicts with other system processes; prefer running containers on an isolated machine or change published ports if required.
- The token file is read from `/app/token.txt` by the GUI. Mount your token into that path for auto-populate behavior.

## Using docker-compose

The repository contains `docker-compose.yml` (or adapt the snippet below). Key points:
- Define environment variables for `BACKEND_URL` and `BACKEND_WS`.
- Mount the host `token.txt` into `/app/token.txt` (read-only).
- Expose both the VNC port (5901) and the noVNC web proxy port (6081) if you want browser access.

Example snippet for `docker-compose.yml` service:

```yaml
services:
  watchlist:
    image: watchlist:local
    environment:
      - BACKEND_URL=http://host.docker.internal:8080
      - BACKEND_WS=ws://host.docker.internal:8080/ws-plain
    volumes:
      - /home/cody/Projects/token.txt:/app/token.txt:ro
    ports:
      - 6081:6081
      - 5901:5901
```

If ports are in use on the host, change the left side (host ports) to unused high ports and open those in your browser (for example `6091:6081`).

## Kubernetes deployment notes (k8s/)

There are example manifests in the `k8s/` folder. Basic approach to deploy locally:

1. Create a secret for the token (do not store secrets in plain YAML in production):

```bash
kubectl create secret generic watchlist-token --from-file=token.txt=/home/cody/Projects/token.txt
```

2. Use a `Deployment` manifest (or adapt the provided `cpp_stock_ui-deployment-sidecar.yaml`) and mount the secret as a volume or expose it as an environment variable. Example volume mount in pod spec:

```yaml
volumes:
  - name: token-volume
    secret:
      secretName: watchlist-token

containers:
  - name: watchlist
    image: watchlist:local
    volumeMounts:
      - name: token-volume
        mountPath: /app/token.txt
        subPath: token.txt
```

3. Expose the service. For local testing you can use `NodePort` or `Port Forwarding`:

```bash
# Replace <deployment-name> and <pod-port> as needed
kubectl expose deployment watchlist --type=NodePort --port=6081 --target-port=6081
# Or port-forward to your local machine
kubectl port-forward deployment/watchlist 6081:6081
```

4. If you want the VNC port accessible directly (not generally recommended), expose `5901` the same way. Remember security: VNC is not encrypted by default, use a secure setup for production.

## Running websockify/noVNC in Kubernetes

Options:
- Run `websockify` as part of the same container (the project's `start.sh` may already do this).
- Run `websockify` as a sidecar container in the same pod that proxies `127.0.0.1:5901` to `0.0.0.0:6081` and serves the noVNC static files.
- Alternatively, run a dedicated noVNC deployment that proxies to the VNC server via an internal ClusterIP.

Sidecar example outline:

```yaml
containers:
  - name: watchlist
    image: watchlist:local
    # runs Xvfb and x11vnc, binds 127.0.0.1:5901
  - name: websockify
    image: python:3.11-slim
    command: ["/usr/local/bin/websockify", "0.0.0.0:6081", "127.0.0.1:5901", "--web", "/opt/noVNC"]
    ports:
      - containerPort: 6081
```

## Troubleshooting tips

- If you see a black screen in the browser but `x11vnc` log shows Framebuffer updates, restart `x11vnc` with `-noxdamage -nowf` to force full framebuffer updates (see `docs/novnc.html` in the helpcenter for step-by-step troubleshooting).
- Avoid running multiple processes that bind the same host ports (Docker's `docker-proxy` can block host ports even with containers stopped). Use `ss -ltnp` to list listeners.
- Prefer running `websockify` as the same non-root user that runs `x11vnc` to avoid Xauthority and permission issues.

## Security notes

- Do not expose VNC (`5901`) publicly without tunneling (SSH tunnel, VPN) or authentication.
- Use Kubernetes `Secrets` for tokens and narrow pod permissions.
- Consider TLS for the noVNC proxy (websockify supports TLS) or use an Ingress terminating TLS in front of the noVNC service.


---

For quick reference, see also: `k8s/` manifests and `docker-compose.yml` in the repo root.
