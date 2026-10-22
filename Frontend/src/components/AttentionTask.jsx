import { useCallback, useEffect, useRef, useState } from "react";

function AttentionTask({ t, onNext }) {
  const [isTargetVisible, setIsTargetVisible] = useState(false);
  const [round, setRound] = useState(1);
  const [finished, setFinished] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);
  const [counts, setCounts] = useState({ correct: 0, wrong: 0, missed: 0, reactionTimesMs: [] });
  const countsRef = useRef(counts);
  const targetStartedAtRef = useRef(0);
  const handledTargetRef = useRef(false);
  const lastFalseClickRef = useRef(-Infinity);
  const targetTimeoutRef = useRef(null);
  const finishedRef = useRef(false);
  const savingRef = useRef(false);

  const updateCounts = useCallback((update) => {
    const next = update(countsRef.current);
    countsRef.current = next;
    setCounts(next);
    return next;
  }, []);

  const completeTrials = useCallback(async (finalCounts) => {
    if (savingRef.current) return false;
    savingRef.current = true;
    if (!finishedRef.current) {
      finishedRef.current = true;
      window.clearTimeout(targetTimeoutRef.current);
      setIsTargetVisible(false);
      setFinished(true);
    }

    setIsSaving(true);
    setSaveFailed(false);
    try {
      const saved = await onNext(finalCounts);
      if (!saved) {
        setSaveFailed(true);
        return false;
      }
      return true;
    } catch {
      setSaveFailed(true);
      return false;
    } finally {
      savingRef.current = false;
      setIsSaving(false);
    }
  }, [onNext]);

  useEffect(() => {
    if (finished) return undefined;
    handledTargetRef.current = false;
    let waitTimer;
    let targetTimer;
    waitTimer = window.setTimeout(() => {
      setIsTargetVisible(true);
      targetStartedAtRef.current = performance.now();
      targetTimer = window.setTimeout(() => {
        if (handledTargetRef.current) return;
        handledTargetRef.current = true;
        setIsTargetVisible(false);
        const updated = updateCounts((previous) => ({ ...previous, missed: previous.missed + 1 }));
        if (round >= 10) void completeTrials(updated);
        else setRound((current) => current + 1);
      }, 1600);
      targetTimeoutRef.current = targetTimer;
    }, 1000 + Math.random() * 1800);

    return () => {
      window.clearTimeout(waitTimer);
      window.clearTimeout(targetTimer);
    };
  }, [round, finished, updateCounts, completeTrials]);

  const handleClick = () => {
    if (!isTargetVisible) {
      const now = performance.now();
      if (now - lastFalseClickRef.current > 250) {
        lastFalseClickRef.current = now;
        updateCounts((previous) => ({ ...previous, wrong: previous.wrong + 1 }));
      }
      return;
    }

    if (handledTargetRef.current) return;
    handledTargetRef.current = true;
    window.clearTimeout(targetTimeoutRef.current);
    const reactionTimeMs = Math.max(0, performance.now() - targetStartedAtRef.current);
    const updated = updateCounts((previous) => ({
      ...previous,
      correct: previous.correct + 1,
      reactionTimesMs: [...previous.reactionTimesMs, Number(reactionTimeMs.toFixed(2))]
    }));
    setIsTargetVisible(false);
    if (round >= 10) void completeTrials(updated);
    else setRound((current) => current + 1);
  };

  return (
    <div className="task-box">
      <p className="eyebrow">{t.attention}</p>
      <h2>{t.attentionPrompt}</h2>
      <p>Browser and input-device timing are not calibrated; these measurements are exploratory only.</p>
      <div className="attention-box">
        <button
          type="button"
          className={isTargetVisible ? "attention-btn active" : "attention-btn"}
          onClick={handleClick}
          aria-label={isTargetVisible ? "Target visible; press now" : "Wait for the target"}
        >
          {isTargetVisible ? "CLICK" : finished ? "DONE" : "WAIT"}
        </button>
      </div>
      <div className="stats-row">
        <span>Round: {round}/10</span>
        <span>Correct: {counts.correct}</span>
        <span>Incorrect: {counts.wrong}</span>
        <span>Missed targets: {counts.missed}</span>
      </div>
      {finished && (
        <div aria-live="polite">
          {isSaving && <p>Saving task results...</p>}
          {saveFailed && (
            <div>
              <p role="alert">The task results were not saved.</p>
              <button
                type="button"
                className="primary-btn"
                disabled={isSaving}
                onClick={() => void completeTrials(countsRef.current)}
              >
                Retry save
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default AttentionTask;
