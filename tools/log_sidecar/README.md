Log Sidecar
---------------

A tiny sidecar that tails a log file and periodically (default 60s) POSTs collected lines to a central collector.

Build:
```
docker build -t local/log-sidecar:latest ./tools/log_sidecar
```

Run example (local):
```
docker run -e APP_NAME=helpsite -e LOG_PATH=/var/log/app.log -e COLLECTOR_URL=http://host.docker.internal:5000/ingest \
  -v /path/to/app/log:/var/log local/log-sidecar:latest
```

In k8s, mount an emptyDir at `/var/log` and ensure the main container writes logs to `/var/log/app.log` (or adapt `LOG_PATH`).
