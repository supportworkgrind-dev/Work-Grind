import 'dotenv/config';
import { checkRedisHealth, closeRedisClient, getRedisClient } from '../config/redis';

async function run(): Promise<void> {
  const client = getRedisClient();
  try {
    const health = await checkRedisHealth(client);
    console.log(JSON.stringify(health));
    if (health.status !== 'connected' || health.ping !== 'PONG') {
      process.exitCode = 1;
    }
  } finally {
    await closeRedisClient();
  }
}

void run().catch((error: unknown) => {
  console.error('[Redis check] Diagnostic failed.', {
    errorName: error instanceof Error ? error.name : 'UnknownError',
  });
  process.exitCode = 1;
});
