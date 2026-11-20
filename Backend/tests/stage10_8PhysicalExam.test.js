import assert from "node:assert/strict";
import test from "node:test";
import { validatePhysicalExamination } from "../services/assessmentValidation.js";
import { buildMultimodalAssessmentSummary } from "../services/riskAssessmentService.js";
import { buildAssessmentPdfLines, generateAssessmentPdfBuffer } from "../services/pdfReportService.js";

test("validatePhysicalExamination accepts multiple sensory and reflex observations", () => {
  const result = validatePhysicalExamination({
    examinerName: "Dr. Meera Rao",
    examinerRole: "Doctor",
    examinedAt: "2026-11-20T10:30:00.000Z",
    additionalObservations: "Patient cooperative during in-person exam.",
    sensoryObservations: [
      {
        bodyRegion: "Left hand",
        examinationMethod: "Light touch",
        response: "Responded normally",
        notes: "Intact light touch"
      },
      {
        bodyRegion: "Right foot",
        examinationMethod: "Other clinician-specified method",
        customMethod: "10g Monofilament",
        response: "Reduced response observed",
        notes: "Mildly reduced distally"
      }
    ],
    reflexObservations: [
      {
        reflexSite: "Patellar",
        side: "Both",
        response: "Present",
        notes: "Symmetric"
      },
      {
        reflexSite: "Achilles",
        side: "Left",
        response: "Reduced",
        notes: ""
      }
    ]
  });

  assert.equal(result.status, "completed");
  assert.equal(result.examinerName, "Dr. Meera Rao");
  assert.equal(result.examinerRole, "Doctor");
  assert.equal(result.sensoryObservations.length, 2);
  assert.equal(result.reflexObservations.length, 2);
  assert.equal(result.reflexObservations[0].side, "Both");
  assert.equal(result.reflexObservations[1].side, "Left");
});

test("validatePhysicalExamination rejects invalid fields and empty submissions", () => {
  assert.throws(
    () => validatePhysicalExamination({
      examinerName: "Nurse A",
      examinerRole: "Nurse",
      examinedAt: "2026-11-20T10:30:00.000Z",
      sensoryObservations: [],
      reflexObservations: []
    }),
    /at least one sensory or reflex observation/i
  );

  assert.throws(
    () => validatePhysicalExamination({
      examinerName: "Nurse A",
      examinerRole: "Nurse",
      examinedAt: "2026-11-20T10:30:00.000Z",
      sensoryObservations: [
        { bodyRegion: "Forehead", examinationMethod: "Light touch", response: "Responded normally" }
      ],
      reflexObservations: []
    }),
    /Invalid body region/
  );

  assert.throws(
    () => validatePhysicalExamination({
      examinerName: "Doctor B",
      examinerRole: "Doctor",
      examinedAt: "2026-11-20T10:30:00.000Z",
      sensoryObservations: [],
      reflexObservations: [
        { reflexSite: "Patellar", side: "Center", response: "Present" }
      ]
    }),
    /Invalid side/
  );

  assert.throws(
    () => validatePhysicalExamination({ status: "skipped", skipReason: "" }),
    /reason is required/i
  );
});

test("validatePhysicalExamination supports optional skip", () => {
  const skipped = validatePhysicalExamination({
    status: "skipped",
    skipReason: "Remote self-screening without attendant present"
  });
  assert.deepEqual(skipped, {
    status: "skipped",
    skipReason: "Remote self-screening without attendant present"
  });
});

test("physical_examination never alters Assessment Performance Score or speech classification and renders in PDF", () => {
  const baseTasks = {
    memory: { status: "completed", score: 80 },
    delayed_memory: { status: "completed", score: 100 },
    voice: {
      status: "completed",
      measurements: {
        status: "completed",
        language: "en",
        acoustic_classifier_poc: {
          status: "available_experimental_poc",
          classification_outcome: "Non-dementia",
          model_version: "dementianet-acoustic-v1.0.0",
          prediction: { predicted_label: "nodementia", class_scores: { nodementia: 0.7, dementia: 0.3 }, scores_are_calibrated_probabilities: false }
        }
      }
    }
  };

  const withoutExam = buildMultimodalAssessmentSummary({ screeningId: 200, taskResults: baseTasks });
  const withExam = buildMultimodalAssessmentSummary({
    screeningId: 200,
    taskResults: {
      ...baseTasks,
      physical_examination: {
        status: "completed",
        score: null,
        measurements: validatePhysicalExamination({
          examinerName: "Attendant Ravi",
          examinerRole: "Attendant",
          examinedAt: "2026-11-20T11:00:00.000Z",
          sensoryObservations: [
            { bodyRegion: "Right arm", examinationMethod: "Light touch", response: "No response observed" }
          ],
          reflexObservations: []
        })
      }
    }
  });

  assert.equal(withExam.assessmentPerformanceScore.score, withoutExam.assessmentPerformanceScore.score);
  assert.equal(withExam.completeness.percent, withoutExam.completeness.percent);
  assert.equal(
    withExam.modalities.voice.experimentalSpeechClassifier.classificationOutcome,
    withoutExam.modalities.voice.experimentalSpeechClassifier.classificationOutcome
  );
  assert.equal(withExam.modalities.physicalExamination.availability, "available");
  assert.equal(withExam.modalities.physicalExamination.sensoryObservations.length, 1);

  const pdfLines = buildAssessmentPdfLines({ screeningId: 200, multimodalSummary: withExam }).map((l) => l.text).join(" ");
  assert.match(pdfLines, /OPTIONAL PHYSICAL EXAMINATION OBSERVATIONS/);
  assert.match(pdfLines, /Attendant Ravi/);
  assert.match(pdfLines, /Right arm/);
  const pdfBuf = generateAssessmentPdfBuffer({ screeningId: 200, multimodalSummary: withExam });
  assert.ok(pdfBuf.subarray(0, 8).toString("utf8").startsWith("%PDF-1.4"));
});

test("historical motor_tapping records remain safe and non-crashing in summary and PDF", () => {
  const legacySummary = buildMultimodalAssessmentSummary({
    screeningId: 201,
    taskResults: {
      memory: { status: "completed", score: 100 },
      motor_tapping: { status: "completed", score: null, measurements: { validTapCount: 40 } }
    }
  });
  assert.equal(legacySummary.modalities.physicalExamination.availability, "legacy_motor_tapping");
  assert.equal(legacySummary.assessmentPerformanceScore.score, 100);
  const pdfLines = buildAssessmentPdfLines({ screeningId: 201, multimodalSummary: legacySummary }).map((l) => l.text).join(" ");
  assert.match(pdfLines, /Historical motor tapping record preserved/);
});
