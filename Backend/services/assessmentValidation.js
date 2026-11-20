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
      "transcript_analysis",
      "quality_warnings",
      "quality_reliable",
      "acoustic_classifier_poc"
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
  const qualityWarnings = Array.isArray(input.quality_warnings)
    ? input.quality_warnings.filter((w) => typeof w === "string").slice(0, 10)
    : [];
  const qualityReliable = typeof input.quality_reliable === "boolean"
    ? input.quality_reliable
    : null;
  const poc = input.acoustic_classifier_poc && typeof input.acoustic_classifier_poc === "object" && !Array.isArray(input.acoustic_classifier_poc)
    ? {
        status: typeof input.acoustic_classifier_poc.status === "string" ? input.acoustic_classifier_poc.status.slice(0, 48) : "unavailable",
        classification_outcome: typeof input.acoustic_classifier_poc.classification_outcome === "string"
          ? input.acoustic_classifier_poc.classification_outcome.slice(0, 32)
          : "Model unavailable",
        model_version: typeof input.acoustic_classifier_poc.model_version === "string"
          ? input.acoustic_classifier_poc.model_version.slice(0, 64)
          : null,
        model_name: typeof input.acoustic_classifier_poc.model_name === "string"
          ? input.acoustic_classifier_poc.model_name.slice(0, 64)
          : null,
        dataset: typeof input.acoustic_classifier_poc.dataset === "string"
          ? input.acoustic_classifier_poc.dataset.slice(0, 120)
          : null,
        prediction: input.acoustic_classifier_poc.prediction && typeof input.acoustic_classifier_poc.prediction === "object"
          ? {
              predicted_label: typeof input.acoustic_classifier_poc.prediction.predicted_label === "string"
                ? input.acoustic_classifier_poc.prediction.predicted_label.slice(0, 32)
                : null,
              class_scores: input.acoustic_classifier_poc.prediction.class_scores && typeof input.acoustic_classifier_poc.prediction.class_scores === "object"
                ? Object.fromEntries(
                    Object.entries(input.acoustic_classifier_poc.prediction.class_scores)
                      .filter(([k, v]) => typeof k === "string" && typeof v === "number" && Number.isFinite(v))
                      .map(([k, v]) => [k.slice(0, 32), Number(v.toFixed(6))])
                  )
                : null,
              scores_are_calibrated_probabilities: false
            }
          : null,
        decision_threshold: input.acoustic_classifier_poc.decision_threshold && typeof input.acoustic_classifier_poc.decision_threshold === "object"
          ? {
              threshold_version: typeof input.acoustic_classifier_poc.decision_threshold.threshold_version === "string"
                ? input.acoustic_classifier_poc.decision_threshold.threshold_version.slice(0, 64)
                : null,
              cutoff: typeof input.acoustic_classifier_poc.decision_threshold.cutoff === "number"
                ? input.acoustic_classifier_poc.decision_threshold.cutoff
                : null,
              clinically_validated: false,
              status_label: typeof input.acoustic_classifier_poc.decision_threshold.status_label === "string"
                ? input.acoustic_classifier_poc.decision_threshold.status_label.slice(0, 120)
                : "Experimental classification — threshold not clinically validated",
              explanation: typeof input.acoustic_classifier_poc.decision_threshold.explanation === "string"
                ? input.acoustic_classifier_poc.decision_threshold.explanation.slice(0, 400)
                : null
            }
          : null,
        message: typeof input.acoustic_classifier_poc.message === "string" ? input.acoustic_classifier_poc.message.slice(0, 200) : null,
        missing_inputs: Array.isArray(input.acoustic_classifier_poc.missing_inputs)
          ? input.acoustic_classifier_poc.missing_inputs.filter((item) => typeof item === "string").slice(0, 10)
          : []
      }
    : null;

  return {
    recorded: input.recorded,
    status: input.status,
    responseTime: input.responseTime ?? null,
    language: input.language,
    speech_features: sanitizeSpeechFeatures(input.speech_features),
    transcript_analysis: sanitizeTranscriptAnalysis(input.transcript_analysis),
    ...(qualityWarnings.length ? { quality_warnings: qualityWarnings } : {}),
    ...(qualityReliable !== null ? { quality_reliable: qualityReliable } : {}),
    ...(poc ? { acoustic_classifier_poc: poc } : {})
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

const EXAMINER_ROLES = new Set(["Attendant", "Nurse", "Doctor", "Other"]);
const SENSORY_BODY_REGIONS = new Set([
  "Left arm", "Right arm", "Left hand", "Right hand",
  "Left leg", "Right leg", "Left foot", "Right foot", "Other"
]);
const SENSORY_METHODS = new Set(["Light touch", "Other clinician-specified method"]);
const SENSORY_RESPONSES = new Set([
  "Responded normally", "Reduced response observed", "No response observed",
  "Inconsistent response", "Unable to assess"
]);
const REFLEX_SITES = new Set([
  "Biceps", "Triceps", "Brachioradialis", "Patellar", "Achilles", "Other"
]);
const REFLEX_SIDES = new Set(["Left", "Right", "Both"]);
const REFLEX_RESPONSES = new Set(["Present", "Reduced", "Absent", "Brisk", "Unable to assess"]);

export const validatePhysicalExamination = (input = {}) => {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new Error("Physical examination payload is invalid");
  }
  if (input.status === "skipped") {
    const skipReason = textValue(input.skipReason, "Skip reason", 500);
    if (!skipReason) throw new Error("A reason is required when the optional examination is skipped");
    return { status: "skipped", skipReason };
  }

  const examinerName = textValue(input.examinerName, "Examiner name", 120);
  if (!examinerName) throw new Error("Examiner name is required");
  if (!EXAMINER_ROLES.has(input.examinerRole)) {
    throw new Error("Select a valid examiner role");
  }
  const examinedAtRaw = textValue(input.examinedAt, "Examination date and time", 64);
  if (!examinedAtRaw || Number.isNaN(Date.parse(examinedAtRaw))) {
    throw new Error("A valid examination date and time is required");
  }
  const additionalObservations = textValue(input.additionalObservations, "Additional observations", 1000);

  if (input.sensoryObservations != null && !Array.isArray(input.sensoryObservations)) {
    throw new Error("Sensory observations must be an array");
  }
  if (input.reflexObservations != null && !Array.isArray(input.reflexObservations)) {
    throw new Error("Reflex observations must be an array");
  }

  const rawSensory = Array.isArray(input.sensoryObservations) ? input.sensoryObservations : [];
  const rawReflex = Array.isArray(input.reflexObservations) ? input.reflexObservations : [];
  if (rawSensory.length > 30 || rawReflex.length > 30) {
    throw new Error("At most 30 observations per examination type are allowed");
  }
  if (rawSensory.length === 0 && rawReflex.length === 0) {
    throw new Error("Record at least one sensory or reflex observation, or skip this optional examination");
  }

  const sensoryObservations = rawSensory.map((item, idx) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      throw new Error(`Sensory observation #${idx + 1} is invalid`);
    }
    if (!SENSORY_BODY_REGIONS.has(item.bodyRegion)) {
      throw new Error(`Invalid body region in sensory observation #${idx + 1}`);
    }
    if (!SENSORY_METHODS.has(item.examinationMethod)) {
      throw new Error(`Invalid examination method in sensory observation #${idx + 1}`);
    }
    const customMethod = textValue(item.customMethod, "Custom examination method", 120);
    if (item.examinationMethod === "Other clinician-specified method" && !customMethod) {
      throw new Error(`Specify the clinician method in sensory observation #${idx + 1}`);
    }
    if (!SENSORY_RESPONSES.has(item.response)) {
      throw new Error(`Invalid patient response in sensory observation #${idx + 1}`);
    }
    return {
      examinationType: "sensory",
      bodyRegion: item.bodyRegion,
      examinationMethod: item.examinationMethod,
      ...(customMethod ? { customMethod } : {}),
      response: item.response,
      notes: textValue(item.notes, "Sensory examiner notes", 500)
    };
  });

  const reflexObservations = rawReflex.map((item, idx) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      throw new Error(`Reflex observation #${idx + 1} is invalid`);
    }
    if (!REFLEX_SITES.has(item.reflexSite)) {
      throw new Error(`Invalid reflex site in reflex observation #${idx + 1}`);
    }
    if (!REFLEX_SIDES.has(item.side)) {
      throw new Error(`Invalid side in reflex observation #${idx + 1}`);
    }
    if (!REFLEX_RESPONSES.has(item.response)) {
      throw new Error(`Invalid reflex response in reflex observation #${idx + 1}`);
    }
    return {
      examinationType: "reflex",
      reflexSite: item.reflexSite,
      side: item.side,
      response: item.response,
      notes: textValue(item.notes, "Reflex examiner notes", 500)
    };
  });

  return {
    status: "completed",
    examinerName,
    examinerRole: input.examinerRole,
    examinedAt: new Date(examinedAtRaw).toISOString(),
    additionalObservations,
    sensoryObservations,
    reflexObservations
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

export const evaluateDelayedMemory = (input = {}) => {
  const shown = Array.isArray(input.wordsShown)
    ? input.wordsShown.map((w) => String(w).trim().toLowerCase()).filter(Boolean)
    : [];
  const recalledRaw = Array.isArray(input.wordsRecalled) ? input.wordsRecalled : [];
  const skippedCount = recalledRaw.filter((w) => String(w ?? "").trim() === "").length;
  const recalled = recalledRaw.map((w) => String(w ?? "").trim().toLowerCase()).filter(Boolean);
  const expectedSet = new Set(shown);
  const correctWords = new Set(recalled.filter((w) => expectedSet.has(w)));
  const intrusionCount = recalled.filter((w) => !expectedSet.has(w)).length;
  const score = expectedSet.size ? Number(((correctWords.size / expectedSet.size) * 100).toFixed(2)) : 0;
  return {
    correctCount: correctWords.size,
    wordsShown: expectedSet.size,
    intrusionCount,
    skippedCount,
    score
  };
};

export const evaluateDigitSpan = (input = {}) => {
  const trials = Array.isArray(input.trials) ? input.trials : [];
  if (!trials.length) throw new Error("Digit span trials are required");
  let correctCount = 0;
  let skippedCount = 0;
  let maxForwardSpan = 0;
  let maxBackwardSpan = 0;

  for (const trial of trials) {
    const expected = String(trial.expected ?? "").replace(/\s+/g, "");
    const response = String(trial.response ?? "").replace(/\s+/g, "");
    const direction = trial.direction === "backward" ? "backward" : "forward";
    const skipped = trial.skipped === true || response === "";
    if (skipped) {
      skippedCount += 1;
      continue;
    }
    if (expected && response === expected) {
      correctCount += 1;
      if (direction === "backward") {
        maxBackwardSpan = Math.max(maxBackwardSpan, expected.length);
      } else {
        maxForwardSpan = Math.max(maxForwardSpan, expected.length);
      }
    }
  }

  return {
    totalTrials: trials.length,
    correctCount,
    incorrectCount: trials.length - correctCount - skippedCount,
    skippedCount,
    maxForwardSpan,
    maxBackwardSpan,
    score: Number(((correctCount / trials.length) * 100).toFixed(2))
  };
};

export const evaluatePictureRecognition = (input = {}) => {
  const items = Array.isArray(input.items) ? input.items : [];
  if (!items.length) throw new Error("Picture recognition items are required");
  let correct = 0;
  let truePositives = 0;
  let falsePositives = 0;
  let falseNegatives = 0;
  let skippedCount = 0;

  for (const item of items) {
    if (item.skipped === true || item.selected == null) {
      skippedCount += 1;
      continue;
    }
    const isTarget = Boolean(item.isTarget);
    const selected = Boolean(item.selected);
    if (isTarget === selected) {
      correct += 1;
      if (isTarget) truePositives += 1;
    } else if (!isTarget && selected) {
      falsePositives += 1;
    } else if (isTarget && !selected) {
      falseNegatives += 1;
    }
  }

  return {
    totalItems: items.length,
    correctCount: correct,
    truePositives,
    falsePositives,
    falseNegatives,
    skippedCount,
    score: Number(((correct / items.length) * 100).toFixed(2))
  };
};

export const evaluatePatternRecognition = (input = {}) => {
  const items = Array.isArray(input.items) ? input.items : [];
  if (!items.length) throw new Error("Pattern recognition items are required");
  let correctCount = 0;
  let skippedCount = 0;

  for (const item of items) {
    const answer = String(item.answer ?? "").trim().toLowerCase();
    const expected = String(item.expected ?? "").trim().toLowerCase();
    if (item.skipped === true || answer === "") {
      skippedCount += 1;
      continue;
    }
    if (expected && answer === expected) {
      correctCount += 1;
    }
  }

  return {
    totalItems: items.length,
    correctCount,
    incorrectCount: items.length - correctCount - skippedCount,
    skippedCount,
    score: Number(((correctCount / items.length) * 100).toFixed(2))
  };
};

export const validateClockDrawing = (input = {}) => {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new Error("Clock drawing payload is required");
  }
  const skipped = input.skipped === true;
  if (skipped) {
    return {
      status: "skipped",
      skipped: true,
      skipReason: String(input.skipReason || "Participant skipped task").slice(0, 500),
      score: null
    };
  }
  const targetTime = String(input.targetTime || "11:10").slice(0, 20);
  const completionTimeSeconds = Number.isFinite(Number(input.completionTimeSeconds))
    ? Math.max(0, Number(input.completionTimeSeconds))
    : null;
  const strokeCount = Number.isInteger(input.strokeCount) && input.strokeCount >= 0
    ? input.strokeCount
    : null;
  const analysis = input.imageAnalysis && typeof input.imageAnalysis === "object"
    ? input.imageAnalysis
    : null;

  let geometricScore = null;
  if (analysis) {
    const circ = Number(analysis.circularity_score ?? 0);
    const quad = Number(analysis.quadrant_balance_score ?? 0);
    const outer = Number(analysis.outer_ring_ink_ratio ?? 0) > 0.05 ? 1 : 0;
    const inner = Number(analysis.inner_hand_ink_ratio ?? 0) > 0.02 ? 1 : 0;
    geometricScore = Number((((circ * 0.35) + (quad * 0.35) + (outer * 0.15) + (inner * 0.15)) * 100).toFixed(2));
  }

  return {
    status: "completed",
    skipped: false,
    targetTime,
    completionTimeSeconds,
    strokeCount,
    imageAnalysis: analysis,
    score: geometricScore
  };
};
