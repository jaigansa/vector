/**
 * LocalStorage & State Management for Vector SVG Viewer
 */

const STORAGE_KEYS = {
  UPLOADS: 'vector_user_uploads_v1'
};

export const Storage = {
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
  }
};
