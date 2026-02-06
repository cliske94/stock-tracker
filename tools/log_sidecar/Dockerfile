FROM python:3.11-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY sidecar.py .
ENV LOG_PATH=/var/log/app.log
ENV APP_NAME=unknown
ENV COLLECTOR_URL=http://collector:5000/ingest
CMD ["python", "sidecar.py"]
