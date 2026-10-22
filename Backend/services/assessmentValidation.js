const SEX_VALUES = new Set([
  "female",
  "male",
  "intersex",
  "self_described",
  "prefer_not_to_say"
]);

const HANDEDNESS_VALUES = new Set([
  "right",
  "left",
  "ambidextrous",
  "unknown"
]);

const OBSERVATION_VALUES = new Set([
  "present",
  "absent",
  "not_assessed",
  "unable_to_assess"
]);

const VOICE_STATUSES = new Set(["completed", "empty", "unavailable", "not_assessed"]);
const TRANSCRIPT_ANALYSIS_STATUSES = new Set([
  "complete",
  "very_short",
  "empty",
  "transcription_error",
  "unavailable"
]);
const SPEECH_FEATURES = new Set([
  "audio_duration_seconds",
  "speaking_duration_seconds",
  "transcript_word_count",
  "transcript_character_count",
  "speech_rate_words_per_minute",
  "pause_count",
  "mean_pause_seconds",
  "maximum_pause_seconds",
  "estimated_non_speech_ratio",
  "filler_word_count",
  "filler_word_ratio_percent",
  "adjacent_repeated_word_count",
  "lexical_diversity",
  "sentence_count",
  "mean_sentence_length_words",
  "pitch_mean_hz",
  "pitch_std_hz"
]);
const ANALYSIS_NUMBER_FIELDS = new Set([
  "word_count",
  "sentence_count",
  "average_words_per_sentence",
  "repeated_adjacent_word_count",
  "repeated_short_phrase_count",
  "unique_word_ratio"
]);
const ANALYSIS_COUNT_MAPS = {
  filler_word_counts: new Set(["ah", "er", "erm", "hmm", "uh", "um"]),
  self_correction_marker_counts: new Set([
    "i mean", "let me rephrase", "no wait", "or rather", "sorry"
  ]),
  selected_vague_expression_counts: new Set([
    "some kind of", "some sort of", "somewhere", "something", "stuff",
    "thing", "things", "whatever"
  ])
};
const UNAVAILABLE_TRANSCRIPT_FIELDS = new Set([
  "english_filler_counts",
  "english_self_correction_markers",
  "english_vague_expressions"
]);
const isLanguageCode = (value) =>
  typeof value === "string"
  && /^(?:unknown|[a-z]{2,3}(?:-[a-z0-9]{2,8})*)$/i.test(value);

const assertKnownKeys = (value, allowed, label) => {
  const unknown = Object.keys(value).filter((key) => !allowed.has(key));
  if (unknown.length) {
    throw new Error(`${label} contains unsupported fields`);
  }
};

const safeMetric = (value, label, { integer = false, maximum = Infinity } = {}) => {
  if (value == null) return null;
  if (
    typeof value !== "number"
    || !Number.isFinite(value)
    || value < 0
    || value > maximum
    || (integer && !Number.isInteger(value))
  ) {
    throw new Error(`${label} is invalid`);
  }
  return value;
};

