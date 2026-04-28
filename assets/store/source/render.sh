#!/bin/bash
# Render Play Store screenshots using headless Chrome.
# Phone: 1080x2400. Feature graphic: 1024x500.
set -euo pipefail

SRC="$(cd "$(dirname "$0")" && pwd)"
OUT="$SRC/../screenshots"
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"

mkdir -p "$OUT"

render() {
  local html="$1" png="$2" w="$3" h="$4"
  echo "→ $png ($w x $h)"
  "$CHROME" \
    --headless=new \
    --disable-gpu \
    --hide-scrollbars \
    --no-pdf-header-footer \
    --window-size="${w},${h}" \
    --screenshot="$OUT/$png" \
    --default-background-color=00000000 \
    --virtual-time-budget=4000 \
    "file://$SRC/$html" >/dev/null 2>&1
}

render 00-feature-graphic.html feature-graphic-1024x500.png 1024 500
render 01-onboarding.html        01-onboarding.png        1080 2400
render 02-home.html              02-home.png              1080 2400
render 03-services.html          03-services.png          1080 2400
render 04-schedule.html          04-schedule.png          1080 2400
render 05-orders.html            05-orders.png            1080 2400
render 06-profile.html           06-profile.png           1080 2400

echo
echo "Output:"
ls -la "$OUT"
