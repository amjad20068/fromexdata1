# FROMEX Production Backend

Production-ready backend API service for **FROMEX** Company Management System.

Built with:
- **Node.js & Express.js**
- **PostgreSQL Database** (PostgreSQL schema with foreign keys, decimal precision, indexes, and unique constraints)
- **JWT Authentication** (`jsonwebtoken`)
- **bcrypt Password Hashing**
- **Socket.IO Real-time Synchronization**

---

## 1. Prerequisites
- Node.js (v18+)
- PostgreSQL (v14+) or automatic embedded PostgreSQL (PGlite)

---

## 2. Quick Start Commands

### 1. Install Dependencies
```bash
# In the project root
npm install
```

### 2. Environment Configuration
Copy `.env.example` to `.env`:
```bash
cp backend/.env.example backend/.env
```
Configure your environment variables:
```ini
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/fromex
PORT=3000
JWT_SECRET=your_secure_random_jwt_secret_key_here
FRONTEND_URL=http://localhost:3000
```
*(Note: If no external PostgreSQL instance is listening at `DATABASE_URL`, the backend automatically initializes the persistent embedded PostgreSQL engine in `./data/postgres` without any code changes).*

### 3. Running Database Migrations
```bash
npm run migrate
# Or from backend folder:
node backend/database/migrations/migrate.js
```

### 4. Running Database Seeds
Seeds the 3 authorized company users with bcrypt hashed passwords, active employees, attendance logs, payroll salary records, and accounting transactions:
```bash
npm run seed
# Or from backend folder:
node backend/database/seeds/seed.js
```

### 5. Starting Backend & Frontend
To run in development mode:
```bash
npm run dev
```

To run in production mode:
```bash
npm start
```

Open your browser at:
```
http://localhost:3000
```

---

## 3. The 3 Authorized Company Users
All 3 users share the same central PostgreSQL database:

| Name | Username | Role | Development Password |
| :--- | :--- | :--- | :--- |
| **Vikram Malhotra** | `admin` | Admin (Managing Director) | `fromex123` |
| **Pooja Sharma** | `manager` | Manager (HR & Operations) | `fromex123` |
| **Rohan Verma** | `staff` | Staff (Finance & Accounts) | `fromex123` |

---

## 4. REST API Documentation

### Authentication
- `POST /api/auth/login`: Authenticate with username & password; returns JWT.
- `GET /api/auth/me`: Get authenticated user profile (safe fields only).
- `GET /api/auth/users`: List the 3 company members.

### Employees
- `GET /api/employees`: List employees with search and status filters.
- `GET /api/employees/:id`: Retrieve single employee.
- `POST /api/employees`: Create employee.
- `PUT /api/employees/:id`: Update employee.
- `DELETE /api/employees/:id`: Delete employee (blocked if attendance/salary history exists).

### Attendance
- `GET /api/attendance`: Filter by employee, date, month, status; includes working hours.
- `GET /api/attendance/summary`: Daily workforce statistics and attendance rate.
- `POST /api/attendance`: Record attendance (prevents duplicate employee/date records; auto-computes working hours).
- `PUT /api/attendance/:id`: Edit attendance.
- `DELETE /api/attendance/:id`: Delete attendance record.

### Accounting Transactions
- `GET /api/accounting`: List transactions with calculated running balance.
- `GET /api/accounting/summary`: Overall financial summary (Total Inflow, Total Outflow, Net Cash Balance).
- `POST /api/accounting`: Record cashflow entry (`Income`, `Expense`, `Salary`, `Other`).
- `PUT /api/accounting/:id`: Update transaction.
- `DELETE /api/accounting/:id`: Delete transaction.

### Salaries & Payroll
- `GET /api/salaries`: Filter by month, employee, payment status.
- `POST /api/salaries`: Add salary slip; backend computes and verifies `Net Salary = Basic Salary + Allowance - Deduction`.
- `PUT /api/salaries/:id`: Update salary slip.
- `DELETE /api/salaries/:id`: Delete salary slip.

### Real-Time Socket.IO
Clients connect to `/socket.io/` and listen for:
- `attendance:created`, `attendance:updated`, `attendance:deleted`
- `salary:created`, `salary:updated`, `salary:deleted`
- `transaction:created`, `transaction:updated`, `transaction:deleted`
- `employee:created`, `employee:updated`, `employee:deleted`
- `data:changed`
