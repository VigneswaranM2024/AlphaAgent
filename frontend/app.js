/* =====================================================
   AlphaAgent — app.js
   Features: Single analysis + SSE streaming,
             Stock price chart (Chart.js),
             Watchlist (localStorage),
             Multi-stock comparison (SSE).
===================================================== */

// ── Configuration ───────────────────────────────────────
const API_BASE = ''; // Uses relative path to the current origin

// ── DOM Refs ──────────────────────────────────────────
const form = document.getElementById('search-form');
const queryInput = document.getElementById('query-input');
const analyzeBtn = document.getElementById('analyze-btn');
const btnText = document.getElementById('btn-text');
const btnSpinner = document.getElementById('btn-spinner');
const statusSection = document.getElementById('status-section');
const statusLabel = document.getElementById('status-label');
const streamingLog = document.getElementById('streaming-log');
const reportSection = document.getElementById('report-section');
const reportContent = document.getElementById('report-content');
const reportChip = document.getElementById('report-company-label');
const welcomeSection = document.getElementById('welcome-section');
const errorSection = document.getElementById('error-section');
const errorMsg = document.getElementById('error-message');
const copyBtn = document.getElementById('copy-btn');
const newBtn = document.getElementById('new-btn');
const watchBtn = document.getElementById('watch-btn');
const retryBtn = document.getElementById('retry-btn');
const reportList = document.getElementById('report-list');
const quickTags = document.querySelectorAll('.tag');
const chartSection = document.getElementById('chart-section');
const priceChartCanvas = document.getElementById('price-chart');
const chartTitleEl = document.getElementById('chart-title');
const watchlistContainer = document.getElementById('watchlist-container');
const watchlistEmptyEl = document.getElementById('watchlist-empty');
// Mode toggle
const singleModeBtn = document.getElementById('single-mode-btn');
const compareModeBtn = document.getElementById('compare-mode-btn');
const searchSection = document.getElementById('search-section');
const compareSection = document.getElementById('compare-section');
const compareInput1 = document.getElementById('compare-input-1');
const compareInput2 = document.getElementById('compare-input-2');
const compareAnalyzeBtn = document.getElementById('compare-analyze-btn');
const cmpBtnText = document.getElementById('cmp-btn-text');
const cmpBtnSpinner = document.getElementById('cmp-btn-spinner');
const compareResultsSection = document.getElementById('compare-results-section');
const compareTabsEl = document.getElementById('compare-tabs');
const comparePanelsEl = document.getElementById('compare-panels');
const compareNewBtn = document.getElementById('compare-new-btn');

// ── State ─────────────────────────────────────────────
let currentMarkdown = '';
let currentQuery = '';
let currentTicker = '';
let activeReportEl = null;
let priceChart = null;    // Chart.js instance
let appMode = 'single'; // 'single' | 'compare'
let activeTabIndex = 0;

// ── Utilities ─────────────────────────────────────────
const show = el => el.classList.remove('hidden');
const hide = el => el.classList.add('hidden');

function setLoading(on) {
  analyzeBtn.disabled = on;
  btnText.classList.toggle('hidden', on);
  btnSpinner.classList.toggle('hidden', !on);
}

function appendLog(text) {
  streamingLog.textContent += text + '\n';
  streamingLog.scrollTop = streamingLog.scrollHeight;
}

