#!/usr/bin/env sh
# ─────────────────────────────────────────────────────────────
# sender/QR-Transfer.html is the SOURCE of truth for the offline sender.
# receiver/QR-Transfer.html is a deploy copy the hosted receiver page
# offers as a "Download offline sender" button, so it must stay identical.
#
# Run this after editing the sender, BEFORE deploying the receiver folder:
#   sh sync-sender.sh
# ─────────────────────────────────────────────────────────────
set -e
cd "$(dirname "$0")"
cp sender/QR-Transfer.html receiver/QR-Transfer.html
if diff -q sender/QR-Transfer.html receiver/QR-Transfer.html >/dev/null; then
  echo "Synced: sender/QR-Transfer.html -> receiver/QR-Transfer.html (identical)"
else
  echo "ERROR: copies still differ after sync" >&2
  exit 1
fi
