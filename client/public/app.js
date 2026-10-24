document.addEventListener('DOMContentLoaded', () => {

  const BUSINESS_WHATSAPP = "9613696325";
  const escapeHTML = window.Kickoff.escapeHTML;

  const views = document.querySelectorAll('.view');
  const progressContainer = document.getElementById('progressContainer');
  const steps = document.querySelectorAll('.step');
  
  const state = {
    date: null,
    time: null,
    playerName: '',
    playerPhone: '',
    reservationId: null
  };

  // --- Authentication Gate Logic ---
  const btnGoogleLogin = document.getElementById('btnGoogleLogin');
  const btnGuestLogin = document.getElementById('btnGuestLogin');
  
  if (btnGoogleLogin) btnGoogleLogin.addEventListener('click', () => {
    if (btnGoogleLogin.disabled) return;
    btnGoogleLogin.disabled = true;
    const label = btnGoogleLogin.querySelector('.google-button-label');
    if (label) label.textContent = 'Opening Google…';
    window.location.href = '/api/auth/google';
  });
  if (btnGuestLogin) btnGuestLogin.addEventListener('click', () => navigateTo('view-home'));

  // --- Check Session on Load & Setup Profile ---
  async function checkUserSession() {
    try {
      const res = await window.Kickoff.fetch('/api/auth/me');
      const data = await res.json();
      if (data.preview && btnGoogleLogin) {
        btnGoogleLogin.disabled = true; btnGoogleLogin.dataset.preview = 'true';
        const hint = document.getElementById('guestHint');
        if (hint) hint.textContent = 'Local preview: continue as a guest. Google sign-in is available on the live website.';
      }
      
      const deskProfile = document.getElementById('desktopProfileLink');
      const mobProfile = document.getElementById('mobileProfileLink');
      const deskLogin = document.getElementById('desktopLoginLink');
      const mobLogin = document.getElementById('mobileLoginLink');

      if (data.loggedIn) {
        state.isLoggedIn = true;
        state.user = data.user;
        
        const firstName = state.user.name.split(' ')[0].toUpperCase();
        if (deskProfile) { deskProfile.style.display = 'block'; deskProfile.textContent = 'My account'; deskProfile.title = `Signed in as ${firstName}`; }
        if (mobProfile) { mobProfile.style.display = 'block'; mobProfile.textContent = `👤 ${firstName}`; }
        if (deskLogin) deskLogin.style.display = 'none';
        if (mobLogin) mobLogin.style.display = 'none';

        if (document.getElementById('accEmail')) document.getElementById('accEmail').value = state.user.email || '';
        if (document.getElementById('accName')) document.getElementById('accName').value = state.user.name || '';
        if (document.getElementById('accPhone')) document.getElementById('accPhone').value = state.user.phone || '';

        if (document.getElementById('playerName')) document.getElementById('playerName').value = state.user.name || '';
        if (document.getElementById('playerPhone')) document.getElementById('playerPhone').value = state.user.phone || '';

        if (document.getElementById('view-entry').classList.contains('active')) navigateTo('view-home');
      } else {
        state.isLoggedIn = false;
        state.user = null;

        if (deskProfile) deskProfile.style.display = 'none';
        if (mobProfile) mobProfile.style.display = 'none';
        if (deskLogin) deskLogin.style.display = 'block';
        if (mobLogin) mobLogin.style.display = 'block';
      }
    } catch (err) {
      console.error("Session check failed", err);
    }
  }

  const closeAppSidebar = () => {
    const sidebar = document.querySelector('.sidebar');
    const overlay = document.querySelector('.sidebar-overlay');
    if (sidebar) sidebar.classList.remove('active');
    if (overlay) overlay.classList.remove('active');
  };

  // --- Load User Matches Dashboard ---
  async function loadUserMatches() {
    const listContainer = document.getElementById('userMatchesList');
    if (!listContainer) return;

    listContainer.innerHTML = '<div style="color: var(--text-dim); text-align: center; padding: 20px 0;">Loading matches...</div>';

    try {
      const res = await window.Kickoff.fetch('/api/auth/my-reservations');
      const data = await res.json();

      if (!res.ok || !data.reservations || data.reservations.length === 0) {
        listContainer.innerHTML = '<div style="color: var(--text-dim); text-align: center; padding: 20px 0;">No pitch reservations found yet.</div>';
        return;
      }

      listContainer.innerHTML = '';
      const todayStr = window.Kickoff.today();

      data.reservations.forEach(match => {
        const matchCard = document.createElement('div');
        matchCard.style.cssText = 'background: var(--surface); border: 1px solid var(--surface-border); padding: 16px 20px; border-radius: 8px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px; margin-bottom: 12px;';

        const isPast = match.date < todayStr;
        let badgeColor = '#FFB020'; 
        let badgeBg = 'rgba(255, 176, 32, 0.15)';

        if (match.status === 'CONFIRMED') {
          badgeColor = 'var(--accent)';
          badgeBg = 'rgba(0, 255, 102, 0.12)';
        } else if (match.status === 'CANCELLED') {
          badgeColor = 'var(--danger)';
          badgeBg = 'rgba(222, 40, 57, 0.12)';
        }

        const ticketUrl = typeof match.ticketUrl === 'string' && match.ticketUrl.startsWith('/ticket.html?token=') ? match.ticketUrl : '#';

        matchCard.innerHTML = `
          <div>
            <div style="font-family: var(--font-mono); font-size: 0.8rem; color: var(--text-dim); margin-bottom: 4px;">${escapeHTML(match.id)}</div>
            <div style="font-family: var(--font-display); font-size: 1.2rem; font-weight: 700; color: var(--text-main);">${escapeHTML(match.date)} &bull; ${escapeHTML(match.time)}</div>
            <div style="font-size: 0.85rem; color: var(--text-dim); margin-top: 2px;">${escapeHTML(match.name)} ${isPast ? '<span style="color: var(--accent); font-weight: bold;">(Completed)</span>' : ''}</div>
          </div>
          <div style="display: flex; align-items: center; gap: 12px;">
            <span style="background: ${badgeBg}; color: ${badgeColor}; padding: 4px 10px; border-radius: 4px; font-family: var(--font-display); font-size: 0.8rem; font-weight: 700; letter-spacing: 1px;">${escapeHTML(match.status)}</span>
            <a href="${escapeHTML(ticketUrl)}" target="_blank" rel="noopener noreferrer" class="btn" style="padding: 6px 12px; font-size: 0.8rem; border: 1px solid var(--surface-border); color: var(--text-main); text-decoration: none;">Pass 🎟️</a>
          </div>
        `;
        listContainer.appendChild(matchCard);
      });
    } catch (err) {
      listContainer.innerHTML = '<div style="color: var(--danger); text-align: center; padding: 20px 0;">Error retrieving match history.</div>';
    }
  }

  [document.getElementById('desktopProfileLink'), document.getElementById('mobileProfileLink')].forEach(btn => {
    if (btn) btn.addEventListener('click', (e) => { 
      e.preventDefault(); 
      closeAppSidebar(); 
      navigateTo('view-account'); 
      loadUserMatches(); 
    });
  });

  [document.getElementById('desktopLoginLink'), document.getElementById('mobileLoginLink')].forEach(btn => {
    if (btn) btn.addEventListener('click', (e) => { e.preventDefault(); closeAppSidebar(); navigateTo('view-entry'); });
  });

  const profileForm = document.getElementById('profileForm');
  if (profileForm) {
    profileForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn = document.getElementById('btnSaveProfile');
      btn.textContent = 'Saving...'; btn.disabled = true;
      
      try {
        const res = await window.Kickoff.fetch('/api/auth/me', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: document.getElementById('accName').value,
            phone: document.getElementById('accPhone').value
          })
        });
        
        const data = await res.json();
        if (res.ok) {
          state.user = data.user;
          if (document.getElementById('playerName')) document.getElementById('playerName').value = state.user.name || '';
          if (document.getElementById('playerPhone')) document.getElementById('playerPhone').value = state.user.phone || '';

          btn.textContent = 'Saved Successfully!';
        } else {
          btn.textContent = 'Error Saving';
        }
      } catch (err) {
        btn.textContent = 'Network Error';
      } finally {
        setTimeout(() => { btn.textContent = 'Save Details'; btn.disabled = false; }, 2000);
      }
    });
  }
