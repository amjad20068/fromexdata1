import { NextRequest } from 'next/server';
import connectToDatabase from '@/lib/mongodb';
import Attendance from '@/models/Attendance';
import Employee from '@/models/Employee';
import { apiSuccess, apiError } from '@/lib/response';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const targetDate = searchParams.get('date') || new Date().toISOString().split('T')[0];

    await connectToDatabase();

    const totalEmployees = await Employee.countDocuments({ status: 'Active' });
    const recordsToday = await Attendance.find({ attendance_date: targetDate });

    let present = 0;
    let absent = 0;
    let halfDay = 0;
    let leave = 0;
    let totalHours = 0;

    for (const r of recordsToday) {
      if (r.status === 'Present') present++;
      else if (r.status === 'Absent') absent++;
      else if (r.status === 'Half Day') halfDay++;
      else if (r.status === 'Leave') leave++;
      totalHours += parseFloat(String(r.working_hours || 0));
    }

    const attendanceRate = totalEmployees > 0
      ? Math.round(((present + halfDay * 0.5) / totalEmployees) * 100)
      : 0;

    return apiSuccess({
      date: targetDate,
      totalEmployees,
      recordedCount: recordsToday.length,
      present,
      absent,
      halfDay,
      leave,
      totalHours: Math.round(totalHours * 10) / 10,
      attendanceRate
    });
  } catch (err: any) {
    return apiError(err.message, 500);
  }
}
