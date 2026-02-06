from django.urls import path, include
from django.conf import settings
from django.views.static import serve

urlpatterns = [
    path('help/', include('helpcenter.urls')),
]

# Serve collected static files at /static/ via Django static view as a fallback
# (WhiteNoise should handle this in production; this ensures local gunicorn can
# serve static assets when middleware wrapping isn't applied for any reason.)
urlpatterns += [
    path('static/<path:path>', serve, {'document_root': settings.STATIC_ROOT}),
]
