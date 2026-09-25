import mongoose from 'mongoose';

/**
 * Safely sanitizes error messages to prevent exposing MongoDB connection credentials.
 */
export function sanitizeMongoError(error: any): string {
  if (!error) return 'Unknown database error occurred.';
  const message = typeof error === 'string' ? error : error.message || 'Database error occurred.';
  return message
    .replace(/mongodb(?:\+srv)?:\/\/[^@\s]+@[^\s/]+/gi, 'mongodb+srv://[REDACTED_CREDENTIALS]@[HOST]')
    .replace(/password:?\s*['"]?[^'",\s]+['"]?/gi, 'password:[REDACTED]');
}

/**
 * Validates the MongoDB configuration without throwing, for safe status reporting.
 */
export function checkMongoConfig(): { configured: boolean; message?: string } {
  const uri = process.env.MONGODB_URI;
  if (!uri || !uri.trim()) {
    return {
      configured: false,
      message: 'MONGODB_URI is not defined. Please define MONGODB_URI in your .env.local file (for local development) or Vercel Environment Variables (for production).'
    };
  }

  const cleanUri = uri.trim();
  if (
    cleanUri === '<MY_MONGODB_ATLAS_CONNECTION_STRING>' ||
    cleanUri.startsWith('<') ||
    cleanUri.includes('<username>') ||
    cleanUri.includes('<password>') ||
    cleanUri === 'placeholder'
  ) {
    return {
      configured: false,
      message: "MONGODB_URI is set to the placeholder '<MY_MONGODB_ATLAS_CONNECTION_STRING>'. Please replace it with your actual MongoDB Atlas connection string in .env.local or in your Vercel Project Settings."
    };
  }

  if (!cleanUri.startsWith('mongodb://') && !cleanUri.startsWith('mongodb+srv://')) {
    return {
      configured: false,
      message: 'Invalid MONGODB_URI format. The connection string must start with "mongodb://" or "mongodb+srv://". Please verify your connection string in .env.local or Vercel Project Settings.'
    };
  }

  return { configured: true };
}

/**
 * Retrieves the validated MongoDB URI from environment variables.
 * Throws a clean, safe, descriptive error if unconfigured.
 */
export const getMongoURI = (): string => {
  const check = checkMongoConfig();
  if (!check.configured) {
    throw new Error(check.message);
  }
  return process.env.MONGODB_URI!.trim();
};

/**
 * Global is used here to maintain a cached connection across hot reloads
 * in development and serverless function invocations in production (e.g. Vercel).
 */
interface MongooseCache {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
}

declare global {
  // eslint-disable-next-line no-var
  var mongooseCache: MongooseCache | undefined;
}

let cached: MongooseCache = global.mongooseCache || { conn: null, promise: null };

if (!global.mongooseCache) {
  global.mongooseCache = cached;
}

/**
 * Connects to MongoDB Atlas using a cached connection suitable for serverless / Next.js.
 */
export async function connectToDatabase(): Promise<typeof mongoose> {
  // If already connected and active, return cached connection
  if (cached.conn && mongoose.connection.readyState === 1) {
    return cached.conn;
  }

  if (!cached.promise) {
    const uri = getMongoURI();
    const opts: mongoose.ConnectOptions = {
      bufferCommands: false,
      serverSelectionTimeoutMS: 10000,
      connectTimeoutMS: 10000,
      socketTimeoutMS: 45000,
    };

    cached.promise = mongoose.connect(uri, opts).then((m) => {
      return m;
    });
  }

  try {
    cached.conn = await cached.promise;
  } catch (e: any) {
    cached.promise = null;
    cached.conn = null;
    const cleanError = sanitizeMongoError(e);
    console.error('Database connection error:', cleanError);
    throw new Error(cleanError);
  }

  return cached.conn;
}

/**
 * Safe database status helper that returns connection health without exposing secrets.
 */
export function getDatabaseStatus(): {
  isConfigured: boolean;
  isConnected: boolean;
  message: string;
  databaseName?: string;
} {
  const configCheck = checkMongoConfig();
  if (!configCheck.configured) {
    return {
      isConfigured: false,
      isConnected: false,
      message: configCheck.message || 'Database connection string is not configured.'
    };
  }

  const state = mongoose.connection.readyState;
  const stateMap: Record<number, string> = {
    0: 'disconnected',
    1: 'connected',
    2: 'connecting',
    3: 'disconnecting'
  };

  const isConnected = state === 1;
  return {
    isConfigured: true,
    isConnected,
    message: isConnected ? 'Connected to MongoDB Atlas' : `Database state: ${stateMap[state] || 'unknown'}`,
    databaseName: isConnected ? mongoose.connection.name : undefined
  };
}

export default connectToDatabase;
