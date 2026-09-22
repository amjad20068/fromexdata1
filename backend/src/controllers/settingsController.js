const db = require('../config/db');
const { success, error } = require('../utils/response');
const { broadcast } = require('../services/socketService');

/**
 * GET /api/settings/stats
 * Get live database statistics and latest backup status
 */
async function getStats(req, res, next) {
  try {
    const [attRes, salRes, txnRes, empRes, usrRes, backupRes] = await Promise.all([
      db.query('SELECT COUNT(*) as count FROM attendance'),
      db.query('SELECT COUNT(*) as count FROM salary_records'),
      db.query('SELECT COUNT(*) as count FROM accounting_transactions'),
      db.query('SELECT COUNT(*) as count FROM employees'),
      db.query('SELECT COUNT(*) as count FROM users'),
      db.query(`
        SELECT id, backup_type, description, records_count, is_restored, created_at, restored_at
        FROM data_backups
        ORDER BY created_at DESC
        LIMIT 5
      `)
    ]);

    const stats = {
      attendance: parseInt(attRes.rows[0].count, 10),
      salaries: parseInt(salRes.rows[0].count, 10),
      transactions: parseInt(txnRes.rows[0].count, 10),
      employees: parseInt(empRes.rows[0].count, 10),
      users: parseInt(usrRes.rows[0].count, 10),
      totalOperationalRecords:
        parseInt(attRes.rows[0].count, 10) +
        parseInt(salRes.rows[0].count, 10) +
        parseInt(txnRes.rows[0].count, 10),
      latestBackups: backupRes.rows
    };

    return success(res, stats, 'System statistics retrieved successfully');
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/settings/clear-data
 * Clears operational data after creating a complete persistent backup snapshot for undo
 */
async function clearData(req, res, next) {
  try {
    const userId = req.user ? req.user.id : null;
    const userName = req.user ? req.user.name : 'Administrator';
    const { scope = 'operational', note = 'Manual full clear' } = req.body || {};

    // 1. Snapshot all current operational records
    const [attRows, salRows, txnRows] = await Promise.all([
      db.query('SELECT * FROM attendance ORDER BY id ASC'),
      db.query('SELECT * FROM salary_records ORDER BY id ASC'),
      db.query('SELECT * FROM accounting_transactions ORDER BY id ASC')
    ]);

    const snapshot = {
      attendance: attRows.rows,
      salary_records: salRows.rows,
      accounting_transactions: txnRows.rows,
      timestamp: new Date().toISOString(),
      clearedBy: userName
    };

    const totalCount = attRows.rows.length + salRows.rows.length + txnRows.rows.length;

    if (totalCount === 0) {
      return success(
        res,
        { cleared: false, totalCleared: 0, message: 'No operational data found to clear.' },
        'Database is already empty'
      );
    }

    // 2. Persist snapshot into data_backups table
    const backupInsert = await db.query(
      `INSERT INTO data_backups (backup_type, description, cleared_by, records_count, snapshot_data, is_restored, created_at)
       VALUES ($1, $2, $3, $4, $5, FALSE, NOW())
       RETURNING id, created_at`,
      [scope, note, userId, totalCount, JSON.stringify(snapshot)]
    );

    const backupId = backupInsert.rows[0].id;

    // 3. Clear the operational tables
    await db.query('DELETE FROM attendance');
    await db.query('DELETE FROM salary_records');
    await db.query('DELETE FROM accounting_transactions');

    const result = {
      cleared: true,
      backupId,
      totalCleared: totalCount,
      clearedCounts: {
        attendance: attRows.rows.length,
        salaries: salRows.rows.length,
        transactions: txnRows.rows.length
      },
      createdAt: backupInsert.rows[0].created_at
    };

    // 4. Real-time broadcast so all tabs update immediately
    broadcast('attendance:deleted', { all: true, author: userName });
    broadcast('salary:deleted', { all: true, author: userName });
    broadcast('transaction:deleted', { all: true, author: userName });
    broadcast('settings:data_cleared', {
      backupId,
      totalCleared: totalCount,
      author: userName
    });

    return success(res, result, `Cleared ${totalCount} records. Undo snapshot created.`);
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/settings/undo-clear
 * Restores data from the specified or latest backup snapshot
 */
async function undoClear(req, res, next) {
  try {
    const userName = req.user ? req.user.name : 'Administrator';
    const { backupId } = req.body || {};

    let backupRow;
    if (backupId) {
      const res = await db.query('SELECT * FROM data_backups WHERE id = $1', [backupId]);
      backupRow = res.rows[0];
    } else {
      // Find latest unrestored backup, or latest backup
      const res = await db.query(
        'SELECT * FROM data_backups WHERE is_restored = FALSE ORDER BY created_at DESC LIMIT 1'
      );
      backupRow = res.rows[0];
      if (!backupRow) {
        const anyRes = await db.query('SELECT * FROM data_backups ORDER BY created_at DESC LIMIT 1');
        backupRow = anyRes.rows[0];
      }
    }

    if (!backupRow) {
      return error(res, 'No backup snapshot found to restore.', 404);
    }

    let snapshot;
    try {
      snapshot = typeof backupRow.snapshot_data === 'string'
        ? JSON.parse(backupRow.snapshot_data)
        : backupRow.snapshot_data;
    } catch (parseErr) {
      return error(res, 'Invalid or corrupted snapshot data.', 500);
    }

    // Clear existing operational data to prevent duplicate primary keys
    await db.query('DELETE FROM attendance');
    await db.query('DELETE FROM salary_records');
    await db.query('DELETE FROM accounting_transactions');

    let restoredAttendance = 0;
    let restoredSalaries = 0;
    let restoredTransactions = 0;

    // Restore Attendance
    if (Array.isArray(snapshot.attendance)) {
      for (const a of snapshot.attendance) {
        await db.query(
          `INSERT INTO attendance (
            id, employee_id, attendance_date, check_in, check_out, status, working_hours, remarks, created_by, updated_by, created_at, updated_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
          ON CONFLICT (employee_id, attendance_date) DO UPDATE SET
            check_in = EXCLUDED.check_in,
            check_out = EXCLUDED.check_out,
            status = EXCLUDED.status,
            working_hours = EXCLUDED.working_hours,
            remarks = EXCLUDED.remarks,
            updated_at = EXCLUDED.updated_at`,
          [
            a.id,
            a.employee_id,
            a.attendance_date,
            a.check_in,
            a.check_out,
            a.status,
            a.working_hours,
            a.remarks,
            a.created_by,
            a.updated_by,
            a.created_at,
            a.updated_at
          ]
        );
        restoredAttendance++;
      }
    }

    // Restore Salary Records
    if (Array.isArray(snapshot.salary_records)) {
      for (const s of snapshot.salary_records) {
        await db.query(
          `INSERT INTO salary_records (
            id, employee_id, month, basic_salary, allowance, deduction, net_salary, payment_date, payment_status, remarks, created_by, updated_by, created_at, updated_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
          ON CONFLICT (id) DO UPDATE SET
            basic_salary = EXCLUDED.basic_salary,
            allowance = EXCLUDED.allowance,
            deduction = EXCLUDED.deduction,
            net_salary = EXCLUDED.net_salary,
            payment_status = EXCLUDED.payment_status,
            updated_at = EXCLUDED.updated_at`,
          [
            s.id,
            s.employee_id,
            s.month,
            s.basic_salary,
            s.allowance,
            s.deduction,
            s.net_salary,
            s.payment_date,
            s.payment_status,
            s.remarks,
            s.created_by,
            s.updated_by,
            s.created_at,
            s.updated_at
          ]
        );
        restoredSalaries++;
      }
    }

    // Restore Accounting Transactions
    if (Array.isArray(snapshot.accounting_transactions)) {
      for (const t of snapshot.accounting_transactions) {
        await db.query(
          `INSERT INTO accounting_transactions (
            id, transaction_date, transaction_type, description, employee_id, income, expense, remarks, created_by, updated_by, created_at, updated_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
          ON CONFLICT (id) DO UPDATE SET
            transaction_date = EXCLUDED.transaction_date,
            transaction_type = EXCLUDED.transaction_type,
            description = EXCLUDED.description,
            income = EXCLUDED.income,
            expense = EXCLUDED.expense,
            remarks = EXCLUDED.remarks,
            updated_at = EXCLUDED.updated_at`,
          [
            t.id,
            t.transaction_date,
            t.transaction_type,
            t.description,
            t.employee_id,
            t.income,
            t.expense,
            t.remarks,
            t.created_by,
            t.updated_by,
            t.created_at,
            t.updated_at
          ]
        );
        restoredTransactions++;
      }
    }

    // Safely sync serial sequences for PostgreSQL
    try {
      await db.query(`SELECT setval(pg_get_serial_sequence('attendance', 'id'), COALESCE((SELECT MAX(id) FROM attendance), 1))`);
      await db.query(`SELECT setval(pg_get_serial_sequence('salary_records', 'id'), COALESCE((SELECT MAX(id) FROM salary_records), 1))`);
      await db.query(`SELECT setval(pg_get_serial_sequence('accounting_transactions', 'id'), COALESCE((SELECT MAX(id) FROM accounting_transactions), 1))`);
    } catch (seqErr) {
      // Non-critical sequence sync notice
      console.warn('Sequence reset notification:', seqErr.message);
    }

    // Mark backup as restored
    await db.query(
      'UPDATE data_backups SET is_restored = TRUE, restored_at = NOW() WHERE id = $1',
      [backupRow.id]
    );

    const totalRestored = restoredAttendance + restoredSalaries + restoredTransactions;

    // Real-time broadcast
    broadcast('attendance:created', { all: true, author: userName });
    broadcast('salary:created', { all: true, author: userName });
    broadcast('transaction:created', { all: true, author: userName });
    broadcast('settings:data_restored', {
      backupId: backupRow.id,
      totalRestored,
      author: userName
    });

    return success(
      res,
      {
        restored: true,
        backupId: backupRow.id,
        totalRestored,
        restoredCounts: {
          attendance: restoredAttendance,
          salaries: restoredSalaries,
          transactions: restoredTransactions
        }
      },
      `Successfully restored ${totalRestored} records!`
    );
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/settings/backups
 * Retrieve list of all snapshots
 */
async function getBackups(req, res, next) {
  try {
    const result = await db.query(`
      SELECT b.id, b.backup_type, b.description, b.records_count, b.is_restored, b.created_at, b.restored_at, u.name as cleared_by_name
      FROM data_backups b
      LEFT JOIN users u ON b.cleared_by = u.id
      ORDER BY b.created_at DESC
      LIMIT 20
    `);

    return success(res, { backups: result.rows }, 'Backups retrieved');
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getStats,
  clearData,
  undoClear,
  getBackups
};
