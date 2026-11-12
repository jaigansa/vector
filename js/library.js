/**
 * SVG Vector Artwork Library Loader & Metadata Parser
 */

import { Storage } from './storage.js';

export class SVGLibrary {
  constructor() {
    this.items = [];
    this.discoveredCategories = [];
    this.hasApiServer = false;
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

    return {
      id,
      name,
      path: relPath || `svgs/${name}`,
      displayName: name.replace(/\.svg$/i, '').replace(/[-_]/g, ' '),
      content: content.trim(),
      sizeBytes,
      viewBox,
      width,
      height,
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
}
