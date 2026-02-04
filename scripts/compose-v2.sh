#!/usr/bin/env bash
set -euo pipefail

# Build images using Docker Buildx and start services with Docker Compose v2
# Usage: ./scripts/compose-v2.sh [up|down|rebuild]

CMD=${1:-up}
ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
DOCKERFILE="$ROOT_DIR/Dockerfile"

# Determine build method: prefer buildx, fall back to docker build
have_buildx=false
if docker buildx version >/dev/null 2>&1; then
  # quick probe whether buildx supports --platform by checking help output
  if docker buildx build --help 2>&1 | grep -q -- '--platform'; then
    have_buildx=true
  fi
fi

# Determine compose command: prefer `docker compose`, fallback to `docker-compose`
compose_cmd="docker compose"
if ! command -v docker >/dev/null 2>&1; then
  echo "docker CLI not found" >&2
  exit 1
fi
if ! docker compose version >/dev/null 2>&1; then
  if command -v docker-compose >/dev/null 2>&1; then
    compose_cmd="docker-compose"
  else
    echo "Neither 'docker compose' nor 'docker-compose' available" >&2
    exit 1
  fi
fi

case "$CMD" in
  up)
    echo "Building images (buildx available: $have_buildx)"
    if [ "$have_buildx" = true ]; then
      echo "Using docker buildx"
      docker buildx build --platform linux/amd64 --progress=plain --load -t spring-hello-world:latest --target spring-runtime -f "$DOCKERFILE" "$ROOT_DIR"
      docker buildx build --platform linux/amd64 --progress=plain --load -t hello-ubuntu-cpp:latest --target cpp-runtime -f "$DOCKERFILE" "$ROOT_DIR"
      docker buildx build --platform linux/amd64 --progress=plain --load -t hello-help-site:latest --target django-runtime -f "$DOCKERFILE" "$ROOT_DIR"
    else
      echo "buildx not available or lacks --platform; using fallback 'docker build'"
      docker build --target spring-runtime -t spring-hello-world:latest -f "$DOCKERFILE" "$ROOT_DIR"
      docker build --target cpp-runtime -t hello-ubuntu-cpp:latest -f "$DOCKERFILE" "$ROOT_DIR"
      docker build --target django-runtime -t hello-help-site:latest -f "$DOCKERFILE" "$ROOT_DIR"
    fi

    echo "Starting services with Compose: $compose_cmd"
    $compose_cmd up -d
    ;;
  down)
    docker compose down
    ;;
  rebuild)
    docker compose down || true
    docker buildx build --platform linux/amd64 --progress=plain --load -t spring-hello-world:latest --target spring-runtime -f "$DOCKERFILE" "$ROOT_DIR"
    docker buildx build --platform linux/amd64 --progress=plain --load -t hello-ubuntu-cpp:latest --target cpp-runtime -f "$DOCKERFILE" "$ROOT_DIR"
    docker buildx build --platform linux/amd64 --progress=plain --load -t hello-help-site:latest --target django-runtime -f "$DOCKERFILE" "$ROOT_DIR"
    docker compose up -d --force-recreate
    ;;
  *)
    echo "Unknown command: $CMD"
    echo "Usage: $0 [up|down|rebuild]"
    exit 2
    ;;
esac

# Recommend checking logs/health
echo "Run 'docker compose ps' and 'docker compose logs -f' to monitor services."