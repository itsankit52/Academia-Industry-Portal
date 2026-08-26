import mongoose from 'mongoose';

const TEST_MONGO_URI = process.env.TEST_MONGO_URI;

export async function connectTestDb(): Promise<void> {
  if (!TEST_MONGO_URI) throw new Error('TEST_MONGO_URI is not set');
  if (mongoose.connection.readyState === 1) return;
  await mongoose.connect(TEST_MONGO_URI);
}

export async function disconnectTestDb(): Promise<void> {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
}

export async function clearTestDb(): Promise<void> {
  const { db } = mongoose.connection;
  if (!db) return;
  const collections = await db.collections();
  await Promise.all(collections.map((c) => c.deleteMany({})));
}
