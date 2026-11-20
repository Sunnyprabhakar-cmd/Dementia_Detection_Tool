import { useCallback, useEffect, useRef, useState } from "react";
import { API_BASE_URL } from "../api.js";
import MultimodalSummary from "./MultimodalSummary.jsx";

function ClinicianDashboard({ token }) {
  const [screenings, setScreenings] = useState([]);
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [selectedDetail, setSelectedDetail] = useState(null);
  const [reviewNotes, setReviewNotes] = useState("");
  const [reviewStatus, setReviewStatus] = useState("reviewed");
  const [followUp, setFollowUp] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const detailRef = useRef(null);

  const loadScreenings = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({ filter, q: search });
      const res = await fetch(`${API_BASE_URL}/api/clinician/screenings?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Unable to load patient assessments");
      setScreenings(Array.isArray(data.screenings) ? data.screenings : []);
    } catch (err) {
      setStatusMessage(err.message);
    } finally {
      setLoading(false);
    }
  }, [token, filter, search]);

  useEffect(() => {
    void loadScreenings();
  }, [loadScreenings]);

  const openAssessment = async (screeningId) => {
    setStatusMessage("");
    try {
      const res = await fetch(`${API_BASE_URL}/api/clinician/screenings/${screeningId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Unable to open assessment");
      setSelectedDetail(data);
      setTimeout(() => detailRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
    } catch (err) {
      setStatusMessage(err.message);
    }
  };

  const submitReview = async (event) => {
    event.preventDefault();
    if (!selectedDetail?.session?.id) return;
    try {
      const res = await fetch(`${API_BASE_URL}/api/clinician/screenings/${selectedDetail.session.id}/review`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          notes: reviewNotes,
          reviewStatus,
          followUpRecommended: followUp
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Unable to save clinician review");
      setReviewNotes("");
      setStatusMessage("Clinician review saved.");
      await openAssessment(selectedDetail.session.id);
      await loadScreenings();
    } catch (err) {
      setStatusMessage(err.message);
    }
  };

  const downloadPdf = async (screeningId) => {
    const res = await fetch(`${API_BASE_URL}/api/screening/${screeningId}/report.pdf`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!res.ok) return;
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `mindscan-report-${screeningId}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="clinician-dashboard" style={{ display: "grid", gap: "16px" }}>
      <section className="report-section">
        <p className="eyebrow">Clinician Portal</p>
        <h2>Assigned Patient Assessments</h2>
        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginTop: "10px" }}>
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by patient name or study code..."
            aria-label="Search patients"
          />
          <select value={filter} onChange={(e) => setFilter(e.target.value)} aria-label="Filter assessments">
            <option value="all">All Assigned</option>
            <option value="recent">Recently Assessed (14d)</option>
            <option value="incomplete">Incomplete Assessments</option>
            <option value="pending_review">Pending Review</option>
          </select>
        </div>
        {statusMessage && <p role="status" style={{ marginTop: "8px" }}>{statusMessage}</p>}
      </section>

      <section className="report-section">
        {loading ? (
          <p>Loading assigned patient records...</p>
        ) : screenings.length === 0 ? (
          <p className="muted-text">No authorized patient assessments match this filter.</p>
        ) : (
          <div style={{ display: "grid", gap: "8px" }}>
            {screenings.map((item) => (
              <div
                key={item.screening_id}
                style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "10px", padding: "10px", border: "1px solid #e2e8f0", borderRadius: "8px" }}
              >
                <div style={{ minWidth: "220px", flex: "1 1 240px" }}>
                  <strong>{item.patient_identifier || item.patient_name} — Screening #{item.screening_id}</strong>
                  <div className="muted-text">
                    Status: {item.status} · Completeness: {item.completeness_percent ?? "N/A"}% · Review: {item.review_status || "pending"}
                  </div>
                </div>
                <div style={{ display: "flex", gap: "8px", flexShrink: 0 }}>
                  <button type="button" className="ghost-btn" style={{ whiteSpace: "nowrap" }} onClick={() => openAssessment(item.screening_id)}>
                    Review
                  </button>
                  <button type="button" className="primary-btn" style={{ whiteSpace: "nowrap" }} onClick={() => downloadPdf(item.screening_id)}>
                    PDF
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {selectedDetail && (
        <section className="report-section" ref={detailRef}>
          <h3>Reviewing Screening #{selectedDetail.session.id}</h3>
          {selectedDetail.result?.task_scores?.__multimodalSummary && (
            <MultimodalSummary summary={selectedDetail.result.task_scores.__multimodalSummary} />
          )}

          <form onSubmit={submitReview} style={{ display: "grid", gap: "10px", marginTop: "14px" }}>
            <h4>Add Clinician Observations (Original patient responses remain immutable)</h4>
            <label>
              <span>Review Status</span>
              <select value={reviewStatus} onChange={(e) => setReviewStatus(e.target.value)}>
                <option value="in_review">In Review</option>
                <option value="reviewed">Reviewed</option>
                <option value="pending">Pending</option>
              </select>
            </label>
            <label>
              <span>Observations / Notes</span>
              <textarea
                required
                value={reviewNotes}
                onChange={(e) => setReviewNotes(e.target.value)}
                maxLength={2000}
                placeholder="Enter clinical observations..."
              />
            </label>
            <label className="consent-field">
              <input type="checkbox" checked={followUp} onChange={(e) => setFollowUp(e.target.checked)} />
              <span>Recommend follow-up evaluation</span>
            </label>
            <button type="submit" className="primary-btn">Save Clinician Review</button>
          </form>

          {selectedDetail.reviews?.length > 0 && (
            <div style={{ marginTop: "14px" }}>
              <h4>Previous Reviews</h4>
              <ul className="feature-list">
                {selectedDetail.reviews.map((rev) => (
                  <li key={rev.id}>
                    <strong>[{rev.review_status}] {rev.clinician_name}:</strong> {rev.notes}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      )}
    </div>
  );
}

export default ClinicianDashboard;
