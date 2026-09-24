import { NextRequest } from 'next/server';
import mongoose from 'mongoose';
import connectToDatabase from '@/lib/mongodb';
import Employee from '@/models/Employee';
import Attendance from '@/models/Attendance';
import SalaryRecord from '@/models/SalaryRecord';
import { getAuthenticatedUser } from '@/lib/auth';
import { apiSuccess, apiError } from '@/lib/response';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await connectToDatabase();

    const query = mongoose.Types.ObjectId.isValid(id)
      ? { $or: [{ _id: id }, { employee_code: id }] }
      : { employee_code: id };

    const employee = await Employee.findOne(query);
    if (!employee) {
      return apiError('Employee not found', 404);
    }

    return apiSuccess({ employee });
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

    const query = mongoose.Types.ObjectId.isValid(id)
      ? { $or: [{ _id: id }, { employee_code: id }] }
      : { employee_code: id };

    const emp = await Employee.findOne(query);
    if (!emp) {
      return apiError('Employee not found', 404);
    }

    const body = await req.json().catch(() => ({}));
    const { name, phone, designation, basic_salary, allowance, deduction, status } = body;

    if (name) emp.name = String(name).trim();
    if (phone !== undefined) emp.phone = String(phone).trim();
    if (designation) emp.designation = String(designation).trim();
    if (basic_salary !== undefined) emp.basic_salary = Math.max(0, parseFloat(basic_salary) || 0);
    if (allowance !== undefined) emp.allowance = Math.max(0, parseFloat(allowance) || 0);
    if (deduction !== undefined) emp.deduction = Math.max(0, parseFloat(deduction) || 0);
    if (status) emp.status = String(status).trim();
    emp.updated_at = new Date();

    await emp.save();

    return apiSuccess({ employee: emp }, 'Employee updated successfully');
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

    const query = mongoose.Types.ObjectId.isValid(id)
      ? { $or: [{ _id: id }, { employee_code: id }] }
      : { employee_code: id };

    const emp = await Employee.findOne(query);
    if (!emp) {
      return apiError('Employee not found', 404);
    }

    // Safety check: verify no dependent attendance or salary records exist
    const [attCount, salCount] = await Promise.all([
      Attendance.countDocuments({ $or: [{ employee_id: emp._id }, { emp_id: emp.employee_code }] }),
      SalaryRecord.countDocuments({ $or: [{ employee_id: emp._id }, { emp_id: emp.employee_code }] })
    ]);

    if (attCount > 0 || salCount > 0) {
      return apiError(
        `Cannot delete employee "${emp.name}". This employee has ${attCount} attendance and ${salCount} salary records associated in history.`,
        400
      );
    }

    await Employee.findByIdAndDelete(emp._id);

    return apiSuccess({ id: emp._id.toString() }, `Employee ${emp.name} deleted successfully`);
  } catch (err: any) {
    return apiError(err.message, 500);
  }
}
