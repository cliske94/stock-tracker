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
]

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
