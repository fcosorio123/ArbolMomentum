// ── Email templates (plain, product-appropriate) ────────────────────

import { getEmailConfig } from "./resend.ts";

export type EmailType =
  | "welcome"
  | "smart_nudge"
  | "task_completion"
  | "check_in_confirmation"
  | "task_created"
  | "goal_updated"
  | "profile_archived"
  | "test";

export interface TemplateContext {
  profileName?: string;
  firstName?: string;
  tag?: string;
  title?: string;
  body?: string;
  taskLabel?: string;
  pendingCount?: number;
  streak?: number;
  topTasks?: Array<{ label: string; goalTitle?: string }>;
  /** Deep-link that opens the recipient's account (welcome / invite). */
  inviteUrl?: string;
  /** Opaque notification instance id (no PII). */
  nid?: string;
  /** Stable CTA id. */
  cta?: string;
}

function appLink(): string {
  return getEmailConfig().appBaseUrl;
}

/** Append ?checkin=1 (or &checkin=1) so CTAs open the check-in workflow. */
function withCheckIn(href: string): string {
  try {
    const url = new URL(href);
    url.searchParams.set("checkin", "1");
    return url.toString();
  } catch {
    return href.includes("?") ? `${href}&checkin=1` : `${href.replace(/\/?$/, "/")}?checkin=1`;
  }
}

/** Append opaque nid + cta (+ optional dest) — never PII. */
export function withAttribution(
  href: string,
  opts: { nid?: string; cta?: string; dest?: string },
): string {
  if (!opts.nid) return href;
  try {
    const url = new URL(href);
    url.searchParams.set("nid", opts.nid);
    if (opts.cta) url.searchParams.set("cta", opts.cta);
    if (opts.dest) url.searchParams.set("dest", opts.dest);
    return url.toString();
  } catch {
    const parts = [`nid=${encodeURIComponent(opts.nid)}`];
    if (opts.cta) parts.push(`cta=${encodeURIComponent(opts.cta)}`);
    if (opts.dest) parts.push(`dest=${encodeURIComponent(opts.dest)}`);
    return href.includes("?") ? `${href}&${parts.join("&")}` : `${href.replace(/\/?$/, "/")}?${parts.join("&")}`;
  }
}

function ctaHtml(label = "Open Arbol Momentum", href?: string): string {
  const url = href || appLink();
  return `<p style="margin:24px 0;"><a href="${url}" style="background:#094067;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;">${label}</a></p>`;
}

function wrapHtml(content: string): string {
  return `<!DOCTYPE html><html><body style="font-family:system-ui,sans-serif;color:#094067;line-height:1.5;max-width:560px;margin:0 auto;padding:24px;">${content}<p style="color:#888;font-size:12px;margin-top:32px;">Arbol Momentum - build daily habits, one task at a time.</p></body></html>`;
}

