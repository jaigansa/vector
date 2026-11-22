# Vector — SVG Studio & Plotter

A lightweight, zero-dependency SVG artwork gallery, CNC plotter simulator, and vector exporter. Built for desktop, tablet, and mobile.

Built with native Bash and Node.js with **zero external dependencies** — no heavy build tools, no `node_modules/` required.

---

## ⚡ Quick Start

### Build for production

Run the build script directly:

```bash
./build.sh
```

*(or via npm if preferred: `npm run build`)*

Output is written directly to `docs/` — ready for GitHub Pages or any static host.

### Development & Live Server

```bash
./build.sh --serve
```

*(or `npm start`)*

Open **[http://localhost:8080](http://localhost:8080)** in your browser.

### Watch Mode

Automatically rebuild whenever any file in `src/` changes:

```bash
./build.sh --watch
```

---

## 📥 Adding or Removing SVGs

### Option 1: Automated Script (Recommended)

Use the helper script to copy the SVG, regenerate category chunks, build the site, commit, and push:

```bash
./scripts/add-svg.sh path/to/file.svg [category-folder]
```

Examples:
```bash
./scripts/add-svg.sh ~/Downloads/heart.svg icons
./scripts/add-svg.sh ~/Downloads/illustration.svg
```

### Option 2: Manual

Drop `.svg` files into category folders inside `src/svgs/` (e.g. `src/svgs/freesvg/` or `src/svgs/sample/`), then rebuild:

```bash
./build.sh
```

To remove an SVG, delete it from `src/svgs/` and rebuild.

The build script automatically:
- Scans `src/svgs/` for `.svg` files
- Groups them by folder (each folder = a category)
- Extracts `<title>` for display names
- Detects SVG sprites (`<symbol>` elements) and extracts them into individual artworks with original attributes, viewBox, and styles preserved
- Generates modular per-category chunks in `docs/js/lib/<category>.js` and `src/js/lib/`
- Regenerates `docs/index.html` with injected chunk scripts

No server needed — the site works with `file://` directly too.

---

## 🗂️ Project Structure

```
vector/
├── build.sh                 # Zero-dependency build script (build, --serve, --watch)
├── src/
│   ├── svgs/                # Drop your .svg files here, organized by category folder
│   │   ├── freesvg/
│   │   ├── sample/
│   │   └── sprite-test/
│   ├── css/
│   │   ├── app.css
│   │   ├── components.css
│   │   └── viewer.css
│   ├── js/
│   │   ├── app.js
│   │   ├── library.js
│   │   ├── viewer.js
│   │   ├── export.js
│   │   └── storage.js
│   ├── js/vendor/
│   │   └── lucide.min.js
│   └── index.html           # Main HTML template
├── scripts/
│   ├── add-svg.sh           # CLI helper to add SVG, rebuild, commit & deploy
│   └── generate-chunks.js   # Splits artwork catalog into per-category chunks
├── docs/                    # Static site build output (served by GitHub Pages)
│   ├── css/
│   ├── js/
│   │   ├── lib/             # Split category chunks (freesvg.js, sample.js, etc.)
│   │   └── ...
│   └── index.html
└── package.json
```

---

## 🚀 Key Features

- **Artwork Gallery**: Browse vector illustrations by category and instant search.
- **Interactive Draw Slider & Plotter**: Scrub and draw vector artworks at any speed with the real-time synchronized draw slider, or play the automatic stroke-by-stroke mechanical path tracing animation.
- **Multi-Format Export**: Download clean **SVG**, AutoCAD **DXF** (for CNC plotters, laser cutters, vinyl cutters), and high-resolution **PNG**.
- **Dynamic Categories**: Automatically discovers category folders inside `src/svgs/`.
- **Clean Light Theme**: Distraction-free, high-contrast presentation.
- **Mobile & Tablet**: Responsive grid layout and touch-friendly navigation.

---

## 🛠️ Tech Stack

- **Build Engine**: Standalone Bash (`build.sh`) + vanilla Node.js (zero npm dependencies)
- **Frontend**: Vanilla HTML5, CSS3, JavaScript (no frameworks or runtime dependencies)
- **Icons**: [Lucide](https://lucide.dev/)
- **Deploy**: GitHub Pages (`/docs`), or any static host
