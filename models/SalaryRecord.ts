import mongoose, { Schema, Document, Model } from 'mongoose';

export interface ISalaryRecord extends Document {
  employee_id?: mongoose.Types.ObjectId | string;
  emp_id: string;
  emp_name: string;
  month: string; // e.g. "September 2026"
  basic_salary: number;
  allowance: number;
  deduction: number;
  net_salary: number;
  payment_date?: string;
  payment_status: 'Paid' | 'Pending' | 'Processing';
  remarks: string;
  created_by?: mongoose.Types.ObjectId | string;
  updated_by?: string;
  created_at: Date;
  updated_at: Date;
}

const SalaryRecordSchema = new Schema<ISalaryRecord>(
  {
    employee_id: { type: Schema.Types.Mixed, ref: 'Employee' },
    emp_id: { type: String, required: true, index: true },
    emp_name: { type: String, required: true },
    month: { type: String, required: true, index: true },
    basic_salary: { type: Number, default: 0 },
    allowance: { type: Number, default: 0 },
    deduction: { type: Number, default: 0 },
    net_salary: { type: Number, default: 0 },
    payment_date: { type: String, default: '' },
    payment_status: {
      type: String,
      enum: ['Paid', 'Pending', 'Processing'],
      default: 'Pending',
      index: true
    },
    remarks: { type: String, default: '' },
    created_by: { type: Schema.Types.Mixed, ref: 'User' },
    updated_by: { type: String, default: '' },
    created_at: { type: Date, default: Date.now },
    updated_at: { type: Date, default: Date.now }
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
  }
);

SalaryRecordSchema.set('toJSON', {
  virtuals: true,
  transform: (_doc, ret: any) => {
    ret.id = ret._id ? ret._id.toString() : ret.id;
    delete ret._id;
    delete ret.__v;
    return ret;
  }
});

const SalaryRecord: Model<ISalaryRecord> =
  mongoose.models.SalaryRecord || mongoose.model<ISalaryRecord>('SalaryRecord', SalaryRecordSchema);

export default SalaryRecord;
