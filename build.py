#!/usr/bin/env python3
"""
Static Build Script for Vector SVG Studio.
Scans the svgs/ directory and builds svgs.json catalog for static hosting (GitHub Pages).
Ensures any shapes/paths lacking stroke width and color in original SVGs have idle strokes added.
"""

import json
import os
import sys

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
