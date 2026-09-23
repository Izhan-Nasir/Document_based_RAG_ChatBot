/**
 * Theme Manager — Dark/Light mode toggle with session persistence
 */
const ThemeManager = (() => {
  const STORAGE_KEY = 'docchat-theme';

  function init() {
    // Restore saved theme or default to dark
    const saved = sessionStorage.getItem(STORAGE_KEY) || 'dark';
    applyTheme(saved);

    // Bind toggle button
    const toggleBtn = document.getElementById('themeToggle');
    if (toggleBtn) {
      toggleBtn.addEventListener('click', toggle);
    }
  }

  function toggle() {
    const current = document.documentElement.getAttribute('data-bs-theme');
    const next = current === 'dark' ? 'light' : 'dark';
    applyTheme(next);
  }

  function applyTheme(theme) {
    document.documentElement.setAttribute('data-bs-theme', theme);
    sessionStorage.setItem(STORAGE_KEY, theme);
    updateIcon(theme);
  }

  function updateIcon(theme) {
    const icon = document.getElementById('themeIcon');
    if (!icon) return;
    if (theme === 'dark') {
      icon.className = 'bi bi-moon-stars-fill';
    } else {
      icon.className = 'bi bi-sun-fill';
    }
  }

  return { init, toggle };
})();

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', () => ThemeManager.init());