function extractTicker(markdown) {
  // Matches: # Equity Research Report: Company Name (TICK)
  const m = markdown.match(/^#.*?\(([A-Z0-9.\-]+)\)/m);
  return m ? m[1] : '';
}

function colorRating(html) {
  return html
    .replace(/\*\*Final Rating:\*\*\s*BUY/gi, '**Final Rating:** <span class="rating-buy">BUY ▲</span>')
    .replace(/\*\*Final Rating:\*\*\s*SELL/gi, '**Final Rating:** <span class="rating-sell">SELL ▼</span>')
    .replace(/\*\*Final Rating:\*\*\s*HOLD/gi, '**Final Rating:** <span class="rating-hold">HOLD ◆</span>');
}

function ratingFromMarkdown(md) {
  if (/\*\*Final Rating:\*\*\s*BUY/i.test(md)) return 'BUY';
  if (/\*\*Final Rating:\*\*\s*SELL/i.test(md)) return 'SELL';
  if (/\*\*Final Rating:\*\*\s*HOLD/i.test(md)) return 'HOLD';
  return '';
}

// ── Chart ─────────────────────────────────────────────
async function loadChart(ticker, period = '3mo') {
  if (!ticker) { hide(chartSection); return; }
  chartTitleEl.textContent = `${ticker} — Price History`;
  try {
    const res = await fetch(API_BASE + `/api/chart/${encodeURIComponent(ticker)}?period=${period}`);
    const data = await res.json();
    if (data.error) { hide(chartSection); return; }

    show(chartSection);
    if (priceChart) { priceChart.destroy(); priceChart = null; }

    const ctx = priceChartCanvas.getContext('2d');
    const grad = ctx.createLinearGradient(0, 0, 0, priceChartCanvas.clientHeight || 200);
    grad.addColorStop(0, 'rgba(99,102,241,0.35)');
    grad.addColorStop(1, 'rgba(99,102,241,0.00)');

    const isUp = data.prices.length > 1 && data.prices[data.prices.length - 1] >= data.prices[0];
    const lineColor = isUp ? '#34d399' : '#f87171';
    const gradUp = ctx.createLinearGradient(0, 0, 0, 200);
    gradUp.addColorStop(0, isUp ? 'rgba(52,211,153,0.3)' : 'rgba(248,113,113,0.3)');
    gradUp.addColorStop(1, 'rgba(0,0,0,0)');

    priceChart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: data.labels,
        datasets: [{
          label: ticker,
          data: data.prices,
          borderColor: lineColor,
          borderWidth: 2,
          backgroundColor: gradUp,
          fill: true,
          tension: 0.38,
          pointRadius: 0,
          pointHitRadius: 20,
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: '#0f1629',
            borderColor: 'rgba(99,102,241,0.3)',
            borderWidth: 1,
            titleColor: '#818cf8',
            bodyColor: '#e2e8f0',
            callbacks: {
              label: ctx => ` ${ctx.parsed.y.toFixed(2)}`
            }
          }
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: {
              color: '#4a5568',
              maxTicksLimit: 6,
              font: { size: 11 }
            }
          },
          y: {
            grid: { color: 'rgba(99,102,241,0.07)' },
            ticks: { color: '#4a5568', font: { size: 11 } }
          }
        }
      }
    });
  } catch (e) {
    hide(chartSection);
  }
}

// Period buttons
document.querySelectorAll('.period-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.period-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    if (currentTicker) loadChart(currentTicker, btn.dataset.period);
  });
});

// ── Watchlist ─────────────────────────────────────────
const WL_KEY = 'alphaagent_watchlist';

function getWatchlist() {
  try { return JSON.parse(localStorage.getItem(WL_KEY) || '[]'); }
  catch { return []; }
}
function saveWatchlist(list) {
  localStorage.setItem(WL_KEY, JSON.stringify(list));
}

function renderWatchlist() {
  const list = getWatchlist();
  // remove old items (preserve the empty placeholder)
  watchlistContainer.querySelectorAll('.watchlist-item').forEach(el => el.remove());

  if (list.length === 0) {
    show(watchlistEmptyEl);
    return;
  }
  hide(watchlistEmptyEl);

  list.forEach(name => {
    const item = document.createElement('div');
    item.className = 'watchlist-item';
    item.innerHTML = `
      <span class="watchlist-name" title="${name}">${name}</span>
      <div class="watchlist-actions">
        <button class="wl-analyze-btn" data-name="${name}">▶ Run</button>
        <button class="wl-remove-btn" data-name="${name}" title="Remove">✕</button>
      </div>`;
    item.querySelector('.wl-analyze-btn').addEventListener('click', () => {
      queryInput.value = name;
      switchMode('single');
      startAnalysis(name);
    });
    item.querySelector('.wl-remove-btn').addEventListener('click', () => {
      removeFromWatchlist(name);
    });
    watchlistContainer.appendChild(item);
  });
}

function addToWatchlist(name) {
  if (!name) return;
  let list = getWatchlist();
  if (!list.includes(name)) {
    list.unshift(name);
    saveWatchlist(list);
    renderWatchlist();
  }
  watchBtn.textContent = '⭐ Saved!';
  setTimeout(() => { watchBtn.textContent = '⭐ Watch'; }, 2000);
}

