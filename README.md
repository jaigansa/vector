# Vector — SVG Studio & Plotter

A lightweight, zero-dependency SVG artwork gallery, CNC plotter simulator, and vector exporter. Built for desktop, tablet, and mobile.

---

## ⚡ Quick Start

Open **`index.html`** directly in your browser — no server needed.

Or run the dev server for live rebuilds when adding SVGs:

```bash
python3 server.py
```

Open **[http://localhost:8080](http://localhost:8080)** in your browser (or `http://<your-ip>:8080` from mobile/tablet on the same Wi-Fi).

---

## 🚀 Key Features

- **Artwork Gallery**: Browse vector illustrations by category and instant search.
- **Interactive Draw Slider & Plotter**: Scrub and draw vector artworks at any speed with the real-time synchronized draw slider, or play the automatic stroke-by-stroke mechanical path tracing animation. Original SVG faithfully displays upon completion.
- **Multi-Format Export**: Quick three-dot (⋮) card menu to download clean **SVG**, AutoCAD **DXF** (ready for CNC plotters, laser cutters, vinyl cutters), and high-resolution **PNG**.
- **Dynamic Categories**: Automatically discovers category folders inside `svgs/` and syncs with the search dropdown.
- **Clean Light Theme**: Distraction-free, high-contrast presentation designed for crisp vector artwork display.
- **Mobile & Tablet Ergonomics**: Responsive grid layout and touch-friendly navigation.

---

## 📥 Adding Artworks

Just drop `.svg` files into category folders inside `svgs/` (e.g. `svgs/illustrations/` or `svgs/icons/`), then rebuild the library bundle:

```bash
python3 server.py --build
```

This regenerates `js/svg-library.js` with all artworks embedded. Commit and push — no CI needed.

---

## 🛠️ Tech Stack

- **Frontend**: Vanilla HTML5, CSS3, JavaScript (no npm build steps or external dependencies).
- **Backend**: Built-in Python 3 HTTP server (`server.py`) — only needed for the build step (`--bundle`), not for running the site.
- **Static**: Works with `file://` — deploy anywhere (GitHub Pages, Netlify, Vercel, etc.).
