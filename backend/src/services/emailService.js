// Central email service. Every transactional email is sent through the Resend API (HTTPS) from this backend.
// There is no other provider: the browser never sends email and never sees the Resend API key.
import { buildPaymentConfirmationEmail, POSTER_CID } from "../templates/paymentConfirmationEmail.js";
import { buildSelectionEmail } from "../templates/resultEmail.js";
import { buildRoundResultEmail } from "../templates/roundResultEmail.js";
import { buildRoundUpdateEmail } from "../templates/roundUpdateEmail.js";
import { getTeamLoginUrl, getTeamPortalPassword } from "./submissionService.js";
import { resendConfigured, resendFromAddress, sendWithResend, verifyResend } from "./resendTransport.js";

// Team Head Portal login details included in team emails (the email address itself comes from each team record).
const portalAccess = () => ({ loginUrl: getTeamLoginUrl(), password: getTeamPortalPassword() });

export const emailProvider = () => "resend";

// The poster is loaded from a public URL in the email (override with EMAIL_POSTER_URL).
const DEFAULT_POSTER_URL = "https://raw.githubusercontent.com/Sudhar6424/sathyabama-website/main/backend/src/assets/dexathon-2026-poster.jpg";
const posterUrl = () => (process.env.EMAIL_POSTER_URL || "").trim() || DEFAULT_POSTER_URL;

// The recipient always comes from the team's registration record (Team Head email); never hardcoded.
const getRecipientEmail = (registration) => {
  const recipientEmail = registration?.leader?.email?.trim();
  if (!recipientEmail) throw Object.assign(new Error("The team leader email is missing from this registration."), { code: "ENORECIPIENT" });
  return recipientEmail;
};

// The one place that sends: logs start/success/failure (recipient, type, message ID only — never secrets).
// "Sent" means Resend accepted the email for delivery; inbox delivery is tracked in the Resend dashboard (Emails).
const sendEmail = async ({ type, to, subject, html, text }) => {
  console.log(`EMAIL_SEND_START type=${type} to=${to}`);
  try {
    const { messageId } = await sendWithResend({ to, subject, html, text });
    console.log(`EMAIL_SEND_SUCCESS type=${type} to=${to} messageId=${messageId || "n/a"}`);
    return { sent: true, messageId };
  } catch (error) {
    console.error(`EMAIL_SEND_FAILED type=${type} to=${to} code=${error.code || "-"} status=${error.responseCode ?? "-"} resendError=${error.resendName || "-"} reason="${describeEmailError(error)}"`);
    throw error;
  }
};

// Payment confirmation (admin verified the payment). Resolves { sent, messageId } only after Resend accepted it.
export const sendPaymentConfirmationEmail = async (registration) => {
  const to = getRecipientEmail(registration);
  const { html, text } = buildPaymentConfirmationEmail(registration, { portal: portalAccess() });
  return sendEmail({
    type: "payment-confirmation",
    to,
    subject: "DEXATHON 2026 — Payment Confirmed ✓",
    html: html.split(`cid:${POSTER_CID}`).join(posterUrl()),
    text,
  });
};
export const sendPaymentConfirmation = sendPaymentConfirmationEmail;
export const resendConfirmationEmail = sendPaymentConfirmationEmail;

// Plain registration receipt (Razorpay payment flow).
export const sendConfirmationEmail = async (registration) => {
  const to = getRecipientEmail(registration);
  const result = await sendEmail({
    type: "registration-receipt",
    to,
    subject: "DEXATHON 2026 Registration Confirmation",
    text: `DEXATHON 2026 Registration Successful\n\nTeam Name: ${registration.teamName}\nTeam ID: ${registration.teamId}\nRegistration Number: ${registration.registrationNumber}\nAmount Paid: ₹${registration.payment.amount}\nTransaction ID: ${registration.payment.transactionId}\nPayment Status: ${registration.payment.status}\nUPI ID: ${registration.payment.upiId || "Razorpay"}\nRegistration Date: ${registration.createdAt.toLocaleDateString()}`,
  });
  return result.sent;
};

// Second-round selection after the Round 1 PDF evaluation. Returns true only when Resend accepted it.
export const sendSelectionEmail = async (registration) => {
  const to = getRecipientEmail(registration);
  const { subject, html, text } = buildSelectionEmail(registration);
  return (await sendEmail({ type: "round2-selection", to, subject, html, text })).sent;
};

// Round progress update. Returns true only when Resend accepted it.
export const sendRoundUpdateEmail = async (registration, rounds) => {
  const to = getRecipientEmail(registration);
  const { subject, html, text } = buildRoundUpdateEmail(registration, rounds, portalAccess());
  return (await sendEmail({ type: "round-update", to, subject, html, text })).sent;
};

// Round result (SELECTED / REJECTED for one round). Returns true only when Resend accepted it.
export const sendRoundResultEmail = async (registration, round, decision) => {
  const to = getRecipientEmail(registration);
  const { subject, html, text } = buildRoundResultEmail(registration, round, decision, portalAccess());
  return (await sendEmail({ type: `round${round}-${String(decision).toLowerCase()}`, to, subject, html, text })).sent;
};
export const sendRound1SelectionEmail = (registration) => sendRoundResultEmail(registration, 1, "SELECTED");
export const sendRound2SelectionEmail = (registration) => sendRoundResultEmail(registration, 2, "SELECTED");
export const sendRejectionEmail = (registration, round) => sendRoundResultEmail(registration, round, "REJECTED");

