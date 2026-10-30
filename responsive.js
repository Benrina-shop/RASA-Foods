// Accessible shared mobile navigation for every admin management screen.
(() => {
  const sidebar = document.querySelector('.sidebar');
  if (!sidebar) return;
  sidebar.id = 'admin-navigation';
  const toggle = document.createElement('button');
  toggle.className = 'admin-menu-toggle';
  toggle.type = 'button';
  toggle.textContent = 'Menu';
  toggle.setAttribute('aria-controls', sidebar.id);
  toggle.setAttribute('aria-expanded', 'false');
  const shade = document.createElement('button');
  shade.className = 'admin-menu-shade';
  shade.setAttribute('aria-label', 'Close navigation');
  shade.tabIndex = -1;
  const mobile = matchMedia('(max-width: 1024px)');
  function setOpen(open) {
    document.body.classList.toggle('admin-menu-open', open);
    toggle.setAttribute('aria-expanded', String(open));
    toggle.textContent = open ? 'Close menu' : 'Menu';
    sidebar.inert = mobile.matches && !open;
    if (!open && mobile.matches) toggle.focus();
  }
  toggle.onclick = () => setOpen(toggle.getAttribute('aria-expanded') !== 'true');
  shade.onclick = () => setOpen(false);
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') setOpen(false);
    if (event.key === 'Tab' && mobile.matches && document.body.classList.contains('admin-menu-open')) {
      const focusable = [toggle, ...sidebar.querySelectorAll('a[href], button:not([disabled])')];
      const first = focusable[0], last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }
  });
  mobile.addEventListener('change', () => setOpen(false));
  document.body.append(shade, toggle);
  sidebar.inert = mobile.matches;
  document.querySelectorAll('table').forEach(table => {
    const wrapper = document.createElement('div');
    wrapper.className = 'table-scroll';
    wrapper.tabIndex = 0;
    wrapper.setAttribute('role', 'region');
    wrapper.setAttribute('aria-label', 'Scrollable data table');
    table.before(wrapper);
    wrapper.append(table);
  });
})();
