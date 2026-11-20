import { useCallback, useEffect, useRef, useState } from "react";
import {
  buildVoiceTaskPayload,
  calculateSimulatedDementiaProbability,
  formatLocalAssessmentDate,
  formatPredictionScores,
  isRenderablePrediction
} from "./assessmentUtils.js";
import { API_BASE_URL } from "./api.js";
import ClockDrawingTask from "./components/ClockDrawingTask.jsx";
import DelayedMemoryTask from "./components/DelayedMemoryTask.jsx";
import DigitSpanTask from "./components/DigitSpanTask.jsx";
import PatternRecognitionTask from "./components/PatternRecognitionTask.jsx";
import PictureRecognitionTask from "./components/PictureRecognitionTask.jsx";
import VoiceTask from "./components/VoiceTask.jsx";
import OptionalPhysicalExamTask from "./components/OptionalPhysicalExamTask.jsx";
import MultimodalSummary from "./components/MultimodalSummary.jsx";
import AuthPortal from "./components/AuthPortal.jsx";
import {
  AUTH_ROUTES,
  dashboardPathForRole,
  getTokenRoleAndValidity,
  normalizePathname,
  resolveAuthorizedRoute,
  validatePortalLoginRole
} from "./authRouting.js";
import PatientDashboard from "./components/PatientDashboard.jsx";
import ClinicianDashboard from "./components/ClinicianDashboard.jsx";
import "./App.css";

const hasMeasuredValue = (value) => {
  if (value == null) return false;
  if (typeof value !== "object") return true;
  return Object.values(value).some(hasMeasuredValue);
};

const languagePack = {
  en: {
    appName: "MindScan AI",
    subtitle: "Research-only cognitive and communication tasks; not a diagnosis",
    login: "Login",
    register: "Register",
    fullName: "Full name",
    email: "Email",
    password: "Password",
    startScreening: "Start screening",
    chooseLanguage: "Language",
    dashboard: "Assessment dashboard",
    welcome: "Welcome back",
    patient: "Patient profile",
    memory: "Memory recall",
    attention: "Attention task",
    orientation: "Orientation",
    language: "Language fluency",
    summary: "Assessment report",
    next: "Next",
    back: "Back",
    submit: "Submit",
    logout: "Logout",
    noToken: "Please sign in to continue.",
    memoryPrompt: "Memorize the five words. Repeat them after the countdown.",
    attentionPrompt: "Press the button as soon as the target appears.",
    orientationPrompt: "Answer the following orientation questions.",
    languagePrompt: "Repeat the sentence and list as many animals as you can."
  },
  si: {
    appName: "MindScan AI",
    subtitle: "මුල් අවධියේඩිමෙන්ෂියාව නිරීක්ෂණය",
    login: "පුරනය වන්න",
    register: "ලියාපදිංචි වන්න",
    fullName: "සම්පූර්ණ නම",
    email: "ඊමේල්",
    password: "මුරපදය",
    startScreening: "සමාලෝචනය ආරම්භ කරන්න",
    chooseLanguage: "භාෂාව",
    dashboard: "පරීක්ෂණ පුවරුව",
    welcome: "ආයුබෝවන්",
    patient: "රෝගී පැතිකඩ",
    memory: "මතකය",
    attention: "අවධානය",
    orientation: "දිශානතිය",
    language: "භාෂා යුගලනය",
    summary: "AI අවදානම් සාරාංශය",
    next: "ඊළඟ",
    back: "ආපසු",
    submit: "ඉදිරිපත් කරන්න",
    logout: "ලොග් අවුට්",
    noToken: "කරුණාකර පිවිසී සිටින්න.",
    memoryPrompt: "පළමු වචන පහ අමතක නොවී මතක තබා ගන්න. ගණන් කිරීමෙන් පසු නැවත යොදා ගන්න.",
    attentionPrompt: "ලක්ෂ්යය දිස්වන විගස බොත්තම එබීම් කර කරන්න.",
    orientationPrompt: "පහත දිශානතියේ ප්‍රශ්නවලට පිළිතුරු දෙන්න.",
    languagePrompt: "වාක්‍යය නැවත කියන්න සහ ගැහැණු සතුන් ගණනාවක් ලැයිස්තුගත කරන්න."
  },
  ta: {
    appName: "MindScan AI",
    subtitle: "ஆரம்பகால நினைவாற்றல் சோதனை",
    login: "உள்நுழைக",
    register: "பதிவு செய்",
    fullName: "முழுப் பெயர்",
    email: "மின்னஞ்சல்",
    password: "கடவுச்சொல்",
    startScreening: "சோதனையைத் தொடங்கு",
    chooseLanguage: "மொழி",
    dashboard: "மதிப்பீட்டு பலகம்",
    welcome: "வரவேற்கிறோம்",
    patient: "நோயாளி சுயவிவரம்",
    memory: "நினைவாற்றல்",
    attention: "கவனம்",
    orientation: "திசைநிலை",
    language: "மொழி திறன்",
    summary: "AI ஆபத்து சுருக்கம்",
    next: "அடுத்து",
    back: "முந்தைய",
    submit: "சமர்ப்பி",
    logout: "வெளியேறு",
    noToken: "தொடர உள்நுழையவும்.",
    memoryPrompt: "ஐந்து சொற்களையும் மனதில் பிடித்து, எண்ணிக்கை முடிந்தபின் மீண்டும் கூறவும்.",
    attentionPrompt: "இலக்கு தோன்றும்போது விரைவாக பொத்தானை அழுத்துங்கள்.",
    orientationPrompt: "பின்வரும் திசைநிலை கேள்விகளுக்கு பதிலளிக்கவும்.",
    languagePrompt: "வாக்கியத்தை மீண்டும் கூறி, முடிந்த அளவு விலங்குகளின் பெயர்களை பட்டியலிடவும்."
  }
};

const memoryWordPool = [
  ["APPLE", "RIVER", "WINDOW", "MANGO", "GARDEN"],
  ["CLOUD", "BREAD", "MUSIC", "PLANET", "BRIDGE"],
  ["ROCKET", "TICKET", "FOREST", "CANDLE", "RAIN"],
  ["SILVER", "GARDEN", "SHELF", "SANDAL", "ORANGE"],
  ["LANTERN", "WATER", "DRUM", "MOUNTAIN", "BLOSSOM"]
];

