/* Router — views, no animations */
const views = ['home', 'add', 'partner', 'activity', 'insights', 'settings'];

export function initRouter() {
  window.addEventListener('hashchange', navigate);
  navigate();
}

function navigate() {
  const hash = (location.hash || '#home').replace('#', '');
  const target = views.includes(hash) ? hash : 'home';

  // Switch views
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  const el = document.getElementById('view-' + target);
  if (el) el.classList.add('active');

  // Update nav links (top)
  document.querySelectorAll('.nav-link').forEach(a => {
    a.classList.toggle('active', a.dataset.view === target);
  });

  // Update bottom nav
  document.querySelectorAll('.bnav').forEach(a => {
    a.classList.toggle('active', a.dataset.view === target);
  });

  // Scroll main to top
  const main = document.querySelector('.main');
  if (main) main.scrollTop = 0;

  // Dispatch custom event so views can react
  window.dispatchEvent(new CustomEvent('viewchange', { detail: target }));
}
