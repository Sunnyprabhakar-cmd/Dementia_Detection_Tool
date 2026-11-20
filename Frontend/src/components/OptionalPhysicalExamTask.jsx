import { useState } from "react";

const BODY_REGIONS = [
  "Left arm",
  "Right arm",
  "Left hand",
  "Right hand",
  "Left leg",
  "Right leg",
  "Left foot",
  "Right foot",
  "Other"
];

const SENSORY_METHODS = ["Light touch", "Other clinician-specified method"];
const SENSORY_RESPONSES = [
  "Responded normally",
  "Reduced response observed",
  "No response observed",
  "Inconsistent response",
  "Unable to assess"
];

const REFLEX_SITES = ["Biceps", "Triceps", "Brachioradialis", "Patellar", "Achilles", "Other"];
const REFLEX_SIDES = ["Left", "Right", "Both"];
const REFLEX_RESPONSES = ["Present", "Reduced", "Absent", "Brisk", "Unable to assess"];
const EXAMINER_ROLES = ["Attendant", "Nurse", "Doctor", "Other"];

const defaultDateTimeLocal = () => {
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60000;
  return new Date(now.getTime() - offset).toISOString().slice(0, 16);
};

function OptionalPhysicalExamTask({ onNext }) {
  const [entered, setEntered] = useState(false);
  const [examinerName, setExaminerName] = useState("");
  const [examinerRole, setExaminerRole] = useState("Attendant");
  const [examinedAt, setExaminedAt] = useState(defaultDateTimeLocal);
  const [additionalObservations, setAdditionalObservations] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [skipReason, setSkipReason] = useState("");

  // Sensory builder state
  const [bodyRegion, setBodyRegion] = useState("Right arm");
  const [examinationMethod, setExaminationMethod] = useState("Light touch");
  const [customMethod, setCustomMethod] = useState("");
  const [sensoryResponse, setSensoryResponse] = useState("Responded normally");
  const [sensoryNotes, setSensoryNotes] = useState("");
  const [sensoryObservations, setSensoryObservations] = useState([]);

  // Reflex builder state
  const [reflexSite, setReflexSite] = useState("Patellar");
  const [reflexSide, setReflexSide] = useState("Both");
  const [reflexResponse, setReflexResponse] = useState("Present");
  const [reflexNotes, setReflexNotes] = useState("");
  const [reflexObservations, setReflexObservations] = useState([]);

  const addSensoryObservation = () => {
    setErrorMessage("");
    if (examinationMethod === "Other clinician-specified method" && !customMethod.trim()) {
      setErrorMessage("Please specify the clinician-specified sensory examination method.");
      return;
    }
    setSensoryObservations((prev) => [
      ...prev,
      {
        examinationType: "sensory",
        bodyRegion,
        examinationMethod,
        ...(examinationMethod === "Other clinician-specified method" ? { customMethod: customMethod.trim() } : {}),
        response: sensoryResponse,
        notes: sensoryNotes.trim()
      }
    ]);
    setCustomMethod("");
    setSensoryNotes("");
  };

  const addReflexObservation = () => {
    setErrorMessage("");
    setReflexObservations((prev) => [
      ...prev,
      {
        examinationType: "reflex",
        reflexSite,
        side: reflexSide,
        response: reflexResponse,
        notes: reflexNotes.trim()
      }
    ]);
    setReflexNotes("");
  };

  const handleSave = () => {
    setErrorMessage("");
    if (!examinerName.trim()) {
      setErrorMessage("Examiner name is required to save physical examination observations.");
      return;
    }
    if (!examinedAt) {
      setErrorMessage("Examination date and time are required.");
      return;
    }
    if (sensoryObservations.length === 0 && reflexObservations.length === 0) {
      setErrorMessage("Add at least one sensory or reflex observation, or skip this optional examination.");
      return;
    }
    onNext({
      examinerName: examinerName.trim(),
      examinerRole,
      examinedAt: new Date(examinedAt).toISOString(),
      additionalObservations: additionalObservations.trim(),
      sensoryObservations,
      reflexObservations
    });
  };

  return (
    <div className="task-box">
      <p className="eyebrow">Optional in-person clinical examination</p>
      <h2>Optional Physical Examination</h2>
      <p>
        This optional examination must be performed in person by a trained attendant or qualified healthcare
        professional. The examiner records the patient&apos;s observed sensory or reflex responses. Patients must not
        perform this task independently.
      </p>
      <div className="report-warning" role="note" style={{ marginBottom: "12px" }}>
        <strong>Clinical Qualification Notice:</strong> Only a qualified healthcare professional should perform and
        interpret reflex examinations. An attendant without appropriate clinical qualifications cannot independently
        diagnose neurological abnormalities. Observations recorded here do not affect the cognitive score or speech
        classification.
      </div>

      {!entered && (
        <div className="task-actions" style={{ marginBottom: "12px" }}>
          <button type="button" className="primary-btn" onClick={() => setEntered(true)}>
            Start examination / Enter observations
          </button>
        </div>
      )}

      {entered && (
        <div style={{ display: "grid", gap: "16px", marginBottom: "14px" }}>
          <fieldset style={{ border: "1px solid #cbd5e1", borderRadius: "8px", padding: "12px" }}>
            <legend><strong>Examiner Details</strong></legend>
            <div style={{ display: "grid", gap: "10px" }}>
              <label>
                <span>Examiner name</span>
                <input
                  value={examinerName}
                  onChange={(e) => setExaminerName(e.target.value)}
                  maxLength={120}
                  placeholder="Full name of attendant or clinician"
                />
              </label>
              <label>
                <span>Examiner role</span>
                <select value={examinerRole} onChange={(e) => setExaminerRole(e.target.value)}>
                  {EXAMINER_ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
                </select>
              </label>
              <label>
                <span>Examination date and time</span>
                <input
                  type="datetime-local"
                  value={examinedAt}
                  onChange={(e) => setExaminedAt(e.target.value)}
                />
              </label>
              <label>
                <span>Additional observations (optional)</span>
                <textarea
                  value={additionalObservations}
                  onChange={(e) => setAdditionalObservations(e.target.value)}
                  maxLength={1000}
                  placeholder="General observational notes..."
                />
              </label>
            </div>
          </fieldset>

          <fieldset style={{ border: "1px solid #cbd5e1", borderRadius: "8px", padding: "12px" }}>
            <legend><strong>A. Sensory Response Observation</strong></legend>
            <div style={{ display: "grid", gap: "10px" }}>
              <label>
                <span>Body region</span>
                <select value={bodyRegion} onChange={(e) => setBodyRegion(e.target.value)}>
                  {BODY_REGIONS.map((region) => <option key={region} value={region}>{region}</option>)}
                </select>
              </label>
              <label>
                <span>Examination method</span>
                <select value={examinationMethod} onChange={(e) => setExaminationMethod(e.target.value)}>
                  {SENSORY_METHODS.map((m) => <option key={m} value={m}>{m}</option>)}
                </select>
              </label>
              {examinationMethod === "Other clinician-specified method" && (
                <label>
                  <span>Specify clinician method</span>
                  <input
                    value={customMethod}
                    onChange={(e) => setCustomMethod(e.target.value)}
                    maxLength={120}
                    placeholder="e.g., Monofilament"
                  />
                </label>
              )}
              <label>
                <span>Patient response</span>
                <select value={sensoryResponse} onChange={(e) => setSensoryResponse(e.target.value)}>
                  {SENSORY_RESPONSES.map((resp) => <option key={resp} value={resp}>{resp}</option>)}
                </select>
              </label>
              <label>
                <span>Examiner notes (optional)</span>
                <input
                  value={sensoryNotes}
                  onChange={(e) => setSensoryNotes(e.target.value)}
                  maxLength={500}
                  placeholder="Optional sensory note"
                />
              </label>
              <div>
                <button type="button" className="secondary-btn" onClick={addSensoryObservation}>
                  Add sensory observation
                </button>
              </div>
              {sensoryObservations.length > 0 && (
                <ul className="feature-list">
                  {sensoryObservations.map((obs, idx) => (
                    <li key={idx} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "8px" }}>
                      <span>
                        <strong>{obs.bodyRegion}</strong> · {obs.customMethod || obs.examinationMethod} → {obs.response}
                        {obs.notes ? ` (${obs.notes})` : ""}
                      </span>
                      <button
                        type="button"
                        className="ghost-btn"
                        onClick={() => setSensoryObservations((prev) => prev.filter((_, i) => i !== idx))}
                      >
                        Remove observation
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </fieldset>

          <fieldset style={{ border: "1px solid #cbd5e1", borderRadius: "8px", padding: "12px" }}>
            <legend><strong>B. Reflex Observation (Qualified Healthcare Professional Only)</strong></legend>
            <div style={{ display: "grid", gap: "10px" }}>
              <label>
                <span>Reflex site</span>
                <select value={reflexSite} onChange={(e) => setReflexSite(e.target.value)}>
                  {REFLEX_SITES.map((site) => <option key={site} value={site}>{site}</option>)}
                </select>
              </label>
              <label>
                <span>Side</span>
                <select value={reflexSide} onChange={(e) => setReflexSide(e.target.value)}>
                  {REFLEX_SIDES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </label>
              <label>
                <span>Observed response</span>
                <select value={reflexResponse} onChange={(e) => setReflexResponse(e.target.value)}>
                  {REFLEX_RESPONSES.map((resp) => <option key={resp} value={resp}>{resp}</option>)}
                </select>
              </label>
              <label>
                <span>Examiner notes (optional)</span>
                <input
                  value={reflexNotes}
                  onChange={(e) => setReflexNotes(e.target.value)}
                  maxLength={500}
                  placeholder="Optional reflex note"
                />
              </label>
              <div>
                <button type="button" className="secondary-btn" onClick={addReflexObservation}>
                  Add reflex observation
                </button>
              </div>
              {reflexObservations.length > 0 && (
                <ul className="feature-list">
                  {reflexObservations.map((obs, idx) => (
                    <li key={idx} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "8px" }}>
                      <span>
                        <strong>{obs.reflexSite}</strong> ({obs.side}) → {obs.response}
                        {obs.notes ? ` (${obs.notes})` : ""}
                      </span>
                      <button
                        type="button"
                        className="ghost-btn"
                        onClick={() => setReflexObservations((prev) => prev.filter((_, i) => i !== idx))}
                      >
                        Remove observation
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </fieldset>

          {errorMessage && <p className="report-warning" role="alert">{errorMessage}</p>}

          <div className="task-actions">
            <button type="button" className="primary-btn" onClick={handleSave}>
              Save examination and continue
            </button>
          </div>
        </div>
      )}

      <details>
        <summary>Skip this optional examination</summary>
        <label>
          <span>Reason</span>
          <input value={skipReason} onChange={(e) => setSkipReason(e.target.value)} maxLength={500} />
        </label>
        <button
          type="button"
          className="ghost-btn"
          disabled={!skipReason.trim()}
          onClick={() => onNext({ status: "skipped", skipReason: skipReason.trim() })}
        >
          Skip and continue
        </button>
      </details>
    </div>
  );
}

export default OptionalPhysicalExamTask;
