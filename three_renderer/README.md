# Three Renderer

Lightweight Node service that converts a Mermaid diagram (embedded in `angular_ui/dist/index.html`) into a simple Wavefront OBJ where each Mermaid node is a cube, and serves a Three.js viewer at `/`.

Endpoints:
- `/` : Three.js viewer
- `/model.obj` : generated OBJ model
- `/metrics` : Prometheus metrics

Build & run (local Docker):

```bash
docker build -t three-renderer:latest three_renderer
docker run --rm -p 9092:9092 three-renderer:latest
```
