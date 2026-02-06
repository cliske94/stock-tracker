# Multi-stage Dockerfile: build the full project on Ubuntu then produce a runtime image
FROM gradle:8.4-jdk21 AS builder
ENV DEBIAN_FRONTEND=noninteractive
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    ca-certificates \
    cmake \
    pkg-config \
    git \
    libgtest-dev \
    libcurl4-openssl-dev \
    openjdk-17-jdk \
    libsdl2-dev \
    libsdl2-ttf-dev \
    qtbase5-dev \
    && rm -rf /var/lib/apt/lists/*

# Build and install libgtest (Debian packages ship sources only)
RUN set -ex \
 && if [ -d /usr/src/googletest ]; then \
      cd /usr/src/googletest && cmake . && make -j"$(nproc)" && cp lib/*.a /usr/lib || true; \
    fi

WORKDIR /src
# copy entire project
COPY . /src/

# Ensure any copied host build/cache is removed so container builds cleanly
RUN rm -rf /src/build /src/CMakeCache.txt /src/CMakeFiles || true

# Configure, build C++ components, run tests, then build the Spring Boot jar
 RUN cmake -S . -B build -DCMAKE_BUILD_TYPE=Release \
 && cmake --build build --parallel \
 && cd build && ctest --output-on-failure \
 && cd /src/spring_hello_world \
 && gradle --no-daemon clean build -x test

FROM ubuntu:24.04 AS cpp-runtime
ENV DEBIAN_FRONTEND=noninteractive
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    libstdc++6 \
    libcurl4 \
    libsdl2-2.0-0 \
    libsdl2-ttf-2.0-0 \
    libqt5widgets5 \
    libxcb-icccm4 \
    libx11-6 \
    libxcb1 \
    python3 \
    curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /opt/hello
# copy built outputs from builder stage; some targets may be missing
COPY --from=builder /src/build /opt/hello/build

# Copy the lightweight C++ health endpoint server script
COPY ./tools/cpp_health.py /opt/hello/cpp_health.py

# Symlinks to make running easy
RUN if [ -f /opt/hello/build/hello_args ]; then ln -s /opt/hello/build/hello_args /usr/local/bin/hello_args; fi || true
RUN if [ -f /opt/hello/build/sum ]; then ln -s /opt/hello/build/sum /usr/local/bin/sum; fi || true
RUN if [ -f /opt/hello/build/hello_threads ]; then ln -s /opt/hello/build/hello_threads /usr/local/bin/hello_threads; fi || true
RUN if [ -f /opt/hello/build/bench_threads ]; then ln -s /opt/hello/build/bench_threads /usr/local/bin/bench_threads; fi || true
RUN if [ -f /opt/hello/build/hello_args ]; then ln -s /opt/hello/build/hello_args /opt/hello/hello_args; fi || true

CMD ["/bin/bash"]


### Spring Boot runtime image (built from the same builder stage)
FROM eclipse-temurin:21-jre AS spring-runtime
WORKDIR /app
# Copy the built Spring Boot jar from the builder stage
COPY --from=builder /src/spring_hello_world/build/libs/spring_hello_world-0.1.0.jar /app/app.jar

# Copy the application data (SQLite database) so the packaged application.properties
# which references ./data/stocks.db will find the DB at runtime.
COPY --from=builder /src/spring_hello_world/data /app/data

ENV JAVA_OPTS="-Xms128m -Xmx512m"
EXPOSE 8080
# Use the packaged application.properties (located on the classpath) so the
# bundled datasource settings (jdbc:sqlite:./data/stocks.db) are respected.
ENTRYPOINT ["sh","-c","exec java $JAVA_OPTS -jar /app/app.jar"]


### Django help site runtime
FROM python:3.12-slim AS django-runtime
ENV PYTHONUNBUFFERED=1
WORKDIR /app
# Install minimal build deps for some Python packages (kept small)
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy only requirements first for Docker layer caching
COPY ./django_help/requirements.txt /app/requirements.txt
# Install requirements and Gunicorn for production WSGI serving
RUN pip install --no-cache-dir -r /app/requirements.txt gunicorn

# Copy django help site sources
COPY ./django_help /app

EXPOSE 8001
# Use Gunicorn to serve the Django WSGI app in production
CMD ["sh","-c","python manage.py migrate --noinput && exec gunicorn --bind 0.0.0.0:8001 helpsite.wsgi:application --workers 3 --log-level info"]