const languageSentencePool = [
  "The early morning sun is bright in our town.",
  "A calm evening breeze moves across the lake.",
  "The red bus leaves for the market before noon.",
  "Children laugh while they walk through the garden.",
  "The doctor reviewed the report before lunch."
];

const buildMemoryState = () => ({
  wordsShown: memoryWordPool[Math.floor(Math.random() * memoryWordPool.length)],
  wordsRecalled: Array(5).fill("")
});

const buildLanguageState = () => ({
  sentence: "",
  animals: "",
  prompt: languageSentencePool[Math.floor(Math.random() * languageSentencePool.length)]
});

function App() {
  const [authMode, setAuthMode] = useState("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [language, setLanguage] = useState("en");
  const [token, setToken] = useState(() => localStorage.getItem("token") || "");
  const [routePath, setRoutePath] = useState(() => normalizePathname(window.location.pathname));
  const [isAuthSubmitting, setIsAuthSubmitting] = useState(false);
  const [screeningId, setScreeningId] = useState(null);
  const [patientInfo, setPatientInfo] = useState({
    patientIdentifier: "",
    age: "",
    sex: "",
    educationYears: "",
    handedness: "unknown",
    socioeconomicStatus: "",
    medicalHistory: "",
    medications: "",
    reportedSymptoms: "",
    symptomOnset: "",
    functionalChanges: "",
    familyHistory: "",
    consent: false
  });
  const [status, setStatus] = useState("");
  const [result, setResult] = useState(null);
  const [previousResults, setPreviousResults] = useState([]);
  const [activeStep, setActiveStep] = useState("dashboard");
  const [memoryData, setMemoryData] = useState(() => buildMemoryState());
  const [attentionData, setAttentionData] = useState({ correct: 0, wrong: 0, missed: 0, reactionTimes: [] });
  const [orientationData, setOrientationData] = useState({ year: "", month: "", date: "", place: "" });
  const [languageData, setLanguageData] = useState(() => buildLanguageState());
  const [clinicianData, setClinicianData] = useState(() => ({
    observationDate: new Date().toISOString().slice(0, 10),
    assessorRole: "",
    side: "not_applicable",
    observations: {
      tremor: "not_assessed",
      movementSlowness: "not_assessed",
      reducedAmplitude: "not_assessed",
      gaitBalance: "not_assessed",
      posture: "not_assessed",
      handPosture: "not_assessed",
      sensoryResponse: "not_assessed",
      reflexes: "not_assessed"
    },
    clinicalMeasurements: { mmse: "", cdr: "" },
    notes: "",
    skipped: false,
    skipReason: ""
  }));
  const [voiceAssessment, setVoiceAssessment] = useState({
    status: "not_assessed",
    duration: null,
    language: "",
    speech_features: null,
    transcript_analysis: null,
    provenance: null
  });
  const [demoReport, setDemoReport] = useState(null);

  const t = languagePack[language] || languagePack.en;
  const demoModeEnabled = import.meta.env.VITE_MINDSCAN_DEMO_MODE === "true";

  const tokenAuth = getTokenRoleAndValidity(token);
  const isLoggedIn = tokenAuth.valid;
  const userRole = tokenAuth.role || "patient";

  const navigateTo = useCallback((nextPath, { replace = false } = {}) => {
    const normalized = normalizePathname(nextPath);
    if (normalizePathname(window.location.pathname) !== normalized) {
      if (replace) {
        window.history.replaceState({}, "", normalized);
      } else {
        window.history.pushState({}, "", normalized);
      }
    }
    setRoutePath(normalized);
  }, []);

  useEffect(() => {
    const handlePopState = () => {
      setRoutePath(normalizePathname(window.location.pathname));
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  useEffect(() => {
    if (token && !tokenAuth.valid) {
      setToken("");
      localStorage.removeItem("token");
      localStorage.removeItem("userRole");
    }
  }, [token, tokenAuth.valid]);

  useEffect(() => {
    const resolved = resolveAuthorizedRoute(routePath, {
      isLoggedIn,
      role: tokenAuth.role
    });
    if (resolved.redirected) {
      navigateTo(resolved.path, { replace: true });
      if (resolved.notice) {
        setStatus(resolved.notice);
      }
    }
  }, [routePath, isLoggedIn, tokenAuth.role, navigateTo]);

  useEffect(() => {
    if (token && tokenAuth.valid) {
      localStorage.setItem("token", token);
      localStorage.setItem("userRole", tokenAuth.role);
    } else if (!token) {
      localStorage.removeItem("token");
      localStorage.removeItem("userRole");
    }
  }, [token, tokenAuth.valid, tokenAuth.role]);

  const loadHistory = useCallback(async () => {
    if (!token || !isLoggedIn || userRole !== "patient") return;

    try {
      const response = await fetch(`${API_BASE_URL}/api/results/history`, {
        method: "GET",
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Unable to load history");

      const history = Array.isArray(data.history) ? data.history : [];
      setPreviousResults(history.slice(0, 5).map((item) => ({
        id: item.screeningId || item.id,
        timestamp: new Date(item.timestamp).toLocaleString(),
        overview: "Assessment report"
      })));
    } catch (error) {
      console.warn("History unavailable", error);
    }
  }, [token]);

  useEffect(() => {
    if (!token || !isLoggedIn || userRole !== "patient") return undefined;
    const timer = window.setTimeout(() => {
      void loadHistory();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [loadHistory, token, isLoggedIn, userRole]);

  const resumeActiveScreening = useCallback(async () => {
    if (!token || !isLoggedIn || userRole !== "patient") return;
    try {
      const response = await fetch(`${API_BASE_URL}/api/screening/active`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!response.ok) return;
      const data = await response.json();
      const active = data?.activeScreening;
      if (!active?.session?.id) return;
      setScreeningId(active.session.id);
      const completed = new Set((active.tasks || []).map((item) => item.task_type));
      const order = [
        "memory",
        "attention",
        "digit_span",
        "picture_recognition",
        "pattern_recognition",
        "clock_drawing",
        "orientation",
        "delayed_memory",
        "voice",
        "language",
        "physical_examination",
        "clinician_observation"
      ];
      const nextStep = order.find((step) => !completed.has(step)) || "summary";
      const stepMap = { physical_examination: "physical_exam", clinician_observation: "clinician" };
      setActiveStep(stepMap[nextStep] || nextStep);
      setStatus(`Resumed active screening #${active.session.id}.`);
    } catch {
      // Ignore if no active session
    }
  }, [token]);

  useEffect(() => {
    if (!token || !isLoggedIn || userRole !== "patient" || screeningId) return;
    void resumeActiveScreening();
  }, [token, isLoggedIn, userRole, screeningId, resumeActiveScreening]);

  const handleAuth = async (expectedPortalRole = "patient") => {
    setIsAuthSubmitting(true);
    try {
      setStatus("Authenticating...");
      const isRegister = expectedPortalRole === "patient" && authMode === "register";
      const endpoint = isRegister ? "/api/auth/register" : "/api/auth/login";
      const payload = isRegister
        ? { name, email, password, referBy: "student-project", preferredLanguage: language }
        : { email, password };

      const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Authentication failed");

      if (!isRegister) {
        const nextToken = data.token || "";
        const nextRole = data.user?.role || getTokenRoleAndValidity(nextToken).role || "patient";
        const roleCheck = validatePortalLoginRole(expectedPortalRole, nextRole);
        if (!roleCheck.allowed) {
          setStatus(roleCheck.message);
          return;
        }
        setToken(nextToken);
        localStorage.setItem("token", nextToken);
        localStorage.setItem("userRole", nextRole);
        if (data.user?.preferredLanguage) setLanguage(data.user.preferredLanguage);
        setStatus(
          nextRole === "clinician"
            ? "Clinician login successful."
            : "Login successful. You can begin the screening."
        );
        navigateTo(dashboardPathForRole(nextRole), { replace: true });
      } else {
        setStatus("Registration successful. Please log in.");
        setAuthMode("login");
      }
    } catch (error) {
      setStatus(error.message || "Something went wrong");
    } finally {
      setIsAuthSubmitting(false);
    }
  };

  const loadDemoReport = async () => {
    setStatus("Loading the synthetic demo fixture...");
    try {
      const response = await fetch(API_BASE_URL + "/api/ml/demo-report");
      const data = await response.json();
      if (!response.ok || data.status !== "simulated_demo" || data.report?.simulated !== true) {
        throw new Error(data.message || "The simulated demo is unavailable.");
      }
      setDemoReport(data.report);
      setStatus("Synthetic demo loaded. No participant data was used or saved.");
    } catch (error) {
      setStatus(error.message || "Unable to load the simulated demo.");
    }
  };

  const createScreeningSession = async (profile) => {
    const response = await fetch(API_BASE_URL + "/api/screening/start", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
      body: JSON.stringify({ patientProfile: profile })
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || "Unable to start screening");
    setScreeningId(data.screening.id);
    return data.screening.id;
  };

  const startScreening = () => {
    setStatus("");
    setActiveStep("patient");
  };

  const beginAssessment = async (event) => {
    event.preventDefault();
    try {
      setStatus("Saving consent and starting the research assessment...");
      const profile = {
        ...patientInfo,
        age: Number(patientInfo.age),
        educationYears: patientInfo.educationYears === "" ? null : Number(patientInfo.educationYears),
        socioeconomicStatus: patientInfo.socioeconomicStatus === "" ? null : Number(patientInfo.socioeconomicStatus)
      };
      await createScreeningSession(profile);
      setMemoryData(buildMemoryState());
      setLanguageData(buildLanguageState());
      setVoiceAssessment({ status: "not_assessed", duration: null, language: "", speech_features: null, transcript_analysis: null, provenance: null });
      setActiveStep("memory");
      setStatus("Session started. Begin the assessment.");
    } catch (error) {
      setStatus(error.message || "Unable to start the research assessment.");
    }
  };

  const submitStep = async (taskType, taskPayload) => {
    if (!screeningId) return null;
    try {
      const response = await fetch(API_BASE_URL + "/api/screening/" + screeningId + "/response", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
        body: JSON.stringify({ taskType, responseData: taskPayload, reactionTime: taskPayload.responseTime ?? null })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Failed to save task");
      setStatus(taskType + " task saved successfully.");
      return data;
    } catch (error) {
      setStatus(error.message || "Error saving task");
      return null;
    }
  };

  const finishAssessment = async () => {
    if (!screeningId) return;
    try {
      setStatus("Loading the assessment report...");
      const response = await fetch(API_BASE_URL + "/api/screening/" + screeningId + "/result", {
        headers: { Authorization: "Bearer " + token }
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Could not retrieve the assessment report");
      let multimodalSummary = null;
      try {
        const sumResp = await fetch(API_BASE_URL + "/api/screening/" + screeningId + "/summary", {
          method: "POST",
          headers: { Authorization: "Bearer " + token }
        });
        if (sumResp.ok) {
          const sumData = await sumResp.json();
          multimodalSummary = sumData.summary || null;
        }
      } catch {
        // Non-blocking fallback
      }
      setResult({ ...data.result, multimodalSummary });
      setActiveStep("summary");
      setStatus("Assessment report loaded.");
      await loadHistory();
    } catch (error) {
      setStatus(error.message || "Unable to retrieve the assessment report.");
    }
  };

  const resetAssessment = () => {
    setScreeningId(null);
    setResult(null);
    setStatus("");
    setActiveStep("dashboard");
    setMemoryData(buildMemoryState());
    setAttentionData({ correct: 0, wrong: 0, missed: 0, reactionTimes: [] });
    setOrientationData({ year: "", month: "", date: "", place: "" });
    setLanguageData(buildLanguageState());
    setVoiceAssessment({ status: "not_assessed", duration: null, language: "", speech_features: null, transcript_analysis: null, provenance: null });
  };

  const logout = () => {
    setToken("");
    setScreeningId(null);
    setResult(null);
    setActiveStep("dashboard");
    setStatus("");
    setAuthMode("login");
    localStorage.removeItem("token");
    localStorage.removeItem("userRole");
    navigateTo(AUTH_ROUTES.LOGIN_SELECT, { replace: true });
  };

  if (!isLoggedIn) {
    return (
      <AuthPortal
        routePath={routePath}
        onNavigate={(nextPath) => {
          setStatus("");
          navigateTo(nextPath);
        }}
        t={t}
        authMode={authMode}
        setAuthMode={(nextMode) => {
          setStatus("");
          setAuthMode(nextMode);
        }}
        name={name}
        setName={setName}
        email={email}
        setEmail={setEmail}
        password={password}
        setPassword={setPassword}
        language={language}
        setLanguage={setLanguage}
        isSubmitting={isAuthSubmitting}
        status={status}
        onSubmitAuth={handleAuth}
        demoModeEnabled={demoModeEnabled}
        onLoadDemoReport={loadDemoReport}
        demoReport={demoReport}
        renderDemoReport={(report) => <ResultSummary result={report} t={t} />}
      />
    );
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">{t.dashboard}</p>
          <h2>{t.welcome}, {email}</h2>
        </div>
        <div className="top-actions">
          <select value={language} onChange={(e) => setLanguage(e.target.value)}>
            <option value="en">English</option>
            <option value="si">Sinhala</option>
            <option value="ta">தமிழ்</option>
          </select>
          <button className="ghost-btn" onClick={logout}>{t.logout}</button>
        </div>
      </header>

      <main className="main-grid" style={userRole === "clinician" ? { gridTemplateColumns: "1fr" } : undefined}>
        {userRole !== "clinician" && (
        <aside className="sidebar card">
          <h3>{t.patient}</h3>
          <div className="profile-list">
            <div><span>Language</span><strong>{language.toUpperCase()}</strong></div>
            <div><span>Screening ID</span><strong>{screeningId || "Not started"}</strong></div>
            <div><span>Report status</span><strong>{result ? "Loaded" : "Awaiting assessment"}</strong></div>
          </div>

          {!screeningId && (
            <button className="primary-btn" onClick={startScreening}>{t.startScreening}</button>
          )}

          <div className="history-block">
            <h4>Past test results</h4>
            {previousResults.length === 0 ? (
              <p className="muted-text">No previous assessments yet.</p>
            ) : (
              <div className="history-list">
                {previousResults.map((item) => (
                  <div key={item.id} className="history-item">
                    <span>{item.timestamp}</span>
                    <strong>{item.overview}</strong>
                    <small>Research assessment record</small>
                  </div>
                ))}
              </div>
            )}
          </div>
        </aside>
        )}

        <section className="content-panel card">
          {screeningId && activeStep !== "summary" && activeStep !== "dashboard" && activeStep !== "patient" && (
            <div className="progress-banner" style={{ marginBottom: "12px", fontSize: "0.9rem", color: "#475569" }}>
              Step: <strong>{activeStep.replace("_", " ").toUpperCase()}</strong>
            </div>
          )}
          {activeStep === "dashboard" && (
            userRole === "clinician" ? (
              <ClinicianDashboard token={token} />
            ) : (
              <PatientDashboard
                token={token}
                language={language}
                onLanguageChange={setLanguage}
                onStartScreening={startScreening}
                onContinueScreening={resumeActiveScreening}
                activeScreeningId={screeningId}
              />
            )
          )}

          {activeStep === "patient" && (
            <form className="task-box" onSubmit={beginAssessment}>
              <p className="eyebrow">Assessment intake</p>
              <h2>Consent and session information</h2>
              <p>Use a study code rather than a name when possible. Optional health-history fields are not model inputs.</p>
              <label><span>Age (required)</span><input type="number" min="1" max="120" required value={patientInfo.age} onChange={(event) => setPatientInfo({ ...patientInfo, age: event.target.value })} /></label>
              <label><span>Study identifier (optional)</span><input maxLength="80" value={patientInfo.patientIdentifier} onChange={(event) => setPatientInfo({ ...patientInfo, patientIdentifier: event.target.value })} /></label>
              <label><span>Sex (optional)</span><select value={patientInfo.sex} onChange={(event) => setPatientInfo({ ...patientInfo, sex: event.target.value })}><option value="">Not provided</option><option value="female">Female</option><option value="male">Male</option><option value="intersex">Intersex</option><option value="prefer_not_to_say">Prefer not to say</option></select></label>
              <label><span>Education years (optional)</span><input type="number" min="0" max="40" value={patientInfo.educationYears} onChange={(event) => setPatientInfo({ ...patientInfo, educationYears: event.target.value })} /></label>
              <label><span>Handedness (optional)</span><select value={patientInfo.handedness} onChange={(event) => setPatientInfo({ ...patientInfo, handedness: event.target.value })}><option value="unknown">Unknown</option><option value="right">Right</option><option value="left">Left</option><option value="ambidextrous">Ambidextrous</option></select></label>
              <label className="consent-field"><input type="checkbox" required checked={patientInfo.consent} onChange={(event) => setPatientInfo({ ...patientInfo, consent: event.target.checked })} /><span>I consent to storage of this research assessment and its task responses.</span></label>
              <div className="task-actions"><button className="primary-btn" type="submit">Begin assessment</button></div>
            </form>
          )}

          {activeStep === "memory" && (
            <MemoryTask
              t={t}
              value={memoryData}
              setValue={setMemoryData}
              onNext={async (elapsedSeconds) => {
                const payload = {
                  wordsShown: memoryData.wordsShown,
                  wordsRecalled: memoryData.wordsRecalled,
                  responseTime: elapsedSeconds
                };
                await submitStep("memory", payload);
                setActiveStep("attention");
              }}
            />
          )}

          {activeStep === "attention" && (
            <AttentionTask
              t={t}
              value={attentionData}
              setValue={setAttentionData}
              onNext={async (elapsedSeconds) => {
                const payload = {
                  totalRounds: 10,
                  correct: attentionData.correct,
                  wrong: attentionData.wrong,
                  missed: attentionData.missed,
                  averageReactionTime: attentionData.reactionTimes.length
                    ? (attentionData.reactionTimes.reduce((sum, time) => sum + time, 0) / attentionData.reactionTimes.length).toFixed(2)
                    : 0,
                  reactionTimes: attentionData.reactionTimes,
                  responseTime: elapsedSeconds
                };
                await submitStep("attention", payload);
                setActiveStep("digit_span");
              }}
            />
          )}

          {activeStep === "digit_span" && (
            <DigitSpanTask
              onNext={async (payload) => {
                if (await submitStep("digit_span", payload)) setActiveStep("picture_recognition");
              }}
            />
          )}

          {activeStep === "picture_recognition" && (
            <PictureRecognitionTask
              onNext={async (payload) => {
                if (await submitStep("picture_recognition", payload)) setActiveStep("pattern_recognition");
              }}
            />
          )}

          {activeStep === "pattern_recognition" && (
            <PatternRecognitionTask
              onNext={async (payload) => {
                if (await submitStep("pattern_recognition", payload)) setActiveStep("clock_drawing");
              }}
            />
          )}

          {activeStep === "clock_drawing" && (
            <ClockDrawingTask
              screeningId={screeningId}
              token={token}
              onComplete={async () => {
                setActiveStep("orientation");
              }}
            />
          )}

          {activeStep === "orientation" && (
            <OrientationTask
              t={t}
              value={orientationData}
              setValue={setOrientationData}
              onNext={async (assessmentDate, elapsedSeconds) => {
                const payload = { ...orientationData, assessmentDate, responseTime: elapsedSeconds };
                if (await submitStep("orientation", payload)) setActiveStep("delayed_memory");
              }}
            />
          )}

          {activeStep === "delayed_memory" && (
            <DelayedMemoryTask
              wordsShown={memoryData.wordsShown}
              onNext={async (payload) => {
                if (await submitStep("delayed_memory", payload)) setActiveStep("voice");
              }}
            />
          )}

          {activeStep === "voice" && (
            <VoiceTask
              token={token}
              onVoiceResult={({ status, duration, language, speech_features, transcript_analysis, quality_warnings, quality_reliable, acoustic_classifier_poc, provenance }) => (
                setVoiceAssessment({ status, duration, language, speech_features, transcript_analysis, quality_warnings, quality_reliable, acoustic_classifier_poc, provenance })
              )}
              onFinish={async () => {
                const saved = await submitStep("voice", buildVoiceTaskPayload(voiceAssessment));
                if (!saved) return;
                setActiveStep("language");
              }}
            />
          )}

          {activeStep === "language" && (
            <LanguageTask
              t={t}
              value={languageData}
              setValue={setLanguageData}
              onFinish={async (elapsedSeconds) => {
                const payload = {
                  sentence: languageData.sentence,
                  animals: languageData.animals,
                  responseTime: elapsedSeconds
                };
                if (await submitStep("language", payload)) setActiveStep("physical_exam");
              }}
            />
          )}

          {activeStep === "physical_exam" && (
            <OptionalPhysicalExamTask
              onNext={async (payload) => {
                if (await submitStep("physical_examination", payload)) setActiveStep("clinician");
              }}
            />
          )}

          {activeStep === "clinician" && (
            <ClinicianObservationTask
              value={clinicianData}
              setValue={setClinicianData}
              onFinish={async (payload) => {
                if (await submitStep("clinician_observation", payload)) await finishAssessment();
              }}
            />
          )}

              {activeStep === "summary" && result && (
            <>
              <ResultSummary result={result} t={t} />
              <div className="summary-actions">
                <button className="primary-btn" onClick={resetAssessment}>Test again</button>
              </div>
            </>
          )}

          {status && !result && <p className="status-pill fixed-status">{status}</p>}
        </section>
      </main>
    </div>
  );
}

function ClinicianObservationTask({ value, setValue, onFinish }) {
  const observationLabels = {
    tremor: "Tremor",
    movementSlowness: "Movement slowness",
    reducedAmplitude: "Reduced movement amplitude",
    gaitBalance: "Gait or balance observation",
    posture: "Posture",
    handPosture: "Hand posture",
    sensoryResponse: "Sensory response",
    reflexes: "Reflexes"
  };
  const update = (field, nextValue) => setValue((current) => ({ ...current, [field]: nextValue }));

  return (
    <form className="task-box" onSubmit={(event) => { event.preventDefault(); onFinish(value); }}>
      <p className="eyebrow">Optional clinician observations</p>
      <h2>Record observed findings separately</h2>
      <p>Enter only observations made by an assessor. These observations are not inferred from the digital tasks or used as a diagnosis.</p>
      <label className="consent-field"><input type="checkbox" checked={value.skipped} onChange={(event) => update("skipped", event.target.checked)} /><span>Skip the clinician observation</span></label>
      {value.skipped ? (
        <label><span>Reason for skipping</span><input required maxLength={1000} value={value.skipReason} onChange={(event) => update("skipReason", event.target.value)} /></label>
      ) : (
        <>
          <label><span>Observation date</span><input type="date" required value={value.observationDate} onChange={(event) => update("observationDate", event.target.value)} /></label>
          <label><span>Assessor role</span><input required maxLength={100} value={value.assessorRole} onChange={(event) => update("assessorRole", event.target.value)} /></label>
          <label><span>Side observed</span><select value={value.side} onChange={(event) => update("side", event.target.value)}><option value="not_applicable">Not applicable</option><option value="left">Left</option><option value="right">Right</option><option value="both">Both</option></select></label>
          {Object.entries(observationLabels).map(([field, label]) => (
            <label key={field}><span>{label}</span><select value={value.observations[field]} onChange={(event) => setValue((current) => ({ ...current, observations: { ...current.observations, [field]: event.target.value } }))}><option value="not_assessed">Not assessed</option><option value="present">Present</option><option value="absent">Absent</option><option value="unable_to_assess">Unable to assess</option></select></label>
          ))}
          <label><span>Clinician-entered MMSE (optional)</span><input type="number" min="0" max="30" value={value.clinicalMeasurements.mmse} onChange={(event) => setValue((current) => ({ ...current, clinicalMeasurements: { ...current.clinicalMeasurements, mmse: event.target.value } }))} /></label>
          <label><span>Clinician-entered CDR (optional)</span><select value={value.clinicalMeasurements.cdr} onChange={(event) => setValue((current) => ({ ...current, clinicalMeasurements: { ...current.clinicalMeasurements, cdr: event.target.value } }))}><option value="">Not provided</option><option value="0">0</option><option value="0.5">0.5</option><option value="1">1</option><option value="2">2</option><option value="3">3</option></select></label>
          <label><span>Assessor notes (optional)</span><textarea maxLength={2000} value={value.notes} onChange={(event) => update("notes", event.target.value)} /></label>
        </>
      )}
      <div className="task-actions"><button className="primary-btn" type="submit">Save observations and finish</button></div>
    </form>
  );
}

function MemoryTask({ t, value, setValue, onNext }) {
  const [showWords, setShowWords] = useState(true);
  const [countdown, setCountdown] = useState(8);
  const startedAtRef = useRef(Date.now());

  useEffect(() => {
    if (!showWords) return;

    const timer = setInterval(() => {
      setCountdown((current) => {
        if (current <= 1) {
          clearInterval(timer);
          setShowWords(false);
          return 0;
        }
        return current - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [showWords]);

  const updateRecall = (index, val) => {
    const next = [...value.wordsRecalled];
    next[index] = val;
    setValue((prev) => ({ ...prev, wordsRecalled: next }));
  };

  return (
    <div className="task-box">
      <p className="eyebrow">{t.memory}</p>
      <h2>{t.memoryPrompt}</h2>

      <div className="memory-timer-box">
        {showWords ? `Words disappear in ${countdown}s` : "Now recall the words from memory"}
      </div>

      {showWords ? (
        <div className="word-grid">
          {value.wordsShown.map((word) => (
            <span key={word} className="word-pill">{word}</span>
          ))}
        </div>
      ) : (
        <div className="recall-grid">
          {value.wordsRecalled.map((entry, index) => (
            <input
              key={index}
              value={entry}
              onChange={(e) => updateRecall(index, e.target.value)}
              placeholder={`Word ${index + 1}`}
            />
          ))}
        </div>
      )}

      <div className="task-actions">
        <button
          className="primary-btn"
          onClick={() => onNext(Number(((Date.now() - startedAtRef.current) / 1000).toFixed(2)))}
        >
          {t.next}
        </button>
      </div>
    </div>
  );
}

function AttentionTask({ t, value, setValue, onNext }) {
  const [isTargetVisible, setIsTargetVisible] = useState(false);
  const [round, setRound] = useState(1);
  const timerIdRef = useRef(null);
  const startedAtRef = useRef(Date.now());

  useEffect(() => {
    const delay = 1000 + Math.random() * 1800;
    const timeout = setTimeout(() => {
      setIsTargetVisible(true);
      const start = Date.now();
      const autoTimeout = setTimeout(() => {
        setValue((prev) => ({
          ...prev,
          missed: prev.missed + 1
        }));
        setIsTargetVisible(false);
        timerIdRef.current = null;
        if (round >= 10) {
          return;
        }
        setRound((r) => r + 1);
      }, 1600);
      timerIdRef.current = { start, autoTimeout };
    }, delay);

    return () => {
      clearTimeout(timeout);
      if (timerIdRef.current?.autoTimeout) clearTimeout(timerIdRef.current.autoTimeout);
    };
  }, [round, setValue]);

  const handleClick = () => {
    if (!isTargetVisible) {
      setValue((prev) => ({ ...prev, wrong: prev.wrong + 1 }));
      return;
    }

    const reaction = ((Date.now() - timerIdRef.current.start) / 1000).toFixed(2);
    clearTimeout(timerIdRef.current.autoTimeout);
    timerIdRef.current = null;
    setValue((prev) => ({
      ...prev,
      correct: prev.correct + 1,
      reactionTimes: [...prev.reactionTimes, Number(reaction)]
    }));
    setIsTargetVisible(false);
    if (round >= 10) {
      onNext(Number(((Date.now() - startedAtRef.current) / 1000).toFixed(2)));
      return;
    }
    setRound((r) => r + 1);
  };

  return (
    <div className="task-box">
      <p className="eyebrow">{t.attention}</p>
      <h2>{t.attentionPrompt}</h2>
      <div className="attention-box">
        <button className={isTargetVisible ? "attention-btn active" : "attention-btn"} onClick={handleClick}>
          {isTargetVisible ? "CLICK" : "WAIT"}
        </button>
      </div>
      <div className="stats-row">
        <span>Round: {round}/10</span>
        <span>Correct: {value.correct}</span>
        <span>Missed: {value.missed}</span>
      </div>
      <div className="task-actions">
        <button
          className="primary-btn"
          onClick={() => onNext(Number(((Date.now() - startedAtRef.current) / 1000).toFixed(2)))}
        >
          {t.next}
        </button>
      </div>
    </div>
  );
}

function OrientationTask({ t, value, setValue, onNext }) {
  const [countdown, setCountdown] = useState(20);
  const startedAtRef = useRef(Date.now());
  const today = new Date();
  const displayedDate = `${today.getDate()} ${today.toLocaleString("en-US", { month: "long" })} ${today.getFullYear()}`;

  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown((current) => (current <= 1 ? 0 : current - 1));
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const updateField = (field, val) => {
    setValue((prev) => ({ ...prev, [field]: val }));
  };

  return (
    <div className="task-box">
      <p className="eyebrow">{t.orientation}</p>
      <h2>{t.orientationPrompt}</h2>
      <div className="memory-timer-box">Time remaining: {countdown}s</div>
      <div className="prompt-banner">Today is: {displayedDate}</div>
      <div className="form-grid">
        <label className="prompt-field">
          <span>Write the day of the month</span>
          <input value={value.date} onChange={(e) => updateField("date", e.target.value)} placeholder="Example: 21" />
        </label>
        <label className="prompt-field">
          <span>Write the current month</span>
          <input value={value.month} onChange={(e) => updateField("month", e.target.value)} placeholder="Example: September" />
        </label>
        <label className="prompt-field">
          <span>Write the current year</span>
          <input value={value.year} onChange={(e) => updateField("year", e.target.value)} placeholder="Example: 2026" />
        </label>
        <label className="prompt-field">
          <span>Write the place you are in</span>
          <input value={value.place} onChange={(e) => updateField("place", e.target.value)} placeholder="Example: clinic, home, hospital" />
        </label>
      </div>
      <div className="task-actions">
        <button
          className="primary-btn"
          onClick={() => onNext(formatLocalAssessmentDate(today), Number(((Date.now() - startedAtRef.current) / 1000).toFixed(2)))}
        >
          {t.next}
        </button>
      </div>
    </div>
  );
}


function LanguageTask({ t, value, setValue, onFinish }) {
  const [typingCountdown, setTypingCountdown] = useState(30);
  const [sentenceVisible, setSentenceVisible] = useState(false);
  const [typingEnabled, setTypingEnabled] = useState(false);
  const finishedRef = useRef(false);
  const startedAtRef = useRef(Date.now());

  useEffect(() => {
    const sentenceTimer = setTimeout(() => {
      setSentenceVisible(true);
    }, 2000);

    return () => clearTimeout(sentenceTimer);
  }, []);

  useEffect(() => {
    if (!sentenceVisible) return undefined;

    const hideSentenceTimer = setTimeout(() => {
      setSentenceVisible(false);
      setTypingEnabled(true);
    }, 6000);

    return () => clearTimeout(hideSentenceTimer);
  }, [sentenceVisible]);

  useEffect(() => {
    if (!typingEnabled) return undefined;

    const typingTimer = setInterval(() => {
      setTypingCountdown((current) => {
        if (current <= 1) {
          clearInterval(typingTimer);
          if (!finishedRef.current) {
            finishedRef.current = true;
            onFinish?.(Number(((Date.now() - startedAtRef.current) / 1000).toFixed(2)));
          }
          return 0;
        }
        return current - 1;
      });
    }, 1000);

    return () => clearInterval(typingTimer);
  }, [typingEnabled, onFinish]);

  const handleSubmit = async () => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    await onFinish?.(Number(((Date.now() - startedAtRef.current) / 1000).toFixed(2)));
  };

  return (
    <div className="task-box">
      <p className="eyebrow">{t.language}</p>
      <h2>{t.languagePrompt}</h2>
      <div className="memory-timer-box">{typingEnabled ? `Time remaining: ${typingCountdown}s` : "Prepare to remember the sentence"}</div>
      <div className="sentence-prompt-box">
        <strong>Sentence to repeat:</strong>{" "}
        {sentenceVisible
          ? (value.prompt || "The early morning sun is bright in our town.")
          : typingEnabled
            ? "Now type the sentence from memory and list as many animals as you can."
            : "Sentence will appear in a few seconds..."}
      </div>
      <div className="form-grid long-form">
        <label className="prompt-field">
          <span>Write the sentence you heard</span>
          <textarea
            value={value.sentence}
            onChange={(e) => setValue((prev) => ({ ...prev, sentence: e.target.value }))}
            placeholder={typingEnabled ? "Type the sentence exactly as you remember it." : "The sentence will appear shortly."}
            disabled={!typingEnabled}
          />
        </label>
        <label className="prompt-field">
          <span>Write animal names</span>
          <textarea
            value={value.animals}
            onChange={(e) => setValue((prev) => ({ ...prev, animals: e.target.value }))}
            placeholder="Example: dog, cat, bird, tiger"
            disabled={!typingEnabled}
          />
        </label>
      </div>
      <div className="task-actions">
        <button className="primary-btn" onClick={handleSubmit}>{t.submit}</button>
      </div>
    </div>
  );
}

function ResultSummary({ result, t }) {
  const taskResults = result?.taskResults || {};
  const flags = Array.isArray(result?.flags) ? result.flags : [];
  const isSimulatedDemo = result?.demo === true && result?.simulated === true;
  const modelOutput = result?.modelOutput;
  const cognitiveTaskScore = result?.cognitiveTaskScore || result?.descriptiveTaskSummary;
  const simulatedProbability = calculateSimulatedDementiaProbability(cognitiveTaskScore?.index_percent);
  const voiceAnalysisSummary = result?.voiceAnalysisSummary;
  const cognitivePrediction = result?.cognitivePrediction || modelOutput;
  const voicePrediction = result?.voicePrediction;
  const voiceFeatures = taskResults.voice?.measurements?.speech_features;
  const transcriptAnalysis = taskResults.voice?.measurements?.transcript_analysis;
  const hasVoiceObservations = Boolean(
    voiceAnalysisSummary?.score_percent != null
    || hasMeasuredValue(transcriptAnalysis?.observations)
    || hasMeasuredValue(voiceFeatures?.features)
  );
  const taskNames = { memory: "Memory recall", attention: "Attention task", orientation: "Orientation", language: "Language fluency" };

  return (
    <div className="result-panel">
      <p className="eyebrow">{t.summary}</p>
      <h2>{isSimulatedDemo ? "Simulated demo report" : "Digital assessment report"}</h2>
      <div className="report-warning" role="note">
        {isSimulatedDemo
          ? "SIMULATED DEMO ONLY - synthetic test fixtures, not a real assessment, trained model result, diagnosis, or risk estimate."
          : "Research and educational prototype only. This report does not diagnose or rule out dementia and does not provide a clinical risk score."}
      </div>
      {!isSimulatedDemo && cognitiveTaskScore && (
        <section className="report-section" aria-label="Cognitive assessment">
          <h3>Cognitive Assessment</h3>
          <p>
            <strong>Task-performance score: </strong>
            {cognitiveTaskScore.index_percent == null
              ? "Not measured"
              : `${cognitiveTaskScore.index_percent}/100`}
            {" "}({cognitiveTaskScore.status})
          </p>
          <p>{cognitiveTaskScore.method}</p>
          {cognitiveTaskScore.not_measured_tasks?.length > 0 && (
            <p>Missing/not measured tasks: {cognitiveTaskScore.not_measured_tasks.join(", ")}</p>
          )}
          <p>{cognitiveTaskScore.limitation}</p>
        </section>
      )}
      {isSimulatedDemo && (
        <section className="simulated-probability-card" aria-label="Simulated dementia probability">
          <h3>Simulated Dementia Probability (Demo Only)</h3>
          <p className="simulated-probability-value">
            {simulatedProbability == null ? "Not available" : `${simulatedProbability.toFixed(2)}%`}
          </p>
          <p>
            Illustrative score-to-percentage mapping for an educational demonstration.
            Not a clinically validated probability or diagnosis.
          </p>
          {cognitiveTaskScore?.index_percent != null && (
            <p className="muted-text">
              Based only on cognitive task-performance score: {cognitiveTaskScore.index_percent}/100.
            </p>
          )}
        </section>
      )}
      <div className="metric-grid">
        {Object.entries(taskNames).map(([key, title]) => (
          <div key={key} className="report-item"><span>{title}</span><strong>{taskResults[key]?.status || "not assessed"}</strong></div>
        ))}
      </div>
      {hasVoiceObservations && <section className="report-section">
        <h3>Voice Analysis</h3>
        {voiceAnalysisSummary?.score_percent != null && (
          <>
            <p>
              <strong>Experimental speech-fluency indicator: </strong>
              {`${voiceAnalysisSummary.score_percent}/100`}
            </p>
            <p>{voiceAnalysisSummary.method}</p>
            <p>{voiceAnalysisSummary.limitation}</p>
          </>
        )}
        {isSimulatedDemo && <p>Synthetic transcript fixture only - no audio recording or transcription was performed.</p>}
        {taskResults.voice?.measurements?.language && <p>Language: {taskResults.voice.measurements.language}</p>}
        {taskResults.voice?.measurements?.duration != null && <p>Recorded duration: {Number(taskResults.voice.measurements.duration).toFixed(1)} seconds</p>}
        <TranscriptObservationList analysis={transcriptAnalysis} />
        {!isSimulatedDemo && <p>Transcript text and raw audio are not retained in the report; descriptive counts and measured timing summaries are saved.</p>}
        <SpeechTimingObservations speechFeatures={voiceFeatures} />
        <p>Experimental transcript and audio observations only. English-specific rules may be unreliable due to language, accent, education, fluency, background noise, and other conditions.</p>
      </section>}
      <section className="report-section" aria-label="Overall assessment">
        <h3>Overall Assessment</h3>
        <p>Cognitive task-performance and voice results are shown separately. They are not combined into a dementia-risk percentage.</p>
        <p><strong>Cognitive:</strong> {cognitiveTaskScore?.index_percent == null ? "Not measured" : `${cognitiveTaskScore.index_percent}/100`}</p>
        {voiceAnalysisSummary?.score_percent != null && (
          <p><strong>Voice experimental indicator:</strong> {`${voiceAnalysisSummary.score_percent}/100`}</p>
        )}
      </section>
      {isRenderablePrediction(cognitivePrediction) && <section className="report-section">
        <h3>Cognitive prediction</h3>
        <PredictionResult prediction={cognitivePrediction} label="Cognitive model" />
      </section>}
      {isRenderablePrediction(voicePrediction) && <section className="report-section">
        <h3>Voice prediction</h3>
        <PredictionResult prediction={voicePrediction} label="Voice model" />
      </section>}
      {flags.length > 0 && <section className="report-section"><h3>Assessment notes</h3><ul className="flag-list">{flags.map((flag, index) => <li key={index}>{flag}</li>)}</ul></section>}
      {result?.multimodalSummary && <MultimodalSummary summary={result.multimodalSummary} />}
    </div>
  );
}

function PredictionResult({ prediction, label }) {
  const scores = formatPredictionScores(prediction?.output?.class_scores);
  return (
    <div className="prediction-card">
      <p><strong>{label} class:</strong> {prediction.output.predicted_label}</p>
      {scores.length > 0 && (
        <div className="prediction-scores">
          {scores.map(({ label: scoreLabel, score }) => (
            <span key={scoreLabel}><strong>{scoreLabel}</strong> {score.toFixed(1)}% model score</span>
          ))}
        </div>
      )}
      <p className="muted-text">Research output only. Model scores are not clinical probabilities.</p>
    </div>
  );
}

function TranscriptObservationList({ analysis }) {
  const observations = analysis?.observations;
  if (!observations) {
    return null;
  }
  const display = (value) => value == null ? "Not measured" : value;
  const formatCounts = (counts) => counts == null
    ? "Not measured"
    : Object.entries(counts)
      .filter(([, count]) => count > 0)
      .map(([term, count]) => `${term}: ${count}`)
      .join(", ") || "0";
  return (
    <section className="report-section" aria-label="Transcript observations">
      <h3>Experimental rule-based speech observations — not a diagnosis</h3>
      <p>Literal transcript counts only. No threshold or impairment score is applied; ordinary speech can include these patterns.</p>
      <ul className="feature-list">
        <li>Words: {display(observations.word_count)}</li>
        <li>Sentences: {display(observations.sentence_count)}</li>
        <li>Average words per sentence: {display(observations.average_words_per_sentence)}</li>
        <li>English filler-word counts by token: {formatCounts(observations.filler_word_counts)}</li>
        <li>Adjacent repeated words: {display(observations.repeated_adjacent_word_count)}</li>
        <li>Repeated short phrases: {display(observations.repeated_short_phrase_count)}</li>
        <li>Unique-word ratio: {display(observations.unique_word_ratio)}</li>
        <li>Self-correction marker counts: {formatCounts(observations.self_correction_marker_counts)}</li>
        <li>Selected vague-expression counts: {formatCounts(observations.selected_vague_expression_counts)}</li>
      </ul>
      <p>Known prompt: picture description. No semantic relevance, omitted-detail, or picture-scoring comparison is performed. English-specific rules may be unreliable due to language, accent, education, fluency, background noise, and other conditions.</p>
    </section>
  );
}

function SpeechTimingObservations({ speechFeatures }) {
  const features = speechFeatures?.features || {};
  if (!Object.values(features).some((value) => value != null)) return null;
  const display = (value) => value == null ? "Not measured" : value;
  return (
    <section className="report-section" aria-label="Speech timing observations">
      <h3>Audio-timing observations</h3>
      <ul className="feature-list">
        <li>Audio duration: {display(features.audio_duration_seconds)}{features.audio_duration_seconds == null ? "" : " seconds"}</li>
        <li>Speaking duration: {display(features.speaking_duration_seconds)}{features.speaking_duration_seconds == null ? "" : " seconds"}</li>
        <li>Filler ratio: {display(features.filler_word_ratio_percent)}{features.filler_word_ratio_percent == null ? "" : "%"}</li>
        <li>Speech rate from valid timed speech: {display(features.speech_rate_words_per_minute)}{features.speech_rate_words_per_minute == null ? "" : " words/min"}</li>
        <li>Observed timed segment gaps: {display(features.pause_count)}</li>
        <li>Mean observed gap: {display(features.mean_pause_seconds)}{features.mean_pause_seconds == null ? "" : " seconds"}</li>
        <li>Maximum observed gap: {display(features.maximum_pause_seconds)}{features.maximum_pause_seconds == null ? "" : " seconds"}</li>
        <li>Estimated non-speech ratio from segment timing: {features.estimated_non_speech_ratio == null ? "Not measured" : `${(features.estimated_non_speech_ratio * 100).toFixed(1)}%`}</li>
        <li>Pitch statistics: Not measured</li>
      </ul>
      <p>Timing values require valid audio duration and transcription segment timestamps. The ratio is not waveform-based silence detection and may include noise or omitted speech.</p>
    </section>
  );
}

export default App;