/**
 * Interactive SVG Vector Artwork Plotter Simulation Engine
 * Synchronized with interactive draw scrubber slider and automatic stroke animation.
 */

import { resolveUseElements } from './export.js';

const NEON_PALETTE = [
  { stroke: '#00f5ff', glow: 'rgba(0, 245, 255, 0.7)' },   // Electric Cyan
  { stroke: '#39ff14', glow: 'rgba(57, 255, 20, 0.7)' },   // Neon Lime
  { stroke: '#ff007f', glow: 'rgba(255, 0, 127, 0.7)' },   // Hot Neon Pink
  { stroke: '#ffe600', glow: 'rgba(255, 230, 0, 0.7)' },   // Laser Yellow
  { stroke: '#bf00ff', glow: 'rgba(191, 0, 255, 0.7)' },   // Electric Violet
  { stroke: '#ff5e00', glow: 'rgba(255, 94, 0, 0.7)' },    // Neon Tangerine
  { stroke: '#00ffcc', glow: 'rgba(0, 255, 204, 0.7)' },   // Aquamarine Neon
  { stroke: '#00aaff', glow: 'rgba(0, 170, 255, 0.7)' },   // Deep Sky Neon
  { stroke: '#ff0055', glow: 'rgba(255, 0, 85, 0.7)' }     // Neon Crimson
];

export class SVGViewer {
  constructor(app) {
    this.app = app;
    this.activeCard = null;
    this.activeItem = null;
    this.activeSvg = null;
    this.originalSvgHTML = null;
    this.speedOptions = [1.0, 2.0, 4.0, 0.5];
    this.speedIndex = 0;
    this.animSpeed = 1.0;
    try {
      const saved = parseFloat(localStorage.getItem('vector_plot_speed'));
      const idx = this.speedOptions.indexOf(saved);
      if (idx !== -1) {
        this.speedIndex = idx;
        this.animSpeed = saved;
      }
    } catch {}
    this.isPlotting = false;
    this.isLoop = false;
    this.loopTimer = null;
    this.activeContainer = null;
    this.animElements = [];
    this.totalLength = 0;
    this.visualLength = 0;
    this.scale = 1.0;
    this.currentProgress = 0;
    this.rafId = null;
    this.isRestored = true;
  }

  computeScale(svg) {
    let vbWidth = 0;
    let vbHeight = 0;
    const vb = svg?.getAttribute('viewBox');
    if (vb) {
      const parts = vb.trim().split(/[\s,]+/).map(Number);
      if (parts.length === 4 && parts[2] > 0 && parts[3] > 0) {
        vbWidth = parts[2];
        vbHeight = parts[3];
      }
    }
    if (!vbWidth) {
      const w = parseFloat(svg?.getAttribute('width'));
      if (w > 0) vbWidth = w;
      const h = parseFloat(svg?.getAttribute('height'));
      if (h > 0) vbHeight = h;
    }

    const rect = svg?.getBoundingClientRect();
    const screenPixelWidth = rect?.width > 0 ? rect.width : 300;
    const screenPixelHeight = rect?.height > 0 ? rect.height : 220;

    if (!vbWidth) vbWidth = 800;
    if (!vbHeight) vbHeight = 600;

    // SVG preserveAspectRatio default is "xMidYMid meet"
    // The scale factor is max(vbWidth / screenPixelWidth, vbHeight / screenPixelHeight)
    const scaleX = vbWidth / screenPixelWidth;
    const scaleY = vbHeight / screenPixelHeight;
    const scale = Math.max(scaleX, scaleY);

    return Math.max(0.001, scale);
  }

  getPinStrokeWidth(svg) {
    const scale = this.computeScale(svg);
    const screenWidth = window.innerWidth || 800;
    const targetPx = screenWidth <= 480 ? 1.0 : (screenWidth <= 768 ? 1.2 : 1.4);

    return `${(targetPx * scale).toFixed(3)}px`;
  }

