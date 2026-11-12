/**
 * Main Application Controller for Vector SVG Artwork Gallery
 */

import { SVGLibrary } from './library.js';
import { SVGViewer } from './viewer.js';
import { Storage } from './storage.js';
import { SVGExporter } from './export.js';

class App {
  constructor() {
    this.library = new SVGLibrary();
    this.viewer = null;
    this.activeCategory = 'All Artworks';
    this.searchQuery = '';
    this.filteredItems = [];

    this.init();
  }

  async init() {
    // Apply saved theme
    const theme = Storage.getTheme() || 'light';
    Storage.setTheme(theme);

    // Initialize viewer
    this.viewer = new SVGViewer(this);

    // Init UI Elements
    this.grid = document.getElementById('svg-grid');
    this.emptyState = document.getElementById('empty-state');
    this.searchInput = document.getElementById('search-input');
    this.searchClearBtn = document.getElementById('search-clear-btn');
    this.themeToggleBtn = document.getElementById('btn-theme-toggle');
    this.toastContainer = document.getElementById('toast-container');

    this.bindEvents();
    this.registerServiceWorker();

    // Load SVG items & render dynamic category dropdown in searchbar
    await this.library.load();
    this.renderCategoryDropdown();
    this.filterAndRender();

    // Auto-sync only when a live local server API is active
    if (this.library.hasApiServer) {
      window.addEventListener('focus', () => {
        this.syncCategoriesAndItems();
      });

      // Background auto-sync poll every 10 seconds
      setInterval(() => {
        this.syncCategoriesAndItems();
      }, 10000);
    }
  }

  async syncCategoriesAndItems() {
    const prevCount = this.library.items.length;
    const prevCats = JSON.stringify(this.library.discoveredCategories || []);
    await this.library.load();
    const newCats = JSON.stringify(this.library.discoveredCategories || []);

    if (prevCount !== this.library.items.length || prevCats !== newCats) {
      this.renderCategoryDropdown();
      this.filterAndRender();
    }
  }

