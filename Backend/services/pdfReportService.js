/**
 * Pure Node.js PDF 1.4 report generator with automatic line wrapping,
 * string escaping, and multi-page pagination ("Page X of Y").
 */

const sanitizePdfText = (value) =>
  String(value ?? "")
    .replace(/[^\x20-\x7E]/g, " ")
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)");

const wrapText = (text, maxChars = 86) => {
  const words = String(text ?? "").replace(/\s+/g, " ").trim().split(" ").filter(Boolean);
  if (!words.length) return [""];
  const lines = [];
  let current = "";
  for (const word of words) {
    if (!current) {
      current = word.slice(0, maxChars);
    } else if (current.length + 1 + word.length <= maxChars) {
      current += ` ${word}`;
    } else {
      lines.push(current);
      current = word.slice(0, maxChars);
    }
  }
  if (current) lines.push(current);
  return lines;
};

export const buildAssessmentPdfLines = (reportData = {}) => {
  const lines = [];
  const push = (text = "", bold = false) => {
    for (const line of wrapText(text, bold ? 78 : 86)) {
      lines.push({ text: line, bold });
    }
  };

  const summary = reportData.multimodalSummary || {};
  const completeness = summary.completeness || {};
  const modalities = summary.modalities || {};
  const cognitive = modalities.cognitive || {};
  const drawing = modalities.drawing || {};
  const voice = modalities.voice || {};
  const recommendations = Array.isArray(summary.recommendations) ? summary.recommendations : [];
  const reviews = Array.isArray(reportData.clinicianReviews) ? reportData.clinicianReviews : [];

  push("MINDSCAN AI - RESEARCH COGNITIVE & COMMUNICATION SCREENING REPORT", true);
  push(`Report ID: MS-${reportData.screeningId || "N/A"} | Generated: ${new Date().toISOString()}`);
  push(`Participant Reference: ${reportData.patientLabel || "Anonymous Study Participant"}`);
  push(`Assessment Date: ${reportData.assessmentDate || "Not recorded"}`);
  push("NOTICE: Educational/research screening summary only. NOT a medical diagnosis.", true);
  push(
    summary.disclaimer ||
      "Experimental research assessment. The displayed scores and speech-based predictions are not clinically validated and must not be used to diagnose or exclude dementia. Clinical evaluation by a qualified healthcare professional is required.",
    false
  );
  push("");

  const perf = summary.assessmentPerformanceScore || {};
  const perfScore = perf.score ?? cognitive.experimentalIndicatorPercent;
  const speechClf = voice.experimentalSpeechClassifier || {};
  push("0. OVERALL ASSESSMENT PERFORMANCE & EXPERIMENTAL SPEECH PREDICTION", true);
  push(`Assessment Performance Score: ${perfScore != null ? `${perfScore}/100` : "Not available"} (Formula: ${perf.formulaVersion || "assessment-performance/1.0.0"})`);
  push(`  - Aggregation: ${perf.formula || cognitive.scoringMethod || "Unweighted mean of valid completed numeric cognitive tasks; skipped/missing excluded."}`);
  push(`Experimental Speech Model Prediction: ${speechClf.classificationOutcome || "Model unavailable"}`);
  push(`  - Model: ${speechClf.modelVersion || "dementianet-acoustic-v1.0.0"} (${speechClf.modelName || "logistic_regression"}) | Dataset: ${speechClf.dataset || "DementiaNet"}`);
  if (speechClf.classScores) {
    const scoreStr = Object.entries(speechClf.classScores)
      .map(([k, v]) => `${k}=${Number(v).toFixed(3)}`)
      .join(", ");
    push(`  - Uncalibrated relative scores (not probabilities): ${scoreStr}`);
  }
  if (speechClf.decisionThreshold) {
    push(`  - Threshold (${speechClf.decisionThreshold.threshold_version || "N/A"}): ${speechClf.decisionThreshold.status_label || "Experimental classification - threshold not clinically validated"}`);
    if (speechClf.decisionThreshold.explanation) {
      push(`  - Threshold explanation: ${speechClf.decisionThreshold.explanation}`);
    }
  }
  push("");

  push("1. ASSESSMENT COMPLETENESS", true);
  push(`Overall Completeness: ${completeness.percent ?? 0}% (${completeness.completedCount ?? 0}/${completeness.expectedCount ?? 10} tasks)`);
  if (completeness.missingTasks?.length) {
    push(`Missing Tasks (excluded, never scored as 0): ${completeness.missingTasks.join(", ")}`);
  }
  if (completeness.skippedTasks?.length) {
    push(`Skipped Tasks (excluded): ${completeness.skippedTasks.join(", ")}`);
  }
  push("");

  push("2. COGNITIVE ASSESSMENT FINDINGS", true);
  push(`Assessment Performance Score: ${cognitive.experimentalIndicatorPercent != null ? `${cognitive.experimentalIndicatorPercent}/100` : "Not available"}`);
  for (const [task, score] of Object.entries(cognitive.rawScores || {})) {
    push(`  - ${task}: ${score == null ? "Not measured" : `${score}/100`}`);
  }
  if (cognitive.languageObservations) {
    push(`  - language (unscored descriptive): sentence chars=${cognitive.languageObservations.sentenceCharacterCount ?? "N/A"}, animals=${cognitive.languageObservations.animalResponseCount ?? "N/A"}`);
  }
  push("");

  push("3. CLOCK DRAWING ASSESSMENT FINDINGS", true);
  push(`Status: ${drawing.availability || "missing"} | Heuristic Indicator: ${drawing.experimentalIndicatorPercent ?? "Not measured"}`);
  if (drawing.rawMetrics) {
    push(`  - Circularity: ${(drawing.rawMetrics.circularity_score * 100).toFixed(0)}% | Quadrant Balance: ${(drawing.rawMetrics.quadrant_balance_score * 100).toFixed(0)}%`);
    push(`  - Completeness: ${(drawing.rawMetrics.drawing_completeness_score * 100).toFixed(0)}% | Completion Time: ${drawing.completionTimeSeconds ?? "N/A"}s`);
  }
  if (drawing.qualityWarnings?.length) {
    push(`  - Drawing Warnings: ${drawing.qualityWarnings.join(", ")}`);
  }
  push("");

  push("4. VOICE & SPEECH FINDINGS", true);
  push(`Status: ${voice.availability || "not_assessed"} | Language: ${voice.language || "unknown"}`);
  if (voice.speechFeatures) {
    push(`  - Speech Rate: ${voice.speechFeatures.speech_rate_words_per_minute ?? "Not measured"} words/min | Pauses: ${voice.speechFeatures.pause_count ?? "Not measured"}`);
  }
  if (voice.qualityWarnings?.length) {
    push(`  - Audio/Language Warnings: ${voice.qualityWarnings.join(", ")}`);
  }
  push("");

  push("5. RECOMMENDATIONS", true);
  if (recommendations.length) {
    for (const rec of recommendations) {
      push(`  - [${String(rec.priority || "info").toUpperCase()}] ${rec.title}: ${rec.message}`);
    }
  } else {
    push("  - Discuss any cognitive concerns with a qualified healthcare professional.");
  }
  push("");

  if (reviews.length) {
    push("6. CLINICIAN OBSERVATIONS", true);
    for (const rev of reviews) {
      push(`  - [${rev.review_status || "reviewed"}] (${rev.created_at || ""}) ${rev.clinician_name || "Clinician"}: ${rev.notes}`);
    }
    push("");
  }

  push("7. BRAIN IMAGING (OPTIONAL)", true);
  const mri = modalities.mri || {};
  const ct = modalities.ct || {};
  const mriPred = mri.modelOutput?.prediction?.predicted_label;
  push(`  - MRI: ${mri.availability || "missing"} | Model: ${mri.modelStatus || "unavailable"}${mriPred ? ` | Experimental label: ${mriPred}` : ""}`);
  if (mri.modelOutput?.status === "available_experimental_poc") {
    push("    Notice: This imaging model is an experimental research prototype and is not intended for clinical diagnosis.");
  }
  push(`  - CT: ${ct.availability || "missing"} | Model: ${ct.modelStatus || "unavailable"}`);
  push("");

  push("OPTIONAL PHYSICAL EXAMINATION OBSERVATIONS", true);
  const phys = modalities.physicalExamination || {};
  push(`Status: ${phys.availability || "missing"}`);
  if (phys.availability === "available") {
    push(`  - Examiner: ${phys.examinerName || "N/A"} (${phys.examinerRole || "N/A"}) | Date/Time: ${phys.examinedAt || "N/A"}`);
    if (phys.additionalObservations) {
      push(`  - Additional observations: ${phys.additionalObservations}`);
    }
    const sensory = Array.isArray(phys.sensoryObservations) ? phys.sensoryObservations : [];
    const reflex = Array.isArray(phys.reflexObservations) ? phys.reflexObservations : [];
    push(`  - Sensory Response Observations (${sensory.length}):`);
    for (const obs of sensory) {
      const method = obs.customMethod ? `${obs.examinationMethod} (${obs.customMethod})` : obs.examinationMethod;
      push(`      * ${obs.bodyRegion} | ${method} -> ${obs.response}${obs.notes ? ` | Notes: ${obs.notes}` : ""}`);
    }
    push(`  - Reflex Observations (${reflex.length}):`);
    for (const obs of reflex) {
      push(`      * ${obs.reflexSite} (${obs.side}) -> ${obs.response}${obs.notes ? ` | Notes: ${obs.notes}` : ""}`);
    }
  } else if (phys.availability === "skipped") {
    push(`  - Skip reason: ${phys.skipReason || "Not provided"}`);
  } else if (phys.availability === "legacy_motor_tapping") {
    push(`  - Historical motor tapping record preserved (${phys.legacyStatus || "completed"}).`);
  }
  push("  - Note: Observational record only; not merged into cognitive performance score or speech prediction.");
  push("");

  push("8. ENGINE VERSIONS & LIMITATIONS", true);
  push(`Risk Engine: ${summary.engineVersion || "multimodal-heuristic/1.1.0"} | Formula: ${summary.formulaVersion || "assessment-performance/1.0.0"} | Recommendation Engine: ${summary.recommendationEngineVersion || "recommendation-rules/1.0.0"}`);
  push("Isolated Tabular Model: zenodo-13378346-v1.0.0 (not applied to live digital tasks).");
  push("Limitation: This report does not diagnose MCI, Alzheimer's disease, or dementia.");

  return lines;
};

