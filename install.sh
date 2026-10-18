#!/usr/bin/env bash
#
# Lao Gan Ma — install all dependencies (backend + frontend), then exit.
# Equivalent to: ./run.sh --install
#
set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"
exec "$ROOT/run.sh" --install
