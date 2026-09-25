'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';

// Types
interface UserItem {
  id: string;
  name: string;
  username: string;
  role: 'Admin' | 'Manager' | 'Staff';
  status: 'Active' | 'Disabled';
  created_at?: string;
}

interface EmployeeItem {
  id: string;
  employee_code: string;
  name: string;
  phone: string;
  designation: string;
  basic_salary: number;
  allowance: number;
  deduction: number;
  status: string;
  created_at?: string;
}

interface AttendanceItem {
  id: string;
  emp_id: string;
  emp_name: string;
  date: string;
  attendance_date?: string;
  day: string;
  check_in?: string;
  check_out?: string;
  status: 'Present' | 'Absent' | 'Half Day' | 'Leave';
  working_hours: number;
  remarks?: string;
  updated_by?: string;
}

interface TransactionItem {
  id: string;
  date: string;
  type: 'Income' | 'Expense' | 'Salary' | 'Other';
  description: string;
  party: string;
  income: number;
  expense: number;
  balance?: number;
  remarks?: string;
  updated_by?: string;
}

interface SalaryItem {
  id: string;
  emp_id: string;
  emp_name: string;
  month: string;
  basic_salary: number;
  allowance: number;
  deduction: number;
  net_salary: number;
  payment_date?: string;
  payment_status: 'Paid' | 'Pending' | 'Processing';
  remarks?: string;
  updated_by?: string;
}

interface BackupItem {
  id: string;
  backup_type: string;
  description: string;
  records_count: number;
  is_restored: boolean;
  created_at: string;
  restored_at?: string;
  cleared_by?: string;
}

interface DatabaseUsageMetrics {
  databaseName: string;
  status: 'Healthy' | 'Warning' | 'High Usage' | 'Critical';
  storageUsedMB: number;
  storageLimitMB: number;
  usagePercentage: number;
  remainingStorageMB: number;
  databaseSizeBytes: number;
  dataSizeMB: number;
  storageSizeBytes: number;
  indexSizeMB: number;
  collectionsCount: number;
  objectsCount: number;
  avgObjSizeBytes: number;
  collections: Array<{
    name: string;
    count: number;
    sizeKB: number;
    storageKB: number;
    totalIndexKB: number;
  }>;
  lastUpdated: string;
  note: string;
}

