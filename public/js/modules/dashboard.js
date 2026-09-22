// Corporate Dashboard Module
import { api } from '../api.js';
import { state } from '../state.js';
import { formatINR, renderAttendanceBadge, renderTxnTypeBadge } from '../utils/formatters.js';

export function initDashboardModule() {
  // Listen for real-time changes
  state.on('attendance_data_changed', () => {
    if (state.activeTab === 'dashboard') loadDashboardData();
  });

  state.on('accounting_data_changed', () => {
    if (state.activeTab === 'dashboard') loadDashboardData();
  });

  state.on('tab_changed', (tabId) => {
    if (tabId === 'dashboard') loadDashboardData();
  });

  // Initial load
  loadDashboardData();
}

export async function loadDashboardData() {
  try {
    const res = await api.dashboard.getMetrics();
    if (!res.success) return;

    renderKPIs(res.kpis);
    renderAttendanceChart(res.weeklyTrend);
    renderCashflowWidget(res.kpis);
    renderRecentActivities(res.recentAttendance, res.recentTransactions);
  } catch (err) {
    console.error('Failed to load dashboard metrics:', err);
  }
}

function renderKPIs(kpis) {
  const container = document.getElementById('dashboard-kpis');
  if (!container) return;

  container.innerHTML = `
    <!-- Total Employees -->
    <div class="kpi-card kpi-blue">
      <div class="kpi-top">
        <span class="kpi-label">Total Employees</span>
        <div class="kpi-icon" style="color: #2563eb;">👥</div>
      </div>
      <div class="kpi-val">${kpis.totalEmployees}</div>
      <div class="kpi-subtext">
        <span class="badge-trend-up">100% Active</span> Active workforce
      </div>
    </div>

    <!-- Present Today -->
    <div class="kpi-card kpi-green">
      <div class="kpi-top">
        <span class="kpi-label">Present Today</span>
        <div class="kpi-icon" style="color: #059669;">✅</div>
      </div>
      <div class="kpi-val">${kpis.presentToday}</div>
      <div class="kpi-subtext">
        <span class="badge-trend-up">${kpis.attendanceRate}% Rate</span> ${kpis.halfDayToday > 0 ? `(${kpis.halfDayToday} Half Day)` : 'On roster'}
      </div>
    </div>

    <!-- Absent Today -->
    <div class="kpi-card ${kpis.absentToday > 0 ? 'kpi-red' : 'kpi-green'}">
      <div class="kpi-top">
        <span class="kpi-label">Absent Today</span>
        <div class="kpi-icon" style="color: #ef4444;">⚠️</div>
      </div>
      <div class="kpi-val">${kpis.absentToday}</div>
      <div class="kpi-subtext">
        ${kpis.absentToday > 0 
          ? `<span class="badge-trend-alert">${kpis.absentToday} Unscheduled</span> Requires review` 
          : `<span class="badge-trend-up">Full Attendance</span> No unexcused absents`}
      </div>
    </div>

    <!-- Total Salary Budget -->
    <div class="kpi-card kpi-indigo">
      <div class="kpi-top">
        <span class="kpi-label">Monthly Payroll</span>
        <div class="kpi-icon" style="color: #6366f1;">💼</div>
      </div>
      <div class="kpi-val currency" style="font-size: 22px;">${formatINR(kpis.totalSalary)}</div>
      <div class="kpi-subtext">
        <span>${kpis.salaryCount} Employee slips</span> for Sep 2026
      </div>
    </div>

    <!-- Net Cash Balance -->
    <div class="kpi-card kpi-amber">
      <div class="kpi-top">
        <span class="kpi-label">Net Cash Balance</span>
        <div class="kpi-icon" style="color: #d97706;">🏦</div>
      </div>
      <div class="kpi-val currency" style="font-size: 22px; color: ${kpis.netCashBalance >= 0 ? '#059669' : '#dc2626'};">
        ${formatINR(kpis.netCashBalance)}
      </div>
      <div class="kpi-subtext">
        <span>${kpis.totalAccountingEntries} Ledger Entries</span> Recorded
      </div>
    </div>
  `;
}

