import 'dotenv/config';
import { checkRedisHealth } from '../config/redis';

async function run(): Promise<void> {
  const health = await checkRedisHealth();
  console.log(JSON.stringify(health));
  if (health.status !== 'connected' || health.ping !== 'PONG') {
    process.exitCode = 1;
  }
}

void run().catch((error: unknown) => {
  console.error('[Redis check] Diagnostic failed.', {
    errorName: error instanceof Error ? error.name : 'UnknownError',
  });
  process.exitCode = 1;
});
