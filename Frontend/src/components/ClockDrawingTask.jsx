import { useEffect, useRef, useState } from "react";
import { API_BASE_URL } from "../api.js";

function ClockDrawingTask({ screeningId, token, onComplete }) {
  const canvasRef = useRef(null);
  const drawingRef = useRef(false);
  const currentStrokeRef = useRef([]);
  const strokesRef = useRef([]);
  const startedAtRef = useRef(Date.now());

  const [strokeCount, setStrokeCount] = useState(0);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState("Draw a clock face with numbers 1–12 and hands showing 11:10.");
  const [analysisResult, setAnalysisResult] = useState(null);
  const [skipReason, setSkipReason] = useState("");

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#111827";
    ctx.lineWidth = 3;

    const timer = window.setInterval(() => {
      setElapsedSeconds(Number(((Date.now() - startedAtRef.current) / 1000).toFixed(1)));
    }, 500);
    return () => window.clearInterval(timer);
  }, []);

  const getPoint = (event) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
      x: Number(((event.clientX - rect.left) * scaleX).toFixed(2)),
      y: Number(((event.clientY - rect.top) * scaleY).toFixed(2)),
      t: Date.now() - startedAtRef.current
    };
  };

  const handlePointerDown = (event) => {
    event.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.setPointerCapture?.(event.pointerId);
    const point = getPoint(event);
    drawingRef.current = true;
    currentStrokeRef.current = [point];
    const ctx = canvas.getContext("2d");
    ctx.beginPath();
    ctx.moveTo(point.x, point.y);
  };

  const handlePointerMove = (event) => {
    if (!drawingRef.current) return;
    event.preventDefault();
    const point = getPoint(event);
    currentStrokeRef.current.push(point);
    const ctx = canvasRef.current.getContext("2d");
    ctx.lineTo(point.x, point.y);
    ctx.stroke();
  };

  const finishStroke = () => {
    if (!drawingRef.current) return;
    drawingRef.current = false;
    if (currentStrokeRef.current.length > 0) {
      strokesRef.current = [...strokesRef.current, { points: currentStrokeRef.current }];
      setStrokeCount(strokesRef.current.length);
    }
    currentStrokeRef.current = [];
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    strokesRef.current = [];
    setStrokeCount(0);
    setAnalysisResult(null);
    startedAtRef.current = Date.now();
    setElapsedSeconds(0);
    setStatusMessage("Canvas cleared. Draw a clock face showing 11:10.");
  };

  const handleSubmit = async () => {
    if (!strokesRef.current.length) {
      setStatusMessage("Please draw the clock before submitting, or use Skip below.");
      return;
    }
    setIsSubmitting(true);
    setStatusMessage("Analyzing clock drawing...");
    try {
      const completionTimeSeconds = Number(((Date.now() - startedAtRef.current) / 1000).toFixed(2));
      const imageDataUrl = canvasRef.current.toDataURL("image/png");
      const response = await fetch(`${API_BASE_URL}/api/screening/${screeningId}/drawing`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          imageDataUrl,
          strokes: strokesRef.current,
          targetTime: "11:10",
          completionTimeSeconds
        })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Unable to analyze drawing");
      setAnalysisResult(data.drawing?.response_data?.imageAnalysis || null);
      setStatusMessage("Clock drawing analyzed and saved.");
      await onComplete?.(data);
    } catch (error) {
      setStatusMessage(error.message || "Error submitting drawing");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSkip = async () => {
    if (!skipReason.trim()) return;
    setIsSubmitting(true);
    try {
      const completionTimeSeconds = Number(((Date.now() - startedAtRef.current) / 1000).toFixed(2));
      const response = await fetch(`${API_BASE_URL}/api/screening/${screeningId}/drawing`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          skipped: true,
          skipReason: skipReason.trim(),
          completionTimeSeconds
        })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Unable to skip drawing");
      await onComplete?.(data);
    } catch (error) {
      setStatusMessage(error.message || "Error skipping drawing");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="task-box">
      <p className="eyebrow">Clock Drawing Assessment</p>
      <h2>Draw a clock face showing 11:10</h2>
      <p>Use your mouse, finger, or stylus to draw the clock circle, numbers 1–12, and hands.</p>
      <div className="memory-timer-box">
        Elapsed: {elapsedSeconds.toFixed(1)}s · Strokes: {strokeCount}
      </div>
      <div className="canvas-wrapper" style={{ margin: "12px 0" }}>
        <canvas
          ref={canvasRef}
          width={360}
          height={360}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={finishStroke}
          onPointerCancel={finishStroke}
          style={{
            border: "2px solid #cbd5e1",
            borderRadius: "12px",
            background: "#ffffff",
            touchAction: "none",
            width: "100%",
            maxWidth: "360px",
            height: "auto",
            cursor: "crosshair"
          }}
        />
      </div>
      <p role="status">{statusMessage}</p>
      {analysisResult && (
        <div className="report-section">
          <p>
            <strong>Spatial metrics:</strong> Circularity {(analysisResult.circularity_score * 100).toFixed(0)}% ·
            Quadrant balance {(analysisResult.quadrant_balance_score * 100).toFixed(0)}% ·
            Detected number regions: {analysisResult.detected_number_regions}
          </p>
          <p className="muted-text">Rule-based spatial measurements only; not a clinical diagnosis.</p>
        </div>
      )}
      <div className="task-actions" style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
        <button type="button" className="ghost-btn" onClick={clearCanvas} disabled={isSubmitting}>
          Clear &amp; Restart
        </button>
        <button type="button" className="primary-btn" onClick={handleSubmit} disabled={isSubmitting}>
          {isSubmitting ? "Analyzing..." : "Submit Drawing"}
        </button>
      </div>
      <details style={{ marginTop: "12px" }}>
        <summary>Skip this task</summary>
        <label>
          <span>Reason</span>
          <input value={skipReason} onChange={(e) => setSkipReason(e.target.value)} maxLength={500} />
        </label>
        <button type="button" className="ghost-btn" disabled={!skipReason.trim() || isSubmitting} onClick={handleSkip}>
          Skip and continue
        </button>
      </details>
    </div>
  );
}

export default ClockDrawingTask;
