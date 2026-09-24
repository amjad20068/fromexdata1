import { NextRequest } from 'next/server';
import connectToDatabase from '@/lib/mongodb';
import Attendance from '@/models/Attendance';
import { getAuthenticatedUser } from '@/lib/auth';
import { calculateWorkingHours } from '@/lib/calculations';
import { apiSuccess, apiError } from '@/lib/response';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await connectToDatabase();

    const record = await Attendance.findById(id);
    if (!record) {
      return apiError('Attendance record not found', 404);
    }

    return apiSuccess({ record });
  } catch (err: any) {
    return apiError(err.message, 500);
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { user, errorResponse } = await getAuthenticatedUser(req);
    if (!user) {
      return apiError(errorResponse?.message || 'Unauthorized', errorResponse?.status || 401);
    }

    await connectToDatabase();
    const record = await Attendance.findById(id);
    if (!record) {
      return apiError('Attendance record not found', 404);
    }

    const body = await req.json().catch(() => ({}));
    const {
      check_in,
      check_out,
      status,
      working_hours,
      remarks,
      date,
      attendance_date
    } = body;

    const targetStatus = status !== undefined ? status : record.status;
    const targetCheckIn = check_in !== undefined ? check_in : record.check_in;
    const targetCheckOut = check_out !== undefined ? check_out : record.check_out;
    const targetDate = (attendance_date || date) || record.attendance_date;

    const hours = (working_hours !== undefined && working_hours !== null && working_hours !== '')
      ? parseFloat(String(working_hours))
      : calculateWorkingHours(targetCheckIn, targetCheckOut, targetStatus);

    const d = new Date(targetDate);
    const dayName = isNaN(d.getTime()) ? record.day : d.toLocaleDateString('en-US', { weekday: 'short' });

    record.attendance_date = targetDate;
    record.day = dayName;
    record.check_in = targetCheckIn;
    record.check_out = targetCheckOut;
    record.status = targetStatus;
    record.working_hours = hours;
    if (remarks !== undefined) record.remarks = remarks;
    record.updated_by = user.name;
    record.updated_at = new Date();

    await record.save();

    return apiSuccess({ record }, 'Attendance updated successfully');
  } catch (err: any) {
    return apiError(err.message, 500);
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { user, errorResponse } = await getAuthenticatedUser(req);
    if (!user) {
      return apiError(errorResponse?.message || 'Unauthorized', errorResponse?.status || 401);
    }

    await connectToDatabase();
    const record = await Attendance.findByIdAndDelete(id);
    if (!record) {
      return apiError('Attendance record not found', 404);
    }

    return apiSuccess({ id }, 'Attendance entry deleted successfully');
  } catch (err: any) {
    return apiError(err.message, 500);
  }
}
