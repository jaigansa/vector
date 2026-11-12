/**
 * Interactive SVG Vector Artwork Plotter Simulation Engine
 * Performs mechanical stroke-by-stroke draw animation followed by sequential color fill bloom.
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
    this.animSpeed = 1.0;
    this.isPlotting = false;
    this.animPhase = 0; // 0=idle, 1=plotting strokes, 2=color bloom, 3=complete
    this.animStep = 0;
    this.animElements = [];
    this.animOriginalData = [];
    this.currentTimer = null;
  }

  setSpeed(speedVal) {
    this.animSpeed = speedVal;
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

    // Pin line width: ~1.0px on small mobile, ~1.2px on tablets, ~1.4px on desktop
    const screenWidth = window.innerWidth || 800;
    const targetPx = screenWidth <= 480 ? 1.0 : (screenWidth <= 768 ? 1.2 : 1.4);

    return `${(targetPx * scale).toFixed(3)}px`;
  }

  restoreOriginalAttributes() {
    if (this.animOriginalData?.length > 0) {
      this.animOriginalData.forEach(d => {
        if (d.origStyle) {
          d.el.setAttribute('style', d.origStyle);
        } else {
          d.el.removeAttribute('style');
        }
        if (d.origFill) d.el.setAttribute('fill', d.origFill);
        if (d.origFillOpacity) d.el.setAttribute('fill-opacity', d.origFillOpacity);
        if (d.origStroke) d.el.setAttribute('stroke', d.origStroke);
        if (d.origStrokeWidth) d.el.setAttribute('stroke-width', d.origStrokeWidth);
        if (d.origStrokeLinecap) {
          d.el.setAttribute('stroke-linecap', d.origStrokeLinecap);
        } else {
          d.el.removeAttribute('stroke-linecap');
        }
        if (d.origStrokeLinejoin) {
          d.el.setAttribute('stroke-linejoin', d.origStrokeLinejoin);
        } else {
          d.el.removeAttribute('stroke-linejoin');
        }
        d.el.style.removeProperty('--active-neon-stroke');
        d.el.style.removeProperty('--active-neon-glow');
        d.el.classList.remove('drawing-active-stroke');
      });
    }
  }

  stopPlotterAnimation() {
    if (this.currentTimer) {
      clearTimeout(this.currentTimer);
      this.currentTimer = null;
    }

    this.restoreOriginalAttributes();

    if (this.activeCard) {
      this.activeCard.classList.remove('is-plotting');
      const plotBtn = this.activeCard.querySelector('.btn-plot-action span');
      if (plotBtn) plotBtn.textContent = 'Plot';
    }

    this.isPlotting = false;
    this.animPhase = 0;
    this.animStep = 0;
    this.activeCard = null;
    this.activeItem = null;
  }

  toggleCardPlot(card, item) {
    // If clicking on the currently plotting card -> stop animation
    if (this.isPlotting && this.activeCard === card) {
      this.stopPlotterAnimation();
      this.app.triggerHaptic();
      this.app.showToast('Plotter stopped');
      return;
    }

    // If another card was plotting, stop it first
    if (this.isPlotting) {
      this.stopPlotterAnimation();
    }

    this.activeCard = card;
    this.activeItem = item;

    const svg = card.querySelector('.svg-card-preview svg');
    if (!svg) return;

    this.animElements = Array.from(svg.querySelectorAll('path, polygon, polyline, circle, rect, ellipse, line'))
      .filter(el => !el.closest('defs'));

    if (this.animElements.length === 0) return;

    this.animOriginalData = this.animElements.map(el => ({
      el,
      origFill: el.getAttribute('fill') || '',
      origFillOpacity: el.getAttribute('fill-opacity') || '',
      origStroke: el.getAttribute('stroke') || '',
      origStrokeWidth: el.getAttribute('stroke-width') || '',
      origStrokeLinecap: el.getAttribute('stroke-linecap') || '',
      origStrokeLinejoin: el.getAttribute('stroke-linejoin') || '',
      origStyle: el.getAttribute('style') || ''
    }));

    const pinWidth = this.getPinStrokeWidth(svg);
    const neonStartIndex = Math.floor(Math.random() * NEON_PALETTE.length);

    // Setup initial state: pin line stroke width, random neon colors, rounded caps & joins
    this.animElements.forEach((el, i) => {
      let len = 600;
      try {
        if (typeof el.getTotalLength === 'function') {
          const l = el.getTotalLength();
          if (!isNaN(l) && l > 0) len = Math.ceil(l);
        } else {
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
            if (polyLen > 0) len = Math.ceil(polyLen);
          } else if (tag === 'rect') {
            const w = parseFloat(el.getAttribute('width')) || 100;
            const h = parseFloat(el.getAttribute('height')) || 100;
            len = Math.ceil(2 * (w + h));
          } else if (tag === 'circle') {
            const r = parseFloat(el.getAttribute('r')) || 50;
            len = Math.ceil(2 * Math.PI * r);
          } else if (tag === 'ellipse') {
            const rx = parseFloat(el.getAttribute('rx')) || 50;
            const ry = parseFloat(el.getAttribute('ry')) || 50;
            len = Math.ceil(2 * Math.PI * Math.sqrt((rx * rx + ry * ry) / 2));
          } else if (tag === 'line') {
            const x1 = parseFloat(el.getAttribute('x1')) || 0;
            const y1 = parseFloat(el.getAttribute('y1')) || 0;
            const x2 = parseFloat(el.getAttribute('x2')) || 0;
            const y2 = parseFloat(el.getAttribute('y2')) || 0;
            len = Math.ceil(Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2));
          }
        }
      } catch {}

      // Add a slight 2% + 2px buffer to guarantee 100% path coverage
      const dashLen = Math.ceil(len * 1.02) + 2;

      // Assign contrasting random neon color
      const neon = NEON_PALETTE[(neonStartIndex + i) % NEON_PALETTE.length];

      el.classList.remove('drawing-active-stroke');
      el.style.transition = 'none';
      el.style.fill = 'transparent';
      el.style.fillOpacity = '0';
      el.style.stroke = neon.stroke;
      el.style.strokeWidth = pinWidth;
      el.style.strokeLinecap = 'round';
      el.style.strokeLinejoin = 'round';
      el.style.setProperty('--active-neon-stroke', neon.stroke);
      el.style.setProperty('--active-neon-glow', neon.glow);
      el.style.strokeDasharray = `${dashLen} ${dashLen}`;
      el.style.strokeDashoffset = `${dashLen}`;
      el.style.visibility = 'hidden';
      el._plotLen = dashLen;
    });

    this.animStep = 0;
    this.animPhase = 1; // Phase 1: Mechanical Plotter Stroke Drawing
    this.isPlotting = true;

    this.activeCard.classList.add('is-plotting');
    const plotBtn = this.activeCard.querySelector('.btn-plot-action span');
    if (plotBtn) plotBtn.textContent = 'Stop';

    this.app.triggerHaptic();
    this.app.showToast(`Plotting ${item.displayName}...`);

    this.runPlotterStep();
  }

  runPlotterStep() {
    if (!this.isPlotting || !this.activeCard) return;

    const total = this.animElements.length;
    if (total === 0) return;

    if (this.animPhase === 1) {
      // Phase 1: Mechanical Plotter Drawing path by path
      const i = this.animStep;
      if (i < total) {
        const el = this.animElements[i];
        const len = el._plotLen || 600;

        if (i > 0 && this.animElements[i - 1]) {
          this.animElements[i - 1].classList.remove('drawing-active-stroke');
        }

        el.classList.add('drawing-active-stroke');
        el.style.visibility = 'visible';

        const rapidDelay = Math.round(Math.min(100, Math.max(30, 75 / this.animSpeed)));

        this.currentTimer = setTimeout(() => {
          if (!this.isPlotting) return;

          const baseDuration = Math.min(1.4, Math.max(0.4, (len / 600) * 0.9));
          const durationSec = baseDuration / this.animSpeed;
          const durationMs = durationSec * 1000;

          el.style.transition = `stroke-dashoffset ${durationSec}s cubic-bezier(0.25, 0.1, 0.25, 1)`;
          el.style.strokeDashoffset = '0';

          if (i % 2 === 0) this.app.triggerHaptic();

          this.animStep++;
          const settleDelay = Math.round(60 / this.animSpeed);
          this.currentTimer = setTimeout(() => {
            if (!this.isPlotting) return;
            // Once this path's draw animation finishes, remove dasharray so the stroke is 100% complete and fully closed
            el.style.transition = 'none';
            el.style.strokeDasharray = 'none';
            el.style.strokeDashoffset = 'none';
            this.runPlotterStep();
          }, Math.round(durationMs + settleDelay));
        }, rapidDelay);

      } else {
        // Phase 1 Complete: All paths drawn! Transition to Phase 2 (Color Fill Bloom)
        this.animElements.forEach(el => {
          el.classList.remove('drawing-active-stroke');
          el.style.strokeDasharray = 'none';
          el.style.strokeDashoffset = 'none';
        });
        this.animPhase = 2;
        this.animStep = 0;

        const plotBtn = this.activeCard?.querySelector('.btn-plot-action span');
        if (plotBtn) plotBtn.textContent = 'Coloring...';

        this.app.triggerHaptic();

        const pauseDuration = Math.round(300 / this.animSpeed);
        this.currentTimer = setTimeout(() => this.runPlotterStep(), pauseDuration);
      }
    } else if (this.animPhase === 2) {
      // Phase 2: Sequential Color Fill Blooming
      const i = this.animStep;
      if (i < total) {
        const el = this.animElements[i];
        const orig = this.animOriginalData[i];
        const fillDur = Math.max(0.3, Math.min(0.7, 2.0 / Math.sqrt(total))) / this.animSpeed;

        el.style.transition = `fill-opacity ${fillDur}s ease-in-out, stroke ${fillDur}s ease-in-out, stroke-width ${fillDur}s ease-in-out`;

        if (orig.origFill) {
          el.setAttribute('fill', orig.origFill);
          el.style.fill = '';
        } else {
          el.style.fill = '';
        }

        if (orig.origFillOpacity) {
          el.setAttribute('fill-opacity', orig.origFillOpacity);
          el.style.fillOpacity = orig.origFillOpacity;
        } else {
          el.style.fillOpacity = '1';
        }

        if (!orig.origStroke || orig.origStroke === 'none') {
          el.style.stroke = 'transparent';
          el.style.strokeWidth = '0px';
        } else {
          el.style.stroke = orig.origStroke;
          el.style.strokeWidth = orig.origStrokeWidth || '1px';
          el.style.strokeLinecap = orig.origStrokeLinecap || 'round';
          el.style.strokeLinejoin = orig.origStrokeLinejoin || 'round';
        }

        if (i % 2 === 0) this.app.triggerHaptic();

        this.animStep++;
        const stepDelay = Math.max(80, Math.round(fillDur * 0.7 * 1000));
        this.currentTimer = setTimeout(() => this.runPlotterStep(), stepDelay);
      } else {
        // All Complete!
        this.onPlotterFinished();
      }
    }
  }

  onPlotterFinished() {
    this.animPhase = 3;
    this.isPlotting = false;

    this.restoreOriginalAttributes();

    if (this.activeCard) {
      this.activeCard.classList.remove('is-plotting');
      const plotBtn = this.activeCard.querySelector('.btn-plot-action span');
      if (plotBtn) plotBtn.textContent = 'Replay';
    }

    this.app.triggerHaptic();
    this.app.showToast('Plot drawing complete!');
  }
}
