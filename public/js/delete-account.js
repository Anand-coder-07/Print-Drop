(() => {
  'use strict';

  const form = document.getElementById('deleteAccountForm');
  const username = document.getElementById('deleteUsername');
  const password = document.getElementById('deletePassword');
  const submit = document.getElementById('deleteSubmit');
  const error = document.getElementById('deleteError');

  function showError(message) {
    error.textContent = message;
    error.classList.add('active');
  }

  fetch('/api/auth/check')
    .then(response => response.json())
    .then(data => {
      if (!data.authenticated) {
        window.location.href = '/login.html';
        return;
      }
      username.value = data.username;
      password.focus();
    })
    .catch(() => {
      window.location.href = '/login.html';
    });

  form.addEventListener('submit', async event => {
    event.preventDefault();
    error.classList.remove('active');
    if (!password.value) {
      showError('Enter your password to continue.');
      password.focus();
      return;
    }

    submit.disabled = true;
    submit.textContent = 'Deleting account...';
    try {
      const response = await fetch('/api/auth/account', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: password.value })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Account could not be deleted.');
      window.location.href = '/login.html?deleted=1';
    } catch (requestError) {
      submit.disabled = false;
      submit.textContent = 'Permanently delete account';
      showError(requestError.message);
    }
  });
})();
