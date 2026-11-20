import { useRef, useState } from "react";

function DelayedMemoryTask({ wordsShown, onNext }) {
  const [recalled, setRecalled] = useState(() => Array((wordsShown || []).length || 5).fill(""));
  const startedAtRef = useRef(Date.now());

  const updateWord = (idx, val) => {
    const next = [...recalled];
    next[idx] = val;
    setRecalled(next);
  };

  const handleSubmit = async () => {
    const responseTime = Number(((Date.now() - startedAtRef.current) / 1000).toFixed(2));
    await onNext({
      wordsShown,
      wordsRecalled: recalled,
      responseTime
    });
  };

  return (
    <div className="task-box">
      <p className="eyebrow">Delayed Memory Recall</p>
      <h2>Recall the 5 words you memorized at the beginning of this assessment</h2>
      <p>Type as many of the original words as you remember. Leave blank if you do not recall a word.</p>
      <div className="recall-grid" style={{ marginTop: "12px" }}>
        {recalled.map((entry, idx) => (
          <input
            key={idx}
            value={entry}
            onChange={(e) => updateWord(idx, e.target.value)}
            placeholder={`Delayed word ${idx + 1}`}
          />
        ))}
      </div>
      <div className="task-actions">
        <button type="button" className="primary-btn" onClick={handleSubmit}>
          Submit Delayed Recall
        </button>
      </div>
    </div>
  );
}

export default DelayedMemoryTask;
