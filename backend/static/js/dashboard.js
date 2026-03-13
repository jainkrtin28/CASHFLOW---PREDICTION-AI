/* CashFlow AI — Dashboard JS */

const API = '';
const chartDefaults = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: { legend: { display: false }, tooltip: { backgroundColor: '#1a1d28', titleColor: '#e8eaf0', bodyColor: '#8b90a0', borderColor: '#ffffff12', borderWidth: 1, padding: 10, cornerRadius: 8 } },
  scales: {
    x: { grid: { color: '#ffffff07', drawBorder: false }, ticks: { color: '#555c70', font: { family: 'DM Mono', size: 10 }, maxTicksLimit: 10 } },
    y: { grid: { color: '#ffffff07', drawBorder: false }, ticks: { color: '#555c70', font: { family: 'DM Mono', size: 10 }, callback: v => '₹' + fmtNum(v) } }
  }
};

function fmtNum(n) {
  if (Math.abs(n) >= 1e7) return (n / 1e7).toFixed(1) + 'Cr';
  if (Math.abs(n) >= 1e5) return (n / 1e5).toFixed(1) + 'L';
  if (Math.abs(n) >= 1e3) return (n / 1e3).toFixed(1) + 'K';
  return n.toFixed(0);
}

function fmtCurrency(n) {
  if (Math.abs(n) >= 1e7) return '₹' + (n / 1e7).toFixed(2) + ' Cr';
  if (Math.abs(n) >= 1e5) return '₹' + (n / 1e5).toFixed(2) + 'L';
  return '₹' + n.toFixed(2);
}

// ===== CHART INSTANCES =====
const charts = {};

function createChart(id, config) {
  const existing = charts[id];
  if (existing) existing.destroy();
  const ctx = document.getElementById(id)?.getContext('2d');
  if (!ctx) return null;
  charts[id] = new Chart(ctx, config);
  return charts[id];
}

// ===== TAB NAVIGATION =====
document.querySelectorAll('.nav-item').forEach(item => {
  item.addEventListener('click', e => {
    e.preventDefault();
    const tab = item.dataset.tab;
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    item.classList.add('active');
    document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
    document.getElementById('tab-' + tab)?.classList.add('active');
    const titles = { overview: 'Overview', forecast: 'Forecast', accuracy: 'Accuracy', risks: 'Risk Analysis', improvements: 'Improvements', categories: 'Breakdown', adddata: 'Add Data' };
    document.getElementById('pageTitle').textContent = titles[tab] || tab;
  });
});

// Mobile menu toggle
document.getElementById('menuToggle')?.addEventListener('click', () => {
  document.getElementById('sidebar')?.classList.toggle('open');
});

// ===== FETCH ALL DATA =====
async function loadAll() {
  const overlay = document.getElementById('loadingOverlay');
  try {
    const [overview, historical, monthly, monthlyAcc, forecast90, risks, improvements, categories] = await Promise.all([
      fetch(API + '/api/overview').then(r => r.json()),
      fetch(API + '/api/historical').then(r => r.json()),
      fetch(API + '/api/monthly-summary').then(r => r.json()),
      fetch(API + '/api/monthly-accuracy').then(r => r.json()),
      fetch(API + '/api/forecast?days=90').then(r => r.json()),
      fetch(API + '/api/risks').then(r => r.json()),
      fetch(API + '/api/improvements').then(r => r.json()),
      fetch(API + '/api/categories').then(r => r.json()),
    ]);

    renderOverview(overview, historical, monthly);
    renderForecast(forecast90, 90);
    renderAccuracy(monthlyAcc);
    renderRisks(risks, overview.metrics);
    renderImprovements(improvements);
    renderCategories(categories);

    // Date range in header
    document.getElementById('dateRange').textContent =
      overview.date_range.start + ' → ' + overview.date_range.end;

    overlay.classList.add('hidden');
  } catch (err) {
    console.error(err);
    overlay.innerHTML = `<div class="loader-box"><p style="color:#f43f5e">Failed to load data. Is the backend running?</p></div>`;
  }
}

