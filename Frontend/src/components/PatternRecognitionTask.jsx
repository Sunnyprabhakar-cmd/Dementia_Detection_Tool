import { useRef, useState } from "react";

const PATTERN_ITEMS = [
  {
    id: "seq-1",
    prompt: "Complete the sequence: 2, 4, 6, 8, ?",
    options: ["9", "10", "12", "14"],
    expected: "10",
    difficulty: "easy"
  },
  {
    id: "seq-2",
    prompt: "Complete the visual shape sequence: ▲, ■, ▲, ■, ▲, ?",
    options: ["▲", "■", "●", "◆"],
    expected: "■",
    difficulty: "easy"
  },
  {
    id: "seq-3",
    prompt: "Complete the sequence: 5, 10, 20, 40, ?",
    options: ["50", "60", "80", "100"],
    expected: "80",
    difficulty: "medium"
  },
  {
    id: "seq-4",
    prompt: "Complete the alternating sequence: 1, 4, 9, 16, ?",
    options: ["20", "24", "25", "32"],
    expected: "25",
    difficulty: "hard"
  }
];

function PatternRecognitionTask({ onNext }) {
  const [answers, setAnswers] = useState({});
  const startedAtRef = useRef(Date.now());

  const selectOption = (id, option) => {
    setAnswers((prev) => ({ ...prev, [id]: option }));
  };

  const handleSubmit = async () => {
    const responseTime = Number(((Date.now() - startedAtRef.current) / 1000).toFixed(2));
    const items = PATTERN_ITEMS.map((item) => ({
      id: item.id,
      expected: item.expected,
      answer: answers[item.id] ?? "",
      skipped: !answers[item.id]
    }));
    await onNext({ items, responseTime });
  };

  return (
    <div className="task-box">
      <p className="eyebrow">Pattern Recognition</p>
      <h2>Complete each sequence by choosing the next item</h2>
      <div className="form-grid" style={{ marginTop: "12px" }}>
        {PATTERN_ITEMS.map((item, idx) => (
          <div key={item.id} className="report-section" style={{ marginBottom: "10px" }}>
            <p>
              <strong>{idx + 1}. ({item.difficulty})</strong> {item.prompt}
            </p>
            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginTop: "8px" }}>
              {item.options.map((opt) => {
                const active = answers[item.id] === opt;
                return (
                  <button
                    key={opt}
                    type="button"
                    className={active ? "primary-btn" : "ghost-btn"}
                    onClick={() => selectOption(item.id, opt)}
                  >
                    {opt}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
      <div className="task-actions">
        <button type="button" className="primary-btn" onClick={handleSubmit}>
          Submit Pattern Recognition
        </button>
      </div>
    </div>
  );
}

export default PatternRecognitionTask;
