/**
 * LocalStorage & State Management for Vector SVG Viewer
 */

const STORAGE_KEYS = {
  FAVORITES: 'vector_favorites_v1',
  UPLOADS: 'vector_user_uploads_v1',
  THEME: 'vector_theme_preference'
};

export const Storage = {
  getFavorites() {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.FAVORITES);
      return raw ? new Set(JSON.parse(raw)) : new Set();
    } catch {
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
    } catch {
      return [];
    }
  },

  saveUserUpload(svgItem) {
    const uploads = this.getUserUploads();
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
  }
};
