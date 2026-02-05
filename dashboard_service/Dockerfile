FROM python:3.11-slim
WORKDIR /app
COPY requirements.txt /app/
RUN pip install --no-cache-dir -r requirements.txt
COPY . /app
RUN mkdir -p /data
ENV DASH_DB=/data/metrics.db
EXPOSE 8085
CMD ["gunicorn", "-b", "0.0.0.0:8085", "app:app"]
