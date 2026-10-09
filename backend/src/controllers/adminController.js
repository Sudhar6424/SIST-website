import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import Admin from "../models/Admin.js";
import Registration from "../models/Registration.js";
import { adminProfile } from "../services/adminAccess.js";
import { describeEmailError, emailProvider, getEmailHealth, markEmailHealthy, resetEmailHealth, sendPaymentConfirmationEmail, sendTestEmail } from "../services/emailService.js";

export const login = async (request, response) => {
  const username = typeof request.body.username === "string" ? request.body.username.trim() : "";
  const password = typeof request.body.password === "string" ? request.body.password : "";
  const admin = username ? await Admin.findOne({ username }) : null;
  if (!admin || admin.active === false || !(await bcrypt.compare(password, admin.passwordHash))) {
    return response.status(401).json({ success: false, message: "Invalid username or password" });
  }
  Admin.updateOne({ _id: admin._id }, { $set: { lastLoginAt: new Date() } }).catch(() => {});
  const profile = adminProfile(admin);
  return response.json({ success: true, token: jwt.sign({ id: admin.id, username: admin.username, role: profile.role }, process.env.JWT_SECRET, { expiresIn: "8h" }), admin: profile });
};

export const getMe = (request, response) => response.json({ admin: adminProfile({ _id: request.admin.id, ...request.admin }) });

// ---------- Admin lists: computed in MongoDB, paginated, and never carrying the (large) team logos ----------

const escapeRegex = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const searchFilter = (search, fields) => {
  const term = typeof search === "string" ? search.trim().slice(0, 100) : "";
  if (!term) return {};
  const pattern = new RegExp(escapeRegex(term), "i");
  return { $or: fields.map((field) => ({ [field]: pattern })) };
};
const pageParams = (query, defaultLimit = 20) => {
  const limit = Math.min(Math.max(Number.parseInt(query.limit, 10) || defaultLimit, 1), 100);
  const page = Math.max(Number.parseInt(query.page, 10) || 1, 1);
  return { page, limit, skip: (page - 1) * limit };
};
const SECRET_FIELDS = { "pdfSubmission.tokenHash": 0, "pdfSubmission.legacyTokenHash": 0, "pdfSubmission.linkSalt": 0 };
const paymentCategory = {
  success: { "payment.status": "Successful" },
  failed: { "payment.status": "Failed" },
  pending: { "payment.status": { $nin: ["Successful", "Failed"] } },
  confirmed: { "payment.confirmedAt": { $ne: null } },
  "not-confirmed": { "payment.confirmedAt": null },
};

export const getDashboard = async (_request, response) => {
  const [stats = {}] = await Registration.aggregate([
    { $group: {
      _id: null,
      total: { $sum: 1 },
      participants: { $sum: { $size: { $ifNull: ["$members", []] } } },
      faculty: { $sum: { $cond: [{ $gt: [{ $strLenCP: { $ifNull: ["$mentor.name", ""] } }, 0] }, 1, 0] } },
      successful: { $sum: { $cond: [{ $and: [{ $eq: ["$payment.status", "Successful"] }, { $ne: [{ $ifNull: ["$payment.confirmedAt", null] }, null] }] }, 1, 0] } },
      amount: { $sum: { $cond: [{ $and: [{ $eq: ["$payment.status", "Successful"] }, { $ne: [{ $ifNull: ["$payment.confirmedAt", null] }, null] }] }, { $ifNull: ["$payment.amount", 0] }, 0] } },
      pending: { $sum: { $cond: [{ $in: ["$payment.status", ["Successful", "Failed"]] }, 0, 1] } },
      failed: { $sum: { $cond: [{ $eq: ["$payment.status", "Failed"] }, 1, 0] } },
    } },
  ]);
  return response.json({
    totalRegistrations: stats.total || 0,
    totalTeams: stats.total || 0,
    totalParticipants: stats.participants || 0,
    totalFacultyRegistrations: stats.faculty || 0,
    totalAmount: stats.amount || 0,
    successfulPayments: stats.successful || 0,
    pendingPayments: stats.pending || 0,
    failedPayments: stats.failed || 0,
  });
};

