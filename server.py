#!/usr/bin/env python3
"""
Vector SVG Studio — Dev Server & Static Catalog Builder.
Serves static assets, handles SVG upload/listing APIs, and compiles svgs.json.

Usage:
  python3 server.py          # Start local dev server (default port 8080)
  python3 server.py --build  # Build svgs.json catalog and exit
"""

import http.server
import json
import os
import re
import socketserver
import sys
import xml.etree.ElementTree as ET
from urllib.parse import urlparse

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
SVG_DIR = os.path.join(BASE_DIR, "svgs")
DEFAULT_PORT = int(os.environ.get("PORT", 8080))

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


def is_svg_sprite(content, root=None):
    """Detect if an SVG string or ElementTree root is a sprite container."""
    if "<symbol" not in content.lower():
        return False
    if root is None:
        try:
            root = ET.fromstring(content)
        except Exception:
            return "<symbol" in content.lower()

    symbols = [e for e in root.iter() if e.tag.endswith("symbol")]
    if not symbols:
        return False

    w = root.attrib.get("width", "").strip()
    h = root.attrib.get("height", "").strip()
    style = root.attrib.get("style", "").lower()
    if w in ("0", "0px") or h in ("0", "0px") or "position:absolute" in style or "display:none" in style:
        return True

    renderable_tags = {"path", "circle", "rect", "polygon", "polyline", "line", "ellipse", "text", "image", "use"}
    has_direct_shapes = False
    for child in root:
        tag_name = child.tag.split("}")[-1].lower()
        if tag_name in renderable_tags or (tag_name == "g" and any(e.tag.split("}")[-1].lower() in renderable_tags for e in child.iter())):
            has_direct_shapes = True
            break

    return not has_direct_shapes or len(symbols) >= 2


def extract_sprite_symbols_regex(content, fname, rel_path, cat_name, cat_slug, stat):
    """Fallback regex extractor for symbols when XML parser encounters syntax anomalies."""
    items = []
    base_file_id = os.path.splitext(fname)[0]
    pattern = re.compile(r'<symbol\s+([^>]*id=["\']([^"\']+)["\'][^>]*)>(.*?)</symbol>', re.DOTALL | re.IGNORECASE)
    matches = pattern.findall(content)

    for idx, (raw_attrs, sym_id, inner) in enumerate(matches):
        item_id = f"{base_file_id}-{sym_id}" if not sym_id.startswith(base_file_id) else sym_id
        vb_match = re.search(r'viewBox=["\']([^"\']+)["\']', raw_attrs, re.IGNORECASE)
        vb = vb_match.group(1) if vb_match else "0 0 24 24"
        title_match = re.search(r'<title[^>]*>(.*?)</title>', inner, re.DOTALL | re.IGNORECASE)
        disp_name = title_match.group(1).strip() if title_match else sym_id.replace("-", " ").replace("_", " ").title()

        clean_attrs = re.sub(r'\b(id|viewBox)\s*=\s*["\'][^"\']*["\']', '', raw_attrs, flags=re.IGNORECASE).strip()
        attrs_str = f" {clean_attrs}" if clean_attrs else ""
        svg_str = f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{vb}"{attrs_str}>\n  {inner.strip()}\n</svg>'

        items.append({
            "name": f"{sym_id}.svg",
            "path": f"{rel_path}#{sym_id}",
            "category": cat_name,
            "categorySlug": cat_slug,
            "id": item_id,
            "displayName": disp_name,
            "symbolId": sym_id,
            "isSprite": True,
            "spriteFile": fname,
            "size": len(svg_str.encode("utf-8")),
            "mtime": int(stat.st_mtime * 1000),
            "content": svg_str,
            "rawSpriteContent": content
        })
    return items