// ===== OVERVIEW =====
function renderOverview(ov, historical, monthly) {
  const m = ov.metrics;
  document.getElementById('kpiInflow').textContent = fmtCurrency(ov.total_inflow);
  document.getElementById('kpiOutflow').textContent = fmtCurrency(ov.total_outflow);
  document.getElementById('kpiNet').textContent = fmtCurrency(ov.net_cashflow);
  document.getElementById('kpiAccuracy').textContent = m.accuracy_percent.toFixed(1) + '%';

  const netTrend = document.getElementById('kpiNetTrend');
  netTrend.textContent = ov.net_cashflow >= 0 ? '↑ Net Positive' : '↓ Net Deficit';
  netTrend.className = 'kpi-trend ' + (ov.net_cashflow >= 0 ? 'positive' : 'negative');

  document.getElementById('metR2').textContent = m.r2.toFixed(4);
  document.getElementById('metMAE').textContent = fmtCurrency(m.mae);
  document.getElementById('metRMSE').textContent = fmtCurrency(m.rmse);
  document.getElementById('metMAPE').textContent = m.mape.toFixed(2) + '%';
  document.getElementById('metAccuracy').textContent = m.accuracy_percent.toFixed(1) + '%';

  // Historical Chart
  const dates = historical.map(d => d.date);
  const values = historical.map(d => d.cashflow);
  const avg7 = historical.map(d => d.rolling_avg_7);

  createChart('historicalChart', {
    type: 'line',
    data: {
      labels: dates,
      datasets: [
        {
          label: 'Daily Cashflow',
          data: values,
          borderColor: '#4f7fff',
          backgroundColor: ctx => {
            const g = ctx.chart.ctx.createLinearGradient(0, 0, 0, ctx.chart.height);
            g.addColorStop(0, 'rgba(79,127,255,0.2)');
            g.addColorStop(1, 'rgba(79,127,255,0)');
            return g;
          },
          borderWidth: 1.5,
          fill: true,
          pointRadius: 0,
          tension: 0.3,
        },
        {
          label: '7-Day Avg',
          data: avg7,
          borderColor: '#f59e0b',
          borderWidth: 2,
          fill: false,
          pointRadius: 0,
          tension: 0.4,
          borderDash: [],
        }
      ]
    },
    options: { ...chartDefaults, plugins: { ...chartDefaults.plugins, legend: { display: false } } }
  });

  // Monthly bar chart
  const mLabels = monthly.map(m => m.year_month);
  const mTotals = monthly.map(m => m.total);

  createChart('monthlyBarChart', {
    type: 'bar',
    data: {
      labels: mLabels,
      datasets: [{
        label: 'Monthly Total',
        data: mTotals,
        backgroundColor: mTotals.map(v => v >= 0 ? 'rgba(34,197,94,0.6)' : 'rgba(244,63,94,0.6)'),
        borderColor: mTotals.map(v => v >= 0 ? '#22c55e' : '#f43f5e'),
        borderWidth: 1,
        borderRadius: 4,
      }]
    },
    options: { ...chartDefaults }
  });
}

// ===== FORECAST =====
let currentForecastDays = 90;
let forecastCache = {};

