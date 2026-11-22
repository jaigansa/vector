/**
 * Main Application Controller for Vector SVG Artwork Gallery
 */

class App {
  constructor() {
    this.library = new SVGLibrary();
    this.viewer = null;
    this.activeCategory = 'All Artworks';
    this.searchQuery = '';
    this.filteredItems = [];
    this.currentPage = 1;
    this.itemsPerPage = 40;

    this.init();
  }

  async init() {
    // Initialize viewer
    this.viewer = new SVGViewer(this);

    // Init UI Elements
    this.grid = document.getElementById('svg-grid');
    this.emptyState = document.getElementById('empty-state');
    this.searchInput = document.getElementById('search-input');
    this.searchClearBtn = document.getElementById('search-clear-btn');
    this.fullscreenOverlay = document.getElementById('fullscreen-overlay');
    this.fullscreenSvgContainer = document.getElementById('fullscreen-svg-container');

    // Click anywhere on fullscreen overlay exits fullscreen
    this.fullscreenOverlay?.addEventListener('click', () => {
      this.closeFullscreen();
    });

    // Escape key exits fullscreen
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.fullscreenOverlay && this.fullscreenOverlay.style.display === 'flex') {
        this.closeFullscreen();
      }
    });

    // Info / Details Modal
    this.infoModal = document.getElementById('info-modal');
    this.infoModalContent = document.getElementById('info-modal-content');
    this.infoModalCloseBtn = document.getElementById('info-modal-close');

    this.infoModalCloseBtn?.addEventListener('click', () => {
      this.closeInfoModal();
    });

    this.infoModal?.addEventListener('click', (e) => {
      if (e.target === this.infoModal) {
        this.closeInfoModal();
      }
    });

    // Escape key exits info modal
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.infoModal && this.infoModal.style.display === 'flex') {
        this.closeInfoModal();
      }
    });

    // 3-Grid Gallery Mode Toggle (1:1 preview only)
    this.gridModeBtn = document.getElementById('grid-mode-btn');
    this.isGalleryMode = localStorage.getItem('vector_gallery_mode') === 'true';
    if (this.isGalleryMode) {
      this.grid?.classList.add('gallery-mode');
      this.gridModeBtn?.classList.add('active');
      this.gridModeBtn?.setAttribute('aria-pressed', 'true');
    }

    this.gridModeBtn?.addEventListener('click', () => {
      this.toggleGalleryMode();
    });

    this.bindEvents();
    this.cleanupServiceWorker();
    window.lucide.createIcons();

    // Load SVG items & render dynamic category dropdown in searchbar
    await this.library.load();
    this.renderCategoryDropdown();
    this.filterAndRender();
  }

  getCategoryIcon(cat) {
    const iconNames = {
      'All Artworks': 'grid-3x3',
      'Tech & Software': 'code',
      'Business & Marketing': 'briefcase',
      'Engineering & CAD': 'layers',
      'Nature & Scenery': 'mountain',
      'Abstract & 3D': 'package',
      'Art & Creative': 'palette',
      'Sprite Test': 'grid-2x2',
      'Sprites': 'grid-2x2',
    };
    return iconNames[cat] || 'search';
  }

  renderCategoryDropdown() {
    const menu = document.getElementById('category-dropdown-menu');
    if (!menu) return;

    let subCategories = [];
    if (this.library.discoveredCategories && this.library.discoveredCategories.length > 0) {
      subCategories = this.library.discoveredCategories.map(c => c.name);
    } else {
      subCategories = Array.from(new Set(this.library.items.map(item => item.category))).filter(Boolean);
    }

    const allCategories = ['All Artworks', ...subCategories];

    // Calculate count per category
    const counts = {};
    counts['All Artworks'] = this.library.items.length;
    subCategories.forEach(cat => {
      counts[cat] = this.library.items.filter(i => i.category === cat).length;
    });

    menu.innerHTML = allCategories.map(cat => {
      const isActive = this.activeCategory === cat;
      const count = counts[cat] ?? 0;

      return `
        <div class="category-dropdown-item ${isActive ? 'active' : ''}" data-filter="${cat}" role="option">
          <span class="dropdown-item-text">${cat}</span>
          <span class="dropdown-item-count">${count}</span>
        </div>
      `;
    }).join('');

    menu.querySelectorAll('.category-dropdown-item').forEach(item => {
      item.addEventListener('click', (e) => {
        e.stopPropagation();
        const cat = item.dataset.filter;
        this.selectCategory(cat);
      });
    });

    this.updateDropdownButton();
    window.lucide.createIcons();
  }

  updateDropdownButton() {
    const labelEl = document.getElementById('category-current-label');
    if (labelEl) labelEl.textContent = this.activeCategory;
  }

  selectCategory(category) {
    this.activeCategory = category;
    this.triggerHaptic();
    this.updateDropdownButton();

    // Close dropdown menu
    const menu = document.getElementById('category-dropdown-menu');
    const btn = document.getElementById('category-dropdown-btn');
    menu?.classList.remove('open');
    btn?.classList.remove('open');
    btn?.setAttribute('aria-expanded', 'false');

    // Update active highlight in menu
    menu?.querySelectorAll('.category-dropdown-item').forEach(el => {
      el.classList.toggle('active', el.dataset.filter === category);
    });

    this.filterAndRender();
  }

  bindEvents() {
    // Category Dropdown Toggle Button
    const dropdownBtn = document.getElementById('category-dropdown-btn');
    const dropdownMenu = document.getElementById('category-dropdown-menu');

    dropdownBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      const isOpen = dropdownMenu.classList.toggle('open');
      dropdownBtn.classList.toggle('open', isOpen);
      dropdownBtn.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
    });

    // Close dropdown on click outside
    document.addEventListener('click', (e) => {
      const wrapper = document.getElementById('category-dropdown-wrapper');
      if (wrapper && !wrapper.contains(e.target)) {
        dropdownMenu?.classList.remove('open');
        dropdownBtn?.classList.remove('open');
        dropdownBtn?.setAttribute('aria-expanded', 'false');
      }
      if (!e.target.closest('.card-menu-wrapper')) {
        this.closeAllCardMenus();
      }
    });

    // Close dropdown on Escape key
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        dropdownMenu?.classList.remove('open');
        dropdownBtn?.classList.remove('open');
        dropdownBtn?.setAttribute('aria-expanded', 'false');
        this.closeAllCardMenus();
      }
    });

    // Search input
    this.searchInput?.addEventListener('input', (e) => {
      this.searchQuery = e.target.value.trim().toLowerCase();
      this.searchClearBtn.classList.toggle('visible', !!this.searchQuery);
      this.filterAndRender();
    });

    this.searchClearBtn?.addEventListener('click', () => {
      this.searchInput.value = '';
      this.searchQuery = '';
      this.searchClearBtn.classList.remove('visible');
      this.filterAndRender();
      this.searchInput.focus();
    });
  }

  closeAllCardMenus() {
    document.querySelectorAll('.card-actions-dropdown.show').forEach(d => {
      d.classList.remove('show');
      d.closest('.svg-card')?.classList.remove('menu-open');
      const trigger = d.previousElementSibling;
      trigger?.setAttribute('aria-expanded', 'false');
      trigger?.classList.remove('active');
    });
  }

  openFullscreen(item) {
    if (!this.fullscreenOverlay || !this.fullscreenSvgContainer) return;
    this.closeAllCardMenus();
    this.fullscreenSvgContainer.innerHTML = item.content;
    this.fullscreenOverlay.style.display = 'flex';
    document.body.style.overflow = 'hidden';

    // Auto-play plotter drawing animation on continuous loop
    this.viewer.startFullscreenLoop(this.fullscreenSvgContainer, item);

    if (document.documentElement.requestFullscreen && !document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    }
  }

  closeFullscreen() {
    if (!this.fullscreenOverlay || !this.fullscreenSvgContainer) return;
    // Stop any active fullscreen loop animation
    this.viewer.stopPlotterAnimation();

    this.fullscreenOverlay.style.display = 'none';
    this.fullscreenSvgContainer.innerHTML = '';
    document.body.style.overflow = '';
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    }
  }

  parseLicenseMetadata(item) {
    const content = item.content || '';
    const doc = new DOMParser().parseFromString(content, 'image/svg+xml');
    const root = doc.querySelector('svg');

    // --- License extraction ---
    let license = 'Public Domain';
    let licenseTitle = 'Creative Commons (CC0)';
    let licenseDesc = 'Free for personal and commercial use. No attribution required.';
    let licenseBadge = 'Public Domain';
    let badgeColor = '#b45309';

    // Check <metadata> for Creative Commons / rights info
    const metadataEl = doc.querySelector('metadata');
    if (metadataEl) {
      const metadataText = metadataEl.textContent || metadataEl.innerHTML || '';
      const ccMatch = metadataText.match(/(creative\s+commons[^<]*)/i);
      const cc0Match = metadataText.match(/cc0/i);
      const pdMatch = metadataText.match(/public\s+domain/i);
      if (cc0Match || pdMatch) {
        licenseTitle = 'Creative Commons (CC0)';
        license = 'Public Domain';
        licenseDesc = 'Free for personal and commercial use. No attribution required.';
        licenseBadge = 'Public Domain';
        badgeColor = '#b45309';
      } else if (ccMatch) {
        licenseTitle = ccMatch[1].trim();
        licenseBadge = 'Licensed';
        badgeColor = '#2563eb';
      }
    }

    // Check <license> element
    const licenseEl = doc.querySelector('license');
    if (licenseEl) {
      const licText = licenseEl.textContent?.trim() || '';
      if (licText) licenseTitle = licText;
      licenseBadge = licenseEl.getAttribute('href') ? 'Licensed' : 'Public Domain';
    }

    // Check root svg attributes
    const svgLicense = root?.getAttribute('license');
    if (svgLicense) licenseTitle = svgLicense;

    // Check <title> / <desc> for hints
    const titleEl = doc.querySelector('title');
    const descEl = doc.querySelector('desc');
    const titleText = titleEl?.textContent?.trim() || '';
    const descText = descEl?.textContent?.trim() || '';

    // --- Specifications ---
    const sizeKB = (item.sizeBytes / 1024).toFixed(2);
    const sizeMB = (sizeKB / 1024).toFixed(2);
    const sizeDisplay = parseFloat(sizeMB) >= 1 ? `${sizeMB} MB` : `${sizeKB} KB`;

    const spriteText = item.isSprite ? 'Yes (symbol: ' + (item.symbolId || '-') + ')' : 'No';

    const specs = [
      { label: 'Title', value: item.displayName || 'Untitled', gold: false },
      { label: 'Category', value: item.category || 'General', gold: false },
      { label: 'SVG ID', value: item.id || '-', gold: false },
      { label: 'ViewBox', value: item.viewBox || '-', gold: false },
      { label: 'Width', value: item.width ? `${item.width} px` : '-', gold: false },
      { label: 'Height', value: item.height ? `${item.height} px` : '-', gold: false },
      { label: 'Size', value: sizeDisplay, gold: false },
      { label: 'Sprite', value: spriteText, gold: false },
    ];

    return {
      license,
      licenseTitle,
      licenseDesc,
      licenseBadge,
      badgeColor,
      specs,
      titleText,
      descText,
    };
  }

  openInfoModal(item) {
    if (!this.infoModal || !this.infoModalContent) return;

    const { licenseTitle, licenseDesc, licenseBadge, badgeColor, specs, descText } = this.parseLicenseMetadata(item);

    const escHtml = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

    const licenseCard = `
      <div class="info-card">
        <p class="info-kicker">LICENSE</p>
        <div class="info-license-row">
          <div class="info-license-badge">
            <svg viewBox="0 0 24 24" width="22" height="22" data-lucide="creative-commons" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="10"/>
              <path d="M10 9.3a2.8 2.8 0 0 0-3.5 1 3.1 3.1 0 0 0 0 3.4 2.7 2.7 0 0 0 3.5 1"/>
              <path d="M17 9.3a2.8 2.8 0 0 0-3.5 1 3.1 3.1 0 0 0 0 3.4 2.7 2.7 0 0 0 3.5 1"/>
            </svg>
          </div>
          <div class="info-license-text">
            <h3 class="info-license-title">${escHtml(licenseTitle)}</h3>
            <p class="info-license-desc">${escHtml(licenseDesc)}</p>
          </div>
        </div>
      </div>
    `;

    const specRows = specs
      .map((s) => `
        <li class="info-spec-item">
          <span class="info-spec-label">${escHtml(s.label)}</span>
          <span class="info-spec-value${s.gold ? ' gold' : ''}">${escHtml(s.value)}</span>
        </li>
      `)
      .join('');

    let descriptionHtml = '';
    if (descText) {
      const escapedDesc = escHtml(descText);
      descriptionHtml = `
        <div class="info-desc-box">
          <span class="info-desc-label">Description</span>
          <p class="info-desc-content">${escapedDesc}</p>
        </div>`;
    }

    const specCard = `
      <div class="info-card">
        <p class="info-kicker">SPECIFICATIONS</p>
        <ul class="info-spec-list">${specRows}</ul>
        ${descriptionHtml}
      </div>
    `;

    this.infoModalContent.innerHTML = `
      <div class="info-card-group">
        ${licenseCard}
        ${specCard}
      </div>
    `;

    this.infoModal.style.display = 'flex';
    document.body.style.overflow = 'hidden';

    window.lucide.createIcons();
  }

  closeInfoModal() {
    if (!this.infoModal) return;
    this.infoModal.style.display = 'none';
    document.body.style.overflow = '';
    if (this.infoModalContent) this.infoModalContent.innerHTML = '';
  }

  toggleGalleryMode() {
    this.triggerHaptic();
    this.isGalleryMode = !this.isGalleryMode;
    if (this.isGalleryMode) {
      this.grid?.classList.add('gallery-mode');
      this.gridModeBtn?.classList.add('active');
      this.gridModeBtn?.setAttribute('aria-pressed', 'true');
    } else {
      this.grid?.classList.remove('gallery-mode');
      this.gridModeBtn?.classList.remove('active');
      this.gridModeBtn?.setAttribute('aria-pressed', 'false');
    }
    try {
      localStorage.setItem('vector_gallery_mode', String(this.isGalleryMode));
    } catch {}
  }

  filterAndRender() {
    if (this.viewer?.activeCard) {
      this.viewer.stopPlotterAnimation();
    }

    let items = [...this.library.items];

    // Filter by Category
    if (this.activeCategory !== 'All Artworks') {
      items = items.filter(item => item.category === this.activeCategory);
    }

    // Filter by Search
    if (this.searchQuery) {
      items = items.filter(item => {
        const titleMatch = (item.displayName || '').toLowerCase().includes(this.searchQuery);
        const catMatch = (item.category || '').toLowerCase().includes(this.searchQuery);
        const nameMatch = (item.name || '').toLowerCase().includes(this.searchQuery);
        const spriteMatch = !!(item.spriteFile && item.spriteFile.toLowerCase().includes(this.searchQuery));
        const symbolMatch = !!(item.symbolId && item.symbolId.toLowerCase().includes(this.searchQuery));
        return titleMatch || catMatch || nameMatch || spriteMatch || symbolMatch;
      });
    }

    this.filteredItems = items;
    this.currentPage = 1;
    this.renderGrid();
    this.renderPagination();
  }

  renderGrid() {
    if (this.filteredItems.length === 0) {
      this.grid.innerHTML = '';
      this.emptyState.style.display = 'flex';
      const emptyMsg = this.emptyState.querySelector('p');
      if (emptyMsg) {
        if (this.activeCategory !== 'All Artworks') {
          emptyMsg.textContent = `No SVGs found in "${this.activeCategory}". Add .svg files to its folder in svgs/ to see them here.`;
        } else {
          emptyMsg.textContent = 'No vector artworks found matching your search.';
        }
      }
      const paginationEl = document.getElementById('pagination');
      if (paginationEl) paginationEl.style.display = 'none';
      return;
    }

    this.emptyState.style.display = 'none';

    // Paginate items
    const start = (this.currentPage - 1) * this.itemsPerPage;
    const end = start + this.itemsPerPage;
    const pageItems = this.filteredItems.slice(start, end);

    this.grid.innerHTML = pageItems.map(item => {
      return `
        <div class="svg-card" data-id="${item.id}">
          <div class="svg-card-preview">
            ${item.content}
            <button class="btn-card-info" data-action="view-info" data-id="${item.id}" title="View details" aria-label="View artwork details">
              <svg viewBox="0 0 24 24" width="16" height="16" data-lucide="info" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></svg>
            </button>
            <button class="btn-preview-fullscreen" data-action="preview-fullscreen" data-id="${item.id}" title="View fullscreen" aria-label="Open fullscreen preview">
              <svg viewBox="0 0 24 24" width="13" height="13" data-lucide="maximize-2" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"></svg>
            </button>
          </div>
          <div class="svg-card-info">
            <div class="card-name-row">
              <span class="svg-card-name" title="${item.displayName}">${item.displayName}</span>
              ${item.isSprite ? `<span class="sprite-badge" title="Symbol from ${item.spriteFile || 'sprite'}">Sprite</span>` : ''}
            </div>
            <div class="card-bottom-actions">
              <button class="btn-card-action btn-plot-play" data-action="toggle-play" data-id="${item.id}" title="Play / Pause Draw Animation" aria-label="Play animation">
                <svg class="icon-play" viewBox="0 0 24 24" width="13" height="13" data-lucide="play" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></svg>
                <svg class="icon-pause" viewBox="0 0 24 24" width="13" height="13" data-lucide="pause" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></svg>
              </button>
              <button class="btn-card-action btn-plot-speed" data-action="toggle-speed" data-id="${item.id}" title="Plotter speed: ${this.viewer.getSpeedLabel()} (Click to cycle 0.1x / 0.2x / 0.3x / 0.4x / 0.5x / 1x)" aria-label="Change plot speed">
                <span class="speed-label">${this.viewer.getSpeedLabel()}</span>
              </button>
              <div class="plot-slider-wrapper">
                <input type="range" class="plot-draw-slider" min="0" max="100" value="0" step="0.5" data-id="${item.id}" title="Draw progression" aria-label="Draw progression slider" style="--slider-pct: 0%;">
                <span class="plot-slider-pct">0%</span>
              </div>
              <div class="card-menu-wrapper">
                <button class="btn-card-action btn-menu-trigger" data-action="toggle-menu" data-id="${item.id}" title="Download" aria-label="Download" aria-haspopup="true" aria-expanded="false">
                  <svg viewBox="0 0 24 24" width="15" height="15" data-lucide="download" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></svg>
                </button>
                <div class="card-actions-dropdown" role="menu">
                  <button class="card-dropdown-item" data-action="download-svg" data-id="${item.id}" role="menuitem">
                    <svg viewBox="0 0 24 24" width="14" height="14" data-lucide="download" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></svg>
                    <span>Download SVG</span>
                  </button>
                  <button class="card-dropdown-item" data-action="download-dxf" data-id="${item.id}" role="menuitem">
                    <svg viewBox="0 0 24 24" width="14" height="14" data-lucide="code" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></svg>
                    <span>Download DXF</span>
                  </button>
                  <button class="card-dropdown-item" data-action="download-png" data-id="${item.id}" role="menuitem">
                    <svg viewBox="0 0 24 24" width="14" height="14" data-lucide="image" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></svg>
                    <span>Download PNG</span>
                  </button>
                  ${item.isSprite ? `
                  <button class="card-dropdown-item" data-action="download-sprite" data-id="${item.id}" role="menuitem">
                    <svg viewBox="0 0 24 24" width="14" height="14" data-lucide="layers" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></svg>
                    <span>Download Full Sprite</span>
                  </button>
                  ` : ''}
                </div>
              </div>
            </div>
          </div>
        </div>
      `;
    }).join('');

    window.lucide.createIcons();

    // Attach card click & slider handlers
    this.grid.querySelectorAll('.svg-card').forEach(card => {
      const id = card.dataset.id;
      const item = this.filteredItems.find(i => i.id === id);

      // Slider interactive scrub handlers
      const slider = card.querySelector('.plot-draw-slider');
      const pctLabel = card.querySelector('.plot-slider-pct');

      slider?.addEventListener('input', (e) => {
        e.stopPropagation();
        const val = parseFloat(slider.value) || 0;
        slider.style.setProperty('--slider-pct', `${val}%`);
        if (pctLabel) pctLabel.textContent = `${Math.round(val)}%`;
        this.viewer.scrubCardPlot(card, item, val / 100);
      });

      slider?.addEventListener('pointerdown', (e) => {
        e.stopPropagation();
      });

      slider?.addEventListener('click', (e) => {
        e.stopPropagation();
      });

      card.addEventListener('click', (e) => {
        const actionBtn = e.target.closest('[data-action]');
        if (actionBtn) {
          e.stopPropagation();
          const action = actionBtn.dataset.action;
          if (action === 'preview-fullscreen') {
            this.triggerHaptic();
            this.openFullscreen(item);
            return;
          } else if (action === 'view-info') {
            e.stopPropagation();
            this.triggerHaptic();
            this.openInfoModal(item);
            return;
          } else if (action === 'toggle-play') {
            this.closeAllCardMenus();
            this.triggerHaptic();
            this.viewer.toggleCardPlot(card, item);
          } else if (action === 'toggle-speed') {
            this.triggerHaptic();
            this.viewer.cycleSpeed();
            const label = this.viewer.getSpeedLabel();
            this.grid.querySelectorAll('.btn-plot-speed .speed-label').forEach(el => {
              el.textContent = label;
            });
            this.grid.querySelectorAll('.btn-plot-speed').forEach(btn => {
              btn.setAttribute('title', `Plotter speed: ${label} (Click to cycle 0.1x / 0.2x / 0.3x / 0.4x / 0.5x / 1x)`);
            });
          } else if (action === 'toggle-menu') {
            this.triggerHaptic();
            const wrapper = actionBtn.closest('.card-menu-wrapper');
            const dropdown = wrapper?.querySelector('.card-actions-dropdown');
            const isOpen = dropdown?.classList.contains('show');

            this.closeAllCardMenus();

            if (!isOpen && dropdown) {
              dropdown.classList.add('show');
              card.classList.add('menu-open');
              actionBtn.setAttribute('aria-expanded', 'true');
              actionBtn.classList.add('active');
            }
          } else if (action === 'download-svg') {
            this.closeAllCardMenus();
            SVGExporter.downloadSVG(item);
            this.triggerHaptic();
          } else if (action === 'download-dxf') {
            this.closeAllCardMenus();
            SVGExporter.downloadDXF(item);
            this.triggerHaptic();
          } else if (action === 'download-png') {
            this.closeAllCardMenus();
            SVGExporter.exportPNG(item, 2.5);
            this.triggerHaptic();
          } else if (action === 'download-sprite') {
            this.closeAllCardMenus();
            SVGExporter.downloadSprite(item);
            this.triggerHaptic();
          }
          return;
        }

        // Clicking inside dropdown, slider, or when menu is open
        if (e.target.closest('.card-actions-dropdown') || e.target.closest('.plot-slider-wrapper')) return;
        if (card.classList.contains('menu-open')) {
          this.closeAllCardMenus();
          return;
        }

        // Clicking on card preview or body triggers play/pause animation for this card
        this.closeAllCardMenus();
        this.triggerHaptic();
        this.viewer.toggleCardPlot(card, item);
      });
    });
  }

  renderPagination() {
    const pagination = document.getElementById('pagination');
    const infoEl = document.getElementById('pagination-info');
    const controlsEl = document.getElementById('pagination-controls');
    const total = this.filteredItems.length;

    if (!pagination || !infoEl || !controlsEl) return;

    if (total <= this.itemsPerPage) {
      pagination.style.display = 'none';
      return;
    }

    pagination.style.display = 'flex';

    const totalPages = Math.ceil(total / this.itemsPerPage);
    const start = (this.currentPage - 1) * this.itemsPerPage + 1;
    const end = Math.min(this.currentPage * this.itemsPerPage, total);

    infoEl.textContent = `Showing ${start}-${end} of ${total} artworks`;

    // Build page buttons: 1, 2, 3, ..., N, Next
    let html = '';

    // Always show first page
    for (let i = 1; i <= totalPages; i++) {
      const show = i === 1 || i === totalPages || (i >= this.currentPage - 1 && i <= this.currentPage + 1);
      if (!show) {
        if (html.trim().endsWith('...')) continue;
        html += `<span class="pagination-ellipsis">…</span>`;
        continue;
      }
      const active = i === this.currentPage ? ' active' : '';
      html += `<button class="pagination-btn${active}" data-page="${i}" aria-label="Page ${i}">${i}</button>`;
    }

    // Next button (disabled on last page)
    const nextDisabled = this.currentPage >= totalPages ? ' disabled' : '';
    html += `<button class="pagination-btn pagination-next${nextDisabled}" data-page="next" aria-label="Next page">Next »</button>`;

    controlsEl.innerHTML = html;

    // Attach handlers
    controlsEl.querySelectorAll('.pagination-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (btn.classList.contains('disabled') || btn.classList.contains('active')) return;
        const page = btn.dataset.page;
        if (page === 'next') {
          this.currentPage = Math.min(this.currentPage + 1, totalPages);
        } else {
          this.currentPage = parseInt(page, 10);
        }
        this.renderGrid();
        this.renderPagination();
        window.scrollTo({ top: 0, behavior: 'smooth' });
      });
    });
  }

  triggerHaptic() {
    if (navigator.vibrate) {
      try {
        navigator.vibrate(20);
      } catch {}
    }
  }

  cleanupServiceWorker() {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistrations().then(registrations => {
        for (const registration of registrations) {
          registration.unregister();
        }
      }).catch(() => {});
    }
    if ('caches' in window) {
      caches.keys().then(keys => {
        keys.forEach(key => caches.delete(key));
      }).catch(() => {});
    }
  }
}

// Start app
window.addEventListener('DOMContentLoaded', () => {
  window.vectorApp = new App();
});
