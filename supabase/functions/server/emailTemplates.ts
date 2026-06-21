// ── Email templates (plain, product-appropriate) ────────────────────

import { getEmailConfig } from "./resend.ts";

export type EmailType =
  | "welcome"
  | "smart_nudge"
  | "task_completion"
  | "check_in_confirmation"
  | "test";

export interface TemplateContext {
  profileName?: string;
  firstName?: string;
  tag?: string;
  title?: string;
  body?: string;
  taskLabel?: string;
  pendingCount?: number;
}

function appLink(): string {
  return getEmailConfig().appBaseUrl;
}

function ctaHtml(label = "Open Arbol Momentum"): string {
  const url = appLink();
  return `<p style="margin:24px 0;"><a href="${url}" style="background:#094067;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;">${label}</a></p>`;
}

function wrapHtml(content: string): string {
  return `<!DOCTYPE html><html><body style="font-family:system-ui,sans-serif;color:#094067;line-height:1.5;max-width:560px;margin:0 auto;padding:24px;">${content}<p style="color:#888;font-size:12px;margin-top:32px;">Arbol Momentum - build daily habits, one task at a time.</p></body></html>`;
}

export function buildEmailContent(
  type: EmailType,
  ctx: TemplateContext,
): { subject: string; html: string; text: string } {
  const name = ctx.firstName || ctx.profileName?.split(" ")[0] || "there";
  const link = appLink();

  switch (type) {
    case "welcome":
      return {
        subject: "Welcome to Arbol Momentum",
        html: wrapHtml(`
          <h2 style="margin:0 0 12px;">Welcome, ${name}!</h2>
          <p>You're set up to track habits, streaks, and daily tasks. Start with today's check-in to build momentum.</p>
          ${ctaHtml("Start your first check-in")}
        `),
        text: `Welcome, ${name}! You're set up to track habits, streaks, and daily tasks. Open the app: ${link}`,
      };

    case "smart_nudge": {
      const subject = ctx.title || "Time for your daily momentum";
      const body = ctx.body || "You have tasks waiting. A little progress goes a long way.";
      return {
        subject,
        html: wrapHtml(`
          <h2 style="margin:0 0 12px;">${subject}</h2>
          <p>${body}</p>
          ${ctaHtml("View today's tasks")}
        `),
        text: `${subject}\n\n${body}\n\nOpen the app: ${link}`,
      };
    }

    case "task_completion":
      return {
        subject: ctx.taskLabel ? `Done: ${ctx.taskLabel}` : "Task completed",
        html: wrapHtml(`
          <h2 style="margin:0 0 12px;">Nice work, ${name}!</h2>
          <p>${ctx.taskLabel ? `You completed <strong>${ctx.taskLabel}</strong>.` : "You completed a task."} Keep the streak going.</p>
          ${ctaHtml("See what's next")}
        `),
        text: `Nice work, ${name}! ${ctx.taskLabel ? `You completed ${ctx.taskLabel}.` : "You completed a task."} Open the app: ${link}`,
      };

    case "check_in_confirmation":
      return {
        subject: "Check-in complete",
        html: wrapHtml(`
          <h2 style="margin:0 0 12px;">Check-in done, ${name}!</h2>
          <p>Thanks for updating your progress today. Consistency is how momentum builds.</p>
          ${ctaHtml("Back to your dashboard")}
        `),
        text: `Check-in done, ${name}! Thanks for updating your progress today. Open the app: ${link}`,
      };

    case "test":
      return {
        subject: "Arbol Momentum - test email",
        html: wrapHtml(`
          <h2 style="margin:0 0 12px;">Test email</h2>
          <p>This is a test message from the Arbol Momentum admin settings. Email delivery is working.</p>
          ${ctaHtml("Open app")}
        `),
        text: `This is a test message from Arbol Momentum admin settings. Open the app: ${link}`,
      };

    default:
      return {
        subject: "Arbol Momentum",
        html: wrapHtml(`<p>Hello from Arbol Momentum.</p>${ctaHtml()}`),
        text: `Hello from Arbol Momentum. Open the app: ${link}`,
      };
  }
}
