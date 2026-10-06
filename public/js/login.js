(() => {
  'use strict';

  const form = document.getElementById('loginForm');
  const errorDiv = document.getElementById('loginError');

  // Check if already logged in
  fetch('/api/auth/check')
    .then(r => r.json())
    .then(data => {
      if (data.authenticated) {
        window.location.href = '/dashboard.html';
      }
    })
    .catch(() => {});

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    errorDiv.classList.remove('active');

    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value;
    const shop = new URLSearchParams(window.location.search).get('shop') || undefined;

    if (!username || !password) {
      showError('Please enter both username and password.');
      return;
    }

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password, shop }),
      });

      const data = await res.json();

      if (res.ok) {
        window.location.href = '/dashboard.html';
      } else {
        showError(data.error || 'Invalid credentials');
      }
    } catch (err) {
      showError('Network error. Please try again.');
    }
  });

  function showError(msg) {
    errorDiv.textContent = msg;
    errorDiv.classList.add('active');
  }
})();
