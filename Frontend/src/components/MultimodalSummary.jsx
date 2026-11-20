const TASK_LABELS = {
  memory: "Immediate memory",
  delayed_memory: "Delayed memory",
  attention: "Attention",
  digit_span: "Digit span",
  picture_recognition: "Picture recognition",
  pattern_recognition: "Pattern recognition",
  orientation: "Orientation"
};

function MultimodalSummary({ summary }) {
  if (!summary || typeof summary !== "object") return null;

  const completeness = summary.completeness || {};
  const modalities = summary.modalities || {};
  const cognitive = modalities.cognitive || {};
  const drawing = modalities.drawing || {};
  const voice = modalities.voice || {};
  const phys = modalities.physicalExamination || {};
  const perf = summary.assessmentPerformanceScore || {};
  const perfScore = perf.score ?? cognitive.experimentalIndicatorPercent;
  const speechClf = voice.experimentalSpeechClassifier || {};
  const threshold = speechClf.decisionThreshold || {};
  const recommendations = Array.isArray(summary.recommendations) ? summary.recommendations : [];
  const limitations = Array.isArray(summary.limitations) ? summary.limitations : [];
  const rawScores = cognitive.rawScores || {};

  const allWarnings = [
    ...(Array.isArray(drawing.qualityWarnings) ? drawing.qualityWarnings.map((w) => `Drawing: ${w}`) : []),
    ...(Array.isArray(voice.qualityWarnings) ? voice.qualityWarnings.map((w) => `Voice: ${w}`) : [])
  ];

  const outcomeText = speechClf.classificationOutcome || "Model unavailable";
  const disclaimerText =
    summary.disclaimer ||
    "Experimental research assessment. The displayed scores and speech-based predictions are not clinically validated and must not be used to diagnose or exclude dementia. Clinical evaluation by a qualified healthcare professional is required.";

  return (
    <div className="multimodal-summary" style={{ marginTop: "16px", display: "grid", gap: "14px" }}>
      <div
        role="note"
        style={{
          padding: "12px 14px",
          background: "#f8fafc",
          color: "#0f172a",
          border: "1px solid #cbd5e1",
          borderLeft: "4px solid #334155",
          borderRadius: "6px"
        }}
      >
        <strong>Non-Diagnostic Research Disclaimer:</strong> {disclaimerText} This is an experimental screening prototype and is not a clinical diagnosis. Results require interpretation by a qualified healthcare professional.
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "12px" }}>
        <section
          className="report-section"
          aria-label="Assessment Performance Score"
          style={{ background: "#f8fafc", color: "#0f172a", border: "1px solid #cbd5e1", borderRadius: "8px", padding: "14px" }}
        >
          <h3 style={{ marginTop: 0 }}>Assessment Performance Score</h3>
          <div style={{ fontSize: "2rem", fontWeight: 700, color: "#1e3a8a", lineHeight: 1.1 }}>
            {perfScore != null ? `${perfScore}/100` : "Not available"}
          </div>
          <p className="muted-text" style={{ marginTop: "6px", fontSize: "0.85rem" }}>
            Task-performance summary only (distinct from clinical dementia risk).{" "}
            {perf.formula || cognitive.scoringMethod}
          </p>
          {perf.formulaVersion && (
            <p className="muted-text" style={{ fontSize: "0.8rem", marginBottom: 0 }}>
              Formula version: <code>{perf.formulaVersion}</code>
            </p>
          )}
        </section>

        <section
          className="report-section"
          aria-label="Experimental Speech Classification"
          style={{ background: "#f8fafc", color: "#0f172a", border: "1px solid #cbd5e1", borderRadius: "8px", padding: "14px" }}
        >
          <h3 style={{ marginTop: 0 }}>Experimental Speech Model Prediction</h3>
          <div style={{ fontSize: "1.35rem", fontWeight: 700, color: "#0f172a" }}>
            {outcomeText}
          </div>
          <p className="muted-text" style={{ marginTop: "6px", fontSize: "0.85rem" }}>
            <strong>Model:</strong> {speechClf.modelVersion || "dementianet-acoustic-v1.0.0"} ({speechClf.modelName || "logistic_regression"})
            {speechClf.dataset ? ` · Dataset: ${speechClf.dataset}` : ""}
          </p>
          {speechClf.classScores && (
            <p style={{ fontSize: "0.85rem", marginTop: "4px" }}>
              <strong>Uncalibrated relative scores (not probabilities):</strong>{" "}
              {Object.entries(speechClf.classScores)
                .map(([k, v]) => `${k}: ${Number(v).toFixed(3)}`)
                .join(" · ")}
            </p>
          )}
          <p className="muted-text" style={{ fontSize: "0.82rem", marginTop: "6px", marginBottom: 0 }}>
            <strong>Decision threshold ({threshold.threshold_version || "dementianet-val-default-0.50/v1.0"}):</strong>{" "}
            {threshold.status_label || "Experimental classification — threshold not clinically validated"}.{" "}
            {threshold.explanation || speechClf.message || ""}
          </p>
        </section>
      </div>

      <section className="report-section" aria-label="Assessment completeness">
        <h3>Assessment Completeness</h3>
        <p>
          <strong>{completeness.percent ?? 0}%</strong> ({completeness.completedCount ?? 0} of {completeness.expectedCount ?? 10} tasks completed)
        </p>
        <div style={{ height: "10px", background: "#e2e8f0", borderRadius: "6px", overflow: "hidden", marginBottom: "8px" }}>
          <div style={{ width: `${Math.min(100, completeness.percent ?? 0)}%`, height: "100%", background: "#334155" }} />
        </div>
        {completeness.skippedTasks?.length > 0 && (
          <p className="muted-text">Skipped tasks (excluded from averages): {completeness.skippedTasks.join(", ")}</p>
        )}
        {completeness.missingTasks?.length > 0 && (
          <p className="muted-text">Missing tasks (never scored as zero): {completeness.missingTasks.join(", ")}</p>
        )}
      </section>

      <section className="report-section" aria-label="Cognitive findings">
        <h3>Individual Cognitive Task Scores</h3>
        <div style={{ display: "grid", gap: "6px", marginTop: "8px" }}>
          {Object.entries(rawScores).map(([task, score]) => (
            <div key={task} style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <span style={{ width: "165px", fontSize: "0.85rem" }}>{TASK_LABELS[task] || task.replace("_", " ")}</span>
              {score == null ? (
                <span className="muted-text" style={{ fontSize: "0.85rem" }}>Not measured / excluded</span>
              ) : (
                <>
                  <div style={{ flex: 1, height: "8px", background: "#e2e8f0", borderRadius: "4px", overflow: "hidden" }}>
                    <div style={{ width: `${Math.min(100, score)}%`, height: "100%", background: "#2563eb" }} />
                  </div>
                  <strong style={{ width: "60px", textAlign: "right", fontSize: "0.85rem" }}>{score}/100</strong>
                </>
              )}
            </div>
          ))}
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <span style={{ width: "165px", fontSize: "0.85rem" }}>Language (descriptive)</span>
            <span className="muted-text" style={{ fontSize: "0.85rem" }}>
              {cognitive.languageObservations?.animalResponseCount != null || cognitive.languageObservations?.sentenceCharacterCount != null
                ? `Animals named: ${cognitive.languageObservations?.animalResponseCount ?? "N/A"} · Sentence chars: ${cognitive.languageObservations?.sentenceCharacterCount ?? "N/A"} (unscored)`
                : "Not measured"}
            </span>
          </div>
        </div>
      </section>

      <section className="report-section" aria-label="Drawing findings">
        <h3>Clock Drawing Observations ({drawing.availability || "missing"})</h3>
        {drawing.availability === "available" && drawing.rawMetrics ? (
          <ul className="feature-list">
            <li>Circularity: {(drawing.rawMetrics.circularity_score * 100).toFixed(0)}%</li>
            <li>Quadrant balance: {(drawing.rawMetrics.quadrant_balance_score * 100).toFixed(0)}%</li>
            <li>Drawing completeness: {(drawing.rawMetrics.drawing_completeness_score * 100).toFixed(0)}%</li>
            <li>Spatial heuristic indicator: {drawing.experimentalIndicatorPercent ?? "N/A"}/100</li>
          </ul>
        ) : (
          <p className="muted-text">Drawing assessment was {drawing.availability || "not completed"}.</p>
        )}
      </section>

      <section className="report-section" aria-label="Speech findings">
        <h3>Speech Feature Summary ({voice.availability || "not_assessed"})</h3>
        {voice.availability === "available" ? (
          <ul className="feature-list">
            <li>Detected language: {voice.language || "unknown"}</li>
            <li>Speaking rate: {voice.speechFeatures?.speech_rate_words_per_minute ?? "Not measured"} words/min</li>
            <li>Observed pauses: {voice.speechFeatures?.pause_count ?? "Not measured"}</li>
            <li>Descriptive speech timing indicator: {voice.experimentalIndicatorPercent != null ? `${voice.experimentalIndicatorPercent}/100` : "Not measured"}</li>
          </ul>
        ) : (
          <p className="muted-text">Voice assessment status: {voice.availability || "not assessed"}.</p>
        )}
      </section>

      {allWarnings.length > 0 && (
        <section className="report-warning" role="note" aria-label="Quality warnings">
          <strong>Quality &amp; Language Warnings:</strong> {allWarnings.join(" · ")}
        </section>
      )}

      {recommendations.length > 0 && (
        <section className="report-section" aria-label="Recommendations">
          <h3>Recommendations</h3>
          <ul className="feature-list">
            {recommendations.map((rec) => (
              <li key={rec.id}>
                <strong>[{rec.priority.toUpperCase()}] {rec.title}:</strong> {rec.message}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="report-section" aria-label="Optional physical examination observations">
        <h3>Optional Physical Examination Observations ({phys.availability || "missing"})</h3>
        {phys.availability === "available" ? (
          <div>
            <p>
              <strong>Examiner:</strong> {phys.examinerName || "N/A"} ({phys.examinerRole || "N/A"}) ·{" "}
              <strong>Date/Time:</strong> {phys.examinedAt ? new Date(phys.examinedAt).toLocaleString() : "N/A"}
            </p>
            {phys.additionalObservations && (
              <p><strong>Additional observations:</strong> {phys.additionalObservations}</p>
            )}
            <p><strong>Sensory Response Observations ({phys.sensoryObservations?.length || 0}):</strong></p>
            {phys.sensoryObservations?.length > 0 ? (
              <ul className="feature-list">
                {phys.sensoryObservations.map((obs, idx) => (
                  <li key={idx}>
                    <strong>{obs.bodyRegion}</strong> · {obs.customMethod || obs.examinationMethod} → {obs.response}
                    {obs.notes ? ` (${obs.notes})` : ""}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="muted-text">No sensory observations recorded.</p>
            )}
            <p><strong>Reflex Observations ({phys.reflexObservations?.length || 0}):</strong></p>
            {phys.reflexObservations?.length > 0 ? (
              <ul className="feature-list">
                {phys.reflexObservations.map((obs, idx) => (
                  <li key={idx}>
                    <strong>{obs.reflexSite}</strong> ({obs.side}) → {obs.response}
                    {obs.notes ? ` (${obs.notes})` : ""}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="muted-text">No reflex observations recorded.</p>
            )}
            <p className="muted-text">{phys.note}</p>
          </div>
        ) : phys.availability === "skipped" ? (
          <p className="muted-text">Skipped ({phys.skipReason || "No reason provided"}).</p>
        ) : phys.availability === "legacy_motor_tapping" ? (
          <p className="muted-text">{phys.note}</p>
        ) : (
          <p className="muted-text">Optional in-person physical examination was not performed.</p>
        )}
      </section>

      <section className="report-section" aria-label="Limitations">
        <h3>Important Limitations &amp; Research Model Boundary</h3>
        <ul className="feature-list">
          {limitations.map((item, idx) => (
            <li key={idx}>{item}</li>
          ))}
        </ul>
        {summary.researchModels?.isolatedClinicalTabularModel && (
          <p className="muted-text">
            Isolated tabular research model ({summary.researchModels.isolatedClinicalTabularModel.modelVersion}): {summary.researchModels.isolatedClinicalTabularModel.note}
          </p>
        )}
        <p className="muted-text">
          Engine: <code>{summary.engineVersion || "multimodal-heuristic/1.1.0"}</code> · Formula: <code>{summary.formulaVersion || "assessment-performance/1.0.0"}</code>
        </p>
      </section>
    </div>
  );
}

export default MultimodalSummary;