// Paginated team/registration list. Logos are replaced by a hasLogo flag (served lazily by /api/registrations/:id/logo),
// except for ?all=1&includeLogos=1 which the A4 print view uses.
export const getRegistrations = async (request, response) => {
  const { query } = request;
  const filters = [searchFilter(query.search, ["teamName", "teamId", "registrationNumber", "leader.name", "leader.email", "college", "payment.transactionId"])];
  if (query.college === "sathyabama") filters.push({ college: /^sathyabama institute of science and technology$/i });
  else if (query.college === "other") filters.push({ college: { $not: /^sathyabama institute of science and technology$/i } });
  else if (query.college && query.college !== "all") filters.push({ college: String(query.college) });
  if (paymentCategory[query.status]) filters.push(paymentCategory[query.status]);
  const match = { $and: filters };

  const all = query.all === "1";
  const includeLogos = all && query.includeLogos === "1";
  const { page, limit, skip } = all ? { page: 1, limit: 2000, skip: 0 } : pageParams(query);
  const projection = includeLogos ? SECRET_FIELDS : { ...SECRET_FIELDS, teamLogo: 0 };

  const [result] = await Registration.aggregate([
    { $match: match },
    { $sort: { createdAt: -1 } },
    { $facet: {
      items: [{ $skip: skip }, { $limit: limit }, { $addFields: { hasLogo: { $gt: [{ $strLenBytes: { $ifNull: ["$teamLogo", ""] } }, 0] } } }, { $project: projection }],
      total: [{ $count: "n" }],
    } },
  ]);
  const total = result.total[0]?.n || 0;
  return response.json({ items: result.items, total, page, limit, pages: Math.max(Math.ceil(total / limit), 1) });
};

export const getColleges = async (_request, response) => {
  const colleges = (await Registration.distinct("college")).filter(Boolean).sort((a, b) => a.localeCompare(b));
  return response.json({ colleges });
};

// Only what the Payment History table shows (no order IDs, UPI details or other team data).
const PAYMENT_FIELDS = {
  teamId: 1, teamName: 1, projectTheme: 1, college: 1, "leader.name": 1, "leader.email": 1, createdAt: 1,
  "payment.status": 1, "payment.amount": 1, "payment.transactionId": 1, "payment.paidAt": 1, "payment.confirmedAt": 1, "payment.confirmedBy": 1,
  "payment.confirmationEmailStatus": 1, "payment.confirmationEmailSentAt": 1, "payment.confirmationEmailAttemptAt": 1, "payment.confirmationEmailError": 1, "payment.confirmationEmailMessageId": 1,
};

// Shows the real error only while developing; production gets the plain message.
const errorDetail = (error) => (process.env.NODE_ENV === "production" ? undefined : error?.message);

// Optional YYYY-MM-DD date range on the payment date (paid date, or registration date before payment).
const dateRangeFilter = (from, to) => {
  const range = {};
  if (/^\d{4}-\d{2}-\d{2}$/.test(from || "")) range.$gte = new Date(`${from}T00:00:00+05:30`);
  if (/^\d{4}-\d{2}-\d{2}$/.test(to || "")) range.$lte = new Date(`${to}T23:59:59.999+05:30`);
  if (!Object.keys(range).length) return {};
  return { $or: [{ "payment.paidAt": range }, { "payment.paidAt": null, createdAt: range }] };
};