const safeCountMap = (value, allowedTerms, label) => {
  if (value == null) return null;
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} is invalid`);
  }
  assertKnownKeys(value, allowedTerms, label);
  return Object.fromEntries(
    Object.entries(value).map(([term, count]) => [
      term,
      safeMetric(count, label, { integer: true })
    ])
  );
};

const sanitizeTranscriptAnalysis = (value) => {
  if (value == null) return null;
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Transcript analysis is invalid");
  }
  assertKnownKeys(
    value,
    new Set(["status", "language", "observations", "unavailable_observations"]),
    "Transcript analysis"
  );
  if (!TRANSCRIPT_ANALYSIS_STATUSES.has(value.status)) {
    throw new Error("Transcript analysis status is invalid");
  }
  if (!isLanguageCode(value.language)) {
    throw new Error("Transcript analysis language is invalid");
  }
  const observations = value.observations;
  if (!observations || typeof observations !== "object" || Array.isArray(observations)) {
    throw new Error("Transcript observations are invalid");
  }
  const allowedObservationKeys = new Set([
    ...ANALYSIS_NUMBER_FIELDS,
    ...Object.keys(ANALYSIS_COUNT_MAPS)
  ]);
  assertKnownKeys(observations, allowedObservationKeys, "Transcript observations");

  const normalizedObservations = {};
  for (const field of ANALYSIS_NUMBER_FIELDS) {
    if (Object.hasOwn(observations, field)) {
      normalizedObservations[field] = safeMetric(
        observations[field],
        field,
        {
          integer: !["average_words_per_sentence", "unique_word_ratio"].includes(field),
          maximum: field === "unique_word_ratio" ? 1 : Infinity
        }
      );
    }
  }
  for (const [field, allowedTerms] of Object.entries(ANALYSIS_COUNT_MAPS)) {
    if (Object.hasOwn(observations, field)) {
      normalizedObservations[field] = safeCountMap(
        observations[field],
        allowedTerms,
        field
      );
    }
  }

  const unavailable = value.unavailable_observations ?? [];
  if (
    !Array.isArray(unavailable)
    || unavailable.length > 10
    || unavailable.some((item) => !UNAVAILABLE_TRANSCRIPT_FIELDS.has(item))
  ) {
    throw new Error("Unavailable transcript observations are invalid");
  }
  return {
    status: value.status,
    language: value.language,
    observations: normalizedObservations,
    unavailable_observations: unavailable
  };
};

const sanitizeSpeechFeatures = (value) => {
  if (value == null) return null;
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Speech features are invalid");
  }
  const allowedMetadata = new Set([
    "status",
    "features",
    "feature_extractor_version",
    "transcription_model",
    "transcription_language",
    "missing_inputs",
    "unavailable_features",
    "limitations"
  ]);
  assertKnownKeys(value, allowedMetadata, "Speech features");
  if (!["complete", "partial", "empty", "unavailable"].includes(value.status)) {
    throw new Error("Speech feature status is invalid");
  }
  const features = value.features ?? {};
  if (!features || typeof features !== "object" || Array.isArray(features)) {
    throw new Error("Speech feature values are invalid");
  }
  assertKnownKeys(features, SPEECH_FEATURES, "Speech feature values");
  const normalizedFeatures = {};
  for (const [name, metric] of Object.entries(features)) {
    normalizedFeatures[name] = safeMetric(metric, name, {
      integer: [
        "transcript_word_count",
        "transcript_character_count",
        "pause_count",
        "filler_word_count",
        "adjacent_repeated_word_count",
        "sentence_count"
      ].includes(name),
      maximum: name === "estimated_non_speech_ratio" || name === "lexical_diversity"
        ? 1
        : name === "filler_word_ratio_percent"
          ? 100
        : Infinity
    });
  }
  return { status: value.status, features: normalizedFeatures };
};

export const validateVoiceResponse = (input) => {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new Error("Voice response is invalid");
  }
  assertKnownKeys(
    input,
    new Set([
      "recorded",
      "status",
      "responseTime",
      "language",
      "speech_features",
      "transcript_analysis"
    ]),
    "Voice response"
  );
  if (!VOICE_STATUSES.has(input.status)) {
    throw new Error("Voice response status is invalid");
  }
  if (typeof input.recorded !== "boolean") {
    throw new Error("Voice response recorded flag is invalid");
  }
  if (input.responseTime != null) {
    safeMetric(input.responseTime, "Voice response time", { maximum: 3600 });
  }
  if (!isLanguageCode(input.language)) {
    throw new Error("Voice response language is invalid");
  }
  return {
    recorded: input.recorded,
    status: input.status,
    responseTime: input.responseTime ?? null,
    language: input.language,
    speech_features: sanitizeSpeechFeatures(input.speech_features),
    transcript_analysis: sanitizeTranscriptAnalysis(input.transcript_analysis)
  };
};

const textValue = (value, label, maxLength) => {
  if (value == null || value === "") return null;
  if (typeof value !== "string" || value.trim().length > maxLength) {
    throw new Error(`${label} must be text of at most ${maxLength} characters`);
  }
  return value.trim() || null;
};

const optionalInteger = (value, label, minimum, maximum) => {
  if (value == null || value === "") return null;
  const number = Number(value);
  if (!Number.isInteger(number) || number < minimum || number > maximum) {
    throw new Error(`${label} must be a whole number from ${minimum} to ${maximum}`);
  }
  return number;
};

export const validatePatientProfile = (input) => {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new Error("Patient profile is required");
  }

  const age = optionalInteger(input.age, "Age", 1, 120);
  if (age == null) throw new Error("Age is required");
  if (input.consent !== true) throw new Error("Consent is required to create an assessment");

  const sex = textValue(input.sex, "Sex", 40);
  if (sex && !SEX_VALUES.has(sex)) throw new Error("Select a valid sex option");

  const handedness = textValue(input.handedness, "Handedness", 30);
  if (handedness && !HANDEDNESS_VALUES.has(handedness)) {
    throw new Error("Select a valid handedness option");
  }

  return {
    patientIdentifier: textValue(input.patientIdentifier, "Patient identifier", 80),
    age,
    sex,
    educationYears: optionalInteger(input.educationYears, "Education", 0, 40),
    handedness,
    socioeconomicStatus: optionalInteger(input.socioeconomicStatus, "Socioeconomic status", 1, 5),
    medicalHistory: textValue(input.medicalHistory, "Medical history", 2000),
    medications: textValue(input.medications, "Medications", 1000),
    reportedSymptoms: textValue(input.reportedSymptoms, "Reported symptoms", 2000),
    symptomOnset: textValue(input.symptomOnset, "Symptom onset", 200),
    functionalChanges: textValue(input.functionalChanges, "Functional changes", 2000),
    familyHistory: textValue(input.familyHistory, "Family history", 1000),
    consent: true
  };
};

const normalizeAnswer = (value) => String(value ?? "")
  .trim()
  .normalize("NFKD")
  .replace(/\p{Diacritic}/gu, "")
  .replace(/[.,]/g, "")
  .toLocaleLowerCase();

export const evaluateOrientation = (response = {}) => {
  const dateValue = String(response.assessmentDate ?? "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateValue)) {
    throw new Error("A valid assessment date is required");
  }
  const expectedDate = new Date(`${dateValue}T00:00:00.000Z`);
  if (Number.isNaN(expectedDate.getTime()) || expectedDate.toISOString().slice(0, 10) !== dateValue) {
    throw new Error("A valid assessment date is required");
  }

  const locale = ["en", "si", "ta"].includes(response.locale) ? response.locale : "en";
  const monthNames = Array.from({ length: 12 }, (_, index) => {
    const monthDate = new Date(Date.UTC(2020, index, 1));
    return new Intl.DateTimeFormat(locale, { month: "long", timeZone: "UTC" }).format(monthDate);
  });
  const expectedMonth = monthNames[expectedDate.getUTCMonth()];
  const acceptedMonths = new Set([
    normalizeAnswer(expectedMonth),
    normalizeAnswer(expectedMonth.slice(0, 3)),
    String(expectedDate.getUTCMonth() + 1)
  ]);
  const yearCorrect = normalizeAnswer(response.year) === String(expectedDate.getUTCFullYear());
  const dateCorrect = normalizeAnswer(response.date) === String(expectedDate.getUTCDate());
  const monthCorrect = acceptedMonths.has(normalizeAnswer(response.month));
  const correctCount = [yearCorrect, monthCorrect, dateCorrect].filter(Boolean).length;

  return {
    yearCorrect,
    monthCorrect,
    dateCorrect,
    correctCount,
    scoredItems: 3,
    score: Math.round((correctCount / 3) * 100),
    placeReported: Boolean(String(response.place ?? "").trim())
  };
};

export const calculateTappingMetrics = (input = {}) => {
  if (input.status === "skipped") {
    const skipReason = textValue(input.skipReason, "Skip reason", 500);
    if (!skipReason) throw new Error("A reason is required when the motor task is skipped");
    return { status: "skipped", skipReason };
  }
  if (!Array.isArray(input.timestampsMs) || input.timestampsMs.length > 1000) {
    throw new Error("Tapping timestamps must be an array with at most 1000 entries");
  }
  if (!["left", "right"].includes(input.hand)) {
    throw new Error("Select the hand used for the tapping task");
  }
  if (!["mouse", "touch", "pen", "unknown"].includes(input.inputDevice)) {
    throw new Error("Select a supported input device");
  }

  const durationSeconds = Number(input.durationSeconds);
  if (!Number.isFinite(durationSeconds) || durationSeconds < 0.1 || durationSeconds > 60) {
    throw new Error("Task duration must be between 0.1 and 60 seconds");
  }
  const rawTimestamps = input.timestampsMs.map(Number);
  if (rawTimestamps.some((time, index) =>
    !Number.isFinite(time) || time < 0 || time > durationSeconds * 1000 ||
    (index > 0 && time < rawTimestamps[index - 1])
  )) {
    throw new Error("Tapping timestamps must be finite, ordered, and inside the task duration");
  }

  const acceptedTimestamps = [];
  let rejectedDoubleClicks = 0;
  for (const timestamp of rawTimestamps) {
    const previous = acceptedTimestamps.at(-1);
    if (previous != null && timestamp - previous < 80) {
      rejectedDoubleClicks += 1;
    } else {
      acceptedTimestamps.push(timestamp);
    }
  }

  const intervalsMs = acceptedTimestamps.slice(1).map((time, index) => time - acceptedTimestamps[index]);
  const meanIntervalMs = intervalsMs.length
    ? intervalsMs.reduce((sum, interval) => sum + interval, 0) / intervalsMs.length
    : null;
  const intervalStdDevMs = meanIntervalMs == null
    ? null
    : Math.sqrt(intervalsMs.reduce((sum, interval) =>
      sum + (interval - meanIntervalMs) ** 2, 0) / intervalsMs.length);

  return {
    status: "completed",
    hand: input.hand,
    inputDevice: input.inputDevice,
    durationSeconds,
    completed: input.completed === true,
    tapCount: acceptedTimestamps.length,
    rejectedDoubleClicks,
    tapsPerSecond: Number((acceptedTimestamps.length / durationSeconds).toFixed(3)),
    meanInterTapIntervalMs: meanIntervalMs == null ? null : Number(meanIntervalMs.toFixed(2)),
    interTapIntervalStdDevMs: intervalStdDevMs == null ? null : Number(intervalStdDevMs.toFixed(2)),
    pausesOverOneSecond: intervalsMs.filter((interval) => interval > 1000).length,
    timestampsMs: rawTimestamps
  };
};

export const validateClinicianObservation = (input) => {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new Error("Clinician observation is required");
  }
  const skipped = input.skipped === true;
  const skipReason = textValue(input.skipReason, "Skip reason", 1000);
  if (skipped && !skipReason) throw new Error("A reason is required when the examination is skipped");

  const observationDate = textValue(input.observationDate, "Observation date", 10);
  const assessorRole = textValue(input.assessorRole, "Assessor role", 100);
  if (!skipped && (!observationDate || !/^\d{4}-\d{2}-\d{2}$/.test(observationDate) || !assessorRole)) {
    throw new Error("Observation date and assessor role are required");
  }

  const fields = [
    "tremor", "movementSlowness", "reducedAmplitude", "gaitBalance",
    "posture", "handPosture", "sensoryResponse", "reflexes"
  ];
  const observations = {};
  for (const field of fields) {
    const value = input.observations?.[field] ?? "not_assessed";
    if (!OBSERVATION_VALUES.has(value)) {
      throw new Error(`Invalid observation value for ${field}`);
    }
    observations[field] = value;
  }

  const side = input.side ?? "not_applicable";
  if (!["left", "right", "both", "not_applicable"].includes(side)) {
    throw new Error("Select a valid side");
  }

  const clinicalMeasurements = {};
  const mmseValue = input.clinicalMeasurements?.mmse;
  if (mmseValue != null && mmseValue !== "") {
    const mmse = Number(mmseValue);
    if (!Number.isInteger(mmse) || mmse < 0 || mmse > 30 || skipped || !assessorRole || !observationDate) {
      throw new Error("Clinician MMSE must be 0-30 and include assessor and date");
    }
    clinicalMeasurements.mmse = mmse;
  }
  const cdrValue = input.clinicalMeasurements?.cdr;
  if (cdrValue != null && cdrValue !== "") {
    const cdr = Number(cdrValue);
    if (![0, 0.5, 1, 2, 3].includes(cdr) || skipped || !assessorRole || !observationDate) {
      throw new Error("Clinician CDR must be a valid stage and include assessor and date");
    }
    clinicalMeasurements.cdr = cdr;
  }

  return {
    status: skipped ? "skipped" : "completed",
    skipped,
    skipReason,
    observationDate,
    assessorRole,
    side,
    observations,
    clinicalMeasurements,
    notes: textValue(input.notes, "Observation notes", 2000)
  };
};
