import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import Registration from "../models/Registration.js";
import TeamAccess from "../models/TeamAccess.js";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
export const headEmailQuery = (email) => ({ "leader.email": { $regex: `^\\s*${escapeRegex(email)}\\s*$`, $options: "i" } });
export const normalizeEmail = (value) => (typeof value === "string" ? value.trim().toLowerCase() : "");

// The registered team for a Team Head email, if any: a payment-verified team first (most recently verified),
// otherwise the most recent registration. Never creates a team.
export const findRegisteredTeam = async (email, fields = "") => (
  await Registration.findOne({ ...headEmailQuery(email), "payment.confirmedAt": { $exists: true, $ne: null } }).sort({ "payment.confirmedAt": -1 }).select(fields)
  || Registration.findOne(headEmailQuery(email)).sort({ createdAt: -1, _id: -1 }).select(fields)
);

// PUT /api/admin/team-access { email, password }: create or replace the Team Login access for that email.
// Works for any email; a registered team with that email is used automatically at login (no duplicate team).
// Only a bcrypt hash is stored; the password is never logged or returned.
export const applyTeamAccess = async (request, response) => {
  const email = normalizeEmail(request.body?.email);
  const password = typeof request.body?.password === "string" ? request.body.password : "";
  const errors = {};
  if (!EMAIL.test(email)) errors.email = "Enter a valid email address.";
  if (password.length < 8) errors.password = "The password must be at least 8 characters.";
  else if (Buffer.byteLength(password, "utf8") > 72) errors.password = "The password must be at most 72 characters.";
  else if (password.trim() !== password) errors.password = "The password cannot start or end with a space.";
  if (Object.keys(errors).length) return response.status(400).json({ success: false, message: "Please correct the highlighted fields.", errors });

  const passwordHash = await bcrypt.hash(password, 12);
  const before = await TeamAccess.exists({ email });
  const saved = await TeamAccess.findOneAndUpdate(
    { email },
    { $set: { passwordHash, updatedBy: request.admin.username }, $setOnInsert: { email } },
    { upsert: true, returnDocument: "after", runValidators: true },
  ).catch((error) => (error.code === 11000 ? TeamAccess.findOneAndUpdate({ email }, { $set: { passwordHash, updatedBy: request.admin.username } }, { returnDocument: "after" }) : Promise.reject(error)));
  if (!saved?._id) return response.status(500).json({ success: false, message: "Login access could not be saved. Please try again." });

  const team = await findRegisteredTeam(email, "teamName teamId payment.confirmedAt");
  const updated = Boolean(before);
  console.log(`TEAM_ACCESS_${updated ? "UPDATED" : "CREATED"} email=${email} linkedTeam=${team?.teamId || "none"} by=${request.admin.username}`);
  return response.json({
    success: true,
    updated,
    message: updated ? "Login password updated. The team can sign in with the new password now." : "Login access created. The team can sign in on the Team Login page now.",
    access: { email: saved.email, updatedAt: saved.updatedAt },
    team: team ? { teamName: team.teamName, teamId: team.teamId, paymentVerified: Boolean(team.payment?.confirmedAt) } : null,
  });
};

// Fields an admin may see about a login-access account (never the password hash).
const accessRow = (account, team) => ({
  id: String(account._id),
  email: account.email,
  createdAt: account.createdAt,
  updatedAt: account.updatedAt,
  updatedBy: account.updatedBy || "",
  lastLoginAt: account.lastLoginAt || null,
  team: team ? { teamName: team.teamName, teamId: team.teamId } : null,
});

const validateAccessInput = ({ email, password }, { passwordRequired }) => {
  const errors = {};
  if (email !== undefined && !EMAIL.test(email)) errors.email = "Enter a valid email address.";
  if (password || passwordRequired) {
    if (password.length < 8) errors.password = "The password must be at least 8 characters.";
    else if (Buffer.byteLength(password, "utf8") > 72) errors.password = "The password must be at most 72 characters.";
    else if (password.trim() !== password) errors.password = "The password cannot start or end with a space.";
  }
  return errors;
};

// GET /api/admin/team-access: every login-access account, newest first, with the registered team using that email (if any).
export const listTeamAccess = async (_request, response) => {
  const accounts = await TeamAccess.find().sort({ createdAt: -1 }).lean();
  const items = await Promise.all(accounts.map(async (account) => accessRow(account, await findRegisteredTeam(account.email, "teamName teamId"))));
  return response.json({ success: true, items, total: items.length });
};

// PATCH /api/admin/team-access/:id { email?, password? }: change the email and/or set a new password (blank keeps the current one).
export const updateTeamAccess = async (request, response) => {
  if (!mongoose.isValidObjectId(request.params.id)) return response.status(404).json({ success: false, message: "Login access not found." });
  const email = request.body?.email === undefined ? undefined : normalizeEmail(request.body.email);
  const password = typeof request.body?.password === "string" ? request.body.password : "";
  const errors = validateAccessInput({ email, password }, { passwordRequired: false });
  if (Object.keys(errors).length) return response.status(400).json({ success: false, message: "Please correct the highlighted fields.", errors });
  if (email && await TeamAccess.exists({ email, _id: { $ne: request.params.id } })) {
    return response.status(409).json({ success: false, message: "Another login access already uses this email.", errors: { email: "Another login access already uses this email." } });
  }
  const changes = { updatedBy: request.admin.username };
  if (email) changes.email = email;
  if (password) changes.passwordHash = await bcrypt.hash(password, 12);
  const saved = await TeamAccess.findByIdAndUpdate(request.params.id, { $set: changes }, { returnDocument: "after", runValidators: true }).lean()
    .catch((error) => (error.code === 11000 ? "duplicate" : Promise.reject(error)));
  if (saved === "duplicate") return response.status(409).json({ success: false, message: "Another login access already uses this email.", errors: { email: "Another login access already uses this email." } });
  if (!saved) return response.status(404).json({ success: false, message: "Login access not found." });
  console.log(`TEAM_ACCESS_EDITED id=${saved._id} email=${saved.email}${password ? " password=changed" : ""} by=${request.admin.username}`);
  return response.json({ success: true, message: password ? "Login access updated, including the new password." : "Login access updated.", item: accessRow(saved, await findRegisteredTeam(saved.email, "teamName teamId")) });
};

// DELETE /api/admin/team-access/:id: remove the login access (any registered team itself is not touched).
export const deleteTeamAccess = async (request, response) => {
  if (!mongoose.isValidObjectId(request.params.id)) return response.status(404).json({ success: false, message: "Login access not found." });
  const removed = await TeamAccess.findByIdAndDelete(request.params.id).lean();
  if (!removed) return response.status(404).json({ success: false, message: "Login access not found." });
  console.log(`TEAM_ACCESS_DELETED id=${removed._id} email=${removed.email} by=${request.admin.username}`);
  return response.json({ success: true, message: `Login access for ${removed.email} was deleted.`, id: String(removed._id) });
};
