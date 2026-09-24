import bcrypt from 'bcryptjs';
import connectToDatabase from './mongodb';
import User from '../models/User';

export async function ensureSeed() {
  await connectToDatabase();

  const initialUsers: Array<{
    name: string;
    username: string;
    role: 'Admin' | 'Manager' | 'Staff';
    status: 'Active' | 'Disabled';
  }> = [
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
      console.log(`✅ Seeded company user: "${u.username}" (${u.role})`);
    }
  }
}

export default ensureSeed;
