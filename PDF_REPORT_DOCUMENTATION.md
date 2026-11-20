# PDF Report Documentation — MindScan AI (`PDF_REPORT_DOCUMENTATION.md`)

**Implementation:** `Backend/services/pdfReportService.js`  
**Endpoint:** `GET /api/screening/:id/report.pdf`

---

## 1. Report Contents
1. Header (`MINDSCAN AI - RESEARCH COGNITIVE & COMMUNICATION SCREENING REPORT`), Report ID (`MS-<screeningId>`), generation timestamp, participant reference, and assessment date.
2. Explicit non-diagnostic notice (`NOT a medical diagnosis`).
3. Assessment Completeness (`%`, completed/expected counts, missing and skipped tasks).
4. Cognitive Assessment Findings (experimental indicator + per-task raw scores).
5. Clock Drawing Assessment Findings (circularity, quadrant balance, completeness, completion time, warnings).
6. Voice & Speech Findings (detected language, speaking rate, pauses, audio/language warnings).
7. Recommendations (deterministic, non-diagnostic).
8. Clinician Observations (when recorded and authorized).
9. Engine & Model Versions + Research Limitations.

## 2. Technical & Security Guarantees
- **Pure Node.js PDF 1.4:** Generates standard multi-page PDF buffers with `Helvetica` & `Helvetica-Bold` Type1 fonts, 46 lines/page pagination, and `"Page X of Y"` footers.
- **Escaping & Sanitization:** Escapes `(`, `)`, `\` and strips non-printable control characters; never exposes internal server paths.
- **Authorization:** Enforces patient ownership or assigned clinician access via `authMiddleware`.
