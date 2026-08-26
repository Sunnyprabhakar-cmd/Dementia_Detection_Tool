const clamp = (value, min = 0, max = 100) => Math.min(max, Math.max(min, Number(value) || 0));

const buildAgentInsight = (name, score, label, domain, evidence) => ({
  name,
  score: clamp(score),
  label,
  confidence: Math.max(68, Math.min(97, Math.round(clamp(score) + 15))),
  domain,
  evidence,
  insight: `${name} indicates ${label.toLowerCase()} ${domain} performance with ${clamp(score)}% signal strength.`
});

const toRiskBand = (score) => {
  if (score >= 65) return "high";
  if (score >= 40) return "moderate";
  return "low";
};

const deriveClinicalContext = (taskScores = {}) => {
  const mmse = Number(taskScores.mmse ?? 28);
  const cdr = Number(taskScores.cdr ?? 0);
  const age = Number(taskScores.age ?? 72);
  const education = Number(taskScores.education ?? 12);
  const nwbv = Number(taskScores.nwbv ?? 0.73);
  const voiceScore = Number(taskScores.voice ?? 0);

  return {
    mmse,
    cdr,
    age,
    education,
    nwbv,
    voiceScore
  };
};

export const runMultiAgentAnalysis = (taskScores = {}, riskScore = 0, overallScore = 0) => {
  const memoryScore = clamp(taskScores.memory ?? 0);
  const attentionScore = clamp(taskScores.attention ?? 0);
  const orientationScore = clamp(taskScores.orientation ?? 0);
  const languageScore = clamp(taskScores.language ?? 0);
  const voiceScore = clamp(taskScores.voice ?? 0);

  const clinical = deriveClinicalContext(taskScores);
  const cdrAdjusted = clamp((clinical.cdr * 100) / 1.5, 0, 100);
  const mmseAdjusted = clamp(((clinical.mmse - 10) / 20) * 100, 0, 100);
  const ageAdjusted = clamp(100 - ((clinical.age - 50) / 45) * 100, 0, 100);
  const educationAdjusted = clamp((clinical.education / 20) * 100, 0, 100);
  const nwbvAdjusted = clamp((clinical.nwbv / 0.85) * 100, 0, 100);

  const agents = [
    buildAgentInsight(
      "Memory Agent",
      memoryScore,
      memoryScore >= 70 ? "healthy" : memoryScore >= 45 ? "watchful" : "declining",
      "episodic recall",
      [
        `recall accuracy at ${memoryScore}%`,
        "matches the OASIS-style pattern where memory degradation often appears before broader functional decline"
      ]
    ),
    buildAgentInsight(
      "Attention Agent",
      attentionScore,
      attentionScore >= 70 ? "stable" : attentionScore >= 45 ? "reduced" : "significantly impaired",
      "sustained attention",
      [
        `processing speed and response accuracy at ${attentionScore}%`,
        "low attention yields higher false negatives and reduced task engagement"
      ]
    ),
    buildAgentInsight(
      "Language Agent",
      languageScore,
      languageScore >= 70 ? "clear" : languageScore >= 45 ? "mixed" : "limited",
      "semantic fluency",
      [
        `verbal fluency score ${languageScore}%`,
        "language impairment often co-occurs with lower MMSE and reduced processing efficiency"
      ]
    ),
    buildAgentInsight(
      "Orientation Agent",
      orientationScore,
      orientationScore >= 75 ? "correct" : orientationScore >= 55 ? "partially intact" : "compromised",
      "spatial and temporal awareness",
      [
        `orientation accuracy at ${orientationScore}%`,
        "time-place awareness is a reliable marker in early neurocognitive decline"
      ]
    ),
    buildAgentInsight(
      "Voice Agent",
      voiceScore,
      voiceScore >= 70 ? "stable" : voiceScore >= 45 ? "variable" : "degraded",
      "speech and prosody",
      [
        `voice quality score ${voiceScore}%`,
        "changes in speech rhythm, articulation, and consistency are useful secondary cues for screening"
      ]
    ),
    buildAgentInsight(
      "Clinical Context Agent",
      (mmseAdjusted * 0.45) + (nwbvAdjusted * 0.25) + (educationAdjusted * 0.15) + ((100 - cdrAdjusted) * 0.15),
      cdrAdjusted > 55 || clinical.mmse < 22 ? "high-risk context" : cdrAdjusted > 30 || clinical.mmse < 25 ? "monitoring context" : "stable context",
      "clinical risk context",
      [
        `MMSE ${clinical.mmse}, CDR ${clinical.cdr}, age ${clinical.age}, education ${clinical.education}`,
        "these variables mirror the OASIS- and cohort-style features associated with cognitive decline risk"
      ]
    )
  ];

  const ensembleScore = Math.round(
    (
      memoryScore * 0.24 +
      attentionScore * 0.20 +
      languageScore * 0.18 +
      orientationScore * 0.16 +
      voiceScore * 0.12 +
      ((mmseAdjusted * 0.45) + (nwbvAdjusted * 0.25) + (educationAdjusted * 0.15) + ((100 - cdrAdjusted) * 0.15)) * 0.1
    )
  );

  const dominantIssue = agents.reduce((current, agent) => {
    if (!current || agent.score < current.score) return agent;
    return current;
  }, null);

  const riskBand = toRiskBand(clamp(100 - ensembleScore + (riskScore || 0) * 0.2, 0, 100));
  const निर्ण = clamp(100 - ensembleScore + (overallScore || 0) * 0.1, 0, 100);

  let agentSummary = "The agent ensemble indicates a generally stable cognitive profile across the assessed domains.";
  if (riskBand === "high" || Number(riskScore) >= 60 || Number(overallScore) < 50) {
    agentSummary = "The ensemble detects a clinically relevant pattern of cognitive decline, especially in memory, language, and speech-related markers. Follow-up assessment is advised.";
  } else if (riskBand === "moderate" || Number(riskScore) >= 35) {
    agentSummary = "The ensemble shows moderate variability across memory, attention, and language domains. Continued monitoring and repeat assessment are recommended.";
  } else if (dominantIssue) {
    agentSummary = `${dominantIssue.name} is the strongest signal in the current profile, but the aggregate result remains below the high-risk threshold.`;
  }

  return {
    agents,
    agentSummary,
    ensembleScore: clamp(ensembleScore),
    riskBand,
    riskScore: clamp(Number(riskScore) || 0),
    overallScore: clamp(Number(overallScore) || 0),
    recommendation: riskBand === "high"
      ? "Urgent clinical referral"
      : riskBand === "moderate"
        ? "Repeat assessment with specialist review"
        : "Routine monitoring",
    modelVersion: "OASIS-agent-ensemble-v1",
    clinicalSignals: {
      mmse: clinical.mmse,
      cdr: clinical.cdr,
      age: clinical.age,
      education: clinical.education,
      nwbv: clinical.nwbv,
      voiceScore: clinical.voiceScore,
      riskIndex: clamp(100 - ensembleScore + (riskScore || 0) * 0.2, 0, 100)
    },
    profileScore: clamp(100 - ensembleScore + (riskScore || 0) * 0.2, 0, 100),
    signalDiagnostic: clamp(100 - ensembleScore + (overallScore || 0) * 0.1, 0, 100),
    featureSet: [
      "Age",
      "Education",
      "MMSE",
      "CDR",
      "nWBV",
      "voice quality",
      "memory recall",
      "attention accuracy",
      "orientation accuracy",
      "language fluency"
    ]
  };
};
