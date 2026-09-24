import { NextResponse } from 'next/server';
import connectToDatabase from '@/lib/mongodb';

export async function GET() {
  try {
    const mongoose = await connectToDatabase();
    return NextResponse.json({
      status: 'online',
      app: 'FROMEX Company Management System',
      database: 'MongoDB Atlas',
      connectedDatabase: mongoose.connection.name,
      timestamp: new Date().toISOString()
    });
  } catch (err: any) {
    return NextResponse.json(
      {
        status: 'error',
        app: 'FROMEX Company Management System',
        error: err.message,
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}
