Django Help Site

This folder contains a minimal Django project that serves searchable HTML help pages and an API specification.

Quick setup (Linux):

1. Create a virtualenv and install dependencies

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

Note: On some Linux systems you may need to install the system venv package first:

```bash
sudo apt update && sudo apt install -y python3-venv
```

2. Run migrations and start dev server

```bash
cd django_help
python manage.py migrate
python manage.py runserver 127.0.0.1:8001
```

3. Open the help UI:

- Index: http://127.0.0.1:8001/help/
- Example API spec: http://127.0.0.1:8001/help/api-spec/

Notes:
- The help pages are plain HTML templates located in `helpcenter/templates/helpcenter/help_pages/`.
- The search box performs client-side filtering of page titles; clicking a result loads the full page.
- This is a minimal scaffold intended for local usage and documentation; adapt settings in `helpsite/settings.py` for production.
