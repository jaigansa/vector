# Vector — SVG Studio & Gallery

A lightweight, zero-dependency SVG artwork gallery, layer inspector, wallpaper exporter, and interactive drawing animator. Built for desktop, tablet, and mobile.

---

## ⚡ Quick Start

```bash
python3 server.py
```

Open **[http://localhost:8080](http://localhost:8080)** in your browser (or `http://<your-ip>:8080` from mobile/tablet on the same Wi-Fi).

---

## 🚀 Key Features

- **Artwork Gallery**: Browse illustrations by category, search by name, view extracted color palettes, and bookmark favorites.
- **Precision Canvas**: Pan & pinch-to-zoom (up to 2500%), wireframe mode, and dark/light background toggles.
- **Layer Inspector**: View individual SVG paths and shapes, toggle visibility (👁️), and highlight layers on hover.
- **Live Draw Studio**: Animate stroke sketching and color fills with speed controls (0.5×, 1×, 2×) and audio feedback.
- **Color Filters**: One-tap color presets (*Cyberpunk, Sunset, Noir, Forest, Vivid, Invert*).
- **Wallpaper Simulator**: Preview artworks as a phone or tablet lock screen with live clock and system UI.
- **Code Optimizer**: One-tap SVG cleanup to strip metadata and reduce file size.
- **Multi-Format Export**: Export as Phone/Tablet wallpaper (PNG), download `.svg`, or copy as SVG markup, React/JSX, Vue, or CSS data URI.

---

## 📥 Adding Artworks

- **In the Browser**: Drag and drop `.svg` files directly into the window or click **Upload**.
- **In the File System**: Place `.svg` files into category folders inside `svgs/` (e.g. `svgs/art-creative/`). Subfolders automatically map to gallery categories.

---

## 🛠️ Tech Stack

- **Frontend**: Vanilla HTML5, CSS3, JavaScript (no npm build steps or external dependencies).
- **Backend**: Built-in Python 3 HTTP server (`server.py`).
- **PWA Ready**: Works offline with service worker support.
