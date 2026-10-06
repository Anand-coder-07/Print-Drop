(() => {
  const nav = document.querySelector('.site-nav');
  const toggle = document.querySelector('.menu-toggle');
  const header = document.querySelector('.site-header');
  toggle?.addEventListener('click', () => {
    const open = nav.classList.toggle('is-open');
    toggle.setAttribute('aria-expanded', open);
  });
  nav?.querySelectorAll('a').forEach(link => link.addEventListener('click', () => nav.classList.remove('is-open')));
  document.querySelector('#year').textContent = new Date().getFullYear();
  const updateHeader = () => header?.classList.toggle('is-scrolled', window.scrollY > 24);
  updateHeader();
  window.addEventListener('scroll', updateHeader, { passive: true });
  const observer = new IntersectionObserver(entries => entries.forEach(entry => {
    if (entry.isIntersecting) { entry.target.classList.add('is-visible'); observer.unobserve(entry.target); }
  }), { threshold: 0.12 });
  document.querySelectorAll('.reveal').forEach(item => observer.observe(item));
  fetch('/api/auth/check', { credentials: 'same-origin' })
    .then(response => response.ok ? response.json() : null)
    .then(data => { if (data?.authenticated) window.location.replace('/dashboard.html'); })
    .catch(() => {});
})();