async function renderForecast(data, days) {
  forecastCache[days] = data;

  const positives = data.filter(d => d.forecast > 0).length;
  const negatives = data.filter(d => d.forecast < 0).length;
  const avg       = data.reduce((s, d) => s + d.forecast, 0) / data.length;
  const totalFlow = data.reduce((s, d) => s + d.forecast, 0);

  document.getElementById('forecastSummary').innerHTML = `
    <div class="fs-stat"><span class="fs-label">Profit Days</span><span class="fs-val" style="color:#4ade80">${positives}</span></div>
    <div class="fs-stat"><span class="fs-label">Loss Days</span><span class="fs-val" style="color:#f87171">${negatives}</span></div>
    <div class="fs-stat"><span class="fs-label">Net Total</span><span class="fs-val" style="color:${totalFlow>=0?'#4ade80':'#f87171'}">${fmtCurrency(totalFlow)}</span></div>
  `;

  // ── Build monthly profit/loss table ──────────────────────────
  const monthMap = {};
  data.forEach(d => {
    const ym = d.date.slice(0, 7);
    if (!monthMap[ym]) monthMap[ym] = { days:0, total:0, profitDays:0, lossDays:0, upperSum:0, lowerSum:0 };
    monthMap[ym].days++;
    monthMap[ym].total      += d.forecast;
    monthMap[ym].upperSum   += d.upper;
    monthMap[ym].lowerSum   += d.lower;
    if (d.forecast >= 0) monthMap[ym].profitDays++;
    else                 monthMap[ym].lossDays++;
  });

  const monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const rows = Object.entries(monthMap).map(([ym, m]) => {
    const [yr, mo]  = ym.split('-');
    const label     = monthNames[parseInt(mo)-1] + ' ' + yr;
    const isProfit  = m.total >= 0;
    const verdict   = isProfit ? '▲ PROFIT' : '▼ LOSS';
    const verdictCl = isProfit ? 'verdict-profit' : 'verdict-loss';
    const pct       = Math.round(m.profitDays / m.days * 100);
    const bandWidth = Math.abs(m.upperSum - m.lowerSum) / m.days;
    const absTotal  = Math.abs(m.total);
    const conf      = absTotal > 0 ? Math.max(0, Math.min(100, Math.round(100 - (bandWidth / (absTotal + bandWidth)) * 100))) : 50;
    const sign      = isProfit ? '+' : '';
    return `
    <div class="mpl-row">
      <div class="mpl-month">${label}</div>
      <div class="mpl-verdict"><span class="mpl-badge ${verdictCl}">${verdict}</span></div>
      <div class="mpl-amount" style="color:${isProfit?'#4ade80':'#f87171'}">${sign}${fmtCurrency(m.total)}</div>
      <div class="mpl-bar-col">
        <div class="mpl-bar-track">
          <div class="mpl-bar-fill ${isProfit?'bar-profit':'bar-loss'}" style="width:${pct}%"></div>
        </div>
        <span class="mpl-bar-label">${pct}% profit days</span>
      </div>
      <div class="mpl-range">
        <span style="color:#f87171">${fmtCurrency(m.lowerSum)}</span>
        <span class="mpl-range-sep"> → </span>
        <span style="color:#4ade80">${fmtCurrency(m.upperSum)}</span>
      </div>
      <div class="mpl-conf-col">
        <div class="mpl-conf-track"><div class="mpl-conf-fill" style="width:${conf}%"></div></div>
        <span class="mpl-conf-val">${conf}%</span>
      </div>
    </div>`;
  }).join('');

  document.getElementById('monthlyForecastTable').innerHTML = `
    <div class="mpl-header">
      <span>Month</span><span>Verdict</span><span>Net Cashflow</span>
      <span>Profit Day Rate</span><span>Scenario Range</span><span>Confidence</span>
    </div>
    <div class="mpl-body">${rows}</div>
  `;

  // ── Daily bar chart ──────────────────────────────────────────
  const labels    = data.map(d => d.date);
  const forecasts = data.map(d => d.forecast);
  const upper     = data.map(d => d.upper);
  const lower     = data.map(d => d.lower);
  const conf      = data.map(d => d.confidence);

  const barColors  = forecasts.map(v => v >= 0 ? 'rgba(74,222,128,0.75)' : 'rgba(248,113,113,0.75)');
  const barBorders = forecasts.map(v => v >= 0 ? 'rgba(74,222,128,1)'    : 'rgba(248,113,113,1)');

  createChart('forecastChart', {
    type: 'bar',
    data: {
      labels,
      datasets: [
        { type:'line', label:'Upper bound', data:upper, borderColor:'transparent', backgroundColor:'rgba(99,132,255,0.10)', fill:'+1', pointRadius:0, tension:0.4, order:3 },
        { type:'line', label:'Lower bound', data:lower, borderColor:'rgba(99,132,255,0.3)', borderWidth:1, borderDash:[4,4], backgroundColor:'transparent', fill:false, pointRadius:0, tension:0.4, order:3 },
        { type:'bar',  label:'Forecast',    data:forecasts, backgroundColor:barColors, borderColor:barBorders, borderWidth:1, borderRadius:3, borderSkipped:false, order:1 },
        { type:'line', label:'Trend',       data:forecasts, borderColor:'rgba(200,200,255,0.45)', borderWidth:1.5, borderDash:[5,3], fill:false, pointRadius:0, tension:0.5, order:2 },
      ]
    },
    options: {
      ...chartDefaults,
      plugins: {
        ...chartDefaults.plugins,
        legend: { display: false },
        tooltip: {
          ...chartDefaults.plugins.tooltip,
          callbacks: {
            title: items => 'Date: ' + items[0].label,
            label: item => {
              if (item.datasetIndex === 2) {
                const v = item.raw, c = conf[item.dataIndex];
                return [' Forecast: '+fmtCurrency(v), ' Confidence: '+(c*100).toFixed(0)+'%', ' '+(v>=0?'▲ Profit day':'▼ Loss day')];
              }
              if (item.datasetIndex === 0) return ' Best case: '+fmtCurrency(item.raw);
              if (item.datasetIndex === 1) return ' Worst case: '+fmtCurrency(item.raw);
              return null;
            },
            filter: item => item.datasetIndex !== 3,
          }
        },
        annotation: { annotations: { zeroLine: { type:'line', yMin:0, yMax:0, borderColor:'rgba(255,255,255,0.2)', borderWidth:1.5, borderDash:[6,4] } } }
      },
      scales: {
        ...chartDefaults.scales,
        x: { ...chartDefaults.scales.x, ticks: { ...chartDefaults.scales.x.ticks, maxTicksLimit:12, maxRotation:0 } },
        y: { ...chartDefaults.scales.y, ticks: { ...chartDefaults.scales.y.ticks, callback: v => (v<0?'-':'')+'₹'+fmtNum(Math.abs(v)) } }
      },
      barPercentage: days <= 30 ? 0.7 : days <= 60 ? 0.85 : 0.95,
      categoryPercentage: 0.9,
    }
  });
}


