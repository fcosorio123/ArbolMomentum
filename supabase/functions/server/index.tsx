import { Hono } from "npm:hono";
import { cors } from "npm:hono/cors";
import { logger } from "npm:hono/logger";
import * as kv from "./kv_store.tsx";
import {
  getEmailSettings,
  saveEmailSettings,
  sendEmail,
  DEFAULT_EMAIL_SETTINGS,
} from "./emailSend.ts";
const app = new Hono().basePath("/make-server-5d90ddf5");

// Enable logger
app.use('*', logger(console.log));

// Enable CORS for all routes and methods
app.use(
  "/*",
  cors({
    origin: "*",
    allowHeaders: ["Content-Type", "Authorization"],
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    exposeHeaders: ["Content-Length"],
    maxAge: 600,
  }),
);

// Health check endpoint
app.get("/health", (c) => {
  return c.json({ status: "ok" });
});

// Save a full profile backup
app.post("/backup/:profileId", async (c) => {
  const profileId = c.req.param("profileId");
  try {
    const payload = await c.req.json();
    await kv.set(`arbol-backup-${profileId}`, payload);
    return c.json({ ok: true });
  } catch (err) {
    console.log(`[Backup] Error saving backup for ${profileId}:`, err);
    return c.json({ error: String(err) }, 500);
  }
});

// Fetch the latest profile backup
app.get("/backup/:profileId", async (c) => {
  const profileId = c.req.param("profileId");
  try {
    const data = await kv.get(`arbol-backup-${profileId}`);
    if (!data) return c.json({ ok: false, data: null });
    return c.json({ ok: true, data });
  } catch (err) {
    console.log(`[Backup] Error fetching backup for ${profileId}:`, err);
    return c.json({ error: String(err) }, 500);
  }
});


// Global app notification settings
app.get("/app-settings", async (c) => {
  try {
    const data = await kv.get("arbol-app-settings");
    if (!data) return c.json({ ok: true, data: null });
    return c.json({ ok: true, data });
  } catch (err) {
    console.log("[AppSettings] Error fetching settings:", err);
    return c.json({ error: String(err) }, 500);
  }
});

app.post("/app-settings", async (c) => {
  try {
    const payload = await c.req.json();
    await kv.set("arbol-app-settings", payload);
    return c.json({ ok: true });
  } catch (err) {
    console.log("[AppSettings] Error saving settings:", err);
    return c.json({ error: String(err) }, 500);
  }
});

// Live Check-In Feedback settings
app.get("/live-check-in-settings", async (c) => {
  try {
    const data = await kv.get("arbol-live-check-in-settings");
    if (!data) return c.json({ ok: true, data: null });
    return c.json({ ok: true, data });
  } catch (err) {
    console.log("[LiveCheckInSettings] Error fetching settings:", err);
    return c.json({ error: String(err) }, 500);
  }
});

app.post("/live-check-in-settings", async (c) => {
  try {
    const payload = await c.req.json();
    await kv.set("arbol-live-check-in-settings", payload);
    return c.json({ ok: true });
  } catch (err) {
    console.log("[LiveCheckInSettings] Error saving settings:", err);
    return c.json({ error: String(err) }, 500);
  }
});

// Email notification settings
app.get("/email-settings", async (c) => {
  try {
    const data = await getEmailSettings();
    return c.json({ ok: true, data });
  } catch (err) {
    console.log("[EmailSettings] Error fetching settings:", err);
    return c.json({ error: String(err) }, 500);
  }
});

app.post("/email-settings", async (c) => {
  try {
    const payload = await c.req.json();
    await saveEmailSettings({ ...DEFAULT_EMAIL_SETTINGS, ...payload, updatedAt: Date.now() });
    return c.json({ ok: true });
  } catch (err) {
    console.log("[EmailSettings] Error saving settings:", err);
    return c.json({ error: String(err) }, 500);
  }
});

// Send one email (client triggers + admin manual)
app.post("/send-email", async (c) => {
  try {
    const payload = await c.req.json();
    const result = await sendEmail(payload);
    return c.json(result);
  } catch (err) {
    console.log("[SendEmail] Error:", err);
    return c.json({ ok: false, reason: String(err) }, 500);
  }
});

// Admin test email
app.post("/send-test-email", async (c) => {
  try {
    const settings = await getEmailSettings();
    const body = await c.req.json().catch(() => ({}));
    const recipient = body?.recipient?.trim() || settings.testRecipient?.trim();
    if (!recipient) {
      return c.json({ ok: false, reason: "no_test_recipient" });
    }
    const result = await sendEmail({
      profileId: "admin-test",
      type: "test",
      recipient,
      force: true,
    });
    return c.json(result);
  } catch (err) {
    console.log("[SendTestEmail] Error:", err);
    return c.json({ ok: false, reason: String(err) }, 500);
  }
});

// Cron: scheduled email nudges for all profiles (Authorization: Bearer CRON_SECRET)
app.post("/run-daily-email-nudges", async (c) => {
  try {
    const secret = Deno.env.get("CRON_SECRET")?.trim();
    const auth = c.req.header("Authorization")?.replace(/^Bearer\s+/i, "");
    if (secret && auth !== secret) {
      return c.json({ ok: false, reason: "unauthorized" }, 401);
    }
    const { runScheduledEmailNudges } = await import("./emailNudgeCron.ts");
    const result = await runScheduledEmailNudges();
    return c.json(result);
  } catch (err) {
    console.log("[RunDailyEmailNudges] Error:", err);
    return c.json({ ok: false, reason: String(err) }, 500);
  }
});

// Web Push subscription registration
app.post("/register-push", async (c) => {
  try {
    const { profileId, subscription, tzOffset } = await c.req.json();
    if (!profileId || !subscription?.endpoint) {
      return c.json({ ok: false, reason: "invalid_payload" });
    }
    const { savePushSubscription } = await import("./pushSend.ts");
    await savePushSubscription(profileId, subscription, Number(tzOffset) || 0);
    return c.json({ ok: true });
  } catch (err) {
    console.log("[RegisterPush] Error:", err);
    return c.json({ ok: false, reason: String(err) }, 500);
  }
});

// Cron: run push nudges for a profile (Authorization: Bearer CRON_SECRET)
app.post("/run-push-nudges", async (c) => {
  try {
    const secret = Deno.env.get("CRON_SECRET")?.trim();
    const auth = c.req.header("Authorization")?.replace(/^Bearer\s+/i, "");
    if (secret && auth !== secret) {
      return c.json({ ok: false, reason: "unauthorized" }, 401);
    }
    const body = await c.req.json().catch(() => ({}));
    const profileId = body?.profileId?.trim();
    if (!profileId) {
      return c.json({ ok: false, reason: "profileId_required" }, 400);
    }
    const { runPushNudgesForProfile } = await import("./pushSend.ts");
    const result = await runPushNudgesForProfile(profileId);
    return c.json({ ok: true, ...result });
  } catch (err) {
    console.log("[RunPushNudges] Error:", err);
    return c.json({ ok: false, reason: String(err) }, 500);
  }
});

// VAPID public key for client subscribe (safe to expose)
app.get("/push-vapid-key", (c) => {
  const publicKey = Deno.env.get("VAPID_PUBLIC_KEY")?.trim() ?? "";
  return c.json({ ok: !!publicKey, publicKey });
});

Deno.serve(app.fetch);
