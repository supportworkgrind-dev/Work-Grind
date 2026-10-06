const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
require('dotenv').config();

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const USER_EMAIL = 'moez524628@gmail.com'.toLowerCase().trim();
const USER_PASSWORD = process.env.ADMIN_INITIAL_PASSWORD || 'Rana@6639';
const USER_NAME = 'Moez Admin';

async function createOrPromoteAdmin() {
  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) {
    console.error('❌ MONGODB_URI not found in environment variables.');
    process.exit(1);
  }

  console.log('Connecting to MongoDB...');
  await mongoose.connect(mongoUri);
  console.log('✅ Connected to MongoDB.');

  const db = mongoose.connection.db;
  const usersCollection = db.collection('users');
  const companiesCollection = db.collection('companies');

  // Check if user already exists
  const existingUser = await usersCollection.findOne({ email: USER_EMAIL });

  if (existingUser) {
    if (existingUser.isSuperAdmin === true && existingUser.isActive === true) {
      console.log(`ℹ️ Safety Check: User "${USER_EMAIL}" is ALREADY an active Super Admin.`);
      console.log('   Skipping creation to prevent accidental overwrites.');
      await mongoose.disconnect();
      process.exit(0);
    }

    // Existing user exists, promote to super admin without altering password
    await usersCollection.updateOne(
      { _id: existingUser._id },
      {
        $set: {
          isSuperAdmin: true,
          isActive: true,
          updatedAt: new Date(),
        },
      }
    );

    console.log(`✅ Admin account updated successfully!`);
    console.log(`   User "${existingUser.fullName || USER_EMAIL}" has been promoted to Super Admin.`);
  } else {
    // New user: find or create master workspace
    let masterCompany = await companiesCollection.findOne({ name: 'WorkGrind Headquarters' });
    if (!masterCompany) {
      const companyInsert = await companiesCollection.insertOne({
        name: 'WorkGrind Headquarters',
        industry: 'Technology',
        size: '1-10',
        country: 'Pakistan',
        timeZone: 'Asia/Karachi',
        inviteCode: 'WG-MASTER-' + Date.now().toString(36).toUpperCase(),
        plan: 'enterprise',
        storage: { used: 0, limit: 53687091200 },
        settings: { allowGuestAccess: true, defaultRole: 'admin' },
        accountType: 'company',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      masterCompany = { _id: companyInsert.insertedId };
    }

    // Hash password with bcrypt (cost factor 10)
    const hashedPassword = await bcrypt.hash(USER_PASSWORD, 10);

    const newUser = {
      fullName: USER_NAME,
      email: USER_EMAIL,
      password: hashedPassword,
      jobTitle: 'Platform Administrator',
      department: 'Executive Operations',
      companyId: masterCompany._id,
      role: 'owner',
      status: 'offline',
      isVerified: true,
      isActive: true,
      accountType: 'company',
      isSuperAdmin: true,
      skills: ['Platform Operations', 'Administration'],
      timeZone: 'Asia/Karachi',
      refreshTokens: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const result = await usersCollection.insertOne(newUser);

    // Update company owner
    await companiesCollection.updateOne(
      { _id: masterCompany._id },
      { $set: { ownerId: result.insertedId } }
    );

    console.log(`✅ Admin account created successfully!`);
    console.log(`   Email: ${USER_EMAIL}`);
    console.log(`   Super Admin Status: ACTIVE`);
  }

  await mongoose.disconnect();
  console.log('Database connection closed.');
  process.exit(0);
}

createOrPromoteAdmin().catch((err) => {
  console.error('❌ Error executing admin script:', err);
  process.exit(1);
});
