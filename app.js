// ───── TrackFlow Dashboard App ─────

let currentSiteId = null;
let currentPeriod = '7d';
let viewsChart = null;
let sites = [];

// ───── VIEWS ─────
function showView(view) {
  document.getElementById('dashboard-view').classList.toggle('active', view === 'dashboard');
  document.getElementById('sites-view').classList.toggle('active', view === 'sites');
  document.getElementById('nav-dashboard').classList.toggle('active', view === 'dashboard');
  document.getElementById('nav-sites').classList.toggle('active', view === 'sites');

  if (view === 'sites') {
    loadSites();
  }
}

// ───── LOAD SITES ─────
async function loadSites() {
  try {
    const res = await fetch('/api/sites');
    if (!res.ok) {
      sites = [];
    } else {
      sites = await res.json();
      if (!Array.isArray(sites)) sites = [];
    }

    // Update selector
    const selector = document.getElementById('site-selector');
    selector.innerHTML = '<option value="">Select a site...</option>';
    sites.forEach((site) => {
      const opt = document.createElement('option');
      opt.value = site.id;
      opt.textContent = site.domain || site.name;
      selector.appendChild(opt);
    });

    // Restore selection
    if (currentSiteId) {
      selector.value = currentSiteId;
    }

    // Update sites grid
    renderSitesGrid();
  } catch (err) {
    console.error('Failed to load sites:', err);
  }
}

function renderSitesGrid() {
  const grid = document.getElementById('sites-grid');

  if (!sites.length) {
    grid.innerHTML = `
      <div class="empty-state">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
          <rect width="18" height="18" x="3" y="3"/>
          <path d="M3 9h18"/><path d="M9 21V9"/>
        </svg>
        <h3>No sites tracked yet</h3>
        <p>Add your first site to start tracking traffic</p>
        <button class="btn btn-primary" style="margin-top: 8px;" onclick="openAddSite()">+ Add Site</button>
      </div>`;
    return;
  }

  grid.innerHTML = sites
    .map(
      (site) => `
    <div class="site-card" onclick="selectSite('${site.id}')">
      <div class="site-card-name">${escapeHtml(site.name)}</div>
      <div class="site-card-domain">${escapeHtml(site.domain)}</div>
      <div class="site-card-actions">
        <button class="btn-icon" title="View snippet" onclick="event.stopPropagation(); showSiteSnippet('${site.id}', '${escapeHtml(site.domain)}')">
          <svg width="14" height="14" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m18 16 4-4-4-4"/><path d="m6 8-4 4 4 4"/><path d="m14.5 4-5 16"/></svg>
        </button>
        <button class="btn-icon danger" title="Delete site" onclick="event.stopPropagation(); deleteSite('${site.id}', '${escapeHtml(site.name)}')">
          <svg width="14" height="14" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
        </button>
      </div>
    </div>`
    )
    .join('');
}

// ───── SELECT SITE ─────
function selectSite(siteId) {
  currentSiteId = siteId;
  document.getElementById('site-selector').value = siteId;
  showView('dashboard');
  loadStats();
  updateSnippet();
}

// ───── LOAD STATS ─────
async function loadStats() {
  if (!currentSiteId) return;

  try {
    const res = await fetch(`/api/stats?site_id=${currentSiteId}&period=${currentPeriod}`);
    const data = await res.json();
    renderStats(data);
  } catch (err) {
    console.error('Failed to load stats:', err);
  }
}

