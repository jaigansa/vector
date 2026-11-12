/**
 * SVG Vector Artwork Library & Palette Extractor
 */

import { Storage } from './storage.js';

export function darkenHex(hex, factor = 0.75) {
  let h = (hex || '').replace(/^#/, '');
  if (h.length === 3) h = h.split('').map(c => c + c).join('');
  if (h.length !== 6) return '#1e293b';
  try {
    const r = Math.max(0, Math.floor(parseInt(h.slice(0, 2), 16) * factor));
    const g = Math.max(0, Math.floor(parseInt(h.slice(2, 4), 16) * factor));
    const b = Math.max(0, Math.floor(parseInt(h.slice(4, 6), 16) * factor));
    return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
  } catch {
    return '#1e293b';
  }
}

export function ensureIdleStrokes(svgContent) {
  if (!svgContent || typeof svgContent !== 'string') return svgContent;
  if (typeof DOMParser === 'undefined' || typeof XMLSerializer === 'undefined') return svgContent;

  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(svgContent, 'image/svg+xml');
    const svg = doc.querySelector('svg');
    if (!svg) return svgContent;

    let vbW = 800;
    const vb = svg.getAttribute('viewBox');
    if (vb) {
      const parts = vb.trim().split(/[\s,]+/).map(Number);
      if (parts.length === 4 && parts[2] > 0) vbW = parts[2];
    } else {
      const w = parseFloat(svg.getAttribute('width'));
      if (w > 0) vbW = w;
    }

    const defaultW = vbW <= 100 ? '1.5' : (vbW <= 500 ? '2' : '2.5');

    const shapes = Array.from(svg.querySelectorAll('path, polygon, polyline, circle, rect, ellipse, line'))
      .filter(el => !el.closest('defs'));

    if (shapes.length === 0) return svgContent;

    let dominantStroke = null;
    let dominantWidth = null;

    for (const el of shapes) {
      const style = el.getAttribute('style') || '';
      let s = el.getAttribute('stroke');
      let sw = el.getAttribute('stroke-width');

      if (!s && style) {
        const m = style.match(/(?:^|;)\s*stroke\s*:\s*([^;]+)/i);
        if (m) s = m[1].trim();
      }
      if (!sw && style) {
        const m = style.match(/(?:^|;)\s*stroke-width\s*:\s*([^;]+)/i);
        if (m) sw = m[1].trim();
      }

      if (s && s !== 'none' && s !== 'transparent' && !dominantStroke) {
        dominantStroke = s;
      }
      if (sw && sw !== '0' && sw !== '0px' && !dominantWidth) {
        dominantWidth = sw;
      }
    }

    const fallbackStroke = dominantStroke || '#1e293b';
    const fallbackWidth = dominantWidth || defaultW;

    let modified = false;

    for (const el of shapes) {
      const style = el.getAttribute('style') || '';
      let s = el.getAttribute('stroke');
      let sw = el.getAttribute('stroke-width');
      let fill = el.getAttribute('fill');

      if (!s && style) {
        const m = style.match(/(?:^|;)\s*stroke\s*:\s*([^;]+)/i);
        if (m) s = m[1].trim();
      }
      if (!sw && style) {
        const m = style.match(/(?:^|;)\s*stroke-width\s*:\s*([^;]+)/i);
        if (m) sw = m[1].trim();
      }
      if (!fill && style) {
        const m = style.match(/(?:^|;)\s*fill\s*:\s*([^;]+)/i);
        if (m) fill = m[1].trim();
      }

      const hasS = s && s !== 'none' && s !== 'transparent';
      const hasSw = sw && sw !== '0' && sw !== '0px';

      if (!hasS) {
        modified = true;
        const newStroke = (fill && fill.startsWith('#') && (fill.length === 4 || fill.length === 7))
          ? (dominantStroke || darkenHex(fill, 0.75))
          : fallbackStroke;
        el.setAttribute('stroke', newStroke);
        if (style.includes('stroke:')) {
          el.style.stroke = newStroke;
        }
      }

      if (!hasSw) {
        modified = true;
        el.setAttribute('stroke-width', fallbackWidth);
        if (style.includes('stroke-width:')) {
          el.style.strokeWidth = fallbackWidth;
        }
      }

      if (!el.hasAttribute('stroke-linecap') && !style.includes('stroke-linecap')) {
        el.setAttribute('stroke-linecap', 'round');
        modified = true;
      }
      if (!el.hasAttribute('stroke-linejoin') && !style.includes('stroke-linejoin')) {
        el.setAttribute('stroke-linejoin', 'round');
        modified = true;
      }
    }

    if (modified) {
      const serializer = new XMLSerializer();
      return serializer.serializeToString(svg);
    }
    return svgContent;
  } catch {
    return svgContent;
  }
}

