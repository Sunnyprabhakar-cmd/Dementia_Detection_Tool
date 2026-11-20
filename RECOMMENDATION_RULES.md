# Recommendation Rules — MindScan AI (`RECOMMENDATION_RULES.md`)

**Engine Version:** `recommendation-rules/1.0.0`  
**Implementation:** `Backend/services/recommendationService.js`

---

## Deterministic Rules

| Rule ID | Trigger Condition | Priority | Output Category | Safety Guardrail |
| --- | --- | --- | --- | --- |
| `complete_missing_tasks` | `completeness.missingTasks.length > 0` | `medium` | `completeness` | Lists exact missing tasks; does not penalize score. |
| `repeat_voice_task` | `voice.qualityWarnings` contains `clipping_detected`, `low_volume`, or `high_background_noise`, or `voice.availability` is `empty`/`unavailable` | `medium` | `data_quality` | Recommends re-recording in a quiet room. |
| `unsupported_speech_language` | `voice.qualityWarnings` contains `unsupported_language:<lang>` | `low` | `limitation` | Explains linguistic rule unavailability; retains acoustic timing. |
| `repeat_drawing_task` | `drawing.qualityWarnings` contains `low_image_quality` or `incomplete_clock` | `medium` | `data_quality` | Recommends repeating the clock drawing with clear strokes. |
| `discuss_with_clinician` | `completedCount >= 3` and (`cognitive.experimentalIndicatorPercent < 60` or `drawing.experimentalIndicatorPercent < 60`) | `high` | `clinical_follow_up` | Advises discussing observed results with a qualified clinician; **never** diagnoses or prescribes treatment. |
| `routine_follow_up` | `missingTasks.length === 0` and no other warnings/flags | `low` | `general` | Confirms assessment completeness for longitudinal tracking. |