// Paginated, server-filtered payment history with whole-collection summary totals.
export const getPayments = async (request, response) => {
  const { query } = request;
  const { page, limit, skip } = pageParams(query);
  const filters = [searchFilter(query.search, ["teamName", "teamId", "leader.name", "leader.email", "college", "projectTheme", "payment.transactionId"])];
  if (paymentCategory[query.status]) filters.push(paymentCategory[query.status]);
  filters.push(dateRangeFilter(query.from, query.to));
  const match = { $and: filters };

  try {
  const [[summary = {}], items, total] = await Promise.all([
    Registration.aggregate([{ $group: {
      _id: null,
      total: { $sum: 1 },
      successful: { $sum: { $cond: [{ $eq: ["$payment.status", "Successful"] }, 1, 0] } },
      failed: { $sum: { $cond: [{ $eq: ["$payment.status", "Failed"] }, 1, 0] } },
      amount: { $sum: { $cond: [{ $eq: ["$payment.status", "Successful"] }, { $ifNull: ["$payment.amount", 0] }, 0] } },
    } }]),
    Registration.find(match, PAYMENT_FIELDS).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    Registration.countDocuments(match),
  ]);
  // Older or incomplete records still load; log them so they can be fixed.
  const incomplete = items.filter((row) => !row.teamName || !row.leader?.email || !row.payment);
  if (incomplete.length) console.warn(`Payment history: ${incomplete.length} record(s) with missing team name / Team Head email / payment details:`, incomplete.map((row) => String(row._id)).join(", "));
  return response.json({
    items: items.map(paymentRow), total, page, limit, pages: Math.max(Math.ceil(total / limit), 1),
    summary: { total: summary.total || 0, successful: summary.successful || 0, failed: summary.failed || 0, pending: (summary.total || 0) - (summary.successful || 0) - (summary.failed || 0), amount: summary.amount || 0 },
  });
  } catch (error) {
    console.error("Payment history API error:", { query: { page, limit, status: query.status, search: query.search, from: query.from, to: query.to }, message: error.message });
    return response.status(500).json({ success: false, message: "Failed to fetch payment history.", error: errorDetail(error) });
  }
};
export const getFaculty = async (_request, response) => response.json(await Registration.find({ "mentor.name": { $ne: "" } }, "mentor college teamName createdAt"));

const MAX_LOGO_LENGTH = 1_500_000;

// List-shaped team record: the (large) logo is replaced by a hasLogo flag; it is fetched separately when shown.
export const toListItem = (doc) => {
  const { teamLogo, ...rest } = doc.toJSON ? doc.toJSON() : doc;
  return { ...rest, hasLogo: Boolean(teamLogo) };
};
const SATHYABAMA = "sathyabama institute of science and technology";

// College is stored in two fields plus a type; keep all three consistent.
export const setCollege = (registration, college) => {
  registration.college = college;
  registration.collegeName = college;
  registration.collegeType = college.toLowerCase() === SATHYABAMA ? "sathyabama" : "other";
};
const cleanText = (value) => (typeof value === "string" ? value.trim() : "");

// Edits the team details of an existing registration in place; IDs and payment data are never touched.
export const updateRegistration = async (request, response) => {
  if (!mongoose.isValidObjectId(request.params.id)) return response.status(404).json({ success: false, message: "Registration not found." });
  const registration = await Registration.findById(request.params.id);
  if (!registration) return response.status(404).json({ success: false, message: "Registration not found." });

  const { teamName, leader = {}, members, logo } = request.body;
  const errors = {};
  const nextTeamName = cleanText(teamName);
  const nextLeader = { name: cleanText(leader.name), email: cleanText(leader.email).toLowerCase(), phone: cleanText(leader.phone) };
  if (!nextTeamName) errors.teamName = "Team name is required.";
  if (!nextLeader.name) errors.leaderName = "Team head name is required.";
  if (!/^\S+@\S+\.\S+$/.test(nextLeader.email)) errors.leaderEmail = "Enter a valid email address.";
  if (!nextLeader.phone) errors.leaderPhone = "Phone number is required.";
  if (!Array.isArray(members) || members.length !== registration.members.length) {
    errors.members = "Member list does not match this team.";
  } else {
    members.forEach((member, index) => { if (!cleanText(member?.name)) errors[`member-${index}`] = "Member name is required."; });
  }
  const nextCollege = request.body.college === undefined ? undefined : cleanText(request.body.college);
  if (nextCollege !== undefined && !nextCollege) errors.college = "College is required.";
  if (logo !== undefined && logo !== null && logo !== "") {
    if (typeof logo !== "string" || !/^data:image\/(png|jpeg);base64,/.test(logo)) errors.logo = "Logo must be a PNG or JPG image.";
    else if (logo.length > MAX_LOGO_LENGTH) errors.logo = "Logo image is too large.";
  }
  if (Object.keys(errors).length) return response.status(400).json({ success: false, message: "Please correct the highlighted fields.", errors });

  registration.teamName = nextTeamName;
  registration.leader.name = nextLeader.name;
  registration.leader.email = nextLeader.email;
  registration.leader.phone = nextLeader.phone;
  members.forEach((member, index) => { registration.members[index].name = cleanText(member.name); });
  if (nextCollege !== undefined) setCollege(registration, nextCollege);
  if (logo) registration.teamLogo = logo;
  await registration.save();

  return response.json({ success: true, message: "Team details updated successfully.", registration: toListItem(registration) });
};

