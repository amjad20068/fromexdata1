import { NextRequest } from 'next/server';
import connectToDatabase from '@/lib/mongodb';
import SalaryRecord from '@/models/SalaryRecord';
import Employee from '@/models/Employee';
import { getAuthenticatedUser } from '@/lib/auth';
import { calculateNetSalary } from '@/lib/calculations';
import { apiSuccess, apiError } from '@/lib/response';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const employee_id = searchParams.get('employee_id');
    const month = searchParams.get('month');
    const status = searchParams.get('status');
    const payment_status = searchParams.get('payment_status');
    const search = searchParams.get('search');
    const sortField = searchParams.get('sortField') || 'created_at';
    const sortOrder = searchParams.get('sortOrder') || 'desc';

    await connectToDatabase();

    const query: any = {};

    if (employee_id && employee_id !== 'All') {
      query.$or = [{ emp_id: employee_id }, { employee_id: employee_id }];
    }

    if (month && month !== 'All') {
      query.month = month;
    }

    const targetStatus = payment_status || status;
    if (targetStatus && targetStatus !== 'All') {
      query.payment_status = targetStatus;
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
      month: 'month',
      basic_salary: 'basic_salary',
      allowance: 'allowance',
      deduction: 'deduction',
      net_salary: 'net_salary',
      payment_date: 'payment_date',
      payment_status: 'payment_status',
      created_at: 'created_at'
    };

    const sortCol = validSortMap[sortField] || 'created_at';
    const sortDir = sortOrder.toLowerCase() === 'asc' ? 1 : -1;

    const salaries = await SalaryRecord.find(query).sort({ [sortCol]: sortDir });

    return apiSuccess({ salaries, count: salaries.length });
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
      month,
      basic_salary,
      allowance,
      deduction,
      payment_date,
      payment_status,
      remarks
    } = body;

    if (!month) {
      return apiError('Payroll month is required (e.g. September 2026)', 400);
    }

    await connectToDatabase();

    // Resolve employee
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

    const basic = Math.max(0, parseFloat(String(basic_salary)) || 0);
    const allow = Math.max(0, parseFloat(String(allowance)) || 0);
    const deduct = Math.max(0, parseFloat(String(deduction)) || 0);

    // Backend Net Salary Formula: Net = Basic + Allowance - Deduction
    const netSalary = calculateNetSalary(basic, allow, deduct);

    const newSalary = await SalaryRecord.create({
      employee_id: emp._id,
      emp_id: emp.employee_code,
      emp_name: emp.name,
      month: String(month).trim(),
      basic_salary: basic,
      allowance: allow,
      deduction: deduct,
      net_salary: netSalary,
      payment_date: payment_date || '',
      payment_status: payment_status || 'Pending',
      remarks: remarks || '',
      created_by: user._id,
      updated_by: user.name
    });

    return apiSuccess({ salary: newSalary }, 'Salary record created successfully', 201);
  } catch (err: any) {
    return apiError(err.message, 500);
  }
}
