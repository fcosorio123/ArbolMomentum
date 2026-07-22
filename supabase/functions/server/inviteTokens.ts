/**
 * Account invite tokens — opaque links that open a specific profile.
 * Stored in KV; welcome emails embed the invite URL.
 */

import * as kv from "./kv_store.tsx";
import { getEmailConfig } from "./resend.ts";

const TOKEN_PREFIX = "arbol-invite-token-";
const ACTIVE_PREFIX = "arbol-invite-active-";
const INVITE_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

export interface InviteRecord {
  profileId: string;
  email: string;
  createdAt: number;
  expiresAt: number;
  /** Optional display name for redeem UX */
  profileName?: string;
}

function tokenKey(token: string): string {
  return `${TOKEN_PREFIX}${token}`;
}

function activeKey(profileId: string): string {
  return `${ACTIVE_PREFIX}${profileId}`;
}

function randomToken(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

/** Build invite deep-link for email CTAs. */
export function buildInviteUrl(token: string): string {
  const base = getEmailConfig().appBaseUrl.replace(/\/$/, "");
  return `${base}/?invite=${encodeURIComponent(token)}`;
}

/**
 * Issue a new invite for a profile. Invalidates any previous active invite.
 */
export async function mintInviteToken(opts: {
  profileId: string;
  email: string;
  profileName?: string;
}): Promise<{ token: string; url: string; expiresAt: number }> {
  const profileId = opts.profileId.trim();
  const email = opts.email.trim().toLowerCase();
  if (!profileId || !email) {
    throw new Error("invite_missing_profile_or_email");
  }

  const prev = await kv.get(activeKey(profileId));
  if (typeof prev === "string" && prev) {
    try {
      await kv.del(tokenKey(prev));
    } catch {
      /* ignore */
    }
  }

  const token = randomToken();
  const now = Date.now();
  const record: InviteRecord = {
    profileId,
    email,
    profileName: opts.profileName?.trim() || undefined,
    createdAt: now,
    expiresAt: now + INVITE_TTL_MS,
  };
  await kv.set(tokenKey(token), record);
  await kv.set(activeKey(profileId), token);
  return { token, url: buildInviteUrl(token), expiresAt: record.expiresAt };
}

export async function redeemInviteToken(token: string): Promise<{
  ok: boolean;
  reason?: string;
  profileId?: string;
  profileName?: string;
  email?: string;
}> {
  const cleaned = String(token ?? "").trim();
  if (!cleaned || cleaned.length < 16) {
    return { ok: false, reason: "invalid_token" };
  }
  const raw = await kv.get(tokenKey(cleaned));
  if (!raw || typeof raw !== "object") {
    return { ok: false, reason: "not_found" };
  }
  const record = raw as InviteRecord;
  if (!record.profileId || !record.expiresAt) {
    return { ok: false, reason: "malformed" };
  }
  if (Date.now() > record.expiresAt) {
    return { ok: false, reason: "expired" };
  }

  // Prefer freshest name from backup when available
  let profileName = record.profileName;
  try {
    const backup = await kv.get(`arbol-backup-${record.profileId}`);
    if (backup && typeof backup === "object") {
      const b = backup as Record<string, unknown>;
      const meta = b.profileMeta as { name?: string } | undefined;
      if (meta?.name) profileName = meta.name;
      else if (typeof b.profileName === "string") profileName = b.profileName;
    }
  } catch {
    /* ignore */
  }

  return {
    ok: true,
    profileId: record.profileId,
    profileName,
    email: record.email,
  };
}
