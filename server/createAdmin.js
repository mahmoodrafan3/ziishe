// Create, repair or reset the admin account. Admin credentials live in
// MongoDB (bcrypt hash) — .env is not involved at all.
//
//   npm run create-admin                                  # default email, new password
//   npm run create-admin -- --email=admin@ziishe.com --password='MyStrongPass123'
//
// The password is only printed when it was generated here; store it somewhere
// safe, because only the hash is kept in the database.
import dotenv from 'dotenv';
dotenv.config();

import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import connectDB from './config/db.js';
import User from './models/User.js';
import { resolveAdminCredentials } from './utils/adminAccount.js';

const run = async () => {
  let credentials;
  try {
    credentials = resolveAdminCredentials();
  } catch (err) {
    console.error(`❌ ${err.message}`);
    process.exit(1);
  }
  const { email, password, generated } = credentials;

  await connectDB();
  if (mongoose.connection.readyState !== 1) {
    console.error('❌ Not connected to MongoDB — check MONGO_URI.');
    process.exit(1);
  }

  const existing = await User.findOne({ email });
  if (existing) {
    // Re-running restores a broken admin (forgotten password, lost flag)
    // without touching products, orders, coupons or customers.
    existing.password = password;
    existing.isAdmin = true;
    await existing.save();
    console.log(`✅ Admin updated in MongoDB: ${email}`);
  } else {
    await User.create({
      name: process.env.ADMIN_NAME || 'ZiiShe Admin',
      email,
      password,
      isAdmin: true,
    });
    console.log(`✅ Admin created in MongoDB: ${email}`);
  }

  // Prove the password actually landed: re-read the stored hash and compare.
  // Without this a mangled shell argument (globs, history expansion, unquoted
  // spaces) silently saves a password nobody knows, locking the admin out.
  const saved = await User.findOne({ email }).select('+password');
  const ok = saved && (await bcrypt.compare(password, saved.password));
  if (!ok) {
    console.error('❌ Password verification failed — the stored hash does not match.');
    mongoose.connection.close();
    process.exit(1);
  }
  console.log('✅ Password verified against the stored hash.');

  if (generated) {
    console.log('');
    console.log(`   Email:    ${email}`);
    console.log(`   Password: ${password}`);
    console.log('');
    console.log('   This password is shown once — save it now and sign in at /admin/login.');
  } else {
    console.log('🔐 Sign in at /admin/login with that password.');
    if (/[!*?$`&|;<>()\[\]{}\\"'^#]/.test(password)) {
      console.log('   ⚠️  It contains shell characters — quote it when passing it again:');
      console.log("      --password='your password here'");
    }
  }

  mongoose.connection.close();
};

run().catch((err) => {
  console.error('❌ Could not create admin:', err?.message || err);
  mongoose.connection.close();
  process.exit(1);
});
