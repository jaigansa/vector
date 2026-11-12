/**
 * SVG Vector Artwork Library & Palette Extractor
 */

import { Storage } from './storage.js';

export class SVGLibrary {
  constructor() {
    this.items = [];
    this.categories = ['All Artworks'];
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

  parseSVGMetadata(name, content, explicitCategory = null, relPath = null) {
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
