/**
 * LocalStorage & State Management for Vector SVG Viewer
 */

const STORAGE_KEYS = {
  FAVORITES: 'vector_favorites_v1',
  UPLOADS: 'vector_user_uploads_v1',
  THEME: 'vector_theme_preference',
  DENSITY: 'vector_grid_density',
  ACCENT_COLOR: 'vector_undraw_accent_color'
};

export const Storage = {
  getFavorites() {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.FAVORITES);
      return raw ? new Set(JSON.parse(raw)) : new Set();
    } catch (e) {
      return new Set();
    }
  },

  isFavorite(id) {
    return this.getFavorites().has(id);
  },

  toggleFavorite(id) {
    const favs = this.getFavorites();
    let isNowFav = false;
    if (favs.has(id)) {
      favs.delete(id);
      isNowFav = false;
    } else {
      favs.add(id);
      isNowFav = true;
    }
    try {
      localStorage.setItem(STORAGE_KEYS.FAVORITES, JSON.stringify([...favs]));
    } catch (e) {
      console.warn('Failed to save favorites to localStorage', e);
    }
    return isNowFav;
  },

  getUserUploads() {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.UPLOADS);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      return [];
    }
  },

  saveUserUpload(svgItem) {
    const uploads = this.getUserUploads();
    // Prepend or replace if exists
    const idx = uploads.findIndex(u => u.id === svgItem.id);
    if (idx >= 0) {
      uploads[idx] = svgItem;
    } else {
      uploads.unshift(svgItem);
    }
    try {
      localStorage.setItem(STORAGE_KEYS.UPLOADS, JSON.stringify(uploads));
    } catch (e) {
      console.warn('Storage limit reached, could not persist upload', e);
    }
  },

  getTheme() {
    return localStorage.getItem(STORAGE_KEYS.THEME) || 'light';
  },

  setTheme(theme) {
    localStorage.setItem(STORAGE_KEYS.THEME, theme);
    document.documentElement.setAttribute('data-theme', theme);
  },

  getDensity() {
    return localStorage.getItem(STORAGE_KEYS.DENSITY) || 'density-detailed';
  },

  setDensity(density) {
    localStorage.setItem(STORAGE_KEYS.DENSITY, density);
  },

  getAccentColor() {
    return localStorage.getItem(STORAGE_KEYS.ACCENT_COLOR) || '#6c63ff';
  },

  setAccentColor(color) {
    if (!color) {
      localStorage.removeItem(STORAGE_KEYS.ACCENT_COLOR);
    } else {
      localStorage.setItem(STORAGE_KEYS.ACCENT_COLOR, color);
    }
  }
};
