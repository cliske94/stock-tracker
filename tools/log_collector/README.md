Log Collector
--------------

Simple collector that accepts POST /ingest JSON payloads: {"app":"name","logs":["line1","line2"]}
and stores the last lines in-memory. Exposes `/logs` to retrieve logs by app.

Build and run locally:
```
docker build -t local/log-collector:latest ./tools/log_collector
docker run -p 5000:5000 local/log-collector:latest
```