export default function FromexApplication() {
  // Navigation & Sub-navigation State
  const [activeTab, setActiveTab] = useState<'dashboard' | 'employees' | 'attendance' | 'accounting' | 'settings'>('dashboard');
  const [accSubTab, setAccSubTab] = useState<'salaries' | 'transactions'>('salaries');
  const [settingsSubTab, setSettingsSubTab] = useState<'users' | 'data' | 'monitor' | 'info'>('users');

  // Active Session User
  const [currentUser, setCurrentUser] = useState<UserItem>({
    id: '',
    name: 'FROMEX',
    username: 'fromex',
    role: 'Admin',
    status: 'Active'
  });
  const [authToken, setAuthToken] = useState<string | null>(null);

  // Live Clock
  const [liveTime, setLiveTime] = useState({ date: '', time: '' });

  // Data Collections
  const [employees, setEmployees] = useState<EmployeeItem[]>([]);
  const [attendance, setAttendance] = useState<AttendanceItem[]>([]);
  const [salaries, setSalaries] = useState<SalaryItem[]>([]);
  const [transactions, setTransactions] = useState<TransactionItem[]>([]);
  const [users, setUsers] = useState<UserItem[]>([]);
  const [backups, setBackups] = useState<BackupItem[]>([]);
  const [dbMonitor, setDbMonitor] = useState<DatabaseUsageMetrics | null>(null);
  const [dashboardData, setDashboardData] = useState<any>(null);

  // Filter & Search States
  const [empSearch, setEmpSearch] = useState('');
  const [empStatusFilter, setEmpStatusFilter] = useState('All');
  const [empSort, setEmpSort] = useState({ field: 'employee_code', order: 'asc' });

  const [attSearch, setAttSearch] = useState('');
  const [attStatusFilter, setAttStatusFilter] = useState('All');
  const [attEmpFilter, setAttEmpFilter] = useState('All');
  const [attViewMode, setAttViewMode] = useState<'daily' | 'monthly' | 'all'>('daily');
  const [attDate, setAttDate] = useState('2026-09-16');
  const [attMonth, setAttMonth] = useState('2026-09');
  const [attSort, setAttSort] = useState({ field: 'date', order: 'desc' });

  const [salSearch, setSalSearch] = useState('');
  const [salMonthFilter, setSalMonthFilter] = useState('September 2026');
  const [salStatusFilter, setSalStatusFilter] = useState('All');
  const [salSort, setSalSort] = useState({ field: 'emp_id', order: 'asc' });

  const [txnSearch, setTxnSearch] = useState('');
  const [txnTypeFilter, setTxnTypeFilter] = useState('All');
  const [txnSort, setTxnSort] = useState({ field: 'date', order: 'desc' });

  const [userSearch, setUserSearch] = useState('');
  const [userRoleFilter, setUserRoleFilter] = useState('All');
  const [userStatusFilter, setUserStatusFilter] = useState('All');

  // Modals & Dialogs State
  const [modalType, setModalType] = useState<string | null>(null);
  const [modalData, setModalData] = useState<any>(null);

  // Confirmation Dialog
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    title: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    isDanger?: boolean;
    onConfirm: () => void;
  } | null>(null);

  // Toast System
  const [toasts, setToasts] = useState<Array<{ id: number; message: string; type: 'success' | 'error' | 'warning' | 'info' }>>([]);

  // Floating Undo Banner
  const [showUndoBanner, setShowUndoBanner] = useState(false);
  const [undoCountdown, setUndoCountdown] = useState(60);
  const [lastBackupId, setLastBackupId] = useState<string | null>(null);
  const undoIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Toast trigger
  const showToast = (message: string, type: 'success' | 'error' | 'warning' | 'info' = 'info') => {
    const id = Date.now() + Math.random();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4000);
  };

  // API helper with active token
  const apiFetch = async (endpoint: string, options: RequestInit = {}) => {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string> || {})
    };

    const token = authToken || (typeof window !== 'undefined' ? localStorage.getItem('fromex_token') : null);
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
      headers['x-user-token'] = token;
    }

    const res = await fetch(endpoint, { ...options, headers });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.message || `Request failed with status ${res.status}`);
    }
    return data;
  };

  // 1. Live Clock Initialization
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const dateStr = now.toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
      const timeStr = now.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true
      });
      setLiveTime({ date: dateStr, time: timeStr });
    };
    updateTime();
    const timer = setInterval(updateTime, 1000);
    return () => clearInterval(timer);
  }, []);

  // 2. Initial Auth & User Load
  useEffect(() => {
    const initAuth = async () => {
      try {
        const savedToken = localStorage.getItem('fromex_token');
        if (savedToken) {
          setAuthToken(savedToken);
          const meRes = await fetch('/api/auth/me', {
            headers: { Authorization: `Bearer ${savedToken}` }
          });
          const meData = await meRes.json();
          if (meRes.ok && meData.user) {
            setCurrentUser(meData.user);
            return;
          }
        }

        // Unauthenticated: redirect to /login
        window.location.href = '/login';
      } catch (err) {
        window.location.href = '/login';
      }
    };
    initAuth();
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('fromex_token');
    document.cookie = 'fromex_token=; path=/; expires=Thu, 01 Jan 1970 00:00:01 GMT;';
    window.location.href = '/login';
  };

  // 3. Load Data based on active tab
  const loadEmployees = async () => {
    try {
      const res = await apiFetch(`/api/employees?search=${encodeURIComponent(empSearch)}&status=${empStatusFilter}&sortField=${empSort.field}&sortOrder=${empSort.order}`);
      setEmployees(res.employees || []);
    } catch (e: any) {
      console.error(e);
    }
  };

  const loadAttendance = async () => {
    try {
      let url = `/api/attendance?search=${encodeURIComponent(attSearch)}&status=${attStatusFilter}&sortField=${attSort.field}&sortOrder=${attSort.order}`;
      if (attEmpFilter !== 'All') url += `&emp_id=${attEmpFilter}`;
      if (attViewMode === 'daily') url += `&date=${attDate}`;
      else if (attViewMode === 'monthly') url += `&month=${attMonth}`;

      const res = await apiFetch(url);
      setAttendance(res.records || []);
    } catch (e: any) {
      console.error(e);
    }
  };

  const loadSalaries = async () => {
    try {
      let url = `/api/salaries?search=${encodeURIComponent(salSearch)}&month=${salMonthFilter}&status=${salStatusFilter}&sortField=${salSort.field}&sortOrder=${salSort.order}`;
      const res = await apiFetch(url);
      setSalaries(res.salaries || []);
    } catch (e: any) {
      console.error(e);
    }
  };

  const loadTransactions = async () => {
    try {
      let url = `/api/accounting?search=${encodeURIComponent(txnSearch)}&type=${txnTypeFilter}&sortOrder=${txnSort.order}`;
      const res = await apiFetch(url);
      setTransactions(res.transactions || []);
    } catch (e: any) {
      console.error(e);
    }
  };

  const loadUsers = async () => {
    try {
      const res = await apiFetch(`/api/users?search=${encodeURIComponent(userSearch)}&role=${userRoleFilter}&status=${userStatusFilter}`);
      setUsers(res.users || []);
    } catch (e: any) {
      console.error(e);
    }
  };

  const loadBackups = async () => {
    try {
      const res = await apiFetch('/api/settings/backups');
      setBackups(res.backups || []);
    } catch (e: any) {
      console.error(e);
    }
  };

  const loadDatabaseMonitor = async () => {
    try {
      const res = await apiFetch('/api/settings/database-usage');
      setDbMonitor(res.data || res);
    } catch (e: any) {
      console.error(e);
    }
  };

  const loadDashboard = async () => {
    try {
      const res = await apiFetch(`/api/dashboard/metrics?date=${attDate}&month=${salMonthFilter}`);
      setDashboardData(res.data || res);
    } catch (e: any) {
      console.error(e);
    }
  };

  // Trigger loads
  useEffect(() => {
    if (activeTab === 'dashboard') loadDashboard();
    if (activeTab === 'employees') loadEmployees();
    if (activeTab === 'attendance') loadAttendance();
    if (activeTab === 'accounting') {
      loadSalaries();
      loadTransactions();
    }
    if (activeTab === 'settings') {
      if (settingsSubTab === 'users') loadUsers();
      if (settingsSubTab === 'data') loadBackups();
      if (settingsSubTab === 'monitor') loadDatabaseMonitor();
    }
  }, [
    activeTab,
    settingsSubTab,
    accSubTab,
    empSearch, empStatusFilter, empSort,
    attSearch, attStatusFilter, attEmpFilter, attViewMode, attDate, attMonth, attSort,
    salSearch, salMonthFilter, salStatusFilter, salSort,
    txnSearch, txnTypeFilter, txnSort,
    userSearch, userRoleFilter, userStatusFilter
  ]);

  // Load employee list for dropdowns
  useEffect(() => {
    apiFetch('/api/employees').then(res => {
      if (res.employees) setEmployees(res.employees);
    }).catch(() => {});
  }, []);

  // Accounting Summary totals
  const accSummary = useMemo(() => {
    let income = 0;
    let expense = 0;
    transactions.forEach(t => {
      income += Number(t.income || 0);
      expense += Number(t.expense || 0);
    });
    const balance = Math.round((income - expense) * 100) / 100;

    let payroll = 0;
    salaries.forEach(s => {
      payroll += Number(s.net_salary || 0);
    });

    return {
      income: income.toLocaleString('en-IN', { minimumFractionDigits: 2 }),
      expense: expense.toLocaleString('en-IN', { minimumFractionDigits: 2 }),
      balance: balance.toLocaleString('en-IN', { minimumFractionDigits: 2 }),
      payroll: payroll.toLocaleString('en-IN', { minimumFractionDigits: 2 })
    };
  }, [transactions, salaries]);

  // Undo countdown timer
  const startUndoCountdown = (backupId: string) => {
    setLastBackupId(backupId);
    setShowUndoBanner(true);
    setUndoCountdown(60);

    if (undoIntervalRef.current) clearInterval(undoIntervalRef.current);
    undoIntervalRef.current = setInterval(() => {
      setUndoCountdown(prev => {
        if (prev <= 1) {
          clearInterval(undoIntervalRef.current!);
          setShowUndoBanner(false);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  // Perform Undo
  const handleUndoClear = async (backupIdToRestore?: string) => {
    try {
      const id = backupIdToRestore || lastBackupId;
      const res = await apiFetch('/api/settings/undo-clear', {
        method: 'POST',
        body: JSON.stringify({ backupId: id })
      });
      setShowUndoBanner(false);
      showToast(res.message || 'Data successfully restored!', 'success');
      loadEmployees();
      loadAttendance();
      loadSalaries();
      loadTransactions();
      loadBackups();
      loadDashboard();
      if (settingsSubTab === 'monitor') loadDatabaseMonitor();
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  // Perform Clear Data
  const handleClearData = async () => {
    setConfirmDialog({
      open: true,
      title: 'Clear All Operational Data?',
      message: 'This will clear all current attendance, salary slips, and accounting transactions. An immutable full snapshot will be automatically created, and you can undo anytime with zero data loss.',
      confirmText: 'Yes, Clear Data',
      cancelText: 'Cancel',
      isDanger: true,
      onConfirm: async () => {
        try {
          const res = await apiFetch('/api/settings/clear-data', {
            method: 'POST',
            body: JSON.stringify({ scope: 'operational', note: 'Manual clear from UI' })
          });
          if (res.totalCleared > 0) {
            startUndoCountdown(res.backupId);
            showToast(`Cleared ${res.totalCleared} operational records. Undo snapshot created!`, 'warning');
            loadAttendance();
            loadSalaries();
            loadTransactions();
            loadBackups();
            loadDashboard();
            if (settingsSubTab === 'monitor') loadDatabaseMonitor();
          } else {
            showToast('Database is already empty.', 'info');
          }
        } catch (err: any) {
          showToast(err.message, 'error');
        } finally {
          setConfirmDialog(null);
        }
      }
    });
  };

  // CSV Export utility
  const exportCSV = (filename: string, headers: string[], rows: (string | number)[][]) => {
    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(val => `"${String(val).replace(/"/g, '""')}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.setAttribute('download', `${filename}_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast(`Exported ${filename}.csv`, 'success');
  };

  return (
    <div className="fromex-app">
      {/* Mobile Live Time Banner */}
      <div className="mobile-time-bar">
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span className="live-indicator-icon"></span>
          <span>{liveTime.date || 'Wednesday, 16 September 2026'}</span>
        </div>
        <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: '#38bdf8' }}>
          {liveTime.time || '--:--:-- --'}
        </div>
      </div>

      {/* Corporate Header */}
      <header className="app-header">
        <div className="brand-section">
          <div className="brand-logo-icon">FX</div>
          <div className="brand-info">
            <span className="brand-title">FROMEX</span>
            <span className="brand-subtitle">Corporate Management</span>
          </div>
        </div>

        {/* Live Date & Clock Display */}
        <div className="header-center">
          <div className="live-date-wrapper">
            <span className="live-indicator-icon"></span>
            <span className="header-label">Date:</span>
            <span className="live-date-val">{liveTime.date}</span>
          </div>
          <div className="header-divider"></div>
          <div className="live-clock-wrapper">
            <span className="header-label">Time:</span>
            <span className="live-clock-val">{liveTime.time}</span>
          </div>
        </div>

        {/* Header Right Actions */}
        <div className="header-actions">
          <button
            type="button"
            id="header-btn-clear-data"
            className="header-clear-btn"
            onClick={handleClearData}
            title="Clear operational records with instant undo protection"
          >
            <span>🗑️</span> Clear Data
          </button>

          <div id="sync-status-badge" className="sync-status-badge">
            <span className="live-indicator-icon"></span> MongoDB Atlas Active
          </div>

          <button
            type="button"
            id="user-profile-btn"
            className="user-profile-btn"
            onClick={() => {
              apiFetch('/api/auth/users').then(res => {
                setModalType('user-switcher');
                setModalData(res.users || []);
              });
            }}
            title="Switch Authorized User"
          >
            <div id="header-user-avatar" className="user-avatar">
              {currentUser.name === 'FROMEX' ? 'FX' : currentUser.name.charAt(0)}
            </div>
            <div className="user-meta">
              <span id="header-user-name" className="user-name">{currentUser.name}</span>
              <span id="header-user-role" className="user-role">{currentUser.role}</span>
            </div>
            <span className="user-dropdown-arrow">&#9662;</span>
          </button>

          <button
            type="button"
            id="header-logout-btn"
            className="header-clear-btn"
            onClick={handleLogout}
            title="Log Out of System"
            style={{
              background: '#fef2f2',
              color: '#dc2626',
              border: '1px solid #fecaca',
              marginLeft: '4px'
            }}
          >
            <span>🚪</span> Logout
          </button>
        </div>
      </header>

      {/* Navigation Bar */}
      <nav className="app-navbar">
        <div className="nav-tabs">
          <button
            type="button"
            className={`nav-tab ${activeTab === 'dashboard' ? 'active' : ''}`}
            onClick={() => setActiveTab('dashboard')}
            id="nav-tab-dashboard"
          >
            <span className="nav-tab-icon">📊</span>
            <span>Dashboard</span>
          </button>
          <button
            type="button"
            className={`nav-tab ${activeTab === 'employees' ? 'active' : ''}`}
            onClick={() => setActiveTab('employees')}
            id="nav-tab-employees"
          >
            <span className="nav-tab-icon">👥</span>
            <span>Employees</span>
          </button>
          <button
            type="button"
            className={`nav-tab ${activeTab === 'attendance' ? 'active' : ''}`}
            onClick={() => setActiveTab('attendance')}
            id="nav-tab-attendance"
          >
            <span className="nav-tab-icon">⏱️</span>
            <span>Attendance</span>
          </button>
          <button
            type="button"
            className={`nav-tab ${activeTab === 'accounting' ? 'active' : ''}`}
            onClick={() => setActiveTab('accounting')}
            id="nav-tab-accounting"
          >
            <span className="nav-tab-icon">💳</span>
            <span>Accounting</span>
          </button>
          <button
            type="button"
            className={`nav-tab ${activeTab === 'settings' ? 'active' : ''}`}
            onClick={() => setActiveTab('settings')}
            id="nav-tab-settings"
          >
            <span className="nav-tab-icon">⚙️</span>
            <span>Settings</span>
          </button>
        </div>
      </nav>

      {/* Main View Area */}
      <main className="app-main">

        {/* ====================================================
             VIEW 1: DASHBOARD
             ==================================================== */}
        {activeTab === 'dashboard' && (
          <section id="view-dashboard" className="view-section active">
            <div className="view-header">
              <div className="view-title-group">
                <h1>Corporate Dashboard</h1>
                <p>Real-time workforce attendance metrics and company financial overview</p>
              </div>
              <div className="view-toolbar">
                <button
                  type="button"
                  id="btn-quick-employee"
                  className="btn btn-outline btn-sm"
                  onClick={() => { setModalType('employee'); setModalData(null); }}
                >
                  <span>+</span> Add Employee
                </button>
                <button
                  type="button"
                  id="btn-quick-attendance"
                  className="btn btn-outline btn-sm"
                  onClick={() => { setModalType('attendance'); setModalData(null); }}
                >
                  <span>+</span> Mark Attendance
                </button>
                <button
                  type="button"
                  id="btn-quick-salary"
                  className="btn btn-outline btn-sm"
                  onClick={() => { setModalType('salary'); setModalData(null); }}
                >
                  <span>+</span> Record Salary Slip
                </button>
                <button
                  type="button"
                  id="btn-quick-txn"
                  className="btn btn-primary btn-sm"
                  onClick={() => { setModalType('transaction'); setModalData(null); }}
                >
                  <span>+</span> New Transaction
                </button>
                <button
                  type="button"
                  className="btn btn-outline btn-sm btn-trigger-clear-data"
                  onClick={handleClearData}
                  style={{ color: 'var(--danger)', borderColor: 'rgba(239, 68, 68, 0.35)' }}
                >
                  <span>🗑️</span> Clear Data
                </button>
              </div>
            </div>

            {/* KPI Grid */}
            <div className="kpi-grid">
              <div className="kpi-card kpi-blue">
                <span className="kpi-label">Total Active Workforce</span>
                <div className="kpi-val">{dashboardData?.kpis?.totalEmployees ?? employees.length}</div>
                <div className="kpi-sub">Registered Staff Members</div>
              </div>
              <div className="kpi-card kpi-green">
                <span className="kpi-label">Today Attendance Rate</span>
                <div className="kpi-val">{dashboardData?.kpis?.attendanceRate ?? 0}%</div>
                <div className="kpi-sub">
                  {dashboardData?.kpis?.presentToday ?? 0} Present &bull; {dashboardData?.kpis?.halfDayToday ?? 0} Half-day &bull; {dashboardData?.kpis?.absentToday ?? 0} Absent
                </div>
              </div>
              <div className="kpi-card kpi-indigo">
                <span className="kpi-label">Monthly Payroll ({salMonthFilter})</span>
                <div className="kpi-val currency">₹{accSummary.payroll}</div>
                <div className="kpi-sub">{salaries.length} Slips Processed</div>
              </div>
              <div className="kpi-card kpi-amber">
                <span className="kpi-label">Net Operating Cash Balance</span>
                <div className="kpi-val currency">₹{accSummary.balance}</div>
                <div className="kpi-sub">Inflow: ₹{accSummary.income} &bull; Outflow: ₹{accSummary.expense}</div>
              </div>
            </div>

            {/* Dashboard Visual Charts & Widgets */}
            <div className="dashboard-content-grid">
              {/* Left: Attendance Trends */}
              <div className="widget-card">
                <div className="widget-header">
                  <div>
                    <div className="widget-title">Attendance Trends (Last 7 Days)</div>
                    <div className="widget-subtitle">Workforce presence, half-day, and absence breakdown</div>
                  </div>
                  <button type="button" className="btn btn-outline btn-sm" onClick={() => setActiveTab('attendance')}>
                    View Roster &rarr;
                  </button>
                </div>

                <div style={{ marginTop: '14px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {dashboardData?.weeklyTrend && dashboardData.weeklyTrend.length > 0 ? (
                    dashboardData.weeklyTrend.map((item: any, idx: number) => (
                      <div key={idx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', background: '#f8fafc', borderRadius: '4px', flexWrap: 'wrap', gap: '6px' }}>
                        <span style={{ fontWeight: 600, fontSize: '13px' }}>{item.date}</span>
                        <div style={{ display: 'flex', gap: '6px', fontSize: '12px', flexWrap: 'wrap' }}>
                          <span className="badge badge-paid">Present: {item.present}</span>
                          <span className="badge badge-half">Half: {item.halfDay}</span>
                          <span className="badge badge-absent">Absent: {item.absent}</span>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)' }}>
                      No attendance trends recorded yet.
                    </div>
                  )}
                </div>

                <div style={{ marginTop: '18px' }}>
                  <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--secondary)', marginBottom: '8px' }}>
                    Recent Attendance Logs
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {dashboardData?.recentAttendance && dashboardData.recentAttendance.length > 0 ? (
                      dashboardData.recentAttendance.map((a: any) => (
                        <div key={a.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 10px', borderBottom: '1px solid #f1f5f9', fontSize: '13px', flexWrap: 'wrap', gap: '6px' }}>
                          <span><strong>{a.emp_name}</strong> ({a.emp_id})</span>
                          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                            <span className="badge badge-paid">{a.status}</span>
                            <span style={{ color: 'var(--text-muted)', fontSize: '11px' }}>{a.date}</span>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div style={{ color: 'var(--text-muted)', fontSize: '12px', padding: '8px 0' }}>No recent logs.</div>
                    )}
                  </div>
                </div>
              </div>

              {/* Right: Financial Overview & Cash Flow Ratio */}
              <div className="widget-card">
                <div className="widget-header">
                  <div>
                    <div className="widget-title">Financial Health & Cashflow</div>
                    <div className="widget-subtitle">Cashflow income vs expense balance</div>
                  </div>
                  <button type="button" className="btn btn-outline btn-sm" onClick={() => setActiveTab('accounting')}>
                    Ledger &rarr;
                  </button>
                </div>

                <div style={{ marginTop: '14px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 14px', background: '#ecfdf5', borderRadius: '6px', color: '#065f46', flexWrap: 'wrap', gap: '6px' }}>
                    <span style={{ fontWeight: 600 }}>Total Cash Inflow</span>
                    <span style={{ fontWeight: 800 }}>₹{accSummary.income}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 14px', background: '#fef2f2', borderRadius: '6px', color: '#991b1b', flexWrap: 'wrap', gap: '6px' }}>
                    <span style={{ fontWeight: 600 }}>Total Cash Outflow</span>
                    <span style={{ fontWeight: 800 }}>₹{accSummary.expense}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 14px', background: '#eff6ff', borderRadius: '6px', color: '#1e40af', flexWrap: 'wrap', gap: '6px' }}>
                    <span style={{ fontWeight: 600 }}>Net Cashbook Balance</span>
                    <span style={{ fontWeight: 800 }}>₹{accSummary.balance}</span>
                  </div>
                </div>

                <div style={{ marginTop: '18px' }}>
                  <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--secondary)', marginBottom: '8px' }}>
                    Recent Ledger Transactions
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {dashboardData?.recentTransactions && dashboardData.recentTransactions.length > 0 ? (
                      dashboardData.recentTransactions.map((t: any) => (
                        <div key={t.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 10px', borderBottom: '1px solid #f1f5f9', fontSize: '13px' }}>
                          <div>
                            <div style={{ fontWeight: 600 }}>{t.description}</div>
                            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{t.type} &bull; {t.date}</div>
                          </div>
                          <div style={{ fontWeight: 700, color: t.income > 0 ? '#059669' : '#dc2626' }}>
                            {t.income > 0 ? `+₹${t.income.toLocaleString()}` : `-₹${t.expense.toLocaleString()}`}
                          </div>
                        </div>
                      ))
                    ) : (
                      <div style={{ color: 'var(--text-muted)', fontSize: '12px', padding: '8px 0' }}>No recent transactions.</div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* ====================================================
             VIEW 2: EMPLOYEES
             ==================================================== */}
        {activeTab === 'employees' && (
          <section id="view-employees" className="view-section active">
            <div className="view-header">
              <div className="view-title-group">
                <h1>Company Employees</h1>
                <p>Manage employee roster, designations, monthly salary packages, and active status</p>
              </div>
              <div className="view-toolbar">
                <button
                  type="button"
                  id="btn-export-employees"
                  className="btn btn-outline"
                  onClick={() => {
                    exportCSV(
                      'employees_roster',
                      ['Employee Code', 'Full Name', 'Designation', 'Phone', 'Basic Salary', 'Allowance', 'Deduction', 'Status'],
                      employees.map(e => [e.employee_code, e.name, e.designation, e.phone, e.basic_salary, e.allowance, e.deduction, e.status])
                    );
                  }}
                >
                  📥 Export to CSV
                </button>
                <button
                  type="button"
                  id="btn-add-employee"
                  className="btn btn-primary"
                  onClick={() => { setModalType('employee'); setModalData(null); }}
                >
                  <span>+</span> Add Employee
                </button>
              </div>
            </div>

            <div className="excel-card">
              <div className="excel-toolbar">
                <div className="excel-toolbar-left">
                  <div className="search-box">
                    <span className="search-icon">🔍</span>
                    <input
                      type="text"
                      id="employees-search-input"
                      className="search-input"
                      placeholder="Search by name, ID, designation, phone..."
                      value={empSearch}
                      onChange={(e) => setEmpSearch(e.target.value)}
                    />
                  </div>

                  <select
                    id="employees-status-filter"
                    className="select-control"
                    title="Filter by Status"
                    value={empStatusFilter}
                    onChange={(e) => setEmpStatusFilter(e.target.value)}
                  >
                    <option value="All">All Statuses</option>
                    <option value="Active">Active</option>
                    <option value="Inactive">Inactive</option>
                    <option value="On Leave">On Leave</option>
                  </select>
                </div>

                <div className="excel-toolbar-right">
                  <span id="employees-count-pill" className="table-stats-pill">{employees.length} Employees</span>
                </div>
              </div>

              <div className="excel-scroll-wrapper">
                <table id="employees-table" className="excel-table">
                  <thead>
                    <tr>
                      <th className="text-center sortable" onClick={() => setEmpSort({ field: 'employee_code', order: empSort.order === 'asc' ? 'desc' : 'asc' })}>
                        Emp Code <span className="sort-indicator">⇅</span>
                      </th>
                      <th className="sortable" onClick={() => setEmpSort({ field: 'name', order: empSort.order === 'asc' ? 'desc' : 'asc' })}>
                        Full Name <span className="sort-indicator">⇅</span>
                      </th>
                      <th className="sortable" onClick={() => setEmpSort({ field: 'designation', order: empSort.order === 'asc' ? 'desc' : 'asc' })}>
                        Designation <span className="sort-indicator">⇅</span>
                      </th>
                      <th className="sortable">Phone</th>
                      <th className="text-right sortable" onClick={() => setEmpSort({ field: 'basic_salary', order: empSort.order === 'asc' ? 'desc' : 'asc' })}>
                        Basic Salary <span className="sort-indicator">⇅</span>
                      </th>
                      <th className="text-right">Allowance</th>
                      <th className="text-right">Deduction</th>
                      <th className="text-right">Net Package</th>
                      <th className="text-center sortable">Status</th>
                      <th className="text-center" style={{ width: '140px' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {employees.length === 0 ? (
                      <tr>
                        <td colSpan={10} style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)' }}>
                          No employees found. Click "+ Add Employee" to create the first staff record.
                        </td>
                      </tr>
                    ) : (
                      employees.map(emp => {
                        const net = Math.max(0, (emp.basic_salary || 0) + (emp.allowance || 0) - (emp.deduction || 0));
                        return (
                          <tr key={emp.id}>
                            <td className="text-center font-mono"><strong>{emp.employee_code}</strong></td>
                            <td><strong>{emp.name}</strong></td>
                            <td>{emp.designation}</td>
                            <td>{emp.phone || '-'}</td>
                            <td className="text-right currency">₹{Number(emp.basic_salary).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                            <td className="text-right currency">₹{Number(emp.allowance).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                            <td className="text-right currency">₹{Number(emp.deduction).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                            <td className="text-right currency" style={{ fontWeight: 700, color: 'var(--primary)' }}>
                              ₹{net.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                            </td>
                            <td className="text-center">
                              <span className={`badge ${emp.status === 'Active' ? 'badge-paid' : 'badge-absent'}`}>
                                {emp.status}
                              </span>
                            </td>
                            <td className="text-center">
                              <div style={{ display: 'flex', gap: '6px', justifyContent: 'center' }}>
                                <button
                                  type="button"
                                  className="btn btn-outline btn-xs"
                                  onClick={() => { setModalType('employee'); setModalData(emp); }}
                                >
                                  ✏️ Edit
                                </button>
                                <button
                                  type="button"
                                  className="btn btn-outline btn-xs"
                                  style={{ color: 'var(--danger)', borderColor: 'rgba(239, 68, 68, 0.3)' }}
                                  onClick={() => {
                                    setConfirmDialog({
                                      open: true,
                                      title: 'Delete Employee?',
                                      message: `Are you sure you want to delete ${emp.name} (${emp.employee_code})? This action cannot be undone.`,
                                      confirmText: 'Delete',
                                      cancelText: 'Cancel',
                                      isDanger: true,
                                      onConfirm: async () => {
                                        try {
                                          await apiFetch(`/api/employees/${emp.id}`, { method: 'DELETE' });
                                          showToast(`Deleted employee ${emp.name}`, 'success');
                                          loadEmployees();
                                        } catch (err: any) {
                                          showToast(err.message, 'error');
                                        } finally {
                                          setConfirmDialog(null);
                                        }
                                      }
                                    });
                                  }}
                                >
                                  🗑️ Delete
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        )}

        {/* ====================================================
             VIEW 3: ATTENDANCE
             ==================================================== */}
        {activeTab === 'attendance' && (
          <section id="view-attendance" className="view-section active">
            <div className="view-header">
              <div className="view-title-group">
                <h1>Attendance Management</h1>
                <p>Excel-like attendance sheet with automated working hours calculation</p>
              </div>
              <div className="view-toolbar">
                <button
                  type="button"
                  id="btn-export-attendance"
                  className="btn btn-outline"
                  onClick={() => {
                    exportCSV(
                      'attendance_register',
                      ['Emp ID', 'Employee Name', 'Date', 'Day', 'Check In', 'Check Out', 'Status', 'Working Hours', 'Remarks'],
                      attendance.map(a => [a.emp_id, a.emp_name, a.date || a.attendance_date || '', a.day || '', a.check_in || '', a.check_out || '', a.status, a.working_hours, a.remarks || ''])
                    );
                  }}
                >
                  📥 Export to CSV
                </button>
                <button
                  type="button"
                  id="btn-add-attendance"
                  className="btn btn-primary"
                  onClick={() => { setModalType('attendance'); setModalData(null); }}
                >
                  <span>+</span> Add Attendance
                </button>
                <button
                  type="button"
                  className="btn btn-outline btn-trigger-clear-data"
                  onClick={handleClearData}
                  style={{ color: 'var(--danger)', borderColor: 'rgba(239, 68, 68, 0.35)' }}
                >
                  <span>🗑️</span> Clear Data
                </button>
              </div>
            </div>

            <div className="excel-container">
              <div className="excel-toolbar">
                <div className="excel-toolbar-left">
                  <div className="search-input-group">
                    <span className="search-input-icon">🔍</span>
                    <input
                      type="text"
                      id="attendance-search"
                      className="search-input"
                      placeholder="Search employee name or ID..."
                      value={attSearch}
                      onChange={(e) => setAttSearch(e.target.value)}
                    />
                  </div>

                  <select
                    id="attendance-status-filter"
                    className="select-control"
                    title="Filter by Status"
                    value={attStatusFilter}
                    onChange={(e) => setAttStatusFilter(e.target.value)}
                  >
                    <option value="All">All Statuses</option>
                    <option value="Present">Present</option>
                    <option value="Half Day">Half Day</option>
                    <option value="Leave">Leave</option>
                    <option value="Absent">Absent</option>
                  </select>

                  <select
                    id="attendance-employee-filter"
                    className="select-control"
                    title="Filter by Employee"
                    value={attEmpFilter}
                    onChange={(e) => setAttEmpFilter(e.target.value)}
                  >
                    <option value="All">All Employees</option>
                    {employees.map(e => (
                      <option key={e.id} value={e.employee_code}>{e.name} ({e.employee_code})</option>
                    ))}
                  </select>

                  <select
                    id="attendance-view-mode"
                    className="select-control"
                    title="View Mode"
                    value={attViewMode}
                    onChange={(e) => setAttViewMode(e.target.value as any)}
                  >
                    <option value="all">All Dates</option>
                    <option value="daily">Daily View</option>
                    <option value="monthly">Monthly View</option>
                  </select>

                  {attViewMode === 'daily' && (
                    <input
                      type="date"
                      id="attendance-date-picker"
                      className="input-control"
                      value={attDate}
                      onChange={(e) => setAttDate(e.target.value)}
                    />
                  )}

                  {attViewMode === 'monthly' && (
                    <input
                      type="month"
                      id="attendance-month-picker"
                      className="input-control"
                      value={attMonth}
                      onChange={(e) => setAttMonth(e.target.value)}
                    />
                  )}
                </div>

                <div className="excel-toolbar-right">
                  <span id="attendance-count-pill" className="table-stats-pill">{attendance.length} Records</span>
                </div>
              </div>

              <div className="excel-scroll-wrapper">
                <table id="attendance-table" className="excel-table">
                  <thead>
                    <tr>
                      <th className="sortable" onClick={() => setAttSort({ field: 'emp_id', order: attSort.order === 'asc' ? 'desc' : 'asc' })}>
                        Emp ID <span className="sort-indicator">⇅</span>
                      </th>
                      <th className="sortable" onClick={() => setAttSort({ field: 'emp_name', order: attSort.order === 'asc' ? 'desc' : 'asc' })}>
                        Employee Name <span className="sort-indicator">⇅</span>
                      </th>
                      <th className="text-center sortable" onClick={() => setAttSort({ field: 'date', order: attSort.order === 'asc' ? 'desc' : 'asc' })}>
                        Date <span className="sort-indicator">⇅</span>
                      </th>
                      <th className="text-center">Day</th>
                      <th className="text-center">Check In</th>
                      <th className="text-center">Check Out</th>
                      <th className="text-center sortable" onClick={() => setAttSort({ field: 'status', order: attSort.order === 'asc' ? 'desc' : 'asc' })}>
                        Status <span className="sort-indicator">⇅</span>
                      </th>
                      <th className="text-right sortable" onClick={() => setAttSort({ field: 'working_hours', order: attSort.order === 'asc' ? 'desc' : 'asc' })}>
                        Working Hours <span className="sort-indicator">⇅</span>
                      </th>
                      <th>Remarks</th>
                      <th className="text-center" style={{ width: '90px' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {attendance.length === 0 ? (
                      <tr>
                        <td colSpan={10} style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)' }}>
                          No attendance records found for this period. Click "+ Add Attendance" to mark presence.
                        </td>
                      </tr>
                    ) : (
                      attendance.map(a => (
                        <tr key={a.id}>
                          <td className="font-mono"><strong>{a.emp_id}</strong></td>
                          <td><strong>{a.emp_name}</strong></td>
                          <td className="text-center font-mono">{a.date || a.attendance_date}</td>
                          <td className="text-center">{a.day || '-'}</td>
                          <td className="text-center font-mono">{a.check_in || '-'}</td>
                          <td className="text-center font-mono">{a.check_out || '-'}</td>
                          <td className="text-center">
                            <span className={`badge ${
                              a.status === 'Present' ? 'badge-paid' :
                              a.status === 'Half Day' ? 'badge-half' :
                              a.status === 'Leave' ? 'badge-leave' : 'badge-absent'
                            }`}>
                              {a.status}
                            </span>
                          </td>
                          <td className="text-right font-mono" style={{ fontWeight: 700 }}>
                            {a.working_hours} hrs
                          </td>
                          <td>{a.remarks || '-'}</td>
                          <td className="text-center">
                            <div style={{ display: 'flex', gap: '4px', justifyContent: 'center' }}>
                              <button
                                type="button"
                                className="btn btn-outline btn-xs"
                                onClick={() => { setModalType('attendance'); setModalData(a); }}
                              >
                                ✏️
                              </button>
                              <button
                                type="button"
                                className="btn btn-outline btn-xs"
                                style={{ color: 'var(--danger)' }}
                                onClick={() => {
                                  setConfirmDialog({
                                    open: true,
                                    title: 'Delete Attendance Record?',
                                    message: `Delete attendance entry for ${a.emp_name} on ${a.date || a.attendance_date}?`,
                                    confirmText: 'Delete',
                                    isDanger: true,
                                    onConfirm: async () => {
                                      try {
                                        await apiFetch(`/api/attendance/${a.id}`, { method: 'DELETE' });
                                        showToast('Attendance entry deleted', 'success');
                                        loadAttendance();
                                      } catch (err: any) {
                                        showToast(err.message, 'error');
                                      } finally {
                                        setConfirmDialog(null);
                                      }
                                    }
                                  });
                                }}
                              >
                                🗑️
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        )}

        {/* ====================================================
             VIEW 4: ACCOUNTING & FINANCE
             ==================================================== */}
        {activeTab === 'accounting' && (
          <section id="view-accounting" className="view-section active">
            <div className="view-header">
              <div className="view-title-group">
                <h1>Accounting & Finance</h1>
                <p>Payroll calculation (Net = Basic + Allowance - Deduction) and cashbook ledger with automatic running balance</p>
              </div>
              <div className="view-toolbar">
                <div style={{ display: 'flex', gap: '6px', background: '#e2e8f0', padding: '3px', borderRadius: 'var(--radius-md)' }}>
                  <button
                    type="button"
                    id="btn-subtab-salaries"
                    className={`btn btn-sm ${accSubTab === 'salaries' ? 'btn-primary' : 'btn-outline'}`}
                    onClick={() => setAccSubTab('salaries')}
                  >
                    💼 Employee Salaries
                  </button>
                  <button
                    type="button"
                    id="btn-subtab-transactions"
                    className={`btn btn-sm ${accSubTab === 'transactions' ? 'btn-primary' : 'btn-outline'}`}
                    onClick={() => setAccSubTab('transactions')}
                  >
                    🏦 Accounting Transactions
                  </button>
                </div>
                <button
                  type="button"
                  className="btn btn-outline btn-sm btn-trigger-clear-data"
                  onClick={handleClearData}
                  style={{ color: 'var(--danger)', borderColor: 'rgba(239, 68, 68, 0.35)' }}
                >
                  <span>🗑️</span> Clear Data
                </button>
              </div>
            </div>

            {/* Accounting Summary Strip */}
            <div className="kpi-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))' }}>
              <div className="kpi-card kpi-green" style={{ padding: '12px 16px' }}>
                <span className="kpi-label">Total Cash Inflow</span>
                <div id="acc-summary-income" className="kpi-val currency" style={{ fontSize: '19px', color: '#059669' }}>
                  ₹{accSummary.income}
                </div>
              </div>
              <div className="kpi-card kpi-red" style={{ padding: '12px 16px' }}>
                <span className="kpi-label">Total Cash Outflow</span>
                <div id="acc-summary-expense" className="kpi-val currency" style={{ fontSize: '19px', color: '#dc2626' }}>
                  ₹{accSummary.expense}
                </div>
              </div>
              <div className="kpi-card kpi-blue" style={{ padding: '12px 16px' }}>
                <span className="kpi-label">Current Cash Balance</span>
                <div id="acc-summary-balance" className="kpi-val currency" style={{ fontSize: '19px' }}>
                  ₹{accSummary.balance}
                </div>
              </div>
              <div className="kpi-card kpi-indigo" style={{ padding: '12px 16px' }}>
                <span className="kpi-label">Monthly Net Payroll</span>
                <div id="acc-summary-payroll" className="kpi-val currency" style={{ fontSize: '19px', color: '#4338ca' }}>
                  ₹{accSummary.payroll}
                </div>
              </div>
            </div>

            {/* SUB-SECTION A: EMPLOYEE SALARIES */}
            {accSubTab === 'salaries' && (
              <div id="accounting-salaries-section" className="excel-container">
                <div className="excel-toolbar">
                  <div className="excel-toolbar-left">
                    <div className="search-input-group">
                      <span className="search-input-icon">🔍</span>
                      <input
                        type="text"
                        id="salary-search"
                        className="search-input"
                        placeholder="Search employee or ID..."
                        value={salSearch}
                        onChange={(e) => setSalSearch(e.target.value)}
                      />
                    </div>

                    <select
                      id="salary-month-filter"
                      className="select-control"
                      title="Filter by Month"
                      value={salMonthFilter}
                      onChange={(e) => setSalMonthFilter(e.target.value)}
                    >
                      <option value="September 2026">September 2026</option>
                      <option value="August 2026">August 2026</option>
                      <option value="July 2026">July 2026</option>
                      <option value="October 2026">October 2026</option>
                      <option value="All">All Months</option>
                    </select>

                    <select
                      id="salary-status-filter"
                      className="select-control"
                      title="Filter by Payment Status"
                      value={salStatusFilter}
                      onChange={(e) => setSalStatusFilter(e.target.value)}
                    >
                      <option value="All">All Payment Statuses</option>
                      <option value="Paid">Paid</option>
                      <option value="Processing">Processing</option>
                      <option value="Pending">Pending</option>
                    </select>
                  </div>

                  <div className="excel-toolbar-right">
                    <span id="salaries-count-pill" className="table-stats-pill">{salaries.length} Records</span>
                    <button
                      type="button"
                      id="btn-export-salaries"
                      className="btn btn-outline btn-sm"
                      onClick={() => {
                        exportCSV(
                          'salary_payroll',
                          ['Emp ID', 'Employee Name', 'Month', 'Basic Salary', 'Allowance', 'Deduction', 'Net Salary', 'Payment Date', 'Status', 'Remarks'],
                          salaries.map(s => [s.emp_id, s.emp_name, s.month, s.basic_salary, s.allowance, s.deduction, s.net_salary, s.payment_date || '', s.payment_status, s.remarks || ''])
                        );
                      }}
                    >
                      📥 Export CSV
                    </button>
                    <button
                      type="button"
                      id="btn-add-salary"
                      className="btn btn-primary btn-sm"
                      onClick={() => { setModalType('salary'); setModalData(null); }}
                    >
                      <span>+</span> Add Salary Slip
                    </button>
                  </div>
                </div>

                <div className="excel-scroll-wrapper">
                  <table id="salaries-table" className="excel-table">
                    <thead>
                      <tr>
                        <th className="sortable" onClick={() => setSalSort({ field: 'emp_id', order: salSort.order === 'asc' ? 'desc' : 'asc' })}>
                          Emp ID <span className="sort-indicator">⇅</span>
                        </th>
                        <th className="sortable" onClick={() => setSalSort({ field: 'emp_name', order: salSort.order === 'asc' ? 'desc' : 'asc' })}>
                          Employee Name <span className="sort-indicator">⇅</span>
                        </th>
                        <th className="text-center sortable">Month</th>
                        <th className="text-right sortable">Basic Salary</th>
                        <th className="text-right sortable">Allowance</th>
                        <th className="text-right sortable">Deduction</th>
                        <th className="text-right sortable" style={{ background: '#e2e8f0', color: 'var(--primary)' }}>
                          Net Salary
                        </th>
                        <th className="text-center sortable">Pay Date</th>
                        <th className="text-center sortable">Status</th>
                        <th>Remarks</th>
                        <th className="text-center" style={{ width: '90px' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {salaries.length === 0 ? (
                        <tr>
                          <td colSpan={11} style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)' }}>
                            No salary slips recorded for {salMonthFilter}. Click "+ Add Salary Slip" to record payroll.
                          </td>
                        </tr>
                      ) : (
                        salaries.map(s => (
                          <tr key={s.id}>
                            <td className="font-mono"><strong>{s.emp_id}</strong></td>
                            <td><strong>{s.emp_name}</strong></td>
                            <td className="text-center">{s.month}</td>
                            <td className="text-right currency">₹{Number(s.basic_salary).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                            <td className="text-right currency">₹{Number(s.allowance).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                            <td className="text-right currency">₹{Number(s.deduction).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                            <td className="text-right currency" style={{ fontWeight: 800, color: 'var(--primary)', background: '#f8fafc' }}>
                              ₹{Number(s.net_salary).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                            </td>
                            <td className="text-center font-mono">{s.payment_date || '-'}</td>
                            <td className="text-center">
                              <span className={`badge ${
                                s.payment_status === 'Paid' ? 'badge-paid' :
                                s.payment_status === 'Processing' ? 'badge-half' : 'badge-absent'
                              }`}>
                                {s.payment_status}
                              </span>
                            </td>
                            <td>{s.remarks || '-'}</td>
                            <td className="text-center">
                              <div style={{ display: 'flex', gap: '4px', justifyContent: 'center' }}>
                                <button
                                  type="button"
                                  className="btn btn-outline btn-xs"
                                  onClick={() => { setModalType('salary'); setModalData(s); }}
                                >
                                  ✏️
                                </button>
                                <button
                                  type="button"
                                  className="btn btn-outline btn-xs"
                                  style={{ color: 'var(--danger)' }}
                                  onClick={() => {
                                    setConfirmDialog({
                                      open: true,
                                      title: 'Delete Salary Slip?',
                                      message: `Delete salary slip for ${s.emp_name} (${s.month})?`,
                                      confirmText: 'Delete',
                                      isDanger: true,
                                      onConfirm: async () => {
                                        try {
                                          await apiFetch(`/api/salaries/${s.id}`, { method: 'DELETE' });
                                          showToast('Salary record deleted', 'success');
                                          loadSalaries();
                                        } catch (err: any) {
                                          showToast(err.message, 'error');
                                        } finally {
                                          setConfirmDialog(null);
                                        }
                                      }
                                    });
                                  }}
                                >
                                  🗑️
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* SUB-SECTION B: TRANSACTIONS LEDGER */}
            {accSubTab === 'transactions' && (
              <div id="accounting-transactions-section" className="excel-container">
                <div className="excel-toolbar">
                  <div className="excel-toolbar-left">
                    <div className="search-input-group">
                      <span className="search-input-icon">🔍</span>
                      <input
                        type="text"
                        id="txn-search"
                        className="search-input"
                        placeholder="Search description, party, remarks..."
                        value={txnSearch}
                        onChange={(e) => setTxnSearch(e.target.value)}
                      />
                    </div>

                    <select
                      id="txn-type-filter"
                      className="select-control"
                      title="Filter by Transaction Type"
                      value={txnTypeFilter}
                      onChange={(e) => setTxnTypeFilter(e.target.value)}
                    >
                      <option value="All">All Types</option>
                      <option value="Income">Income</option>
                      <option value="Expense">Expense</option>
                      <option value="Salary">Salary</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>

                  <div className="excel-toolbar-right">
                    <span id="transactions-count-pill" className="table-stats-pill">{transactions.length} Entries</span>
                    <button
                      type="button"
                      id="btn-export-transactions"
                      className="btn btn-outline btn-sm"
                      onClick={() => {
                        exportCSV(
                          'cashbook_ledger',
                          ['Date', 'Type', 'Description', 'Party', 'Income', 'Expense', 'Running Balance', 'Remarks'],
                          transactions.map(t => [t.date, t.type, t.description, t.party, t.income, t.expense, t.balance ?? '', t.remarks || ''])
                        );
                      }}
                    >
                      📥 Export CSV
                    </button>
                    <button
                      type="button"
                      id="btn-add-transaction"
                      className="btn btn-primary btn-sm"
                      onClick={() => { setModalType('transaction'); setModalData(null); }}
                    >
                      <span>+</span> Record Transaction
                    </button>
                  </div>
                </div>

                <div className="excel-scroll-wrapper">
                  <table id="transactions-table" className="excel-table">
                    <thead>
                      <tr>
                        <th className="text-center sortable" onClick={() => setTxnSort({ field: 'date', order: txnSort.order === 'asc' ? 'desc' : 'asc' })}>
                          Date <span className="sort-indicator">⇅</span>
                        </th>
                        <th className="text-center sortable">Type</th>
                        <th className="sortable">Description</th>
                        <th className="sortable">Employee / Party</th>
                        <th className="text-right sortable">Income (₹)</th>
                        <th className="text-right sortable">Expense (₹)</th>
                        <th className="text-right sortable" style={{ background: '#e2e8f0' }}>Running Balance (₹)</th>
                        <th>Remarks</th>
                        <th className="text-center" style={{ width: '90px' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {transactions.length === 0 ? (
                        <tr>
                          <td colSpan={9} style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)' }}>
                            No ledger transactions recorded yet. Click "+ Record Transaction" to add an entry.
                          </td>
                        </tr>
                      ) : (
                        transactions.map(t => (
                          <tr key={t.id}>
                            <td className="text-center font-mono">{t.date}</td>
                            <td className="text-center">
                              <span className={`badge ${
                                t.type === 'Income' ? 'badge-paid' :
                                t.type === 'Expense' ? 'badge-absent' : 'badge-half'
                              }`}>
                                {t.type}
                              </span>
                            </td>
                            <td><strong>{t.description}</strong></td>
                            <td>{t.party || 'Corporate Party'}</td>
                            <td className="text-right currency" style={{ color: t.income > 0 ? '#059669' : 'inherit', fontWeight: t.income > 0 ? 700 : 400 }}>
                              {t.income > 0 ? `₹${Number(t.income).toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '-'}
                            </td>
                            <td className="text-right currency" style={{ color: t.expense > 0 ? '#dc2626' : 'inherit', fontWeight: t.expense > 0 ? 700 : 400 }}>
                              {t.expense > 0 ? `₹${Number(t.expense).toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '-'}
                            </td>
                            <td className="text-right currency font-mono" style={{ fontWeight: 800, background: '#f8fafc' }}>
                              ₹{Number(t.balance || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                            </td>
                            <td>{t.remarks || '-'}</td>
                            <td className="text-center">
                              <div style={{ display: 'flex', gap: '4px', justifyContent: 'center' }}>
                                <button
                                  type="button"
                                  className="btn btn-outline btn-xs"
                                  onClick={() => { setModalType('transaction'); setModalData(t); }}
                                >
                                  ✏️
                                </button>
                                <button
                                  type="button"
                                  className="btn btn-outline btn-xs"
                                  style={{ color: 'var(--danger)' }}
                                  onClick={() => {
                                    setConfirmDialog({
                                      open: true,
                                      title: 'Delete Transaction?',
                                      message: `Delete ledger entry "${t.description}" (${t.date})?`,
                                      confirmText: 'Delete',
                                      isDanger: true,
                                      onConfirm: async () => {
                                        try {
                                          await apiFetch(`/api/accounting/${t.id}`, { method: 'DELETE' });
                                          showToast('Transaction deleted', 'success');
                                          loadTransactions();
                                        } catch (err: any) {
                                          showToast(err.message, 'error');
                                        } finally {
                                          setConfirmDialog(null);
                                        }
                                      }
                                    });
                                  }}
                                >
                                  🗑️
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </section>
        )}

        {/* ====================================================
             VIEW 5: SETTINGS & SYSTEM ADMINISTRATION
             ==================================================== */}
        {activeTab === 'settings' && (
          <section id="view-settings" className="view-section active">
            <div className="view-header">
              <div className="view-title-group">
                <h1>System Settings & Administration</h1>
                <p>User accounts, MongoDB Atlas database storage monitoring, and safety reset with instant undo</p>
              </div>
            </div>

            {/* Settings Sub-Navigation */}
            <div className="settings-subnav">
              <button
                type="button"
                className={`settings-subtab ${settingsSubTab === 'users' ? 'active' : ''}`}
                onClick={() => setSettingsSubTab('users')}
                id="subtab-settings-users"
              >
                <span className="settings-subtab-icon">👥</span>
                <span>User Management</span>
              </button>
              <button
                type="button"
                className={`settings-subtab ${settingsSubTab === 'data' ? 'active' : ''}`}
                onClick={() => setSettingsSubTab('data')}
                id="subtab-settings-data"
              >
                <span className="settings-subtab-icon">🗑️</span>
                <span>Data Management & Reset</span>
              </button>
              <button
                type="button"
                className={`settings-subtab ${settingsSubTab === 'monitor' ? 'active' : ''}`}
                onClick={() => setSettingsSubTab('monitor')}
                id="subtab-settings-monitor"
              >
                <span className="settings-subtab-icon">📊</span>
                <span>Database Usage Monitor</span>
              </button>
              <button
                type="button"
                className={`settings-subtab ${settingsSubTab === 'info' ? 'active' : ''}`}
                onClick={() => setSettingsSubTab('info')}
                id="subtab-settings-info"
              >
                <span className="settings-subtab-icon">🏢</span>
                <span>System Information</span>
              </button>
            </div>

            {/* SUBVIEW 1: USERS MANAGEMENT */}
            {settingsSubTab === 'users' && (
              <div id="settings-subview-users" className="settings-subview-panel">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '10px' }}>
                  <div>
                    <h2 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--secondary)', margin: 0 }}>Authorized Company Users</h2>
                    <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: '2px 0 0 0' }}>Manage employee accounts, role-based access, and login credentials</p>
                  </div>
                  <div className="view-toolbar">
                    <button
                      type="button"
                      id="btn-export-users"
                      className="btn btn-outline btn-sm"
                      onClick={() => {
                        exportCSV(
                          'authorized_users',
                          ['ID', 'Full Name', 'Username', 'Role', 'Status', 'Created Date'],
                          users.map(u => [u.id, u.name, u.username, u.role, u.status, u.created_at || ''])
                        );
                      }}
                    >
                      📥 Export CSV
                    </button>
                    <button
                      type="button"
                      id="btn-add-user"
                      className="btn btn-primary btn-sm"
                      onClick={() => { setModalType('user'); setModalData(null); }}
                    >
                      <span>+</span> Add User
                    </button>
                  </div>
                </div>

                <div className="excel-card">
                  <div className="excel-toolbar">
                    <div className="excel-toolbar-left">
                      <div className="search-box">
                        <span className="search-icon">🔍</span>
                        <input
                          type="text"
                          id="users-search-input"
                          className="search-input"
                          placeholder="Search by name, username or ID..."
                          value={userSearch}
                          onChange={(e) => setUserSearch(e.target.value)}
                        />
                      </div>

                      <select
                        id="users-role-filter"
                        className="select-control"
                        title="Filter by User Role"
                        value={userRoleFilter}
                        onChange={(e) => setUserRoleFilter(e.target.value)}
                      >
                        <option value="All">All Roles</option>
                        <option value="Admin">Admin</option>
                        <option value="Manager">Manager</option>
                        <option value="Staff">Staff</option>
                      </select>

                      <select
                        id="users-status-filter"
                        className="select-control"
                        title="Filter by Status"
                        value={userStatusFilter}
                        onChange={(e) => setUserStatusFilter(e.target.value)}
                      >
                        <option value="All">All Statuses</option>
                        <option value="Active">Active</option>
                        <option value="Disabled">Disabled</option>
                      </select>
                    </div>

                    <div className="excel-toolbar-right">
                      <span id="users-count-pill" className="table-stats-pill">{users.length} Users</span>
                    </div>
                  </div>

                  <div className="excel-scroll-wrapper">
                    <table id="users-table" className="excel-table">
                      <thead>
                        <tr>
                          <th className="text-center" style={{ width: '80px' }}>ID</th>
                          <th>Full Name</th>
                          <th style={{ width: '160px' }}>Username</th>
                          <th style={{ width: '130px' }}>Role</th>
                          <th className="text-center" style={{ width: '120px' }}>Status</th>
                          <th className="text-center" style={{ width: '140px' }}>Created Date</th>
                          <th className="text-center" style={{ width: '290px' }}>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {users.map(u => (
                          <tr key={u.id}>
                            <td className="text-center font-mono" style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                              {u.id.slice(-6)}
                            </td>
                            <td><strong>{u.name}</strong></td>
                            <td className="font-mono">@{u.username}</td>
                            <td>
                              <span className="badge" style={{
                                background: u.role === 'Admin' ? '#f3e8ff' : u.role === 'Manager' ? '#e0f2fe' : '#f1f5f9',
                                color: u.role === 'Admin' ? '#7e22ce' : u.role === 'Manager' ? '#0369a1' : '#334155'
                              }}>
                                {u.role}
                              </span>
                            </td>
                            <td className="text-center">
                              <span className={`badge ${u.status === 'Active' ? 'badge-paid' : 'badge-absent'}`}>
                                {u.status}
                              </span>
                            </td>
                            <td className="text-center font-mono" style={{ fontSize: '12px' }}>
                              {u.created_at ? new Date(u.created_at).toISOString().slice(0, 10) : '-'}
                            </td>
                            <td className="text-center">
                              <div style={{ display: 'flex', gap: '6px', justifyContent: 'center' }}>
                                <button
                                  type="button"
                                  className="btn btn-outline btn-xs"
                                  onClick={() => { setModalType('user'); setModalData(u); }}
                                >
                                  ✏️ Edit
                                </button>
                                <button
                                  type="button"
                                  className="btn btn-outline btn-xs"
                                  onClick={() => { setModalType('reset-password'); setModalData(u); }}
                                >
                                  🔑 Reset Pass
                                </button>
                                <button
                                  type="button"
                                  className="btn btn-outline btn-xs"
                                  onClick={async () => {
                                    try {
                                      const nextStatus = u.status === 'Active' ? 'Disabled' : 'Active';
                                      await apiFetch(`/api/users/${u.id}/status`, {
                                        method: 'PATCH',
                                        body: JSON.stringify({ status: nextStatus })
                                      });
                                      showToast(`User status updated to ${nextStatus}`, 'success');
                                      loadUsers();
                                    } catch (err: any) {
                                      showToast(err.message, 'error');
                                    }
                                  }}
                                >
                                  {u.status === 'Active' ? 'Disable' : 'Enable'}
                                </button>
                                <button
                                  type="button"
                                  className="btn btn-outline btn-xs"
                                  style={{ color: 'var(--danger)' }}
                                  disabled={u.username === 'fromex' || u.username === 'admin'}
                                  onClick={() => {
                                    setConfirmDialog({
                                      open: true,
                                      title: 'Delete User Account?',
                                      message: `Are you sure you want to permanently delete @${u.username} (${u.name})?`,
                                      confirmText: 'Delete User',
                                      isDanger: true,
                                      onConfirm: async () => {
                                        try {
                                          await apiFetch(`/api/users/${u.id}`, { method: 'DELETE' });
                                          showToast(`User @${u.username} deleted`, 'success');
                                          loadUsers();
                                        } catch (err: any) {
                                          showToast(err.message, 'error');
                                        } finally {
                                          setConfirmDialog(null);
                                        }
                                      }
                                    });
                                  }}
                                >
                                  🗑️
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* SUBVIEW 2: DATA MANAGEMENT & RESET */}
            {settingsSubTab === 'data' && (
              <div id="settings-subview-data" className="settings-subview-panel">
                <div className="settings-section-card">
                  <div className="settings-card-header">
                    <div>
                      <h3 className="settings-card-title">Live Database Operational Statistics</h3>
                      <p className="settings-card-desc">Current operational records stored in MongoDB Atlas</p>
                    </div>
                    <button type="button" className="btn btn-outline btn-sm" onClick={() => loadBackups()}>
                      🔄 Refresh Counts
                    </button>
                  </div>

                  <div className="settings-stats-grid">
                    <div className="settings-stat-box">
                      <div className="settings-stat-icon" style={{ background: '#e0f2fe', color: '#0284c7' }}>⏱️</div>
                      <div>
                        <div className="settings-stat-val">{attendance.length}</div>
                        <div className="settings-stat-label">Attendance Records</div>
                      </div>
                    </div>
                    <div className="settings-stat-box">
                      <div className="settings-stat-icon" style={{ background: '#fef3c7', color: '#d97706' }}>💵</div>
                      <div>
                        <div className="settings-stat-val">{salaries.length}</div>
                        <div className="settings-stat-label">Salary Payroll Slips</div>
                      </div>
                    </div>
                    <div className="settings-stat-box">
                      <div className="settings-stat-icon" style={{ background: '#dcfce7', color: '#16a34a' }}>💳</div>
                      <div>
                        <div className="settings-stat-val">{transactions.length}</div>
                        <div className="settings-stat-label">Accounting Transactions</div>
                      </div>
                    </div>
                    <div className="settings-stat-box">
                      <div className="settings-stat-icon" style={{ background: '#f3e8ff', color: '#9333ea' }}>👥</div>
                      <div>
                        <div className="settings-stat-val">{employees.length}</div>
                        <div className="settings-stat-label">Company Employees</div>
                      </div>
                    </div>
                    <div className="settings-stat-box highlight-total">
                      <div className="settings-stat-icon" style={{ background: '#ede9fe', color: '#6366f1' }}>📊</div>
                      <div>
                        <div className="settings-stat-val">{attendance.length + salaries.length + transactions.length}</div>
                        <div className="settings-stat-label">Total Operational Data</div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Danger Zone: Clear Data */}
                <div className="settings-section-card danger-card">
                  <div className="danger-card-badge">DANGER ZONE &bull; DATA PURGE</div>
                  <div className="settings-card-header">
                    <div>
                      <h3 className="settings-card-title text-danger">One-Click Clear All Data</h3>
                      <p className="settings-card-desc">
                        Clears all active operational records: <strong>Attendance logs</strong>, <strong>Salary payrolls</strong>, and <strong>Accounting transactions</strong> from MongoDB.
                      </p>
                    </div>
                  </div>

                  <div className="danger-info-box">
                    <div className="danger-info-icon">🛡️</div>
                    <div className="danger-info-text">
                      <strong>100% Safe Undo Protection:</strong>
                      Before deleting any records, the system automatically creates an immutable full snapshot and saves it in MongoDB. If you clear by accident or need the records back, you can click <strong>UNDO</strong> immediately or restore from the recovery snapshots list below with zero data loss.
                    </div>
                  </div>

                  <div style={{ marginTop: '18px', display: 'flex', gap: '14px', alignItems: 'center', flexWrap: 'wrap' }}>
                    <button type="button" id="btn-clear-all-data" className="btn btn-danger btn-lg" onClick={handleClearData}>
                      <span>🗑️</span> Clear All Operational Data
                    </button>
                    <span style={{ fontSize: '12.5px', color: 'var(--text-muted)' }}>
                      A confirmation dialog will appear before clearing to prevent accidental clicks.
                    </span>
                  </div>
                </div>

                {/* Recovery Snapshots List */}
                <div className="settings-section-card">
                  <div className="settings-card-header">
                    <div>
                      <h3 className="settings-card-title">Automatic Snapshots & Recovery History</h3>
                      <p className="settings-card-desc">Every clear operation creates a recovery point. Restore your data anytime with a single click.</p>
                    </div>
                    <button
                      type="button"
                      id="btn-quick-restore-last"
                      className="btn btn-primary btn-sm"
                      onClick={() => handleUndoClear()}
                      disabled={backups.length === 0}
                    >
                      <span>↩️</span> Restore Last Cleared Data
                    </button>
                  </div>

                  <div style={{ marginTop: '14px' }}>
                    {backups.length === 0 ? (
                      <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
                        No snapshot recovery points created yet.
                      </div>
                    ) : (
                      <table className="excel-table">
                        <thead>
                          <tr>
                            <th>Snapshot Timestamp</th>
                            <th>Description</th>
                            <th>Cleared By</th>
                            <th>Records Count</th>
                            <th>Status</th>
                            <th className="text-center" style={{ width: '120px' }}>Action</th>
                          </tr>
                        </thead>
                        <tbody>
                          {backups.map(b => (
                            <tr key={b.id}>
                              <td className="font-mono">{new Date(b.created_at).toLocaleString()}</td>
                              <td>{b.description || 'Manual full clear'}</td>
                              <td>{b.cleared_by || 'Administrator'}</td>
                              <td><strong>{b.records_count}</strong> records</td>
                              <td>
                                <span className={`badge ${b.is_restored ? 'badge-paid' : 'badge-half'}`}>
                                  {b.is_restored ? 'Restored' : 'Available for Undo'}
                                </span>
                              </td>
                              <td className="text-center">
                                <button
                                  type="button"
                                  className="btn btn-outline btn-xs"
                                  onClick={() => handleUndoClear(b.id)}
                                >
                                  ↩️ Restore
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* SUBVIEW 3: DATABASE USAGE MONITOR (NEW FEATURE) */}
            {settingsSubTab === 'monitor' && (
              <div id="settings-subview-monitor" className="settings-subview-panel">
                <div className="settings-section-card">
                  <div className="settings-card-header">
                    <div>
                      <h3 className="settings-card-title">MongoDB Live Storage & Resource Monitor</h3>
                      <p className="settings-card-desc">
                        Real-time storage consumption, cluster quotas, and collection-level statistics directly from MongoDB Atlas
                      </p>
                    </div>
                    <button
                      type="button"
                      className="btn btn-outline btn-sm"
                      onClick={loadDatabaseMonitor}
                    >
                      🔄 Refresh Live Metrics
                    </button>
                  </div>

                  {dbMonitor ? (
                    <div className="db-monitor-container" style={{ marginTop: '16px' }}>
                      {/* Status and Progress Bar */}
                      <div className="db-progress-wrapper">
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <span style={{ fontWeight: 700, fontSize: '15px', color: 'var(--secondary)' }}>
                              Cluster Storage Health:
                            </span>
                            <span className={`db-status-badge ${
                              dbMonitor.status === 'Healthy' ? 'healthy' :
                              dbMonitor.status === 'Warning' ? 'warning' :
                              dbMonitor.status === 'High Usage' ? 'high-usage' : 'critical'
                            }`}>
                              ● {dbMonitor.status} ({dbMonitor.usagePercentage}% Used)
                            </span>
                          </div>

                          <div style={{ fontSize: '13px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                            <strong>{dbMonitor.storageUsedMB} MB</strong> used of <strong>{dbMonitor.storageLimitMB} MB</strong> limit ({dbMonitor.remainingStorageMB} MB remaining)
                          </div>
                        </div>

                        {/* Progress Bar */}
                        <div className="db-progress-bar-bg">
                          <div
                            className={`db-progress-bar-fill ${
                              dbMonitor.status === 'Healthy' ? 'healthy' :
                              dbMonitor.status === 'Warning' ? 'warning' :
                              dbMonitor.status === 'High Usage' ? 'high-usage' : 'critical'
                            }`}
                            style={{ width: `${Math.max(1, dbMonitor.usagePercentage)}%` }}
                          ></div>
                        </div>

                        {/* Threshold Guidelines */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--text-muted)' }}>
                          <span>0% - 70% Healthy</span>
                          <span>70% - 85% Warning</span>
                          <span>85% - 95% High Usage</span>
                          <span>95%+ Critical</span>
                        </div>
                      </div>

                      {/* Primary Metrics Grid */}
                      <div className="db-monitor-grid">
                        <div className="db-metric-card">
                          <span className="db-metric-label">Database Name</span>
                          <div className="db-metric-val" style={{ fontSize: '18px', color: 'var(--primary)' }}>
                            {dbMonitor.databaseName}
                          </div>
                          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>MongoDB Atlas Cluster</span>
                        </div>

                        <div className="db-metric-card">
                          <span className="db-metric-label">Storage Allocated</span>
                          <div className="db-metric-val">
                            {dbMonitor.storageUsedMB} <span style={{ fontSize: '13px' }}>MB</span>
                          </div>
                          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Storage Size ({dbMonitor.storageSizeBytes.toLocaleString()} bytes)</span>
                        </div>

                        <div className="db-metric-card">
                          <span className="db-metric-label">Data Payload Size</span>
                          <div className="db-metric-val">
                            {dbMonitor.dataSizeMB} <span style={{ fontSize: '13px' }}>MB</span>
                          </div>
                          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Uncompressed Document Data</span>
                        </div>

                        <div className="db-metric-card">
                          <span className="db-metric-label">Index Size</span>
                          <div className="db-metric-val">
                            {dbMonitor.indexSizeMB} <span style={{ fontSize: '13px' }}>MB</span>
                          </div>
                          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Compound & Unique Indexes</span>
                        </div>

                        <div className="db-metric-card">
                          <span className="db-metric-label">Total Documents</span>
                          <div className="db-metric-val">
                            {dbMonitor.objectsCount}
                          </div>
                          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Avg Document Size: {dbMonitor.avgObjSizeBytes} bytes</span>
                        </div>

                        <div className="db-metric-card">
                          <span className="db-metric-label">Collections Count</span>
                          <div className="db-metric-val">
                            {dbMonitor.collectionsCount}
                          </div>
                          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Active Mongoose Collections</span>
                        </div>
                      </div>

                      {/* Collection Breakdown Cards */}
                      <div style={{ marginTop: '10px' }}>
                        <h4 style={{ fontSize: '14px', fontWeight: 700, color: 'var(--secondary)', marginBottom: '10px' }}>
                          Collection-Level Distribution
                        </h4>
                        <div className="db-collections-grid">
                          {dbMonitor.collections.map((col, idx) => (
                            <div key={idx} className="db-collection-card">
                              <div>
                                <div className="db-collection-name">{col.name}</div>
                                <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
                                  <strong>{col.count}</strong> records
                                </div>
                              </div>
                              <div className="db-collection-stats">
                                <div>Data: <strong>{col.sizeKB} KB</strong></div>
                                <div>Storage: <strong>{col.storageKB} KB</strong></div>
                                <div>Index: <strong>{col.totalIndexKB} KB</strong></div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Source & Guarantee Notice */}
                      <div style={{ padding: '12px 14px', background: '#f8fafc', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', fontSize: '12px', color: 'var(--text-muted)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                        <div>
                          ℹ️ <strong>Direct Atlas Engine:</strong> {dbMonitor.note}
                        </div>
                        <div style={{ fontFamily: 'var(--font-mono)' }}>
                          Last Synced: {new Date(dbMonitor.lastUpdated).toLocaleTimeString()}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
                      Connecting to MongoDB Atlas to fetch real-time storage metrics...
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* SUBVIEW 4: SYSTEM INFORMATION */}
            {settingsSubTab === 'info' && (
              <div id="settings-subview-info" className="settings-subview-panel">
                <div className="settings-section-card">
                  <h3 className="settings-card-title" style={{ marginBottom: '16px' }}>Corporate System & Architecture Info</h3>

                  <div className="settings-info-grid">
                    <div className="info-row">
                      <span className="info-label">Application:</span>
                      <span className="info-value">FROMEX Company Management System</span>
                    </div>
                    <div className="info-row">
                      <span className="info-label">Full-Stack Framework:</span>
                      <span className="info-value"><span className="badge badge-paid">Next.js App Router (TypeScript + React)</span></span>
                    </div>
                    <div className="info-row">
                      <span className="info-label">Database Engine:</span>
                      <span className="info-value"><span className="badge badge-paid">MongoDB Atlas (Mongoose ODM)</span></span>
                    </div>
                    <div className="info-row">
                      <span className="info-label">Deployment Architecture:</span>
                      <span className="info-value"><span className="badge badge-paid">Single-Repository Vercel Serverless Ready</span></span>
                    </div>
                    <div className="info-row">
                      <span className="info-label">Active User Session:</span>
                      <span className="info-value">{currentUser.name} (@{currentUser.username})</span>
                    </div>
                    <div className="info-row">
                      <span className="info-label">Access Level:</span>
                      <span className="info-value">{currentUser.role}</span>
                    </div>
                    <div className="info-row">
                      <span className="info-label">Snapshot & Undo Protection:</span>
                      <span className="info-value"><span className="badge" style={{ background: '#dcfce7', color: '#16a34a' }}>Active & Persistent (Collection: data_backups)</span></span>
                    </div>
                    <div className="info-row">
                      <span className="info-label">Database Monitor:</span>
                      <span className="info-value"><span className="badge" style={{ background: '#e0f2fe', color: '#0369a1' }}>Live MongoDB Storage & Quota Tracking</span></span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </section>
        )}
      </main>

      {/* Floating Undo Notification Bar */}
      {showUndoBanner && (
        <div id="floating-undo-banner" className="floating-undo-banner" style={{ display: 'flex' }}>
          <div className="floating-undo-content">
            <div className="floating-undo-icon">⚠️</div>
            <div className="floating-undo-text">
              <div className="floating-undo-title">All operational records have been cleared!</div>
              <div className="floating-undo-desc">Accidentally cleared? You can restore all data right now:</div>
            </div>
          </div>
          <div className="floating-undo-actions">
            <button
              type="button"
              id="btn-floating-undo"
              className="btn btn-undo"
              onClick={() => handleUndoClear()}
            >
              <span>↩️</span> UNDO CLEAR (<span id="undo-countdown-timer">{undoCountdown}</span>s)
            </button>
            <button
              type="button"
              id="btn-floating-dismiss"
              className="btn-undo-dismiss"
              title="Dismiss"
              onClick={() => setShowUndoBanner(false)}
            >
              &times;
            </button>
          </div>
          <div className="floating-undo-progress-bar">
            <div
              id="floating-undo-progress"
              className="floating-undo-progress"
              style={{ width: `${(undoCountdown / 60) * 100}%` }}
            ></div>
          </div>
        </div>
      )}

      {/* App Footer */}
      <footer className="app-footer">
        <div>
          <strong>FROMEX</strong> Corporate Management System &bull; Unified Next.js Single Application Architecture
        </div>
        <div style={{ display: 'flex', gap: '14px' }}>
          <span>Database: <strong>MongoDB Atlas</strong></span>
          <span>Currency: <strong>INR (₹)</strong></span>
          <span>Vercel Ready</span>
        </div>
      </footer>

      {/* ====================================================
           MODALS
           ==================================================== */}

      {/* User Switcher Modal */}
      {modalType === 'user-switcher' && (
        <div className="modal-backdrop open" onClick={() => setModalType(null)}>
          <div className="modal-container" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">Company User Switcher (Shared DB Session)</h3>
              <button type="button" className="modal-close-btn" onClick={() => setModalType(null)}>&times;</button>
            </div>
            <div className="modal-body">
              <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: '0 0 14px 0' }}>
                Switch active user to test multi-user concurrent workflows on MongoDB Atlas. All sessions synchronize seamlessly.
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '380px', overflowY: 'auto' }}>
                {(modalData || []).map((u: any) => {
                  const isCurrent = currentUser.username === u.username;
                  const isDisabled = u.status === 'Disabled';
                  return (
                    <div
                      key={u.id || u.username}
                      className={`user-switch-card ${isCurrent ? 'active-user' : ''}`}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '12px 16px',
                        border: `1px solid ${isCurrent ? 'var(--accent)' : 'var(--border-color)'}`,
                        background: isCurrent ? 'var(--primary-light)' : isDisabled ? '#f8fafc' : '#ffffff',
                        borderRadius: 'var(--radius-md)',
                        cursor: isDisabled ? 'not-allowed' : 'pointer',
                        opacity: isDisabled ? 0.6 : 1
                      }}
                      onClick={async () => {
                        if (isDisabled) return;
                        try {
                          const res = await fetch('/api/auth/login', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ username: u.username, password: 'fromex123' })
                          });
                          const data = await res.json();
                          if (res.ok && data.user) {
                            localStorage.setItem('fromex_token', data.token);
                            setAuthToken(data.token);
                            setCurrentUser(data.user);
                            showToast(`Logged in as ${data.user.name} (@${data.user.username})`, 'success');
                          } else {
                            setCurrentUser(u);
                            showToast(`Switched active profile to ${u.name}`, 'info');
                          }
                        } catch (e) {
                          setCurrentUser(u);
                        }
                        setModalType(null);
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div
                          className="user-avatar"
                          style={{
                            width: '36px',
                            height: '36px',
                            fontSize: '13px',
                            background: u.role === 'Admin' ? '#7c3aed' : u.role === 'Manager' ? '#0284c7' : '#0d9488',
                            color: '#fff'
                          }}
                        >
                          {u.name.charAt(0)}
                        </div>
                        <div>
                          <div style={{ fontWeight: 700, fontSize: '13.5px', color: 'var(--secondary)' }}>
                            {u.name}
                            {isCurrent && <span className="badge" style={{ background: '#e0e7ff', color: '#3730a3', marginLeft: '6px', fontSize: '10px' }}>Current</span>}
                          </div>
                          <div style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>
                            <span style={{ fontWeight: 600 }}>{u.role}</span> &bull; @{u.username}
                          </div>
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span className={`badge ${u.status === 'Active' ? 'badge-paid' : 'badge-absent'}`} style={{ fontSize: '10px' }}>
                          {u.status || 'Active'}
                        </span>
                        {isCurrent ? (
                          <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--accent)' }}>Active Session</span>
                        ) : (
                          <button type="button" className="btn btn-outline btn-sm" disabled={isDisabled}>Switch</button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="modal-footer" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
              <button
                type="button"
                id="modal-logout-btn"
                className="btn btn-outline"
                style={{ color: '#dc2626', borderColor: '#fecaca', background: '#fff' }}
                onClick={handleLogout}
              >
                🚪 Sign Out
              </button>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                  {(modalData || []).length} Company Users
                </span>
                <button type="button" className="btn btn-outline" onClick={() => setModalType(null)}>Close</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Employee Add / Edit Modal */}
      {modalType === 'employee' && (
        <EmployeeModal
          employee={modalData}
          onClose={() => setModalType(null)}
          onSave={async (formData) => {
            try {
              if (modalData?.id) {
                await apiFetch(`/api/employees/${modalData.id}`, { method: 'PUT', body: JSON.stringify(formData) });
                showToast(`Employee ${formData.name} updated`, 'success');
              } else {
                await apiFetch('/api/employees', { method: 'POST', body: JSON.stringify(formData) });
                showToast(`Employee ${formData.name} created`, 'success');
              }
              setModalType(null);
              loadEmployees();
            } catch (err: any) {
              showToast(err.message, 'error');
            }
          }}
        />
      )}

      {/* Attendance Add / Edit Modal */}
      {modalType === 'attendance' && (
        <AttendanceModal
          attendance={modalData}
          employees={employees}
          defaultDate={attDate}
          onClose={() => setModalType(null)}
          onSave={async (formData) => {
            try {
              if (modalData?.id) {
                await apiFetch(`/api/attendance/${modalData.id}`, { method: 'PUT', body: JSON.stringify(formData) });
                showToast('Attendance record updated', 'success');
              } else {
                await apiFetch('/api/attendance', { method: 'POST', body: JSON.stringify(formData) });
                showToast('Attendance recorded successfully', 'success');
              }
              setModalType(null);
              loadAttendance();
            } catch (err: any) {
              showToast(err.message, 'error');
            }
          }}
        />
      )}

      {/* Salary Slip Add / Edit Modal */}
      {modalType === 'salary' && (
        <SalaryModal
          salary={modalData}
          employees={employees}
          defaultMonth={salMonthFilter}
          onClose={() => setModalType(null)}
          onSave={async (formData) => {
            try {
              if (modalData?.id) {
                await apiFetch(`/api/salaries/${modalData.id}`, { method: 'PUT', body: JSON.stringify(formData) });
                showToast('Salary slip updated', 'success');
              } else {
                await apiFetch('/api/salaries', { method: 'POST', body: JSON.stringify(formData) });
                showToast('Salary slip recorded successfully', 'success');
              }
              setModalType(null);
              loadSalaries();
            } catch (err: any) {
              showToast(err.message, 'error');
            }
          }}
        />
      )}

      {/* Transaction Add / Edit Modal */}
      {modalType === 'transaction' && (
        <TransactionModal
          transaction={modalData}
          employees={employees}
          defaultDate={attDate}
          onClose={() => setModalType(null)}
          onSave={async (formData) => {
            try {
              if (modalData?.id) {
                await apiFetch(`/api/accounting/${modalData.id}`, { method: 'PUT', body: JSON.stringify(formData) });
                showToast('Transaction updated', 'success');
              } else {
                await apiFetch('/api/accounting', { method: 'POST', body: JSON.stringify(formData) });
                showToast('Transaction recorded successfully', 'success');
              }
              setModalType(null);
              loadTransactions();
            } catch (err: any) {
              showToast(err.message, 'error');
            }
          }}
        />
      )}

      {/* User Add / Edit Modal */}
      {modalType === 'user' && (
        <UserModal
          user={modalData}
          onClose={() => setModalType(null)}
          onSave={async (formData) => {
            try {
              if (modalData?.id) {
                await apiFetch(`/api/users/${modalData.id}`, { method: 'PUT', body: JSON.stringify(formData) });
                showToast(`User @${formData.username || modalData.username} updated`, 'success');
              } else {
                await apiFetch('/api/users', { method: 'POST', body: JSON.stringify(formData) });
                showToast(`User created successfully`, 'success');
              }
              setModalType(null);
              loadUsers();
            } catch (err: any) {
              showToast(err.message, 'error');
            }
          }}
        />
      )}

      {/* Reset Password Modal */}
      {modalType === 'reset-password' && (
        <ResetPasswordModal
          user={modalData}
          onClose={() => setModalType(null)}
          onSave={async (newPassword) => {
            try {
              await apiFetch(`/api/users/${modalData.id}/reset-password`, {
                method: 'POST',
                body: JSON.stringify({ newPassword })
              });
              showToast(`Password for @${modalData.username} reset successfully`, 'success');
              setModalType(null);
            } catch (err: any) {
              showToast(err.message, 'error');
            }
          }}
        />
      )}

      {/* Confirmation Dialog Modal */}
      {confirmDialog?.open && (
        <div className="modal-backdrop open" onClick={() => setConfirmDialog(null)}>
          <div className="modal-container" onClick={e => e.stopPropagation()} style={{ maxWidth: '440px' }}>
            <div className="modal-header">
              <h3 className="modal-title">{confirmDialog.title}</h3>
              <button type="button" className="modal-close-btn" onClick={() => setConfirmDialog(null)}>&times;</button>
            </div>
            <div className="modal-body">
              <p style={{ margin: 0, fontSize: '13.5px', color: 'var(--text-main)', lineHeight: 1.5 }}>
                {confirmDialog.message}
              </p>
            </div>
            <div className="modal-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button type="button" className="btn btn-outline" onClick={() => setConfirmDialog(null)}>
                {confirmDialog.cancelText || 'Cancel'}
              </button>
              <button
                type="button"
                className={`btn ${confirmDialog.isDanger ? 'btn-danger' : 'btn-primary'}`}
                onClick={confirmDialog.onConfirm}
              >
                {confirmDialog.confirmText || 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast Notification Container */}
      <div className="toast-container">
        {toasts.map(t => (
          <div key={t.id} className={`toast toast-${t.type}`}>
            <span style={{ fontSize: '16px' }}>
              {t.type === 'success' ? '✅' : t.type === 'error' ? '❌' : t.type === 'warning' ? '⚠️' : 'ℹ️'}
            </span>
            <div style={{ flex: 1, fontSize: '13px' }}>{t.message}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ========================================================
   MODAL DIALOG SUB-COMPONENTS
   ======================================================== */

// Employee Form Modal
function EmployeeModal({ employee, onClose, onSave }: { employee: any; onClose: () => void; onSave: (data: any) => void }) {
  const [name, setName] = useState(employee?.name || '');
  const [employeeCode, setEmployeeCode] = useState(employee?.employee_code || '');
  const [designation, setDesignation] = useState(employee?.designation || '');
  const [phone, setPhone] = useState(employee?.phone || '');
  const [basicSalary, setBasicSalary] = useState(employee?.basic_salary || 0);
  const [allowance, setAllowance] = useState(employee?.allowance || 0);
  const [deduction, setDeduction] = useState(employee?.deduction || 0);
  const [status, setStatus] = useState(employee?.status || 'Active');

  const netPackage = Math.max(0, (Number(basicSalary) || 0) + (Number(allowance) || 0) - (Number(deduction) || 0));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      name,
      employee_code: employeeCode,
      designation,
      phone,
      basic_salary: basicSalary,
      allowance,
      deduction,
      status
    });
  };

  return (
    <div className="modal-backdrop open" onClick={onClose}>
      <div className="modal-container" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3 className="modal-title">{employee ? 'Edit Employee Details' : 'Add New Company Employee'}</h3>
          <button type="button" className="modal-close-btn" onClick={onClose}>&times;</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div className="form-grid">
              <div className="form-group">
                <label className="form-label">Full Name *</label>
                <input
                  id="emp-form-name"
                  type="text"
                  required
                  className="input-control"
                  placeholder="e.g. Vikram Malhotra"
                  value={name}
                  onChange={e => setName(e.target.value)}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Employee Code</label>
                <input
                  id="emp-form-code"
                  type="text"
                  className="input-control"
                  placeholder="Auto-generated if blank (e.g. FRX-101)"
                  value={employeeCode}
                  onChange={e => setEmployeeCode(e.target.value)}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Designation *</label>
                <input
                  id="emp-form-designation"
                  type="text"
                  required
                  className="input-control"
                  placeholder="e.g. Senior Software Architect"
                  value={designation}
                  onChange={e => setDesignation(e.target.value)}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Phone Number</label>
                <input
                  id="emp-form-phone"
                  type="text"
                  className="input-control"
                  placeholder="+91 98765 43210"
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Basic Salary (₹)</label>
                <input
                  id="emp-form-basic"
                  type="number"
                  min="0"
                  step="0.01"
                  className="input-control"
                  value={basicSalary}
                  onChange={e => setBasicSalary(e.target.value)}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Monthly Allowance (₹)</label>
                <input
                  id="emp-form-allow"
                  type="number"
                  min="0"
                  step="0.01"
                  className="input-control"
                  value={allowance}
                  onChange={e => setAllowance(e.target.value)}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Monthly Deduction (₹)</label>
                <input
                  id="emp-form-deduct"
                  type="number"
                  min="0"
                  step="0.01"
                  className="input-control"
                  value={deduction}
                  onChange={e => setDeduction(e.target.value)}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Calculated Net Package</label>
                <div className="input-control" style={{ background: '#f1f5f9', fontWeight: 700, color: 'var(--primary)' }}>
                  ₹{netPackage.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </div>
              </div>
              <div className="form-group full-width">
                <label className="form-label">Employee Status</label>
                <select id="emp-form-status" className="select-control" value={status} onChange={e => setStatus(e.target.value)}>
                  <option value="Active">Active</option>
                  <option value="Inactive">Inactive</option>
                  <option value="On Leave">On Leave</option>
                </select>
              </div>
            </div>
          </div>
          <div className="modal-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
            <button type="button" className="btn btn-outline" onClick={onClose}>Cancel</button>
            <button id="emp-form-save-btn" type="submit" className="btn btn-primary">{employee ? 'Update Employee' : 'Create Employee'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Attendance Form Modal
function AttendanceModal({ attendance, employees, defaultDate, onClose, onSave }: any) {
  const [empCode, setEmpCode] = useState(attendance?.emp_id || (employees[0]?.employee_code || ''));
  const [date, setDate] = useState(attendance?.date || attendance?.attendance_date || defaultDate);
  const [checkIn, setCheckIn] = useState(attendance?.check_in || '09:00');
  const [checkOut, setCheckOut] = useState(attendance?.check_out || '18:00');
  const [status, setStatus] = useState(attendance?.status || 'Present');
  const [remarks, setRemarks] = useState(attendance?.remarks || '');

  // Calculate working hours automatically
  const workingHours = useMemo(() => {
    if (status === 'Absent' || status === 'Leave') return 0;
    if (!checkIn || !checkOut) return status === 'Half Day' ? 4.0 : 8.0;

    const [inH, inM] = checkIn.split(':').map(Number);
    const [outH, outM] = checkOut.split(':').map(Number);
    if (isNaN(inH) || isNaN(inM) || isNaN(outH) || isNaN(outM)) {
      return status === 'Half Day' ? 4.0 : 8.0;
    }

    let diff = (outH * 60 + outM) - (inH * 60 + inM);
    if (diff < 0) diff += 24 * 60;
    return Math.max(0, Math.round((diff / 60) * 10) / 10);
  }, [checkIn, checkOut, status]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      emp_id: empCode,
      date,
      attendance_date: date,
      check_in: checkIn,
      check_out: checkOut,
      status,
      working_hours: workingHours,
      remarks
    });
  };

  return (
    <div className="modal-backdrop open" onClick={onClose}>
      <div className="modal-container" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3 className="modal-title">{attendance ? 'Edit Attendance Entry' : 'Mark Employee Attendance'}</h3>
          <button type="button" className="modal-close-btn" onClick={onClose}>&times;</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div className="form-grid">
              <div className="form-group full-width">
                <label className="form-label">Employee *</label>
                <select id="att-form-emp" className="select-control" value={empCode} onChange={e => setEmpCode(e.target.value)} required>
                  {employees.map((emp: any) => (
                    <option key={emp.id} value={emp.employee_code}>{emp.name} ({emp.employee_code})</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Attendance Date *</label>
                <input
                  id="att-form-date"
                  type="date"
                  required
                  className="input-control"
                  value={date}
                  onChange={e => setDate(e.target.value)}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Attendance Status *</label>
                <select id="att-form-status" className="select-control" value={status} onChange={e => setStatus(e.target.value)}>
                  <option value="Present">Present</option>
                  <option value="Half Day">Half Day</option>
                  <option value="Leave">Leave</option>
                  <option value="Absent">Absent</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Check-in Time (24h)</label>
                <input
                  id="att-form-in"
                  type="time"
                  className="input-control"
                  value={checkIn}
                  onChange={e => setCheckIn(e.target.value)}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Check-out Time (24h)</label>
                <input
                  id="att-form-out"
                  type="time"
                  className="input-control"
                  value={checkOut}
                  onChange={e => setCheckOut(e.target.value)}
                />
              </div>
              <div className="form-group full-width">
                <label className="form-label">Computed Working Hours</label>
                <div className="input-control" style={{ background: '#f1f5f9', fontWeight: 700, color: 'var(--primary)' }}>
                  {workingHours} Hours
                </div>
              </div>
              <div className="form-group full-width">
                <label className="form-label">Remarks</label>
                <input
                  id="att-form-remarks"
                  type="text"
                  className="input-control"
                  placeholder="e.g. Client visit, regular shift, overtime"
                  value={remarks}
                  onChange={e => setRemarks(e.target.value)}
                />
              </div>
            </div>
          </div>
          <div className="modal-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
            <button type="button" className="btn btn-outline" onClick={onClose}>Cancel</button>
            <button id="att-form-save-btn" type="submit" className="btn btn-primary">{attendance ? 'Update Attendance' : 'Save Attendance'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Salary Slip Form Modal
function SalaryModal({ salary, employees, defaultMonth, onClose, onSave }: any) {
  const [empCode, setEmpCode] = useState(salary?.emp_id || (employees[0]?.employee_code || ''));
  const [month, setMonth] = useState(salary?.month || defaultMonth);
  const [basicSalary, setBasicSalary] = useState(salary?.basic_salary || 0);
  const [allowance, setAllowance] = useState(salary?.allowance || 0);
  const [deduction, setDeduction] = useState(salary?.deduction || 0);
  const [paymentDate, setPaymentDate] = useState(salary?.payment_date || '');
  const [paymentStatus, setPaymentStatus] = useState(salary?.payment_status || 'Pending');
  const [remarks, setRemarks] = useState(salary?.remarks || '');

  // Auto-populate salary values from selected employee if new
  useEffect(() => {
    if (!salary) {
      const selected = employees.find((e: any) => e.employee_code === empCode);
      if (selected) {
        setBasicSalary(selected.basic_salary || 0);
        setAllowance(selected.allowance || 0);
        setDeduction(selected.deduction || 0);
      }
    }
  }, [empCode, salary, employees]);

  // Net Salary = Basic Salary + Allowance - Deduction
  const netSalary = Math.max(0, (Number(basicSalary) || 0) + (Number(allowance) || 0) - (Number(deduction) || 0));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      emp_id: empCode,
      month,
      basic_salary: basicSalary,
      allowance,
      deduction,
      net_salary: netSalary,
      payment_date: paymentDate,
      payment_status: paymentStatus,
      remarks
    });
  };

  return (
    <div className="modal-backdrop open" onClick={onClose}>
      <div className="modal-container" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3 className="modal-title">{salary ? 'Edit Salary Slip' : 'Create Monthly Salary Slip'}</h3>
          <button type="button" className="modal-close-btn" onClick={onClose}>&times;</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div className="form-grid">
              <div className="form-group">
                <label className="form-label">Employee *</label>
                <select id="sal-form-emp" className="select-control" value={empCode} onChange={e => setEmpCode(e.target.value)} required>
                  {employees.map((emp: any) => (
                    <option key={emp.id} value={emp.employee_code}>{emp.name} ({emp.employee_code})</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Payroll Month *</label>
                <input
                  id="sal-form-month"
                  type="text"
                  required
                  className="input-control"
                  placeholder="e.g. September 2026"
                  value={month}
                  onChange={e => setMonth(e.target.value)}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Basic Salary (₹)</label>
                <input
                  id="sal-form-basic"
                  type="number"
                  min="0"
                  step="0.01"
                  className="input-control"
                  value={basicSalary}
                  onChange={e => setBasicSalary(e.target.value)}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Allowance (₹)</label>
                <input
                  id="sal-form-allow"
                  type="number"
                  min="0"
                  step="0.01"
                  className="input-control"
                  value={allowance}
                  onChange={e => setAllowance(e.target.value)}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Deduction (₹)</label>
                <input
                  id="sal-form-deduct"
                  type="number"
                  min="0"
                  step="0.01"
                  className="input-control"
                  value={deduction}
                  onChange={e => setDeduction(e.target.value)}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Net Salary (Formula: Basic + Allow - Deduct)</label>
                <div className="input-control" style={{ background: '#f1f5f9', fontWeight: 800, color: 'var(--primary)' }}>
                  ₹{netSalary.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Payment Date</label>
                <input
                  id="sal-form-date"
                  type="date"
                  className="input-control"
                  value={paymentDate}
                  onChange={e => setPaymentDate(e.target.value)}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Payment Status</label>
                <select id="sal-form-status" className="select-control" value={paymentStatus} onChange={e => setPaymentStatus(e.target.value)}>
                  <option value="Paid">Paid</option>
                  <option value="Processing">Processing</option>
                  <option value="Pending">Pending</option>
                </select>
              </div>
              <div className="form-group full-width">
                <label className="form-label">Remarks</label>
                <input
                  id="sal-form-remarks"
                  type="text"
                  className="input-control"
                  placeholder="e.g. Bank wire transfer, performance bonus included"
                  value={remarks}
                  onChange={e => setRemarks(e.target.value)}
                />
              </div>
            </div>
          </div>
          <div className="modal-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
            <button type="button" className="btn btn-outline" onClick={onClose}>Cancel</button>
            <button id="sal-form-save-btn" type="submit" className="btn btn-primary">{salary ? 'Update Slip' : 'Save Salary Slip'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Accounting Transaction Form Modal
function TransactionModal({ transaction, employees, defaultDate, onClose, onSave }: any) {
  const [date, setDate] = useState(transaction?.date || defaultDate);
  const [type, setType] = useState(transaction?.type || 'Income');
  const [description, setDescription] = useState(transaction?.description || '');
  const [party, setParty] = useState(transaction?.party || 'Corporate Party');
  const [income, setIncome] = useState(transaction?.income || 0);
  const [expense, setExpense] = useState(transaction?.expense || 0);
  const [remarks, setRemarks] = useState(transaction?.remarks || '');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      date,
      transaction_date: date,
      type,
      transaction_type: type,
      description,
      party,
      income: type === 'Income' ? income : 0,
      expense: type === 'Expense' || type === 'Salary' ? expense : 0,
      remarks
    });
  };

  return (
    <div className="modal-backdrop open" onClick={onClose}>
      <div className="modal-container" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3 className="modal-title">{transaction ? 'Edit Transaction' : 'Record New Cashbook Transaction'}</h3>
          <button type="button" className="modal-close-btn" onClick={onClose}>&times;</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div className="form-grid">
              <div className="form-group">
                <label className="form-label">Transaction Date *</label>
                <input
                  id="txn-form-date"
                  type="date"
                  required
                  className="input-control"
                  value={date}
                  onChange={e => setDate(e.target.value)}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Transaction Type *</label>
                <select id="txn-form-type" className="select-control" value={type} onChange={e => setType(e.target.value)}>
                  <option value="Income">Income</option>
                  <option value="Expense">Expense</option>
                  <option value="Salary">Salary</option>
                  <option value="Other">Other</option>
                </select>
              </div>
              <div className="form-group full-width">
                <label className="form-label">Description *</label>
                <input
                  id="txn-form-desc"
                  type="text"
                  required
                  className="input-control"
                  placeholder="e.g. Client retainer invoice payment"
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                />
              </div>
              <div className="form-group full-width">
                <label className="form-label">Beneficiary / Party</label>
                <input
                  id="txn-form-party"
                  type="text"
                  className="input-control"
                  placeholder="e.g. Apex Global Logistics"
                  value={party}
                  onChange={e => setParty(e.target.value)}
                />
              </div>
              {type === 'Income' && (
                <div className="form-group full-width">
                  <label className="form-label">Income Inflow (₹) *</label>
                  <input
                    id="txn-form-income"
                    type="number"
                    min="0"
                    step="0.01"
                    required
                    className="input-control"
                    value={income}
                    onChange={e => setIncome(e.target.value)}
                  />
                </div>
              )}
              {(type === 'Expense' || type === 'Salary' || type === 'Other') && (
                <div className="form-group full-width">
                  <label className="form-label">Expense Outflow (₹) *</label>
                  <input
                    id="txn-form-expense"
                    type="number"
                    min="0"
                    step="0.01"
                    required
                    className="input-control"
                    value={expense}
                    onChange={e => setExpense(e.target.value)}
                  />
                </div>
              )}
              <div className="form-group full-width">
                <label className="form-label">Remarks</label>
                <input
                  id="txn-form-remarks"
                  type="text"
                  className="input-control"
                  placeholder="e.g. Reference cheque number, invoice ref"
                  value={remarks}
                  onChange={e => setRemarks(e.target.value)}
                />
              </div>
            </div>
          </div>
          <div className="modal-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
            <button type="button" className="btn btn-outline" onClick={onClose}>Cancel</button>
            <button id="txn-form-save-btn" type="submit" className="btn btn-primary">{transaction ? 'Update Entry' : 'Record Entry'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// User Form Modal
function UserModal({ user, onClose, onSave }: any) {
  const [name, setName] = useState(user?.name || '');
  const [username, setUsername] = useState(user?.username || '');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState(user?.role || 'Staff');
  const [status, setStatus] = useState(user?.status || 'Active');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      name,
      username,
      password: password || undefined,
      role,
      status
    });
  };

  return (
    <div className="modal-backdrop open" onClick={onClose}>
      <div className="modal-container" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3 className="modal-title">{user ? 'Edit User Profile' : 'Add Authorized Company User'}</h3>
          <button type="button" className="modal-close-btn" onClick={onClose}>&times;</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div className="form-grid">
              <div className="form-group">
                <label className="form-label" htmlFor="user-form-name">Full Name *</label>
                <input
                  id="user-form-name"
                  type="text"
                  required
                  className="input-control"
                  placeholder="e.g. Rohit Verma"
                  value={name}
                  onChange={e => setName(e.target.value)}
                />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="user-form-username">Username *</label>
                <input
                  id="user-form-username"
                  type="text"
                  required
                  className="input-control"
                  placeholder="e.g. rohitv"
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                />
              </div>
              {!user && (
                <div className="form-group full-width">
                  <label className="form-label" htmlFor="user-form-password">Initial Password (min 6 chars) *</label>
                  <input
                    id="user-form-password"
                    type="password"
                    required
                    minLength={6}
                    className="input-control"
                    placeholder="Enter secure initial password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                  />
                </div>
              )}
              <div className="form-group">
                <label className="form-label" htmlFor="user-form-role">Access Role *</label>
                <select id="user-form-role" className="select-control" value={role} onChange={e => setRole(e.target.value)}>
                  <option value="Admin">Admin</option>
                  <option value="Manager">Manager</option>
                  <option value="Staff">Staff</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="user-form-status">Account Status</label>
                <select id="user-form-status" className="select-control" value={status} onChange={e => setStatus(e.target.value)}>
                  <option value="Active">Active</option>
                  <option value="Disabled">Disabled</option>
                </select>
              </div>
            </div>
          </div>
          <div className="modal-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
            <button type="button" className="btn btn-outline" onClick={onClose}>Cancel</button>
            <button id="user-form-save-btn" type="submit" className="btn btn-primary">{user ? 'Update Profile' : 'Create User'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Reset Password Modal
function ResetPasswordModal({ user, onClose, onSave }: any) {
  const [newPassword, setNewPassword] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(newPassword);
  };

  return (
    <div className="modal-backdrop open" onClick={onClose}>
      <div className="modal-container" onClick={e => e.stopPropagation()} style={{ maxWidth: '420px' }}>
        <div className="modal-header">
          <h3 className="modal-title">Reset Password for @{user?.username}</h3>
          <button type="button" className="modal-close-btn" onClick={onClose}>&times;</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div className="form-group">
              <label className="form-label" htmlFor="reset-form-password">New Password (min 6 chars) *</label>
              <input
                id="reset-form-password"
                type="password"
                required
                minLength={6}
                className="input-control"
                placeholder="Enter new password"
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                autoFocus
              />
            </div>
          </div>
          <div className="modal-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
            <button type="button" className="btn btn-outline" onClick={onClose}>Cancel</button>
            <button id="reset-form-save-btn" type="submit" className="btn btn-primary">Reset Password</button>
          </div>
        </form>
      </div>
    </div>
  );
}
