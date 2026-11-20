import { useEffect, useRef, useState } from "react";

const DIGIT_TRIALS = [
  { expected: "381", direction: "forward" },
  { expected: "7294", direction: "forward" },
  { expected: "51846", direction: "forward" },
  { expected: "49", direction: "backward" },
  { expected: "627", direction: "backward" },
  { expected: "8351", direction: "backward" }
];

function DigitSpanTask({ onNext }) {
  const [trialIndex, setTrialIndex] = useState(0);
  const [phase, setPhase] = useState("showing"); // showing | recall
  const [answer, setAnswer] = useState("");
  const [results, setResults] = useState([]);
  const taskStartedRef = useRef(Date.now());
  const trialInputStartedRef = useRef(Date.now());

  const currentTrial = DIGIT_TRIALS[trialIndex];

  useEffect(() => {
    setPhase("showing");
    setAnswer("");
    const timer = window.setTimeout(() => {
      setPhase("recall");
      trialInputStartedRef.current = Date.now();
    }, 2800);
    return () => window.clearTimeout(timer);
  }, [trialIndex]);

  const submitTrial = async (skipped = false) => {
    const latencyMs = Math.max(0, Date.now() - trialInputStartedRef.current);
    const updated = [
      ...results,
      {
        expected: currentTrial.direction === "backward"
          ? currentTrial.expected.split("").reverse().join("")
          : currentTrial.expected,
        presented: currentTrial.expected,
        response: skipped ? "" : answer.trim(),
        direction: currentTrial.direction,
        skipped,
        latencyMs
      }
    ];
    setResults(updated);

    if (trialIndex + 1 < DIGIT_TRIALS.length) {
      setTrialIndex(trialIndex + 1);
    } else {
      const responseTime = Number(((Date.now() - taskStartedRef.current) / 1000).toFixed(2));
      await onNext({ trials: updated, responseTime });
    }
  };

  return (
    <div className="task-box">
      <p className="eyebrow">Number Repetition &amp; Digit Span</p>
      <h2>
        {currentTrial.direction === "forward"
          ? "Repeat the digits in the SAME order"
          : "Repeat the digits in REVERSE order"}
      </h2>
      <div className="memory-timer-box">
        Trial {trialIndex + 1} of {DIGIT_TRIALS.length} · Direction: {currentTrial.direction.toUpperCase()}
      </div>

      {phase === "showing" ? (
        <div className="word-grid" style={{ justifyContent: "center", padding: "20px 0" }}>
          <span className="word-pill" style={{ fontSize: "1.6rem", letterSpacing: "0.25rem" }}>
            {currentTrial.expected}
          </span>
        </div>
      ) : (
        <div className="form-grid" style={{ marginTop: "12px" }}>
          <label className="prompt-field">
            <span>
              Enter digits ({currentTrial.direction === "backward" ? "in reverse order" : "in exact order"})
            </span>
            <input
              type="text"
              inputMode="numeric"
              value={answer}
              onChange={(e) => setAnswer(e.target.value.replace(/\D/g, ""))}
              placeholder="Type digits..."
              autoFocus
            />
          </label>
          <div className="task-actions" style={{ display: "flex", gap: "8px" }}>
            <button type="button" className="ghost-btn" onClick={() => submitTrial(true)}>
              Skip trial
            </button>
            <button type="button" className="primary-btn" onClick={() => submitTrial(false)}>
              {trialIndex + 1 < DIGIT_TRIALS.length ? "Next trial" : "Finish Digit Span"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default DigitSpanTask;
