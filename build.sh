#!/usr/bin/env bash
#
# build.sh — Build Vector static site to docs/ (Zero npm dependencies)
#
# Usage:
#   ./build.sh          # One-time production build
#   ./build.sh --serve  # Build and serve on http://localhost:8080
#   ./build.sh --watch  # Build and auto-rebuild on file changes
#

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SRC="$REPO_ROOT/src"
DOCS="$REPO_ROOT/docs"

build() {
  # 1. Ensure directories exist
  mkdir -p "$DOCS/css" "$DOCS/js/lib" "$DOCS/js/vendor"

  # 2. Copy CSS and JS assets
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

# --- Action handling ---
ACTION="${1:-build}"

case "$ACTION" in
  build|"")
    build
    ;;
  --serve|-s)
    build
    PORT="${PORT:-8080}"
    echo "Serving at http://localhost:$PORT (Press Ctrl+C to stop)..."
    if command -v python3 &>/dev/null; then
      python3 -m http.server "$PORT" -d "$DOCS"
    else
      node -e "
        const http = require('http');
        const fs = require('fs');
        const path = require('path');
        const mime = { '.html':'text/html', '.css':'text/css', '.js':'application/javascript', '.svg':'image/svg+xml', '.png':'image/png', '.json':'application/json' };
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
        }).listen($PORT, () => console.log('Listening on port $PORT'));
      "
    fi
    ;;
  --watch|-w)
    build
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
            execSync('$REPO_ROOT/build.sh', { stdio: 'inherit' });
          } catch (e) {
            console.error('Build error:', e.message);
          }
        }, 100);
      });
    "
    ;;
  *)
    echo "Unknown option: $ACTION"
    echo "Usage: $0 [build | --serve | --watch]"
    exit 1
    ;;
esac
