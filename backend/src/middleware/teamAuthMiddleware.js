import jwt from "jsonwebtoken";

// Team Head tokens use a key separate from admin tokens, so a team token can never pass requireAdmin (and vice versa).
const teamSecret = () => process.env.TEAM_JWT_SECRET || `${process.env.JWT_SECRET}:team-portal`;
const TOKEN_OPTIONS = { audience: "dexathon-team-portal", issuer: "dexathon-2026" };

// kind "team": sub is a Registration ID. kind "access": sub is a TeamAccess account with no registered team (yet).
export const signTeamToken = (id, kind = "team") => jwt.sign({ sub: String(id), role: "team", ...(kind === "access" ? { kind } : {}) }, teamSecret(), { ...TOKEN_OPTIONS, expiresIn: "12h" });

export const requireTeam = (request, response, next) => {
  try {
    const token = request.headers.authorization?.split(" ")[1];
    const payload = jwt.verify(token, teamSecret(), TOKEN_OPTIONS);
    if (payload.role !== "team" || !payload.sub) throw new Error("Not a team token");
    if (payload.kind === "access") request.teamAccessId = payload.sub;
    else request.teamRegistrationId = payload.sub;
    next();
  } catch {
    response.status(401).json({ success: false, message: "Please log in to the Team Head Portal." });
  }
};
