import { NextRequest } from 'next/server';
import connectToDatabase from '@/lib/mongodb';
import Employee from '@/models/Employee';
import { getAuthenticatedUser } from '@/lib/auth';
import { apiSuccess, apiError } from '@/lib/response';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const search = searchParams.get('search');
    const status = searchParams.get('status');
    const sortField = searchParams.get('sortField') || 'created_at';
    const sortOrder = searchParams.get('sortOrder') || 'asc';

    await connectToDatabase();

    const query: any = {};

    if (search) {
      const term = search.trim();
      query.$or = [
        { name: { $regex: term, $options: 'i' } },
        { employee_code: { $regex: term, $options: 'i' } },
        { designation: { $regex: term, $options: 'i' } },
        { phone: { $regex: term, $options: 'i' } }
      ];
    }

    if (status && status !== 'All') {
      query.status = status;
    }

    const validSortMap: Record<string, string> = {
      id: '_id',
      employee_code: 'employee_code',
      name: 'name',
      designation: 'designation',
      basic_salary: 'basic_salary',
      allowance: 'allowance',
      deduction: 'deduction',
      status: 'status',
      created_at: 'created_at'
    };

    const sortCol = validSortMap[sortField] || 'created_at';
    const sortDir = sortOrder.toLowerCase() === 'desc' ? -1 : 1;

    const employees = await Employee.find(query).sort({ [sortCol]: sortDir });

    return apiSuccess({ employees, count: employees.length });
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
    const { employee_code, name, phone, designation, basic_salary, allowance, deduction, status } = body;

    if (!name || !designation) {
      return apiError('Employee Name and Designation are required', 400);
    }

    await connectToDatabase();

    let code = employee_code ? String(employee_code).trim().toUpperCase() : null;
    if (!code) {
      const last = await Employee.findOne({ employee_code: /^FRX-/ }).sort({ employee_code: -1 });
      let nextNum = 101;
      if (last && last.employee_code) {
        const parsed = parseInt(last.employee_code.replace('FRX-', ''), 10);
        if (!isNaN(parsed)) nextNum = parsed + 1;
      }
      code = `FRX-${nextNum}`;
    }

    const basic = Math.max(0, parseFloat(basic_salary) || 0);
    const allow = Math.max(0, parseFloat(allowance) || 0);
    const deduct = Math.max(0, parseFloat(deduction) || 0);

    const newEmp = await Employee.create({
      employee_code: code,
      name: String(name).trim(),
      phone: phone ? String(phone).trim() : '',
      designation: String(designation).trim(),
      basic_salary: basic,
      allowance: allow,
      deduction: deduct,
      status: status || 'Active'
    });

    return apiSuccess({ employee: newEmp }, 'Employee created successfully', 201);
  } catch (err: any) {
    return apiError(err.message, 500);
  }
}