export const generateAssessmentPdfBuffer = (reportData = {}) => {
  const allLines = buildAssessmentPdfLines(reportData);
  const linesPerPage = 46;
  const pages = [];
  for (let i = 0; i < allLines.length; i += linesPerPage) {
    pages.push(allLines.slice(i, i + linesPerPage));
  }
  if (!pages.length) pages.push([{ text: "MindScan AI Empty Report", bold: true }]);

  const objects = [];
  const addObject = (body) => {
    objects.push(body);
    return objects.length;
  };

  const catalogId = addObject(""); // placeholder 1
  const pagesId = addObject(""); // placeholder 2
  const fontRegularId = addObject("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");
  const fontBoldId = addObject("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>");

  const pageIds = [];
  const totalPages = pages.length;

  pages.forEach((pageLines, pageIndex) => {
    const streamCommands = ["BT", "/F1 10 Tf"];
    let y = 755;
    for (const entry of pageLines) {
      const fontRef = entry.bold ? "/F2 10.5 Tf" : "/F1 9.5 Tf";
      streamCommands.push(fontRef);
      streamCommands.push(`1 0 0 1 48 ${y} Tm (${sanitizePdfText(entry.text)}) Tj`);
      y -= 15;
    }
    streamCommands.push("/F1 8.5 Tf");
    streamCommands.push(`1 0 0 1 48 32 Tm (${sanitizePdfText(`MindScan AI Research Report | Page ${pageIndex + 1} of ${totalPages}`)}) Tj`);
    streamCommands.push("ET");

    const streamStr = streamCommands.join("\n");
    const contentId = addObject(
      `<< /Length ${Buffer.byteLength(streamStr, "utf8")} >>\nstream\n${streamStr}\nendstream`
    );
    const pageId = addObject(
      `<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 ${fontRegularId} 0 R /F2 ${fontBoldId} 0 R >> >> /Contents ${contentId} 0 R >>`
    );
    pageIds.push(pageId);
  });

  objects[catalogId - 1] = `<< /Type /Catalog /Pages ${pagesId} 0 R >>`;
  objects[pagesId - 1] = `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pageIds.length} >>`;

  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach((body, idx) => {
    offsets.push(Buffer.byteLength(pdf, "utf8"));
    pdf += `${idx + 1} 0 obj\n${body}\nendobj\n`;
  });

  const xrefOffset = Buffer.byteLength(pdf, "utf8");
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += "0000000000 65535 f \n";
  for (let i = 1; i <= objects.length; i += 1) {
    pdf += `${String(offsets[i]).padStart(10, "0")} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root ${catalogId} 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;

  return Buffer.from(pdf, "utf8");
};
