/**
 * SVG Vector Artwork Library & Palette Extractor
 */

import { Storage } from './storage.js';

export class SVGLibrary {
  constructor() {
    this.items = [];
    this.categories = [
      'All Artworks',
      'Favorites'
    ];
    this.discoveredCategories = [];
  }

  extractPalette(content) {
    const colors = new Set();
    // Match hex codes #rrggbb and #rgb
    const hexMatches = content.match(/#(?:[0-9a-fA-F]{3}){1,2}\b/g) || [];
    for (const h of hexMatches) {
      if (!['#000000', '#ffffff', '#000', '#fff'].includes(h.toLowerCase())) {
        colors.add(h.toLowerCase());
      }
      if (colors.size >= 5) break;
    }
    // Fallback if mostly monochrome/dark
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
    const minified = content
      .replace(/<!--[\s\S]*?-->/g, '')
      .replace(/>\s+</g, '><')
      .trim();
    const minifiedBytes = new Blob([minified]).size;
    const savingsPercent = Math.max(0, Math.round(((sizeBytes - minifiedBytes) / sizeBytes) * 100));

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

    // Aspect Ratio
    let aspectRatioStr = '4:3';
    const ratio = width / height;
    if (Math.abs(ratio - 1) < 0.1) aspectRatioStr = '1:1';
    else if (Math.abs(ratio - 1.33) < 0.1) aspectRatioStr = '4:3';
    else if (Math.abs(ratio - 1.77) < 0.15) aspectRatioStr = '16:9';
    else if (Math.abs(ratio - 0.75) < 0.1) aspectRatioStr = '3:4';
    else aspectRatioStr = `${width}:${height}`;

    // Count vector elements & gradients
    const elementMatches = content.match(/<(path|circle|rect|polygon|polyline|line|ellipse)\b/gi) || [];
    const pathCount = elementMatches.length;
    const gradientMatches = content.match(/<(linearGradient|radialGradient)\b/gi) || [];
    const gradientCount = gradientMatches.length;

    // Extract color palette
    const palette = this.extractPalette(content);

    // Artwork Category: prefer explicit category from directory, or fallback to auto-detect
    let category = explicitCategory;
    if (!category || category === 'All Illustrations') {
      category = 'Scenery & Nature';
      if (/undraw|coding|developer|rocket|analytics|workspace|creative|tech|data/i.test(name)) {
        category = 'Development & Tech';
      } else if (/cyber|neon|matrix|samurai|city/i.test(name)) {
        category = 'Cyberpunk & Sci-Fi';
      } else if (/space|cosmos|planet|nebula|star/i.test(name)) {
        category = 'Cosmos & Space';
      } else if (/abstract|wave|fluid|isometric/i.test(name)) {
        category = 'Abstract & 3D';
      } else if (/origami|fox|badge|geometric/i.test(name)) {
        category = 'Origami & Badges';
      } else if (/sunset|mountain|desert|oasis|aurora|lake|botanical|coral|reef|zen/i.test(name)) {
        category = 'Scenery & Nature';
      }
    }

    return {
      id,
      name,
      path: relPath || `svgs/${name}`,
      displayName: name.replace(/\.svg$/i, '').replace(/[-_]/g, ' '),
      content: content.trim(),
      minified,
      sizeBytes,
      sizeFormatted: sizeBytes < 1024 ? `${sizeBytes} B` : `${(sizeBytes / 1024).toFixed(1)} KB`,
      minifiedBytes,
      minifiedFormatted: minifiedBytes < 1024 ? `${minifiedBytes} B` : `${(minifiedBytes / 1024).toFixed(1)} KB`,
      savingsPercent,
      viewBox,
      width,
      height,
      aspectRatioStr,
      pathCount: pathCount || 1,
      gradientCount,
      palette,
      category
    };
  }

  async load() {
    let svgsFound = [];

    // Try fetching from server API first
    try {
      const res = await fetch('/api/svgs');
      if (res.ok) {
        const data = await res.json();
        if (data && data.svgs && data.svgs.length > 0) {
          svgsFound = data.svgs.map(item => this.parseSVGMetadata(item.name, item.content, item.category, item.path));
        }
        if (data && data.categories) {
          this.discoveredCategories = data.categories;
        }
      }
    } catch (e) {
      // Server API fallback
    }

    // Merge in any user uploads from local storage
    const userUploads = Storage.getUserUploads();
    if (userUploads && userUploads.length > 0) {
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

export function adjustBrightness(hex, percent) {
  const num = parseInt(hex.replace('#', ''), 16);
  const amt = Math.round(2.55 * percent);
  const R = Math.min(255, Math.max(0, (num >> 16) + amt));
  const G = Math.min(255, Math.max(0, ((num >> 8) & 0x00FF) + amt));
  const B = Math.min(255, Math.max(0, (num & 0x0000FF) + amt));
  return `#${((1 << 24) + (R << 16) + (G << 8) + B).toString(16).slice(1)}`;
}

export function recolorSVG(content, newColor) {
  if (!newColor || newColor === 'original') return content;
  
  let updated = content;
  const targets = ['#6c63ff', '#6C63FF', '#6366f1', '#4f46e5', '#776ffb'];
  targets.forEach(t => {
    updated = updated.split(t).join(newColor);
  });

  return updated;
}