function removeFromWatchlist(name) {
  let list = getWatchlist().filter(n => n !== name);
  saveWatchlist(list);
  renderWatchlist();
}

watchBtn.addEventListener('click', () => addToWatchlist(currentQuery));

// ── Single Analysis ────────────────────────────────────
function renderReport(markdown, query, skipChart = false) {
  currentMarkdown = markdown;
  currentTicker = extractTicker(markdown);
  currentQuery = query;
  reportContent.innerHTML = marked.parse(colorRating(markdown));
  reportChip.textContent = query.toUpperCase();
  hide(statusSection);
  hide(welcomeSection);
  hide(errorSection);
  hide(compareResultsSection);
  show(reportSection);
  if (!skipChart) loadChart(currentTicker);
  updateWatchBtnState();
}

function updateWatchBtnState() {
  const inList = getWatchlist().includes(currentQuery);
  watchBtn.textContent = inList ? '⭐ Saved' : '⭐ Watch';
}

function showError(msg) {
  errorMsg.textContent = msg;
  hide(statusSection);
  show(errorSection);
  setLoading(false);
}

function resetUI() {
  hide(reportSection);
  hide(errorSection);
  hide(statusSection);
  hide(compareResultsSection);
  show(welcomeSection);
  streamingLog.textContent = '';
  currentMarkdown = '';
  currentTicker = '';
  currentQuery = '';
  queryInput.value = '';
  queryInput.focus();
}

function startAnalysis(query) {
  currentQuery = query;
  currentMarkdown = '';
  currentTicker = '';
  streamingLog.textContent = '';
  setLoading(true);

  hide(welcomeSection);
  hide(reportSection);
  hide(errorSection);
  hide(compareResultsSection);
  hide(chartSection);
  show(statusSection);
  statusLabel.textContent = `Analyzing "${query}"…`;

  fetch(API_BASE + '/api/analyze', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query })
  }).then(res => {
    if (!res.ok) {
      res.json().then(d => showError(d.error || 'Server error')).catch(() => showError('Server error'));
      setLoading(false);
      return;
    }
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    (function read() {
      reader.read().then(({ done, value }) => {
        if (done) { setLoading(false); return; }
        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split('\n\n');
        buffer = parts.pop();
        parts.forEach(part => {
          if (!part.startsWith('data:')) return;
          try { handleEvent(JSON.parse(part.slice(5).trim())); }
          catch (e) { console.warn('SSE parse', e); }
        });
        read();
      }).catch(e => { showError('Connection lost: ' + e.message); setLoading(false); });
    })();
  }).catch(e => { showError('Could not reach server: ' + e.message); setLoading(false); });
}

function handleEvent(event) {
  switch (event.type) {
    case 'token':
      currentMarkdown = event.content;
      appendLog('⟳ Thinking…');
      break;
    case 'status':
      statusLabel.textContent = event.content;
      appendLog('ℹ ' + event.content);
      break;
    case 'saved':
      addHistoryItem(event.filename, currentQuery);
      appendLog(`✔ Saved: ${event.filename}`);
      break;
    case 'done':
      setLoading(false);
      if (currentMarkdown) renderReport(currentMarkdown, currentQuery);
      else showError('No report generated. Try again.');
      break;
    case 'error':
      showError(event.content);
      break;
    case 'warning':
      appendLog('⚠ ' + event.content);
      break;
  }
}

// ── Report History ─────────────────────────────────────
async function loadHistory() {
  try {
    const reports = await (await fetch(API_BASE + '/api/reports')).json();
    if (!Array.isArray(reports) || reports.length === 0) return;
    reportList.innerHTML = '';
    reports.forEach(r => {
      const dateStr = new Date(r.mtime * 1000).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
      const el = document.createElement('div');
      el.className = 'report-item';
      el.dataset.filename = r.filename;
      el.innerHTML = `
        <div style="flex:1; overflow:hidden; display:flex; flex-direction:column; gap:3px;">
          <span class="report-item-name">${r.company}</span>
          <span class="report-item-date">${dateStr}</span>
        </div>
        <button class="report-del-btn" title="Delete Report">✕</button>
      `;
      el.querySelector('div').addEventListener('click', () => loadSavedReport(r.filename, r.company, el));
      el.querySelector('.report-del-btn').addEventListener('click', (e) => deleteReport(r.filename, el, e));
      reportList.appendChild(el);
    });
  } catch (e) { console.warn('History load failed', e); }
}

