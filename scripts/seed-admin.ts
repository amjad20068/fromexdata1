import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

interface IUserDoc {
  name: string;
  username: string;
  email?: string;
  password_hash: string;
  role: string;
  status: string;
}

async function seedAdmin() {
  const uri = process.env.MONGODB_URI?.trim();
  if (!uri || uri === '<MY_MONGODB_ATLAS_CONNECTION_STRING>' || uri.startsWith('<') || (!uri.startsWith('mongodb://') && !uri.startsWith('mongodb+srv://'))) {
    console.error('❌ MONGODB_URI is not defined or is still set to placeholder in .env.local.');
    console.error('   Please define MONGODB_URI with your actual MongoDB Atlas connection string:');
    console.error('   MONGODB_URI="mongodb+srv://<username>:<password>@<cluster>.mongodb.net/fromex?retryWrites=true&w=majority"');
    process.exit(1);
  }

  const defaultEmail = process.env.DEFAULT_ADMIN_EMAIL || 'admin@fromex.com';
  const defaultPassword = process.env.DEFAULT_ADMIN_PASSWORD || 'fromex123';
  const defaultUsername = (process.env.DEFAULT_ADMIN_USERNAME || 'fromex').toLowerCase().trim();
  const defaultName = process.env.DEFAULT_ADMIN_NAME || 'FROMEX System Admin';

  console.log('Connecting to MongoDB Atlas...');
  await mongoose.connect(uri);

  const UserSchema = new mongoose.Schema<IUserDoc>(
    {
      name: { type: String, required: true },
      username: { type: String, required: true, unique: true, lowercase: true, trim: true },
      email: { type: String, sparse: true, lowercase: true, trim: true },
      password_hash: { type: String, required: true },
      role: { type: String, enum: ['Admin', 'Manager', 'Staff'], default: 'Staff' },
      status: { type: String, enum: ['Active', 'Disabled'], default: 'Active' }
    },
    { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } }
  );

  const User = mongoose.models.User || mongoose.model<IUserDoc>('User', UserSchema);

  // 1. Idempotently ensure default admin exists
  const existingDefaultAdmin = await User.findOne({
    $or: [{ username: defaultUsername }, { email: defaultEmail }]
  } as any);

  if (!existingDefaultAdmin) {
    const passwordHash = await bcrypt.hash(defaultPassword, 10);
    const newAdmin = await User.create({
      name: defaultName,
      username: defaultUsername,
      email: defaultEmail,
      password_hash: passwordHash,
      role: 'Admin',
      status: 'Active'
    });
    console.log(`✅ Default admin successfully created:`);
    console.log(`   - Name: ${newAdmin.name}`);
    console.log(`   - Username: ${newAdmin.username}`);
    console.log(`   - Email: ${newAdmin.email}`);
    console.log(`   - Role: ${newAdmin.role}`);
  } else {
    console.log(`ℹ️ Default admin already exists: "${existingDefaultAdmin.username}" (${existingDefaultAdmin.role}) - Idempotent check passed.`);
  }

  // 2. Also ensure standard company users exist for role workflows
  const standardUsers = [
    { name: 'Vikram Malhotra', username: 'admin', email: 'vikram@fromex.com', role: 'Admin', status: 'Active' },
    { name: 'Pooja Sharma', username: 'manager', email: 'pooja@fromex.com', role: 'Manager', status: 'Active' },
    { name: 'Rohan Verma', username: 'staff', email: 'rohan@fromex.com', role: 'Staff', status: 'Active' }
  ];

  for (const u of standardUsers) {
    const exists = await User.findOne({ username: u.username } as any);
    if (!exists) {
      const passwordHash = await bcrypt.hash('fromex123', 10);
      await User.create({
        name: u.name,
        username: u.username,
        email: u.email,
        password_hash: passwordHash,
        role: u.role,
        status: u.status
      });
      console.log(`✅ Initialized standard user: "${u.username}" (${u.role})`);
    }
  }

  console.log('✨ Admin seed process completed successfully.');
  await mongoose.disconnect();
}

seedAdmin().catch(err => {
  console.error('Fatal seed error:', err);
  process.exit(1);
});
