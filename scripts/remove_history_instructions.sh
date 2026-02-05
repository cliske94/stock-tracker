#!/usr/bin/env bash
# This script does NOT run history rewrite by default. It prints recommended commands
# to purge sensitive files from git history using git-filter-repo.

cat <<'EOF'
If you have git-filter-repo installed, run the following from repository root to remove sensitive files from history:

# install git-filter-repo (if not installed):
# pip install git-filter-repo

# purge .env and token.txt from history (replace paths as needed):
git filter-repo --invert-paths --paths .env --paths token.txt --force

# after rewriting history, force-push to remote (WARNING: rewrites history):
# git push --force --all
# git push --force --tags

# Rotate any secrets that were exposed in the repo (OAuth client secret, VNC passwords, tokens).
EOF
