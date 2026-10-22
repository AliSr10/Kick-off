document.addEventListener('DOMContentLoaded', async () => {

  const authCheck = await window.Kickoff.fetch('/api/admin/check-session');
  const authData = await authCheck.json();
  if (!authData.authenticated) {
    window.location.href = '/admin/index.html';
    return;
  }
  document.getElementById('operatorName').textContent = authData.user;

  let currentDate = window.Kickoff.today();
  document.getElementById('scheduleDateInput').value = currentDate;
  document.getElementById('mDate').value = currentDate;

  function escapeHTML(value) {
    return String(value ?? '').replace(/[&<>"']/g, (char) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;'
    }[char]));
  }
  
  async function loadStats() {
    const res = await window.Kickoff.fetch('/api/admin/dashboard-stats');
    if (res.ok) {
      const stats = await res.json();
      document.getElementById('statToday').textContent = stats.todayMatches || 0;
      document.getElementById('statPending').textContent = stats.pending || 0;
      document.getElementById('statUpcoming').textContent = stats.upcoming || 0;
      document.getElementById('statCancelled').textContent = stats.cancelled || 0;
    }
  }

  let volumeChart = null;

  async function loadAnalytics() {
    try {
      const res = await window.Kickoff.fetch('/api/admin/analytics');
      const data = await res.json();
      if (!data.analytics) return;

      // Create an empty 30-day timeline
      const labels = [];
      const dataMap = {};
      const today = new Date();
      
      for (let i = 29; i >= 0; i--) {
        const d = new Date(today);
        d.setDate(d.getDate() - i);
        const dateStr = d.toISOString().split('T')[0];
        // Format label as "Oct 24"
        labels.push(d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }));
        dataMap[dateStr] = 0; // Default to 0 matches
      }

      // Fill in actual booking counts
      data.analytics.forEach(row => {
        if (dataMap[row.date] !== undefined) {
          dataMap[row.date] = row.count;
        }
      });

      const chartData = Object.values(dataMap);

      const ctx = document.getElementById('analyticsChart').getContext('2d');
      
      // Destroy old chart if reloading
      if (volumeChart) volumeChart.destroy();

      // Create glowing gradient fill
      const gradient = ctx.createLinearGradient(0, 0, 0, 250);
      gradient.addColorStop(0, 'rgba(0, 255, 102, 0.4)');
      gradient.addColorStop(1, 'rgba(0, 255, 102, 0.0)');

      volumeChart = new Chart(ctx, {
        type: 'line',
        data: {
          labels: labels,
          datasets: [{
            label: 'Confirmed Bookings',
            data: chartData,
            borderColor: '#00FF66',
            backgroundColor: gradient,
            borderWidth: 3,
            pointBackgroundColor: '#050708',
            pointBorderColor: '#00FF66',
            pointBorderWidth: 2,
            pointRadius: 4,
            pointHoverRadius: 6,
            fill: true,
            tension: 0.4 // Makes the line smooth and curvy
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: {
            y: { 
              beginAtZero: true, 
              ticks: { stepSize: 1, color: '#738078', font: { family: 'Space Mono' } },
              grid: { color: 'rgba(255, 255, 255, 0.05)' }
            },
            x: { 
              ticks: { color: '#738078', font: { family: 'Inter' }, maxTicksLimit: 10 },
              grid: { display: false }
            }
          }
        }
      });
    } catch (err) {
      console.error("Chart load failed:", err);
    }
  }

  async function loadTimeline() {
    const grid = document.getElementById('timelineGrid');
    grid.innerHTML = '<div style="color:var(--text-muted)">Querying schedule...</div>';

    const [availRes, fullData] = await Promise.all([
      window.Kickoff.fetch(`/api/availability?date=${currentDate}`),
      window.Kickoff.allReservations({ date: currentDate })
    ]);

    const availData = await availRes.json();
    const activeBookings = fullData.reservations.filter(r => ['CONFIRMED', 'PENDING'].includes(r.status));

    grid.innerHTML = '';

    availData.schedule.forEach(slot => {
      const standardBooking = activeBookings.find(b => b.time === slot.time && b.status === 'CONFIRMED') || activeBookings.find(b => b.time === slot.time);
      const isBlockedByVIP = !slot.available && !standardBooking;

      const row = document.createElement('div');
      
      if (standardBooking) {
        row.className = 'timeline-row occupied';
        const statusColor = standardBooking.status === 'PENDING' ? '#FFB020' : 'var(--accent)';
        row.innerHTML = `
          <div class="timeline-time">${escapeHTML(slot.time)}</div>
          <div class="timeline-meta">
            <div class="timeline-player" style="color: ${statusColor};">${escapeHTML(standardBooking.name)} [${escapeHTML(standardBooking.status)}]</div>
            <div class="timeline-phone">${escapeHTML(standardBooking.phone)}</div> 
          </div>
          <button class="btn btn-secondary btn-sm" data-action="openDetailsModal" data-value="${escapeHTML(standardBooking.id)}">Manage</button>
        `;
      } else if (isBlockedByVIP) {
        row.className = 'timeline-row occupied';
        row.innerHTML = `
          <div class="timeline-time">${escapeHTML(slot.time)}</div>
          <div class="timeline-meta">
            <div class="timeline-player" style="color: var(--accent);">VIP FIXED BOOKING</div>
            <div class="timeline-phone">Manage in Fixed Bookings tab</div>
          </div>
          <button class="btn btn-secondary btn-sm" disabled>Locked</button>
        `;
      } else {
        row.className = 'timeline-row vacant';
        row.innerHTML = `
          <div class="timeline-time">${escapeHTML(slot.time)}</div>
          <div class="timeline-meta"><span style="color:var(--text-muted)">Vacant Slot</span></div>
          <button class="btn btn-primary btn-sm" data-action="quickBook" data-value="${escapeHTML(slot.time)}">+ Book</button>
        `;
      }
      grid.appendChild(row);
    });
  }

  async function loadReservationsList() {
    const tbody = document.getElementById('reservationsTableBody');
    const search = document.getElementById('searchInput').value;
    const status = document.getElementById('statusFilter').value;

    const data = await window.Kickoff.allReservations({ search, status });

    tbody.innerHTML = '';
    if (data.reservations.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; color:var(--text-muted)">No matching records found.</td></tr>';
      return;
    }

    const todayStr = window.Kickoff.today();

    data.reservations.forEach(r => {
      const tr = document.createElement('tr');
      const safeStatus = ['PENDING', 'CONFIRMED', 'CANCELLED'].includes(r.status) ? r.status : 'UNKNOWN';
      
      const isPast = r.date < todayStr;
      tr.style.opacity = isPast ? '0.55' : '1';
      tr.style.filter = isPast ? 'grayscale(100%)' : 'none';

      let actionHtml = '';
      
      if (isPast) {
        actionHtml = `<span style="color: var(--text-muted); font-size: 0.85rem; font-family: var(--font-mono);">ARCHIVED</span>`;
      } else if (r.status === 'PENDING') {
        actionHtml = `
          <button class="btn btn-sm" style="background: var(--accent); color: #000; margin-right: 8px;" data-action="confirmReservation" data-value="${escapeHTML(r.id)}">Confirm</button>
          <button class="btn btn-danger btn-sm" data-action="cancelReservation" data-value="${escapeHTML(r.id)}">Cancel</button>
        `;
      } else if (r.status === 'CONFIRMED') {
        actionHtml = `<button class="btn btn-secondary btn-sm" data-action="openDetailsModal" data-value="${escapeHTML(r.id)}">Inspect</button>`;
      } else {
        actionHtml = `<span style="color: var(--text-muted); font-size: 0.8rem;">Cancelled</span>`;
      }

      tr.innerHTML = `
        <td style="font-family:var(--font-mono); font-weight:700">${escapeHTML(r.id)}</td>
        <td><strong>${escapeHTML(r.name)}</strong></td>
        <td>${escapeHTML(r.phone)}</td>
        <td>${escapeHTML(r.date)} @ ${escapeHTML(r.time)}</td>
        <td><span class="status-pill ${safeStatus}">${escapeHTML(safeStatus)}</span></td>
        <td class="text-right">${actionHtml}</td>
      `;
      tbody.appendChild(tr);
    });
  }

  let searchTimer;
  let currentFixedBookings = [];
  async function loadFixedBookings() {
    const tbody = document.getElementById('fixedBookingsTableBody');
    if (!tbody) return;
    const res = await window.Kickoff.fetch('/api/admin/standing-bookings');
    const data = await res.json();
    currentFixedBookings = data.standingBookings; 

    tbody.innerHTML = '';
    if (data.standingBookings.length === 0) {
      tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; color:var(--text-muted)">No fixed VIP bookings active.</td></tr>';
      return;
    }

    const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    data.standingBookings.forEach(sb => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${escapeHTML(sb.id)}</td>
        <td><strong style="color:var(--accent)">${escapeHTML(sb.playerName)}</strong></td>
        <td>${escapeHTML(sb.phone || 'N/A')}</td>
        <td>Every <strong>${escapeHTML(days[sb.dayOfWeek])}</strong> @ ${escapeHTML(sb.time)}</td>
        <td class="text-right">
          <button class="btn btn-secondary btn-sm" data-action="openEditFixedModal" data-value="${escapeHTML(sb.id)}">Edit</button>
          <button class="btn btn-danger btn-sm" data-action="cancelFixedBooking" data-value="${escapeHTML(sb.id)}">Remove</button>
        </td>
      `;
      tbody.appendChild(tr);
    });
  }

  document.querySelectorAll('.nav-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.content-view').forEach(v => v.classList.remove('active'));
      tab.classList.add('active');
      const targetView = tab.dataset.view;
      document.getElementById(`view-${targetView}`).classList.add('active');

      if (targetView === 'timeline') loadTimeline();
      if (targetView === 'list') loadReservationsList();
      if (targetView === 'fixed') loadFixedBookings();
    });
  });

  document.getElementById('scheduleDateInput').addEventListener('change', (e) => { currentDate = e.target.value; loadTimeline(); });
  if (document.getElementById('searchInput')) document.getElementById('searchInput').addEventListener('input', () => { clearTimeout(searchTimer); searchTimer = setTimeout(loadReservationsList, 250); });
  
  const filterStatus = document.getElementById('statusFilter');
  const btnClearHistory = document.getElementById('btnClearHistory');
  const clearHistoryModal = document.getElementById('clearHistoryModal');
  
  if (filterStatus) {
    filterStatus.addEventListener('change', () => {
      btnClearHistory.style.display = filterStatus.value === 'CANCELLED' ? 'inline-block' : 'none';
      loadReservationsList();
    });
  }

  if (btnClearHistory) {
    btnClearHistory.addEventListener('click', () => clearHistoryModal.classList.add('active'));
    document.getElementById('btnCancelClear').addEventListener('click', () => clearHistoryModal.classList.remove('active'));
    document.getElementById('btnConfirmClear').addEventListener('click', async () => {
      document.getElementById('btnConfirmClear').textContent = "Clearing...";
      const response = await window.Kickoff.fetch('/api/admin/reservations/cancelled', { method: 'DELETE' });
      if (!response.ok) { alert((await response.json()).error || 'Could not clear history.'); document.getElementById('btnConfirmClear').textContent = 'Yes, Delete'; return; }
      clearHistoryModal.classList.remove('active');
      document.getElementById('btnConfirmClear').textContent = "Yes, Delete";
      loadReservationsList(); loadStats();
    });
  }

  window.openDetailsModal = async (id) => {
    const res = await window.Kickoff.fetch(`/api/admin/reservations?search=${encodeURIComponent(id)}`);
    const data = await res.json();
    const item = data.reservations.find(r => r.id === id);
    if (!item) return;

    document.getElementById('dRef').textContent = `RESERVATION #${item.id}`;
    document.getElementById('detailsContent').innerHTML = `
      <div style="margin-bottom:16px;">
        <span style="color:var(--text-muted); font-size:0.8rem">PLAYER</span>
        <div style="font-size:1.2rem; font-weight:700">${escapeHTML(item.name)}</div>
        <div style="color:var(--text-muted); font-family:var(--font-mono)">${escapeHTML(item.phone)}</div>
      </div>
      <div>
        <span style="color:var(--text-muted); font-size:0.8rem">SESSION</span>
        <div>${escapeHTML(item.date)} (${escapeHTML(item.time)})</div>  
      </div>
    `;

    const actions = document.getElementById('detailsActions');
    if (item.status === 'PENDING') {
      actions.innerHTML = `
        <button class="btn w-full" style="background: var(--accent); color: #000; margin-bottom: 8px;" data-action="confirmReservation" data-value="${escapeHTML(item.id)}">Approve Pending Slot</button>
        <button class="btn btn-danger w-full" data-action="cancelReservation" data-value="${escapeHTML(item.id)}">Reject & Release Slot</button>
      `;
    } else if (item.status === 'CONFIRMED') {
      actions.innerHTML = `<button class="btn btn-danger w-full" data-action="cancelReservation" data-value="${escapeHTML(item.id)}">Cancel Reservation & Release Slot</button>`;
    } else {
      actions.innerHTML = `<button class="btn btn-secondary w-full" disabled>Reservation is Cancelled</button>`;
    }
    document.getElementById('detailsModal').classList.add('active');
  };

  window.confirmReservation = async (id) => {
    const response = await window.Kickoff.fetch(`/api/admin/reservations/${encodeURIComponent(id)}/confirm`, { method: 'PATCH' });
    if (!response.ok) { alert((await response.json()).error || 'Confirmation failed.'); return; }
    document.getElementById('detailsModal').classList.remove('active');
    loadStats(); loadTimeline(); loadReservationsList();
  };

  window.cancelReservation = async (id) => {
    if (!confirm(`Are you sure you want to cancel ${id}? The slot will immediately open for customers.`)) return;
    const response = await window.Kickoff.fetch(`/api/admin/reservations/${encodeURIComponent(id)}/cancel`, { method: 'PATCH' });
    if (!response.ok) { alert((await response.json()).error || 'Cancellation failed.'); return; }
    document.getElementById('detailsModal').classList.remove('active');
    loadStats(); loadTimeline(); loadReservationsList();
  };

  window.cancelFixedBooking = async (id) => {
    if (!confirm(`Are you sure you want to delete this Fixed Booking?`)) return;
    const response = await window.Kickoff.fetch(`/api/admin/standing-bookings/${encodeURIComponent(id)}`, { method: 'DELETE' });
    if (!response.ok) { alert((await response.json()).error || 'Removal failed.'); return; }
    loadFixedBookings(); loadTimeline();
  };

  window.openEditFixedModal = (id) => {
    const item = currentFixedBookings.find(sb => String(sb.id) === String(id));
    if (!item) return;
    document.getElementById('editFId').value = item.id;
    document.getElementById('editFName').value = item.playerName;
    document.getElementById('editFPhone').value = item.phone || '';
    document.getElementById('editFDay').value = item.dayOfWeek;
    document.getElementById('editFTime').value = item.time;
    document.getElementById('editFixedModal').classList.add('active');
  };

  window.quickBook = (time) => {
    document.getElementById('mTime').value = time;
    document.getElementById('mDate').value = currentDate;
    document.getElementById('createModal').classList.add('active');
  };

  document.querySelectorAll('[data-close]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      document.getElementById(e.target.dataset.close).classList.remove('active');
    });
  });

  document.getElementById('manualBookingForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const payload = {
      name: document.getElementById('mName').value, phone: document.getElementById('mPhone').value,
      date: document.getElementById('mDate').value, time: document.getElementById('mTime').value
    };
    const res = await window.Kickoff.fetch('/api/admin/reservations', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    if (res.ok) {
      document.getElementById('createModal').classList.remove('active');
      document.getElementById('manualBookingForm').reset();
      loadStats(); loadTimeline(); loadReservationsList();
    } else alert((await res.json()).error || 'The booking could not be saved.');
  });

  document.getElementById('fixedBookingForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const payload = {
      playerName: document.getElementById('fName').value.trim(), phone: document.getElementById('fPhone').value.trim(),
      dayOfWeek: Number(document.getElementById('fDay').value), time: document.getElementById('fTime').value
    };
    const res = await window.Kickoff.fetch('/api/admin/standing-bookings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    if (res.ok) {
      document.getElementById('fixedModal').classList.remove('active');
      document.getElementById('fixedBookingForm').reset();
      loadFixedBookings(); loadTimeline();
    } else alert((await res.json()).error || 'The weekly booking could not be saved.');
  });

  document.getElementById('editFixedBookingForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('editFId').value;
    const payload = {
      playerName: document.getElementById('editFName').value.trim(), phone: document.getElementById('editFPhone').value.trim(),
      dayOfWeek: Number(document.getElementById('editFDay').value), time: document.getElementById('editFTime').value
    };
    const res = await window.Kickoff.fetch(`/api/admin/standing-bookings/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    if (res.ok) {
      document.getElementById('editFixedModal').classList.remove('active');
      loadFixedBookings(); loadTimeline();
    } else alert((await res.json()).error || 'The weekly booking could not be saved.');
  });

  document.getElementById('btnOpenCreateModal').addEventListener('click', () => document.getElementById('createModal').classList.add('active'));
  document.getElementById('btnOpenFixedModal').addEventListener('click', () => document.getElementById('fixedModal').classList.add('active'));
document.getElementById('btnLogout').addEventListener('click', async () => {
    if (confirm("Close staff terminal and sign out?")) {
      await window.Kickoff.fetch('/api/admin/logout', { method: 'POST' });
      window.location.href = '/admin/index.html';
    }
  });

  const actions = {
    openDetailsModal: value => window.openDetailsModal(value), quickBook: value => window.quickBook(value),
    confirmReservation: value => window.confirmReservation(value), cancelReservation: value => window.cancelReservation(value),
    openEditFixedModal: value => window.openEditFixedModal(value), cancelFixedBooking: value => window.cancelFixedBooking(value)
  };
  document.addEventListener('click', event => {
    const button = event.target.closest('button[data-action]');
    if (!button || button.disabled || !Object.hasOwn(actions, button.dataset.action)) return;
    Promise.resolve(actions[button.dataset.action](button.dataset.value)).catch(error => alert(error.message || 'The request could not be completed.'));
  });

  flatpickr("#scheduleDateInput", { defaultDate: currentDate, dateFormat: "Y-m-d", onChange: function(selectedDates, dateStr) { currentDate = dateStr; loadTimeline(); }});
  flatpickr("#mDate", { defaultDate: currentDate, dateFormat: "Y-m-d" });
  
  loadStats(); loadTimeline(); loadAnalytics();
});