import assert from "node:assert/strict";
import test from "node:test";
import {
  AUTH_ROUTES,
  getTokenRoleAndValidity,
  resolveAuthorizedRoute,
  validatePortalLoginRole
} from "../src/authRouting.js";

function makeJwt(payload) {
  const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${header}.${body}.sig`;
}

test("unauthenticated direct dashboard and invalid routes redirect to /login", () => {
  assert.equal(resolveAuthorizedRoute("/patient/dashboard", { isLoggedIn: false, role: null }).path, AUTH_ROUTES.LOGIN_SELECT);
  assert.equal(resolveAuthorizedRoute("/clinician/dashboard", { isLoggedIn: false, role: null }).path, AUTH_ROUTES.LOGIN_SELECT);
  assert.equal(resolveAuthorizedRoute("/unknown", { isLoggedIn: false, role: null }).path, AUTH_ROUTES.LOGIN_SELECT);
  assert.equal(resolveAuthorizedRoute("/login/patient", { isLoggedIn: false, role: null }).redirected, false);
  assert.equal(resolveAuthorizedRoute("/login/clinician", { isLoggedIn: false, role: null }).redirected, false);
});

test("authenticated patient and clinician cannot cross-access dashboards or stay on login pages", () => {
  const patAttemptClin = resolveAuthorizedRoute("/clinician/dashboard", { isLoggedIn: true, role: "patient" });
  assert.equal(patAttemptClin.path, AUTH_ROUTES.PATIENT_DASHBOARD);
  assert.equal(patAttemptClin.redirected, true);

  const clinAttemptPat = resolveAuthorizedRoute("/patient/dashboard", { isLoggedIn: true, role: "clinician" });
  assert.equal(clinAttemptPat.path, AUTH_ROUTES.CLINICIAN_DASHBOARD);
  assert.equal(clinAttemptPat.redirected, true);

  assert.equal(resolveAuthorizedRoute("/login", { isLoggedIn: true, role: "patient" }).path, AUTH_ROUTES.PATIENT_DASHBOARD);
  assert.equal(resolveAuthorizedRoute("/login/clinician", { isLoggedIn: true, role: "clinician" }).path, AUTH_ROUTES.CLINICIAN_DASHBOARD);
});

test("validatePortalLoginRole rejects role mismatches in both directions", () => {
  assert.equal(validatePortalLoginRole("patient", "patient").allowed, true);
  assert.equal(validatePortalLoginRole("clinician", "clinician").allowed, true);

  const clinInPat = validatePortalLoginRole("patient", "clinician");
  assert.equal(clinInPat.allowed, false);
  assert.match(clinInPat.message, /Clinician Portal/i);

  const patInClin = validatePortalLoginRole("clinician", "patient");
  assert.equal(patInClin.allowed, false);
  assert.match(patInClin.message, /Patient Login/i);
});

test("getTokenRoleAndValidity validates role and expiration", () => {
  const futureExp = Math.floor(Date.now() / 1000) + 3600;
  const validClin = makeJwt({ userId: 11, role: "clinician", exp: futureExp });
  assert.deepEqual(getTokenRoleAndValidity(validClin), { valid: true, role: "clinician" });

  const expired = makeJwt({ userId: 11, role: "patient", exp: Math.floor(Date.now() / 1000) - 60 });
  assert.deepEqual(getTokenRoleAndValidity(expired), { valid: false, role: null });
});
