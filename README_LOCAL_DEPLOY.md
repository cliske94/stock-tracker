**Local run & Kubernetes deployment**

- **Purpose:** concise steps to run the GUI services locally (docker-compose) and to deploy to Kubernetes using the manifests in `k8s/`.

**Prerequisites:**
- **Docker:** installed and you are logged in (`docker login`).
- **kubectl:** configured to talk to your cluster (only needed for k8s steps).
- **Files:** See the manifests in `k8s/` and service code in `cpp_stock_ui/` and `python_watchlist_gui/`.

**Additional docs:** For a compact reference covering Docker image builds, docker-compose examples, token mounts, and Kubernetes deployment steps (including creating Secrets and using a sidecar websockify/noVNC), see `docs/docker_k8s_setup.md`.

**Quick local run (docker-compose)**
- Build images locally (optional; images already built in this repo):

```bash
# from repository root
sudo docker build -t cpp-stock-ui:latest ./cpp_stock_ui
sudo docker build -t python-watchlist-gui:latest ./python_watchlist_gui
```

- Run with docker-compose (uses the local images and the compose file):

```bash
# from repository root
docker-compose up --build
# or run just the cpp service
docker-compose up --no-deps --build cpp_stock_ui
```

- Access noVNC in your browser:
  - Python GUI: http://localhost:6080/vnc.html
  - C++ GUI: http://localhost:6082/vnc.html
  - VNC password: taken from `./.env` (VNC_PASSWORD)

- Check health endpoints from host (after containers are up):

```bash
curl -fsS http://127.0.0.1:6082/internal/healthcheck || echo "cpp health failed"
curl -fsS http://127.0.0.1:6080/internal/healthcheck || echo "python health failed"
```

**Push images to Docker Hub (already pushed in this repo)**
- Images were pushed to your Docker Hub namespace `cliske01` as:
  - `cliske01/cpp-stock-ui:latest`
  - `cliske01/python-watchlist-gui:latest`

If you need to push locally, run:

```bash
# tag if needed
docker tag cpp-stock-ui:latest cliske01/cpp-stock-ui:latest
docker tag python-watchlist-gui:latest cliske01/python-watchlist-gui:latest
# login and push
docker login
docker push cliske01/cpp-stock-ui:latest
docker push cliske01/python-watchlist-gui:latest
```

**Kubernetes deployment (manual steps)**
1. Prepare a short-lived backend token for optional CRUD checks.

```bash
# create secret with BACKEND_TOKEN (replace YOUR_TOKEN)
kubectl create secret generic backend-credentials --from-literal=BACKEND_TOKEN=YOUR_TOKEN
```

2. Ensure VNC password secrets exist (manifests already include example secrets). If you want to create/replace:

```bash
kubectl create secret generic python-watchlist-secret --from-literal=VNC_PASSWORD=87ranger
kubectl create secret generic cpp-stock-ui-secret --from-literal=VNC_PASSWORD=87ranger
```

3. Apply manifests (these reference images under `cliske01`):

```bash
kubectl apply -f k8s/backend-credentials-secret.yaml
kubectl apply -f k8s/python_watchlist_gui-deployment.yaml
kubectl apply -f k8s/cpp_stock_ui-deployment.yaml
# (optional) sidecar variant
kubectl apply -f k8s/cpp_stock_ui-deployment-sidecar.yaml
```

4. Watch rollout status:

```bash
kubectl rollout status deployment/python-watchlist-gui
kubectl rollout status deployment/cpp-stock-ui
```

5. Verify pods and logs:

```bash
kubectl get pods -l app=cpp-stock-ui
kubectl get pods -l app=python-watchlist-gui
kubectl logs deployment/cpp-stock-ui -c cpp-stock-ui --tail=200
kubectl logs deployment/python-watchlist-gui -c gui --tail=200
```

6. Check internal health endpoints (port-forward or use cluster service):

```bash
# port-forward cpp web UI and health
kubectl port-forward svc/cpp-stock-ui 6082:6082 9090:9090
# then locally
curl -fsS http://127.0.0.1:9090/internal/healthcheck
curl -fsS http://127.0.0.1:6082/vnc.html
```

**Environment variables & options**
- `ENABLE_CRUD_CHECK=true` enables a safe create+delete CRUD check in health endpoints; make sure `BACKEND_TOKEN` (Secret) contains a token with permission for that operation.
- Health endpoints:
  - `/internal/heartbeat` — returns last heartbeat timestamp written by the app.
  - `/internal/healthcheck` — performs read-only backend checks; optional CRUD provided when enabled.
- Heartbeat files written in container:
  - C++: `/tmp/cpp_heartbeat`
  - Python GUI: `/tmp/python_heartbeat`

**Troubleshooting**
- If noVNC returns connection reset, check x11vnc and websockify logs inside container (`/tmp/x11vnc.log`, `/tmp/websockify.log`).
- If pods fail to pull images, ensure the manifest image names match images in your registry and cluster nodes can access Docker Hub (or set imagePullSecrets).
- If health checks fail intermittently, allow extra `initialDelaySeconds` in readinessProbe or increase `HEARTBEAT_INTERVAL`.

**Files touched / relevant paths**
- `k8s/cpp_stock_ui-deployment.yaml` (Deployment + Service + Secret)
- `k8s/cpp_stock_ui-deployment-sidecar.yaml` (sidecar example)
- `k8s/python_watchlist_gui-deployment.yaml` (Deployment + Secret + Service)
- `k8s/backend-credentials-secret.yaml` (empty template for BACKEND_TOKEN)
- `cpp_stock_ui/` and `python_watchlist_gui/` contain Dockerfiles, start scripts, and health agents.

**If you want me to apply the manifests**
- Provide kubeconfig or grant access in this environment; I can run `kubectl apply -f k8s/` and monitor rollouts.

---
If you'd like, I can now generate a small script to automate the `kubectl` secret creation and `kubectl apply` steps (run locally). Would you like that?