#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "Installing dependencies..."
npm ci
(cd pulse-agent && npm ci)

echo "Restarting services..."
sudo systemctl restart pulse-mcp pulse-agent
if systemctl is-enabled pulse-worker &>/dev/null; then
  sudo systemctl restart pulse-worker
fi

echo "Done. Check: sudo systemctl status pulse-agent pulse-mcp"
