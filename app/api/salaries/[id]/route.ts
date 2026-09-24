import { NextRequest } from 'next/server';
import connectToDatabase from '@/lib/mongodb';
import SalaryRecord from '@/models/SalaryRecord';
import { getAuthenticatedUser } from '@/lib/auth';
import { calculateNetSalary } from '@/lib/calculations';
import { apiSuccess, apiError } from '@/lib/response';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await connectToDatabase();

    const salary = await SalaryRecord.findById(id);
    if (!salary) {
      return apiError('Salary record not found', 404);
    }

    return apiSuccess({ salary });
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
    const current = await SalaryRecord.findById(id);
    if (!current) {
      return apiError('Salary record not found', 404);
    }

    const body = await req.json().catch(() => ({}));
    const {
      month,
      basic_salary,
      allowance,
      deduction,
      payment_date,
      payment_status,
      remarks
    } = body;

    const basic = basic_salary !== undefined ? Math.max(0, parseFloat(String(basic_salary)) || 0) : current.basic_salary;
    const allow = allowance !== undefined ? Math.max(0, parseFloat(String(allowance)) || 0) : current.allowance;
    const deduct = deduction !== undefined ? Math.max(0, parseFloat(String(deduction)) || 0) : current.deduction;

    const netSalary = calculateNetSalary(basic, allow, deduct);

    if (month) current.month = String(month).trim();
    current.basic_salary = basic;
    current.allowance = allow;
    current.deduction = deduct;
    current.net_salary = netSalary;
    if (payment_date !== undefined) current.payment_date = payment_date || '';
    if (payment_status) current.payment_status = payment_status;
    if (remarks !== undefined) current.remarks = remarks;
    current.updated_by = user.name;
    current.updated_at = new Date();

    await current.save();

    return apiSuccess({ salary: current }, 'Salary record updated successfully');
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
    const deleted = await SalaryRecord.findByIdAndDelete(id);
    if (!deleted) {
      return apiError('Salary record not found', 404);
    }

    return apiSuccess({ id }, `Salary record for ${deleted.emp_name} (${deleted.month}) deleted`);
  } catch (err: any) {
    return apiError(err.message, 500);
  }
}
