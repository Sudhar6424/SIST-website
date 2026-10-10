import { BrowserRouter, Route, Routes } from "react-router-dom";
import AdminProtectedRoute from "./components/AdminProtectedRoute";
import Home from "./pages/Home";
import RegisterPage from "./pages/RegisterPage";
import PaymentPage from "./pages/PaymentPage";
import ThankYouPage from "./pages/ThankYouPage";
import ThankYou from "./pages/ThankYou";
import AdminLogin from "./pages/AdminLogin";
import AdminDashboard from "./pages/AdminDashboard";
import AdminPaymentSettings from "./pages/AdminPaymentSettings";
import PaymentHistory from "./pages/PaymentHistory";
import AdminTeams from "./pages/AdminTeams";
import AdminTeamAccess from "./pages/AdminTeamAccess";
import AdminPdfSubmissions from "./pages/AdminPdfSubmissions";
import SubmitDocument from "./pages/SubmitDocument";
import AdminRounds from "./pages/AdminRounds";
import AdminRoundSelection from "./pages/AdminRoundSelection";
import AdminUsers from "./pages/AdminUsers";
import TeamLogin from "./pages/TeamLogin";
import TeamDashboard from "./pages/TeamDashboard";
import TeamProtectedRoute from "./components/TeamProtectedRoute";
import "./styles/dexathon.css";
import "./styles/responsive.css";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/payment" element={<PaymentPage />} />
        <Route path="/thank-you/:id" element={<ThankYouPage />} />
        <Route path="/thank-you" element={<ThankYou />} />
        <Route path="/submit-document/:token" element={<SubmitDocument />} />
        <Route path="/team-login" element={<TeamLogin />} />
        <Route element={<TeamProtectedRoute />}>
          <Route path="/team-dashboard" element={<TeamDashboard />} />
        </Route>
        <Route path="/admin/login" element={<AdminLogin />} />
        <Route path="/admin/dashboard" element={<AdminProtectedRoute section="dashboard"><AdminDashboard /></AdminProtectedRoute>} />
        {/* <Route path="/admin/payment-history" element={<AdminProtectedRoute section="payments"><PaymentHistory /></AdminProtectedRoute>} />
        <Route path="/admin/teams" element={<AdminProtectedRoute section="teams"><AdminTeams /></AdminProtectedRoute>} /> */}
        <Route path="/admin/team-access" element={<AdminProtectedRoute section="teams"><AdminTeamAccess /></AdminProtectedRoute>} />
        <Route path="/admin/pdf-submissions" element={<AdminProtectedRoute section="pdf"><AdminPdfSubmissions /></AdminProtectedRoute>} />
        <Route path="/admin/rounds" element={<AdminProtectedRoute section="rounds"><AdminRounds /></AdminProtectedRoute>} />
        <Route path="/admin/round-selection" element={<AdminProtectedRoute section="rounds"><AdminRoundSelection /></AdminProtectedRoute>} />
        <Route path="/admin/payment-settings" element={<AdminProtectedRoute section="paymentSettings"><AdminPaymentSettings /></AdminProtectedRoute>} />
        <Route path="/admin/users" element={<AdminProtectedRoute section="users"><AdminUsers /></AdminProtectedRoute>} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