export class SVGLibrary {
  constructor() {
    this.items = [];
    this.categories = ['All Artworks', 'Favorites'];
    this.discoveredCategories = [];
    this.hasApiServer = false;
  }

  extractPalette(content) {
    const colors = new Set();
    const hexMatches = content.match(/#(?:[0-9a-fA-F]{3}){1,2}\b/g) || [];
    for (const h of hexMatches) {
      if (!['#000000', '#ffffff', '#000', '#fff'].includes(h.toLowerCase())) {
        colors.add(h.toLowerCase());
      }
      if (colors.size >= 5) break;
    }
    if (colors.size === 0) {
      colors.add('#6366f1');
      colors.add('#ec4899');
      colors.add('#06b6d4');
    }
    return Array.from(colors);
  }

  parseSVGMetadata(name, rawContent, explicitCategory = null, relPath = null) {
    const content = ensureIdleStrokes(rawContent || '');
    const id = name.replace(/\.svg$/i, '').toLowerCase();
    const sizeBytes = new Blob([content]).size;

    // Extract viewBox or dimensions
    let viewBox = '0 0 800 600';
    let width = 800;
    let height = 600;
    const vbMatch = content.match(/viewBox=["']([^"']+)["']/i);
    if (vbMatch) {
      viewBox = vbMatch[1];
      const parts = viewBox.trim().split(/[\s,]+/).map(Number);
      if (parts.length === 4 && parts[2] > 0 && parts[3] > 0) {
        width = parts[2];
        height = parts[3];
      }
    } else {
      const wMatch = content.match(/width=["']([^"']+)["']/i);
      const hMatch = content.match(/height=["']([^"']+)["']/i);
      if (wMatch && !isNaN(parseFloat(wMatch[1]))) width = parseFloat(wMatch[1]);
      if (hMatch && !isNaN(parseFloat(hMatch[1]))) height = parseFloat(hMatch[1]);
    }

    // Count vector elements
    const elementMatches = content.match(/<(path|circle|rect|polygon|polyline|line|ellipse)\b/gi) || [];
    const pathCount = elementMatches.length || 1;

    // Extract color palette
    const palette = this.extractPalette(content);

    return {
      id,
      name,
      path: relPath || `svgs/${name}`,
      displayName: name.replace(/\.svg$/i, '').replace(/[-_]/g, ' '),
      content: content.trim(),
      sizeBytes,
      sizeFormatted: sizeBytes < 1024 ? `${sizeBytes} B` : `${(sizeBytes / 1024).toFixed(1)} KB`,
      viewBox,
      width,
      height,
      pathCount,
      palette,
      category: explicitCategory || 'General'
    };
  }

  async load() {
    let svgsFound = [];
    const isLocal = ['localhost', '127.0.0.1', '0.0.0.0'].includes(window.location.hostname) || window.location.port === '8080';

    // 1. In local dev environment with python server, query API for live discovery
    if (isLocal) {
      try {
        const res = await fetch('./api/svgs');
        if (res.ok) {
          const data = await res.json();
          if (data?.svgs?.length > 0) {
            svgsFound = data.svgs.map(item => this.parseSVGMetadata(item.name, item.content, item.category, item.path));
            this.hasApiServer = true;
          }
          if (data?.categories) {
            this.discoveredCategories = data.categories;
          }
        }
      } catch {
        this.hasApiServer = false;
      }
    }

    // 2. On static hosting (e.g. GitHub Pages) or if local API server is unavailable, load static svgs.json
    if (svgsFound.length === 0) {
      try {
        const res = await fetch('./svgs.json');
        if (res.ok) {
          const data = await res.json();
          if (data?.svgs?.length > 0) {
            svgsFound = data.svgs.map(item => this.parseSVGMetadata(item.name, item.content, item.category, item.path));
          }
          if (data?.categories) {
            this.discoveredCategories = data.categories;
          }
        }
      } catch {
        // Fallback below
      }
    }

    // 3. Merge in any user uploads from local storage
    const userUploads = Storage.getUserUploads();
    if (userUploads?.length > 0) {
      for (const upload of userUploads) {
        if (!svgsFound.some(s => s.id === upload.id)) {
          svgsFound.unshift(this.parseSVGMetadata(upload.name, upload.content, upload.category, upload.path));
        }
      }
    }

    this.items = svgsFound;
    return this.items;
  }

  addItem(name, content, category = null, path = null) {
    const item = this.parseSVGMetadata(name, content, category, path);
    const existingIdx = this.items.findIndex(i => i.id === item.id);
    if (existingIdx >= 0) {
      this.items[existingIdx] = item;
    } else {
      this.items.unshift(item);
    }
    Storage.saveUserUpload(item);
    return item;
  }
}
