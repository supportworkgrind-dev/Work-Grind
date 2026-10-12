
import Redis from "ioredis";

const url = process.env.REDIS_URL;

export const redis = url
  ? new Redis(url, {
      lazyConnect: true,
      maxRetriesPerRequest: 1,
      connectTimeout: 5000,
    })
  : null;