function renderAttendanceChart(weeklyData = []) {
  const chartContainer = document.getElementById('attendance-trend-chart');
  if (!chartContainer) return;

  if (!weeklyData || weeklyData.length === 0) {
    chartContainer.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100%;color:var(--text-muted);">No attendance trend data available</div>';
    return;
  }

  // Draw clean responsive SVG Bar Chart
  const svgWidth = 600;
  const svgHeight = 200;
  const paddingBottom = 28;
  const paddingTop = 20;
  const paddingLeft = 30;
  const chartHeight = svgHeight - paddingBottom - paddingTop;
  const chartWidth = svgWidth - paddingLeft - 20;

  const maxVal = Math.max(10, ...weeklyData.map(d => (d.present || 0) + (d.absent || 0) + (d.halfDay || 0)));
  const barGroupWidth = chartWidth / weeklyData.length;
  const barWidth = Math.min(32, barGroupWidth * 0.55);

  let barsHtml = '';
  let labelsHtml = '';

  weeklyData.forEach((day, index) => {
    const x = paddingLeft + index * barGroupWidth + (barGroupWidth - barWidth) / 2;
    const presentH = ((day.present || 0) / maxVal) * chartHeight;
    const absentH = ((day.absent || 0) / maxVal) * chartHeight;
    const halfDayH = ((day.halfDay || 0) / maxVal) * chartHeight;

    const yPresent = paddingTop + chartHeight - presentH;
    const yAbsent = yPresent - absentH;
    const yHalf = yAbsent - halfDayH;

    // Bar segment for Present (Green)
    barsHtml += `
      <rect x="${x}" y="${yPresent}" width="${barWidth}" height="${presentH}" fill="#10b981" rx="2">
        <title>${day.date}: ${day.present} Present</title>
      </rect>
    `;

    // Bar segment for Half Day (Amber)
    if (halfDayH > 0) {
      barsHtml += `
        <rect x="${x}" y="${yHalf}" width="${barWidth}" height="${halfDayH}" fill="#f59e0b" rx="2">
          <title>${day.date}: ${day.halfDay} Half Day</title>
        </rect>
      `;
    }

    // Bar segment for Absent (Red)
    if (absentH > 0) {
      barsHtml += `
        <rect x="${x}" y="${yAbsent}" width="${barWidth}" height="${absentH}" fill="#ef4444" rx="2">
          <title>${day.date}: ${day.absent} Absent</title>
        </rect>
      `;
    }

    // X-Axis Date label
    const shortDate = day.date.slice(5); // e.g. "09-16"
    labelsHtml += `
      <text x="${x + barWidth / 2}" y="${svgHeight - 8}" text-anchor="middle" font-size="11" fill="#64748b" font-weight="600">${shortDate}</text>
    `;
  });

  chartContainer.innerHTML = `
    <svg viewBox="0 0 ${svgWidth} ${svgHeight}" class="chart-svg">
      <!-- Grid lines -->
      <line x1="${paddingLeft}" y1="${paddingTop}" x2="${svgWidth - 10}" y2="${paddingTop}" stroke="#e2e8f0" stroke-dasharray="3,3" />
      <line x1="${paddingLeft}" y1="${paddingTop + chartHeight * 0.5}" x2="${svgWidth - 10}" y2="${paddingTop + chartHeight * 0.5}" stroke="#e2e8f0" stroke-dasharray="3,3" />
      <line x1="${paddingLeft}" y1="${paddingTop + chartHeight}" x2="${svgWidth - 10}" y2="${paddingTop + chartHeight}" stroke="#cbd5e1" />
      
      <!-- Bars & Labels -->
      ${barsHtml}
      ${labelsHtml}
    </svg>
    <div style="display:flex; justify-content:center; gap: 18px; margin-top: 6px; font-size: 11px; font-weight: 600;">
      <span style="display:flex;align-items:center;gap:5px;"><span style="width:10px;height:10px;background:#10b981;border-radius:2px;"></span> Present</span>
      <span style="display:flex;align-items:center;gap:5px;"><span style="width:10px;height:10px;background:#f59e0b;border-radius:2px;"></span> Half Day</span>
      <span style="display:flex;align-items:center;gap:5px;"><span style="width:10px;height:10px;background:#ef4444;border-radius:2px;"></span> Absent</span>
    </div>
  `;
}

