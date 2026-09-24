import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

async function seed() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('❌ MONGODB_URI not found in environment.');
    process.exit(1);
  }

  await mongoose.connect(uri);
  const UserSchema = new mongoose.Schema({
    name: String,
    username: { type: String, unique: true },
    password_hash: String,
    role: String,
    status: String,
    created_at: { type: Date, default: Date.now },
    updated_at: { type: Date, default: Date.now }
  });

  const User = mongoose.models.User || mongoose.model('User', UserSchema);

  const initialUsers = [
    { name: 'FROMEX', username: 'fromex', role: 'Admin', status: 'Active' },
    { name: 'Vikram Malhotra', username: 'admin', role: 'Admin', status: 'Active' },
    { name: 'Pooja Sharma', username: 'manager', role: 'Manager', status: 'Active' },
    { name: 'Rohan Verma', username: 'staff', role: 'Staff', status: 'Active' }
  ];

  for (const u of initialUsers) {
    const exists = await User.findOne({ username: u.username });
    if (!exists) {
      const password_hash = await bcrypt.hash('fromex123', 10);
      await User.create({
        name: u.name,
        username: u.username,
        password_hash,
        role: u.role,
        status: u.status
      });
      console.log(`✅ Initialized company user: "${u.username}" (Role: ${u.role}, Password: fromex123)`);
    } else {
      console.log(`ℹ️  User "${u.username}" already exists.`);
    }
  }

  console.log('✨ MongoDB initialization & seed completed successfully.');
  await mongoose.disconnect();
}

seed().catch(err => {
  console.error('Seeding error:', err);
  process.exit(1);
});
