import { useCallback, useEffect, useState } from "react";
import { API_BASE_URL } from "../api.js";
import MultimodalSummary from "./MultimodalSummary.jsx";
import BrainImagingUpload from "./BrainImagingUpload.jsx";

function PatientDashboard({
  token,
  language,
  onLanguageChange,
  onStartScreening,
  onContinueScreening,
  activeScreeningId
}) {
  const [dashboard, setDashboard] = useState(null);
  const [history, setHistory] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [compareA, setCompareA] = useState("");
  const [compareB, setCompareB] = useState("");
  const [comparison, setComparison] = useState(null);
  const [selectedReport, setSelectedReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadAll = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError("");
    try {
      const headers = { Authorization: `Bearer ${token}` };
      const [dashRes, histRes, notifRes] = await Promise.all([
        fetch(`${API_BASE_URL}/api/patient/dashboard`, { headers }),
        fetch(`${API_BASE_URL}/api/results/history`, { headers }),
        fetch(`${API_BASE_URL}/api/notifications`, { headers })
      ]);
      if (dashRes.ok) {
        const d = await dashRes.json();
        setDashboard(d.dashboard || null);
      }
      if (histRes.ok) {
        const h = await histRes.json();
        setHistory(Array.isArray(h.history) ? h.history : []);
      }
      if (notifRes.ok) {
        const n = await notifRes.json();
        setNotifications(Array.isArray(n.notifications) ? n.notifications : []);
      }
    } catch (err) {
      setError(err.message || "Unable to load patient dashboard");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  const downloadPdf = async (screeningId) => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/screening/${screeningId}/report.pdf`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error("Unable to download PDF report");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `mindscan-report-${screeningId}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err.message);
    }
  };

  const viewReport = async (screeningId) => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/screening/${screeningId}/summary`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Unable to load report");
      setSelectedReport(data.summary);
    } catch (err) {
      setError(err.message);
    }
  };

  const runCompare = async () => {
    if (!compareA || !compareB || compareA === compareB) return;
    try {
      const res = await fetch(`${API_BASE_URL}/api/results/compare?a=${compareA}&b=${compareB}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Unable to compare assessments");
      setComparison(data.comparison);
    } catch (err) {
      setError(err.message);
    }
  };

  const markRead = async (id) => {
    await fetch(`${API_BASE_URL}/api/notifications/${id}/read`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${token}` }
    });
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)));
  };

  const saveLanguagePreference = async (nextLang) => {
    onLanguageChange(nextLang);
    await fetch(`${API_BASE_URL}/api/patient/preferences`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ preferredLanguage: nextLang })
    }).catch(() => {});
  };

  if (loading) return <div className="task-box"><p>Loading patient dashboard...</p></div>;

  return (
    <div className="patient-dashboard" style={{ display: "grid", gap: "16px" }}>
      <section className="report-section">
        <p className="eyebrow">Patient Dashboard</p>
        <h2>Welcome{dashboard?.profile?.name ? `, ${dashboard.profile.name}` : ""}</h2>
        <p className="muted-text">
          MindScan AI is a research screening prototype and does not provide a medical diagnosis of dementia or MCI.
        </p>
        {error && <p className="report-warning">{error}</p>}
        <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", marginTop: "10px" }}>
          <button type="button" className="primary-btn" onClick={onStartScreening}>
            Start New Screening
          </button>
          {(activeScreeningId || dashboard?.activeScreening?.screeningId) && (
            <button type="button" className="ghost-btn" onClick={onContinueScreening}>
              Continue Active Screening (#{activeScreeningId || dashboard?.activeScreening?.screeningId})
            </button>
          )}
        </div>
      </section>

      <section className="report-section">
        <h3>Profile &amp; Preferences</h3>
        <p>
          <strong>Role:</strong> Patient · <strong>Completed reports:</strong> {history.length}
        </p>
        <label style={{ maxWidth: "240px", display: "block" }}>
          <span>Preferred Language</span>
          <select value={language} onChange={(e) => saveLanguagePreference(e.target.value)}>
            <option value="en">English</option>
            <option value="si">Sinhala</option>
            <option value="ta">தமிழ்</option>
          </select>
        </label>
      </section>

      {notifications.length > 0 && (
        <section className="report-section">
          <h3>Notifications ({notifications.filter((n) => !n.is_read).length} unread)</h3>
          <ul className="feature-list">
            {notifications.slice(0, 5).map((n) => (
              <li key={n.id} style={{ opacity: n.is_read ? 0.65 : 1 }}>
                <strong>{n.title}:</strong> {n.message}{" "}
                {!n.is_read && (
                  <button type="button" className="ghost-btn" onClick={() => markRead(n.id)}>
                    Mark read
                  </button>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="report-section">
        <h3>Assessment History &amp; Reports</h3>
        {history.length === 0 ? (
          <p className="muted-text">No completed assessments yet.</p>
        ) : (
          <div style={{ display: "grid", gap: "8px" }}>
            {history.map((item) => (
              <div
                key={item.screeningId}
                style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "8px", padding: "8px", border: "1px solid #e2e8f0", borderRadius: "8px" }}
              >
                <div>
                  <strong>Screening #{item.screeningId}</strong>
                  <div className="muted-text">{new Date(item.timestamp).toLocaleString()}</div>
                </div>
                <div style={{ display: "flex", gap: "6px" }}>
                  <button type="button" className="ghost-btn" onClick={() => viewReport(item.screeningId)}>
                    View Summary
                  </button>
                  <button type="button" className="primary-btn" onClick={() => downloadPdf(item.screeningId)}>
                    Download PDF
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {history.length >= 2 && (
        <section className="report-section">
          <h3>Compare Two Assessments</h3>
          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", alignItems: "center" }}>
            <select value={compareA} onChange={(e) => setCompareA(e.target.value)}>
              <option value="">Baseline screening</option>
              {history.map((h) => <option key={h.screeningId} value={h.screeningId}>#{h.screeningId}</option>)}
            </select>
            <select value={compareB} onChange={(e) => setCompareB(e.target.value)}>
              <option value="">Comparison screening</option>
              {history.map((h) => <option key={h.screeningId} value={h.screeningId}>#{h.screeningId}</option>)}
            </select>
            <button type="button" className="primary-btn" onClick={runCompare}>Compare</button>
          </div>
          {comparison && (
            <div style={{ marginTop: "10px" }}>
              <p>
                Completeness delta: {comparison.changes.completenessDeltaPercent ?? "N/A"}% ·
                Cognitive delta: {comparison.changes.cognitiveIndicatorDelta ?? "N/A"} ·
                Drawing delta: {comparison.changes.drawingIndicatorDelta ?? "N/A"}
              </p>
              <p className="muted-text">{comparison.note}</p>
            </div>
          )}
        </section>
      )}

      {selectedReport && <MultimodalSummary summary={selectedReport} />}

      <BrainImagingUpload
        token={token}
        screeningId={activeScreeningId || dashboard?.activeScreening?.screeningId || history[0]?.screeningId || null}
      />
    </div>
  );
}

export default PatientDashboard;
