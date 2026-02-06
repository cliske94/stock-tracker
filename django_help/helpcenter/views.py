from django.shortcuts import render
from django.http import Http404, JsonResponse
from django.http import HttpResponse

# Try to use prometheus_client to expose metrics; if not available, return 404
try:
    from prometheus_client import generate_latest, CollectorRegistry, Gauge
    PROM_AVAILABLE = True
except Exception:
    PROM_AVAILABLE = False

# simple in-memory page index
PAGES = [
    {"title": "API Specification", "slug": "api-spec", "summary": "OpenAPI-style API spec for backend endpoints."},
    {"title": "Using the Rust GUI", "slug": "rust-gui", "summary": "How to build and use the Rust SDL2 GUI frontend."},
    {"title": "Using the C++ client", "slug": "cpp-client", "summary": "Build/run notes for the C++ clients and examples."},
    {"title": "WebSockets UI (Python)", "slug": "websockets-ui", "summary": "Using the Python Tkinter WebSockets GUI to view and manage your watchlist."},
    {"title": "noVNC / VNC Troubleshooting", "slug": "novnc", "summary": "How to expose X displays via x11vnc and noVNC, common problems and fixes."},
    {"title": "Mermaid Diagrams & 3D Model", "slug": "mermaid", "summary": "Render Mermaid markdown and explore 3D models and semantic metadata."},
    {"title": "3D Viewer (GLTF)", "slug": "viewer-3d", "summary": "Interactive Three.js GLTF viewer with timeline and heatmap modes (embeds three_renderer)."},
    {"title": "Force Graph", "slug": "force-graph", "summary": "D3 force-directed force graph visualizer for repo nodes and relationships."},
    {"title": "Treemap", "slug": "treemap", "summary": "Treemap view showing LOC/metric breakdown by repo and module."},
    {"title": "Visualizations Overview", "slug": "viz-docs", "summary": "Documentation for the visualization pages: mermaid, 3D model, force graph, treemap, and heatmap."},
    {"title": "Repository Graph (Graphviz)", "slug": "repo-graph", "summary": "Graphviz diagram overview of repository structure and relationships."},
    {"title": "Application Suite", "slug": "app-suite", "summary": "Overview pages for each running container and the application suite as a whole."},
    {"title": "Data Architecture", "slug": "data-architecture", "summary": "Diagram of data flows between generators, model artifacts, visualizers, and monitoring/logging."},
    {"title": "Data Stores", "slug": "data-architecture-datastores", "summary": "Datastores used across the suite (SQLite, MongoDB) and where they're accessed."},
    {"title": "Services & Pipelines", "slug": "data-architecture-services", "summary": "Services, generators and pipelines that produce and consume data artifacts."},
    {"title": "Data Flows", "slug": "data-architecture-flows", "summary": "End-to-end data exchange between services, visualizers, and monitoring components."},
]

# per-container pages
CONTAINER_PAGES = [
    {"title": "three-renderer", "slug": "container-three-renderer", "summary": "three-renderer service (Node static server for visualizations)."},
    {"title": "spring-backend", "slug": "container-spring-backend", "summary": "Spring backend service."},
    {"title": "python-watchlist-gui", "slug": "container-python-watchlist-gui", "summary": "Python watchlist GUI (noVNC/webapp)."},
    {"title": "prometheus", "slug": "container-prometheus", "summary": "Prometheus monitoring service."},
    {"title": "grafana", "slug": "container-grafana", "summary": "Grafana dashboards."},
    {"title": "loki", "slug": "container-loki", "summary": "Loki log aggregation service."},
    {"title": "dashboard-service", "slug": "container-dashboard-service", "summary": "Dashboard backend service."},
    {"title": "cpp-stock-ui", "slug": "container-cpp-stock-ui", "summary": "C++ stock UI frontend service."},
    {"title": "angular-ui", "slug": "container-angular-ui", "summary": "Angular UI frontend container."},
]

# merge container pages into PAGES so they are discoverable
PAGES.extend(CONTAINER_PAGES)

def index(request):
    return render(request, 'helpcenter/index.html', { 'pages': PAGES })

def page(request, slug):
    # ensure slug exists
    for p in PAGES:
        if p['slug'] == slug:
            try:
                return render(request, f'helpcenter/help_pages/{slug}.html', { 'page': p })
            except Exception:
                raise Http404("Page template not found")
    raise Http404("Page not found")

def api_spec(request):
    return render(request, 'helpcenter/help_pages/api-spec.html', { 'page': PAGES[0] })

def health(request):
    # Simple health endpoint used by docker-compose healthchecks
    return JsonResponse({'status': 'ok'})


def metrics(request):
    if not PROM_AVAILABLE:
        return HttpResponse('Prometheus client not installed', status=404)
    # Use a fresh registry so we only expose manually collected metrics for the helpsite
    registry = CollectorRegistry()
    # Example gauge: exporter up
    g = Gauge('helpsite_up', 'Helpsite up (1 = up)', registry=registry)
    g.set(1)
    output = generate_latest(registry)
    return HttpResponse(output, content_type='text/plain; version=0.0.4')
