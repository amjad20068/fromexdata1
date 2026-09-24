import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IAttendance extends Document {
  employee_id?: mongoose.Types.ObjectId | string;
  emp_id: string;
  emp_name: string;
  attendance_date: string; // YYYY-MM-DD
  day: string;
  check_in?: string;
  check_out?: string;
  status: 'Present' | 'Absent' | 'Half Day' | 'Leave';
  working_hours: number;
  remarks: string;
  created_by?: mongoose.Types.ObjectId | string;
  updated_by?: string;
  created_at: Date;
  updated_at: Date;
}

const AttendanceSchema = new Schema<IAttendance>(
  {
    employee_id: { type: Schema.Types.Mixed, ref: 'Employee' },
    emp_id: { type: String, required: true, index: true },
    emp_name: { type: String, required: true },
    attendance_date: { type: String, required: true, index: true },
    day: { type: String, default: '' },
    check_in: { type: String, default: '' },
    check_out: { type: String, default: '' },
    status: {
      type: String,
      enum: ['Present', 'Absent', 'Half Day', 'Leave'],
      default: 'Present',
      required: true,
      index: true
    },
    working_hours: { type: Number, default: 0 },
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

// Prevent duplicate attendance for the same employee on the same date
AttendanceSchema.index({ emp_id: 1, attendance_date: 1 }, { unique: true });

AttendanceSchema.set('toJSON', {
  virtuals: true,
  transform: (_doc, ret: any) => {
    ret.id = ret._id ? ret._id.toString() : ret.id;
    ret.date = ret.attendance_date;
    delete ret._id;
    delete ret.__v;
    return ret;
  }
});

const Attendance: Model<IAttendance> = mongoose.models.Attendance || mongoose.model<IAttendance>('Attendance', AttendanceSchema);

export default Attendance;
