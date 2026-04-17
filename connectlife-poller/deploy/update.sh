#!/usr/bin/env bash
# Pull latest code and restart the poller.
# Run with sudo: sudo laundryhub-update
set -euo pipefail

cd /opt/laundryhub
sudo -u laundryhub git pull --ff-only
sudo -u laundryhub bash -c "cd connectlife-poller && npm install --omit=dev"
systemctl restart laundryhub-poller
systemctl status laundryhub-poller --no-pager
