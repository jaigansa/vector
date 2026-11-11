# Vector — SVG Artwork & Plotter Studio

A fast, lightweight, and compact SVG vector artwork gallery, inspector, wallpaper exporter, and layer explorer built from scratch with zero dependencies. Optimized for mobile phones and tablets.

---

## 🚀 Quick Start

Run the built-in lightweight local server:

```bash
python3 server.py
```

Then open your browser at **[http://localhost:8080](http://localhost:8080)** (or access it from your phone/tablet on the same Wi-Fi network using `http://<your-ip>:8080`).

---

## 🎨 Adding Vector Artworks to Your Gallery

You can add vector art in two ways:
1. **Drop files into category folders inside [`svgs/`](./svgs/)**: Place files into category subdirectories (such as `svgs/tech-software/`, `svgs/business-marketing/`, `svgs/engineering-cad/`, `svgs/nature-scenery/`, `svgs/abstract-3d/`, or `svgs/art-creative/`). The server automatically discovers subdirectories, maps folder names to categories, and live-syncs with the search bar dropdown.
2. **Drag & drop or upload in browser**: Drop `.svg` artwork files directly anywhere on the screen, or tap the **Upload** button. Artworks are parsed, color palettes are extracted, and saved locally.

---

## ✨ Features & Capabilities

- **Art Gallery Layout & Touch Ergonomics (Phone & Tablet)**:
  - Expansive 16:10 artwork showcase cards with palette color preview dots.
  - Thumb-reachable bottom navigation on phones (Gallery, Favorites, Upload).
  - Swipe-up bottom sheet inspector with gesture pull-down to close.
  - Tablet split-view with pinned categories and 2–4 column artwork grid.
- **Interactive High-Precision Vector Canvas**:
  - Touch pinch-to-zoom (up to 2500%) & single-touch pan to inspect vector paths, Bézier curves, and gradients.
  - Wireframe mode: highlights vector path geometry and node mesh.
  - Presentation backgrounds: Dark Gallery (`#050508`), Studio White, Dark grid, and Light grid.
- **Interactive Vector Layers Explorer**:
  - Parses and lists distinct visual layers (`<path>`, `<polygon>`, `<circle>`, `<rect>`).
  - **Eye toggle (👁️)**: Hide or show individual layers live (e.g. hide backgrounds to isolate foreground elements).
  - **Canvas Highlight**: Hover or tap any layer to highlight its boundary on the canvas.
  - **Quick presets**: "Show All Layers" and "Isolate Shapes".
- **Built-in SVGO Code Optimizer**:
  - One-tap "⚡ Optimize SVG" cleans XML declarations, comments, and redundant metadata to reduce file size by 25%–40%.
- **Live Wallpaper Simulator**:
  - Tap `📱` to preview the artwork as a phone lock screen with live real-time clock, date, status bar, and home indicator.
- **Live Mood & Duotone Color Filters**:
  - Instant one-tap color grading: *Cyberpunk Neon, Sunset Warmth, Noir Monochrome, Emerald Forest, Vivid Pop, Negative*.
- **Interactive Vector Draw Studio**:
  - **Two-Phase Animation**: Layer-by-layer outline stroke sketching (start to end) followed by sequential color fill blooming once all strokes complete.
  - **Playback Controls**: Full Play, Pause, Resume, and Replay support.
  - **Speed Selector**: 0.5× (slow-motion artistic sketch), 1× (natural draw), and 2× (rapid preview).
  - **Live Dual-Phase Progress Bar**: Visual progress indicator showing Phase 1 (line drawing) transitioning into Phase 2 (color fill).
  - **Active Neon Stylus Glow**: Glowing laser tip effect following the currently drawing path.
  - **Zero-Dependency Web Audio**: Synthesized graphite pencil sketching sound and pentatonic color bloom chimes with instant mute toggle.
- **Motion & Device Ergonomics**:
  - 2D Gyroscope motion tilt on mobile devices.
  - Touch pinch-to-zoom (up to 2500%) & single-touch drag pan.
- **One-Tap Export Formats**:
  - Phone Wallpaper (9:16 portrait)
  - Tablet / 4K Wallpaper (PNG)
  - Vector `.svg` file download
  - Copy SVG markup
  - Copy React / Next.js JSX component
  - Copy Vue / Svelte template
  - Copy CSS `data:image/svg+xml` URI
