document.getElementById('loginForm').addEventListener('submit', async event => {
  event.preventDefault();
  const form = event.currentTarget;
  const button = form.querySelector('button[type="submit"]');
  if (button.disabled) return;
  const errorBanner = document.getElementById('loginError');
  errorBanner.style.display = 'none';
  button.disabled = true;
  const label = document.getElementById('loginButtonLabel');
  if (label) label.textContent = 'Signing in…';
  button.setAttribute('aria-busy', 'true');
  try {
    const response = await window.Kickoff.fetch('/api/admin/login', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: document.getElementById('username').value, password: document.getElementById('password').value })
    });
    const data = await response.json();
    if (response.ok) window.location.href = '/admin/dashboard.html';
    else throw new Error(data.error || 'Authentication rejected');
  } catch (error) {
    errorBanner.textContent = error.message || 'Connection failed. Please try again.';
    errorBanner.style.display = 'block';
    errorBanner.focus();
  } finally {
    button.disabled = false; button.removeAttribute('aria-busy');
    if (label) label.textContent = 'Sign in';
  }
});
