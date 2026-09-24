import mongoose from 'mongoose';

const getMongoURI = () => {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error('Please define the MONGODB_URI environment variable inside .env.local');
  }
  return uri;
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

export async function connectToDatabase(): Promise<typeof mongoose> {
  if (cached.conn) {
    return cached.conn;
  }

  if (!cached.promise) {
    const opts = {
      bufferCommands: false,
      serverSelectionTimeoutMS: 10000,
    };

    cached.promise = mongoose.connect(getMongoURI(), opts).then((m) => {
      return m;
    });
  }

  try {
    cached.conn = await cached.promise;
  } catch (e) {
    cached.promise = null;
    throw e;
  }

  return cached.conn;
}

export default connectToDatabase;
