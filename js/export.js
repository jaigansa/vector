/**
 * Export & Clipboard Utilities for SVG Vector Artworks
 */

export const SVGExporter = {
  async copyText(text) {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.left = '-9999px';
    textArea.style.top = '0';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    const successful = document.execCommand('copy');
    document.body.removeChild(textArea);
    return successful;
  },

  async copySVG(item, customContent = null) {
    const content = customContent || item.recoloredContent || item.content;
    return await this.copyText(content);
  },

  async copyJSX(item, customContent = null) {
    let svg = customContent || item.recoloredContent || item.content;
    
    // Convert attributes to JSX camelCase
    svg = svg
      .replace(/class=/g, 'className=')
      .replace(/stroke-width=/g, 'strokeWidth=')
      .replace(/stroke-linecap=/g, 'strokeLinecap=')
      .replace(/stroke-linejoin=/g, 'strokeLinejoin=')
      .replace(/stroke-miterlimit=/g, 'strokeMiterlimit=')
      .replace(/stroke-dasharray=/g, 'strokeDasharray=')
      .replace(/stroke-dashoffset=/g, 'strokeDashoffset=')
      .replace(/fill-rule=/g, 'fillRule=')
      .replace(/clip-rule=/g, 'clipRule=')
      .replace(/clip-path=/g, 'clipPath=')
      .replace(/stop-color=/g, 'stopColor=')
      .replace(/stop-opacity=/g, 'stopOpacity=')
      .replace(/xmlns:xlink=/g, 'xmlnsXlink=')
      .replace(/xlink:href=/g, 'xlinkHref=');

    // Add props spread to root svg
    svg = svg.replace('<svg ', '<svg {...props} ');

    const componentName = item.displayName
      .split(' ')
      .map(w => w.charAt(0).toUpperCase() + w.slice(1))
      .join('') + 'Artwork';

    const jsx = `export function ${componentName}(props) {\n  return (\n    ${svg}\n  );\n}`;
    return await this.copyText(jsx);
  },

  async copyVue(item, customContent = null) {
    const content = customContent || item.recoloredContent || item.content;
    const vue = `<template>\n  ${content}\n</template>`;
    return await this.copyText(vue);
  },

  async copyDataURI(item, customContent = null) {
    const content = customContent || item.recoloredContent || item.content;
    const uri = `data:image/svg+xml;utf8,${encodeURIComponent(content)}`;
    return await this.copyText(uri);
  },

  downloadSVG(item, customContent = null) {
    const content = customContent || item.recoloredContent || item.content;
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

  downloadDXF(item, customContent = null) {
    const content = customContent || item.recoloredContent || item.content;
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

  optimizeSVG(content) {
    let clean = content
      .replace(/<\?xml[\s\S]*?\?>/gi, '')
      .replace(/<!DOCTYPE[\s\S]*?>/gi, '')
      .replace(/<!--[\s\S]*?-->/g, '')
      .replace(/\s+/g, ' ')
      .replace(/>\s+</g, '><')
      .replace(/id="[^"]*"/g, (match) => {
        // preserve gradient IDs but strip others
        return /grad|sky|sun|moon|nebula/i.test(match) ? match : '';
      })
      .trim();

    const origBytes = new Blob([content]).size;
    const cleanBytes = new Blob([clean]).size;
    const savings = Math.max(0, Math.round(((origBytes - cleanBytes) / origBytes) * 100));

    return {
      clean,
      origBytes,
      cleanBytes,
      savings
    };
  },

  exportPNG(item, scale = 2, customContent = null) {
    return new Promise((resolve, reject) => {
      const content = customContent || item.recoloredContent || item.content;
      const blob = new Blob([content], { type: 'image/svg+xml;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const img = new Image();

      img.onload = () => {
        const targetWidth = Math.round((item.width || 800) * scale);
        const targetHeight = Math.round((item.height || 600) * scale);
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
          a.download = `${item.id}-wallpaper-${targetWidth}x${targetHeight}.png`;
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
 * Universal AutoCAD R12 ASCII DXF Exporter for CNC Plotters, Lasers, and Vinyl Cutters
 */
export function convertSVGToDXF(svgString, width = 800, height = 600) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(svgString, 'image/svg+xml');
  const svg = doc.querySelector('svg');
  if (!svg) return '';

  let vbWidth = width;
  let vbHeight = height;
  const vb = svg.getAttribute('viewBox');
  if (vb) {
    const parts = vb.trim().split(/[\s,]+/).map(Number);
    if (parts.length === 4 && parts[2] > 0 && parts[3] > 0) {
      vbWidth = parts[2];
      vbHeight = parts[3];
    }
  }

  const lines = [];
  const addLine = (x1, y1, x2, y2) => {
    if (isNaN(x1) || isNaN(y1) || isNaN(x2) || isNaN(y2)) return;
    lines.push({ x1, y1, x2, y2 });
  };

  // Convert rects
  svg.querySelectorAll('rect').forEach(r => {
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
  svg.querySelectorAll('line').forEach(l => {
    const x1 = parseFloat(l.getAttribute('x1')) || 0;
    const y1 = parseFloat(l.getAttribute('y1')) || 0;
    const x2 = parseFloat(l.getAttribute('x2')) || 0;
    const y2 = parseFloat(l.getAttribute('y2')) || 0;
    addLine(x1, y1, x2, y2);
  });

  // Convert polylines & polygons
  svg.querySelectorAll('polyline, polygon').forEach(p => {
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

  // Convert paths using native SVG sampling
  svg.querySelectorAll('path').forEach(p => {
    const d = p.getAttribute('d') || '';
    if (!d) return;

    try {
      if (typeof document !== 'undefined' && document.createElementNS) {
        const tempSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        tempSvg.style.position = 'absolute';
        tempSvg.style.left = '-9999px';
        const tempPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        tempPath.setAttribute('d', d);
        tempSvg.appendChild(tempPath);
        document.body.appendChild(tempSvg);

        const totalLen = tempPath.getTotalLength();
        if (totalLen > 0) {
          const step = Math.max(3, Math.min(10, totalLen / 50));
          let prev = tempPath.getPointAtLength(0);
          for (let dist = step; dist <= totalLen; dist += step) {
            const curr = tempPath.getPointAtLength(dist);
            addLine(prev.x, prev.y, curr.x, curr.y);
            prev = curr;
          }
          const end = tempPath.getPointAtLength(totalLen);
          addLine(prev.x, prev.y, end.x, end.y);
        }
        document.body.removeChild(tempSvg);
      }
    } catch (e) {}
  });

  // Convert circles / ellipses
  svg.querySelectorAll('circle, ellipse').forEach(c => {
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
  const out = [];
  out.push('0\nSECTION\n2\nHEADER\n9\n$ACADVER\n1\nAC1009\n0\nENDSEC');
  out.push('0\nSECTION\n2\nENTITIES');

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
