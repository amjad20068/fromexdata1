import { NextResponse } from 'next/server';

export function apiSuccess(data: any = {}, message: string = 'Success', status: number = 200) {
  const payload: any = {
    success: true,
    message,
    ...(data && typeof data === 'object' && !Array.isArray(data) ? data : {}),
    data: data
  };

  return NextResponse.json(payload, { status });
}

export function apiError(message: string = 'Something went wrong', status: number = 500, errors: any = null) {
  const payload: any = {
    success: false,
    message
  };

  if (errors) {
    payload.errors = errors;
  }

  return NextResponse.json(payload, { status });
}
