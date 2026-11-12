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
- **Plotter Simulation**: Watch artworks drawn stroke-by-stroke with glowing mechanical path tracing, faithfully showing the original SVG upon completion.
- **Multi-Format Export**:
  - **SVG**: Download clean vector files.
  - **DXF**: Export AutoCAD R12 DXF format ready for CNC plotters, laser cutters, and vinyl cutters.
  - **PNG**: Export high-resolution raster images.
- **Dynamic Categories**: Automatically discovers category folders inside `svgs/` and syncs with the search dropdown.
- **Clean Light Theme**: Distraction-free, high-contrast presentation designed for crisp vector artwork display.
- **Mobile & Tablet Ergonomics**: Responsive grid layout and touch-friendly navigation.

---

## 📥 Adding Artworks

Just drop `.svg` files into category folders inside `svgs/` (e.g. `svgs/illustrations/` or `svgs/icons/`) and push!

- **GitHub Pages (Automated)**: Pushing to `main` automatically triggers GitHub Actions to build `svgs.json` and deploy the updated static site.
- **Local Development**: Run `python3 server.py` (live auto-sync) or build the static catalog anytime via `python3 build.py`.

---

## 🛠️ Tech Stack

- **Frontend**: Vanilla HTML5, CSS3, JavaScript (no npm build steps or external dependencies).
- **Backend**: Built-in Python 3 HTTP server (`server.py`).
- **PWA Ready**: Offline caching with service worker support.
