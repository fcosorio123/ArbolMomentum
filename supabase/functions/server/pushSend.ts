// ──────────────────────────────────────────────
// Web Push — subscription storage + send (Supabase Edge)
// Requires VAPID_PUBLIC_KEY + VAPID_PRIVATE_KEY in function secrets.
// ──────────────────────────────────────────────

import * as kv from "./kv_store.tsx";
import webpush from "npm:web-push";

const SUB_PREFIX = "arbol-push-sub";

export interface PushSubscriptionRecord {
  profileId: string;
  subscription: PushSubscriptionJSON;
  tzOffset: number;
  updatedAt: number;
}

function subKey(profileId: string) {
  return `${SUB_PREFIX}-${profileId}`;
}

function getVapidKeys(): { publicKey: string; privateKey: string; subject: string } | null {
  const publicKey = Deno.env.get("VAPID_PUBLIC_KEY")?.trim() ?? "";
  const privateKey = Deno.env.get("VAPID_PRIVATE_KEY")?.trim() ?? "";
  const subject = Deno.env.get("VAPID_SUBJECT")?.trim() || "mailto:admin@arbolumomentum.app";
  if (!publicKey || !privateKey) return null;
  return { publicKey, privateKey, subject };
}

export async function savePushSubscription(
  profileId: string,
  subscription: PushSubscriptionJSON,
  tzOffset: number,
): Promise<void> {
  const record: PushSubscriptionRecord = {
    profileId,
    subscription,
    tzOffset,
    updatedAt: Date.now(),
  };
  await kv.set(subKey(profileId), record);
}

export async function getPushSubscription(profileId: string): Promise<PushSubscriptionRecord | null> {
  return (await kv.get(subKey(profileId))) as PushSubscriptionRecord | null;
}

export async function sendPushToProfile(
  profileId: string,
  payload: { title: string; body: string; tag: string; badgeCount?: number; url?: string },
): Promise<{ ok: boolean; reason?: string }> {
  const keys = getVapidKeys();
  if (!keys) return { ok: false, reason: "vapid_not_configured" };

  const record = await getPushSubscription(profileId);
  if (!record?.subscription) return { ok: false, reason: "no_subscription" };

  webpush.setVapidDetails(keys.subject, keys.publicKey, keys.privateKey);

  try {
    await webpush.sendNotification(
      record.subscription as webpush.PushSubscription,
      JSON.stringify({
        title: payload.title,
        body: payload.body,
        tag: payload.tag,
        badgeCount: payload.badgeCount ?? 0,
        url: payload.url ?? "/",
      }),
    );
    return { ok: true };
  } catch (err) {
    console.log(`[Push] send failed for ${profileId}:`, err);
    const status = (err as { statusCode?: number })?.statusCode;
    if (status === 404 || status === 410) {
      await kv.del(subKey(profileId));
      return { ok: false, reason: "subscription_expired" };
    }
    return { ok: false, reason: String(err) };
  }
}

/** Hour in user's local timezone (0–23) */
export function localHourForProfile(tzOffset: number): number {
  const now = new Date();
  const utcMs = now.getTime() + now.getTimezoneOffset() * 60_000;
  const userMs = utcMs - tzOffset * 60_000;
  return new Date(userMs).getUTCHours();
}

export interface PushNudgeSlot {
  tag: string;
  hour: number;
  title: string;
  body: string;
}

const PUSH_SLOTS: PushNudgeSlot[] = [
  {
    tag: "daily-morning",
    hour: 8,
    title: "Good morning! ☀️",
    body: "Check your key financial tasks for today — FAFSA, TAP, and payments.",
  },
  {
    tag: "daily-midday",
    hour: 13,
    title: "Quick check-in 📋",
    body: "How are your aid and scholarship tasks progressing?",
  },
  {
    tag: "daily-evening",
    hour: 19,
    title: "Evening summary 🎓",
    body: "Review your college funding progress for today.",
  },
];

function firedKey(profileId: string, dateKey: string, tag: string) {
  return `arbol-push-sent-${profileId}-${dateKey}-${tag}`;
}

async function wasPushSentToday(profileId: string, tag: string, dateKey: string): Promise<boolean> {
  return !!(await kv.get(firedKey(profileId, dateKey, tag)));
}

async function markPushSentToday(profileId: string, tag: string, dateKey: string): Promise<void> {
  await kv.set(firedKey(profileId, dateKey, tag), { at: Date.now() });
}

function todayKey(): string {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

/** Cron-friendly: send due push nudges for one profile (deduped per day) */
export async function runPushNudgesForProfile(profileId: string): Promise<{ sent: string[]; skipped: string[] }> {
  const record = await getPushSubscription(profileId);
  if (!record) return { sent: [], skipped: ["no_subscription"] };

  const hour = localHourForProfile(record.tzOffset);
  const dateKey = todayKey();
  const sent: string[] = [];
  const skipped: string[] = [];

  for (const slot of PUSH_SLOTS) {
    if (hour !== slot.hour) {
      skipped.push(`${slot.tag}:wrong_hour`);
      continue;
    }
    if (await wasPushSentToday(profileId, slot.tag, dateKey)) {
      skipped.push(`${slot.tag}:already_sent`);
      continue;
    }
    const result = await sendPushToProfile(profileId, {
      title: slot.title,
      body: slot.body,
      tag: slot.tag,
    });
    if (result.ok) {
      await markPushSentToday(profileId, slot.tag, dateKey);
      sent.push(slot.tag);
    } else {
      skipped.push(`${slot.tag}:${result.reason}`);
    }
  }

  return { sent, skipped };
}
