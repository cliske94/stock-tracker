import os
from django.core.wsgi import get_wsgi_application
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'helpsite.settings')
application = get_wsgi_application()
try:
	# Wrap the WSGI application with WhiteNoise to ensure static files are served
	from whitenoise import WhiteNoise
	from django.conf import settings
	if getattr(settings, 'STATIC_ROOT', None):
		application = WhiteNoise(application, root=settings.STATIC_ROOT)
except Exception:
	# If WhiteNoise is unavailable or wrapping fails, continue without it
	pass