  cycleSpeed() {
    this.speedIndex = (this.speedIndex + 1) % this.speedOptions.length;
    this.animSpeed = this.speedOptions[this.speedIndex];
    try {
      localStorage.setItem('vector_plot_speed', String(this.animSpeed));
    } catch {}
    return this.animSpeed;
  }

  setSpeed(speedVal) {
    const idx = this.speedOptions.indexOf(speedVal);
    if (idx !== -1) {
      this.speedIndex = idx;
      this.animSpeed = speedVal;
    } else {
      this.animSpeed = Math.max(0.1, speedVal);
    }
    try {
      localStorage.setItem('vector_plot_speed', String(this.animSpeed));
    } catch {}
  }

  getSpeedLabel() {
    const s = this.animSpeed;
    return s === 0.5 ? '0.5x' : `${s}x`;
  }

  getElementLength(el) {
    try {
      if (typeof el.getTotalLength === 'function') {
        const l = el.getTotalLength();
        if (!isNaN(l) && l > 0) return Math.ceil(l);
      }
      const tag = el.tagName.toLowerCase();
      if (tag === 'polygon' || tag === 'polyline') {
        const raw = (el.getAttribute('points') || '').trim();
        const coords = raw.split(/[\s,]+/).map(Number);
        let polyLen = 0;
        for (let p = 0; p < coords.length - 2; p += 2) {
          const dx = coords[p + 2] - coords[p];
          const dy = coords[p + 3] - coords[p + 1];
          polyLen += Math.sqrt(dx * dx + dy * dy);
        }
        if (tag === 'polygon' && coords.length >= 4) {
          const dx = coords[0] - coords[coords.length - 2];
          const dy = coords[1] - coords[coords.length - 1];
          polyLen += Math.sqrt(dx * dx + dy * dy);
        }
        if (polyLen > 0) return Math.ceil(polyLen);
      } else if (tag === 'rect') {
        const w = parseFloat(el.getAttribute('width')) || 100;
        const h = parseFloat(el.getAttribute('height')) || 100;
        return Math.ceil(2 * (w + h));
      } else if (tag === 'circle') {
        const r = parseFloat(el.getAttribute('r')) || 50;
        return Math.ceil(2 * Math.PI * r);
      } else if (tag === 'ellipse') {
        const rx = parseFloat(el.getAttribute('rx')) || 50;
        const ry = parseFloat(el.getAttribute('ry')) || 50;
        return Math.ceil(2 * Math.PI * Math.sqrt((rx * rx + ry * ry) / 2));
      } else if (tag === 'line') {
        const x1 = parseFloat(el.getAttribute('x1')) || 0;
        const y1 = parseFloat(el.getAttribute('y1')) || 0;
        const x2 = parseFloat(el.getAttribute('x2')) || 0;
        const y2 = parseFloat(el.getAttribute('y2')) || 0;
        return Math.ceil(Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2));
      } else if (tag === 'path') {
        const d = el.getAttribute('d') || '';
        const nums = d.match(/[-+]?\d*\.?\d+(?:[eE][-+]?\d+)?/g);
        if (nums && nums.length >= 4) {
          let est = 0;
          for (let p = 0; p < nums.length - 3; p += 2) {
            const dx = parseFloat(nums[p + 2]) - parseFloat(nums[p]);
            const dy = parseFloat(nums[p + 3]) - parseFloat(nums[p + 1]);
            est += Math.sqrt(dx * dx + dy * dy);
          }
          if (est > 0) return Math.ceil(est);
        }
      }
    } catch {}
    return 600;
  }

  splitSubpaths(d) {
    if (!d) return [];
    const moveMatches = d.match(/[Mm]/g);
    if (!moveMatches || moveMatches.length <= 1) return [d];

    const tokens = d.match(/([MmLlHhVvCcSsQqTtAaZz]|[-+]?(?:\d*\.\d+|\d+)(?:[eE][-+]?\d+)?)/g);
    if (!tokens || tokens.length === 0) return [d];

    const subpaths = [];
    let currentTokens = [];
    let curX = 0, curY = 0;
    let startX = 0, startY = 0;
    let i = 0;
    const n = tokens.length;

    while (i < n) {
      const tok = tokens[i];
      if (/^[MmLlHhVvCcSsQqTtAaZz]$/.test(tok)) {
        const cmd = tok;
        i++;
        if (cmd === 'M' || cmd === 'm') {
          if (currentTokens.length > 0) {
            subpaths.push(currentTokens.join(' '));
            currentTokens = [];
          }
          let x = parseFloat(tokens[i]);
          let y = parseFloat(tokens[i + 1]);
          i += 2;
          if (cmd === 'm') {
            curX += x;
            curY += y;
          } else {
            curX = x;
            curY = y;
          }
          startX = curX;
          startY = curY;
          currentTokens.push(`M ${curX.toFixed(4)} ${curY.toFixed(4)}`);
          while (i + 1 < n && !/^[MmLlHhVvCcSsQqTtAaZz]$/.test(tokens[i])) {
            const lx = parseFloat(tokens[i]);
            const ly = parseFloat(tokens[i + 1]);
            i += 2;
            if (isNaN(lx) || isNaN(ly)) break;
            if (cmd === 'm') {
              curX += lx;
              curY += ly;
            } else {
              curX = lx;
              curY = ly;
            }
            currentTokens.push(`L ${curX.toFixed(4)} ${curY.toFixed(4)}`);
          }
        } else if (cmd === 'Z' || cmd === 'z') {
          currentTokens.push(cmd);
          curX = startX;
          curY = startY;
        } else if (cmd === 'H' || cmd === 'h') {
          while (i < n && !/^[MmLlHhVvCcSsQqTtAaZz]$/.test(tokens[i])) {
            const val = parseFloat(tokens[i]);
            i++;
            if (isNaN(val)) break;
            curX = (cmd === 'h') ? (curX + val) : val;
            currentTokens.push(`H ${curX.toFixed(4)}`);
          }
        } else if (cmd === 'V' || cmd === 'v') {
          while (i < n && !/^[MmLlHhVvCcSsQqTtAaZz]$/.test(tokens[i])) {
            const val = parseFloat(tokens[i]);
            i++;
            if (isNaN(val)) break;
            curY = (cmd === 'v') ? (curY + val) : val;
            currentTokens.push(`V ${curY.toFixed(4)}`);
          }
        } else if (cmd === 'L' || cmd === 'l') {
          while (i + 1 < n && !/^[MmLlHhVvCcSsQqTtAaZz]$/.test(tokens[i])) {
            const x = parseFloat(tokens[i]);
            const y = parseFloat(tokens[i + 1]);
            i += 2;
            if (isNaN(x) || isNaN(y)) break;
            if (cmd === 'l') {
              curX += x;
              curY += y;
            } else {
              curX = x;
              curY = y;
            }
            currentTokens.push(`L ${curX.toFixed(4)} ${curY.toFixed(4)}`);
          }
        } else if (cmd === 'T' || cmd === 't') {
          while (i + 1 < n && !/^[MmLlHhVvCcSsQqTtAaZz]$/.test(tokens[i])) {
            const x = parseFloat(tokens[i]);
            const y = parseFloat(tokens[i + 1]);
            i += 2;
            if (isNaN(x) || isNaN(y)) break;
            if (cmd === 't') {
              curX += x;
              curY += y;
            } else {
              curX = x;
              curY = y;
            }
            currentTokens.push(`T ${curX.toFixed(4)} ${curY.toFixed(4)}`);
          }
        } else if (cmd === 'C' || cmd === 'c') {
          while (i + 5 < n && !/^[MmLlHhVvCcSsQqTtAaZz]$/.test(tokens[i])) {
            const x1 = parseFloat(tokens[i]);
            const y1 = parseFloat(tokens[i + 1]);
            const x2 = parseFloat(tokens[i + 2]);
            const y2 = parseFloat(tokens[i + 3]);
            const x = parseFloat(tokens[i + 4]);
            const y = parseFloat(tokens[i + 5]);
            i += 6;
            if (isNaN(x1) || isNaN(y1) || isNaN(x2) || isNaN(y2) || isNaN(x) || isNaN(y)) break;
            if (cmd === 'c') {
              currentTokens.push(`C ${(curX + x1).toFixed(4)} ${(curY + y1).toFixed(4)} ${(curX + x2).toFixed(4)} ${(curY + y2).toFixed(4)} ${(curX + x).toFixed(4)} ${(curY + y).toFixed(4)}`);
              curX += x;
              curY += y;
            } else {
              currentTokens.push(`C ${x1.toFixed(4)} ${y1.toFixed(4)} ${x2.toFixed(4)} ${y2.toFixed(4)} ${x.toFixed(4)} ${y.toFixed(4)}`);
              curX = x;
              curY = y;
            }
          }
        } else if (cmd === 'S' || cmd === 's') {
          while (i + 3 < n && !/^[MmLlHhVvCcSsQqTtAaZz]$/.test(tokens[i])) {
            const x2 = parseFloat(tokens[i]);
            const y2 = parseFloat(tokens[i + 1]);
            const x = parseFloat(tokens[i + 2]);
            const y = parseFloat(tokens[i + 3]);
            i += 4;
            if (isNaN(x2) || isNaN(y2) || isNaN(x) || isNaN(y)) break;
            if (cmd === 's') {
              currentTokens.push(`S ${(curX + x2).toFixed(4)} ${(curY + y2).toFixed(4)} ${(curX + x).toFixed(4)} ${(curY + y).toFixed(4)}`);
              curX += x;
              curY += y;
            } else {
              currentTokens.push(`S ${x2.toFixed(4)} ${y2.toFixed(4)} ${x.toFixed(4)} ${y.toFixed(4)}`);
              curX = x;
              curY = y;
            }
          }
        } else if (cmd === 'Q' || cmd === 'q') {
          while (i + 3 < n && !/^[MmLlHhVvCcSsQqTtAaZz]$/.test(tokens[i])) {
            const x1 = parseFloat(tokens[i]);
            const y1 = parseFloat(tokens[i + 1]);
            const x = parseFloat(tokens[i + 2]);
            const y = parseFloat(tokens[i + 3]);
            i += 4;
            if (isNaN(x1) || isNaN(y1) || isNaN(x) || isNaN(y)) break;
            if (cmd === 'q') {
              currentTokens.push(`Q ${(curX + x1).toFixed(4)} ${(curY + y1).toFixed(4)} ${(curX + x).toFixed(4)} ${(curY + y).toFixed(4)}`);
              curX += x;
              curY += y;
            } else {
              currentTokens.push(`Q ${x1.toFixed(4)} ${y1.toFixed(4)} ${x.toFixed(4)} ${y.toFixed(4)}`);
              curX = x;
              curY = y;
            }
          }
        } else if (cmd === 'A' || cmd === 'a') {
          while (i + 6 < n && !/^[MmLlHhVvCcSsQqTtAaZz]$/.test(tokens[i])) {
            const rx = parseFloat(tokens[i]);
            const ry = parseFloat(tokens[i + 1]);
            const rot = tokens[i + 2];
            const la = tokens[i + 3];
            const sw = tokens[i + 4];
            const x = parseFloat(tokens[i + 5]);
            const y = parseFloat(tokens[i + 6]);
            i += 7;
            if (isNaN(rx) || isNaN(ry) || isNaN(x) || isNaN(y)) break;
            if (cmd === 'a') {
              curX += x;
              curY += y;
            } else {
              curX = x;
              curY = y;
            }
            currentTokens.push(`A ${rx} ${ry} ${rot} ${la} ${sw} ${curX.toFixed(4)} ${curY.toFixed(4)}`);
          }
        }
      } else {
        i++;
      }
    }

    if (currentTokens.length > 0) {
      subpaths.push(currentTokens.join(' '));
    }
    return subpaths.length > 0 ? subpaths : [d];
  }

  decomposeCompoundPaths(svg) {
    const paths = Array.from(svg.querySelectorAll('path')).filter(p => !p.closest('defs') && !p.closest('symbol'));
    paths.forEach(pathEl => {
      const d = pathEl.getAttribute('d');
      if (!d) return;
      const subpaths = this.splitSubpaths(d);
      if (subpaths.length <= 1) return;

      const parent = pathEl.parentNode;
      if (!parent) return;

      const frag = document.createDocumentFragment();
      subpaths.forEach(subD => {
        const newPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        for (let i = 0; i < pathEl.attributes.length; i++) {
          const attr = pathEl.attributes[i];
          if (attr.name !== 'd') {
            newPath.setAttribute(attr.name, attr.value);
          }
        }
        newPath.setAttribute('d', subD);
        frag.appendChild(newPath);
      });

      parent.replaceChild(frag, pathEl);
    });
  }

  resolveUseElements(svg) {
    resolveUseElements(svg);
  }

  setupPlot(container, item, options = {}) {
    if (this.activeContainer && this.activeContainer !== container) {
      this.stopPlotterAnimation();
    }

    this.activeContainer = container;
    this.activeCard = container.classList.contains('svg-card') ? container : null;
    this.activeItem = item;
    this.isLoop = !!options.loop;

    const svg = container.querySelector('svg');
    if (!svg) {
      this.activeContainer = null;
      this.activeCard = null;
      this.activeItem = null;
      return false;
    }

    this.activeSvg = svg;
    this.originalSvgHTML = item.content || svg.outerHTML;

    // Resolve any <use> instances into inline graphic elements
    this.resolveUseElements(svg);

    // Decompose compound multi-subpath paths into individual <path> elements
    // so a simulation plotter pen draws each subpath sequentially instead of all at the same time
    this.decomposeCompoundPaths(svg);

    this.animElements = Array.from(svg.querySelectorAll('path, polygon, polyline, circle, rect, ellipse, line'))
      .filter(el => !el.closest('defs') && !el.closest('symbol'));

    if (this.animElements.length === 0) {
      this.activeContainer = null;
      this.activeCard = null;
      this.activeItem = null;
      return false;
    }

    this.scale = this.computeScale(svg);
    const pinWidth = this.getPinStrokeWidth(svg);
    const neonStartIndex = Math.floor(Math.random() * NEON_PALETTE.length);

    let cum = 0;
    this.animElements.forEach((el, i) => {
      const len = this.getElementLength(el);
      const dashLen = Math.ceil(len * 1.02) + 2;
      const neon = NEON_PALETTE[(neonStartIndex + i) % NEON_PALETTE.length];

      el._plotLen = dashLen;
      el._cumStart = cum;
      cum += dashLen;
      el._cumEnd = cum;
      el._neon = neon;
      el._pinWidth = pinWidth;
      el._drawState = 'hidden';
    });

    this.totalLength = Math.max(1, cum);
    this.visualLength = this.totalLength / this.scale;
    this.applyPlotStyles();
    this.isRestored = false;
    return true;
  }

  setupCardPlot(card, item) {
    return this.setupPlot(card, item, { loop: false });
  }

  startFullscreenLoop(container, item) {
    this.stopPlotterAnimation();
    if (!this.setupPlot(container, item, { loop: true })) return;
    this.setProgress(0, false);
    this.play();
  }

  applyPlotStyles() {
    this.animElements.forEach(el => {
      el.classList.remove('drawing-active-stroke');
      el.style.transition = 'none';
      el.style.fill = 'transparent';
      el.style.fillOpacity = '0';
      el.style.stroke = el._neon.stroke;
      el.style.strokeWidth = el._pinWidth;
      el.style.strokeLinecap = 'round';
      el.style.strokeLinejoin = 'round';
      el.style.setProperty('--active-neon-stroke', el._neon.stroke);
      el.style.setProperty('--active-neon-glow', el._neon.glow);
      el.style.strokeDasharray = `${el._plotLen} ${el._plotLen}`;
      el.style.strokeDashoffset = `${el._plotLen}`;
      el.style.visibility = 'hidden';
      el._drawState = 'hidden';
    });
    this.isRestored = false;
  }

  restoreOriginalAttributes() {
    if (this.isRestored) return;
    if (this.activeSvg && this.originalSvgHTML) {
      const parent = this.activeSvg.parentNode;
      if (parent) {
        const temp = document.createElement('div');
        temp.innerHTML = this.originalSvgHTML;
        const restoredSvg = temp.firstElementChild;
        if (restoredSvg) {
          parent.replaceChild(restoredSvg, this.activeSvg);
          this.activeSvg = restoredSvg;
        }
      }
    }
    this.isRestored = true;
  }

  setProgress(progress, updateSlider = true) {
    progress = Math.max(0, Math.min(1, progress));
    this.currentProgress = progress;

    if (updateSlider && this.activeCard) {
      const slider = this.activeCard.querySelector('.plot-draw-slider');
      const pctLabel = this.activeCard.querySelector('.plot-slider-pct');
      const pct = progress * 100;
      if (slider) {
        slider.value = pct.toFixed(1);
        slider.style.setProperty('--slider-pct', `${pct}%`);
      }
      if (pctLabel) {
        pctLabel.textContent = `${Math.round(pct)}%`;
      }
    }

    // When progress reaches 1.0 (100%), restore authentic original SVG state
    if (progress >= 1.0) {
      this.restoreOriginalAttributes();
      return;
    }

    // If progress is less than 1.0, ensure stroke styles are active
    if (this.isRestored) {
      this.setupPlot(this.activeContainer, this.activeItem, { loop: this.isLoop });
    }

    const targetDist = progress * this.totalLength;

    for (let i = 0; i < this.animElements.length; i++) {
      const el = this.animElements[i];
      const start = el._cumStart;
      const end = el._cumEnd;
      const len = el._plotLen;

      if (targetDist <= start) {
        // Element not reached yet
        if (el._drawState !== 'hidden') {
          el.style.visibility = 'hidden';
          el.style.strokeDashoffset = `${len}`;
          el.classList.remove('drawing-active-stroke');
          el._drawState = 'hidden';
        }
      } else if (targetDist >= end) {
        // Element fully drawn
        if (el._drawState !== 'done') {
          el.style.visibility = 'visible';
          el.style.strokeDashoffset = '0';
          el.classList.remove('drawing-active-stroke');
          el._drawState = 'done';
        }
      } else {
        // Element actively being drawn by simulation plotter
        const drawn = targetDist - start;
        const offset = Math.max(0, len - drawn);
        el.style.visibility = 'visible';
        el.style.strokeDashoffset = `${offset.toFixed(1)}`;
        if (el._drawState !== 'drawing') {
          el.classList.add('drawing-active-stroke');
          el._drawState = 'drawing';
        }
      }
    }
  }

  scrubCardPlot(card, item, progress) {
    if (this.activeCard !== card || this.isRestored) {
      if (!this.setupCardPlot(card, item)) return;
    }

    if (this.isPlotting) {
      this.pause();
    }

    this.setProgress(progress, false);
  }

  toggleCardPlot(card, item) {
    // If clicking on currently playing card -> pause it
    if (this.isPlotting && this.activeCard === card) {
      this.pause();
      this.app.triggerHaptic();
      return;
    }

    // If another card was active, stop that card
    if (this.activeCard && this.activeCard !== card) {
      this.stopPlotterAnimation();
    }

    // If this card is not yet prepared or was at 100%
    if (this.activeCard !== card || this.isRestored || this.currentProgress >= 1.0) {
      if (!this.setupCardPlot(card, item)) return;
      this.setProgress(0, true);
    }

    this.play();
    this.app.triggerHaptic();
  }

  getDurationMs() {
    // Calibrated physical drawing feed rate in screen pixels per second.
    // Represents the physical speed of the pen plotter head across the drawing canvas.
    const feedRate = 1200; // visual screen px / second at 1x speed
    const visLen = this.visualLength || (this.totalLength / (this.scale || 1));

    let baseSec;
    if (visLen <= 8000) {
      baseSec = visLen / feedRate;
    } else {
      // Soft sub-linear scaling for massive CAD/CNC drawings with tens of thousands of points
      const extra = visLen - 8000;
      baseSec = (8000 + Math.pow(extra, 0.82) * 4.5) / feedRate;
    }

    // Minimum 1.0s so very simple paths are clearly visible
    const clampedSec = Math.max(1.0, baseSec);
    return (clampedSec * 1000) / this.animSpeed;
  }

  play() {
    if (!this.activeContainer) return;
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }

    this.isPlotting = true;
    if (this.activeCard) {
      this.activeCard.classList.add('is-plotting');
      const playBtn = this.activeCard.querySelector('.btn-plot-play');
      if (playBtn) {
        playBtn.classList.add('is-playing');
        playBtn.setAttribute('title', 'Pause Draw');
        playBtn.setAttribute('aria-label', 'Pause animation');
      }
    }

    let lastTime = performance.now();

    const tick = (now) => {
      if (!this.isPlotting) return;

      const dt = Math.min(100, now - lastTime);
      lastTime = now;

      // Realistic plotter animation speed dynamically computed from path length
      const totalDurationMs = this.getDurationMs();
      const deltaProgress = dt / totalDurationMs;
      const nextProgress = Math.min(1.0, this.currentProgress + deltaProgress);

      this.setProgress(nextProgress, true);

      if (nextProgress >= 1.0) {
        this.onPlotterFinished();
      } else {
        this.rafId = requestAnimationFrame(tick);
      }
    };

    this.rafId = requestAnimationFrame(tick);
  }

  pause() {
    this.isPlotting = false;
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    if (this.loopTimer) {
      clearTimeout(this.loopTimer);
      this.loopTimer = null;
    }

    if (this.activeCard) {
      this.activeCard.classList.remove('is-plotting');
      const playBtn = this.activeCard.querySelector('.btn-plot-play');
      if (playBtn) {
        playBtn.classList.remove('is-playing');
        playBtn.setAttribute('title', 'Play Draw Animation');
        playBtn.setAttribute('aria-label', 'Play animation');
      }
    }
  }

  stopPlotterAnimation() {
    this.pause();
    if (this.loopTimer) {
      clearTimeout(this.loopTimer);
      this.loopTimer = null;
    }
    this.isLoop = false;
    this.restoreOriginalAttributes();

    if (this.activeCard) {
      const slider = this.activeCard.querySelector('.plot-draw-slider');
      const pctLabel = this.activeCard.querySelector('.plot-slider-pct');
      if (slider) {
        slider.value = 0;
        slider.style.setProperty('--slider-pct', '0%');
      }
      if (pctLabel) {
        pctLabel.textContent = '0%';
      }
    }

    this.activeContainer = null;
    this.activeCard = null;
    this.activeItem = null;
    this.activeSvg = null;
    this.originalSvgHTML = null;
    this.animElements = [];
    this.currentProgress = 0;
    this.totalLength = 0;
    this.visualLength = 0;
    this.scale = 1.0;
  }

  onPlotterFinished() {
    this.pause();
    this.currentProgress = 1.0;
    this.setProgress(1.0, true);
    this.app.triggerHaptic();

    if (this.isLoop && this.activeContainer) {
      this.loopTimer = setTimeout(() => {
        if (!this.isLoop || !this.activeContainer) return;
        if (!this.setupPlot(this.activeContainer, this.activeItem, { loop: true })) return;
        this.setProgress(0, false);
        this.play();
      }, 1000);
    }
  }
}