  getCategoryIcon(cat) {
    const iconSvgs = {
      'All Artworks': '<rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/>',
      'Favorites': '<path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>',
      'Tech & Software': '<path d="m18 16 4-4-4-4"/><path d="m6 8-4 4 4 4"/><path d="m14.5 4-5 16"/>',
      'Business & Marketing': '<path d="m22 7-8.5 8.5-5-5L2 17"/><path d="M16 7h6v6"/>',
      'Engineering & CAD': '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>',
      'Nature & Scenery': '<polygon points="2 20 8 10 14 17 19 8 22 20 2 20"/>',
      'Abstract & 3D': '<path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>',
      'Art & Creative': '<path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.563-2.512 5.563-5.563C22 6.5 17.5 2 12 2z"/>',
      'default': '<path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>'
    };
    return iconSvgs[cat] || iconSvgs['default'];
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

    const allCategories = ['All Artworks', 'Favorites', ...subCategories];

    // Calculate count per category
    const counts = {};
    counts['All Artworks'] = this.library.items.length;
    counts['Favorites'] = this.library.items.filter(i => Storage.isFavorite(i.id)).length;
    subCategories.forEach(cat => {
      counts[cat] = this.library.items.filter(i => i.category === cat).length;
    });

    menu.innerHTML = allCategories.map(cat => {
      const isFav = cat === 'Favorites';
      const iconPath = this.getCategoryIcon(cat);
      const isActive = this.activeCategory === cat;
      const count = counts[cat] ?? 0;

      return `
        <div class="category-dropdown-item ${isActive ? 'active' : ''}" data-filter="${cat}" role="option">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="${isFav ? '#ef4444' : 'none'}" stroke="${isFav ? '#ef4444' : 'currentColor'}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            ${iconPath}
          </svg>
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
  }

  updateDropdownButton() {
    const labelEl = document.getElementById('category-current-label');
    const iconEl = document.getElementById('category-btn-icon');
    if (labelEl) labelEl.textContent = this.activeCategory;
    if (iconEl) {
      const isFav = this.activeCategory === 'Favorites';
      iconEl.innerHTML = `
        <svg viewBox="0 0 24 24" width="14" height="14" fill="${isFav ? '#ef4444' : 'none'}" stroke="${isFav ? '#ef4444' : 'currentColor'}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          ${this.getCategoryIcon(this.activeCategory)}
        </svg>
      `;
    }
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

    // Synchronize bottom nav bar
    document.querySelectorAll('.nav-tab-btn').forEach(b => {
      if (category === 'Favorites') {
        b.classList.toggle('active', b.dataset.tab === 'favorites');
      } else {
        b.classList.toggle('active', b.dataset.tab === 'library');
      }
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
    });

    // Close dropdown on Escape key
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        dropdownMenu?.classList.remove('open');
        dropdownBtn?.classList.remove('open');
        dropdownBtn?.setAttribute('aria-expanded', 'false');
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

    // Theme Toggle
    this.themeToggleBtn?.addEventListener('click', () => {
      const current = document.documentElement.getAttribute('data-theme') || 'light';
      const next = current === 'dark' ? 'light' : 'dark';
      Storage.setTheme(next);
      this.triggerHaptic();
      this.showToast(`Switched to ${next} mode`);
    });

    // Bottom Navigation Tabs
    document.querySelectorAll('.nav-tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.nav-tab-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const tab = btn.dataset.tab;
        this.handleTabSwitch(tab);
      });
    });
  }

  handleTabSwitch(tab) {
    this.triggerHaptic();
    if (tab === 'favorites') {
      this.selectCategory('Favorites');
    } else {
      this.selectCategory('All Artworks');
    }
  }

  filterAndRender() {
    let items = [...this.library.items];

    // Filter by Category
    if (this.activeCategory === 'Favorites') {
      items = items.filter(item => Storage.isFavorite(item.id));
    } else if (this.activeCategory !== 'All Artworks') {
      items = items.filter(item => item.category === this.activeCategory);
    }

    // Filter by Search
    if (this.searchQuery) {
      items = items.filter(item => {
        const titleMatch = item.displayName.toLowerCase().includes(this.searchQuery);
        const catMatch = item.category.toLowerCase().includes(this.searchQuery);
        const nameMatch = item.name.toLowerCase().includes(this.searchQuery);
        return titleMatch || catMatch || nameMatch;
      });
    }

    this.filteredItems = items;
    this.renderGrid();
  }

  renderGrid() {
    if (this.filteredItems.length === 0) {
      this.grid.innerHTML = '';
      this.emptyState.style.display = 'flex';
      const emptyMsg = this.emptyState.querySelector('p');
      if (emptyMsg) {
        if (this.activeCategory !== 'All Artworks' && this.activeCategory !== 'Favorites') {
          emptyMsg.textContent = `No SVGs found in "${this.activeCategory}". Add .svg files to its folder in svgs/ to see them here.`;
        } else if (this.activeCategory === 'Favorites') {
          emptyMsg.textContent = 'No favorite artworks saved yet.';
        } else {
          emptyMsg.textContent = 'No vector artworks found matching your search.';
        }
      }
      return;
    }

    this.emptyState.style.display = 'none';
    this.grid.innerHTML = this.filteredItems.map(item => {
      const isFav = Storage.isFavorite(item.id);

      return `
        <div class="svg-card" data-id="${item.id}">
          <div class="svg-card-preview">
            ${item.content}
            <span class="artwork-badge">${item.category}</span>
            <button class="btn-card-fav ${isFav ? 'favorite-active' : ''}" data-action="favorite" data-id="${item.id}" title="${isFav ? 'Remove from favorites' : 'Save to favorites'}">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="${isFav ? '#ef4444' : 'none'}" stroke="${isFav ? '#ef4444' : 'currentColor'}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
              </svg>
            </button>
          </div>
          <div class="svg-card-info">
            <span class="svg-card-name" title="${item.displayName}">${item.displayName}</span>
            <div class="card-bottom-actions">
              <button class="btn-card-action btn-plot-action" data-action="plot-draw" data-id="${item.id}" title="Simulate CNC Plotter Draw">
                <svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor">
                  <polygon points="5 3 19 12 5 21 5 3"></polygon>
                </svg>
                <span>Plot</span>
              </button>
              <button class="btn-card-action" data-action="download-svg" data-id="${item.id}" title="Download SVG">
                <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
                </svg>
                <span>SVG</span>
              </button>
              <button class="btn-card-action" data-action="download-dxf" data-id="${item.id}" title="Download DXF (AutoCAD/CNC/Laser)">
                <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5">
                  <polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/>
                </svg>
                <span>DXF</span>
              </button>
              <button class="btn-card-action" data-action="download-png" data-id="${item.id}" title="Download PNG">
                <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5">
                  <rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/>
                </svg>
                <span>PNG</span>
              </button>
            </div>
          </div>
        </div>
      `;
    }).join('');

    // Attach card click handlers
    this.grid.querySelectorAll('.svg-card').forEach(card => {
      const id = card.dataset.id;
      const item = this.filteredItems.find(i => i.id === id);

      card.addEventListener('click', (e) => {
        const actionBtn = e.target.closest('[data-action]');
        if (actionBtn) {
          e.stopPropagation();
          const action = actionBtn.dataset.action;
          if (action === 'plot-draw') {
            this.triggerHaptic();
            this.viewer.toggleCardPlot(card, item);
          } else if (action === 'favorite') {
            const isNowFav = Storage.toggleFavorite(id);
            this.triggerHaptic();
            this.showToast(isNowFav ? 'Saved to favorites' : 'Removed from favorites');

            if (this.activeCategory === 'Favorites') {
              this.filterAndRender();
            } else {
              actionBtn.classList.toggle('favorite-active', isNowFav);
              actionBtn.setAttribute('title', isNowFav ? 'Remove from favorites' : 'Save to favorites');
              const svgIcon = actionBtn.querySelector('svg');
              if (svgIcon) {
                svgIcon.setAttribute('fill', isNowFav ? '#ef4444' : 'none');
                svgIcon.setAttribute('stroke', isNowFav ? '#ef4444' : 'currentColor');
              }
              actionBtn.classList.remove('heart-pop');
              void actionBtn.offsetWidth;
              actionBtn.classList.add('heart-pop');
            }
          } else if (action === 'download-svg') {
            SVGExporter.downloadSVG(item);
            this.triggerHaptic();
            this.showToast(`Downloaded ${item.displayName}.svg`);
          } else if (action === 'download-dxf') {
            SVGExporter.downloadDXF(item);
            this.triggerHaptic();
            this.showToast(`Exported ${item.displayName}.dxf`);
          } else if (action === 'download-png') {
            SVGExporter.exportPNG(item, 2.5);
            this.triggerHaptic();
            this.showToast(`Exported ${item.displayName}.png`);
          }
          return;
        }

        // Clicking on card preview or body triggers plot animation for this card
        this.triggerHaptic();
        this.viewer.toggleCardPlot(card, item);
      });
    });
  }

  showToast(message, isError = false) {
    if (!this.toastContainer) return;
    const toast = document.createElement('div');
    toast.className = `toast ${isError ? 'toast-error' : 'toast-success'}`;
    toast.innerHTML = `
      <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
        ${isError 
          ? '<circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>' 
          : '<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>'}
      </svg>
      <span>${message}</span>
    `;

    this.toastContainer.appendChild(toast);
    requestAnimationFrame(() => toast.classList.add('visible'));

    setTimeout(() => {
      toast.classList.remove('visible');
      setTimeout(() => toast.remove(), 250);
    }, 2400);
  }

  triggerHaptic() {
    if (navigator.vibrate) {
      try {
        navigator.vibrate(20);
      } catch {}
    }
  }

  registerServiceWorker() {
    if ('serviceWorker' in navigator && window.location.protocol.startsWith('http')) {
      navigator.serviceWorker.register('./sw.js').catch(() => {});
    }
  }
}

// Start app
window.addEventListener('DOMContentLoaded', () => {
  window.vectorApp = new App();
});
