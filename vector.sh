#!/usr/bin/env bash
#
# vector.sh — Unified CLI for Vector SVG Studio (Zero npm dependencies)
#
# Usage:
#   ./vector.sh                     # Production build to docs/
#   ./vector.sh build               # Same as above
#   ./vector.sh serve [port]        # Build and start local server (default: 8080)
#   ./vector.sh watch               # Build and auto-rebuild on file changes
#   ./vector.sh add <file> [cat]    # Add SVG, rebuild, commit, and push
#   ./vector.sh help                # Display help
#

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SRC="$REPO_ROOT/src"
DOCS="$REPO_ROOT/docs"
SVG_DIR="$SRC/svgs"

cd "$REPO_ROOT"

# --- Build Task ---
do_build() {
  echo "Building Vector static site..."

  # 1. Ensure target directories exist
  mkdir -p "$DOCS/css" "$DOCS/js/lib" "$DOCS/js/vendor"

  # 2. Copy CSS, vendor JS, and core JS
  cp -r "$SRC/css/"* "$DOCS/css/"
  cp "$SRC/js/vendor/"* "$DOCS/js/vendor/"
  cp "$SRC/js/"*.js "$DOCS/js/"

  # 3. Generate SVG category chunks into docs/js/lib/ and src/js/lib/
  node "$REPO_ROOT/scripts/generate-chunks.js"

  # 4. Generate docs/index.html with category chunk script tags
  node -e '
    const fs = require("fs");
    const { getCategories } = require("./scripts/generate-chunks.js");

    const categories = getCategories();
    const scriptTags = categories
      .map(c => `    <script src="js/lib/${c.slug}.js"></script>`)
      .join("\n");

    let html = fs.readFileSync("src/index.html", "utf8");
    html = html.replace("<!-- CHUNK_SCRIPTS -->", scriptTags);
    fs.writeFileSync("docs/index.html", html);
  '

  echo "✓ Built site to docs/"
}

# --- Serve Task ---
do_serve() {
  do_build
  local port="${1:-${PORT:-8080}}"
  echo "Serving at http://localhost:$port (Press Ctrl+C to stop)..."

  if command -v python3 &>/dev/null; then
    python3 -m http.server "$port" -d "$DOCS"
  else
    node -e "
      const http = require('http');
      const fs = require('fs');
      const path = require('path');
      const mime = {
        '.html': 'text/html',
        '.css': 'text/css',
        '.js': 'application/javascript',
        '.svg': 'image/svg+xml',
        '.png': 'image/png',
        '.json': 'application/json'
      };
      http.createServer((req, res) => {
        let reqPath = req.url.split('?')[0];
        if (reqPath === '/') reqPath = '/index.html';
        const filePath = path.join('$DOCS', reqPath);
        if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
          res.writeHead(200, { 'Content-Type': mime[path.extname(filePath)] || 'text/plain' });
          fs.createReadStream(filePath).pipe(res);
        } else {
          res.writeHead(404);
          res.end('404 Not Found');
        }
      }).listen($port, () => console.log('Listening on port $port'));
    "
  fi
}

# --- Watch Task ---
do_watch() {
  do_build
  echo "Watching src/ for changes (Press Ctrl+C to stop)..."

  node -e "
    const fs = require('fs');
    const { execSync } = require('child_process');
    let timeout = null;
    fs.watch('$SRC', { recursive: true }, (event, filename) => {
      if (!filename) return;
      clearTimeout(timeout);
      timeout = setTimeout(() => {
        console.log('Change detected in ' + filename + ', rebuilding...');
        try {
          execSync('$REPO_ROOT/vector.sh build', { stdio: 'inherit' });
        } catch (e) {
          console.error('Build error:', e.message);
        }
      }, 100);
    });
  "
}

# --- Add SVG Task ---
do_add() {
  if [ $# -lt 1 ]; then
    echo "Usage: ./vector.sh add <path/to/file.svg> [category-folder]"
    echo "Example: ./vector.sh add ~/Downloads/icon.svg icons"
    exit 1
  fi

  local src_file="$1"
  local category="${2:-general}"

  if [ ! -f "$src_file" ]; then
    echo "❌ File not found: $src_file"
    exit 1
  fi

  if [[ ! "$src_file" =~ \.svg$ ]]; then
    echo "❌ File must be an .svg: $src_file"
    exit 1
  fi

  local filename
  filename="$(basename "$src_file")"
  local dest_dir="$SVG_DIR/$category"
  local dest_path="$dest_dir/$filename"

  # 1. Copy SVG into src/svgs/<category>/
  mkdir -p "$dest_dir"
  cp "$src_file" "$dest_path"
  echo "✓ Copied $filename → src/svgs/$category/"

  # 2. Rebuild site
  do_build

  # 3. Commit and push
  git add src/svgs/ docs/
  git commit -m "Add SVG: $filename (category: $category)"
  git push origin main

  echo "✓ Deployed to https://jaigansa.github.io/vector/"
}

# --- Help ---
do_help() {
  echo "Vector — SVG Studio & Plotter CLI"
  echo ""
  echo "Usage: ./vector.sh [command] [args]"
  echo ""
  echo "Commands:"
  echo "  build                 Build static site to docs/ (default)"
  echo "  serve [port]          Build site and start local server (default: 8080)"
  echo "  watch                 Build site and watch src/ for changes"
  echo "  add <file> [cat]      Add SVG, rebuild, commit & deploy to GitHub Pages"
  echo "  help, --help, -h      Show this help message"
  echo ""
  echo "Examples:"
  echo "  ./vector.sh"
  echo "  ./vector.sh serve 3000"
  echo "  ./vector.sh add heart.svg icons"
}

# --- Command Router ---
COMMAND="${1:-build}"
shift || true

case "$COMMAND" in
  build|"")
    do_build
    ;;
  serve|--serve|-s)
    do_serve "${1:-8080}"
    ;;
  watch|--watch|-w)
    do_watch
    ;;
  add|--add|-a)
    do_add "$@"
    ;;
  help|--help|-h)
    do_help
    ;;
  *)
    echo "Unknown command: $COMMAND"
    echo ""
    do_help
    exit 1
    ;;
esac
