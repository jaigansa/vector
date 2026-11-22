# Vector — SVG Studio & Plotter

A lightweight, zero-dependency SVG artwork gallery, CNC plotter simulator, and vector exporter. Built for desktop, tablet, and mobile.

Powered by [Eleventy (11ty)](https://www.11ty.dev/) as a static site generator.

---

## ⚡ Quick Start

### Development (with live reload)

```bash
npm install
npm start
```

Open **[http://localhost:8080](http://localhost:8080)** in your browser.

### Build for production

```bash
npm run build
```

Output goes to `_site/` — deploy that folder to GitHub Pages, Netlify, Vercel, or any static host.

---

## 📥 Adding or Removing SVGs

Just drop `.svg` files into category folders inside `src/svgs/` (e.g. `src/svgs/illustrations/` or `src/svgs/icons/`), then rebuild:

```bash
npm run build
```

To remove an SVG, delete it from `src/svgs/` and rebuild.

Eleventy automatically:
- Scans `src/svgs/` for `.svg` files
- Groups them by folder (each folder = a category)
- Extracts `<title>` for display names
- Detects SVG sprites (`<symbol>` elements) and splits them into individual artworks
- Regenerates `_site/js/svg-library.js` with all artworks embedded
- Regenerates `_site/index.html`

No server needed — the site works with `file://` too.

---

## 🗂️ Project Structure

```
vector/
├── src/
│   ├── _data/
│   │   └── svgs.js          # Reads svgs/ and builds the artwork catalog
│   ├── svgs/                # Drop your .svg files here, organized by folder
│   │   ├── freesvg/
│   │   ├── sample/
│   │   └── sprite-test/
│   ├── css/
│   │   ├── app.css
│   │   ├── components.css
│   │   └── viewer.css
│   ├── js/
│   │   ├── svg-library.njk  # Template → generates js/svg-library.js
│   │   ├── app.js
│   │   ├── library.js
│   │   ├── viewer.js
│   │   ├── export.js
│   │   └── storage.js
│   ├── js/vendor/
│   │   └── lucide.min.js
│   └── index.njk            # Main HTML template
├── eleventy.config.js       # Eleventy configuration
├── package.json
└── _site/                   # Build output (gitignored)
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

- **Static Generator**: [Eleventy (11ty)](https://www.11ty.dev/) (v3)
- **Frontend**: Vanilla HTML5, CSS3, JavaScript (no npm build steps or external runtime dependencies)
- **Icons**: [Lucide](https://lucide.dev/)
- **Deploy**: Any static host (GitHub Pages, Netlify, Vercel, etc.)