// ---------- Payment confirmation: save the verification, then send the email through Resend and record the real result ----------

const EMAIL_SENDING_TIMEOUT_MS = 2 * 60 * 1000;

// Sends the payment confirmation email for an already-verified payment and stores the real outcome:
// "Sent" (+ Resend email ID) only after Resend accepted it, otherwise "Failed" with the reason.
// The payment verification itself is never changed here.
const sendConfirmationEmailNow = async (registrationId) => {
  let result = { sent: false, messageId: null, error: "The email could not be sent. Please try again." };
  try {
    const registration = await Registration.findById(registrationId);
    const { messageId } = await sendPaymentConfirmationEmail(registration);
    result = { sent: true, messageId, error: null };
  } catch (error) {
    result.error = describeEmailError(error); // full details are logged by the email service (EMAIL_SEND_FAILED)
  }
  if (result.sent) markEmailHealthy(); else resetEmailHealth();
  const updated = await Registration.findOneAndUpdate({ _id: registrationId }, result.sent
    ? { $set: { "payment.confirmationEmailStatus": "Sent", "payment.confirmationEmailSentAt": new Date(), "payment.confirmationEmailMessageId": result.messageId }, $unset: { "payment.confirmationEmailError": "" } }
    : { $set: { "payment.confirmationEmailStatus": "Failed", "payment.confirmationEmailError": result.error } },
  { returnDocument: "after", projection: PAYMENT_FIELDS, lean: true }).catch((error) => { console.error("Unable to record confirmation email status:", error.message); return null; });
  return { ...result, registration: updated };
};


// A "Sending" status that never finished (e.g. the server restarted mid-send) is reported as Failed so it can be resent.
const effectiveEmailStatus = (payment) => (payment?.confirmationEmailStatus === "Sending" && payment.confirmationEmailAttemptAt && Date.now() - new Date(payment.confirmationEmailAttemptAt).getTime() > EMAIL_SENDING_TIMEOUT_MS
  ? "Failed" : payment?.confirmationEmailStatus || "Not Sent");

const paymentRow = (doc) => {
  const row = doc.toObject ? doc.toObject() : doc;
  return { ...row, payment: { ...row.payment, confirmationEmailStatus: effectiveEmailStatus(row.payment) } };
};

export const confirmPayment = async (request, response) => {
  if (!mongoose.isValidObjectId(request.params.id)) return response.status(404).json({ message: "Registration not found." });
  const now = new Date();
  // One atomic update: only an unconfirmed payment with a transaction ID can be confirmed (also makes double clicks harmless).
  const confirmed = await Registration.findOneAndUpdate(
    { _id: request.params.id, "payment.confirmedAt": null, "payment.transactionId": { $nin: [null, ""] } },
    { $set: { "payment.status": "Successful", "payment.confirmedAt": now, "payment.confirmedBy": request.admin.username, "payment.confirmationEmailStatus": "Sending", "payment.confirmationEmailAttemptAt": now } },
    { returnDocument: "after", projection: PAYMENT_FIELDS, lean: true },
  );

  if (!confirmed) {
    const existing = await Registration.findById(request.params.id, PAYMENT_FIELDS).lean();
    if (!existing) return response.status(404).json({ message: "Registration not found." });
    if (existing.payment?.confirmedAt) return response.json({ success: true, alreadyConfirmed: true, paymentConfirmed: true, message: "Payment was already confirmed.", registration: paymentRow(existing) });
    return response.status(400).json({ message: "A transaction ID is required before confirming payment." });
  }

  console.log(`Payment confirmed successfully for ${confirmed._id} (status ${confirmed.payment?.status}).`);
  // 1) The verified payment (read back from MongoDB) is returned immediately; it never depends on the email.
  response.json({
    success: true,
    paymentConfirmed: true,
    emailSent: false,
    emailStatus: "Sending",
    provider: emailProvider(),
    message: "Payment verified successfully. Sending the confirmation email…",
    registration: paymentRow(confirmed),
  });
  // 2) Then the confirmation email goes through the Resend API; its real result (Sent / Failed) is stored and polled by the admin page.
  sendConfirmationEmailNow(confirmed._id).catch((error) => console.error("Confirmation email task error:", error.message));
};

