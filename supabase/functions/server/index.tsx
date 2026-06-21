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
const app = new Hono();

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
app.get("/make-server-5d90ddf5/health", (c) => {
  return c.json({ status: "ok" });
});

// Save a full profile backup
app.post("/make-server-5d90ddf5/backup/:profileId", async (c) => {
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
app.get("/make-server-5d90ddf5/backup/:profileId", async (c) => {
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
app.get("/make-server-5d90ddf5/app-settings", async (c) => {
  try {
    const data = await kv.get("arbol-app-settings");
    if (!data) return c.json({ ok: true, data: null });
    return c.json({ ok: true, data });
  } catch (err) {
    console.log("[AppSettings] Error fetching settings:", err);
    return c.json({ error: String(err) }, 500);
  }
});

app.post("/make-server-5d90ddf5/app-settings", async (c) => {
  try {
    const payload = await c.req.json();
    await kv.set("arbol-app-settings", payload);
    return c.json({ ok: true });
  } catch (err) {
    console.log("[AppSettings] Error saving settings:", err);
    return c.json({ error: String(err) }, 500);
  }
});

// Email notification settings
app.get("/make-server-5d90ddf5/email-settings", async (c) => {
  try {
    const data = await getEmailSettings();
    return c.json({ ok: true, data });
  } catch (err) {
    console.log("[EmailSettings] Error fetching settings:", err);
    return c.json({ error: String(err) }, 500);
  }
});

app.post("/make-server-5d90ddf5/email-settings", async (c) => {
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
app.post("/make-server-5d90ddf5/send-email", async (c) => {
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
app.post("/make-server-5d90ddf5/send-test-email", async (c) => {
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

// V2 stub - requires external cron
app.post("/make-server-5d90ddf5/run-daily-email-nudges", async (c) => {
  return c.json({
    ok: false,
    reason: "requires_cron",
    message: "Scheduled daily email nudges require V2 cron integration.",
  });
});

Deno.serve(app.fetch);
