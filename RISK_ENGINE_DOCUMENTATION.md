# Risk Engine Documentation — MindScan AI (`RISK_ENGINE_DOCUMENTATION.md`)

**Engine Version:** `multimodal-heuristic/1.0.0`  
**Implementation:** `Backend/services/riskAssessmentService.js`

---

## 1. Architecture & Scoring Principles
1. **Strict Modality Separation:** Cognitive, Drawing, and Voice modalities are summarized independently and never fused into a single "dementia probability".
2. **Missing/Skipped Exclusion:** Missing or skipped tasks retain `score = null` and are excluded from all averages—never treated as `0`.
3. **Preservation of Raw Data:** Original `task_responses` rows are never overwritten; the multimodal summary is persisted in `screening_results.task_scores.__multimodalSummary`.
4. **No Double Counting:** Each task contributes at most once to its modality indicator.
5. **Isolated ML Boundary:** The Zenodo `13378346` clinical-tabular model (`zenodo-13378346-v1.0.0`) is explicitly marked `isolated_not_applicable_to_digital_tasks` and is never fed live cognitive/drawing/voice features.

---

## 2. Modality Indicators (Unvalidated Research Heuristics)
- **Cognitive (`experimentalIndicatorPercent`):** Unweighted arithmetic mean of measured numeric tasks (`memory`, `delayed_memory`, `digit_span`, `picture_recognition`, `pattern_recognition`, `orientation`, `attention`). `language` is reported descriptively without a numeric score.
- **Drawing (`experimentalIndicatorPercent`):** Rule-based CV spatial heuristic (`circularity_score * 0.35 + quadrant_balance_score * 0.35 + outer_ring_present * 0.15 + inner_hand_present * 0.15`).
- **Voice (`experimentalIndicatorPercent`):** Existing descriptive speech fluency indicator alongside acoustic timing (`WPM`, pauses) and language support status.

## 3. Limitations
- **Not Clinically Validated:** Indicators are experimental research heuristics only and cannot diagnose MCI, Alzheimer's disease, or dementia.
- **No Normative Cutoffs:** No age/education-adjusted clinical cutoffs are claimed.
