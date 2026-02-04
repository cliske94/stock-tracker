Docker Compose V2 workflow

Overview

This repository previously used the legacy `docker-compose` (Python CLI). The recommended workflow is to use the Docker Compose V2 plugin (the `docker compose` command) and Docker Buildx for reliable multi-stage builds.

Why

- `docker compose` (V2) integrates with BuildKit and avoids some legacy behavior that caused `ContainerConfig` errors when docker-compose attempted to recreate containers built by older builders.
- `docker buildx` provides reproducible builds and the `--load` option lets us produce local images that `docker compose` can run.

Usage

1. Ensure Docker Compose V2 is installed (Docker Desktop/Cli plugin):

```bash
docker compose version
```

2. Build images and start services (wrapper script):

```bash
./scripts/compose-v2.sh up
```

This will:
- Create a `docker buildx` builder if missing.
- Build the three targets from `Dockerfile` (`spring-runtime`, `cpp-runtime`, `django-runtime`) into local images.
- Run `docker compose up -d` to start the services.

3. Stop services:

```bash
./scripts/compose-v2.sh down
```

4. Rebuild and recreate:

```bash
./scripts/compose-v2.sh rebuild
```

Notes / Troubleshooting

- If you encounter `permission denied` for Docker socket, add your user to the `docker` group or use `sudo` for the script.
- If `docker buildx` is not available, the script attempts to create a builder. You can also run `docker buildx create --use` manually.
- The script loads images locally (`--load`) so `docker compose` can use them; for CI or remote registries use `docker buildx build --push` and reference registry images in `docker-compose.yml`.
