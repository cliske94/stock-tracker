Ingress setup and testing
=========================

This file explains how to install an Ingress controller (recommended: ingress-nginx) and how to test the `three-renderer` Ingress that routes `three-renderer.local` -> the `three-renderer` service.

1) Install an ingress controller

- For kind (recommended when using `kind`):

```bash
kubectl apply -f https://raw.githubusercontent.com/kubernetes/ingress-nginx/controller-v1.8.1/deploy/static/provider/kind/deploy.yaml
```

- For cloud or generic clusters (official manifest):

```bash
kubectl apply -f https://raw.githubusercontent.com/kubernetes/ingress-nginx/controller/main/deploy/static/provider/cloud/deploy.yaml
```

Or install via Helm (example):

```bash
helm repo add ingress-nginx https://kubernetes.github.io/ingress-nginx
helm repo update
helm install ingress-nginx ingress-nginx/ingress-nginx --namespace ingress-nginx --create-namespace
```

2) Apply the Ingress resource in this repo

```bash
kubectl apply -f k8s/three_renderer-ingress.yaml
```

3) Make `three-renderer.local` resolvable from your machine

Add an entry to `/etc/hosts` (for local testing) mapping to your cluster's ingress endpoint, for example:

```
127.0.0.1 three-renderer.local
```

Notes:
- If you're using `kind` with the `kind` provider manifest, the ingress controller will listen on the control-plane node and the host mapping above will work.
- If the controller Service creates a LoadBalancer, use its external IP instead of 127.0.0.1.

4) Test the ingress

```bash
curl -i -H "Host: three-renderer.local" http://localhost/
```

Or open in your browser: http://three-renderer.local (after adding `/etc/hosts` entry).

5) Debugging

- Check controller pods:

```bash
kubectl get pods -n ingress-nginx
kubectl logs -n ingress-nginx -l app.kubernetes.io/name=ingress-nginx --tail=200
```

- Check the Ingress resource and events:

```bash
kubectl describe ingress three-renderer-ingress
kubectl get ingress
```

6) Alternatives

- If you prefer not to install an ingress controller, keep using `kubectl port-forward svc/three-renderer 19092:9092` or change the `three-renderer` Service to `NodePort` and access the node port directly.
