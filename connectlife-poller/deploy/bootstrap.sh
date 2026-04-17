#!/usr/bin/env bash
# LaundryHub poller — one-time setup for Oracle Cloud Always Free VM.
#
# Run this ONCE after creating a fresh Ubuntu 22.04 VM on Oracle Cloud.
# All commands are idempotent; re-running is safe.
#
# Usage:
#   ssh ubuntu@<your-vm-ip>
#   curl -O https://raw.githubusercontent.com/odongoperez/laundryhub/main/connectlife-poller/deploy/bootstrap.sh
#   chmod +x bootstrap.sh
#   sudo ./bootstrap.sh

set -euo pipefail

echo "==> LaundryHub poller bootstrap"

# ---- 1. System updates + Node.js 20 ----
echo "==> Installing Node.js 20"
if ! command -v node >/dev/null || [[ "$(node -v)" != v20* && "$(node -v)" != v21* && "$(node -v)" != v22* ]]; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y nodejs git
fi
node -v
npm -v

# ---- 2. Create dedicated user ----
echo "==> Creating service user 'laundryhub'"
if ! id -u laundryhub >/dev/null 2>&1; then
  useradd -r -m -s /bin/bash laundryhub
fi

# ---- 3. Clone repo ----
echo "==> Cloning repo"
REPO_DIR="/opt/laundryhub"
if [[ ! -d "$REPO_DIR" ]]; then
  git clone https://github.com/odongoperez/laundryhub.git "$REPO_DIR"
fi
chown -R laundryhub:laundryhub "$REPO_DIR"

# ---- 4. Install npm deps ----
echo "==> Installing npm dependencies"
sudo -u laundryhub bash -c "cd $REPO_DIR/connectlife-poller && npm install --omit=dev"

# ---- 5. Create env file (secrets go here) ----
echo "==> Setting up /etc/laundryhub/env"
mkdir -p /etc/laundryhub
if [[ ! -f /etc/laundryhub/env ]]; then
  cat > /etc/laundryhub/env <<'EOF'
# Fill in these values, then: sudo systemctl restart laundryhub-poller
CONNECTLIFE_USERNAME=odongoperezangel@gmail.com
CONNECTLIFE_PASSWORD=CHANGEME
FIREBASE_DATABASE_URL=https://laundryhub-4e35b-default-rtdb.europe-west1.firebasedatabase.app
# Paste the full JSON of your Firebase service account key here on ONE LINE.
# Get it from: Firebase Console > Project Settings > Service accounts > Generate new private key
FIREBASE_SERVICE_ACCOUNT_JSON={}
WASHER_PUID=1wfj0800029vw53t3pf0186
POLL_INTERVAL_MS=10000
EOF
  chmod 600 /etc/laundryhub/env
  chown root:laundryhub /etc/laundryhub/env
  chmod 640 /etc/laundryhub/env
  echo ""
  echo "!! IMPORTANT !!"
  echo "Edit /etc/laundryhub/env and fill in:"
  echo "  - CONNECTLIFE_PASSWORD"
  echo "  - FIREBASE_SERVICE_ACCOUNT_JSON (the full JSON, on one line)"
  echo ""
  echo "Then: sudo systemctl restart laundryhub-poller"
else
  echo "  /etc/laundryhub/env already exists, leaving as-is"
fi

# ---- 6. Install systemd unit ----
echo "==> Installing systemd unit"
cp "$REPO_DIR/connectlife-poller/deploy/laundryhub-poller.service" /etc/systemd/system/
systemctl daemon-reload
systemctl enable laundryhub-poller
systemctl restart laundryhub-poller

# ---- 7. Install update helper ----
echo "==> Installing update helper at /usr/local/bin/laundryhub-update"
cp "$REPO_DIR/connectlife-poller/deploy/update.sh" /usr/local/bin/laundryhub-update
chmod +x /usr/local/bin/laundryhub-update

echo ""
echo "==> Done. Useful commands:"
echo "  sudo systemctl status laundryhub-poller     # check status"
echo "  sudo journalctl -u laundryhub-poller -f     # tail logs"
echo "  sudo nano /etc/laundryhub/env               # edit secrets"
echo "  sudo laundryhub-update                      # git pull + restart"
