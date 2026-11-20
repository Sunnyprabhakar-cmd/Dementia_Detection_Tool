import { useEffect, useRef, useState } from "react";

// Original self-authored inline SVG stimuli (zero external licensing dependencies)
const PICTURE_ITEMS = [
  {
    id: "house",
    label: "House",
    isTarget: true,
    svg: (
      <svg viewBox="0 0 80 80" width="64" height="64" aria-hidden="true">
        <polygon points="40,12 12,38 68,38" fill="#b85f57" />
        <rect x="20" y="38" width="40" height="30" fill="#fde68a" stroke="#78350f" strokeWidth="2" />
        <rect x="34" y="48" width="12" height="20" fill="#78350f" />
      </svg>
    )
  },
  {
    id: "sun",
    label: "Sun",
    isTarget: true,
    svg: (
      <svg viewBox="0 0 80 80" width="64" height="64" aria-hidden="true">
        <circle cx="40" cy="40" r="18" fill="#f59e0b" />
        <g stroke="#d97706" strokeWidth="3">
          <line x1="40" y1="8" x2="40" y2="16" />
          <line x1="40" y1="64" x2="40" y2="72" />
          <line x1="8" y1="40" x2="16" y2="40" />
          <line x1="64" y1="40" x2="72" y2="40" />
        </g>
      </svg>
    )
  },
  {
    id: "tree",
    label: "Tree",
    isTarget: true,
    svg: (
      <svg viewBox="0 0 80 80" width="64" height="64" aria-hidden="true">
        <rect x="35" y="46" width="10" height="22" fill="#78350f" />
        <circle cx="40" cy="34" r="20" fill="#16a34a" />
      </svg>
    )
  },
  {
    id: "boat",
    label: "Boat",
    isTarget: false,
    svg: (
      <svg viewBox="0 0 80 80" width="64" height="64" aria-hidden="true">
        <polygon points="15,50 65,50 55,65 25,65" fill="#2563eb" />
        <polygon points="40,16 40,48 60,48" fill="#93c5fd" />
      </svg>
    )
  },
  {
    id: "star",
    label: "Star",
    isTarget: false,
    svg: (
      <svg viewBox="0 0 80 80" width="64" height="64" aria-hidden="true">
        <polygon points="40,10 48,30 70,30 52,44 58,66 40,52 22,66 28,44 10,30 32,30" fill="#eab308" />
      </svg>
    )
  },
  {
    id: "cup",
    label: "Cup",
    isTarget: false,
    svg: (
      <svg viewBox="0 0 80 80" width="64" height="64" aria-hidden="true">
        <rect x="22" y="28" width="30" height="32" rx="4" fill="#64748b" />
        <circle cx="56" cy="42" r="8" fill="none" stroke="#64748b" strokeWidth="4" />
      </svg>
    )
  }
];

function PictureRecognitionTask({ onNext }) {
  const [phase, setPhase] = useState("study"); // study | recognize
  const [countdown, setCountdown] = useState(6);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const startedAtRef = useRef(Date.now());

  const targets = PICTURE_ITEMS.filter((item) => item.isTarget);

  useEffect(() => {
    if (phase !== "study") return undefined;
    const timer = window.setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          window.clearInterval(timer);
          setPhase("recognize");
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [phase]);

  const toggleItem = (id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSubmit = async () => {
    const responseTime = Number(((Date.now() - startedAtRef.current) / 1000).toFixed(2));
    const items = PICTURE_ITEMS.map((item) => ({
      id: item.id,
      isTarget: item.isTarget,
      selected: selectedIds.has(item.id)
    }));
    await onNext({ items, responseTime });
  };

  return (
    <div className="task-box">
      <p className="eyebrow">Picture Recognition</p>
      <h2>{phase === "study" ? "Remember these 3 pictures" : "Select the 3 pictures you saw earlier"}</h2>
      <div className="memory-timer-box">
        {phase === "study" ? `Memorize (${countdown}s remaining)` : `Selected: ${selectedIds.size}`}
      </div>

      {phase === "study" ? (
        <div className="metric-grid" style={{ marginTop: "12px" }}>
          {targets.map((item) => (
            <div key={item.id} className="report-item" style={{ textAlign: "center" }}>
              {item.svg}
              <strong>{item.label}</strong>
            </div>
          ))}
        </div>
      ) : (
        <>
          <div className="metric-grid" style={{ marginTop: "12px" }}>
            {PICTURE_ITEMS.map((item) => {
              const active = selectedIds.has(item.id);
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => toggleItem(item.id)}
                  className={active ? "report-item active" : "report-item"}
                  style={{
                    cursor: "pointer",
                    border: active ? "2px solid #2563eb" : "1px solid #cbd5e1",
                    background: active ? "#eff6ff" : "#ffffff"
                  }}
                >
                  {item.svg}
                  <strong>{item.label}</strong>
                </button>
              );
            })}
          </div>
          <div className="task-actions" style={{ marginTop: "14px" }}>
            <button type="button" className="primary-btn" onClick={handleSubmit}>
              Submit Picture Recognition
            </button>
          </div>
        </>
      )}
    </div>
  );
}

export default PictureRecognitionTask;