async function loadSavedReport(filename, company, el) {
  try {
    const data = await (await fetch(API_BASE + `/api/reports/${filename}`)).json();
    if (data.error) { showError(data.error); return; }
    currentMarkdown = data.content;
    currentQuery = company;
    renderReport(data.content, company);
    if (activeReportEl) activeReportEl.classList.remove('active');
    el.classList.add('active');
    activeReportEl = el;
  } catch (e) { showError('Failed to load report: ' + e.message); }
}

function addHistoryItem(filename, company) {
  const existing = reportList.querySelector(`[data-filename="${filename}"]`);
  if (existing) reportList.removeChild(existing);
  const empty = reportList.querySelector('.sidebar-empty');
  if (empty) reportList.removeChild(empty);

  const dateStr = new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  const el = document.createElement('div');
  el.className = 'report-item active';
  el.dataset.filename = filename;
  el.innerHTML = `
    <div style="flex:1; overflow:hidden; display:flex; flex-direction:column; gap:3px;">
      <span class="report-item-name">${company}</span>
      <span class="report-item-date">${dateStr}</span>
    </div>
    <button class="report-del-btn" title="Delete Report">✕</button>
  `;
  el.querySelector('div').addEventListener('click', () => loadSavedReport(filename, company, el));
  el.querySelector('.report-del-btn').addEventListener('click', (e) => deleteReport(filename, el, e));

  if (activeReportEl) activeReportEl.classList.remove('active');
  activeReportEl = el;
  reportList.prepend(el);
}

async function deleteReport(filename, el, e) {
  e.stopPropagation();
  if (!confirm("Are you sure you want to delete this report?")) return;
  try {
    const res = await fetch(API_BASE + `/api/reports/${filename}`, { method: 'DELETE' });
    const data = await res.json();
    if (data.error) throw new Error(data.error);
    el.remove();
    if (reportList.children.length === 0) {
      reportList.innerHTML = '<p class="sidebar-empty">No reports yet. Run your first analysis!</p>';
    }
    if (activeReportEl === el) {
      resetUI();
      activeReportEl = null;
    }
  } catch (err) {
    showError("Could not delete report: " + err.message);
  }
}

const clearHistoryBtn = document.getElementById('clear-history-btn');
if (clearHistoryBtn) {
  clearHistoryBtn.addEventListener('click', async () => {
    if (!confirm("Warning: This will delete ALL reports. Proceed?")) return;
    try {
      const res = await fetch(API_BASE + '/api/reports', { method: 'DELETE' });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      reportList.innerHTML = '<p class="sidebar-empty">No reports yet. Run your first analysis!</p>';
      resetUI();
      activeReportEl = null;
    } catch (err) {
      showError("Could not clear history: " + err.message);
    }
  });
}

// ── Compare Mode ───────────────────────────────────────
function switchMode(mode) {
  appMode = mode;
  if (mode === 'single') {
    singleModeBtn.classList.add('active');
    compareModeBtn.classList.remove('active');
    show(searchSection);
    hide(compareSection);
  } else {
    compareModeBtn.classList.add('active');
    singleModeBtn.classList.remove('active');
    hide(searchSection);
    show(compareSection);
    resetUI();
  }
}

singleModeBtn.addEventListener('click', () => switchMode('single'));
compareModeBtn.addEventListener('click', () => switchMode('compare'));

// Enable/disable compare button based on both inputs
function checkCompareReady() {
  const v1 = compareInput1.value.trim();
  const v2 = compareInput2.value.trim();
  compareAnalyzeBtn.disabled = !(v1 && v2);
}
compareInput1.addEventListener('input', checkCompareReady);
compareInput2.addEventListener('input', checkCompareReady);

// Allow pressing Enter in stock 2 to submit
compareInput2.addEventListener('keydown', e => {
  if (e.key === 'Enter' && !compareAnalyzeBtn.disabled) {
    e.preventDefault();
    compareAnalyzeBtn.click();
  }
});
compareInput1.addEventListener('keydown', e => {
  if (e.key === 'Enter') { e.preventDefault(); compareInput2.focus(); }
});

