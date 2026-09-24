import { NextRequest } from 'next/server';
import connectToDatabase from '@/lib/mongodb';
import { getAuthenticatedUser } from '@/lib/auth';
import { apiSuccess, apiError } from '@/lib/response';

export async function GET(req: NextRequest) {
  try {
    const { user, errorResponse } = await getAuthenticatedUser(req);
    if (!user) {
      return apiError(errorResponse?.message || 'Unauthorized', errorResponse?.status || 401);
    }
    if (user.role !== 'Admin') {
      return apiError('Access forbidden. Required role: Admin', 403);
    }

    const mongoose = await connectToDatabase();
    const db = mongoose.connection.db;
    if (!db) {
      return apiError('Database connection not established', 500);
    }

    // 1. Retrieve real live MongoDB database statistics
    const stats: any = await db.command({ dbStats: 1 });

    // 2. Storage metrics
    const limitMB = parseFloat(process.env.MONGODB_STORAGE_LIMIT_MB || '512');
    const storageSizeBytes = stats.storageSize || stats.dataSize || 0;
    const storageUsedMB = Math.round((storageSizeBytes / (1024 * 1024)) * 100) / 100;
    const dataSizeMB = Math.round(((stats.dataSize || 0) / (1024 * 1024)) * 100) / 100;
    const indexSizeMB = Math.round(((stats.indexSize || 0) / (1024 * 1024)) * 100) / 100;

    const usagePercentage = Math.min(100, Math.round((storageUsedMB / limitMB) * 1000) / 10);
    const remainingStorageMB = Math.max(0, Math.round((limitMB - storageUsedMB) * 100) / 100);

    // 3. Status threshold calculation
    let healthStatus: 'Healthy' | 'Warning' | 'High Usage' | 'Critical' = 'Healthy';
    if (usagePercentage >= 95) {
      healthStatus = 'Critical';
    } else if (usagePercentage >= 85) {
      healthStatus = 'High Usage';
    } else if (usagePercentage >= 70) {
      healthStatus = 'Warning';
    }

    // 4. Collection-level statistics
    const collectionsList = await db.listCollections().toArray();
    const collectionBreakdown: any[] = [];

    for (const col of collectionsList) {
      try {
        const count = await db.collection(col.name).countDocuments();
        let collStats: any = null;
        try {
          collStats = await db.command({ collStats: col.name });
        } catch (e) {
          // collStats might not be permitted in all environments; fallback gracefully
        }

        const sizeKB = collStats?.size ? Math.round((collStats.size / 1024) * 10) / 10 : 0;
        const storageKB = collStats?.storageSize ? Math.round((collStats.storageSize / 1024) * 10) / 10 : 0;
        const totalIndexKB = collStats?.totalIndexSize ? Math.round((collStats.totalIndexSize / 1024) * 10) / 10 : 0;

        collectionBreakdown.push({
          name: col.name,
          count,
          sizeKB,
          storageKB,
          totalIndexKB
        });
      } catch (colErr) {
        collectionBreakdown.push({
          name: col.name,
          count: 0,
          sizeKB: 0,
          storageKB: 0,
          totalIndexKB: 0
        });
      }
    }

    // Sort collections by count descending
    collectionBreakdown.sort((a, b) => b.count - a.count);

    return apiSuccess({
      databaseName: mongoose.connection.name,
      status: healthStatus,
      storageUsedMB,
      storageLimitMB: limitMB,
      usagePercentage,
      remainingStorageMB,
      databaseSizeBytes: stats.dataSize || 0,
      dataSizeMB,
      storageSizeBytes,
      indexSizeMB,
      collectionsCount: stats.collections || collectionBreakdown.length,
      objectsCount: stats.objects || 0,
      avgObjSizeBytes: stats.avgObjSize ? Math.round(stats.avgObjSize) : 0,
      collections: collectionBreakdown,
      lastUpdated: new Date().toISOString(),
      note: 'Live database statistics measured directly from MongoDB via dbStats. Cluster quota based on Atlas M0 512 MB tier.'
    }, 'Database monitoring statistics retrieved successfully');
  } catch (err: any) {
    return apiError(err.message, 500);
  }
}
