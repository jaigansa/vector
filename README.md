# Vector — SVG Studio & Plotter

A lightweight, zero-dependency SVG artwork gallery, CNC plotter simulator, and vector exporter. Built for desktop, tablet, and mobile.

---

## ⚡ Quick Start

```bash
python3 server.py
```

Open **[http://localhost:8080](http://localhost:8080)** in your browser (or `http://<your-ip>:8080` from mobile/tablet on the same Wi-Fi).

---

## 🚀 Key Features

- **Artwork Gallery**: Browse vector illustrations by category, search by name, and bookmark favorites.
- **Plotter Simulation**: Watch artworks drawn stroke-by-stroke with glowing path tracing, followed by sequential color fill blooming.
- **Multi-Format Export**:
  - **SVG**: Download clean vector files.
  - **DXF**: Export AutoCAD R12 DXF format ready for CNC plotters, laser cutters, and vinyl cutters.
  - **PNG**: Export high-resolution raster images.
- **Dynamic Categories**: Automatically discovers category folders inside `svgs/` and syncs with the search dropdown.
- **Dark & Light Mode**: Clean theme toggle with persistent preferences.
- **Mobile & Tablet Ergonomics**: Responsive grid layout and touch-friendly navigation.

---

## 📥 Adding Artworks

Place `.svg` files into subfolders inside `svgs/` (e.g., `svgs/illustrations/` or `svgs/icons/`). Subfolders automatically map to gallery categories in the dropdown filter.

---

## 🛠️ Tech Stack

- **Frontend**: Vanilla HTML5, CSS3, JavaScript (no npm build steps or external dependencies).
- **Backend**: Built-in Python 3 HTTP server (`server.py`).
- **PWA Ready**: Offline caching with service worker support.
