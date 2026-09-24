import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IEmployee extends Document {
  employee_code: string;
  name: string;
  phone: string;
  designation: string;
  basic_salary: number;
  allowance: number;
  deduction: number;
  status: string;
  created_at: Date;
  updated_at: Date;
}

const EmployeeSchema = new Schema<IEmployee>(
  {
    employee_code: { type: String, required: true, unique: true, uppercase: true, trim: true, index: true },
    name: { type: String, required: true, trim: true, index: true },
    phone: { type: String, default: '', trim: true },
    designation: { type: String, required: true, trim: true },
    basic_salary: { type: Number, default: 0 },
    allowance: { type: Number, default: 0 },
    deduction: { type: Number, default: 0 },
    status: { type: String, default: 'Active', index: true },
    created_at: { type: Date, default: Date.now },
    updated_at: { type: Date, default: Date.now }
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
  }
);

EmployeeSchema.set('toJSON', {
  virtuals: true,
  transform: (_doc, ret: any) => {
    ret.id = ret._id ? ret._id.toString() : ret.id;
    delete ret._id;
    delete ret.__v;
    return ret;
  }
});

const Employee: Model<IEmployee> = mongoose.models.Employee || mongoose.model<IEmployee>('Employee', EmployeeSchema);

export default Employee;