function renderStats(data) {
  // Total views
  document.getElementById('stat-views').textContent = formatNumber(data.total_views);
  renderChange('stat-views-change', data.total_views, data.prev_total_views);

  // Unique visitors
  document.getElementById('stat-visitors').textContent = formatNumber(data.unique_visitors);
  renderChange('stat-visitors-change', data.unique_visitors, data.prev_unique_visitors);

  // Top page
  const topPage = data.top_pages?.[0];
  document.getElementById('stat-top-page').textContent = topPage ? topPage.path : '—';

  // Top country
  const topCountry = data.top_countries?.[0];
  document.getElementById('stat-top-country').textContent = topCountry ? topCountry.country : '—';

  // Chart
  renderChart(data.views_over_time);

  // Top pages
  renderTable('top-pages-list', data.top_pages, (item) => ({
    name: item.path,
    value: formatNumber(item.views),
  }));

  // Top referrers
  renderTable('top-referrers-list', data.top_referrers, (item) => ({
    name: prettifyReferrer(item.referrer),
    value: formatNumber(item.views),
  }));
}

function renderChange(elementId, current, previous) {
  const el = document.getElementById(elementId);
  if (!previous || previous === 0) {
    el.innerHTML = '<span style="color: var(--text-muted)">No prior data</span>';
    return;
  }
  const pct = (((current - previous) / previous) * 100).toFixed(1);
  const isUp = pct >= 0;
  const arrow = isUp
    ? '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/></svg>'
    : '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 17 13.5 8.5 8.5 13.5 2 7"/><polyline points="16 17 22 17 22 11"/></svg>';

  el.className = `stat-change ${isUp ? 'up' : 'down'}`;
  el.innerHTML = `${arrow}<span>${isUp ? '+' : ''}${pct}%</span>`;
}

// ───── CHART ─────
function renderChart(viewsOverTime) {
  const ctx = document.getElementById('views-chart');
  if (!ctx) return;

  if (viewsChart) {
    viewsChart.destroy();
  }

  const labels = viewsOverTime.map((d) => {
    const date = new Date(d.date);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  });
  const values = viewsOverTime.map((d) => d.views);

  viewsChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [
        {
          data: values,
          backgroundColor: createGradient(ctx, '#00D4AA', '#00D4AA33'),
          borderColor: '#00D4AA',
          borderWidth: 1,
          borderSkipped: false,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: '#1A1A1A',
          borderColor: '#2A2A2A',
          borderWidth: 1,
          titleColor: '#F0F0F0',
          bodyColor: '#00D4AA',
          titleFont: { family: 'Inter', size: 12 },
          bodyFont: { family: 'Space Grotesk', size: 14, weight: '600' },
          padding: 12,
          cornerRadius: 0,
          displayColors: false,
          callbacks: {
            label: (ctx) => formatNumber(ctx.parsed.y) + ' views',
          },
        },
      },
      scales: {
        x: {
          grid: { color: '#2A2A2A', drawBorder: false },
          ticks: { color: '#666', font: { family: 'Inter', size: 11 } },
          border: { display: false },
        },
        y: {
          grid: { color: '#2A2A2A', drawBorder: false },
          ticks: {
            color: '#666',
            font: { family: 'Inter', size: 11 },
            callback: (v) => formatNumber(v),
          },
          border: { display: false },
        },
      },
    },
  });
}

function createGradient(canvas, topColor, bottomColor) {
  const ctx = canvas.getContext ? canvas.getContext('2d') : canvas.ctx;
  if (!ctx || !ctx.createLinearGradient) return topColor;
  const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height || 300);
  gradient.addColorStop(0, topColor);
  gradient.addColorStop(1, bottomColor);
  return gradient;
}

// ───── TABLE ─────
function renderTable(elementId, items, mapper) {
  const el = document.getElementById(elementId);
  if (!items || !items.length) {
    el.innerHTML = '<div class="empty-state" style="padding: 24px;"><p>No data yet</p></div>';
    return;
  }

  el.innerHTML = items
    .slice(0, 5)
    .map((item) => {
      const { name, value } = mapper(item);
      return `
      <div class="table-row">
        <span class="table-row-name" title="${escapeHtml(name)}">${escapeHtml(name)}</span>
        <span class="table-row-value">${value}</span>
      </div>`;
    })
    .join('');
}

