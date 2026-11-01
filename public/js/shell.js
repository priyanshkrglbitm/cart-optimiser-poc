// The app frame: mobile sidebar, dropdown menus, ⌘K search shortcut, and the active sidebar link.

/**
 * @param {(text: string) => void} askAssistant  sends the topbar search text to the AI assistant
 */
export function initShell(askAssistant) {
  initSidebar();
  initMenus();
  initSearch(askAssistant);
  initActiveNav();
}

// Mobile: the sidebar slides in over the page
function initSidebar() {
  const sidebar = document.getElementById('sidebar');
  const backdrop = document.getElementById('sidebar-backdrop');
  const toggle = document.getElementById('menu-toggle');

  const setOpen = open => {
    sidebar.classList.toggle('is-open', open);
    backdrop.hidden = !open;
    toggle.setAttribute('aria-expanded', String(open));
  };

  toggle.addEventListener('click', () => setOpen(!sidebar.classList.contains('is-open')));
  backdrop.addEventListener('click', () => setOpen(false));
  sidebar.addEventListener('click', e => { if (e.target.closest('a.nav-item')) setOpen(false); });
}

// Notifications and profile dropdowns: one open at a time; outside click or Escape closes
function initMenus() {
  const buttons = [...document.querySelectorAll('[data-menu]')];

  const closeAll = except => {
    for (const button of buttons) {
      if (button === except) continue;
      document.getElementById(button.dataset.menu).hidden = true;
      button.setAttribute('aria-expanded', 'false');
    }
  };

  for (const button of buttons) {
    button.addEventListener('click', e => {
      e.stopPropagation();
      const menu = document.getElementById(button.dataset.menu);
      closeAll(button);
      menu.hidden = !menu.hidden;
      button.setAttribute('aria-expanded', String(!menu.hidden));
    });
  }

  document.addEventListener('click', e => { if (!e.target.closest('.menu')) closeAll(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeAll(); });
}

// Topbar search goes to the assistant; ⌘K / Ctrl+K focuses it
function initSearch(askAssistant) {
  const form = document.getElementById('global-search');
  const input = document.getElementById('global-search-input');

  form.addEventListener('submit', e => {
    e.preventDefault();
    const text = input.value.trim();
    if (!text) return;
    input.value = '';
    input.blur();
    document.getElementById('assistant').scrollIntoView({ behavior: 'smooth', block: 'start' });
    askAssistant(text);
  });

  document.addEventListener('keydown', e => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      input.focus();
    }
  });
}

// Highlights the sidebar link of the section on screen
function initActiveNav() {
  const links = [...document.querySelectorAll('.sidebar a.nav-item[href^="#"]')];
  const sections = links
    .map(link => ({ link, section: document.getElementById(link.getAttribute('href').slice(1)) }))
    .filter(x => x.section);

  const setActive = link => links.forEach(l => l.classList.toggle('is-active', l === link));

  const observer = new IntersectionObserver(entries => {
    const visible = entries.filter(e => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
    const match = visible && sections.find(s => s.section === visible.target);
    if (match) setActive(match.link);
  }, { rootMargin: '-80px 0px -55% 0px' });

  sections.forEach(s => observer.observe(s.section));
}
