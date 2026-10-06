(() => {
  'use strict';

  const signupForm = document.getElementById('ownerSignupForm');
  const errorBox = document.getElementById('ownerError');
  const successBox = document.getElementById('ownerSuccess');

  function showError(message) {
    errorBox.textContent = message;
    errorBox.classList.add('active');
  }

  async function downloadShopQr(shopSlug) {
    const qrUrl = `/api/shops/${encodeURIComponent(shopSlug)}/qr.png`;
    const response = await fetch(qrUrl);
    if (!response.ok) {
      throw new Error('Shop created, but the QR code could not be downloaded. Use the QR link below.');
    }

    const blob = await response.blob();
    const downloadUrl = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = `${shopSlug}-printdrop-qr.png`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(downloadUrl), 1000);
  }

  signupForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    errorBox.classList.remove('active');
    const button = signupForm.querySelector('button');
    button.disabled = true;
    try {
      const response = await fetch('/api/shops/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: document.getElementById('signupName').value.trim(),
          username: document.getElementById('signupUsername').value.trim(),
          password: document.getElementById('signupPassword').value,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Could not create shop');
      const uploadUrl = new URL(data.uploadUrl, window.location.origin).href;
      document.getElementById('successMessage').textContent = 'Your username and password are ready for login.';
      const uploadLink = document.getElementById('uploadLink');
      uploadLink.href = uploadUrl;
      uploadLink.textContent = `Student upload link: ${uploadUrl}`;
      const qrLink = document.getElementById('qrLink');
      qrLink.href = `/api/shops/${encodeURIComponent(data.shop.slug)}/qr.png`;
      qrLink.download = `${data.shop.slug}-printdrop-qr.png`;
      signupForm.hidden = true;
      successBox.hidden = false;
      await downloadShopQr(data.shop.slug);
    } catch (error) {
      showError(error.message);
      button.disabled = false;
    }
  });
})();
