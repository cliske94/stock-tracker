# Secrets scan report

Summary of sensitive items found in the repository and recommended remediation steps.

## Items discovered

- `.env` (repo root) contains:
  - `OAUTH_CLIENT_SECRET=b4361a64710d6c80d8e626b6880963079e7e278a`
  - `VNC_PASSWORD=87ranger`
  This file should not be committed. It currently exists in the repo tree.

- `token.txt` referenced and used by the GUIs. Host dev file present at `/home/cody/Projects/token.txt` (contains a long token `f1eac2ef-dd03-4270-a42a-0e0f9fca2bfd`). The `Dockerfile` for `cpp_stock_ui` copies `token.txt` into the image (`cpp_stock_ui/Dockerfile` line with `COPY token.txt /opt/token.txt`).

- k8s manifests in `k8s/` embed VNC passwords and BACKEND_TOKEN values in plain text in the example `*-deployment.yaml` files (examples: `VNC_PASSWORD: "87ranger"`).

- Project contains virtual environment directories and packages under `.venv/` which should be ignored (these are large and environment-specific).

## Actions taken

- Updated repository `.gitignore` to include common sensitive and generated items:
  - `token.txt`, `*.token`
  - `.env.local`, `.env.*`
  - `.venv/`, `venv/`, `__pycache__/`, `.pytest_cache/`
  - `*.pem`, `*.key`, `*.crt`, `*.p12`
  - `/data/*.db`, `*.sqlite3`, `*.db*`
  - `*.log`, `.DS_Store`

  See: `/.gitignore` (root) for the exact entries.

## Recommended remediation (manual steps you should perform)

1. Remove sensitive files from the repository history and rotate secrets.
   - If `.env`, `token.txt`, or k8s manifests with secrets were already committed, adding to `.gitignore` will not remove them from history. Use one of these tools to remove them:
     - `git filter-repo` (recommended) or `bfg-repo-cleaner`.
   - After rewriting history, rotate any impacted secrets (OAuth client secret, backend token, VNC passwords) immediately.

2. Replace inline secrets in k8s manifests with `Secret` objects (and do not check the populated secret YAML into git). Example:

```bash
kubectl create secret generic python-watchlist-secret --from-literal=VNC_PASSWORD=REPLACE_ME
kubectl create secret generic watchlist-token --from-file=token.txt=/path/to/token.txt
```

3. Stop copying token files into Docker images. Update `cpp_stock_ui/Dockerfile` or local Docker build process to avoid `COPY token.txt` with secrets; instead mount the token at runtime or inject via k8s Secret.

4. Ensure `.env` is removed from the repo and add `.env.example` with placeholder values (safe to commit) so new developers know which variables are needed.

5. Verify no credentials are stored elsewhere (CI config, containers, other branches). Search for `PASSWORD`, `SECRET`, `TOKEN` terms and review results.

## Next steps I can take (pick one)
- Run `git ls-files --stage | egrep -i '\.env|token.txt'` to list any tracked sensitive files and then run `git rm --cached` on the ones you confirm to untrack them.
- Create a small script `scripts/remove_sensitive.sh` that removes tracked sensitive files and prints instructions to run `git filter-repo`.
- Help rotate or re-create any tokens/secrets you want handled here.

If you want, I can untrack the obvious tracked files now (I will only untrack after you confirm), and produce the exact `git filter-repo` commands to purge history for the selected paths.
