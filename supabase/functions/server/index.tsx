import { Hono } from "npm:hono";
import { cors } from "npm:hono/cors";
import { logger } from "npm:hono/logger";
import * as kv from "./kv_store.tsx";
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

Deno.serve(app.fetch);