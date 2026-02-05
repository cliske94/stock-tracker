import sqlite3
import time
from flask import Flask, request, jsonify, render_template, g
import os

DB_PATH = os.environ.get('DASH_DB', '/data/metrics.db')

app = Flask(__name__)

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

@app.before_first_request
def startup():
    init_db()

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
    db.execute('INSERT INTO metrics (service, uptime, requests, ts) VALUES (?, ?, ?, ?)',
               (service, uptime, requests_count, ts))
    db.commit()
    return jsonify({'ok':True}), 201

@app.route('/api/services')
def services():
    db = get_db()
    rows = db.execute('SELECT DISTINCT service FROM metrics').fetchall()
    return jsonify([r['service'] for r in rows])

@app.route('/api/series')
def series():
    svc = request.args.get('service')
    since = int(request.args.get('since', 0))
    if not svc:
        return jsonify({'error':'service query param required'}), 400
    db = get_db()
    rows = db.execute('SELECT ts, uptime, requests FROM metrics WHERE service=? AND ts>=? ORDER BY ts ASC',
                      (svc, since)).fetchall()
    out = [{'ts':r['ts'],'uptime':r['uptime'],'requests':r['requests']} for r in rows]
    return jsonify(out)

@app.route('/api/latest')
def latest():
    db = get_db()
    rows = db.execute('SELECT service, MAX(ts) as ts FROM metrics GROUP BY service').fetchall()
    result = {}
    for r in rows:
        svc = r['service']
        row = db.execute('SELECT uptime, requests, ts FROM metrics WHERE service=? ORDER BY ts DESC LIMIT 1', (svc,)).fetchone()
        result[svc] = {'uptime': row['uptime'], 'requests': row['requests'], 'ts': row['ts']}
    return jsonify(result)

@app.route('/')
def dashboard():
    return render_template('dashboard.html')

if __name__ == '__main__':
    init_db()
    app.run(host='0.0.0.0', port=8085)