// Forecast control buttons
document.querySelectorAll('.ctrl-btn').forEach(btn => {
  btn.addEventListener('click', async () => {
    document.querySelectorAll('.ctrl-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    const days = parseInt(btn.dataset.days);
    currentForecastDays = days;

    if (forecastCache[days]) {
      renderForecast(forecastCache[days], days);
    } else {
      const data = await fetch(API + '/api/forecast?days=' + days).then(r => r.json());
      renderForecast(data, days);
    }
  });
});

// ===== ACCURACY =====
function renderAccuracy(monthlyAcc) {
  const labels = monthlyAcc.map(m => m.month);
  const accuracies = monthlyAcc.map(m => m.accuracy);
  const actual = monthlyAcc.map(m => m.actual_sum);
  const predicted = monthlyAcc.map(m => m.predicted_sum);

  // Accuracy line chart
  createChart('accuracyChart', {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: 'Accuracy %',
        data: accuracies,
        borderColor: '#a78bfa',
        backgroundColor: ctx => {
          const g = ctx.chart.ctx.createLinearGradient(0, 0, 0, ctx.chart.height);
          g.addColorStop(0, 'rgba(167,139,250,0.25)');
          g.addColorStop(1, 'rgba(167,139,250,0)');
          return g;
        },
        fill: true,
        pointRadius: 4,
        pointBackgroundColor: '#a78bfa',
        borderWidth: 2.5,
        tension: 0.35,
      }]
    },
    options: {
      ...chartDefaults,
      scales: {
        ...chartDefaults.scales,
        y: {
          ...chartDefaults.scales.y,
          min: 0,
          max: 100,
          ticks: { ...chartDefaults.scales.y.ticks, callback: v => v + '%' }
        }
      }
    }
  });

  // Actual vs predicted
  createChart('actualVsPredChart', {
    type: 'bar',
    data: {
      labels,
      datasets: [
        {
          label: 'Actual',
          data: actual,
          backgroundColor: 'rgba(34,197,94,0.6)',
          borderColor: '#22c55e',
          borderWidth: 1,
          borderRadius: 3,
        },
        {
          label: 'Predicted',
          data: predicted,
          backgroundColor: 'rgba(79,127,255,0.6)',
          borderColor: '#4f7fff',
          borderWidth: 1,
          borderRadius: 3,
        }
      ]
    },
    options: {
      ...chartDefaults,
      plugins: {
        ...chartDefaults.plugins,
        legend: { display: true, labels: { color: '#8b90a0', boxWidth: 10, font: { size: 11 } }, position: 'top' }
      }
    }
  });

  // Table
  const tbody = document.getElementById('accuracyTableBody');
  tbody.innerHTML = monthlyAcc.map(m => {
    const acc = m.accuracy;
    const cls = acc >= 80 ? 'high' : acc >= 60 ? 'medium' : 'low';
    const variance = m.actual_sum - m.predicted_sum;
    return `
      <tr>
        <td>${m.month}</td>
        <td><span class="acc-badge ${cls}">${acc.toFixed(1)}%</span></td>
        <td>₹${fmtNum(m.mae)}</td>
        <td>₹${fmtNum(m.actual_sum)}</td>
        <td>₹${fmtNum(m.predicted_sum)}</td>
        <td style="color:${variance >= 0 ? 'var(--green)' : 'var(--red)'}">
          ${variance >= 0 ? '+' : ''}₹${fmtNum(variance)}
        </td>
      </tr>
    `;
  }).join('');
}

