#!/usr/bin/env sh
set -e
cd "$(dirname "$0")/.."
if [ "$CAPACITOR_BUNDLED_UI" = "true" ]; then
  pnpm exec vite build --mode capacitor
fi
pnpm exec cap sync android
