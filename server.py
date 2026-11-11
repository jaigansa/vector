#!/usr/bin/env python3
"""
Simple, lightweight local dev server for Vector SVG Artwork Gallery.
Serves static assets and provides an API to list & upload SVGs directly to the svgs/ directory.
"""

import http.server
import json
import os
import re
import socketserver
import sys
from urllib.parse import urlparse

DEFAULT_PORT = int(os.environ.get("PORT", 8080))
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
SVG_DIR = os.path.join(BASE_DIR, "svgs")

os.makedirs(SVG_DIR, exist_ok=True)

CATEGORY_MAP = {
    "tech-software": "Tech & Software",
    "business-marketing": "Business & Marketing",
    "engineering-cad": "Engineering & CAD",
    "nature-scenery": "Nature & Scenery",
    "abstract-3d": "Abstract & 3D",
    "art-creative": "Art & Creative",
}

def slug_to_category(slug):
    if slug in CATEGORY_MAP:
        return CATEGORY_MAP[slug]
    return slug.replace("-", " ").title().replace("Cad", "CAD").replace("Scifi", "Sci-Fi").replace("Tech", "Tech")


class ReusableTCPServer(socketserver.TCPServer):
    allow_reuse_address = True


class SVGViewerHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=BASE_DIR, **kwargs)

    def do_GET(self):
        parsed = urlparse(self.path)
        if parsed.path == "/api/svgs":
            self.send_svg_list()
            return

        # Check if direct request to /svgs/<filename>.svg should be resolved inside a category subfolder
        clean_path = parsed.path.lstrip("/")
        if clean_path.startswith("svgs/") and not os.path.exists(os.path.join(BASE_DIR, clean_path)):
            filename = os.path.basename(clean_path)
            for root, dirs, files in os.walk(SVG_DIR):
                if filename in files:
                    rel = os.path.relpath(os.path.join(root, filename), BASE_DIR).replace("\\", "/")
                    self.path = "/" + rel
                    break

        super().do_GET()

    def do_POST(self):
        parsed = urlparse(self.path)
        if parsed.path == "/api/upload":
            self.handle_upload()
        else:
            self.send_error(404, "Endpoint not found")

    def send_svg_list(self):
        svg_files = []
        try:
            for root, dirs, files in os.walk(SVG_DIR):
                rel_dir = os.path.relpath(root, SVG_DIR)
                cat_slug = rel_dir if rel_dir != "." else "nature-scenery"
                cat_name = slug_to_category(cat_slug)
                for fname in sorted(files):
                    if fname.lower().endswith(".svg"):
                        fpath = os.path.join(root, fname)
                        if os.path.isfile(fpath):
                            stat = os.stat(fpath)
                            try:
                                with open(fpath, "r", encoding="utf-8", errors="ignore") as f:
                                    content = f.read()
                                rel_path = os.path.relpath(fpath, BASE_DIR).replace("\\", "/")
                                svg_files.append({
                                    "name": fname,
                                    "path": rel_path,
                                    "category": cat_name,
                                    "categorySlug": cat_slug,
                                    "id": os.path.splitext(fname)[0],
                                    "size": stat.st_size,
                                    "mtime": int(stat.st_mtime * 1000),
                                    "content": content
                                })
                            except Exception as e:
                                print(f"Error reading {fname}: {e}", file=sys.stderr)
            
            svg_files.sort(key=lambda x: x["name"])

            # Discover categories from physical directories in SVG_DIR
            categories = []
            for entry in sorted(os.scandir(SVG_DIR), key=lambda e: e.name):
                if entry.is_dir() and not entry.name.startswith("."):
                    categories.append({
                        "slug": entry.name,
                        "name": slug_to_category(entry.name)
                    })

            payload = json.dumps({
                "status": "ok",
                "count": len(svg_files),
                "categories": categories,
                "svgs": svg_files
            }).encode("utf-8")
            self.send_response(200)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Content-Length", str(len(payload)))
            self.send_header("Access-Control-Allow-Origin", "*")
            self.send_header("Cache-Control", "no-cache")
            self.end_headers()
            self.wfile.write(payload)
        except Exception as e:
            err = json.dumps({"status": "error", "message": str(e)}).encode("utf-8")
            self.send_response(500)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(err)))
            self.end_headers()
            self.wfile.write(err)

    def handle_upload(self):
        try:
            content_length = int(self.headers.get("Content-Length", 0))
            body = self.rfile.read(content_length).decode("utf-8", errors="ignore")
            data = json.loads(body)
            filename = data.get("name", "artwork.svg")
            content = data.get("content", "")
            cat_input = data.get("category", "") or data.get("categorySlug", "")

            # Sanitize filename
            filename = re.sub(r"[^a-zA-Z0-9_\-\.]", "_", filename)
            if not filename.lower().endswith(".svg"):
                filename += ".svg"

            # Determine category folder
            cat_slug = "tech-software"
            for slug, label in CATEGORY_MAP.items():
                if cat_input and cat_input.lower() in (slug.lower(), label.lower()):
                    cat_slug = slug
                    break

            dest_dir = os.path.join(SVG_DIR, cat_slug)
            os.makedirs(dest_dir, exist_ok=True)
            dest_path = os.path.join(dest_dir, filename)

            with open(dest_path, "w", encoding="utf-8") as f:
                f.write(content)

            stat = os.stat(dest_path)
            res = json.dumps({
                "status": "ok",
                "saved": {
                    "name": filename,
                    "path": os.path.relpath(dest_path, BASE_DIR).replace("\\", "/"),
                    "category": slug_to_category(cat_slug),
                    "id": os.path.splitext(filename)[0],
                    "size": stat.st_size,
                    "mtime": int(stat.st_mtime * 1000),
                    "content": content
                }
            }).encode("utf-8")
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(res)))
            self.end_headers()
            self.wfile.write(res)
        except Exception as e:
            err = json.dumps({"status": "error", "message": str(e)}).encode("utf-8")
            self.send_response(400)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(err)))
            self.end_headers()
            self.wfile.write(err)


def run():
    port = DEFAULT_PORT
    for attempt in range(5):
        try:
            httpd = ReusableTCPServer(("", port), SVGViewerHandler)
            print(f"🎨 SVG Artwork Gallery Server running at http://localhost:{port}", flush=True)
            print(f"📁 Serving Artworks from: {SVG_DIR}", flush=True)
            print("Press Ctrl+C to stop.", flush=True)
            try:
                httpd.serve_forever()
            except KeyboardInterrupt:
                print("\nShutting down server.")
            finally:
                httpd.server_close()
            return
        except OSError as e:
            if "Address already in use" in str(e):
                port += 1
            else:
                raise e


if __name__ == "__main__":
    run()
