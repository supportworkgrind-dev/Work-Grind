import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config();

import mongoose from 'mongoose';
import User from '../models/User';
import { createWorkGrindUser } from '../services/callingId';
import Company from '../models/Company';
import { connectDB } from '../utils/db';

async function makeSuperAdmin() {
  const targetEmail = (process.argv[2] || 'admin@workgrind.app').toLowerCase().trim();
  const passwordToSet = process.argv[3] || 'SuperAdmin2024!Secure';

  console.log(`🔐 Designating Super Admin account for: ${targetEmail}...`);

  await connectDB();

  let user = await User.findOne({ email: targetEmail });

  if (user) {
    user.isSuperAdmin = true;
    user.isActive = true;
    if (process.argv[3]) {
      user.password = passwordToSet;
    }
    await user.save();
    console.log(`✅ Existing user "${user.fullName}" (${user.email}) has been promoted to SUPER ADMIN!`);
  } else {
    // Create master super admin company and account
    let masterCompany = await Company.findOne({ name: 'WorkGrind Headquarters' });
    if (!masterCompany) {
      masterCompany = await Company.create({
        name: 'WorkGrind Headquarters',
        industry: 'Technology',
        size: '1-10',
        country: 'Pakistan',
        timeZone: 'Asia/Karachi',
        inviteCode: 'WG-MASTER-HQ',
        plan: 'pro',
        ownerId: new mongoose.Types.ObjectId(),
      });
    }

    const createdUser = await createWorkGrindUser({
      fullName: 'Platform Super Administrator',
      email: targetEmail,
      password: passwordToSet,
      jobTitle: 'Chief Platform Administrator',
      department: 'Executive Operations',
      companyId: masterCompany._id,
      role: 'owner',
      isSuperAdmin: true,
      isVerified: true,
      isActive: true,
    });
    user = await User.findById(createdUser._id);
    if (!user) throw new Error('Super admin user could not be loaded after creation.');

    masterCompany.ownerId = user._id;
    await masterCompany.save();

    console.log(`✅ Master Super Admin created successfully!`);
    console.log(`   Email:    ${targetEmail}`);
    console.log(`   Password: ${passwordToSet}`);
  }

  process.exit(0);
}

makeSuperAdmin().catch((err) => {
  console.error('❌ Error setting Super Admin:', err);
  process.exit(1);
});