def extract_sprite_symbols(content, fname, rel_path, cat_name, cat_slug, stat):
    """Extract individual <symbol> elements from an SVG sprite into standalone, renderable SVGs."""
    ET.register_namespace("", "http://www.w3.org/2000/svg")
    ET.register_namespace("xlink", "http://www.w3.org/1999/xlink")

    items = []
    base_file_id = os.path.splitext(fname)[0]

    try:
        root = ET.fromstring(content)
    except Exception:
        return extract_sprite_symbols_regex(content, fname, rel_path, cat_name, cat_slug, stat)

    symbols = [elem for elem in root.iter() if elem.tag.endswith("symbol")]
    if not symbols:
        return []

    shared_defs = [elem for elem in root if elem.tag.endswith("defs")]
    shared_style = [elem for elem in root if elem.tag.endswith("style")]
    root_vb = root.get("viewBox")

    for idx, s in enumerate(symbols):
        sym_id = s.get("id") or f"symbol-{idx+1}"
        item_id = f"{base_file_id}-{sym_id}" if not sym_id.startswith(base_file_id) else sym_id

        title = None
        for child in list(s):
            if child.tag.endswith("title") and child.text:
                title = child.text.strip()
                break

        disp_name = title or sym_id.replace("-", " ").replace("_", " ").title()

        new_svg = ET.Element("{http://www.w3.org/2000/svg}svg")
        for k, v in s.attrib.items():
            if k == "id":
                continue
            new_svg.set(k, v)

        if "viewBox" not in new_svg.attrib:
            if root_vb:
                new_svg.set("viewBox", root_vb)
            elif s.get("width") and s.get("height"):
                new_svg.set("viewBox", f"0 0 {s.get('width')} {s.get('height')}")
            else:
                new_svg.set("viewBox", "0 0 24 24")

        for st in shared_style:
            new_svg.append(st)

        for d in shared_defs:
            try:
                d_clone = ET.fromstring(ET.tostring(d))
                parent_map = {c: p for p in d_clone.iter() for c in p}
                for sym_in_d in [e for e in d_clone.iter() if e.tag.endswith("symbol")]:
                    p = parent_map.get(sym_in_d)
                    if p is not None:
                        p.remove(sym_in_d)
                if len(d_clone) > 0:
                    new_svg.append(d_clone)
            except Exception:
                pass

        for child in list(s):
            new_svg.append(child)

        svg_str = ET.tostring(new_svg, encoding="unicode")

        items.append({
            "name": f"{sym_id}.svg",
            "path": f"{rel_path}#{sym_id}",
            "category": cat_name,
            "categorySlug": cat_slug,
            "id": item_id,
            "displayName": disp_name,
            "symbolId": sym_id,
            "isSprite": True,
            "spriteFile": fname,
            "size": len(svg_str.encode("utf-8")),
            "mtime": int(stat.st_mtime * 1000),
            "content": svg_str,
            "rawSpriteContent": content
        })

    return items


def build(save_json=True):
    svg_files = []
    os.makedirs(SVG_DIR, exist_ok=True)

    for root, dirs, files in os.walk(SVG_DIR):
        rel_dir = os.path.relpath(root, SVG_DIR)
        cat_slug = rel_dir if rel_dir != "." else "general"
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
                        if is_svg_sprite(content):
                            extracted = extract_sprite_symbols(content, fname, rel_path, cat_name, cat_slug, stat)
                            if extracted:
                                svg_files.extend(extracted)
                            else:
                                title_match = re.search(r'<title[^>]*>(.*?)</title>', content, re.DOTALL | re.IGNORECASE)
                                disp_name = title_match.group(1).strip() if title_match else os.path.splitext(fname)[0].replace("-", " ").replace("_", " ").title()
                                svg_files.append({
                                    "name": fname,
                                    "path": rel_path,
                                    "category": cat_name,
                                    "categorySlug": cat_slug,
                                    "id": os.path.splitext(fname)[0],
                                    "displayName": disp_name,
                                    "size": stat.st_size,
                                    "mtime": int(stat.st_mtime * 1000),
                                    "content": content
                                })
                        else:
                            title_match = re.search(r'<title[^>]*>(.*?)</title>', content, re.DOTALL | re.IGNORECASE)
                            disp_name = title_match.group(1).strip() if title_match else os.path.splitext(fname)[0].replace("-", " ").replace("_", " ").title()
                            svg_files.append({
                                "name": fname,
                                "path": rel_path,
                                "category": cat_name,
                                "categorySlug": cat_slug,
                                "id": os.path.splitext(fname)[0],
                                "displayName": disp_name,
                                "size": stat.st_size,
                                "mtime": int(stat.st_mtime * 1000),
                                "content": content
                            })
                    except Exception as e:
                        print(f"Error reading {fname}: {e}", file=sys.stderr)

    svg_files.sort(key=lambda x: x["name"])

    categories_dict = {}
    for item in svg_files:
        c_slug = item.get("categorySlug") or "general"
        c_name = item.get("category") or slug_to_category(c_slug)
        if c_slug not in categories_dict:
            categories_dict[c_slug] = {"slug": c_slug, "name": c_name}

    for entry in sorted(os.scandir(SVG_DIR), key=lambda e: e.name):
        if entry.is_dir() and not entry.name.startswith("."):
            if entry.name not in categories_dict:
                categories_dict[entry.name] = {
                    "slug": entry.name,
                    "name": slug_to_category(entry.name)
                }

    categories = sorted(categories_dict.values(), key=lambda x: x["name"])

    catalog = {
        "status": "ok",
        "count": len(svg_files),
        "categories": categories,
        "svgs": svg_files
    }

    if save_json:
        out_file = os.path.join(BASE_DIR, "svgs.json")
        try:
            with open(out_file, "w", encoding="utf-8") as f:
                json.dump(catalog, f, indent=2)
            print(f"✓ Generated svgs.json: {len(svg_files)} artworks across {len(categories)} categories.")
        except Exception as e:
            print(f"Error saving svgs.json: {e}", file=sys.stderr)

    return catalog


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
        try:
            catalog = build(save_json=True)
            payload = json.dumps(catalog).encode("utf-8")
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

            build(save_json=True)
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
    build(save_json=True)
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
    if "--build" in sys.argv or "build" in sys.argv:
        build(save_json=True)
    else:
        run()
