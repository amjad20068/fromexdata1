import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IUser extends Document {
  name: string;
  username: string;
  email?: string;
  password_hash: string;
  role: 'Admin' | 'Manager' | 'Staff';
  status: 'Active' | 'Disabled';
  created_at: Date;
  updated_at: Date;
}

const UserSchema = new Schema<IUser>(
  {
    name: { type: String, required: true, trim: true },
    username: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
    email: { type: String, sparse: true, lowercase: true, trim: true },
    password_hash: { type: String, required: true },
    role: { type: String, enum: ['Admin', 'Manager', 'Staff'], default: 'Staff', required: true },
    status: { type: String, enum: ['Active', 'Disabled'], default: 'Active', required: true, index: true },
    created_at: { type: Date, default: Date.now },
    updated_at: { type: Date, default: Date.now }
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
  }
);

// Format output to return id as string
UserSchema.set('toJSON', {
  virtuals: true,
  transform: (_doc, ret: any) => {
    ret.id = ret._id ? ret._id.toString() : ret.id;
    delete ret._id;
    delete ret.__v;
    delete ret.password_hash;
    return ret;
  }
});

if (mongoose.models.User && !mongoose.models.User.schema.paths.email) {
  delete (mongoose.models as any).User;
}

const User: Model<IUser> = mongoose.models.User || mongoose.model<IUser>('User', UserSchema);

export default User;
