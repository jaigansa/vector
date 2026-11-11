#!/usr/bin/env python3
"""
Comprehensive Test Suite for Vector SVG Artwork Gallery:
1. SVG Vector XML Validation
2. HTTP Server API & Static Asset Delivery
3. DOM & Data-Binding Verification
4. E2E Headless Chromium Browser Rendering & Mobile/Tablet Viewport Tests
"""

import os
import sys
import json
import time
import subprocess
import urllib.request
import xml.etree.ElementTree as ET

TEST_PORT = 8092
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
SVG_DIR = os.path.join(BASE_DIR, "svgs")
SCREENSHOTS_DIR = os.path.join(BASE_DIR, "test_screenshots")
os.makedirs(SCREENSHOTS_DIR, exist_ok=True)

results = []

def record(name, passed, detail=""):
    results.append({"name": name, "passed": passed, "detail": detail})
    status = "✓ PASS" if passed else "✗ FAIL"
    print(f"[{status}] {name} - {detail}")


def test_svg_xml_validity():
    print("\n--- TEST SUITE 1: SVG Vector XML Integrity ---")
    files = []
    for root, dirs, fnames in sorted(os.walk(SVG_DIR)):
        for f in sorted(fnames):
            if f.endswith(".svg"):
                files.append(os.path.join(root, f))

    if not files:
        record("SVG Files Found", False, "No SVG files in svgs/")
        return

    record("SVG Files Found", True, f"Found {len(files)} vector artworks across category folders")

    all_valid = True
    for fpath in sorted(files):
        fname = os.path.basename(fpath)
        try:
            tree = ET.parse(fpath)
            root = tree.getroot()
            # Verify tag is svg
            tag_name = root.tag.split("}")[-1] if "}" in root.tag else root.tag
            is_svg = tag_name.lower() == "svg"
            has_viewbox = "viewBox" in root.attrib or ("width" in root.attrib and "height" in root.attrib)
            if is_svg and has_viewbox:
                record(f"Validate {fname}", True, f"Valid XML, viewBox: {root.attrib.get('viewBox', 'w/h defined')}")
            else:
                all_valid = False
                record(f"Validate {fname}", False, f"Missing viewBox or invalid tag: {tag_name}")
        except Exception as e:
            all_valid = False
            record(f"Validate {fname}", False, f"XML Parse Error: {e}")


