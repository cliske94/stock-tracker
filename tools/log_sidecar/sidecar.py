import os
import time
import json
import requests

LOG_PATH = os.environ.get('LOG_PATH', '/var/log/app.log')
APP_NAME = os.environ.get('APP_NAME', 'unknown')
COLLECTOR = os.environ.get('COLLECTOR_URL', 'http://collector:5000/ingest')

def follow(path):
    try:
        f = open(path, 'r')
    except FileNotFoundError:
        # create empty file and open
        open(path, 'a').close()
        f = open(path, 'r')
    # seek to end
    f.seek(0, 2)
    while True:
        line = f.readline()
        if line:
            yield line
        else:
            time.sleep(0.5)

def batch_and_send(iterator, interval=60):
    buffer = []
    last_send = time.time()
    for line in iterator:
        buffer.append(line.rstrip('\n'))
        now = time.time()
        if now - last_send >= interval:
            payload = {'app': APP_NAME, 'logs': buffer[-1000:]}  # cap
            try:
                requests.post(COLLECTOR, json=payload, timeout=5)
            except Exception:
                pass
            buffer = []
            last_send = now

def main():
    tail = follow(LOG_PATH)
    # Start sending in a simple loop; this is per-pod sidecar so it only reports its app
    batch_and_send(tail, interval=int(os.environ.get('REPORT_INTERVAL', '60')))

if __name__ == '__main__':
    main()
