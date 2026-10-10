import axios from "axios";
import { Eye, EyeOff, KeyRound, Pencil, RefreshCw, Trash2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import "./AdminPaymentSettings.css";
import "./AdminTeamAccess.css";
import { API_URL } from "../config/api";
import AdminNav from "../components/AdminNav";
import { clearAdminSession, getAdminToken } from "../config/adminSession";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// Suggested starting password; the admin can change it before applying.
const DEFAULT_PASSWORD = "DEXATHON2026";

const formatDate = (value) => {
  const date = value ? new Date(value) : null;
  return date && !Number.isNaN(date.getTime()) ? date.toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" }) : "—";
};

// Password is optional when editing (blank keeps the current one).
const validate = ({ email, password }, { passwordRequired = true } = {}) => {
  const errors = {};
  if (!EMAIL.test(email.trim())) errors.email = "Enter a valid email address.";
  if (!passwordRequired && !password) return errors;
  if (password.length < 8) errors.password = "The password must be at least 8 characters.";
  else if (new TextEncoder().encode(password).length > 72) errors.password = "The password must be at most 72 characters.";
  else if (password.trim() !== password) errors.password = "The password cannot start or end with a space.";
  return errors;
};

// Admin → Team Login Access: set (or replace) the password a team uses on the Team Login page.
export default function AdminTeamAccess() {
  const [form, setForm] = useState({ email: "", password: DEFAULT_PASSWORD });
  const [errors, setErrors] = useState({});
  const [showPassword, setShowPassword] = useState(false);
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState(null);
  const [accounts, setAccounts] = useState([]);
  const [listState, setListState] = useState({ loading: true, error: "" });
  const [editing, setEditing] = useState(null); // { id, email, password, errors, saving }
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [listMessage, setListMessage] = useState(null);
  const navigate = useNavigate();
  const headers = { Authorization: `Bearer ${getAdminToken()}` };

  const handleAuthError = (error) => {
    if (error.response?.status === 401) { clearAdminSession(); navigate("/admin/login"); return true; }
    return false;
  };

  // The access list always comes from the backend.
  const loadAccounts = useCallback(async () => {
    setListState((current) => ({ ...current, loading: true, error: "" }));
    try {
      const response = await axios.get(`${API_URL}/admin/team-access`, { headers: { Authorization: `Bearer ${getAdminToken()}` } });
      setAccounts(Array.isArray(response.data?.items) ? response.data.items : []);
      setListState({ loading: false, error: "" });
    } catch (error) {
      if (error.response?.status === 401) { clearAdminSession(); navigate("/admin/login"); return; }
      setListState({ loading: false, error: error.response?.status === 403 ? "Your account can't view team login access." : "Unable to load the access list. Please try again." });
    }
  }, [navigate]);

  useEffect(() => { loadAccounts(); }, [loadAccounts]);

  const startEdit = (account) => { setEditing({ id: account.id, email: account.email, password: "", errors: {}, saving: false }); setListMessage(null); };

  const saveEdit = async () => {
    const errors = validate(editing, { passwordRequired: false });
    if (Object.keys(errors).length) { setEditing((current) => ({ ...current, errors })); return; }
    setEditing((current) => ({ ...current, saving: true, errors: {} }));
    try {
      const response = await axios.patch(`${API_URL}/admin/team-access/${editing.id}`, { email: editing.email.trim(), ...(editing.password ? { password: editing.password } : {}) }, { headers });
      setEditing(null);
      setListMessage({ ok: true, text: response.data?.message || "Login access updated." });
      await loadAccounts();
    } catch (error) {
      if (handleAuthError(error)) return;
      setEditing((current) => current && ({ ...current, saving: false, errors: error.response?.data?.errors || {} }));
      setListMessage({ ok: false, text: error.response?.data?.message || "Login access could not be updated. Please try again." });
    }
  };

  const confirmDelete = async () => {
    setDeleting(true);
    try {
      const response = await axios.delete(`${API_URL}/admin/team-access/${deleteTarget.id}`, { headers });
      if (!response.data?.success) throw new Error("not deleted");
      setDeleteTarget(null);
      setListMessage({ ok: true, text: response.data.message });
      await loadAccounts();
    } catch (error) {
      if (handleAuthError(error)) return;
      setListMessage({ ok: false, text: error.response?.data?.message || "Login access could not be deleted. Please try again." });
      setDeleteTarget(null);
    } finally {
      setDeleting(false);
    }
  };

  const update = (key, value) => { setForm((current) => ({ ...current, [key]: value })); setErrors((current) => ({ ...current, [key]: undefined })); setResult(null); };

  const apply = async (event) => {
    event.preventDefault();
    setResult(null);
    const nextErrors = validate(form);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;
    setSaving(true);
    try {
      const response = await axios.put(`${API_URL}/admin/team-access`, { email: form.email.trim(), password: form.password }, { headers: { Authorization: `Bearer ${getAdminToken()}` } });
      if (!response.data?.success) throw new Error("not saved");
      setResult({ ok: true, text: response.data.message, team: response.data.team, access: response.data.access });
      setForm({ email: "", password: DEFAULT_PASSWORD });
      loadAccounts();
    } catch (error) {
      if (error.response?.status === 401) { clearAdminSession(); navigate("/admin/login"); return; }
      setErrors(error.response?.data?.errors || {});
      setResult({ ok: false, text: error.response?.status === 403 ? "Your account can't manage team login access." : error.response?.data?.message || "Login access could not be applied. Please try again." });
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="payment-settings team-access-page">
      <aside className="payment-settings-sidebar">
        <b>DEXATHON ADMIN</b>
        <AdminNav />
      </aside>
      <section className="payment-settings-content">
        <header className="payment-settings-heading">
          <p>TEAM LOGIN ACCESS</p>
          <h1>Give a team access to the Team Login</h1>
        </header>
        <form className="settings-form team-access-form" onSubmit={apply} noValidate>
          <h2>Login Credentials</h2>
          <label>
            Team Email
            <input type="email" value={form.email} onChange={(event) => update("email", event.target.value)} placeholder="Team email address" autoComplete="off" inputMode="email" aria-invalid={Boolean(errors.email)} />
            {errors.email ? <small className="team-access-error">{errors.email}</small> : null}
          </label>
          <label>
            Team Password
            <span className="team-access-password">
              <input type={showPassword ? "text" : "password"} value={form.password} onChange={(event) => update("password", event.target.value)} placeholder="At least 8 characters" autoComplete="new-password" aria-invalid={Boolean(errors.password)} />
              <button type="button" onClick={() => setShowPassword((current) => !current)} aria-label={showPassword ? "Hide password" : "Show password"}>{showPassword ? <EyeOff size={16} /> : <Eye size={16} />}</button>
            </span>
            {errors.password ? <small className="team-access-error">{errors.password}</small> : null}
          </label>
          <button type="submit" className="save-settings" disabled={saving}><KeyRound size={16} /> {saving ? "Applying..." : "Apply Login Access"}</button>
          {result ? (
            <div className={`settings-message team-access-result ${result.ok ? "" : "is-error"}`} role="status">
              <p>{result.ok ? "✓ " : ""}{result.text}</p>
              {result.access ? <p className="team-access-team">{result.access.email} · {result.team ? `Registered team: ${result.team.teamName}${result.team.teamId ? ` (${result.team.teamId})` : ""}` : "Separate login access (no registered team uses this email)"}</p> : null}
            </div>
          ) : null}
          <p className="team-access-note">The team signs in on the Team Login page with this email and password. If a registered team uses this email, signing in opens that team. Applying again replaces the password; no duplicate team or account is created.</p>
        </form>

        <section className="team-access-list" aria-labelledby="team-access-list-title">
          <header>
            <h2 id="team-access-list-title">Team Access List</h2>
            <button type="button" className="team-access-refresh" onClick={loadAccounts} disabled={listState.loading}><RefreshCw size={14} /> {listState.loading ? "Loading..." : "Refresh"}</button>
          </header>
          {listMessage ? <p className={`settings-message team-access-result ${listMessage.ok ? "" : "is-error"}`} role="status">{listMessage.ok ? "✓ " : ""}{listMessage.text}</p> : null}
          {listState.error ? <p className="settings-message team-access-result is-error" role="alert">{listState.error} <button type="button" className="team-access-link" onClick={loadAccounts}>Retry</button></p> : null}
          {!listState.error && !listState.loading && !accounts.length ? <p className="team-access-empty">No team login access has been created yet.</p> : null}
          {accounts.length ? (
            <div className="team-access-table">
              <table>
                <thead><tr><th>S.No.</th><th>Team Head Email</th><th>Login Status</th><th>Created Date</th><th>Actions</th></tr></thead>
                <tbody>
                  {accounts.map((account, index) => {
                    const isEditing = editing?.id === account.id;
                    return (
                      <tr key={account.id} className={isEditing ? "is-editing" : ""}>
                        <td data-label="S.No.">{index + 1}</td>
                        <td data-label="Team Head Email">
                          {isEditing ? (
                            <div className="team-access-edit">
                              <input type="email" value={editing.email} onChange={(event) => setEditing((current) => ({ ...current, email: event.target.value, errors: { ...current.errors, email: undefined } }))} aria-label="Email" aria-invalid={Boolean(editing.errors.email)} />
                              {editing.errors.email ? <small className="team-access-error">{editing.errors.email}</small> : null}
                              <input type="password" value={editing.password} onChange={(event) => setEditing((current) => ({ ...current, password: event.target.value, errors: { ...current.errors, password: undefined } }))} placeholder="New password (leave blank to keep)" autoComplete="new-password" aria-label="New password" aria-invalid={Boolean(editing.errors.password)} />
                              {editing.errors.password ? <small className="team-access-error">{editing.errors.password}</small> : null}
                            </div>
                          ) : (
                            <><b className="team-access-email">{account.email}</b><small>{account.team ? `Registered team: ${account.team.teamName}` : "Separate login access"}</small></>
                          )}
                        </td>
                        <td data-label="Login Status"><span className="team-access-status">Active</span><small>{account.lastLoginAt ? `Last sign-in ${formatDate(account.lastLoginAt)}` : "Never signed in"}</small></td>
                        <td data-label="Created Date">{formatDate(account.createdAt)}</td>
                        <td data-label="Actions" className="team-access-actions">
                          {isEditing ? (
                            <>
                              <button type="button" className="team-access-save" onClick={saveEdit} disabled={editing.saving}>{editing.saving ? "Saving..." : "Save"}</button>
                              <button type="button" onClick={() => setEditing(null)} disabled={editing.saving}>Cancel</button>
                            </>
                          ) : (
                            <>
                              <button type="button" onClick={() => startEdit(account)} disabled={Boolean(editing)}><Pencil size={14} /> Edit</button>
                              <button type="button" className="team-access-delete" onClick={() => { setDeleteTarget(account); setListMessage(null); }} disabled={Boolean(editing)}><Trash2 size={14} /> Delete</button>
                            </>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : null}
        </section>
      </section>

      {deleteTarget ? (
        <div className="team-access-dialog" role="dialog" aria-modal="true" aria-labelledby="team-access-delete-title">
          <section>
            <h2 id="team-access-delete-title">Delete login access?</h2>
            <p><b>{deleteTarget.email}</b> will no longer be able to sign in with this login access. Any registered team using this email is not deleted.</p>
            <footer>
              <button type="button" onClick={() => setDeleteTarget(null)} disabled={deleting}>Cancel</button>
              <button type="button" className="team-access-delete" onClick={confirmDelete} disabled={deleting}>{deleting ? "Deleting..." : "Delete"}</button>
            </footer>
          </section>
        </div>
      ) : null}
    </main>
  );
}
