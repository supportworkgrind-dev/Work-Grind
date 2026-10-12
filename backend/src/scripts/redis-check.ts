import 'dotenv/config';
import { checkRedisHealth, getRedisClient } from '../config/redis';

async function run(): Promise<void> {
  const client = getRedisClient();
  try {
    const health = await checkRedisHealth(client);
    console.log(JSON.stringify(health));
    if (health.status !== 'connected' || health.ping !== 'PONG') {
      process.exitCode = 1;
    }
  } finally {
    client?.disconnect();
  }
}

void run().catch((error: unknown) => {
  console.error('[Redis check] Diagnostic failed.', {
    errorName: error instanceof Error ? error.name : 'UnknownError',
  });
  process.exitCode = 1;
});
