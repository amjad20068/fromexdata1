import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IDataBackup extends Document {
  backup_type: string;
  description: string;
  cleared_by: string;
  records_count: number;
  snapshot_data: any;
  is_restored: boolean;
  created_at: Date;
  restored_at?: Date;
}

const DataBackupSchema = new Schema<IDataBackup>(
  {
    backup_type: { type: String, default: 'manual_clear' },
    description: { type: String, default: '' },
    cleared_by: { type: String, default: 'Administrator' },
    records_count: { type: Number, default: 0 },
    snapshot_data: { type: Schema.Types.Mixed, required: true },
    is_restored: { type: Boolean, default: false, index: true },
    created_at: { type: Date, default: Date.now, index: true },
    restored_at: { type: Date }
  }
);

DataBackupSchema.set('toJSON', {
  virtuals: true,
  transform: (_doc, ret: any) => {
    ret.id = ret._id ? ret._id.toString() : ret.id;
    delete ret._id;
    delete ret.__v;
    return ret;
  }
});

const DataBackup: Model<IDataBackup> =
  mongoose.models.DataBackup || mongoose.model<IDataBackup>('DataBackup', DataBackupSchema);

export default DataBackup;