// ===== RISKS =====
function renderRisks(risks, metrics) {
  const scoreEl = document.getElementById('riskScore');
  const levelEl = document.getElementById('riskLevel');
  const score = risks.risk_score;
  scoreEl.textContent = score;
  levelEl.textContent = risks.overall_level;
  levelEl.className = 'risk-score-level ' + risks.overall_level;

  // Gauge
  const ctx = document.getElementById('riskGauge')?.getContext('2d');
  if (ctx) {
    const color = score >= 60 ? '#f43f5e' : score >= 40 ? '#fb923c' : score >= 20 ? '#f59e0b' : '#22c55e';
    ctx.clearRect(0, 0, 200, 110);
    // BG arc
    ctx.beginPath();
    ctx.arc(100, 100, 80, Math.PI, 0, false);
    ctx.lineWidth = 14;
    ctx.strokeStyle = '#ffffff0a';
    ctx.stroke();
    // Fill arc
    const end = Math.PI + (Math.PI * score / 100);
    ctx.beginPath();
    ctx.arc(100, 100, 80, Math.PI, end, false);
    ctx.strokeStyle = color;
    ctx.lineCap = 'round';
    ctx.stroke();
  }

  // Summary sidebar
  const riskCounts = { Critical: 0, High: 0, Medium: 0, Low: 0 };
  risks.risks.forEach(r => { riskCounts[r.level] = (riskCounts[r.level] || 0) + 1; });
  document.getElementById('riskSummary').innerHTML = `
    <h3>Risk Summary</h3>
    ${Object.entries(riskCounts).map(([lvl, cnt]) => `
      <div class="risk-stat-row">
        <span class="risk-stat-name">${lvl} Risks</span>
        <span class="risk-stat-val">${cnt}</span>
      </div>
    `).join('')}
    <div class="risk-stat-row"><span class="risk-stat-name">Model Accuracy</span><span class="risk-stat-val" style="color:var(--accent)">${metrics.accuracy_percent.toFixed(1)}%</span></div>
    <div class="risk-stat-row"><span class="risk-stat-name">MAPE</span><span class="risk-stat-val">${metrics.mape.toFixed(2)}%</span></div>
    <div class="risk-stat-row"><span class="risk-stat-name">R² Score</span><span class="risk-stat-val">${metrics.r2.toFixed(4)}</span></div>
    <div class="risk-stat-row"><span class="risk-stat-name">Total Risks Detected</span><span class="risk-stat-val">${risks.risks.length}</span></div>
  `;

  // Risk cards
  document.getElementById('riskCards').innerHTML = risks.risks.length
    ? risks.risks.map(r => `
        <div class="risk-card ${r.level}">
          <div class="risk-card-head">
            <span class="risk-card-title">${r.title}</span>
            <span class="risk-level-tag ${r.level}">${r.level}</span>
          </div>
          <p class="risk-card-desc">${r.description}</p>
          <div class="risk-meta">
            <div class="risk-meta-item">Impact: <strong>${r.impact}</strong></div>
            <div class="risk-meta-item">Probability: <strong>${r.probability}</strong></div>
          </div>
        </div>
      `).join('')
    : '<p style="color:var(--green);padding:20px">✓ No significant risks detected in current forecast.</p>';
}