const btnLogoutApp = document.getElementById('btnLogoutApp');
  if (btnLogoutApp) {
    btnLogoutApp.addEventListener('click', async () => {
      if (confirm("Are you sure you want to sign out of your profile?")) {
        await window.Kickoff.fetch('/api/auth/logout', { method: 'POST' });
        window.location.reload(); 
      }
    });
  }
  checkUserSession();

  function updateNavHighlight() {
    const navHighlight = document.getElementById('navHighlight');
    const activeLink = document.querySelector('.desktop-nav a.active:not(.admin-badge-link)');
    
    if (activeLink && navHighlight) {
      navHighlight.style.opacity = '1';
      navHighlight.style.width = `${activeLink.offsetWidth}px`;
      navHighlight.style.left = `${activeLink.offsetLeft}px`;
    } else if (navHighlight) {
      navHighlight.style.opacity = '0';
    }
  }

  window.addEventListener('resize', updateNavHighlight);
  setTimeout(updateNavHighlight, 100);

  function setTopNavActive(linkId) {
    document.querySelectorAll('.desktop-nav a').forEach(link => link.classList.remove('active'));
    const activeLink = document.getElementById(linkId);
    if (activeLink) activeLink.classList.add('active');
    updateNavHighlight();
  }

  let origNavigateTo = function(targetId) {
    views.forEach(v => v.classList.remove('active'));
    const targetEl = document.getElementById(targetId);
    if (targetEl) targetEl.classList.add('active');
    window.scrollTo({ top: 0, behavior: 'smooth' });

    const footer = document.querySelector('.modern-footer');
    const isContentPage = ['view-entry', 'view-home', 'view-account', 'view-terms', 'view-privacy', 'view-contact', 'view-support', 'view-rules'].includes(targetId);

    if (isContentPage) {
      if (progressContainer) progressContainer.classList.remove('visible');
      if (footer) footer.style.display = 'flex';
    } else {
      if (progressContainer) progressContainer.classList.add('visible');
      updateProgress(targetId);
      if (footer) footer.style.display = 'none';
    }

    if (targetId === 'view-home') setTopNavActive('topNavHome');
    if (targetId === 'view-date') setTopNavActive('topNavBook');
  };

  function navigateTo(targetId) {
    origNavigateTo(targetId);
    if (targetId === 'view-account' && state.isLoggedIn) {
      loadUserMatches();
    }
  }

  function updateProgress(viewId) {
    steps.forEach(step => step.classList.remove('active'));
    if (viewId === 'view-date') steps[0].classList.add('active');
    if (viewId === 'view-time') { steps[0].classList.add('active'); steps[1].classList.add('active'); }
    if (viewId === 'view-details') { steps[0].classList.add('active'); steps[1].classList.add('active'); steps[2].classList.add('active'); }
    if (viewId === 'view-confirm') steps.forEach(s => s.classList.add('active'));
  }

  document.querySelectorAll('[data-back]').forEach(btn => {
    btn.addEventListener('click', (e) => navigateTo(e.target.dataset.back));
  });

  const btnStart = document.getElementById('btnStart');
  if (btnStart) btnStart.addEventListener('click', () => { generateDates(); navigateTo('view-date'); });

  const sidebar = document.getElementById('sidebar');
  const sidebarOverlay = document.getElementById('sidebarOverlay');
  
  const openSidebarBtn = document.getElementById('openSidebar');
  if (openSidebarBtn) openSidebarBtn.addEventListener('click', () => {
    if (sidebar) sidebar.classList.add('active');
    if (sidebarOverlay) sidebarOverlay.classList.add('active');
  });
  
  const closeSidebarBtn = document.getElementById('closeSidebar');
  if (closeSidebarBtn) closeSidebarBtn.addEventListener('click', closeAppSidebar);
  if (sidebarOverlay) sidebarOverlay.addEventListener('click', closeAppSidebar);

  document.querySelectorAll('.nav-item[data-view], .desktop-nav a[data-view]').forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      closeAppSidebar();
      const targetView = e.currentTarget.getAttribute('data-view');
      if (targetView === 'view-date') generateDates();
      navigateTo(targetView);
    });
  });

  function scrollToHomeSection(sectionId, navLinkId) {
    navigateTo('view-home');
    setTopNavActive(navLinkId);
    setTimeout(() => {
      const section = document.getElementById(sectionId);
      if (section) section.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
  }

  const setupScrollBtn = (btnId, sectionId, topNavId) => {
    const btn = document.getElementById(btnId);
    const topNav = document.getElementById(topNavId);
    if (btn) btn.addEventListener('click', (e) => { e.preventDefault(); scrollToHomeSection(sectionId, topNavId); closeAppSidebar(); });
    if (topNav) topNav.addEventListener('click', (e) => { e.preventDefault(); scrollToHomeSection(sectionId, topNavId); });
  }

  setupScrollBtn('navGalleryBtn', 'gallerySection', 'topNavGallery');
  setupScrollBtn('navLocationBtn', 'locationSection', 'topNavLocation');
  setupScrollBtn('navRulesBtn', 'rulesSection', 'topNavRules');

 function generateDates() {
    // 1. Re-link the container so JS knows where to build the matrix grid
    const dateContainer = document.getElementById('dateTimeline');
    if (!dateContainer) return;
    
    dateContainer.innerHTML = '';
    const today = new Date(window.Kickoff.today() + "T12:00:00");
    
    for (let i = 0; i < 14; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() + i);
      
      const node = document.createElement('button');
      node.type = 'button';
      node.setAttribute('aria-label', d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }));
      node.className = `date-node ${i === 0 ? 'active' : ''}`;
      
      const dayName = i === 0 ? 'TODAY' : d.toLocaleDateString('en-US', { weekday: 'short' });
      const monthName = d.toLocaleDateString('en-US', { month: 'short' });
      
      node.innerHTML = `<span class="date-day">${dayName}</span><span class="date-num">${d.getDate()}</span>`;
      
      if (i === 0 && document.getElementById('monthWatermark')) {
        document.getElementById('monthWatermark').textContent = monthName.toUpperCase();
      }

      node.addEventListener('click', () => {
        document.querySelectorAll('.date-node').forEach(n => n.classList.remove('active'));
        node.classList.add('active');
        state.date = d;
        
        const fullDateStr = d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }).toUpperCase();
        const contextDateEl = document.getElementById('contextDate');
        if (contextDateEl) contextDateEl.textContent = fullDateStr;
        
        setTimeout(() => { generateTimes(); navigateTo('view-time'); }, 200);
      });
      
      dateContainer.appendChild(node);
    }
  }
  async function generateTimes() {
    const container = document.getElementById('timeTimeline');
    if (!container) return;
    container.innerHTML = '<div style="color:var(--text-dim); padding:20px 0;">Loading pitch availability...</div>';
    if (!state.date) return;

    const year = state.date.getFullYear();
    const month = String(state.date.getMonth() + 1).padStart(2, '0');
    const day = String(state.date.getDate()).padStart(2, '0');
    const dateStr = `${year}-${month}-${day}`;
    
    try {
      const response = await window.Kickoff.fetch(`/api/availability?date=${dateStr}`);
      const data = await response.json();

      if (!response.ok || !data.schedule) {
        container.innerHTML = `<div style="color:var(--text-dim); padding:20px 0;">${escapeHTML(data.error || 'Could not load schedule.')}</div>`;
        return;
      }

      container.innerHTML = '';
      data.schedule.forEach(slot => {
        const node = document.createElement('button');
        node.type = 'button'; node.disabled = !slot.available;
        node.className = `time-node ${slot.available ? 'available' : 'booked'}`;
        
        const statusText = !slot.available ? 'BOOKED' : (slot.isPopular ? '🔥 FAST FILLING' : 'AVAILABLE');

        node.innerHTML = `<span class="time-val">${escapeHTML(slot.time)}</span><span class="time-status">${statusText}</span>`;

        if (slot.available) {
          node.addEventListener('click', () => {
            document.querySelectorAll('.time-node').forEach(n => n.classList.remove('selected'));
            node.classList.add('selected');
            
            state.time = slot.time;
            const fullDateStr = state.date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }).toUpperCase();
            const contextSessionEl = document.getElementById('contextSession');
            if (contextSessionEl) contextSessionEl.textContent = `${fullDateStr} — ${state.time}`;
            
            setTimeout(() => navigateTo('view-details'), 250);
          });
        }
        container.appendChild(node);
      });
    } catch (err) {
      container.innerHTML = '<div style="color:var(--text-dim); padding:20px 0;">Error querying pitch availability. Check server logs.</div>';
    }
  }

  const bookingForm = document.getElementById('bookingForm');
  const confirmModal = document.getElementById('confirmModal');
  const btnCancelConfirm = document.getElementById('btnCancelConfirm');
  const btnProceedConfirm = document.getElementById('btnProceedConfirm');
  const btnHome = document.getElementById('btnHome');

  if (btnHome) btnHome.addEventListener('click', () => { if (bookingForm) bookingForm.reset(); navigateTo('view-home'); });

  if (bookingForm) {
    bookingForm.onsubmit = (e) => {
      e.preventDefault();
      if (!state.date || !state.time) return alert("Please select a valid date and time.");
      const inputName = document.getElementById('playerName').value.trim();
      const inputPhone = document.getElementById('playerPhone').value.trim();
      if (!inputName || !inputPhone) return alert("Please complete all required fields.");

      state.playerName = inputName;
      state.playerPhone = inputPhone;
      if (confirmModal) confirmModal.classList.add('active');
    };
  }

  if (btnCancelConfirm) btnCancelConfirm.addEventListener('click', () => confirmModal.classList.remove('active'));

  if (btnProceedConfirm) {
    btnProceedConfirm.addEventListener('click', async () => {
      if (btnProceedConfirm.disabled) return;
      btnProceedConfirm.disabled = true;
      btnProceedConfirm.textContent = "PROCESSING...";

      const year = state.date.getFullYear();
      const month = String(state.date.getMonth() + 1).padStart(2, '0');
      const day = String(state.date.getDate()).padStart(2, '0');
      const dateStr = `${year}-${month}-${day}`;

      try {
        const res = await window.Kickoff.fetch('/api/reservations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: state.playerName,
            phone: state.playerPhone,
            date: dateStr,
            time: state.time
          })
        });

        const result = await res.json();

        if (!res.ok) {
          btnProceedConfirm.disabled = false; btnProceedConfirm.textContent = "Understand & Book";
          confirmModal.classList.remove('active');
          alert(result.error || "Could not reserve pitch.");
          return;
        }

        state.reservationId = result.reservation.id;
        const bookingSession = await window.Kickoff.bootstrap();
        const configuredNumber = bookingSession.settings?.businessWhatsApp;
        state.businessWhatsApp = /^[0-9]{8,15}$/.test(configuredNumber || '') ? configuredNumber : BUSINESS_WHATSAPP;

        document.getElementById('ticketId').textContent = state.reservationId;
        document.getElementById('resDate').textContent = state.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }).toUpperCase();
        document.getElementById('resTime').textContent = state.time;
        document.getElementById('resName').textContent = state.playerName.toUpperCase();

        const ticketUrl = new URL(result.ticket.url, window.location.origin).href;
        const qrImageElement = document.querySelector('.qr-img');
        if (qrImageElement) {
          qrImageElement.src = result.ticket.qrUrl;
          qrImageElement.style.cursor = 'pointer';
          qrImageElement.onclick = () => window.open(ticketUrl, '_blank', 'noopener,noreferrer');
        }

        btnProceedConfirm.disabled = false; 
        btnProceedConfirm.textContent = "Understand & Book";
        confirmModal.classList.remove('active');
        navigateTo('view-confirm');
        
        setTimeout(openWhatsApp, 300); 

      } catch (err) {
        btnProceedConfirm.disabled = false; btnProceedConfirm.textContent = "Understand & Book";
        confirmModal.classList.remove('active');
        alert(err.message || "Network error. Please try again.");
      }
    });
  }

  function openWhatsApp() {
    if (!state.date || !state.time || !state.reservationId) return;
    const formattedDate = state.date.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    const message = `⚽ PITCH BOOKING REQUEST\n\nHi! I just booked a slot on the website and want to confirm my pending reservation.\n\n👤 Name: ${state.playerName}\n📱 Phone: ${state.playerPhone}\n📅 Date: ${formattedDate}\n⏰ Time: ${state.time}\n🎟️ Ticket ID: ${state.reservationId}\n\nPlease let me know when this is locked in!`;
    const encoded = encodeURIComponent(message);
    window.location.href = `https://wa.me/${state.businessWhatsApp || BUSINESS_WHATSAPP}?text=${encoded}`;
  }

  document.querySelectorAll('[data-digits-only]').forEach(input => {
    input.addEventListener('input', () => { input.value = input.value.replace(/[^0-9]/g, ''); });
  });
  document.querySelectorAll('[data-hover-accent]').forEach(link => {
    link.addEventListener('mouseover', () => { link.style.color = 'var(--accent)'; });
    link.addEventListener('mouseout', () => { link.style.color = 'var(--text-dim)'; });
  });

  const canvas = document.getElementById('ambientCanvas');
  if (canvas) {
    const ctx = canvas.getContext('2d');
    let width, height, particles = [];

    function initCanvas() {
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
      particles = [];
      for (let i = 0; i < 40; i++) {
        particles.push({ x: Math.random() * width, y: Math.random() * height, r: Math.random() * 1.5 + 0.5, dx: (Math.random() - 0.5) * 0.2, dy: (Math.random() - 0.5) * 0.2, baseAlpha: Math.random() * 0.5 + 0.1 });
      }
    }

    function animateCanvas() {
      ctx.clearRect(0, 0, width, height);
      particles.forEach(p => {
        p.x += p.dx; p.y += p.dy;
        if (p.x < 0 || p.x > width) p.dx *= -1;
        if (p.y < 0 || p.y > height) p.dy *= -1;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(0, 255, 102, ${p.baseAlpha})`;
        ctx.fill();
      });
      requestAnimationFrame(animateCanvas);
    }

    window.addEventListener('resize', initCanvas);
    initCanvas();
    animateCanvas();
  }

  const scrollObserver = new IntersectionObserver((entries, observer) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        observer.unobserve(entry.target); 
      }
    });
  }, { root: null, rootMargin: '0px', threshold: 0.15 });

  document.querySelectorAll('.reveal-3d').forEach(el => scrollObserver.observe(el));
});
