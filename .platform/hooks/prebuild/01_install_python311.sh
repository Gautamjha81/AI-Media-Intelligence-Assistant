#!/bin/bash
set -e

dnf install -y python3.11 || yum install -y python3.11 || true

echo "python3 location:"
command -v python3 || true
python3 --version || true

curl -fsSL https://deno.land/install.sh | DENO_INSTALL=/usr/local sh

echo "Deno location:"
command -v deno || true
/usr/local/bin/deno --version

echo "===== INSTALLATION SUCCESS ====="
