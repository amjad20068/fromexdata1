import { NextResponse } from 'next/server';
import connectToDatabase from '@/lib/mongodb';
import User from '@/models/User';
import { apiSuccess, apiError } from '@/lib/response';

export async function GET() {
  try {
    await connectToDatabase();
    const users = await User.find({}, 'name username role status created_at').sort({ created_at: 1 });
    return apiSuccess({ users }, 'Authorized users retrieved');
  } catch (err: any) {
    return apiError(err.message, 500);
  }
}
