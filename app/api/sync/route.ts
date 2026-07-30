import { NextRequest, NextResponse } from "next/server";
import { getRedis } from "@/lib/redis";
import { generateSyncCode, normalizeSyncCode } from "@/lib/syncWords";
import type { Stats } from "@/lib/gameStats";

const KEY_PREFIX = "sync:";
// Abandoned codes expire rather than live forever; refreshed on every read/write.
const TTL_SECONDS = 400 * 24 * 60 * 60;
const MAX_CREATE_ATTEMPTS = 5;

function isStats(value: unknown): value is Stats {
  if (!value || typeof value !== "object") return false;
  const s = value as Record<string, unknown>;
  return (
    typeof s.played === "number" &&
    typeof s.wins === "number" &&
    typeof s.currentStreak === "number" &&
    typeof s.maxStreak === "number" &&
    (s.lastPlayedDate === null || typeof s.lastPlayedDate === "string") &&
    typeof s.history === "object" &&
    s.history !== null
  );
}

export async function GET(req: NextRequest) {
  const redis = await getRedis();
  if (!redis) {
    return NextResponse.json({ error: "sync unavailable" }, { status: 503 });
  }

  const rawCode = req.nextUrl.searchParams.get("code") ?? "";
  const code = normalizeSyncCode(rawCode);
  if (!code) {
    return NextResponse.json({ error: "invalid code" }, { status: 400 });
  }

  const key = KEY_PREFIX + code;
  const raw = await redis.get(key);
  if (!raw) {
    return NextResponse.json({ error: "code not found" }, { status: 404 });
  }

  await redis.expire(key, TTL_SECONDS);
  return NextResponse.json({ code, stats: JSON.parse(raw) as Stats });
}

export async function POST(req: NextRequest) {
  const redis = await getRedis();
  if (!redis) {
    return NextResponse.json({ error: "sync unavailable" }, { status: 503 });
  }

  const body = await req.json().catch(() => null);
  const stats = body?.stats;
  if (!isStats(stats)) {
    return NextResponse.json({ error: "invalid stats" }, { status: 400 });
  }

  for (let attempt = 0; attempt < MAX_CREATE_ATTEMPTS; attempt++) {
    const code = generateSyncCode();
    const key = KEY_PREFIX + code;
    // NX: only set if the key doesn't already exist, so we never clobber
    // another user's record on a random collision.
    const created = await redis.set(key, JSON.stringify(stats), {
      expiration: { type: "EX", value: TTL_SECONDS },
      condition: "NX",
    });
    if (created) {
      return NextResponse.json({ code, stats });
    }
  }

  return NextResponse.json({ error: "could not generate a unique code" }, { status: 500 });
}

export async function PUT(req: NextRequest) {
  const redis = await getRedis();
  if (!redis) {
    return NextResponse.json({ error: "sync unavailable" }, { status: 503 });
  }

  const body = await req.json().catch(() => null);
  const code = normalizeSyncCode(body?.code ?? "");
  const stats = body?.stats;
  if (!code) {
    return NextResponse.json({ error: "invalid code" }, { status: 400 });
  }
  if (!isStats(stats)) {
    return NextResponse.json({ error: "invalid stats" }, { status: 400 });
  }

  const key = KEY_PREFIX + code;
  const exists = await redis.exists(key);
  if (!exists) {
    return NextResponse.json({ error: "code not found" }, { status: 404 });
  }

  await redis.set(key, JSON.stringify(stats), { expiration: { type: "EX", value: TTL_SECONDS } });
  return NextResponse.json({ ok: true });
}
