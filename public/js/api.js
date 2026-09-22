// Centralized REST API Service Layer
import { CONFIG } from './config.js';

class ApiClient {
  constructor() {
    const saved = localStorage.getItem('fromex_token');
    this.token = (saved && saved.includes('.')) ? saved : null;
  }

  setToken(token) {
    this.token = token;
    if (token) {
      localStorage.setItem('fromex_token', token);
    } else {
      localStorage.removeItem('fromex_token');
    }
  }

  async request(endpoint, options = {}) {
    const url = `${CONFIG.API_BASE}${endpoint}`;
    const headers = {
      'Content-Type': 'application/json',
      ...options.headers
    };

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
      headers['x-user-token'] = this.token;
    }

    const config = {
      ...options,
      headers
    };

    try {
      const response = await fetch(url, config);
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.message || `Request failed with status ${response.status}`);
      }

      if (data && data.data && typeof data.data === 'object' && !Array.isArray(data.data)) {
        return { ...data.data, success: data.success !== false, message: data.message };
      }

      return data;
    } catch (err) {
      console.error(`API Error [${endpoint}]:`, err);
      throw err;
    }
  }

  get(endpoint, params = {}) {
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null && value !== '') {
        query.append(key, value);
      }
    }
    const qs = query.toString();
    return this.request(qs ? `${endpoint}?${qs}` : endpoint, { method: 'GET' });
  }

  post(endpoint, body) {
    return this.request(endpoint, {
      method: 'POST',
      body: JSON.stringify(body)
    });
  }

  put(endpoint, body) {
    return this.request(endpoint, {
      method: 'PUT',
      body: JSON.stringify(body)
    });
  }

  patch(endpoint, body) {
    return this.request(endpoint, {
      method: 'PATCH',
      body: JSON.stringify(body)
    });
  }

  delete(endpoint) {
    return this.request(endpoint, {
      method: 'DELETE'
    });
  }
}

export const apiClient = new ApiClient();

// High level domain API endpoints
export const api = {
  auth: {
    getUsers: () => apiClient.get('/auth/users'),
    getMe: () => apiClient.get('/auth/me'),
    login: (credentials) => apiClient.post('/auth/login', credentials)
  },
  users: {
    getAll: (params) => apiClient.get('/users', params),
    getById: (id) => apiClient.get(`/users/${id}`),
    create: (data) => apiClient.post('/users', data),
    update: (id, data) => apiClient.put(`/users/${id}`, data),
    resetPassword: (id, data) => apiClient.post(`/users/${id}/reset-password`, data),
    toggleStatus: (id, data) => apiClient.patch(`/users/${id}/status`, data),
    delete: (id) => apiClient.delete(`/users/${id}`)
  },
  employees: {
    getAll: (params) => apiClient.get('/employees', params),
    create: (data) => apiClient.post('/employees', data),
    update: (id, data) => apiClient.put(`/employees/${id}`, data),
    delete: (id) => apiClient.delete(`/employees/${id}`)
  },
  attendance: {
    getAll: (params) => apiClient.get('/attendance', params),
    getSummary: (params) => apiClient.get('/attendance/summary', params),
    create: (data) => apiClient.post('/attendance', data),
    update: (id, data) => apiClient.put(`/attendance/${id}`, data),
    delete: (id) => apiClient.delete(`/attendance/${id}`)
  },
  accounting: {
    getSalaries: (params) => apiClient.get('/accounting/salaries', params),
    createSalary: (data) => apiClient.post('/accounting/salaries', data),
    updateSalary: (id, data) => apiClient.put(`/accounting/salaries/${id}`, data),
    deleteSalary: (id) => apiClient.delete(`/accounting/salaries/${id}`),

    getTransactions: (params) => apiClient.get('/accounting/transactions', params),
    createTransaction: (data) => apiClient.post('/accounting/transactions', data),
    updateTransaction: (id, data) => apiClient.put(`/accounting/transactions/${id}`, data),
    deleteTransaction: (id) => apiClient.delete(`/accounting/transactions/${id}`),

    getSummary: (params) => apiClient.get('/accounting/summary', params)
  },
  dashboard: {
    getMetrics: (params) => apiClient.get('/dashboard/metrics', params)
  },
  settings: {
    getStats: () => apiClient.get('/settings/stats'),
    clearData: (scope = 'operational') => apiClient.post('/settings/clear-data', { scope }),
    undoClear: (backupId) => apiClient.post('/settings/undo-clear', { backupId }),
    getBackups: () => apiClient.get('/settings/backups')
  }
};

