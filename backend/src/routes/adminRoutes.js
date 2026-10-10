import { Router } from "express";
import { confirmPayment, getColleges, getDashboard, getFaculty, getEmailHealthStatus, getMe, sendAdminTestEmail, getPaymentEmailStatus, getPayments, getRegistrations, login, resendPaymentConfirmationEmail, updateRegistration } from "../controllers/adminController.js";
import { createAdmin, deleteAdmin, listAdmins, updateAdmin } from "../controllers/adminUsersController.js";
import { getEvaluationSettings, listSubmissions, retrySelectionEmail, saveEvaluation, streamSubmissionPdf, updateEvaluationSettings } from "../controllers/evaluationController.js";
import { updatePaymentSettings } from "../controllers/paymentSettingsController.js";
import { bulkDeleteTeams, bulkUpdateTeams, deleteTeam } from "../controllers/teamManagementController.js";
import { applyTeamAccess, deleteTeamAccess, listTeamAccess, updateTeamAccess } from "../controllers/teamAccessController.js";
import { decideRound, listRoundSelection, retryRoundEmail } from "../controllers/roundSelectionController.js";
import { listRounds, resendRoundEmail, updateRounds } from "../controllers/roundsController.js";
import { requireAdmin, requireSection } from "../middleware/authMiddleware.js";

const router = Router();
router.post("/login", login);
router.use(requireAdmin);
router.get("/me", getMe);

// Dashboard & registration details (General Admin, Team Admin)
router.get("/dashboard", requireSection("dashboard"), getDashboard);
router.get("/faculty", requireSection("dashboard"), getFaculty);

// Teams (General Admin, Team Admin)
router.get("/registrations", requireSection("teams"), getRegistrations);
router.get("/colleges", requireSection("teams"), getColleges);
router.put("/registrations/:id", requireSection("teams"), updateRegistration);
router.delete("/registrations/:id", requireSection("teams"), deleteTeam);
router.get("/team-access", requireSection("teams"), listTeamAccess);
router.put("/team-access", requireSection("teams"), applyTeamAccess);
router.patch("/team-access/:id", requireSection("teams"), updateTeamAccess);
router.delete("/team-access/:id", requireSection("teams"), deleteTeamAccess);
router.post("/registrations/bulk-delete", requireSection("teams"), bulkDeleteTeams);
router.post("/registrations/bulk-update", requireSection("teams"), bulkUpdateTeams);

// Payments (General Admin, Payment Admin)
router.get("/payments", requireSection("payments"), getPayments);
router.get("/payment-history", requireSection("payments"), getPayments);
router.put("/payments/:id/confirm", requireSection("payments"), confirmPayment);
router.post("/payments/:id/resend-email", requireSection("payments"), resendPaymentConfirmationEmail);
router.get("/payments/:id/email-status", requireSection("payments"), getPaymentEmailStatus);
router.get("/email-health", requireSection("payments"), getEmailHealthStatus);
router.post("/test-email", requireSection("payments"), sendAdminTestEmail);

// PDF submissions & evaluation (General Admin, PDF Admin)
router.get("/pdf-submissions", requireSection("pdf"), listSubmissions);
router.get("/pdf-submissions/:id/pdf", requireSection("pdf"), streamSubmissionPdf);
router.put("/pdf-submissions/:id/evaluation", requireSection("pdf"), saveEvaluation);
router.post("/pdf-submissions/:id/selection-email", requireSection("pdf"), retrySelectionEmail);
router.get("/evaluation-settings", requireSection("pdf"), getEvaluationSettings);
router.put("/evaluation-settings", requireSection("pdf"), updateEvaluationSettings);

// Rounds (General Admin, Round Admin)
router.get("/round-selection", requireSection("rounds"), listRoundSelection);
router.put("/round-selection/:id", requireSection("rounds"), decideRound);
router.post("/round-selection/:id/email", requireSection("rounds"), retryRoundEmail);
router.get("/rounds", requireSection("rounds"), listRounds);
router.put("/rounds/:id", requireSection("rounds"), updateRounds);
router.post("/rounds/:id/email", requireSection("rounds"), resendRoundEmail);

// Payment settings (General Admin, Payment Admin) & admin accounts (General Admin only)
router.put("/payment-settings", requireSection("paymentSettings"), updatePaymentSettings);
router.get("/users", requireSection("users"), listAdmins);
router.post("/users", requireSection("users"), createAdmin);
router.put("/users/:id", requireSection("users"), updateAdmin);
router.delete("/users/:id", requireSection("users"), deleteAdmin);

export default router;