// ───── PERIOD ─────
function setPeriod(period) {
  currentPeriod = period;
  document.querySelectorAll('.period-chip').forEach((chip) => {
    chip.classList.toggle('active', chip.textContent.toLowerCase() === period);
  });
  loadStats();
}

// ───── ADD SITE ─────
function openAddSite() {
  document.getElementById('add-site-modal').classList.add('active');
  document.getElementById('site-name-input').value = '';
  document.getElementById('site-domain-input').value = '';
  document.getElementById('site-name-input').focus();
}

function closeAddSite() {
  document.getElementById('add-site-modal').classList.remove('active');
}

async function addSite() {
  const name = document.getElementById('site-name-input').value.trim();
  const domain = document.getElementById('site-domain-input').value.trim();

  if (!name || !domain) {
    alert('Please fill in both fields');
    return;
  }

  try {
    const res = await fetch('/api/sites', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, domain }),
    });

    if (!res.ok) {
      const err = await res.json();
      alert(err.error || 'Failed to add site');
      return;
    }

    const newSite = await res.json();
    closeAddSite();
    await loadSites();
    selectSite(newSite.id);
  } catch (err) {
    alert('Failed to add site');
    console.error(err);
  }
}

// ───── DELETE SITE ─────
async function deleteSite(id, name) {
  if (!confirm(`Delete "${name}" and all its tracking data? This cannot be undone.`)) return;

  try {
    const res = await fetch(`/api/sites?id=${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Failed');

    if (currentSiteId === id) {
      currentSiteId = null;
      document.getElementById('site-selector').value = '';
    }

    await loadSites();
  } catch (err) {
    alert('Failed to delete site');
    console.error(err);
  }
}

// ───── SNIPPET ─────
function updateSnippet() {
  const section = document.getElementById('snippet-section');
  const code = document.getElementById('snippet-code');

  if (!currentSiteId) {
    section.style.display = 'none';
    return;
  }

  const baseUrl = window.location.origin;
  const snippet = `<script src="${baseUrl}/tracker.js" data-site-id="${currentSiteId}" defer><\/script>`;

  section.style.display = 'flex';
  code.textContent = snippet;

  // Re-add copy button
  const copyBtn = document.createElement('button');
  copyBtn.className = 'snippet-copy';
  copyBtn.textContent = 'Copy';
  copyBtn.onclick = copySnippet;
  code.appendChild(copyBtn);
}

function showSiteSnippet(siteId, domain) {
  currentSiteId = siteId;
  document.getElementById('site-selector').value = siteId;
  showView('dashboard');
  loadStats();
  updateSnippet();

  // Scroll to snippet
  setTimeout(() => {
    document.getElementById('snippet-section').scrollIntoView({ behavior: 'smooth' });
  }, 100);
}

function copySnippet() {
  const code = document.getElementById('snippet-code');
  const text = code.textContent.replace('Copy', '').trim();
  navigator.clipboard.writeText(text).then(() => {
    const btn = code.querySelector('.snippet-copy');
    btn.textContent = 'Copied!';
    setTimeout(() => (btn.textContent = 'Copy'), 2000);
  });
}

// ───── HELPERS ─────
function formatNumber(n) {
  if (n == null) return '0';
  return new Intl.NumberFormat('en-US').format(n);
}

function prettifyReferrer(ref) {
  if (!ref) return 'Direct';
  try {
    const url = new URL(ref);
    return url.hostname;
  } catch {
    return ref;
  }
}

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ───── INIT ─────
document.getElementById('site-selector').addEventListener('change', (e) => {
  const siteId = e.target.value;
  if (siteId) {
    selectSite(siteId);
  }
});

// Handle Enter key in modal
document.getElementById('site-domain-input').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') addSite();
});

// Close modal on overlay click
document.getElementById('add-site-modal').addEventListener('click', (e) => {
  if (e.target.classList.contains('modal-overlay')) closeAddSite();
});

// Load on startup
loadSites();
