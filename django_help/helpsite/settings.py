import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
SECRET_KEY = 'change-me-for-production'
DEBUG = True
ALLOWED_HOSTS = ['*']

INSTALLED_APPS = [
    'django.contrib.staticfiles',
    'helpcenter',
]

MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    'whitenoise.middleware.WhiteNoiseMiddleware',
    'django.middleware.common.CommonMiddleware',
]

ROOT_URLCONF = 'helpsite.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [os.path.join(BASE_DIR, 'helpcenter', 'templates')],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.debug',
            ],
        },
    },
]

WSGI_APPLICATION = 'helpsite.wsgi.application'

DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.sqlite3',
        'NAME': os.path.join(BASE_DIR, 'db.sqlite3'),
    }
}

STATIC_URL = '/static/'
STATICFILES_DIRS = [os.path.join(BASE_DIR, 'helpcenter', 'static')]
STATIC_ROOT = os.path.join(BASE_DIR, 'staticfiles')
# Use WhiteNoise static files storage so gunicorn can serve compressed files in production
STATICFILES_STORAGE = 'whitenoise.storage.CompressedStaticFilesStorage'

# Logging configuration
import logging
import logging.config

# Log path (environment overrides). In-cluster set LOG_PATH to /var/log/helpsite/helpsite.log
LOG_PATH = os.getenv('LOG_PATH', os.path.join(BASE_DIR, 'data', 'helpsite.log'))
LOG_DIR = os.path.dirname(LOG_PATH)
try:
    os.makedirs(LOG_DIR, exist_ok=True)
except Exception:
    # Best-effort: if directory cannot be created, fallback to BASE_DIR
    LOG_PATH = os.path.join(BASE_DIR, 'helpsite.log')

LOGGING = {
    'version': 1,
    'disable_existing_loggers': False,
    'formatters': {
        'standard': {
            'format': '%(asctime)s %(levelname)s %(name)s %(message)s'
        },
    },
    'handlers': {
        'console': {
            'class': 'logging.StreamHandler',
            'formatter': 'standard',
        },
        'file': {
            'class': 'logging.handlers.WatchedFileHandler',
            'filename': LOG_PATH,
            'formatter': 'standard',
        },
    },
    'root': {
        'handlers': ['console', 'file'],
        'level': os.getenv('LOG_LEVEL', 'INFO'),
    },
    'loggers': {
        'django': {
            'handlers': ['console', 'file'],
            'level': os.getenv('DJANGO_LOG_LEVEL', 'INFO'),
            'propagate': False,
        },
    },
}

try:
    logging.config.dictConfig(LOGGING)
except Exception as e:
    # If file handler cannot be configured (permissions, read-only FS),
    # fall back to console-only logging to avoid preventing Django from starting.
    print('WARNING: logging config failed, falling back to console only:', e)
    LOGGING['handlers'].pop('file', None)
    if 'file' in LOGGING.get('root', {}).get('handlers', []):
        LOGGING['root']['handlers'] = [h for h in LOGGING['root']['handlers'] if h != 'file']
    if 'file' in LOGGING.get('loggers', {}).get('django', {}).get('handlers', []):
        LOGGING['loggers']['django']['handlers'] = [h for h in LOGGING['loggers']['django']['handlers'] if h != 'file']
    logging.config.dictConfig(LOGGING)