def test_server_and_apis():
    print("\n--- TEST SUITE 2: Server API & Static Asset Endpoints ---")
    env = os.environ.copy()
    env["PORT"] = str(TEST_PORT)
    proc = subprocess.Popen(["python3", "-u", "server.py"], env=env, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    time.sleep(1.2)

    try:
        base_url = f"http://localhost:{TEST_PORT}"

        # 1. Test GET /api/svgs
        try:
            req = urllib.request.urlopen(f"{base_url}/api/svgs")
            data = json.loads(req.read().decode("utf-8"))
            count = data.get("count", 0)
            status = data.get("status")
            headers = dict(req.headers)
            cors = headers.get("Access-Control-Allow-Origin")
            record("GET /api/svgs Response", status == "ok" and count >= 18, f"{count} artworks returned, status: {status}")
            record("GET /api/svgs CORS", cors == "*", f"Access-Control-Allow-Origin: {cors}")
        except Exception as e:
            record("GET /api/svgs", False, str(e))

        # 2. Test POST /api/upload
        try:
            test_payload = json.dumps({
                "name": "unit-test-art.svg",
                "category": "Nature & Scenery",
                "content": "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 400 300\"><circle cx=\"200\" cy=\"150\" r=\"80\" fill=\"#6366f1\"/></svg>"
            }).encode("utf-8")
            post_req = urllib.request.Request(
                f"{base_url}/api/upload",
                data=test_payload,
                headers={"Content-Type": "application/json"},
                method="POST"
            )
            res = urllib.request.urlopen(post_req)
            res_data = json.loads(res.read().decode("utf-8"))
            saved = res_data.get("saved", {})
            saved_path = os.path.join(BASE_DIR, saved.get("path", ""))
            file_exists = os.path.exists(saved_path)
            record("POST /api/upload Ingestion", res_data.get("status") == "ok" and file_exists, f"Saved file on disk, size: {saved.get('size')} B")

            # Clean up test file
            if file_exists:
                os.remove(saved_path)
        except Exception as e:
            record("POST /api/upload", False, str(e))

        # 3. Test Static Assets
        static_files = [
            ("index.html", "text/html"),
            ("manifest.json", "application/json"),
            ("sw.js", "javascript"),
            ("css/app.css", "text/css"),
            ("css/components.css", "text/css"),
            ("css/viewer.css", "text/css"),
            ("js/app.js", "javascript"),
            ("js/library.js", "javascript"),
            ("js/viewer.js", "javascript"),
            ("js/export.js", "javascript"),
            ("js/storage.js", "javascript"),
            ("svgs/nature-scenery/mountain-sunset.svg", "image/svg+xml"),
            ("svgs/mountain-sunset.svg", "image/svg+xml")
        ]

        for rel_path, mime_keyword in static_files:
            try:
                res = urllib.request.urlopen(f"{base_url}/{rel_path}")
                content = res.read()
                content_type = res.headers.get("Content-Type", "")
                is_ok = res.status == 200 and len(content) > 0 and (mime_keyword in content_type or rel_path.endswith((".js", ".css", ".json", ".svg", ".html")))
                record(f"Static Asset: {rel_path}", is_ok, f"HTTP {res.status}, {len(content)} bytes, {content_type}")
            except Exception as e:
                record(f"Static Asset: {rel_path}", False, str(e))

    finally:
        proc.terminate()
        proc.wait()


def test_dom_and_ui_bindings():
    print("\n--- TEST SUITE 3: DOM Bindings & JS Data Contracts ---")
    with open(os.path.join(BASE_DIR, "index.html"), "r", encoding="utf-8") as f:
        html = f.read()

    core_elements = [
        "svg-grid", "empty-state", "search-input", "search-clear-btn",
        "btn-theme-toggle", "toast-container"
    ]

    missing = [elem_id for elem_id in core_elements if f'id="{elem_id}"' not in html]
    record("DOM Element Bindings", len(missing) == 0, f"Verified {len(core_elements)} IDs. Missing: {missing}")

    # Check PWA manifest link & viewport tag
    has_manifest = '<link rel="manifest" href="manifest.json">' in html
    has_viewport = 'name="viewport"' in html and 'viewport-fit=cover' in html
    record("PWA Manifest Linked", has_manifest, "manifest.json properly linked")
    record("Mobile Safe-Area Viewport", has_viewport, "viewport-fit=cover configured for notch & home bars")


def test_headless_chromium_e2e():
    print("\n--- TEST SUITE 4: Headless Chromium Browser E2E Rendering ---")
    import glob, shutil
    for p in glob.glob("/tmp/chromium-test-profile*"):
        shutil.rmtree(p, ignore_errors=True)

    env = os.environ.copy()
    env["PORT"] = str(TEST_PORT)
    proc = subprocess.Popen(["python3", "-u", "server.py"], env=env, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    time.sleep(1.2)

    try:
        url = f"http://localhost:{TEST_PORT}"

        common_flags = [
            "--headless=new",
            "--no-sandbox",
            "--disable-setuid-sandbox",
            "--disable-dev-shm-usage",
            "--disable-gpu",
            "--crash-dumps-dir=/tmp/chromium-crash"
        ]

        # 1. Test Mobile Viewport (iPhone standard: 390x844)
        mobile_shot = os.path.join(SCREENSHOTS_DIR, "mobile_phone_view.png")
        cmd_mobile = ["chromium"] + common_flags + [
            "--user-data-dir=/tmp/chromium-test-profile-mobile",
            "--window-size=390,844",
            f"--screenshot={mobile_shot}",
            url
        ]
        res_m = subprocess.run(cmd_mobile, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, timeout=15)
        mobile_ok = os.path.exists(mobile_shot) and os.path.getsize(mobile_shot) > 10000
        record("Chromium Mobile (390×844) Render", mobile_ok, f"Screenshot saved ({os.path.getsize(mobile_shot) if mobile_ok else 0} B)")

        # 2. Test Tablet Viewport (iPad standard: 820x1180)
        tablet_shot = os.path.join(SCREENSHOTS_DIR, "tablet_view.png")
        cmd_tablet = ["chromium"] + common_flags + [
            "--user-data-dir=/tmp/chromium-test-profile-tablet",
            "--window-size=820,1180",
            f"--screenshot={tablet_shot}",
            url
        ]
        res_t = subprocess.run(cmd_tablet, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, timeout=15)
        tablet_ok = os.path.exists(tablet_shot) and os.path.getsize(tablet_shot) > 10000
        record("Chromium Tablet (820×1180) Render", tablet_ok, f"Screenshot saved ({os.path.getsize(tablet_shot) if tablet_ok else 0} B)")

        # 3. Test DOM Dump to verify cards & dynamic categories were rendered by JS
        cmd_dump = ["chromium"] + common_flags + [
            "--user-data-dir=/tmp/chromium-test-profile-dom",
            "--virtual-time-budget=2000",
            "--dump-dom",
            url
        ]
        res_dom = subprocess.run(cmd_dump, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, timeout=15)
        dom_rendered = "svg-card" in res_dom.stdout and "mountain sunset" in res_dom.stdout.lower()
        card_count = res_dom.stdout.count('class="svg-card"')
        record("Client-Side JS Grid Rendering", dom_rendered and card_count >= 18, f"Rendered {card_count} SVG artwork cards dynamically")

        has_dropdown = "category-dropdown-btn" in res_dom.stdout and "category-dropdown-menu" in res_dom.stdout
        record("Category Dropdown in Searchbar", has_dropdown, "Searchbar contains integrated category dropdown")

        has_dynamic_cats = (
            'data-filter="Tech &amp; Software"' in res_dom.stdout or
            'data-filter="Nature &amp; Scenery"' in res_dom.stdout or
            'data-filter="Engineering &amp; CAD"' in res_dom.stdout
        )
        record("Dynamic Subdirectory Categories", has_dynamic_cats, "Rendered dynamic category dropdown options")

    finally:
        proc.terminate()
        proc.wait()


def main():
    print("==================================================")
    print("   VECTOR SVG ARTWORK VIEWER — TEST RUNNER       ")
    print("==================================================")
    test_svg_xml_validity()
    test_server_and_apis()
    test_dom_and_ui_bindings()
    test_headless_chromium_e2e()

    print("\n==================================================")
    passed_count = sum(1 for r in results if r["passed"])
    total_count = len(results)
    print(f"TEST SUMMARY: {passed_count}/{total_count} PASSED")
    print("==================================================")
    if passed_count == total_count:
        print("🎉 ALL TESTS PASSED SUCCESSFULLY!")
        return 0
    else:
        print("⚠️ SOME TESTS FAILED!")
        return 1


if __name__ == "__main__":
    sys.exit(main())
