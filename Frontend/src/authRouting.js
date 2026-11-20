export const AUTH_ROUTES = {
  LOGIN_SELECT: "/login",
  LOGIN_PATIENT: "/login/patient",
  LOGIN_CLINICIAN: "/login/clinician",
  PATIENT_DASHBOARD: "/patient/dashboard",
  CLINICIAN_DASHBOARD: "/clinician/dashboard"
};

export function normalizePathname(pathname = "/") {
  const clean = String(pathname || "/").split("?")[0].replace(/\/+$/, "");
  return clean || "/";
}

export function dashboardPathForRole(role) {
  return role === "clinician"
    ? AUTH_ROUTES.CLINICIAN_DASHBOARD
    : AUTH_ROUTES.PATIENT_DASHBOARD;
}

export function parseJwtPayload(token) {
  if (!token || typeof token !== "string") return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  try {
    const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
    const json = typeof atob === "function"
      ? atob(padded)
      : Buffer.from(padded, "base64").toString("utf8");
    return JSON.parse(json);
  } catch {
    return null;
  }
}

export function getTokenRoleAndValidity(token, nowMs = Date.now()) {
  const payload = parseJwtPayload(token);
  if (!payload || typeof payload !== "object") {
    return { valid: false, role: null };
  }
  if (typeof payload.exp === "number" && payload.exp * 1000 <= nowMs) {
    return { valid: false, role: null };
  }
  const role = payload.role === "clinician" || payload.role === "patient" ? payload.role : null;
  return { valid: Boolean(role), role };
}

export function validatePortalLoginRole(expectedPortalRole, actualUserRole) {
  if (expectedPortalRole === "patient" && actualUserRole !== "patient") {
    return {
      allowed: false,
      message: "This account is registered as a clinician. Please sign in through the Clinician Portal."
    };
  }
  if (expectedPortalRole === "clinician" && actualUserRole !== "clinician") {
    return {
      allowed: false,
      message: "This account is a patient account and cannot access the Clinician Portal. Please use Patient Login."
    };
  }
  return { allowed: true, message: null };
}

export function resolveAuthorizedRoute(pathname, { isLoggedIn, role }) {
  const current = normalizePathname(pathname);
  const authPages = new Set([
    AUTH_ROUTES.LOGIN_SELECT,
    AUTH_ROUTES.LOGIN_PATIENT,
    AUTH_ROUTES.LOGIN_CLINICIAN
  ]);

  if (!isLoggedIn || (role !== "patient" && role !== "clinician")) {
    if (authPages.has(current)) {
      return { path: current, redirected: false, notice: null };
    }
    return { path: AUTH_ROUTES.LOGIN_SELECT, redirected: true, notice: null };
  }

  const targetDashboard = dashboardPathForRole(role);
  if (current === AUTH_ROUTES.PATIENT_DASHBOARD && role === "clinician") {
    return {
      path: AUTH_ROUTES.CLINICIAN_DASHBOARD,
      redirected: true,
      notice: "Clinician accounts cannot open the Patient Dashboard. Redirected to Clinician Portal."
    };
  }
  if (current === AUTH_ROUTES.CLINICIAN_DASHBOARD && role === "patient") {
    return {
      path: AUTH_ROUTES.PATIENT_DASHBOARD,
      redirected: true,
      notice: "Patient accounts are not authorized to access the Clinician Dashboard."
    };
  }
  if (current === targetDashboard) {
    return { path: current, redirected: false, notice: null };
  }
  return { path: targetDashboard, redirected: true, notice: null };
}