// Admin test email (POST /api/admin/test-email).
export const sendTestEmail = async (to) => sendEmail({
  type: "admin-test",
  to,
  subject: "DEXATHON 2026 — Email delivery test",
  html: `<div style="font-family:Arial,sans-serif;font-size:15px;color:#16171b"><h2 style="margin:0 0 8px">DEXATHON 2026</h2><p>This is a test email sent by the DEXATHON backend through the Resend API.</p><p>If you received it, payment confirmation emails can be delivered.</p></div>`,
  text: "DEXATHON 2026\n\nThis is a test email sent by the DEXATHON backend through the Resend API.\nIf you received it, payment confirmation emails can be delivered.",
});

// Plain-language reason for a failed send, safe to show to admins (never includes the API key).
export const describeEmailError = (error) => {
  const code = error?.code || "";
  const status = Number(error?.responseCode) || 0;
  const name = error?.resendName || "";
  const text = String(error?.message || "");
  const detail = text.replace(/^Resend rejected the email \(HTTP \d+\): /, "");
  if (code === "ENORECIPIENT") return "This team has no Team Head email address.";
  if (code === "ERESENDCONFIG") return /RESEND_FROM_EMAIL/.test(text)
    ? "Resend is not configured: set RESEND_FROM_EMAIL to a sender address on a domain verified in Resend."
    : "Resend is not configured: set RESEND_API_KEY in the backend environment (Render → Environment).";
  if (code === "ERESENDDOMAIN") return `${text} Resend only sends from verified domains.`;
  if (code === "ETIMEDOUT") return "Could not reach the Resend API. Check the server's internet connection and try again.";
  if (status === 401 || name === "missing_api_key" || name === "invalid_api_key") return "Resend rejected the API key (RESEND_API_KEY). Create a new key in Resend → API Keys.";
  if (/only send testing emails to your own email/i.test(text)) return "Resend is in testing mode: without a verified domain it only delivers to the Resend account's own email. Verify your domain in Resend → Domains and set RESEND_FROM_EMAIL to an address on it.";
  if (/domain is not verified/i.test(text)) return "Resend rejected the sender (RESEND_FROM_EMAIL): its domain is not verified. Verify it in Resend → Domains.";
  if (status === 403) return `Resend refused the email: ${detail}`;
  if (status === 422 && /\bto\b|recipient/i.test(text)) return "Resend rejected the recipient email address. Check the Team Head email.";
  if (status === 422 || status === 400) return `Resend rejected the email: ${detail}`;
  if (status === 429) return "Resend rate limit or daily quota reached. Please try again later.";
  if (status >= 500) return "Resend had a temporary server error. Please try again.";
  return "The email could not be sent. Please try again.";
};

// Startup check: which Resend settings are present (names only, never the values).
export const logEmailConfiguration = () => {
  const state = (value) => (value && String(value).trim() ? "configured" : "MISSING");
  console.log("Email provider: Resend API (https://api.resend.com)");
  console.log(`  RESEND_API_KEY: ${state(process.env.RESEND_API_KEY)}`);
  console.log(`  RESEND_FROM_EMAIL: ${state(process.env.RESEND_FROM_EMAIL)}${resendFromAddress() ? ` (domain ${resendFromAddress().split("@")[1] || "?"})` : ""}`);
  if (!resendConfigured()) console.error("Resend is not fully configured. Set RESEND_API_KEY and RESEND_FROM_EMAIL. Emails will fail until they are set.");
};

export const verifyEmailTransport = async () => {
  try {
    const check = await verifyResend();
    console.log(`Email ready (Resend API)${check.testingSender ? " — resend.dev testing sender: only the Resend account's own email can receive" : ""}`);
    return { ok: true, provider: emailProvider(), ...(check.testingSender ? { warning: "RESEND_FROM_EMAIL uses resend.dev, which only delivers to the Resend account's own email. Verify a domain for team emails." } : {}) };
  } catch (error) {
    console.error(`Email check failed (Resend): ${error.code || ""} ${error.responseCode || ""} ${describeEmailError(error)}`);
    return { ok: false, provider: emailProvider(), code: error.code || null, reason: describeEmailError(error) };
  }
};

// Cached health check for the admin panel (a real Resend API call, at most once a minute).
let emailHealth = { checkedAt: 0, result: null };
export const getEmailHealth = async () => {
  if (emailHealth.result && Date.now() - emailHealth.checkedAt < 60_000) return emailHealth.result;
  const result = await verifyEmailTransport();
  emailHealth = { checkedAt: Date.now(), result };
  return result;
};
export const resetEmailHealth = () => { emailHealth = { checkedAt: 0, result: null }; };
// A real send just succeeded, so email is healthy right now.
export const markEmailHealthy = () => { emailHealth = { checkedAt: Date.now(), result: { ok: true, provider: emailProvider() } }; };
