#!/bin/bash
set -e

echo "===== PYTHON CHECK ====="

if command -v dnf >/dev/null 2>&1; then
    dnf install -y python3.11 python3.11-pip
elif command -v yum >/dev/null 2>&1; then
    yum install -y python3.11 python3.11-pip
else
    echo "ERROR: dnf/yum not found"
    exit 1
fi

echo "python3.11 location:"
command -v python3.11

echo "python3.11 version:"
python3.11 --version

echo "pip version:"
python3.11 -m pip --version

echo "===== YT-DLP INSTALL ====="

python3.11 -m pip install --upgrade pip
python3.11 -m pip install --upgrade "yt-dlp[default]"

echo "yt-dlp location:"
python3.11 -m pip show yt-dlp

echo "yt-dlp version:"
python3.11 -m yt_dlp --version

echo "===== DENO INSTALL ====="

curl -fsSL https://deno.land/install.sh | DENO_INSTALL=/usr/local sh

echo "Deno location:"
command -v deno || true

echo "Deno version:"
/usr/local/bin/deno --version

echo "===== INSTALLATION SUCCESS ====="