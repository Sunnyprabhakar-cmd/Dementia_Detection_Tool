import { useEffect, useMemo, useRef, useState } from "react";
import "./App.css";

const buildDemoMlRecord = (screeningResult = {}) => {
  const overallScore = Number(screeningResult.overallScore || 0);
  const riskScore = Number(screeningResult.riskScore || 0);
  const mmseValue = Math.max(10, Math.min(30, Math.round((overallScore / 100) * 30)));
  const cdrValue = riskScore >= 60 ? 1.0 : riskScore >= 35 ? 0.5 : 0.0;

  return {
    Visit: 1,
    "MR Delay": 0,
    "M/F": "M",
    Hand: "R",
    Age: 72,
    EDUC: 12,
    SES: 2,
    MMSE: mmseValue,
    CDR: cdrValue,
    eTIV: 1678,
    nWBV: 0.736,
    ASF: 1.046,
  };
};

const languagePack = {
  en: {
    appName: "MindScan AI",
    subtitle: "Early dementia screening for clinical awareness",
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
    summary: "AI risk summary",
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
  const [email, setEmail] = useState("sunny@gmail.com");
  const [password, setPassword] = useState("123456");
  const [language, setLanguage] = useState("en");
  const [token, setToken] = useState(localStorage.getItem("token") || "");
  const [screeningId, setScreeningId] = useState(null);
  const [status, setStatus] = useState("");
  const [result, setResult] = useState(null);
  const [previousResults, setPreviousResults] = useState([]);
  const [activeStep, setActiveStep] = useState("dashboard");
  const [memoryData, setMemoryData] = useState(() => buildMemoryState());
  const [attentionData, setAttentionData] = useState({ correct: 0, wrong: 0, missed: 0, reactionTimes: [] });
  const [orientationData, setOrientationData] = useState({ year: "", month: "", date: "", place: "" });
  const [languageData, setLanguageData] = useState(() => buildLanguageState());
  const [voiceState, setVoiceState] = useState({ isRecording: false, status: "", fileName: "" });
  const [voiceAssessment, setVoiceAssessment] = useState({ score: 0, status: "Not started", duration: 0 });
  const [voiceTimeLeft, setVoiceTimeLeft] = useState(20);
  const mediaRecorderRef = useRef(null);
  const audioStreamRef = useRef(null);

  const t = languagePack[language] || languagePack.en;
  const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:3001";

  const audioToWavBlob = async (blob) => {
    const arrayBuffer = await blob.arrayBuffer();
    const AudioContextCtor = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextCtor) {
      return blob;
    }

    const audioContext = new AudioContextCtor();
    const decoded = await audioContext.decodeAudioData(arrayBuffer.slice(0));
    const channelCount = decoded.numberOfChannels;
    const sampleRate = decoded.sampleRate;
    const frameCount = decoded.length;
    const bytesPerSample = 2;
    const blockAlign = channelCount * bytesPerSample;
    const bufferLength = 44 + frameCount * blockAlign;
    const wavBuffer = new ArrayBuffer(bufferLength);
    const view = new DataView(wavBuffer);

    const writeString = (offset, text) => {
      for (let i = 0; i < text.length; i += 1) {
        view.setUint8(offset + i, text.charCodeAt(i));
      }
    };

    writeString(0, "RIFF");
    view.setUint32(4, 36 + frameCount * blockAlign, true);
    writeString(8, "WAVE");
    writeString(12, "fmt ");
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, channelCount, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * blockAlign, true);
    view.setUint16(32, blockAlign, true);
    view.setUint16(34, 16, true);
    writeString(36, "data");
    view.setUint32(40, frameCount * blockAlign, true);

    let offset = 44;
    const channelData = [];
    for (let ch = 0; ch < channelCount; ch += 1) {
      channelData.push(decoded.getChannelData(ch));
    }

    for (let i = 0; i < frameCount; i += 1) {
      for (let ch = 0; ch < channelCount; ch += 1) {
        const sample = Math.max(-1, Math.min(1, channelData[ch][i]));
        view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
        offset += 2;
      }
    }

    await audioContext.close();
    return new Blob([wavBuffer], { type: "audio/wav" });
  };

  const startVoiceRecording = async () => {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error("Microphone access is not available in this browser.");
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioStreamRef.current = stream;
      const recorder = new MediaRecorder(stream);
      const chunks = [];

      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          chunks.push(event.data);
        }
      };

      recorder.onstop = async () => {
        const originalBlob = new Blob(chunks, { type: recorder.mimeType || "audio/webm" });
        const wavBlob = await audioToWavBlob(originalBlob);

        try {
          setVoiceState((prev) => ({ ...prev, isRecording: false, status: "Uploading voice sample..." }));
          const response = await fetch(`${API_BASE_URL}/api/audio/upload?subject=${encodeURIComponent(email || "demo-user")}`, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "audio/wav"
            },
            body: wavBlob
          });
          const data = await response.json();
          if (!response.ok) {
            throw new Error(data.message || "Voice sample upload failed");
          }

          const qualityScore = Math.min(100, Math.max(28, Number((data.result?.anomaly_score ?? 65).toFixed(1))));
          const normalizedVoiceScore = 100 - qualityScore;

          setVoiceAssessment({
            score: normalizedVoiceScore,
            status: "completed",
            duration: 20
          });

          setVoiceState((prev) => ({
            ...prev,
            status: `${data.message || "Voice sample saved for audio analysis."} Voice score: ${normalizedVoiceScore.toFixed(1)}%.`,
            fileName: data.file || "voice_sample.wav"
          }));
        } catch (error) {
          setVoiceState((prev) => ({ ...prev, isRecording: false, status: error.message || "Voice upload failed." }));
        } finally {
          if (audioStreamRef.current) {
            audioStreamRef.current.getTracks().forEach((track) => track.stop());
            audioStreamRef.current = null;
          }
        }
      };

      mediaRecorderRef.current = recorder;
      recorder.start();
      setVoiceTimeLeft(20);
      setVoiceState({ isRecording: true, status: "Recording voice sample...", fileName: "" });

      const timer = setInterval(() => {
        setVoiceTimeLeft((current) => {
          if (current <= 1) {
            clearInterval(timer);
            if (recorder.state !== "inactive") {
              recorder.stop();
            }
            return 0;
          }
          return current - 1;
        });
      }, 1000);
    } catch (error) {
      setVoiceState({ isRecording: false, status: error.message || "Unable to start microphone recording.", fileName: "" });
    }
  };

  const stopVoiceRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
    if (audioStreamRef.current) {
      audioStreamRef.current.getTracks().forEach((track) => track.stop());
      audioStreamRef.current = null;
    }
    setVoiceState((prev) => ({ ...prev, isRecording: false, status: "Stopping recording..." }));
  };

  useEffect(() => {
    localStorage.setItem("token", token);
  }, [token]);

  const loadHistory = async () => {
    if (!token) return;

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
        overview: item.overview || "Assessment",
        score: Number(item.score || 0),
        overall: Number(item.overall || 0)
      })));
    } catch (error) {
      console.warn("History unavailable", error);
    }
  };

  useEffect(() => {
    if (token) {
      loadHistory();
    }
  }, [token]);

  const isLoggedIn = Boolean(token);

  const isAssessmentReady = useMemo(() => {
    return memoryData.wordsRecalled.some(Boolean) && attentionData.reactionTimes.length > 0 && Object.values(orientationData).every(Boolean) && (languageData.sentence || languageData.animals);
  }, [memoryData, attentionData, orientationData, languageData]);

  const handleAuth = async () => {
    try {
      setStatus("Authenticating...");
      const endpoint = authMode === "login" ? "/api/auth/login" : "/api/auth/register";
      const payload = authMode === "login"
        ? { email, password }
        : { name, email, password, referBy: "student-project" };

      const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Authentication failed");

      if (authMode === "login") {
        setToken(data.token || "");
        setStatus("Login successful. You can begin the screening.");
      } else {
        setStatus("Registration successful. Please log in.");
        setAuthMode("login");
      }
    } catch (error) {
      setStatus(error.message || "Something went wrong");
    }
  };

  const createScreeningSession = async () => {
    const response = await fetch(`${API_BASE_URL}/api/screening/start`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` }
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || "Unable to start screening");
    setScreeningId(data.screening.id);
    return data.screening.id;
  };

  const startScreening = async () => {
    try {
      setStatus("Starting AI screening session...");
      const id = await createScreeningSession();
      setMemoryData(buildMemoryState());
      setLanguageData(buildLanguageState());
      setVoiceAssessment({ score: 0, status: "Not started", duration: 0 });
      setActiveStep("memory");
      setStatus("Session started. Begin the assessment.");
      return id;
    } catch (error) {
      setStatus(error.message || "Unable to start screening");
      return null;
    }
  };

  const submitStep = async (taskType, taskPayload) => {
    if (!screeningId) return null;

    try {
      const response = await fetch(`${API_BASE_URL}/api/screening/${screeningId}/response`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          taskType,
          responseData: taskPayload,
          reactionTime: taskPayload.averageReactionTime || taskPayload.responseTime || 0
        })
      });

      const data = await response.json();
      if (!response.ok) {
        const message = data.message || "Failed to save task";
        if (/screening not found/i.test(message)) {
          const recoveredId = await createScreeningSession();
          const retryResponse = await fetch(`${API_BASE_URL}/api/screening/${recoveredId}/response`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`
            },
            body: JSON.stringify({
              taskType,
              responseData: taskPayload,
              reactionTime: taskPayload.averageReactionTime || taskPayload.responseTime || 0
            })
          });
          const retryData = await retryResponse.json();
          if (!retryResponse.ok) throw new Error(retryData.message || "Failed to save task after recovering session");
          setStatus(`${taskType} task saved successfully after recovering the session.`);
          return retryData;
        }
        throw new Error(message);
      }

      setStatus(`${taskType} task saved successfully.`);
      return data;
    } catch (error) {
      setStatus(error.message || "Error saving task");
      return null;
    }
  };

  const finishAssessment = async () => {
    if (!screeningId) return;

    try {
      const response = await fetch(`${API_BASE_URL}/api/screening/${screeningId}/result`, {
        method: "GET",
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Could not compute risk");

      let mergedResult = { ...data.result };

      try {
        const agentResponse = await fetch(`${API_BASE_URL}/api/ai/analyze`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({
            screeningId,
            taskScores: data.result.taskScores,
            riskScore: data.result.riskScore,
            overallScore: data.result.overallScore
          })
        });
        const agentData = await agentResponse.json();
        if (agentResponse.ok && agentData?.result) {
          mergedResult = { ...mergedResult, ...agentData.result };
        }
      } catch (agentError) {
        console.warn("Agent analysis unavailable", agentError);
      }

      try {
        const mlResponse = await fetch(`${API_BASE_URL}/api/ml/predict`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify(buildDemoMlRecord(data.result))
        });
        const mlData = await mlResponse.json();
        if (mlResponse.ok && mlData?.prediction) {
          mergedResult = {
            ...mergedResult,
            mlProbability: Number(mlData.prediction.risk_probability ?? 0),
            mlLabel: mlData.prediction.label || "Assessment",
            mlPrediction: Number(mlData.prediction.prediction ?? 0)
          };
        }
      } catch (mlError) {
        console.warn("ML probability unavailable", mlError);
      }

      try {
        const audioResponse = await fetch(`${API_BASE_URL}/api/audio/analysis`, {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`
          }
        });
        const audioData = await audioResponse.json();
        if (audioResponse.ok && audioData?.result) {
          mergedResult = {
            ...mergedResult,
            audioAgent: audioData.result
          };
        }
      } catch (audioError) {
        console.warn("Audio agent unavailable", audioError);
      }

      const historyEntry = {
        id: screeningId,
        timestamp: new Date().toLocaleString(),
        overview: mergedResult.riskLevel || "Assessment",
        score: mergedResult.riskScore || 0,
        overall: mergedResult.overallScore || 0,
      };

      mergedResult.voiceAssessment = voiceAssessment;
      mergedResult.voiceScore = Number(voiceAssessment.score || 0);

      setPreviousResults((prev) => {
        const deduped = prev.filter((item) => item.id !== historyEntry.id);
        return [historyEntry, ...deduped].slice(0, 5);
      });
      await loadHistory();
      setResult(mergedResult);
      setActiveStep("summary");
      setStatus("AI risk analysis complete");
    } catch (error) {
      setStatus(error.message || "Unable to compute summary");
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
    setVoiceAssessment({ score: 0, status: "Not started", duration: 0 });
  };

  const logout = () => {
    setToken("");
    setScreeningId(null);
    setResult(null);
    setActiveStep("dashboard");
    setStatus("");
    localStorage.removeItem("token");
  };

  if (!isLoggedIn) {
    return (
      <div className="auth-shell">
        <div className="auth-card">
          <div className="brand-row">
            <div className="brand-badge">M</div>
            <div>
              <h1>{t.appName}</h1>
              <p>{t.subtitle}</p>
            </div>
          </div>

          <div className="toggle-row">
            <button className={authMode === "login" ? "toggle active" : "toggle"} onClick={() => setAuthMode("login")}>{t.login}</button>
            <button className={authMode === "register" ? "toggle active" : "toggle"} onClick={() => setAuthMode("register")}>{t.register}</button>
          </div>

          {authMode === "register" && (
            <label>
              <span>{t.fullName}</span>
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder={t.fullName} />
            </label>
          )}

          <label>
            <span>{t.email}</span>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder={t.email} />
          </label>

          <label>
            <span>{t.password}</span>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder={t.password} />
          </label>

          <label>
            <span>{t.chooseLanguage}</span>
            <select value={language} onChange={(e) => setLanguage(e.target.value)}>
              <option value="en">English</option>
              <option value="si">Sinhala</option>
              <option value="ta">தமிழ்</option>
            </select>
          </label>

          <button className="primary-btn" onClick={handleAuth}>{authMode === "login" ? t.login : t.register}</button>
          {status && <p className="status-pill">{status}</p>}
        </div>
      </div>
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

      <main className="main-grid">
        <aside className="sidebar card">
          <h3>{t.patient}</h3>
          <div className="profile-list">
            <div><span>Language</span><strong>{language.toUpperCase()}</strong></div>
            <div><span>Screening ID</span><strong>{screeningId || "Not started"}</strong></div>
            <div><span>Risk status</span><strong>{result ? result.riskLevel : "Awaiting score"}</strong></div>
          </div>

          <div className="voice-panel">
            <h4>Voice sample</h4>
            <p className="muted-text">Research-only recording for acoustic signal review. This is not a diagnosis.</p>
            <div className="voice-indicator">
              <span className={voiceState.isRecording ? "record-dot active" : "record-dot"}></span>
              {voiceState.isRecording ? `Recording... ${voiceTimeLeft}s` : `Ready: ${voiceTimeLeft}s`}
            </div>
            {!voiceState.isRecording ? (
              <button className="primary-btn" onClick={startVoiceRecording}>Record sample</button>
            ) : (
              <button className="ghost-btn" onClick={stopVoiceRecording}>Stop recording</button>
            )}
            {voiceState.status && <p className="status-pill">{voiceState.status}</p>}
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
                    <small>{item.score} risk / {item.overall}% overall</small>
                  </div>
                ))}
              </div>
            )}
          </div>
        </aside>

        <section className="content-panel card">
          {activeStep === "dashboard" && (
            <div className="empty-state">
              <h2>{t.startScreening}</h2>
              <p>{t.subtitle}</p>
              <button className="primary-btn" onClick={startScreening}>{t.startScreening}</button>
            </div>
          )}

          {activeStep === "memory" && (
            <MemoryTask
              t={t}
              value={memoryData}
              setValue={setMemoryData}
              onNext={async () => {
                const payload = {
                  wordsShown: memoryData.wordsShown,
                  wordsRecalled: memoryData.wordsRecalled,
                  responseTime: 12.5
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
              onNext={async () => {
                const payload = {
                  totalRounds: 10,
                  correct: attentionData.correct,
                  wrong: attentionData.wrong,
                  missed: attentionData.missed,
                  averageReactionTime: attentionData.reactionTimes.length
                    ? (attentionData.reactionTimes.reduce((sum, time) => sum + time, 0) / attentionData.reactionTimes.length).toFixed(2)
                    : 0,
                  reactionTimes: attentionData.reactionTimes
                };
                await submitStep("attention", payload);
                setActiveStep("orientation");
              }}
            />
          )}

          {activeStep === "orientation" && (
            <OrientationTask
              t={t}
              value={orientationData}
              setValue={setOrientationData}
              onNext={async () => {
                const payload = { ...orientationData, responseTime: 10.5 };
                await submitStep("orientation", payload);
                setActiveStep("voice");
              }}
            />
          )}

          {activeStep === "voice" && (
            <VoiceTask
              token={token}
              email={email}
              onVoiceResult={(assessment) => setVoiceAssessment(assessment)}
              onFinish={async () => {
                await submitStep("voice", {
                  recorded: true,
                  status: voiceAssessment.status || "completed",
                  responseTime: voiceAssessment.duration || 20,
                  voiceScore: voiceAssessment.score || 0
                });
                setActiveStep("language");
              }}
            />
          )}

          {activeStep === "language" && (
            <LanguageTask
              t={t}
              value={languageData}
              setValue={setLanguageData}
              onFinish={async () => {
                const payload = {
                  sentence: languageData.sentence,
                  animals: languageData.animals,
                  responseTime: 14
                };
                await submitStep("language", payload);
                await finishAssessment();
              }}
            />
          )}

              {activeStep === "summary" && result && (
            <>
              <ResultSummary result={result} t={t} />
              <div className="summary-actions">
                <button className="primary-btn" onClick={resetAssessment}>Test again</button>
              </div>
              <div className="architecture-panel">
                <h3>Clinical report overview</h3>
                <div className="architecture-grid">
                  <div><span>Data Layer</span><strong>Longitudinal clinical dataset</strong></div>
                  <div><span>Feature Layer</span><strong>MMSE, memory, attention, language, orientation</strong></div>
                  <div><span>ML Layer</span><strong>Baseline classifier + risk scoring</strong></div>
                  <div><span>Clinical Layer</span><strong>Referral & monitoring recommendation</strong></div>
                </div>
              </div>
            </>
          )}

          {status && !result && <p className="status-pill fixed-status">{status}</p>}
        </section>
      </main>
    </div>
  );
}

function MemoryTask({ t, value, setValue, onNext }) {
  const [showWords, setShowWords] = useState(true);
  const [countdown, setCountdown] = useState(8);

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
        <button className="primary-btn" onClick={onNext}>{t.next}</button>
      </div>
    </div>
  );
}

function AttentionTask({ t, value, setValue, onNext }) {
  const [isTargetVisible, setIsTargetVisible] = useState(false);
  const [timerId, setTimerId] = useState(null);
  const [round, setRound] = useState(1);

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
        if (round >= 10) {
          return;
        }
        setRound((r) => r + 1);
      }, 1600);
      setTimerId({ start, autoTimeout });
    }, delay);

    return () => clearTimeout(delay);
  }, [round]);

  const handleClick = () => {
    if (!isTargetVisible) {
      setValue((prev) => ({ ...prev, wrong: prev.wrong + 1 }));
      return;
    }

    const reaction = ((Date.now() - timerId.start) / 1000).toFixed(2);
    clearTimeout(timerId.autoTimeout);
    setValue((prev) => ({
      ...prev,
      correct: prev.correct + 1,
      reactionTimes: [...prev.reactionTimes, Number(reaction)]
    }));
    setIsTargetVisible(false);
    if (round >= 10) {
      onNext();
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
        <button className="primary-btn" onClick={onNext}>{t.next}</button>
      </div>
    </div>
  );
}

function OrientationTask({ t, value, setValue, onNext }) {
  const [countdown, setCountdown] = useState(20);
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
        <button className="primary-btn" onClick={onNext}>{t.next}</button>
      </div>
    </div>
  );
}

function VoiceTask({ token, email, onVoiceResult, onFinish }) {
  const [countdown, setCountdown] = useState(20);
  const [isRecording, setIsRecording] = useState(false);
  const [status, setStatus] = useState("Ready to record a short voice sample.");
  const mediaRecorderRef = useRef(null);
  const streamRef = useRef(null);

  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown((current) => {
        if (current <= 1) {
          clearInterval(timer);
          return 0;
        }
        return current - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const recorder = new MediaRecorder(stream);
      const chunks = [];

      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) chunks.push(event.data);
      };

      recorder.onstop = async () => {
        const blob = new Blob(chunks, { type: recorder.mimeType || "audio/webm" });
        const arrayBuffer = await blob.arrayBuffer();
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const decoded = await audioContext.decodeAudioData(arrayBuffer.slice(0));

        const channelData = [];
        for (let channel = 0; channel < decoded.numberOfChannels; channel += 1) {
          channelData.push(decoded.getChannelData(channel));
        }

        const samples = channelData[0];
        const mean = samples.reduce((sum, value) => sum + Math.abs(value), 0) / samples.length;
        const score = Math.min(100, Math.max(0, (mean * 2500) * 100));
        const assessment = { score: Number(score.toFixed(1)), status: "completed", duration: 20 };

        setStatus(`Voice sample captured. Audio quality score: ${assessment.score.toFixed(1)}.`);
        if (onVoiceResult) {
          onVoiceResult(assessment);
        }

        try {
          const response = await fetch(`${API_BASE_URL}/api/audio/upload?subject=${encodeURIComponent(email || "demo-user")}`, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "audio/wav"
            },
            body: new Blob([blob], { type: "audio/wav" })
          });

          const data = await response.json();
          if (!response.ok) throw new Error(data.message || "Voice sample could not be uploaded.");
          setStatus(`${data.message || "Voice assessment recorded successfully."} Voice score: ${assessment.score.toFixed(1)}%.`);
        } catch (error) {
          setStatus(error.message || "The voice sample could not be evaluated.");
        } finally {
          if (streamRef.current) {
            streamRef.current.getTracks().forEach((track) => track.stop());
            streamRef.current = null;
          }
          setIsRecording(false);
          await audioContext.close();
        }
      };

      recorder.start();
      mediaRecorderRef.current = recorder;
      setIsRecording(true);
      setStatus("Recording in progress. Please speak naturally for 15–20 seconds.");

      setTimeout(() => {
        if (recorder.state !== "inactive") {
          stopRecording();
        }
      }, 20000);
    } catch (error) {
      setStatus(error.message || "Microphone access is not available.");
    }
  };

  return (
    <div className="task-box">
      <p className="eyebrow">Voice assessment</p>
      <h2>Record a short voice sample and speak naturally for 20 seconds.</h2>
      <div className="memory-timer-box">Time remaining: {countdown}s</div>
      <div className="voice-recording-box">
        <button className="primary-btn" onClick={isRecording ? stopRecording : startRecording}>
          {isRecording ? "Stop recording" : "Start recording"}
        </button>
        <p>{status}</p>
      </div>
      <div className="task-actions">
        <button className="primary-btn" onClick={onFinish} disabled={isRecording}>Continue</button>
      </div>
    </div>
  );
}

function LanguageTask({ t, value, setValue, onFinish }) {
  const [sentenceCountdown, setSentenceCountdown] = useState(5);
  const [typingCountdown, setTypingCountdown] = useState(30);
  const [sentenceVisible, setSentenceVisible] = useState(false);
  const [typingEnabled, setTypingEnabled] = useState(false);
  const finishedRef = useRef(false);

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
            onFinish?.();
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
    await onFinish?.();
  };

  return (
    <div className="task-box">
      <p className="eyebrow">{t.language}</p>
      <h2>{t.languagePrompt}</h2>
      <div className="memory-timer-box">Time remaining: {typingEnabled ? typingCountdown : sentenceCountdown}s</div>
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
  const agents = Array.isArray(result?.agents) ? result.agents : [];
  const audioAgent = result?.audioAgent || null;
  const riskPercent = typeof result?.mlProbability === "number" ? (result.mlProbability * 100).toFixed(1) : null;
  const flags = Array.isArray(result?.flags) ? result.flags : [];
  const voiceScore = typeof result?.voiceScore === "number" ? result.voiceScore : (typeof result?.voiceAssessment?.score === "number" ? result.voiceAssessment.score : null);

  return (
    <div className="result-panel">
      <p className="eyebrow">{t.summary}</p>
      <h2>Clinical referral profile</h2>

      {voiceScore !== null && (
        <div className="voice-summary-banner">
          <strong>Voice screening score:</strong> {voiceScore.toFixed(1)}% • {result?.voiceAssessment?.status || "completed"}
        </div>
      )}

      <div className="summary-header">
        <div className="score-ring">
          <strong>{result.riskScore}</strong>
          <span>AI risk score</span>
        </div>

        <div className="risk-card">
          <span className="mini-label">ML model probability</span>
          <strong>{riskPercent ? `${riskPercent}%` : "N/A"}</strong>
          <small>{result.mlLabel || "Model output pending"}</small>
        </div>

        <div className="risk-card">
          <span className="mini-label">Voice screening</span>
          <strong>{voiceScore !== null ? `${voiceScore.toFixed(1)}%` : "N/A"}</strong>
          <small>{result?.voiceAssessment?.status || "Voice not evaluated"}</small>
        </div>
      </div>

      <div className="metric-grid">
        <div><span>Risk grade</span><strong>{result.riskLevel}</strong></div>
        <div><span>Overall score</span><strong>{result.overallScore}%</strong></div>
        <div><span>Clinical action</span><strong>{result.recommendation}</strong></div>
      </div>

      <div className="report-grid">
        <div className="report-item">
          <span>Voice assessment</span>
          <strong>{voiceScore !== null ? `${voiceScore.toFixed(1)}%` : "Not available"}</strong>
        </div>
        <div className="report-item">
          <span>Audio research agent</span>
          <strong>{audioAgent ? (audioAgent.screening_indicator || "Available") : "Pending"}</strong>
        </div>
        <div className="report-item">
          <span>ML model output</span>
          <strong>{riskPercent ? `${riskPercent}%` : "N/A"}</strong>
        </div>
      </div>

      <div className="agent-summary-box">
        <h3>Multi-agent AI Interpretation</h3>
        <p>{result.agentSummary || "AI agents are aggregating the cognitive patterns."}</p>
      </div>

      <div className="agent-grid">
        {agents.map((agent) => (
          <div key={agent.name} className="agent-card">
            <div className="agent-head">
              <strong>{agent.name}</strong>
              <span>{agent.confidence}% confidence</span>
            </div>
            <p>{agent.insight}</p>
          </div>
        ))}

        {audioAgent && (
          <div className="agent-card">
            <div className="agent-head">
              <strong>{audioAgent.model_name || "Audio Agent"}</strong>
              <span>{audioAgent.status || "available"}</span>
            </div>
            <p>{audioAgent.limitation || "Research audio pattern evaluation is available, but it is not a dementia diagnosis."}</p>
            <small>{audioAgent.anomaly_score ?? 0}% anomaly signal • {audioAgent.screening_indicator || "insufficient_data"}</small>
          </div>
        )}
      </div>

      <ul className="flag-list">
        {flags.map((flag, index) => (
          <li key={index}>{flag}</li>
        ))}
      </ul>
    </div>
  );
}

export default App;