import sqlite3
import time
import json
from queue import Queue, Empty
import threading
from flask import Flask, request, jsonify, render_template, g, Response
import os

# Try to use prometheus_client when available; otherwise fall back to plain-text
try:
    from prometheus_client import CollectorRegistry, Gauge, generate_latest
    HAS_PROM = True
except Exception:
    HAS_PROM = False

DB_PATH = os.environ.get('DASH_DB', './data/metrics.db')

app = Flask(__name__)

# SSE subscribers
_sub_lock = threading.Lock()
_subscribers = []  # list of Queue()

def notify_subscribers(msg: dict):
    payload = json.dumps(msg)
    with _sub_lock:
        for q in list(_subscribers):
            try:
                q.put(payload)
            except Exception:
                # ignore bad subscriber
                try:
                    _subscribers.remove(q)
                except Exception:
                    pass

def event_stream(q: Queue):
    try:
        while True:
            try:
                # check frequently so the worker doesn't appear idle to gunicorn
                data = q.get(timeout=5)
                yield f"data: {data}\n\n"
            except Empty:
                # send a comment to keep connection alive
                yield ": keepalive\n\n"
    finally:
        # cleanup handled by caller
        pass


def collect_prometheus_metrics_text():
    """Return Prometheus exposition text built from DB metrics."""
    try:
        db = get_db()
    except Exception:
        try:
            init_db()
            db = get_db()
        except Exception:
            return ''

    out_lines = []
    # helpers
    def help_line(name, text):
        out_lines.append(f"# HELP {name} {text}")
    def type_gauge(name):
        out_lines.append(f"# TYPE {name} gauge")

    # total counts
    row = db.execute('SELECT COUNT(*) as c FROM metrics').fetchone()
    count = int(row['c']) if row else 0
    help_line('dashboard_metric_points_total', 'Total metric rows in DB')
    type_gauge('dashboard_metric_points_total')
    out_lines.append(f"dashboard_metric_points_total {count}")

    help_line('dashboard_db_row_count', 'DB row count')
    type_gauge('dashboard_db_row_count')
    out_lines.append(f"dashboard_db_row_count {count}")

    last = db.execute('SELECT ts FROM metrics ORDER BY ts DESC LIMIT 1').fetchone()
    last_ts = int(last['ts']) if last and last['ts'] else 0
    help_line('dashboard_last_ingest_timestamp', 'Last ingest timestamp')
    type_gauge('dashboard_last_ingest_timestamp')
    out_lines.append(f"dashboard_last_ingest_timestamp {last_ts}")

    # per-service metrics
    help_line('dashboard_service_uptime_seconds', 'Last recorded uptime (seconds)')
    type_gauge('dashboard_service_uptime_seconds')
    help_line('dashboard_service_requests', 'Last recorded requests')
    type_gauge('dashboard_service_requests')

    rows = db.execute('SELECT service, uptime, requests, MAX(ts) as ts FROM metrics GROUP BY service').fetchall()
    now = int(time.time())
    thresh = int(os.environ.get('UP_THRESHOLD', '90'))
    up_count = 0
    for r in rows:
        svc = r['service']
        uptime = int(r['uptime'] or 0)
        requests = int(r['requests'] or 0)
        ts = int(r['ts'] or 0)
        out_lines.append(f'dashboard_service_uptime_seconds{{service="{svc}"}} {uptime}')
        out_lines.append(f'dashboard_service_requests{{service="{svc}"}} {requests}')
        if now - ts <= thresh:
            up_count += 1

    help_line('dashboard_services_up', 'Number of services up within threshold')
    type_gauge('dashboard_services_up')
    out_lines.append(f'dashboard_services_up {up_count}')

    return "\n".join(out_lines) + "\n"

def get_db():
    db = getattr(g, '_database', None)
    if db is None:
        os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
        db = g._database = sqlite3.connect(DB_PATH, check_same_thread=False)
        db.row_factory = sqlite3.Row
    return db

@app.teardown_appcontext
def close_connection(exception):
    db = getattr(g, '_database', None)
    if db is not None:
        db.close()

def init_db():
    db = get_db()
    db.execute('''
        CREATE TABLE IF NOT EXISTS metrics (
            id INTEGER PRIMARY KEY,
            service TEXT NOT NULL,
            uptime INTEGER NOT NULL,
            requests INTEGER NOT NULL,
            ts INTEGER NOT NULL
        )
    ''')
    db.commit()

# Initialize DB at import time so the app works under gunicorn
try:
    init_db()
except Exception:
    # ignore errors during import-time initialization; worker will attempt on demand
    pass

@app.route('/ingest', methods=['POST'])
def ingest():
    data = request.get_json() or {}
    service = data.get('service')
    uptime = int(data.get('uptime', 0))
    requests_count = int(data.get('requests', 0))
    if not service:
        return jsonify({'error':'service required'}), 400
    ts = int(time.time())
    db = get_db()
    try:
        db.execute('INSERT INTO metrics (service, uptime, requests, ts) VALUES (?, ?, ?, ?)',
                   (service, uptime, requests_count, ts))
        db.commit()
        # notify any connected SSE clients about the new ingest
        try:
            notify_subscribers({'service': service, 'uptime': uptime, 'requests': requests_count, 'ts': ts})
        except Exception:
            pass
        return jsonify({'ok':True}), 201
    except Exception:
        try:
            init_db()
            db.execute('INSERT INTO metrics (service, uptime, requests, ts) VALUES (?, ?, ?, ?)',
                       (service, uptime, requests_count, ts))
            db.commit()
            return jsonify({'ok':True}), 201
        except Exception as e:
            print('ingest error', e)
            return jsonify({'error':'failed to ingest'}), 500

