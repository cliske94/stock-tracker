from flask import Flask, request, jsonify, Response
from collections import deque
import threading
from prometheus_client import Counter, generate_latest, CONTENT_TYPE_LATEST

app = Flask(__name__)
# store last 2000 lines per app
storage = {}
lock = threading.Lock()

# Prometheus metric: total log lines received per app
LOG_LINES = Counter('log_lines_total', 'Total log lines received', ['app'])


@app.route('/ingest', methods=['POST'])
def ingest():
    data = request.get_json() or {}
    appname = data.get('app', 'unknown')
    logs = data.get('logs', [])
    with lock:
        dq = storage.setdefault(appname, deque(maxlen=2000))
        for l in logs:
            dq.append({'ts': None, 'line': l})
        # update prometheus counter by number of lines received
        if logs:
            try:
                LOG_LINES.labels(app=appname).inc(len(logs))
            except Exception:
                pass
    return ('', 204)


@app.route('/logs', methods=['GET'])
def get_logs():
    # return all apps and latest lines
    with lock:
        out = {k: list(v)[-200:] for k, v in storage.items()}
    return jsonify(out)


@app.route('/metrics', methods=['GET'])
def metrics():
    # Expose Prometheus metrics
    data = generate_latest()
    return Response(data, mimetype=CONTENT_TYPE_LATEST)


if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000)
