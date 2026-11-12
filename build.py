#!/usr/bin/env python3
"""
Static Build Script for Vector SVG Studio.
Scans the svgs/ directory and builds svgs.json catalog for static hosting (GitHub Pages).
Ensures any shapes/paths lacking stroke width and color in original SVGs have idle strokes added.
"""

import json
import os
import re
import sys
import xml.etree.ElementTree as ET

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
SVG_DIR = os.path.join(BASE_DIR, "svgs")

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


def darken_hex(hex_str, factor=0.75):
    h = hex_str.lstrip("#")
    if len(h) == 3:
        h = "".join([c * 2 for c in h])
    try:
        r, g, b = int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16)
        r, g, b = max(0, int(r * factor)), max(0, int(g * factor)), max(0, int(b * factor))
        return f"#{r:02x}{g:02x}{b:02x}"
    except Exception:
        return "#1e293b"


def ensure_idle_strokes(xml_str):
    """
    Checks if shapes/paths have stroke and stroke-width.
    If missing, adds a crisp, matching stroke width and color for the idle state.
    """
    try:
        ET.register_namespace("", "http://www.w3.org/2000/svg")
        root = ET.fromstring(xml_str)
        vb = root.attrib.get("viewBox", "")
        vb_w = 800
        if vb:
            parts = re.split(r"[\s,]+", vb.strip())
            if len(parts) == 4 and float(parts[2]) > 0:
                vb_w = float(parts[2])

        default_w = "1.5" if vb_w <= 100 else ("2" if vb_w <= 500 else "2.5")

        dominant_stroke = None
        dominant_width = None

        tags = {"path", "polygon", "polyline", "circle", "rect", "ellipse", "line"}
        shapes = []

        for elem in root.iter():
            tag = elem.tag.split("}")[-1] if "}" in elem.tag else elem.tag
            if tag.lower() in tags:
                shapes.append(elem)
                style_dict = {}
                if "style" in elem.attrib:
                    for item in elem.attrib["style"].split(";"):
                        if ":" in item:
                            k, v = item.split(":", 1)
                            style_dict[k.strip().lower()] = v.strip()
                s = elem.attrib.get("stroke") or style_dict.get("stroke")
                sw = elem.attrib.get("stroke-width") or style_dict.get("stroke-width")
                if s and s not in ("none", "transparent") and not dominant_stroke:
                    dominant_stroke = s
                if sw and sw not in ("0", "0px") and not dominant_width:
                    dominant_width = sw

        fallback_stroke = dominant_stroke or "#1e293b"
        fallback_width = dominant_width or default_w

        modified = False
        for elem in shapes:
            style_dict = {}
            if "style" in elem.attrib:
                for item in elem.attrib["style"].split(";"):
                    if ":" in item:
                        k, v = item.split(":", 1)
                        style_dict[k.strip().lower()] = v.strip()

            s = elem.attrib.get("stroke") or style_dict.get("stroke")
            sw = elem.attrib.get("stroke-width") or style_dict.get("stroke-width")
            fill = elem.attrib.get("fill") or style_dict.get("fill", "")

            has_s = s and s not in ("none", "transparent")
            has_sw = sw and sw not in ("0", "0px")

            if not has_s:
                modified = True
                if fill and fill.startswith("#") and len(fill) in (4, 7):
                    new_stroke = dominant_stroke or darken_hex(fill, 0.75)
                else:
                    new_stroke = fallback_stroke
                elem.attrib["stroke"] = new_stroke
                if "stroke" in style_dict:
                    style_dict["stroke"] = new_stroke
                    elem.attrib["style"] = ";".join(f"{k}:{v}" for k, v in style_dict.items())

            if not has_sw:
                modified = True
                elem.attrib["stroke-width"] = fallback_width
                if "stroke-width" in style_dict:
                    style_dict["stroke-width"] = fallback_width
                    elem.attrib["style"] = ";".join(f"{k}:{v}" for k, v in style_dict.items())

            if "stroke-linecap" not in elem.attrib and "stroke-linecap" not in style_dict:
                elem.attrib["stroke-linecap"] = "round"
                modified = True
            if "stroke-linejoin" not in elem.attrib and "stroke-linejoin" not in style_dict:
                elem.attrib["stroke-linejoin"] = "round"
                modified = True

        if modified:
            return ET.tostring(root, encoding="utf-8").decode("utf-8")
        return xml_str
    except Exception:
        return xml_str


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
                            raw_content = f.read()

                        # Ensure paths have stroke width and color for idle state
                        content = ensure_idle_strokes(raw_content)

                        # Write back if modified so the source SVG file also has the strokes
                        if content != raw_content:
                            try:
                                with open(fpath, "w", encoding="utf-8") as fw:
                                    fw.write(content)
                                stat = os.stat(fpath)
                            except Exception:
                                pass

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

    categories = []
    for entry in sorted(os.scandir(SVG_DIR), key=lambda e: e.name):
        if entry.is_dir() and not entry.name.startswith("."):
            categories.append({
                "slug": entry.name,
                "name": slug_to_category(entry.name)
            })

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


if __name__ == "__main__":
    build(save_json=True)
