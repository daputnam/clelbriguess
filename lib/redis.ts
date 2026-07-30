import { createClient, type RedisClientType } from "redis";

let client: RedisClientType | undefined;
let connecting: Promise<RedisClientType> | undefined;

async function connect(url: string): Promise<RedisClientType> {
  const c: RedisClientType = createClient({ url });
  c.on("error", (err) => console.error("[redis] client error", err));
  await c.connect();
  return c;
}

// Returns null (rather than throwing) when REDIS_URL isn't configured, so the
// app keeps working locally/without sync until a Redis store is linked.
// Reuses a single connection across warm serverless invocations.
export async function getRedis(): Promise<RedisClientType | null> {
  const url = process.env.REDIS_URL;
  if (!url) return null;

  if (client?.isOpen) return client;
  if (!connecting) connecting = connect(url);
  client = await connecting;
  return client;
}
