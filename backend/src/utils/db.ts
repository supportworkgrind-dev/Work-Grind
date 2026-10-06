import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';

// Ensure .env is loaded regardless of invocation directory
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config();

// Track whether the DB URI had a placeholder (set by connectDB in db.ts)
let _dbConfigMissing = false;
export function setDbConfigMissing() { _dbConfigMissing = true; }
export function isDbConfigMissing() { return _dbConfigMissing; }

export const connectDB = async (): Promise<typeof mongoose | null> => {
  if (mongoose.connection.readyState === 1) {
    return mongoose;
  }

  const uri = process.env.MONGODB_URI?.trim();

  if (!uri) {
    console.warn('⚠️ MONGODB_URI not set — running without database. Set it in C:\\workgrind\\backend\\.env to enable all features.');
    return null;
  }

  // Detect unreplaced Atlas credential placeholders
  const hasUsernamePlaceholder = uri.includes('<db_username>') || uri.includes('<user>') || uri.includes('<username>');
  const hasPasswordPlaceholder = uri.includes('<db_password>') || uri.includes('<password>');

  if (hasUsernamePlaceholder || hasPasswordPlaceholder) {
    console.error('❌ =====================================================================');
    console.error('❌  MONGODB CANNOT CONNECT — placeholder value in MONGODB_URI');
    if (hasUsernamePlaceholder) {
      console.error('❌  "<db_username>" was never replaced with your actual Atlas username.');
      console.error('❌  Steps:');
      console.error('❌    1. Open MongoDB Atlas → Database Access → Database Users');
      console.error('❌    2. Copy the username of your database user');
      console.error('❌    3. Replace <db_username> in backend/.env with that value');
      console.error('❌  Example: mongodb+srv://workgrinduser:password@cluster/workgrind');
    }
    if (hasPasswordPlaceholder) {
      console.error('❌  "<db_password>" was never replaced with your actual Atlas password.');
    }
    console.error('❌ =====================================================================');
    // Signal so all subsequent API requests get an immediate 503
    _dbConfigMissing = true;
    // Return null immediately instead of letting Mongoose hang for 10 seconds
    return null;
  }

  const connectOptions: mongoose.ConnectOptions = {
    // Connection pool
    maxPoolSize: process.env.VERCEL === '1' ? 10 : 20,
    minPoolSize: process.env.VERCEL === '1' ? 0 : 5,
    // Timeout tuning — reduced from 10 s to 8 s so failures are reported
    // before Mongoose's own 10 s buffer timeout fires.
    serverSelectionTimeoutMS: 8000,
    connectTimeoutMS:         8000,
    socketTimeoutMS:          45000,
    heartbeatFrequencyMS:     10000,
    // Force IPv4 — on Windows, IPv6 DNS resolution for Atlas adds 2-3 s
    family: 4,
    autoIndex: true,
  };

  try {
    const conn = await mongoose.connect(uri, connectOptions);
    const host = conn.connection.host || 'MongoDB Atlas Cluster';
    console.log(`✅ MongoDB connected successfully to: ${host}`);

    // Log disconnect/reconnect events so they're visible in server logs
    mongoose.connection.on('disconnected', () => {
      console.warn('⚠️ MongoDB disconnected. Mongoose will attempt to reconnect automatically.');
    });
    mongoose.connection.on('reconnected', () => {
      console.log('✅ MongoDB reconnected successfully.');
    });
    mongoose.connection.on('error', (err) => {
      console.error('❌ MongoDB connection error:', err.message);
    });

    return conn;
  } catch (error: any) {
    // If Windows DNS resolver hits Node c-ares SRV packet limit (EBADRESP), fall back to direct replica set
    if (error.message?.includes('EBADRESP') || error.message?.includes('querySrv')) {
      const match = uri.match(/mongodb\+srv:\/\/([^:]+):([^@]+)@/);
      if (match) {
        const user = match[1];
        const pass = match[2];
        // Fallback direct connection for WorkGrind Atlas cluster (vdsc1pr) when Windows SRV DNS fails.
        // Shard hostnames and replicaSet name verified via direct connection testing.
        // - Shards:      ac-ano8sun-shard-00-0x.vdsc1pr.mongodb.net:27017
        // - ReplicaSet:  atlas-oejv72-shard-0
        const dbName = (() => { try { const u = new URL(uri); return u.pathname.replace('/', '') || 'workgrind'; } catch { return 'workgrind'; } })();
        const directUri = `mongodb://${user}:${pass}@ac-ano8sun-shard-00-00.vdsc1pr.mongodb.net:27017,ac-ano8sun-shard-00-01.vdsc1pr.mongodb.net:27017,ac-ano8sun-shard-00-02.vdsc1pr.mongodb.net:27017/${dbName}?ssl=true&replicaSet=atlas-oejv72-shard-0&authSource=admin&retryWrites=true&w=majority`;
        console.log('🔄 Notice: Windows SRV DNS resolution failed; falling back to direct Atlas replica set connection...');
        const conn = await mongoose.connect(directUri, connectOptions);
        const host = conn.connection.host || 'MongoDB Atlas Direct ReplicaSet';
        console.log(`✅ MongoDB connected successfully to: ${host}`);

        mongoose.connection.on('disconnected', () => {
          console.warn('⚠️ MongoDB disconnected. Mongoose will attempt to reconnect automatically.');
        });
        mongoose.connection.on('reconnected', () => {
          console.log('✅ MongoDB reconnected successfully.');
        });
        mongoose.connection.on('error', (err) => {
          console.error('❌ MongoDB connection error:', err.message);
        });

        return conn;
      }
    }
    const errorName = error instanceof Error ? error.name : 'UnknownError';
    console.error('❌ MongoDB connection failed.', { errorName });
    throw error;
  }
};
