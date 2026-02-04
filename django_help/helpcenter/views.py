from django.shortcuts import render
from django.http import Http404

# simple in-memory page index
PAGES = [
    {"title": "API Specification", "slug": "api-spec", "summary": "OpenAPI-style API spec for backend endpoints."},
    {"title": "Using the Rust GUI", "slug": "rust-gui", "summary": "How to build and use the Rust SDL2 GUI frontend."},
    {"title": "Using the C++ client", "slug": "cpp-client", "summary": "Build/run notes for the C++ clients and examples."},
    {"title": "WebSockets UI (Python)", "slug": "websockets-ui", "summary": "Using the Python Tkinter WebSockets GUI to view and manage your watchlist."},
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