function mintFallbackNid(): string {
  return `n_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
}

export function buildEmailContent(
  type: EmailType,
  ctx: TemplateContext,
): { subject: string; html: string; text: string; nid: string; cta: string } {
  const name = ctx.firstName || ctx.profileName?.split(" ")[0] || "there";
  const link = ctx.inviteUrl || appLink();
  const nid = ctx.nid || mintFallbackNid();
  const checkInCta = ctx.cta || "cta.open_checkin";
  const checkInLink = withAttribution(withCheckIn(link), {
    nid,
    cta: checkInCta,
    dest: "checkin",
  });
  const openAppLink = withAttribution(link, { nid, cta: "cta.open_app", dest: "home" });
  const tasksLink = withAttribution(link, { nid, cta: "cta.open_tasks", dest: "tasks" });
  const goalsLink = withAttribution(link, { nid, cta: "cta.open_goals", dest: "goals" });
  const dashLink = withAttribution(link, { nid, cta: "cta.open_dashboard", dest: "dashboard" });

  switch (type) {
    case "welcome":
      return {
        subject: "You're invited to Arbol Momentum",
        html: wrapHtml(`
          <h2 style="margin:0 0 12px;">Welcome, ${name}!</h2>
          <p>Your Arbol Momentum account is ready. Use the button below to open <strong>your</strong> account and start today's check-in.</p>
          <p style="color:#555;font-size:13px;">This personal link works for 30 days. If it expires, ask your admin to resend your invite.</p>
          ${ctaHtml("Access your account", checkInLink)}
        `),
        text: `Welcome, ${name}! Your Arbol Momentum account is ready. Access your account: ${checkInLink}`,
        nid,
        cta: checkInCta,
      };

    case "smart_nudge": {
      const subject = ctx.title || "Time for your daily momentum";
      const body = ctx.body || "You have tasks waiting. A little progress goes a long way.";
      const taskList = (ctx.topTasks ?? [])
        .map((t) => `<li>${t.goalTitle ? `${t.label} <em>(${t.goalTitle})</em>` : t.label}</li>`)
        .join("");
      const taskHtml = taskList ? `<ul style="margin:12px 0;padding-left:20px;">${taskList}</ul>` : "";
      const taskText = (ctx.topTasks ?? [])
        .map((t) => (t.goalTitle ? `• ${t.label} (${t.goalTitle})` : `• ${t.label}`))
        .join("\n");
      return {
        subject,
        html: wrapHtml(`
          <h2 style="margin:0 0 12px;">${subject}</h2>
          <p style="white-space:pre-line;">${body}</p>
          ${taskHtml}
          ${ctx.streak && ctx.streak > 0 ? `<p style="margin-top:12px;">🔥 Current streak: <strong>${ctx.streak} day${ctx.streak === 1 ? "" : "s"}</strong></p>` : ""}
          ${ctaHtml("Open today's check-in", checkInLink)}
        `),
        text: `${subject}\n\n${body}${taskText ? `\n\n${taskText}` : ""}${ctx.streak ? `\n\nStreak: ${ctx.streak} days` : ""}\n\nOpen today's check-in: ${checkInLink}`,
        nid,
        cta: checkInCta,
      };
    }

    case "task_completion":
      return {
        subject: ctx.taskLabel ? `Done: ${ctx.taskLabel}` : "Task completed",
        html: wrapHtml(`
          <h2 style="margin:0 0 12px;">Nice work, ${name}!</h2>
          <p>${ctx.taskLabel ? `You completed <strong>${ctx.taskLabel}</strong>.` : "You completed a task."} Keep the streak going.</p>
          ${ctaHtml("See what's next", openAppLink)}
        `),
        text: `Nice work, ${name}! ${ctx.taskLabel ? `You completed ${ctx.taskLabel}.` : "You completed a task."} Open the app: ${openAppLink}`,
        nid,
        cta: "cta.open_app",
      };

    case "check_in_confirmation":
      return {
        subject: "Check-in complete",
        html: wrapHtml(`
          <h2 style="margin:0 0 12px;">Check-in done, ${name}!</h2>
          <p>Thanks for updating your progress today. Consistency is how momentum builds.</p>
          ${ctaHtml("Back to your dashboard", dashLink)}
        `),
        text: `Check-in done, ${name}! Thanks for updating your progress today. Open the app: ${dashLink}`,
        nid,
        cta: "cta.open_dashboard",
      };

    case "task_created":
      return {
        subject: ctx.taskLabel ? `New task: ${ctx.taskLabel}` : "New task assigned",
        html: wrapHtml(`
          <h2 style="margin:0 0 12px;">New task for you, ${name}</h2>
          <p>${ctx.taskLabel ? `<strong>${ctx.taskLabel}</strong> was added to your list.` : "A new task was added to your list."}</p>
          ${ctaHtml("View tasks", tasksLink)}
        `),
        text: `New task for you, ${name}. ${ctx.taskLabel ?? "A new task was added."} Open the app: ${tasksLink}`,
        nid,
        cta: "cta.open_tasks",
      };

    case "goal_updated":
      return {
        subject: ctx.title ? `Goal update: ${ctx.title}` : "Goal progress updated",
        html: wrapHtml(`
          <h2 style="margin:0 0 12px;">Goal progress, ${name}</h2>
          <p>${ctx.body || (ctx.title ? `Your goal "${ctx.title}" was updated.` : "A goal was materially updated.")}</p>
          ${ctaHtml("View goals", goalsLink)}
        `),
        text: `Goal progress, ${name}. ${ctx.body || ctx.title || "Goal updated."} Open the app: ${goalsLink}`,
        nid,
        cta: "cta.open_goals",
      };

    case "profile_archived":
      return {
        subject: "Profile archived",
        html: wrapHtml(`
          <h2 style="margin:0 0 12px;">Profile archived</h2>
          <p>${ctx.profileName ? `The profile for <strong>${ctx.profileName}</strong> has been archived.` : "A profile has been archived."} Historical data is preserved.</p>
        `),
        text: `Profile archived. ${ctx.profileName ?? ""}`,
        nid,
        cta: "cta.open_app",
      };

    case "test":
      return {
        subject: "Arbol Momentum - test email",
        html: wrapHtml(`
          <h2 style="margin:0 0 12px;">Test email</h2>
          <p>This is a test message from the Arbol Momentum admin settings. Email delivery is working.</p>
          ${ctaHtml("Open app", checkInLink)}
        `),
        text: `This is a test message from Arbol Momentum admin settings. Open the app: ${checkInLink}`,
        nid,
        cta: checkInCta,
      };

    default:
      return {
        subject: "Arbol Momentum",
        html: wrapHtml(`<p>Hello from Arbol Momentum.</p>${ctaHtml("Open app", openAppLink)}`),
        text: `Hello from Arbol Momentum. Open the app: ${openAppLink}`,
        nid,
        cta: "cta.open_app",
      };
  }
}
