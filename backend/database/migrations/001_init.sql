-- PostgreSQL Schema for FROMEX Company Management System

-- 1. USERS TABLE
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  username VARCHAR(100) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role VARCHAR(50) NOT NULL DEFAULT 'Staff',
  status VARCHAR(20) NOT NULL DEFAULT 'Active',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. EMPLOYEES TABLE
CREATE TABLE IF NOT EXISTS employees (
  id SERIAL PRIMARY KEY,
  employee_code VARCHAR(50) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  phone VARCHAR(50),
  designation VARCHAR(100) NOT NULL,
  basic_salary NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  allowance NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  deduction NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  status VARCHAR(20) NOT NULL DEFAULT 'Active',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. ATTENDANCE TABLE
CREATE TABLE IF NOT EXISTS attendance (
  id SERIAL PRIMARY KEY,
  employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE RESTRICT,
  attendance_date DATE NOT NULL,
  check_in VARCHAR(10),
  check_out VARCHAR(10),
  status VARCHAR(20) NOT NULL, -- 'Present', 'Absent', 'Half Day', 'Leave'
  working_hours NUMERIC(4, 1) NOT NULL DEFAULT 0.0,
  remarks TEXT,
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  updated_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT uq_employee_attendance_date UNIQUE (employee_id, attendance_date)
);

-- 4. ACCOUNTING_TRANSACTIONS TABLE
CREATE TABLE IF NOT EXISTS accounting_transactions (
  id SERIAL PRIMARY KEY,
  transaction_date DATE NOT NULL,
  transaction_type VARCHAR(20) NOT NULL, -- 'Income', 'Expense', 'Salary', 'Other'
  description TEXT NOT NULL,
  employee_id INTEGER REFERENCES employees(id) ON DELETE SET NULL,
  income NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
  expense NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
  remarks TEXT,
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  updated_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. SALARY_RECORDS TABLE
CREATE TABLE IF NOT EXISTS salary_records (
  id SERIAL PRIMARY KEY,
  employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE RESTRICT,
  month VARCHAR(50),
  basic_salary NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  allowance NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  deduction NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  net_salary NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  payment_date DATE,
  payment_status VARCHAR(20) NOT NULL DEFAULT 'Pending', -- 'Paid', 'Pending', 'Processing'
  remarks TEXT,
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  updated_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for high-performance query execution
CREATE INDEX IF NOT EXISTS idx_attendance_date ON attendance(attendance_date);
CREATE INDEX IF NOT EXISTS idx_attendance_employee ON attendance(employee_id);
CREATE INDEX IF NOT EXISTS idx_transactions_date ON accounting_transactions(transaction_date);
CREATE INDEX IF NOT EXISTS idx_transactions_type ON accounting_transactions(transaction_type);
CREATE INDEX IF NOT EXISTS idx_salary_employee ON salary_records(employee_id);
CREATE INDEX IF NOT EXISTS idx_salary_month ON salary_records(month);
