// Light/dark theme toggle. Follows the system setting until the user picks one.

const STORAGE_KEY = 'smartbasket_theme';

export function initTheme() {
  const button = document.getElementById('theme-toggle');
  const systemDark = window.matchMedia('(prefers-color-scheme: dark)');

  const saved = readSaved();
  if (saved) document.documentElement.dataset.theme = saved;

  const currentTheme = () => document.documentElement.dataset.theme || (systemDark.matches ? 'dark' : 'light');
  const updateIcon = () => { button.textContent = currentTheme() === 'dark' ? '☀️' : '🌙'; };

  button.addEventListener('click', () => {
    const next = currentTheme() === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    save(next);
    updateIcon();
  });

  systemDark.addEventListener('change', updateIcon);
  updateIcon();
}

// localStorage can be blocked (private mode), so failures are ignored.
function readSaved() {
  try { return localStorage.getItem(STORAGE_KEY); } catch { return null; }
}

function save(theme) {
  try { localStorage.setItem(STORAGE_KEY, theme); } catch { /* ignore */ }
}
