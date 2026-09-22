# FROMEX — Corporate Attendance & Accounting Management System

A complete, production-grade company management web application built for **Attendance**, **Accounting & Payroll**, **Corporate Analytics**, and **Scalable Multi-User Management**.

The architecture uses a **shared PostgreSQL database** as the single source of truth across all user sessions and devices, paired with **Socket.IO** for real-time collaborative synchronization.

---

## Key Features

1. **Scalable Multi-User Management (No 3-User Limit)**:
   - Starts with 3 seed users (`Admin`, `Manager`, `Staff`) but is designed to scale dynamically to any number of authorized company users.
   - Admin can create new users, edit user profiles, assign roles, reset passwords, and enable/disable accounts.
   - The frontend "Users" management tab is automatically restricted and visible exclusively to Admin users.
   - Disabled accounts are strictly prevented from logging in (HTTP 403) and existing JWT sessions are revoked immediately.

2. **Security & Cryptography**:
   - Passwords hashed using `bcrypt` (10 rounds).
   - Plain-text passwords are never stored.
   - Password hashes are never returned across API responses or exposed to the frontend.
   - Stateless JWT token authorization (`Authorization: Bearer <token>`).
   - SQL injection-proof parameterized queries across all controllers.
   - Security headers with `helmet` and configurable `cors`.

3. **Shared PostgreSQL Database Architecture**:
   - Every user (User A, User B, User C, and future users) reads from and writes to the same PostgreSQL database.
   - If User A creates a salary slip of ₹10,000, User B sees ₹10,000.
   - If User C edits it to ₹12,000, User A and User B instantly see the updated ₹12,000.
   - Works seamlessly with external PostgreSQL (`DATABASE_URL`) or embedded persistent PostgreSQL (`@electric-sql/pglite` in `./data/postgres`).

4. **Real-Time Synchronization (Socket.IO)**:
   - Instant broadcasts when attendance, salaries, transactions, employees, or users are created, updated, or deleted.
   - Live synchronization indicator badge with auto-reconnect fallback.

5. **Attendance Management (Excel-Like Grid)**:
   - Check-in and check-out tracking with automated working hours calculation (0.0 hrs for Absent/Leave).
   - Statuses: `Present`, `Absent`, `Half Day`, `Leave`.
   - View modes: All Records, Daily Roster View, Monthly View.
   - Multi-criteria filtering by employee, date range, status, and search query.
   - Unique constraint `(employee_id, attendance_date)` prevents duplicate records.
   - CSV export for Excel integration.

6. **Accounting & Payroll Management**:
   - **Salaries**: Formula `Net Salary = Basic Salary + Allowance - Deduction` validated on both frontend and backend.
   - **Ledger**: Chronological running balance calculated dynamically.
   - Formatted in Indian Rupee (`₹`).
   - Summary statistics: Total Inflow, Total Outflow, Net Cash Balance.

7. **Corporate Dashboard & Live Clock**:
   - Live date display (`Wednesday, 16 September 2026`) and ticking digital clock with seconds (`HH:MM:SS AM/PM`).
   - KPI metrics: Present Today, Absent Today, Total Monthly Payroll, Net Balance, Active Headcount.
   - Weekly attendance trend visualizer and cashflow breakdown widgets.

8. **Fully Responsive Across All Viewports**:
   - Verified on 320px, 375px, 390px, 414px, 768px, 1024px, 1366px, and 1920px (Android, iPhone, iPad, laptop, desktop).
   - Excel-like table scrolling containers prevent horizontal layout breakage.

---

## Initial Company Users (Seed Data)

The system is seeded with 3 initial company users for testing:

| Name | Username | Role | Password | Status |
| :--- | :--- | :--- | :--- | :--- |
| **Vikram Malhotra** | `admin` | **Admin** | `fromex123` | Active |
| **Pooja Sharma** | `manager` | **Manager** | `fromex123` | Active |
| **Rohan Verma** | `staff` | **Staff** | `fromex123` | Active |

*Admins can create unlimited additional users via the UI or `POST /api/users`.*

---

## Installation & Setup

### 1. Prerequisites
- **Node.js** v18.0 or higher
- **npm** v9.0 or higher
- *(Optional)* PostgreSQL server v14+ (if using external DB). If external PostgreSQL is not running, the system will automatically initialize the embedded persistent PostgreSQL engine.

### 2. Install Dependencies
```bash
npm install
```

### 3. Environment Configuration
Copy `.env.example` to `backend/.env`:
```bash
cp backend/.env.example backend/.env
```

Ensure `backend/.env` contains:
```ini
PORT=3000
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/fromex
JWT_SECRET=fromex_super_secret_jwt_key_987654321
FRONTEND_URL=http://localhost:3000
```

### 4. Database Migrations & Seeding
Run schema migrations:
```bash
npm run migrate
```

Seed initial company users, employees, attendance, and transactions:
```bash
npm run seed
```

---

## Running the Application

### Development Mode
```bash
npm run dev
```

### Production Mode
```bash
npm start
```

Access the application in your browser:
```
http://localhost:3000
```

---

## Running Tests

Run the complete 50-assertion backend verification suite:
```bash
npm test
```

Run headless browser UI verification:
```bash
node verify-ui.js
```

---

## REST API Reference

### Authentication
- `POST /api/auth/login` — Login with `{ username, password }`; returns JWT and safe user object.
- `GET /api/auth/me` — Retrieve current authenticated user profile.
- `GET /api/auth/users` — List authorized company users.

### User Management (Admin Only)
- `GET /api/users` — List company users with search/role/status filters.
- `GET /api/users/:id` — Get single user details (safe fields).
- `POST /api/users` — Create new user `{ name, username, password, role, status }`.
- `PUT /api/users/:id` — Update user `{ name, role, status }`.
- `POST /api/users/:id/reset-password` — Admin reset password `{ newPassword }`.
- `PATCH /api/users/:id/status` — Toggle or set status `{ status: 'Active' | 'Disabled' }`.

### Attendance
- `GET /api/attendance` — Retrieve attendance logs with search, employee, date, and month filters.
- `GET /api/attendance/summary` — Get daily metrics (Present, Absent, Half Day, Leave, rate).
- `POST /api/attendance` — Create attendance record.
- `PUT /api/attendance/:id` — Update attendance record.
- `DELETE /api/attendance/:id` — Delete attendance record.

### Accounting & Payroll
- `GET /api/accounting` — Get transactions ledger with running balance.
- `GET /api/accounting/summary` — Financial summary (Total Income, Total Expense, Net Balance).
- `POST /api/accounting` — Record transaction.
- `PUT /api/accounting/:id` — Update transaction.
- `DELETE /api/accounting/:id` — Delete transaction.
- `GET /api/salaries` — Get employee salary records.
- `POST /api/salaries` — Create salary slip (`Net = Basic + Allowance - Deduction`).
- `PUT /api/salaries/:id` — Update salary slip.
- `DELETE /api/salaries/:id` — Delete salary slip.

### Employees
- `GET /api/employees` — List employees with search and status filters.
- `POST /api/employees` — Create new employee.
- `PUT /api/employees/:id` — Update employee details.
- `DELETE /api/employees/:id` — Delete employee (foreign key protected if records exist).

---

## Deployment Instructions

### 1. Production Process Manager (PM2 / Systemd)
```bash
npm install -g pm2
pm2 start backend/src/server.js --name "fromex-app"
pm2 save
```

### 2. Reverse Proxy (Nginx)
```nginx
server {
    listen 80;
    server_name fromex.yourcompany.com;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

---

## License
Proprietary — FROMEX Corporate Systems. All Rights Reserved.