// ===== IMPROVEMENTS =====
let allImprovements = [];

function renderImprovements(improvements) {
  allImprovements = improvements;
  renderFilteredImprovements('all');
}

function renderFilteredImprovements(filter) {
  const data = filter === 'all' ? allImprovements : allImprovements.filter(i => i.priority === filter);
  document.getElementById('improvementsGrid').innerHTML = data.map(imp => `
    <div class="imp-card">
      <div class="imp-card-head">
        <span class="imp-category">${imp.category}</span>
        <span class="imp-priority-badge ${imp.priority}">${imp.priority} Priority</span>
      </div>
      <div class="imp-title">${imp.title}</div>
      <p class="imp-desc">${imp.description}</p>
      <div class="imp-footer">
        <div class="imp-footer-item">Impact: <strong>${imp.expected_impact}</strong></div>
        <div class="imp-footer-item effort">Effort: <strong>${imp.effort}</strong></div>
      </div>
    </div>
  `).join('');
}

document.querySelectorAll('.filter-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    renderFilteredImprovements(btn.dataset.filter);
  });
});

// ===== CATEGORIES =====
function renderCategories(cats) {
  const inflowEntries = Object.entries(cats.inflow_categories || {});
  const outflowEntries = Object.entries(cats.outflow_categories || {});
  const maxIn = Math.max(...inflowEntries.map(([,v]) => v), 1);
  const maxOut = Math.max(...outflowEntries.map(([,v]) => v), 1);

  const INFLOW_COLORS = ['#22c55e','#4ade80','#86efac','#34d399','#6ee7b7','#a7f3d0','#059669','#10b981','#6ee7b7','#d1fae5'];
  const OUTFLOW_COLORS = ['#f43f5e','#fb7185','#fda4af','#e11d48','#f87171','#fca5a5','#ef4444','#dc2626','#fecaca','#fee2e2'];

  // Pie charts
  createChart('inflowPieChart', {
    type: 'doughnut',
    data: {
      labels: inflowEntries.map(([k]) => k),
      datasets: [{ data: inflowEntries.map(([,v]) => v), backgroundColor: INFLOW_COLORS, borderColor: '#13161e', borderWidth: 2 }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '60%',
      plugins: {
        legend: { display: true, position: 'right', labels: { color: '#8b90a0', boxWidth: 10, font: { size: 10 } } },
        tooltip: chartDefaults.plugins.tooltip
      }
    }
  });

  createChart('outflowPieChart', {
    type: 'doughnut',
    data: {
      labels: outflowEntries.map(([k]) => k),
      datasets: [{ data: outflowEntries.map(([,v]) => v), backgroundColor: OUTFLOW_COLORS, borderColor: '#13161e', borderWidth: 2 }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '60%',
      plugins: {
        legend: { display: true, position: 'right', labels: { color: '#8b90a0', boxWidth: 10, font: { size: 10 } } },
        tooltip: chartDefaults.plugins.tooltip
      }
    }
  });

  // Category tables
  document.getElementById('categoryTables').innerHTML = `
    <div class="cat-table-card">
      <div class="cat-table-title" style="color:var(--green)">↑ Inflow Sources</div>
      ${inflowEntries.map(([k, v]) => `
        <div class="cat-row">
          <div>
            <div class="cat-name">${k}</div>
            <div class="cat-bar" style="width:${(v/maxIn*100).toFixed(0)}%;background:var(--green);opacity:0.4"></div>
          </div>
          <div class="cat-amount" style="color:var(--green)">₹${fmtNum(v)}</div>
        </div>
      `).join('')}
    </div>
    <div class="cat-table-card">
      <div class="cat-table-title" style="color:var(--red)">↓ Outflow Sources</div>
      ${outflowEntries.map(([k, v]) => `
        <div class="cat-row">
          <div>
            <div class="cat-name">${k}</div>
            <div class="cat-bar" style="width:${(v/maxOut*100).toFixed(0)}%;background:var(--red);opacity:0.4"></div>
          </div>
          <div class="cat-amount" style="color:var(--red)">₹${fmtNum(v)}</div>
        </div>
      `).join('')}
    </div>
  `;
}

// ===== ADD DATA TAB =====
(function () {
  // Set default date to today
  const dateInput = document.getElementById('entry-date');
  if (dateInput) dateInput.value = new Date().toISOString().slice(0, 10);

  // ---------- staged entries in memory ----------
  const staged = [];

  function refreshStagedTable() {
    const card  = document.getElementById('stagedCard');
    const tbody = document.getElementById('stagedTbody');
    if (!staged.length) { card.style.display = 'none'; return; }
    card.style.display = '';
    tbody.innerHTML = staged.map((r, i) => `
      <tr>
        <td>${r.date}</td>
        <td><span class="type-badge ${r.type === 'Inflow' ? 'badge-in' : 'badge-out'}">${r.type}</span></td>
        <td>${r.category}</td>
        <td class="${r.type === 'Inflow' ? 'amt-in' : 'amt-out'}">₹${fmtNum(r.amount)}</td>
        <td><button class="btn-remove-row" data-idx="${i}">✕</button></td>
      </tr>
    `).join('');
    tbody.querySelectorAll('.btn-remove-row').forEach(b =>
      b.addEventListener('click', () => { staged.splice(+b.dataset.idx, 1); refreshStagedTable(); })
    );
  }

  function setFeedback(id, msg, ok) {
    const el = document.getElementById(id);
    if (!el) return;
    el.textContent = msg;
    el.className   = 'form-feedback ' + (ok ? 'fb-ok' : 'fb-err');
    if (ok) setTimeout(() => { el.textContent = ''; el.className = 'form-feedback'; }, 4000);
  }

  // ---------- single entry ----------
  document.getElementById('btnAddEntry')?.addEventListener('click', () => {
    const date     = document.getElementById('entry-date').value.trim();
    const type     = document.getElementById('entry-type').value;
    const category = document.getElementById('entry-category').value.trim();
    const amount   = parseFloat(document.getElementById('entry-amount').value);

    if (!date || !category || isNaN(amount) || amount <= 0) {
      setFeedback('entryFeedback', 'Please fill in all fields with valid values.', false);
      return;
    }
    staged.push({ date, type, category, amount });
    refreshStagedTable();
    setFeedback('entryFeedback', `Entry added to staging (${staged.length} total). Hit "Save All" to retrain.`, true);
    document.getElementById('entry-category').value = '';
    document.getElementById('entry-amount').value   = '';
  });

  // ---------- save all staged → server → retrain ----------
  document.getElementById('btnSaveAll')?.addEventListener('click', async () => {
    if (!staged.length) return;
    const btn = document.getElementById('btnSaveAll');
    btn.textContent = 'Saving...';
    btn.disabled    = true;

    let ok = 0, fail = 0;
    for (const r of staged) {
      try {
        const res = await fetch(API + '/api/add-entry', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(r),
        });
        const j = await res.json();
        if (j.success) ok++; else fail++;
      } catch { fail++; }
    }

    btn.textContent = 'Save All to CSV & Retrain';
    btn.disabled    = false;

    if (ok) {
      staged.splice(0); refreshStagedTable();
      document.getElementById('uploadFeedback').innerHTML =
        `<div class="uf-ok">✓ ${ok} entries saved & model retrained. Refresh the page to see updated forecasts.</div>`;
    }
    if (fail) {
      document.getElementById('uploadFeedback').innerHTML +=
        `<div class="uf-err">✗ ${fail} entries failed.</div>`;
    }
  });

  document.getElementById('btnClearStaged')?.addEventListener('click', () => {
    staged.splice(0); refreshStagedTable();
  });

  // ---------- CSV drag & drop / browse ----------
  const zone       = document.getElementById('uploadZone');
  const fileInput  = document.getElementById('csvFileInput');
  const uploadActs = document.getElementById('uploadActions');
  let   pickedFile = null;

  function pickFile(f) {
    if (!f || !f.name.endsWith('.csv')) {
      setFeedback('uploadFeedback', 'Please select a .csv file.', false); return;
    }
    pickedFile = f;
    document.getElementById('uploadFileName').textContent = f.name;
    uploadActs.style.display = 'flex';
  }

  zone?.addEventListener('dragover',  e => { e.preventDefault(); zone.classList.add('drag-over'); });
  zone?.addEventListener('dragleave', ()  => zone.classList.remove('drag-over'));
  zone?.addEventListener('drop', e => {
    e.preventDefault(); zone.classList.remove('drag-over');
    pickFile(e.dataTransfer.files[0]);
  });
  fileInput?.addEventListener('change', () => pickFile(fileInput.files[0]));

  document.getElementById('btnCancelUpload')?.addEventListener('click', () => {
    pickedFile = null; uploadActs.style.display = 'none';
    if (fileInput) fileInput.value = '';
  });

  document.getElementById('btnUpload')?.addEventListener('click', async () => {
    if (!pickedFile) return;
    const btn = document.getElementById('btnUpload');
    btn.textContent = 'Uploading...';
    btn.disabled    = true;

    const fd = new FormData();
    fd.append('file', pickedFile);
    fd.append('mode', 'append');   // always append — never overwrite history

    try {
      const res = await fetch(API + '/api/upload-csv', { method: 'POST', body: fd });
      const j   = await res.json();
      document.getElementById('uploadFeedback').innerHTML = j.success
        ? `<div class="uf-ok">✓ ${j.message} Refresh the page to see updated forecasts.</div>`
        : `<div class="uf-err">✗ ${j.error}</div>`;
      if (j.success) { uploadActs.style.display = 'none'; pickedFile = null; }
    } catch (e) {
      document.getElementById('uploadFeedback').innerHTML = `<div class="uf-err">✗ Upload failed: ${e.message}</div>`;
    }
    btn.textContent = 'Upload & Retrain Model';
    btn.disabled    = false;
  });

  // tab title
  const tabs = { overview:'Overview', forecast:'Forecast', accuracy:'Accuracy', risks:'Risks', improvements:'Improvements', categories:'Breakdown', adddata:'Add Data' };
  document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', () => {
      document.getElementById('pageTitle').textContent = tabs[item.dataset.tab] || item.dataset.tab;
    });
  });
})();

// ===== INIT =====
loadAll();