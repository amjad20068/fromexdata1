import { NextResponse } from 'next/server';
import connectToDatabase, { checkMongoConfig, sanitizeMongoError } from '@/lib/mongodb';

export async function GET() {
  const configCheck = checkMongoConfig();
  if (!configCheck.configured) {
    return NextResponse.json(
      {
        status: 'unconfigured',
        app: 'FROMEX Company Management System',
        database: 'Unconfigured',
        message: configCheck.message,
        timestamp: new Date().toISOString()
      },
      { status: 503 }
    );
  }

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
    const cleanError = sanitizeMongoError(err);
    return NextResponse.json(
      {
        status: 'error',
        app: 'FROMEX Company Management System',
        database: 'Disconnected',
        error: cleanError,
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}
