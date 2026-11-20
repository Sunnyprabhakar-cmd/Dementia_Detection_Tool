import { useState } from "react";
import { AUTH_ROUTES } from "../authRouting.js";

function AuthPortal({
  routePath,
  onNavigate,
  t,
  authMode,
  setAuthMode,
  name,
  setName,
  email,
  setEmail,
  password,
  setPassword,
  language,
  setLanguage,
  isSubmitting,
  status,
  onSubmitAuth,
  demoModeEnabled,
  onLoadDemoReport,
  demoReport,
  renderDemoReport
}) {
  const [showPassword, setShowPassword] = useState(false);

  const isPatientLogin = routePath === AUTH_ROUTES.LOGIN_PATIENT;
  const isClinicianLogin = routePath === AUTH_ROUTES.LOGIN_CLINICIAN;

  if (!isPatientLogin && !isClinicianLogin) {
    return (
      <div className="auth-shell" style={{ padding: "24px 16px" }}>
        <div className="auth-card" style={{ maxWidth: "820px", width: "100%" }}>
          <div className="brand-row">
            <div className="brand-badge" aria-hidden="true">M</div>
            <div>
              <h1>{t.appName}</h1>
              <p>{t.subtitle}</p>
            </div>
          </div>

          <h2 style={{ marginTop: "8px", marginBottom: "4px", fontSize: "1.2rem" }}>
            Select Your Portal
          </h2>
          <p className="muted-text" style={{ marginTop: 0, marginBottom: "16px" }}>
            Choose the portal matching your account role to sign in.
          </p>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
              gap: "16px"
            }}
          >
            <section
              aria-label="Patient Portal"
              style={{
                border: "1px solid #cbd5e1",
                borderRadius: "12px",
                padding: "18px",
                background: "#f8fafc",
                color: "#0f172a",
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
                gap: "12px"
              }}
            >
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px" }}>
                  <span aria-hidden="true" style={{ fontSize: "1.35rem" }}>🧑‍⚕️</span>
                  <h3 style={{ margin: 0 }}>Patient Portal</h3>
                </div>
                <p style={{ margin: 0, fontSize: "0.9rem", color: "#334155" }}>
                  Complete cognitive and speech screening tasks, view your assessment history, and download PDF reports.
                </p>
              </div>
              <div style={{ display: "grid", gap: "8px" }}>
                <button
                  type="button"
                  className="primary-btn"
                  onClick={() => {
                    setAuthMode("login");
                    onNavigate(AUTH_ROUTES.LOGIN_PATIENT);
                  }}
                >
                  Patient Login
                </button>
                <button
                  type="button"
                  className="ghost-btn"
                  onClick={() => {
                    setAuthMode("register");
                    onNavigate(AUTH_ROUTES.LOGIN_PATIENT);
                  }}
                >
                  Patient Registration
                </button>
              </div>
            </section>

            <section
              aria-label="Clinician Portal"
              style={{
                border: "1px solid #cbd5e1",
                borderRadius: "12px",
                padding: "18px",
                background: "#f8fafc",
                color: "#0f172a",
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
                gap: "12px"
              }}
            >
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px" }}>
                  <span aria-hidden="true" style={{ fontSize: "1.35rem" }}>🩺</span>
                  <h3 style={{ margin: 0 }}>Clinician Portal</h3>
                </div>
                <p style={{ margin: 0, fontSize: "0.9rem", color: "#334155" }}>
                  Review assigned patient screenings, inspect physical examination observations, and add clinical review notes.
                </p>
                <p style={{ margin: "8px 0 0", fontSize: "0.8rem", color: "#475569" }}>
                  Clinician accounts require administrator provisioning. Public registration is disabled.
                </p>
              </div>
              <div>
                <button
                  type="button"
                  className="primary-btn"
                  style={{ width: "100%" }}
                  onClick={() => {
                    setAuthMode("login");
                    onNavigate(AUTH_ROUTES.LOGIN_CLINICIAN);
                  }}
                >
                  Clinician Login
                </button>
              </div>
            </section>
          </div>

          {status && <p className="status-pill" role="status" style={{ marginTop: "14px" }}>{status}</p>}

          {demoModeEnabled && (
            <div className="demo-launch" style={{ marginTop: "14px" }}>
              <button className="ghost-btn" type="button" onClick={onLoadDemoReport}>
                Open simulated demo report
              </button>
              {demoReport && renderDemoReport?.(demoReport)}
            </div>
          )}
        </div>
      </div>
    );
  }

  const activeMode = isClinicianLogin ? "login" : authMode;

  return (
    <div className="auth-shell" style={{ padding: "24px 16px" }}>
      <form
        className="auth-card"
        onSubmit={(event) => {
          event.preventDefault();
          onSubmitAuth(isClinicianLogin ? "clinician" : "patient");
        }}
      >
        <div style={{ marginBottom: "10px" }}>
          <button
            type="button"
            className="ghost-btn"
            onClick={() => {
              setAuthMode("login");
              onNavigate(AUTH_ROUTES.LOGIN_SELECT);
            }}
          >
            ← Back to role selection
          </button>
        </div>

        <div className="brand-row">
          <div className="brand-badge" aria-hidden="true">M</div>
          <div>
            <h1>{isClinicianLogin ? "Clinician Login" : "Patient Portal"}</h1>
            <p>
              {isClinicianLogin
                ? "Authorized clinician access to assigned patient assessments"
                : t.subtitle}
            </p>
          </div>
        </div>

        {isPatientLogin ? (
          <div className="toggle-row" role="tablist" aria-label="Patient authentication mode">
            <button
              type="button"
              role="tab"
              aria-selected={activeMode === "login"}
              className={activeMode === "login" ? "toggle active" : "toggle"}
              onClick={() => setAuthMode("login")}
            >
              {t.login}
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeMode === "register"}
              className={activeMode === "register" ? "toggle active" : "toggle"}
              onClick={() => setAuthMode("register")}
            >
              {t.register}
            </button>
          </div>
        ) : (
          <div
            role="note"
            style={{
              padding: "10px 12px",
              borderRadius: "8px",
              background: "#f8fafc",
              color: "#334155",
              border: "1px solid #cbd5e1",
              fontSize: "0.85rem",
              marginBottom: "8px"
            }}
          >
            Clinician accounts are provisioned by administrators only. Public clinician registration is disabled.
          </div>
        )}

        {isPatientLogin && activeMode === "register" && (
          <label>
            <span>{t.fullName}</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t.fullName}
              autoComplete="name"
              required
            />
          </label>
        )}

        <label>
          <span>{t.email}</span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={t.email}
            autoComplete="email"
            required
          />
        </label>

        <label>
          <span>{t.password}</span>
          <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
            <input
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={t.password}
              autoComplete={activeMode === "register" ? "new-password" : "current-password"}
              required
              style={{ flex: 1 }}
            />
            <button
              type="button"
              className="ghost-btn"
              onClick={() => setShowPassword((prev) => !prev)}
              aria-label={showPassword ? "Hide password" : "Show password"}
              style={{ whiteSpace: "nowrap" }}
            >
              {showPassword ? "Hide" : "Show"}
            </button>
          </div>
        </label>

        {isPatientLogin && (
          <label>
            <span>{t.chooseLanguage}</span>
            <select value={language} onChange={(e) => setLanguage(e.target.value)}>
              <option value="en">English</option>
              <option value="si">Sinhala</option>
              <option value="ta">தமிழ்</option>
            </select>
          </label>
        )}

        <button type="submit" className="primary-btn" disabled={isSubmitting}>
          {isSubmitting
            ? "Signing in..."
            : isClinicianLogin
              ? "Sign in as Clinician"
              : activeMode === "login"
                ? t.login
                : t.register}
        </button>

        {status && <p className="status-pill" role="status">{status}</p>}
      </form>
    </div>
  );
}

export default AuthPortal;
