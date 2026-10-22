
    document.getElementById('loginForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const errBanner = document.getElementById('loginError');
      errBanner.style.display = 'none';

      const res = await window.Kickoff.fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: document.getElementById('username').value,
          password: document.getElementById('password').value
        })
      });

      const data = await res.json();
      if (res.ok) {
        window.location.href = '/admin/dashboard.html';
      } else {
        errBanner.textContent = data.error || 'Authentication rejected';
        errBanner.style.display = 'block';
      }
    });
  