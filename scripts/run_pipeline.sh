#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_ROOT"

echo "=== [1/8] fetch_partis_full.py ==="
python3 scripts/fetch_partis_full.py

echo "=== [2/8] fetch_birth_location.py ==="
python3 scripts/fetch_birth_location.py

echo "=== [3/8] fetch_birthdates.py ==="
python3 scripts/fetch_birthdates.py

echo "=== [4/8] fetch_genre_condamnation.py ==="
python3 scripts/fetch_genre_condamnation.py

echo "=== [5/8] fetch_popularity.py ==="
python3 scripts/fetch_popularity.py

echo "=== [6/8] politics-deces.py ==="
python3 MikizBack/scripts/politics-deces.py

echo "=== [7/8] politics-senators.py ==="
python3 MikizBack/scripts/politics-senators.py

echo "=== [8/8] politics-mep.py ==="
python3 MikizBack/scripts/politics-mep.py

echo "=== Pipeline complete ==="