// Compare analysis
function startCompare(tickers) {
  compareAnalyzeBtn.disabled = true;
  cmpBtnText.classList.add('hidden');
  cmpBtnSpinner.classList.remove('hidden');

  hide(welcomeSection);
  hide(reportSection);
  hide(errorSection);
  show(statusSection);
  statusLabel.textContent = `Comparing ${tickers.length} stocks…`;
  streamingLog.textContent = '';

  // Build tab + panel scaffold
  compareTabsEl.innerHTML = '';
  comparePanelsEl.innerHTML = '';

  tickers.forEach((ticker, i) => {
    // Tab
    const tab = document.createElement('button');
    tab.className = 'compare-tab' + (i === 0 ? ' active' : '');
    tab.dataset.index = i;
    tab.textContent = ticker;
    tab.addEventListener('click', () => switchCompareTab(i));
    compareTabsEl.appendChild(tab);

    // Panel
    const panel = document.createElement('div');
    panel.className = 'compare-panel' + (i === 0 ? ' active' : '');
    panel.id = `panel-${i}`;
    panel.innerHTML = `<div class="compare-pending"><div class="pulse-dot" style="display:inline-block"></div>Waiting for analysis…</div>`;
    comparePanelsEl.appendChild(panel);
  });

  show(compareResultsSection);
  hide(statusSection);

  const compareReports = {};

  fetch(API_BASE + '/api/compare', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tickers })
  }).then(res => {
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    (function read() {
      reader.read().then(({ done, value }) => {
        if (done) {
          cmpBtnText.classList.remove('hidden');
          cmpBtnSpinner.classList.add('hidden');
          const v1 = compareInput1.value.trim();
          const v2 = compareInput2.value.trim();
          compareAnalyzeBtn.disabled = !(v1 && v2);
          return;
        }
        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split('\n\n');
        buffer = parts.pop();
        parts.forEach(part => {
          if (!part.startsWith('data:')) return;
          try { handleCompareEvent(JSON.parse(part.slice(5).trim()), tickers, compareReports); }
          catch (e) { console.warn('CMP SSE parse', e); }
        });
        read();
      }).catch(e => {
        cmpBtnText.classList.remove('hidden');
        cmpBtnSpinner.classList.add('hidden');
        showError('Compare error: ' + e.message);
      });
    })();
  }).catch(e => {
    cmpBtnText.classList.remove('hidden');
    cmpBtnSpinner.classList.add('hidden');
    showError('Server error: ' + e.message);
  });
}

function handleCompareEvent(event, tickers, reports) {
  switch (event.type) {
    case 'compare_status': {
      const i = event.index;
      statusLabel.textContent = `Analyzing ${event.ticker} (${event.index + 1}/${event.total})…`;
      appendLog(`▶ Analyzing ${event.ticker}…`);
      const panel = document.getElementById(`panel-${i}`);
      if (panel) {
        panel.innerHTML = `<div class="compare-pending"><div class="pulse-dot" style="display:inline-block;animation:pulse 1.4s ease-in-out infinite"></div>Analyzing ${event.ticker}…</div>`;
      }
      break;
    }
    case 'compare_result': {
      const i = tickers.indexOf(event.ticker);
      reports[i] = event.report;
      const rating = ratingFromMarkdown(event.report);
      // Update tab with rating badge
      const tab = compareTabsEl.querySelectorAll('.compare-tab')[i];
      if (tab) {
        const cls = `tab-rating-${rating.toLowerCase()}`;
        tab.innerHTML = `${event.ticker} <span class="tab-rating ${cls}">${rating}</span>`;
        tab.addEventListener('click', () => switchCompareTab(i));
      }
      // Render report into panel
      const panel = document.getElementById(`panel-${i}`);
      if (panel) {
        panel.innerHTML = `
          <div class="chart-card hidden" id="cmp-chart-card-${i}">
            <div class="chart-header">
              <span class="chart-title-text">${event.ticker} — Price History</span>
            </div>
            <canvas id="cmp-chart-${i}" height="90"></canvas>
          </div>
          <div class="report-card">${marked.parse(colorRating(event.report))}</div>`;
        // Load chart for this panel
        loadCompareChart(event.ticker, i);
      }
      addHistoryItem(event.filename, event.ticker);
      break;
    }
    case 'compare_error': {
      const i = tickers.indexOf(event.ticker);
      const panel = document.getElementById(`panel-${i}`);
      if (panel) {
        panel.innerHTML = `<div class="compare-pending" style="color:var(--red)">⚠ Error for ${event.ticker}: ${event.error}</div>`;
      }
      break;
    }
    case 'compare_done':
      statusLabel.textContent = 'Comparison complete!';
      appendLog('✔ All stocks analyzed.');
      break;
  }
}

