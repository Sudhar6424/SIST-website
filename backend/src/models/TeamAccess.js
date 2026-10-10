import mongoose from "mongoose";

// Team Login access created by an admin (Admin → Team Login Access): one account per email.
// It works whether or not a registered team uses that email; when one does, signing in opens that team.
// Only a bcrypt hash of the password is stored, and it is never selected unless asked for.
const teamAccessSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  passwordHash: { type: String, required: true, select: false },
  updatedBy: String,
  lastLoginAt: Date,
}, { timestamps: true });

export default mongoose.model("TeamAccess", teamAccessSchema);