export const resendPaymentConfirmationEmail = async (request, response) => {
  if (!mongoose.isValidObjectId(request.params.id)) return response.status(404).json({ message: "Registration not found." });
  const now = new Date();
  const queued = await Registration.findOneAndUpdate(
    {
      _id: request.params.id,
      "payment.confirmedAt": { $ne: null },
      $or: [{ "payment.confirmationEmailStatus": { $ne: "Sending" } }, { "payment.confirmationEmailAttemptAt": { $lt: new Date(now.getTime() - EMAIL_SENDING_TIMEOUT_MS) } }],
    },
    { $set: { "payment.confirmationEmailStatus": "Sending", "payment.confirmationEmailAttemptAt": now } },
    { returnDocument: "after", projection: PAYMENT_FIELDS, lean: true },
  );
  if (!queued) {
    const existing = await Registration.findById(request.params.id, PAYMENT_FIELDS).lean();
    if (!existing) return response.status(404).json({ message: "Registration not found." });
    if (!existing.payment?.confirmedAt) return response.status(400).json({ message: "Confirm the payment before sending its confirmation email." });
    return response.status(409).json({ message: "The confirmation email is already being sent.", registration: paymentRow(existing) });
  }
  // Resend only retries the email; the payment itself is not touched.
  response.json({ success: true, paymentConfirmed: true, emailSent: false, emailStatus: "Sending", provider: emailProvider(), message: "Sending the confirmation email…", registration: paymentRow(queued) });
  sendConfirmationEmailNow(queued._id).catch((error) => console.error("Confirmation email task error:", error.message));
};

// Lightweight poll target for one row's email status (used only while that row shows "Sending").
export const getPaymentEmailStatus = async (request, response) => {
  if (!mongoose.isValidObjectId(request.params.id)) return response.status(404).json({ message: "Registration not found." });
  const row = await Registration.findById(request.params.id, { "payment.confirmationEmailStatus": 1, "payment.confirmationEmailSentAt": 1, "payment.confirmationEmailAttemptAt": 1, "payment.confirmationEmailError": 1 }).lean();
  if (!row) return response.status(404).json({ message: "Registration not found." });
  const status = effectiveEmailStatus(row.payment);
  return response.json({ confirmationEmailStatus: status, emailSent: status === "Sent", provider: emailProvider(), confirmationEmailSentAt: row.payment?.confirmationEmailSentAt || null, confirmationEmailError: status === "Failed" ? row.payment?.confirmationEmailError || "The email could not be sent. Please try again." : null });
};

// Admin-only delivery test (Vercel → Render → Resend API → inbox). Returns the real result; never the API key.
export const sendAdminTestEmail = async (request, response) => {
  const to = typeof request.body?.to === "string" ? request.body.to.trim() : "";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) return response.status(400).json({ success: false, emailSent: false, provider: emailProvider(), error: "Enter a valid recipient email address." });
  try {
    const { messageId } = await sendTestEmail(to);
    markEmailHealthy();
    return response.json({ success: true, emailSent: true, provider: emailProvider(), messageId, message: `Test email sent to ${to}.` });
  } catch (error) {
    resetEmailHealth();
    return response.status(502).json({ success: false, emailSent: false, provider: emailProvider(), error: describeEmailError(error) });
  }
};

// Is the sender email account working right now? (Payment History shows a banner when it is not.)
export const getEmailHealthStatus = async (_request, response) => response.json(await getEmailHealth());
