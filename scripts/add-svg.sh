#!/usr/bin/env bash
#
# add-svg.sh — Add an SVG, rebuild, commit, and deploy to GitHub Pages.
#
# Usage:
#   ./scripts/add-svg.sh path/to/file.svg [category-folder]
#
# Examples:
#   ./scripts/add-svg.sh ~/Downloads/icon.svg icons
#   ./scripts/add-svg.sh ~/Downloads/art.svg
#

set -euo pipefail

# --- Config ---
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SVG_DIR="$REPO_ROOT/src/svgs"
DOCS_DIR="$REPO_ROOT/docs"

cd "$REPO_ROOT"

# --- Args ---
if [ $# -lt 1 ]; then
  echo "Usage: $0 path/to/file.svg [category-folder]"
  echo "Example: $0 ~/Downloads/icon.svg icons"
  exit 1
fi

SRC_FILE="$1"
CATEGORY="${2:-general}"

if [ ! -f "$SRC_FILE" ]; then
  echo "❌ File not found: $SRC_FILE"
  exit 1
fi

if [[ ! "$SRC_FILE" =~ \.svg$ ]]; then
  echo "❌ File must be an .svg: $SRC_FILE"
  exit 1
fi

FILENAME="$(basename "$SRC_FILE")"
DEST_DIR="$SVG_DIR/$CATEGORY"
DEST_PATH="$DEST_DIR/$FILENAME"

# --- 1. Copy SVG into src/svgs/<category>/ ---
mkdir -p "$DEST_DIR"
cp "$SRC_FILE" "$DEST_PATH"
echo "✓ Copied $FILENAME → src/svgs/$CATEGORY/"

# --- 2. Build static site to docs/ ---
"$REPO_ROOT/build.sh"
echo "✓ Built site to docs/"

# --- 3. Commit and push ---
git add src/svgs/ docs/
git commit -m "Add SVG: $FILENAME (category: $CATEGORY)"
git push origin main

echo "✓ Deployed to https://jaigansa.github.io/vector/"
