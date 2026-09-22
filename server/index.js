const express = require('express');
const cors = require('cors');
const path = require('node:path');

// Ensure database is initialized & seeded
require('./db');
require('./seed');

const authRoutes = require('./routes/auth');
const employeeRoutes = require('./routes/employees');
const attendanceRoutes = require('./routes/attendance');
const accountingRoutes = require('./routes/accounting');
const dashboardRoutes = require('./routes/dashboard');
const { router: syncRoutes } = require('./routes/sync');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static frontend files
app.use(express.static(path.join(__dirname, '..', 'public')));

// Mount API routes
app.use('/api/auth', authRoutes);
app.use('/api/employees', employeeRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/accounting', accountingRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/sync', syncRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'online',
    app: 'FROMEX Company Management System',
    timestamp: new Date().toISOString()
  });
});

// Single Page Application fallback to index.html
app.use((req, res, next) => {
  if (req.method === 'GET' && !req.path.startsWith('/api')) {
    return res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
  }
  next();
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({ success: false, message: 'Internal server error', error: err.message });
});

app.listen(PORT, () => {
  console.log(`====================================================`);
  console.log(`🚀 FROMEX System Running at: http://localhost:${PORT}`);
  console.log(`🏢 Attendance & Accounting Modules Active`);
  console.log(`⚡ Real-time SSE Sync Enabled at: /api/sync/events`);
  console.log(`====================================================`);
});
