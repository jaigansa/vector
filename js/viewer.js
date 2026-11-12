/**
 * Interactive SVG Vector Artwork Plotter Simulation Engine
 * Synchronized with interactive draw scrubber slider and automatic stroke animation.
 */

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
    this.animSpeed = 1.0;
    this.isPlotting = false;
    this.animElements = [];
    this.totalLength = 0;
    this.currentProgress = 0;
    this.rafId = null;
    this.isRestored = true;
  }

  getPinStrokeWidth(svg) {
    let vbWidth = 800;
    const vb = svg?.getAttribute('viewBox');
    if (vb) {
      const parts = vb.trim().split(/[\s,]+/).map(Number);
      if (parts.length === 4 && parts[2] > 0) {
        vbWidth = parts[2];
      }
    } else {
      const w = parseFloat(svg?.getAttribute('width'));
      if (w > 0) vbWidth = w;
    }
    const rect = svg?.getBoundingClientRect();
    const screenPixelWidth = rect?.width > 0 ? rect.width : 300;
    const scale = vbWidth / screenPixelWidth;

    const screenWidth = window.innerWidth || 800;
    const targetPx = screenWidth <= 480 ? 1.0 : (screenWidth <= 768 ? 1.2 : 1.4);

    return `${(targetPx * scale).toFixed(3)}px`;
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
      }
    } catch {}
    return 600;
  }

  setupCardPlot(card, item) {
    if (this.activeCard && this.activeCard !== card) {
      this.stopPlotterAnimation();
    }

    this.activeCard = card;
    this.activeItem = item;

    const svg = card.querySelector('.svg-card-preview svg');
    if (!svg) return false;

    this.activeSvg = svg;
    this.originalSvgHTML = item.content || svg.outerHTML;

    this.animElements = Array.from(svg.querySelectorAll('path, polygon, polyline, circle, rect, ellipse, line'))
      .filter(el => !el.closest('defs'));

    if (this.animElements.length === 0) return false;

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
    });

    this.totalLength = Math.max(1, cum);
    this.applyPlotStyles();
    this.isRestored = false;
    return true;
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
      this.setupCardPlot(this.activeCard, this.activeItem);
    }

    const targetDist = progress * this.totalLength;

    for (let i = 0; i < this.animElements.length; i++) {
      const el = this.animElements[i];
      const start = el._cumStart;
      const end = el._cumEnd;
      const len = el._plotLen;

      if (targetDist <= start) {
        // Element not reached yet
        el.style.visibility = 'hidden';
        el.style.strokeDashoffset = `${len}`;
        el.classList.remove('drawing-active-stroke');
      } else if (targetDist >= end) {
        // Element fully drawn
        el.style.visibility = 'visible';
        el.style.strokeDashoffset = '0';
        el.classList.remove('drawing-active-stroke');
      } else {
        // Element actively being drawn
        const drawn = targetDist - start;
        const offset = Math.max(0, len - drawn);
        el.style.visibility = 'visible';
        el.style.strokeDashoffset = `${offset.toFixed(1)}`;
        el.classList.add('drawing-active-stroke');
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
      this.app.showToast('Plot paused');
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
    this.app.showToast(`Plotting ${item.displayName}...`);
  }

  play() {
    if (!this.activeCard) return;

    this.isPlotting = true;
    this.activeCard.classList.add('is-plotting');

    const playBtn = this.activeCard.querySelector('.btn-plot-play');
    if (playBtn) {
      playBtn.classList.add('is-playing');
      playBtn.setAttribute('title', 'Pause Draw');
      playBtn.setAttribute('aria-label', 'Pause animation');
    }

    // Animation duration based on path length, adjusted by speed
    const totalDurationMs = Math.max(2200, Math.min(5000, this.totalLength * 1.6)) / this.animSpeed;
    let lastTime = performance.now();

    const tick = (now) => {
      if (!this.isPlotting) return;

      const dt = now - lastTime;
      lastTime = now;

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

    this.activeCard = null;
    this.activeItem = null;
    this.activeSvg = null;
    this.originalSvgHTML = null;
    this.animElements = [];
    this.currentProgress = 0;
    this.totalLength = 0;
  }

  onPlotterFinished() {
    this.pause();
    this.currentProgress = 1.0;
    this.setProgress(1.0, true);
    this.app.triggerHaptic();
    this.app.showToast('Plot drawing complete!');
  }
}