@app.route('/api/services')
def services():
    db = get_db()
    try:
        rows = db.execute('SELECT DISTINCT service FROM metrics').fetchall()
    except Exception:
        # attempt to initialize DB and retry once
        try:
            init_db()
            rows = db.execute('SELECT DISTINCT service FROM metrics').fetchall()
        except Exception:
            return jsonify([])
    return jsonify([r['service'] for r in rows])

@app.route('/api/series')
def series():
    svc = request.args.get('service')
    since = int(request.args.get('since', 0))
    if not svc:
        return jsonify({'error':'service query param required'}), 400
    db = get_db()
    try:
        rows = db.execute('SELECT ts, uptime, requests FROM metrics WHERE service=? AND ts>=? ORDER BY ts ASC',
                          (svc, since)).fetchall()
    except Exception:
        try:
            init_db()
            rows = db.execute('SELECT ts, uptime, requests FROM metrics WHERE service=? AND ts>=? ORDER BY ts ASC',
                              (svc, since)).fetchall()
        except Exception:
            return jsonify([])
    out = [{'ts':r['ts'],'uptime':r['uptime'],'requests':r['requests']} for r in rows]
    return jsonify(out)

@app.route('/api/latest')
def latest():
    db = get_db()
    try:
        rows = db.execute('SELECT service, MAX(ts) as ts FROM metrics GROUP BY service').fetchall()
    except Exception:
        try:
            init_db()
            rows = db.execute('SELECT service, MAX(ts) as ts FROM metrics GROUP BY service').fetchall()
        except Exception:
            return jsonify({})
    result = {}
    for r in rows:
        svc = r['service']
        row = db.execute('SELECT uptime, requests, ts FROM metrics WHERE service=? ORDER BY ts DESC LIMIT 1', (svc,)).fetchone()
        result[svc] = {'uptime': row['uptime'], 'requests': row['requests'], 'ts': row['ts']}
    return jsonify(result)


@app.route('/events')
def events():
    q = Queue()
    with _sub_lock:
        _subscribers.append(q)

    def gen():
        try:
            for chunk in event_stream(q):
                yield chunk
        finally:
            # remove subscriber on disconnect
            with _sub_lock:
                try:
                    _subscribers.remove(q)
                except ValueError:
                    pass

    return Response(gen(), mimetype='text/event-stream')

@app.route('/')
def dashboard():
    return render_template('dashboard.html')


@app.route('/metrics')
def metrics_endpoint():
    try:
        if HAS_PROM:
            registry = CollectorRegistry()
            g_services_up = Gauge('dashboard_services_up', 'Number of services up within threshold', registry=registry)
            g_total_points = Gauge('dashboard_metric_points_total', 'Total metric rows in DB', registry=registry)
            g_last_ingest = Gauge('dashboard_last_ingest_timestamp', 'Last ingest timestamp', registry=registry)
            g_service_uptime = Gauge('dashboard_service_uptime_seconds', 'Last recorded uptime (seconds)', ['service'], registry=registry)
            g_service_requests = Gauge('dashboard_service_requests', 'Last recorded requests', ['service'], registry=registry)
            g_db_row_count = Gauge('dashboard_db_row_count', 'DB row count', registry=registry)

            try:
                db = get_db()
            except Exception:
                try:
                    init_db()
                    db = get_db()
                except Exception:
                    return Response('', mimetype='text/plain; version=0.0.4; charset=utf-8')

            row = db.execute('SELECT COUNT(*) as c FROM metrics').fetchone()
            count = int(row['c']) if row else 0
            g_total_points.set(count)
            g_db_row_count.set(count)

            last = db.execute('SELECT ts FROM metrics ORDER BY ts DESC LIMIT 1').fetchone()
            if last and last['ts']:
                g_last_ingest.set(int(last['ts']))

            rows = db.execute('SELECT service, uptime, requests, MAX(ts) as ts FROM metrics GROUP BY service').fetchall()
            now = int(time.time())
            thresh = int(os.environ.get('UP_THRESHOLD', '90'))
            up_count = 0
            for r in rows:
                svc = r['service']
                uptime = int(r['uptime'] or 0)
                requests = int(r['requests'] or 0)
                ts = int(r['ts'] or 0)
                g_service_uptime.labels(svc).set(uptime)
                g_service_requests.labels(svc).set(requests)
                if now - ts <= thresh:
                    up_count += 1

            g_services_up.set(up_count)

            data = generate_latest(registry)
            return Response(data, mimetype='text/plain; version=0.0.4; charset=utf-8')
        else:
            data = collect_prometheus_metrics_text()
            return Response(data, mimetype='text/plain; version=0.0.4; charset=utf-8')
    except Exception as e:
        print('metrics error', e)
        return Response('', mimetype='text/plain; version=0.0.4; charset=utf-8')

if __name__ == '__main__':
    # Ensure DB initialization runs inside the Flask application context
    try:
        with app.app_context():
            init_db()
    except Exception:
        pass
    port = int(os.environ.get('DASH_PORT', '8085'))
    app.run(host='0.0.0.0', port=port)
