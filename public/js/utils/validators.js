// Input Validation Utility

export function validateRequired(value, fieldName) {
  if (value === undefined || value === null || String(value).trim() === '') {
    return `${fieldName} is required`;
  }
  return null;
}

export function validatePositiveNumber(value, fieldName) {
  if (value === undefined || value === null || value === '') {
    return `${fieldName} is required`;
  }
  const num = Number(value);
  if (isNaN(num) || num < 0) {
    return `${fieldName} must be a valid positive number`;
  }
  return null;
}

export function validateTimeFormat(timeStr, fieldName) {
  if (!timeStr) return null; // Optional
  const regex = /^([01]\d|2[0-3]):([0-5]\d)$/;
  if (!regex.test(timeStr)) {
    return `${fieldName} must be in 24-hour HH:MM format`;
  }
  return null;
}

export function validateTimeSequence(checkIn, checkOut) {
  if (!checkIn || !checkOut) return null;
  const [inH, inM] = checkIn.split(':').map(Number);
  const [outH, outM] = checkOut.split(':').map(Number);
  if (outH * 60 + outM < inH * 60 + inM) {
    return 'Check-out time cannot be earlier than check-in time';
  }
  return null;
}