function renderCashflowWidget(kpis) {
  const container = document.getElementById('cashflow-widget');
  if (!container) return;

  const totalInc = kpis.totalIncome || 0;
  const totalExp = kpis.totalExpense || 0;
  const sum = totalInc + totalExp;
  const incPercent = sum > 0 ? Math.round((totalInc / sum) * 100) : 0;
  const expPercent = sum > 0 ? (100 - incPercent) : 0;

  container.innerHTML = `
    <div style="display: flex; flex-direction: column; gap: 14px;">
      <div style="display: flex; justify-content: space-between; align-items: center;">
        <div>
          <div style="font-size: 11px; color: var(--text-muted); text-transform: uppercase; font-weight: 600;">Total Inflow</div>
          <div style="font-size: 17px; font-weight: 800; color: #059669; font-family: var(--font-mono);">${formatINR(totalInc)}</div>
        </div>
        <div style="text-align: right;">
          <div style="font-size: 11px; color: var(--text-muted); text-transform: uppercase; font-weight: 600;">Total Outflow</div>
          <div style="font-size: 17px; font-weight: 800; color: #dc2626; font-family: var(--font-mono);">${formatINR(totalExp)}</div>
        </div>
      </div>

      <!-- Ratio Bar -->
      <div style="height: 12px; width: 100%; border-radius: var(--radius-full); overflow: hidden; display: flex; background: #e2e8f0;">
        ${sum > 0 ? `
          <div style="width: ${incPercent}%; background: #10b981;" title="Income: ${incPercent}%"></div>
          <div style="width: ${expPercent}%; background: #ef4444;" title="Expense: ${expPercent}%"></div>
        ` : `
          <div style="width: 100%; background: #e2e8f0;" title="No entries recorded yet"></div>
        `}
      </div>

      <div style="display: flex; justify-content: space-between; font-size: 11.5px; color: var(--text-muted);">
        ${sum > 0 
          ? `<span>Income ${incPercent}%</span><span>Expense ${expPercent}%</span>`
          : `<span>Clean company records</span><span>Ready for first entry</span>`
        }
      </div>

      <div style="padding: 12px; background: var(--bg-card-subtle); border-radius: var(--radius-md); display: flex; justify-content: space-between; align-items: center;">
        <span style="font-size: 12.5px; font-weight: 600; color: var(--secondary);">Monthly Net Surplus:</span>
        <span style="font-family: var(--font-mono); font-weight: 800; font-size: 15px; color: ${kpis.netCashBalance >= 0 ? '#059669' : '#dc2626'};">
          ${formatINR(kpis.netCashBalance)}
        </span>
      </div>
    </div>
  `;
}

function renderRecentActivities(recentAttendance = [], recentTransactions = []) {
  const attList = document.getElementById('recent-attendance-list');
  const txnList = document.getElementById('recent-transactions-list');

  if (attList) {
    if (recentAttendance.length === 0) {
      attList.innerHTML = '<div style="color:var(--text-muted);font-size:12px;">No recent attendance records</div>';
    } else {
      attList.innerHTML = recentAttendance.map(r => `
        <div style="display:flex; justify-content:space-between; align-items:center; padding: 8px 0; border-bottom: 1px solid var(--border-subtle); font-size: 12.5px;">
          <div>
            <div style="font-weight:600; color:var(--secondary);">${r.emp_name} <span style="font-family:var(--font-mono);font-size:11px;color:var(--text-muted);">(${r.emp_id})</span></div>
            <div style="font-size:11px; color:var(--text-muted);">${r.date} &bull; ${r.working_hours} hrs</div>
          </div>
          <div>${renderAttendanceBadge(r.status)}</div>
        </div>
      `).join('');
    }
  }

  if (txnList) {
    if (recentTransactions.length === 0) {
      txnList.innerHTML = '<div style="color:var(--text-muted);font-size:12px;">No recent transactions</div>';
    } else {
      txnList.innerHTML = recentTransactions.map(t => {
        const isInc = t.income > 0;
        const amount = isInc ? `+${formatINR(t.income)}` : `-${formatINR(t.expense)}`;
        const color = isInc ? 'color:#059669;' : 'color:#dc2626;';

        return `
          <div style="display:flex; justify-content:space-between; align-items:center; padding: 8px 0; border-bottom: 1px solid var(--border-subtle); font-size: 12.5px;">
            <div style="max-width: 65%;">
              <div style="font-weight:600; color:var(--secondary); text-overflow:ellipsis; overflow:hidden; white-space:nowrap;">${t.description}</div>
              <div style="font-size:11px; color:var(--text-muted);">${t.date} &bull; ${t.party}</div>
            </div>
            <div style="text-align:right;">
              <div style="font-family:var(--font-mono); font-weight:700; ${color}">${amount}</div>
              ${renderTxnTypeBadge(t.type)}
            </div>
          </div>
        `;
      }).join('');
    }
  }
}
