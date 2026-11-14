/**
 * Export Utilities for SVG Vector Artworks (SVG, DXF, PNG)
 */

export const SVGExporter = {
  downloadSVG(item, customContent = null) {
    const content = customContent || item.content;
    const blob = new Blob([content], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = item.name.endsWith('.svg') ? item.name : `${item.name}.svg`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  },

  downloadSprite(item) {
    const content = item.rawSpriteContent || item.content;
    let fileName = item.spriteFile || (item.name.replace(/\.svg$/i, '') + '-sprite.svg');
    if (!fileName.toLowerCase().endsWith('.svg')) fileName += '.svg';
    const blob = new Blob([content], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  },

  downloadDXF(item, customContent = null) {
    const content = customContent || item.content;
    const dxfString = convertSVGToDXF(content, item.width || 800, item.height || 600);
    const blob = new Blob([dxfString], { type: 'application/dxf;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const baseName = item.name.replace(/\.svg$/i, '');
    a.download = `${baseName}.dxf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  },

  exportPNG(item, scale = 2, customContent = null) {
    return new Promise((resolve, reject) => {
      let content = customContent || item.content;
      const baseW = item.width || 800;
      const baseH = item.height || 600;
      let effectiveScale = scale;
      // For small icons (e.g. 24x24), scale up so the exported PNG has high resolution
      if (baseW <= 128 || baseH <= 128) {
        effectiveScale = Math.max(scale, 512 / Math.max(baseW, baseH));
      }

      const targetWidth = Math.round(baseW * effectiveScale);
      const targetHeight = Math.round(baseH * effectiveScale);

      // Ensure explicit width and height on root svg so <img> parses intrinsic size correctly
      if (!/<svg[^>]*\bwidth\s*=/i.test(content) || !/<svg[^>]*\bheight\s*=/i.test(content)) {
        content = content.replace(/<svg\b/i, `<svg width="${baseW}" height="${baseH}" `);
      }

      const blob = new Blob([content], { type: 'image/svg+xml;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const img = new Image();

      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = targetWidth;
        canvas.height = targetHeight;
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, targetWidth, targetHeight);
        ctx.drawImage(img, 0, 0, targetWidth, targetHeight);

        canvas.toBlob((pngBlob) => {
          if (!pngBlob) {
            URL.revokeObjectURL(url);
            reject(new Error('Canvas rasterization failed'));
            return;
          }
          const pngUrl = URL.createObjectURL(pngBlob);
          const a = document.createElement('a');
          a.href = pngUrl;
          a.download = `${item.id}-${targetWidth}x${targetHeight}.png`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(pngUrl);
          URL.revokeObjectURL(url);
          resolve(true);
        }, 'image/png');
      };

      img.onerror = (e) => {
        URL.revokeObjectURL(url);
        reject(e);
      };

      img.src = url;
    });
  }
};

/**
 * Resolve <use> elements into inline elements
 */
export function resolveUseElements(svg) {
  let depth = 0;
  while (depth < 5) {
    const useElements = Array.from(svg.querySelectorAll('use'));
    if (!useElements.length) break;
    depth++;

    useElements.forEach(useEl => {
      const href = useEl.getAttribute('href') || useEl.getAttribute('xlink:href');
      if (!href || !href.startsWith('#')) return;
      const targetId = href.slice(1);
      let targetEl = null;
      try {
        targetEl = svg.querySelector(`#${CSS.escape(targetId)}`);
      } catch {
        targetEl = svg.querySelector(`[id="${targetId}"]`);
      }
      if (!targetEl) return;

      const x = parseFloat(useEl.getAttribute('x')) || 0;
      const y = parseFloat(useEl.getAttribute('y')) || 0;
      const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      let transform = useEl.getAttribute('transform') || '';
      if (x !== 0 || y !== 0) {
        transform = transform ? `translate(${x}, ${y}) ${transform}` : `translate(${x}, ${y})`;
      }
      if (transform) g.setAttribute('transform', transform);

      for (let i = 0; i < useEl.attributes.length; i++) {
        const attr = useEl.attributes[i];
        if (!['x', 'y', 'width', 'height', 'href', 'xlink:href', 'id', 'transform'].includes(attr.name)) {
          g.setAttribute(attr.name, attr.value);
        }
      }

      if (targetEl.tagName.toLowerCase() === 'symbol') {
        Array.from(targetEl.childNodes).forEach(child => {
          const clone = child.cloneNode(true);
          if (clone.nodeType === 1) clone.removeAttribute('id');
          g.appendChild(clone);
        });
      } else {
        const clone = targetEl.cloneNode(true);
        if (clone.nodeType === 1) clone.removeAttribute('id');
        g.appendChild(clone);
      }

      useEl.parentNode?.replaceChild(g, useEl);
    });
  }
}

/**
 * Universal AutoCAD R12 ASCII DXF Exporter for CNC Plotters, Lasers, and Vinyl Cutters
 */
export function convertSVGToDXF(svgString, width = 800, height = 600) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(svgString, 'image/svg+xml');
  const svg = doc.querySelector('svg');
  if (!svg) return '';

  resolveUseElements(svg);

  let vbHeight = height;
  const vb = svg.getAttribute('viewBox');
  if (vb) {
    const parts = vb.trim().split(/[\s,]+/).map(Number);
    if (parts.length === 4 && parts[3] > 0) {
      vbHeight = parts[3];
    }
  }

  const lines = [];
  const addLine = (x1, y1, x2, y2) => {
    if (isNaN(x1) || isNaN(y1) || isNaN(x2) || isNaN(y2)) return;
    lines.push({ x1, y1, x2, y2 });
  };

  // Convert rects
  Array.from(svg.querySelectorAll('rect'))
    .filter(r => !r.closest('defs') && !r.closest('symbol'))
    .forEach(r => {
      const x = parseFloat(r.getAttribute('x')) || 0;
      const y = parseFloat(r.getAttribute('y')) || 0;
      const w = parseFloat(r.getAttribute('width')) || 0;
      const h = parseFloat(r.getAttribute('height')) || 0;
      if (w > 0 && h > 0) {
        addLine(x, y, x + w, y);
        addLine(x + w, y, x + w, y + h);
        addLine(x + w, y + h, x, y + h);
        addLine(x, y + h, x, y);
      }
    });

  // Convert lines
  Array.from(svg.querySelectorAll('line'))
    .filter(l => !l.closest('defs') && !l.closest('symbol'))
    .forEach(l => {
      const x1 = parseFloat(l.getAttribute('x1')) || 0;
      const y1 = parseFloat(l.getAttribute('y1')) || 0;
      const x2 = parseFloat(l.getAttribute('x2')) || 0;
      const y2 = parseFloat(l.getAttribute('y2')) || 0;
      addLine(x1, y1, x2, y2);
    });

  // Convert polylines & polygons
  Array.from(svg.querySelectorAll('polyline, polygon'))
    .filter(p => !p.closest('defs') && !p.closest('symbol'))
    .forEach(p => {
      const raw = (p.getAttribute('points') || '').trim();
      if (!raw) return;
      const coords = raw.split(/[\s,]+/).map(Number);
      const isPoly = p.tagName.toLowerCase() === 'polygon';
      for (let i = 0; i < coords.length - 2; i += 2) {
        addLine(coords[i], coords[i + 1], coords[i + 2], coords[i + 3]);
      }
      if (isPoly && coords.length >= 4) {
        addLine(coords[coords.length - 2], coords[coords.length - 1], coords[0], coords[1]);
      }
    });

  // Helper to split path into distinct subpaths so disconnected subpaths don't connect across jumps
  const getSubpathStrings = (d) => {
    if (!d) return [];
    const moveCount = (d.match(/[Mm]/g) || []).length;
    if (moveCount <= 1) return [d];
    // Split by command M or m
    const parts = d.split(/(?=[Mm])/g).map(s => s.trim()).filter(Boolean);
    return parts.length > 0 ? parts : [d];
  };

  // Convert paths using native SVG sampling
  Array.from(svg.querySelectorAll('path'))
    .filter(p => !p.closest('defs') && !p.closest('symbol'))
    .forEach(p => {
      const d = p.getAttribute('d') || '';
      if (!d) return;

      try {
        if (typeof document !== 'undefined' && document.createElementNS) {
          const tempSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
          tempSvg.style.position = 'absolute';
          tempSvg.style.left = '-9999px';
          document.body.appendChild(tempSvg);

          const subpaths = getSubpathStrings(d);
          subpaths.forEach(subD => {
            const tempPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            tempPath.setAttribute('d', subD);
            tempSvg.appendChild(tempPath);

            const totalLen = tempPath.getTotalLength();
            if (totalLen > 0) {
              const step = Math.max(0.5, Math.min(6, totalLen / 80));
              let prev = tempPath.getPointAtLength(0);
              for (let dist = step; dist <= totalLen; dist += step) {
                const curr = tempPath.getPointAtLength(dist);
                addLine(prev.x, prev.y, curr.x, curr.y);
                prev = curr;
              }
              const end = tempPath.getPointAtLength(totalLen);
              addLine(prev.x, prev.y, end.x, end.y);
            }
            tempSvg.removeChild(tempPath);
          });

          document.body.removeChild(tempSvg);
        }
      } catch {}
    });

  // Convert circles / ellipses
  Array.from(svg.querySelectorAll('circle, ellipse'))
    .filter(c => !c.closest('defs') && !c.closest('symbol'))
    .forEach(c => {
      const cx = parseFloat(c.getAttribute('cx')) || 0;
      const cy = parseFloat(c.getAttribute('cy')) || 0;
      const rx = parseFloat(c.getAttribute('r') || c.getAttribute('rx')) || 0;
      const ry = parseFloat(c.getAttribute('r') || c.getAttribute('ry')) || rx;
      if (rx > 0 && ry > 0) {
        const segments = 32;
        let prevX = cx + rx;
        let prevY = cy;
        for (let i = 1; i <= segments; i++) {
          const angle = (i / segments) * Math.PI * 2;
          const curX = cx + rx * Math.cos(angle);
          const curY = cy + ry * Math.sin(angle);
          addLine(prevX, prevY, curX, curY);
          prevX = curX;
          prevY = curY;
        }
      }
    });

  // Build AutoCAD R12 ASCII DXF
  const out = [
    '0\nSECTION\n2\nHEADER\n9\n$ACADVER\n1\nAC1009\n0\nENDSEC',
    '0\nSECTION\n2\nENTITIES'
  ];

  for (const l of lines) {
    const y1 = (vbHeight - l.y1).toFixed(2);
    const y2 = (vbHeight - l.y2).toFixed(2);
    const x1 = l.x1.toFixed(2);
    const x2 = l.x2.toFixed(2);
    out.push(`0\nLINE\n8\n0\n10\n${x1}\n20\n${y1}\n11\n${x2}\n21\n${y2}`);
  }

  out.push('0\nENDSEC\n0\nEOF\n');
  return out.join('\n');
}
