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

  isSVGSprite(content) {
    if (!content || typeof content !== 'string') return false;
    if (!/<symbol[\s>]/i.test(content)) return false;
    try {
      const doc = new DOMParser().parseFromString(content, 'image/svg+xml');
      const root = doc.querySelector('svg');
      if (!root) return false;
      const symbols = Array.from(doc.querySelectorAll('symbol'));
      if (!symbols.length) return false;

      const w = root.getAttribute('width')?.trim() || '';
      const h = root.getAttribute('height')?.trim() || '';
      const style = (root.getAttribute('style') || '').toLowerCase();
      if (w === '0' || w === '0px' || h === '0' || h === '0px' || style.includes('position:absolute') || style.includes('display:none')) {
        return true;
      }

      // Check for direct renderable shapes outside <defs> and <symbol>
      const directShapes = Array.from(root.children).some(child => {
        const tag = child.tagName.toLowerCase();
        if (tag === 'defs' || tag === 'symbol' || tag === 'style' || tag === 'title' || tag === 'desc') return false;
        return true;
      });

      return !directShapes || symbols.length >= 2;
    } catch {
      return false;
    }
  }

  extractSpriteSymbols(name, content, explicitCategory = null, relPath = null, extraProps = {}) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(content, 'image/svg+xml');
    const rootSvg = doc.querySelector('svg');
    const symbols = Array.from(doc.querySelectorAll('symbol'));
    if (!symbols.length) return [];

    const rootVb = rootSvg?.getAttribute('viewBox') || '0 0 24 24';
    const sharedStyles = Array.from(doc.querySelectorAll('style')).map(s => s.outerHTML).join('\n');
    const sharedDefs = Array.from(doc.querySelectorAll('defs')).map(d => {
      const clone = d.cloneNode(true);
      clone.querySelectorAll('symbol').forEach(s => s.remove());
      return clone.childNodes.length > 0 ? clone.outerHTML : '';
    }).filter(Boolean).join('\n');

    const baseName = name.replace(/\.svg$/i, '');
    const items = [];

    symbols.forEach((sym, idx) => {
      const symId = sym.getAttribute('id') || `symbol-${idx + 1}`;
      const itemId = symId.startsWith(baseName) ? symId : `${baseName}-${symId}`;
      const titleEl = sym.querySelector('title');
      const titleText = titleEl ? titleEl.textContent.trim() : '';
      const displayName = titleText || symId.replace(/[-_]/g, ' ').replace(/\b\w/g, l => l.toUpperCase());

      const vb = sym.getAttribute('viewBox') || rootVb;
      const attrList = [`xmlns="http://www.w3.org/2000/svg"`, `viewBox="${vb}"`];

      for (let i = 0; i < sym.attributes.length; i++) {
        const attr = sym.attributes[i];
        if (['id', 'viewBox', 'xmlns'].includes(attr.name)) continue;
        attrList.push(`${attr.name}="${attr.value}"`);
      }

      const innerContent = sym.innerHTML;
      const defsHeader = sharedDefs || sharedStyles ? `${sharedStyles}${sharedDefs}` : '';
      const standaloneSvg = `<svg ${attrList.join(' ')}>${defsHeader}${innerContent}</svg>`;

      items.push(this.parseSVGMetadata(
        `${symId}.svg`,
        standaloneSvg,
        explicitCategory,
        `${relPath || `svgs/${name}`}#${symId}`,
        {
          ...extraProps,
          id: itemId,
          displayName,
          isSprite: true,
          spriteFile: name,
          symbolId: symId,
          rawSpriteContent: content,
          size: undefined
        }
      ));
    });

    return items;
  }

  processSvgItem(item) {
    if (item.isSprite) {
      return [this.parseSVGMetadata(item.name, item.content, item.category, item.path, item)];
    }
    if (this.isSVGSprite(item.content)) {
      const extracted = this.extractSpriteSymbols(item.name, item.content, item.category, item.path, item);
      if (extracted.length > 0) return extracted;
    }
    return [this.parseSVGMetadata(item.name, item.content, item.category, item.path, item)];
  }

  parseSVGMetadata(name, content, explicitCategory = null, relPath = null, extraProps = {}) {
    const id = extraProps.id || name.replace(/\.svg$/i, '').toLowerCase();
    const sizeBytes = extraProps.size || new Blob([content]).size;

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

    const defaultDisplayName = name.replace(/\.svg$/i, '').replace(/[-_]/g, ' ');

    return {
      id,
      name,
      path: relPath || `svgs/${name}`,
      displayName: extraProps.displayName || defaultDisplayName,
      content: content.trim(),
      sizeBytes,
      viewBox,
      width,
      height,
      category: explicitCategory || 'General',
      isSprite: !!extraProps.isSprite,
      spriteFile: extraProps.spriteFile || null,
      symbolId: extraProps.symbolId || null,
      rawSpriteContent: extraProps.rawSpriteContent || null
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
            data.svgs.forEach(item => {
              svgsFound.push(...this.processSvgItem(item));
            });
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
            data.svgs.forEach(item => {
              svgsFound.push(...this.processSvgItem(item));
            });
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
        const processed = this.processSvgItem(upload);
        for (const item of processed) {
          if (!svgsFound.some(s => s.id === item.id)) {
            svgsFound.unshift(item);
          }
        }
      }
    }

    this.items = svgsFound;
    return this.items;
  }
}
