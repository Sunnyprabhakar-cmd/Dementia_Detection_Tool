# Stage 7 Design — Multimodal Screening Risk & Recommendation Engine (`STAGE7_DESIGN.md`)

**Date:** 2026-11-20  
**Engine Version:** `multimodal-heuristic/1.0.0`

---

## 1. Measurement Availability Audit

| Modality | Available Measurements in Repository | Missing / Boundary Conditions |
| --- | --- | --- |
| **Cognitive Tasks** (`assessmentValidation.js`, `screeningService.js`) | `memory`, `delayed_memory`, `digit_span`, `picture_recognition`, `pattern_recognition`, `orientation`, `attention`, `language` (sentence chars & animal count). | `language` has no validated numeric score; any skipped/uncompleted task has `score = null` and must **never** be treated as `0`. |
| **Drawing** (`analyze_drawing.py`, `drawingService.js`) | `circularity_score`, `number_placement_deviation_deg`, `number_spacing_std_deg`, `hand_length_ratio`, `quadrant_balance_score`, `drawing_completeness_score`, `image_quality_score`, `completion_time_seconds`. | No supervised clinical clock-drawing ML model (Rule-based CV heuristics only). |
| **Voice & Speech** (`transcribe_audio.py`, `speech_features.py`, `audioAgentController.js`) | Speaking rate (WPM), pause count/duration, 13-band MFCCs, F0 pitch, spectral features, SNR/clipping quality warnings, `en`/`hi`/`pa` fluency rules, language confidence. | Unsupported languages return `unavailable` for filler analysis; raw audio & transcripts are not persisted. |
| **ML Models** (`artifacts/models/clinical_tabular_research/zenodo-13378346-v1.0.0/`) | Isolated clinical-lab tabular model (`N=283`). | **Not applicable** to live digital cognitive/drawing/voice tasks; no live multimodal classifier exists. |

---

## 2. Multimodal Architecture & Separation of Concerns

1. **`Backend/services/riskAssessmentService.js`:**
   - Pure aggregation function `buildMultimodalAssessmentSummary(screeningSummary, options)` + DB-backed `generateAndPersistMultimodalSummary(screeningId, userId, role)`.
   - Keeps **raw task results**, **normalized experimental indicators**, **assessment completeness**, **modality findings**, and **limitations** strictly separated.
   - Prevents double-counting: each task contributes at most once to its modality summary.
2. **`Backend/services/recommendationService.js`:**
   - Pure deterministic rule engine `generateRecommendations(multimodalSummary)` producing `{ id, priority, category, title, message, basedOn }`.
   - Never recommends medication/treatment; never issues diagnostic claims.
3. **`Backend/controller/riskAssessmentController.js` & `Backend/routes/riskAssessmentRoutes.js`:**
   - Endpoints under `/api/screening/:id/summary*` enforcing patient ownership (`user_id = req.user.userId`) or `clinician` role.
4. **`Frontend/src/components/MultimodalSummary.jsx`:**
   - Renders completeness %, modality cards, quality warnings, missing measurements, recommendations, and explicit non-diagnostic disclaimers.
