// Resend email API client (HTTPS, so it works on hosts that block outbound SMTP). The only way this backend sends email.
// Settings come only from backend environment variables (never sent to the frontend, never logged):
//   RESEND_API_KEY     Resend API key (resend.com → API Keys)
//   RESEND_FROM_EMAIL  sender address on a domain verified in Resend, e.g. "noreply@dexathon.in"
//                      (or "Name <address>"; a bare address is sent as "DEXATHON 2026 <address>")
const SEND_URL = "https://api.resend.com/emails";
const DOMAINS_URL = "https://api.resend.com/domains";
const SENDER_NAME = "DEXATHON 2026";

const isEmail = (value) => /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(String(value || "").trim());
const apiKey = () => (process.env.RESEND_API_KEY || "").trim();
const fromSetting = () => (process.env.RESEND_FROM_EMAIL || "").trim();
export const resendConfigured = () => Boolean(apiKey() && fromSetting());
// The bare sender address, whether RESEND_FROM_EMAIL is "a@b.c" or "Name <a@b.c>".
export const resendFromAddress = () => (fromSetting().match(/<([^>]+)>/)?.[1] || fromSetting()).trim();
const fromHeader = () => (/<[^>]+>/.test(fromSetting()) ? fromSetting() : `${SENDER_NAME} <${fromSetting()}>`);

const resendError = (message, status = null, code = "ERESEND", name = null) => Object.assign(new Error(message), { code, responseCode: status, resendName: name });

export const assertResendConfigured = () => {
  if (!apiKey()) throw resendError("Resend is not configured. Set RESEND_API_KEY in the backend environment.", null, "ERESENDCONFIG");
  if (!isEmail(resendFromAddress())) throw resendError("Resend is not configured. Set RESEND_FROM_EMAIL to a sender address on a domain verified in Resend.", null, "ERESENDCONFIG");
};

const request = async (url, options, timeoutMs) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, headers: { Authorization: `Bearer ${apiKey()}`, "Content-Type": "application/json", ...(options.headers || {}) }, signal: controller.signal });
  } catch (error) {
    throw resendError(`Could not reach Resend: ${error.name === "AbortError" ? "timed out" : error.cause?.code || error.message}`, null, "ETIMEDOUT");
  } finally {
    clearTimeout(timer);
  }
};

// Resend error bodies look like { statusCode: 403, name: "validation_error", message: "..." }.
const readError = async (response) => {
  const body = await response.json().catch(() => ({}));
  return { name: body.name || null, message: body.message || response.statusText || `HTTP ${response.status}` };
};

// Checks the API key and, when the key may read domains, that RESEND_FROM_EMAIL's domain is verified.
export const verifyResend = async () => {
  assertResendConfigured();
  const response = await request(DOMAINS_URL, { method: "GET" }, 15_000);
  if (!response.ok) {
    const { name, message } = await readError(response);
    // A "sending access" key cannot list domains but is valid for sending.
    if (name === "restricted_api_key") return { domainChecked: false };
    throw resendError(`Resend rejected the request (HTTP ${response.status}): ${message}`, response.status, "ERESEND", name);
  }
  const domains = (await response.json().catch(() => ({}))).data || [];
  const domain = resendFromAddress().split("@")[1]?.toLowerCase();
  if (domain === "resend.dev") return { domainChecked: true, testingSender: true };
  const match = domains.find((entry) => String(entry.name).toLowerCase() === domain);
  if (!match) throw resendError(`The sender domain ${domain} is not added in Resend (Resend → Domains).`, 403, "ERESENDDOMAIN");
  if (match.status !== "verified") throw resendError(`The sender domain ${domain} is not verified in Resend yet (status: ${match.status}).`, 403, "ERESENDDOMAIN");
  return { domainChecked: true };
};

// Sends one email. Resolves only when Resend accepted it (HTTP 2xx) and returns Resend's email ID.
export const sendWithResend = async ({ to, subject, html, text }) => {
  assertResendConfigured();
  const payload = { from: fromHeader(), to: [to], subject, ...(html ? { html } : {}), ...(text ? { text } : {}) };
  const response = await request(SEND_URL, { method: "POST", body: JSON.stringify(payload) }, 30_000);
  if (!response.ok) {
    const { name, message } = await readError(response);
    throw resendError(`Resend rejected the email (HTTP ${response.status}): ${message}`, response.status, "ERESEND", name);
  }
  const data = await response.json().catch(() => ({}));
  return { messageId: data.id || null, status: response.status };
};
