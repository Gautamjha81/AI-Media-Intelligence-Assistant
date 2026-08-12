#!/bin/bash
set -e

# yt-dlp requires Python 3.10+.
# Keep Amazon Linux's system Python untouched.

echo "Installing Python 3.11..."

if command -v dnf >/dev/null 2>&1; then
    sudo dnf install -y python3.11
elif command -v yum >/dev/null 2>&1; then
    sudo yum install -y python3.11
else
    echo "Neither dnf nor yum found - cannot install python3.11" >&2
    exit 1
fi

# Make Python 3.11 available as python3
sudo ln -sf "$(command -v python3.11)" /usr/local/bin/python3

echo "Python version:"
python3 --version

echo "Installing Deno..."

curl -fsSL https://deno.land/install.sh | sh

# Make Deno available system-wide
sudo ln -sf /root/.deno/bin/deno /usr/local/bin/deno

echo "Deno version:"
deno --version

echo "Installing yt-dlp-ejs..."

python3.11 -m pip install -U yt-dlp-ejs

echo "Installation complete."