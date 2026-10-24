// Accessible navigation and dialogs; the original animation loops stay untouched.
document.addEventListener('DOMContentLoaded', () => {
  const sidebar = document.getElementById('sidebar');
  const menuButton = document.getElementById('openSidebar');
  let activePanel = null;
  let returnFocus = null;
  const visible = element => element && element.getClientRects().length > 0 && getComputedStyle(element).visibility !== 'hidden';
  function focusable(root) {
    return [...root.querySelectorAll('a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex="0"]')]
      .filter(element => visible(element) && !element.closest('[inert]'));
  }
  function syncPanels() {
    const overlays = [...document.querySelectorAll('.modal-overlay, .confirm-modal-overlay')];
    for (const panel of overlays) {
      const open = panel.classList.contains('active');
      panel.inert = !open; panel.setAttribute('aria-hidden', String(!open));
    }
    const menuOpen = sidebar?.classList.contains('active');
    if (sidebar) { sidebar.inert = !menuOpen; sidebar.setAttribute('aria-hidden', String(!menuOpen)); }
    menuButton?.setAttribute('aria-expanded', String(Boolean(menuOpen)));
    const next = overlays.filter(panel => panel.classList.contains('active')).at(-1) || (menuOpen ? sidebar : null);
    if (document.body.classList.contains('is-dialog-open') !== Boolean(next)) document.body.classList.toggle('is-dialog-open', Boolean(next));
    if (next === activePanel) return;
    if (next) {
      if (!activePanel) returnFocus = document.activeElement;
      activePanel = next;
      // Visibility transitions can still be at their hidden first frame when a panel opens.
      let focusFrames = 0;
      function focusPanel() {
        if (activePanel !== next || next.contains(document.activeElement)) return;
        const firstInput = next.querySelector('input:not([type="hidden"]):not([disabled])');
        const target = firstInput || focusable(next)[0];
        if (visible(target)) target.focus({ preventScroll: true });
        else if (++focusFrames < 60) requestAnimationFrame(focusPanel);
      }
      requestAnimationFrame(focusPanel);
    } else {
      activePanel = null;
      if (visible(returnFocus)) returnFocus.focus({ preventScroll: true });
      returnFocus = null;
    }
  }
  function dismiss(panel) {
    if (panel.id === 'confirmModal' && document.getElementById('btnProceedConfirm')?.disabled) return;
    const close = panel === sidebar ? document.getElementById('closeSidebar')
      : panel.querySelector('[data-close],#btnCancelConfirm,#btnCancelClear');
    close?.click();
  }
  document.addEventListener('keydown', event => {
    if (!activePanel) return;
    if (event.key === 'Escape') { event.preventDefault(); dismiss(activePanel); return; }
    if (event.key !== 'Tab') return;
    const items = focusable(activePanel);
    // Flatpickr may append its keyboard controls outside the dialog.
    const calendar = document.querySelector('.flatpickr-calendar.open');
    if (calendar) items.push(...focusable(calendar));
    if (!items.length) return;
    const first = items[0], last = items.at(-1);
    if (event.shiftKey && (document.activeElement === first || !items.includes(document.activeElement))) {
      event.preventDefault(); last.focus();
    } else if (!event.shiftKey && (document.activeElement === last || !items.includes(document.activeElement))) {
      event.preventDefault(); first.focus();
    }
  });
  document.querySelectorAll('.modal-overlay,.confirm-modal-overlay').forEach(panel => {
    panel.addEventListener('click', event => { if (event.target === panel) dismiss(panel); });
  });
  new MutationObserver(syncPanels).observe(document.body, { subtree: true, attributes: true, attributeFilter: ['class'] });
  syncPanels();

  const password = document.getElementById('password');
  const toggle = document.getElementById('togglePassword');
  toggle?.addEventListener('click', () => {
    const showing = password.type === 'password';
    password.type = showing ? 'text' : 'password';
    toggle.textContent = showing ? 'Hide' : 'Show';
    toggle.setAttribute('aria-label', showing ? 'Hide password' : 'Show password');
    toggle.setAttribute('aria-pressed', String(showing));
  });
  const authError = document.getElementById('authError');
  if (authError && new URLSearchParams(location.search).get('error') === 'login_failed') {
    authError.textContent = 'Google sign-in could not be completed. Try again or continue as a guest.';
    authError.hidden = false;
  }
  // Back/forward cache can restore an in-progress Google sign-in button.
  window.addEventListener('pageshow', () => {
    const button = document.getElementById('btnGoogleLogin');
    if (button && !button.dataset.preview) {
      button.disabled = false;
      const label = button.querySelector('.google-button-label');
      if (label) label.textContent = 'Continue with Google';
    }
  });
});
