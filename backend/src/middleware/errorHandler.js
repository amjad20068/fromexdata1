const { error } = require('../utils/response');

function errorHandler(err, req, res, next) {
  console.error('🔥 Central Error Handler caught:', err);

  // PostgreSQL Unique constraint violation
  if (err.code === '23505') {
    let msg = 'A record with these details already exists.';
    if (err.detail && err.detail.includes('attendance')) {
      msg = 'An attendance record for this employee and date already exists.';
    } else if (err.detail && err.detail.includes('employee_code')) {
      msg = 'An employee with this Employee Code already exists.';
    } else if (err.detail && err.detail.includes('username')) {
      msg = 'This username is already taken.';
    }
    return error(res, msg, 409);
  }

  // PostgreSQL Foreign key violation (e.g. ON DELETE RESTRICT)
  if (err.code === '23503') {
    return error(
      res,
      'Cannot perform this action because dependent attendance, salary, or accounting records exist for this entity.',
      400
    );
  }

  // PostgreSQL Invalid data format
  if (err.code === '22P02') {
    return error(res, 'Invalid ID or data format provided in request.', 400);
  }

  const statusCode = err.statusCode || err.status || 500;
  const message = err.message || 'An internal server error occurred. Please try again.';

  return error(res, message, statusCode, process.env.NODE_ENV === 'development' ? err.stack : undefined);
}

module.exports = errorHandler;
