import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IAccountingTransaction extends Document {
  transaction_date: string; // YYYY-MM-DD
  transaction_type: 'Income' | 'Expense' | 'Salary' | 'Other';
  description: string;
  party: string;
  employee_id?: mongoose.Types.ObjectId | string;
  income: number;
  expense: number;
  remarks: string;
  created_by?: mongoose.Types.ObjectId | string;
  updated_by?: string;
  created_at: Date;
  updated_at: Date;
}

const AccountingTransactionSchema = new Schema<IAttendingTransaction>(
  {
    transaction_date: { type: String, required: true, index: true },
    transaction_type: {
      type: String,
      enum: ['Income', 'Expense', 'Salary', 'Other'],
      required: true,
      index: true
    },
    description: { type: String, required: true, trim: true },
    party: { type: String, default: 'Corporate Party', trim: true },
    employee_id: { type: Schema.Types.Mixed, ref: 'Employee' },
    income: { type: Number, default: 0 },
    expense: { type: Number, default: 0 },
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

AccountingTransactionSchema.set('toJSON', {
  virtuals: true,
  transform: (_doc, ret: any) => {
    ret.id = ret._id ? ret._id.toString() : ret.id;
    ret.date = ret.transaction_date;
    ret.type = ret.transaction_type;
    delete ret._id;
    delete ret.__v;
    return ret;
  }
});

type IAttendingTransaction = IAccountingTransaction;

const AccountingTransaction: Model<IAccountingTransaction> =
  mongoose.models.AccountingTransaction ||
  mongoose.model<IAccountingTransaction>('AccountingTransaction', AccountingTransactionSchema);

export default AccountingTransaction;
