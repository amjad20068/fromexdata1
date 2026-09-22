// Application State & Real-Time Sync Engine
import { api, apiClient } from './api.js';
import { CONFIG } from './config.js';
import { toast } from './components/toast.js';

class AppState {
  constructor() {
    this.currentUser = null;
    this.activeTab = 'dashboard';
    this.socket = null;
    this.eventSource = null;
    this.listeners = new Map();
    this.allEmployees = [];
  }

  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event).add(callback);
  }

  off(event, callback) {
    if (this.listeners.has(event)) {
      this.listeners.get(event).delete(callback);
    }
  }

  emit(event, data) {
    if (this.listeners.has(event)) {
      for (const cb of this.listeners.get(event)) {
        try {
          cb(data);
        } catch (e) {
          console.error(`Error in listener for ${event}:`, e);
        }
      }
    }
  }

  async initUser() {
    if (apiClient.token) {
      try {
        const res = await api.auth.getMe();
        if (res.success && res.user) {
          this.currentUser = res.user;
        }
      } catch (e) {
        apiClient.setToken(null);
      }
    }

    if (!this.currentUser) {
      try {
        let loginRes;
        try {
          loginRes = await api.auth.login({ username: 'fromex', password: 'fromex123' });
        } catch (e) {
          loginRes = await api.auth.login({ username: 'admin', password: 'fromex123' });
        }
        if (loginRes && loginRes.success && loginRes.user) {
          this.currentUser = loginRes.user;
          apiClient.setToken(loginRes.token);
        }
      } catch (loginErr) {
        console.warn('Initial authentication error:', loginErr);
      }
    }

    this.updateUserNavVisibility(this.currentUser);
    this.emit('user_changed', this.currentUser);
    this.initRealtimeSync();
    await this.loadEmployees();
  }

  async loadEmployees() {
    try {
      const res = await api.employees.getAll();
      if (res.success && res.employees) {
        this.allEmployees = res.employees;
        this.emit('employees_loaded', this.allEmployees);
      }
    } catch (e) {
      console.error('Failed to load employees:', e);
    }
  }

  setCurrentUser(user, token) {
    this.currentUser = user;
    if (token) {
      apiClient.setToken(token);
    }
    this.updateUserNavVisibility(user);
    this.emit('user_changed', user);
    toast.success(`Active user: ${user.name} (${user.role})`);
  }

  updateUserNavVisibility(user) {
    const usersTab = document.getElementById('nav-tab-users');
    if (usersTab) {
      if (user && user.role === 'Admin') {
        usersTab.style.display = 'flex';
      } else {
        usersTab.style.display = 'none';
        if (this.activeTab === 'users') {
          const dashTab = document.getElementById('nav-tab-dashboard');
          if (dashTab) dashTab.click();
        }
      }
    }
  }

  setActiveTab(tabId) {
    this.activeTab = tabId;
    this.emit('tab_changed', tabId);
  }

  handleRemoteUpdate(type, data = {}) {
    const author = data.author || data.user || 'Another user';
    const isSelf = this.currentUser && this.currentUser.name === author;

    if (!isSelf) {
      toast.sync(`⚡ ${author} updated ${type} data.`);
    }

    if (type === 'attendance') {
      this.emit('attendance_data_changed', data);
    } else if (type === 'salary' || type === 'transaction' || type === 'accounting') {
      this.emit('accounting_data_changed', data);
    } else if (type === 'employee') {
      this.loadEmployees();
      this.emit('employees_data_changed', data);
      this.emit('employee_data_changed', data);
    } else if (type === 'users' || type === 'user') {
      this.emit('users_data_changed', data);
    }
  }

  initRealtimeSync() {
    const syncStatusEl = document.getElementById('sync-status-badge');

    // 1. Try Socket.IO
    if (typeof window !== 'undefined' && typeof window.io === 'function') {
      try {
        this.socket = window.io();

        this.socket.on('connect', () => {
          if (syncStatusEl) {
            syncStatusEl.classList.remove('disconnected');
            syncStatusEl.innerHTML = '<span class="live-indicator-icon"></span> Live Shared Sync (Socket.IO)';
          }
        });

        this.socket.on('disconnect', () => {
          if (syncStatusEl) {
            syncStatusEl.classList.add('disconnected');
            syncStatusEl.innerHTML = '<span style="color:#ef4444;">●</span> Reconnecting...';
          }
        });

        // Attendance updates
        this.socket.on('attendance:created', (data) => this.handleRemoteUpdate('attendance', data));
        this.socket.on('attendance:updated', (data) => this.handleRemoteUpdate('attendance', data));
        this.socket.on('attendance:deleted', (data) => this.handleRemoteUpdate('attendance', data));

        // Salary updates
        this.socket.on('salary:created', (data) => this.handleRemoteUpdate('salary', data));
        this.socket.on('salary:updated', (data) => this.handleRemoteUpdate('salary', data));
        this.socket.on('salary:deleted', (data) => this.handleRemoteUpdate('salary', data));

        // Transaction updates
        this.socket.on('transaction:created', (data) => this.handleRemoteUpdate('transaction', data));
        this.socket.on('transaction:updated', (data) => this.handleRemoteUpdate('transaction', data));
        this.socket.on('transaction:deleted', (data) => this.handleRemoteUpdate('transaction', data));

        // Employee updates
        this.socket.on('employee:created', (data) => this.handleRemoteUpdate('employee', data));
        this.socket.on('employee:updated', (data) => this.handleRemoteUpdate('employee', data));
        this.socket.on('employee:deleted', (data) => this.handleRemoteUpdate('employee', data));

        // User management updates
        this.socket.on('user:created', (data) => this.handleRemoteUpdate('users', data));
        this.socket.on('user:updated', (data) => this.handleRemoteUpdate('users', data));
        this.socket.on('user:deleted', (data) => this.handleRemoteUpdate('users', data));
        this.socket.on('user:password_reset', (data) => this.handleRemoteUpdate('users', data));

        // Settings data updates (clear & restore)
        this.socket.on('settings:data_cleared', (data) => {
          this.emit('attendance_data_changed', data);
          this.emit('accounting_data_changed', data);
          this.emit('settings_data_changed', data);
          this.emit('data_cleared', data);
        });
        this.socket.on('settings:data_restored', (data) => {
          this.emit('attendance_data_changed', data);
          this.emit('accounting_data_changed', data);
          this.emit('settings_data_changed', data);
          this.emit('data_restored', data);
        });

        // Generic data change
        this.socket.on('data:changed', (data) => {
          if (data.event && data.event.startsWith('attendance')) {
            this.emit('attendance_data_changed', data);
          } else if (data.event && (data.event.startsWith('salary') || data.event.startsWith('transaction'))) {
            this.emit('accounting_data_changed', data);
          } else if (data.event && data.event.startsWith('user')) {
            this.emit('users_data_changed', data);
          } else if (data.event && data.event.startsWith('settings')) {
            this.emit('settings_data_changed', data);
          }
        });

        return;
      } catch (err) {
        console.warn('Socket.IO initialization failed, falling back to SSE:', err);
      }
    }

    // 2. Fallback to SSE (Server-Sent Events) if Socket.IO is unavailable
    try {
      this.eventSource = new EventSource(CONFIG.SYNC_URL);

      this.eventSource.onopen = () => {
        if (syncStatusEl) {
          syncStatusEl.classList.remove('disconnected');
          syncStatusEl.innerHTML = '<span class="live-indicator-icon"></span> Live Shared Sync (SSE)';
        }
      };

      this.eventSource.onerror = () => {
        if (syncStatusEl) {
          syncStatusEl.classList.add('disconnected');
          syncStatusEl.innerHTML = '<span style="color:#ef4444;">●</span> Reconnecting...';
        }
      };

      this.eventSource.addEventListener('attendance_updated', (e) => {
        try {
          const data = JSON.parse(e.data);
          this.handleRemoteUpdate('attendance', data);
        } catch (err) {
          console.error('Error handling attendance SSE event:', err);
        }
      });

      this.eventSource.addEventListener('accounting_updated', (e) => {
        try {
          const data = JSON.parse(e.data);
          this.handleRemoteUpdate('accounting', data);
        } catch (err) {
          console.error('Error handling accounting SSE event:', err);
        }
      });

      this.eventSource.addEventListener('employee_updated', (e) => {
        try {
          const data = JSON.parse(e.data);
          this.handleRemoteUpdate('employee', data);
        } catch (err) {
          console.error('Error handling employee SSE event:', err);
        }
      });

    } catch (e) {
      console.warn('Real-time sync engine offline. Normal HTTP mode active.');
    }
  }
}

export const state = new AppState();