async function loadCompareChart(ticker, panelIndex) {
  const cardEl = document.getElementById(`cmp-chart-card-${panelIndex}`);
  const canvEl = document.getElementById(`cmp-chart-${panelIndex}`);
  if (!cardEl || !canvEl) return;
  try {
    const data = await (await fetch(API_BASE + `/api/chart/${encodeURIComponent(ticker)}?period=3mo`)).json();
    if (data.error || !data.prices) return;
    cardEl.classList.remove('hidden');
    const ctx = canvEl.getContext('2d');
    const isUp = data.prices[data.prices.length - 1] >= data.prices[0];
    const line = isUp ? '#34d399' : '#f87171';
    const grad = ctx.createLinearGradient(0, 0, 0, 180);
    grad.addColorStop(0, isUp ? 'rgba(52,211,153,0.28)' : 'rgba(248,113,113,0.28)');
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    new Chart(ctx, {
      type: 'line',
      data: { labels: data.labels, datasets: [{ data: data.prices, borderColor: line, borderWidth: 2, backgroundColor: grad, fill: true, tension: 0.38, pointRadius: 0, pointHitRadius: 20 }] },
      options: {
        responsive: true,
        plugins: { legend: { display: false }, tooltip: { backgroundColor: '#0f1629', borderColor: 'rgba(99,102,241,0.3)', borderWidth: 1, titleColor: '#818cf8', bodyColor: '#e2e8f0', callbacks: { label: c => ` ${c.parsed.y.toFixed(2)}` } } },
        scales: {
          x: { grid: { display: false }, ticks: { color: '#4a5568', maxTicksLimit: 5, font: { size: 10 } } },
          y: { grid: { color: 'rgba(99,102,241,0.07)' }, ticks: { color: '#4a5568', font: { size: 10 } } }
        }
      }
    });
  } catch (e) { console.warn('Compare chart failed', e); }
}

function switchCompareTab(index) {
  activeTabIndex = index;
  compareTabsEl.querySelectorAll('.compare-tab').forEach((tab, i) => {
    tab.classList.toggle('active', i === index);
  });
  comparePanelsEl.querySelectorAll('.compare-panel').forEach((panel, i) => {
    panel.classList.toggle('active', i === index);
  });
}

compareAnalyzeBtn.addEventListener('click', () => {
  const s1 = compareInput1.value.trim();
  const s2 = compareInput2.value.trim();
  if (s1 && s2) startCompare([s1, s2]);
});
compareNewBtn.addEventListener('click', () => {
  hide(compareResultsSection);
  compareInput1.value = '';
  compareInput2.value = '';
  compareAnalyzeBtn.disabled = true;
  show(welcomeSection);
});

// ── Standard event listeners ───────────────────────────
form.addEventListener('submit', e => {
  e.preventDefault();
  const q = queryInput.value.trim();
  if (q) startAnalysis(q);
});

quickTags.forEach(tag => {
  tag.addEventListener('click', () => {
    queryInput.value = tag.dataset.q;
    switchMode('single');
    startAnalysis(tag.dataset.q);
  });
});

copyBtn.addEventListener('click', () => {
  navigator.clipboard.writeText(currentMarkdown).then(() => {
    copyBtn.textContent = '✓ Copied!';
    setTimeout(() => { copyBtn.textContent = '⧉ Copy'; }, 2000);
  });
});

newBtn.addEventListener('click', resetUI);
retryBtn.addEventListener('click', () => { if (currentQuery) startAnalysis(currentQuery); });

// ── Init ──────────────────────────────────────────────
window.addEventListener('DOMContentLoaded', () => {
  loadHistory();
  renderWatchlist();
  queryInput.focus();
});
