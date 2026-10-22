// Security transport only. Rendering and animation stay in the original scripts.
(() => {
  'use strict';
  let session = null;
  let pending = null;
  async function bootstrap(force = false) {
    if (session && !force) return session;
    if (pending) return pending;
    pending = window.fetch('/api/session', { credentials: 'same-origin', cache: 'no-store' })
      .then(async response => { const data = await response.json(); if (!response.ok) throw new Error(data.error || 'Session unavailable.'); session = data; return data; })
      .finally(() => { pending = null; });
    return pending;
  }
  async function secureFetch(url, options = {}, retry = true) {
    const target = new URL(url, window.location.href);
    if (target.origin !== window.location.origin || !target.pathname.startsWith('/api/')) {
      return window.fetch(url, options);
    }
    const method = (options.method || 'GET').toUpperCase();
    const unsafe = !['GET', 'HEAD', 'OPTIONS'].includes(method);
    if (unsafe && !session?.csrfToken) await bootstrap();
    const response = await window.fetch(url, {
      ...options, credentials: 'same-origin', cache: 'no-store',
      headers: { ...options.headers, ...(unsafe ? { 'X-CSRF-Token': session.csrfToken } : {}) }
    });
    if (unsafe) {
      const data = await response.clone().json().catch(() => ({}));
      if (response.status === 403 && data.code === 'CSRF_INVALID' && retry) {
        await bootstrap(true); return secureFetch(url, options, false);
      }
      if (data.csrfToken && session) session.csrfToken = data.csrfToken;
    }
    return response;
  }
  async function api(url, options = {}) {
    const response = await secureFetch(url, options);
    const data = await response.json();
    if (!response.ok) { const error = new Error(data.error || 'The request could not be completed.'); error.status = response.status; throw error; }
    return data;
  }
  async function allReservations(params = {}) {
    const rows = [];
    for (let page = 1; ; page++) {
      const query = new URLSearchParams({ ...params, page });
      const data = await api(`/api/admin/reservations?${query}`);
      rows.push(...data.reservations);
      if (!data.pagination?.hasNext) return { reservations: rows };
    }
  }
  function escapeHTML(value) {
    return String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[char]));
  }
  function today() {
    const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Beirut', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date()).map(part => [part.type, part.value]));
    return `${parts.year}-${parts.month}-${parts.day}`;
  }
  window.Kickoff = { fetch: secureFetch, api, bootstrap, allReservations, escapeHTML, today };
})();
