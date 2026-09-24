import { NextRequest } from 'next/server';
import connectToDatabase from '@/lib/mongodb';
import Attendance from '@/models/Attendance';
import Employee from '@/models/Employee';
import { getAuthenticatedUser } from '@/lib/auth';
import { calculateWorkingHours } from '@/lib/calculations';
import { apiSuccess, apiError } from '@/lib/response';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const employee_id = searchParams.get('employee_id');
    const emp_id = searchParams.get('emp_id');
    const date = searchParams.get('date');
    const month = searchParams.get('month'); // YYYY-MM
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const status = searchParams.get('status');
    const search = searchParams.get('search');
    const sortField = searchParams.get('sortField') || 'attendance_date';
    const sortOrder = searchParams.get('sortOrder') || 'desc';

    await connectToDatabase();

    const query: any = {};
    const targetEmp = employee_id || emp_id;

    if (targetEmp && targetEmp !== 'All') {
      query.$or = [{ emp_id: targetEmp }, { employee_id: targetEmp }];
    }

    if (date) {
      query.attendance_date = date;
    }

    if (startDate && endDate) {
      query.attendance_date = { $gte: startDate, $lte: endDate };
    } else if (startDate) {
      query.attendance_date = { $gte: startDate };
    } else if (endDate) {
      query.attendance_date = { $lte: endDate };
    }

    if (month) {
      query.attendance_date = { $regex: `^${month}` };
    }

    if (status && status !== 'All') {
      query.status = status;
    }

    if (search) {
      const term = search.trim();
      query.$or = [
        { emp_name: { $regex: term, $options: 'i' } },
        { emp_id: { $regex: term, $options: 'i' } },
        { remarks: { $regex: term, $options: 'i' } }
      ];
    }

    const validSortMap: Record<string, string> = {
      id: '_id',
      emp_id: 'emp_id',
      emp_name: 'emp_name',
      date: 'attendance_date',
      attendance_date: 'attendance_date',
      status: 'status',
      working_hours: 'working_hours'
    };

    const sortCol = validSortMap[sortField] || 'attendance_date';
    const sortDir = sortOrder.toLowerCase() === 'asc' ? 1 : -1;

    const records = await Attendance.find(query).sort({ [sortCol]: sortDir, _id: -1 });

    return apiSuccess({ records, count: records.length });
  } catch (err: any) {
    return apiError(err.message, 500);
  }
}

export async function POST(req: NextRequest) {
  try {
    const { user, errorResponse } = await getAuthenticatedUser(req);
    if (!user) {
      return apiError(errorResponse?.message || 'Unauthorized', errorResponse?.status || 401);
    }

    const body = await req.json().catch(() => ({}));
    const {
      employee_id,
      emp_id,
      date,
      attendance_date,
      check_in,
      check_out,
      status,
      working_hours,
      remarks
    } = body;

    const targetDate = attendance_date || date;
    const targetStatus = status || 'Present';

    if (!targetDate) {
      return apiError('Attendance date is required', 400);
    }

    await connectToDatabase();

    // Resolve employee details
    let emp = null;
    if (emp_id) {
      emp = await Employee.findOne({ employee_code: String(emp_id).trim() });
    }
    if (!emp && employee_id) {
      emp = await Employee.findOne({
        $or: [{ _id: employee_id }, { employee_code: employee_id }]
      });
    }

    if (!emp) {
      return apiError('Valid Employee ID or Employee Code is required', 400);
    }

    // Check duplicate record
    const duplicate = await Attendance.findOne({
      emp_id: emp.employee_code,
      attendance_date: targetDate
    });

    if (duplicate) {
      return apiError('Attendance record for this employee and date already exists.', 409);
    }

    const hours = (working_hours !== undefined && working_hours !== null && working_hours !== '')
      ? parseFloat(String(working_hours))
      : calculateWorkingHours(check_in, check_out, targetStatus);

    // Calculate Day name
    const d = new Date(targetDate);
    const dayName = isNaN(d.getTime()) ? '' : d.toLocaleDateString('en-US', { weekday: 'short' });

    const newRecord = await Attendance.create({
      employee_id: emp._id,
      emp_id: emp.employee_code,
      emp_name: emp.name,
      attendance_date: targetDate,
      day: dayName,
      check_in: check_in || '',
      check_out: check_out || '',
      status: targetStatus,
      working_hours: hours,
      remarks: remarks || '',
      created_by: user._id,
      updated_by: user.name
    });

    return apiSuccess({ record: newRecord }, 'Attendance recorded successfully', 201);
  } catch (err: any) {
    return apiError(err.message, 500);
  }
}
