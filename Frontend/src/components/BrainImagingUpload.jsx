import { useCallback, useEffect, useState } from "react";
import { API_BASE_URL } from "../api.js";

function BrainImagingUpload({ token, screeningId }) {
  const [modality, setModality] = useState("mri");
  const [scans, setScans] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [status, setStatus] = useState("");

  const loadScans = useCallback(async () => {
    if (!token || !screeningId) return;
    try {
      const res = await fetch(`${API_BASE_URL}/api/imaging/screening/${screeningId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) return;
      const data = await res.json();
      setScans(Array.isArray(data.scans) ? data.scans : []);
    } catch {
      // ignore
    }
  }, [token, screeningId]);

  useEffect(() => {
    void loadScans();
  }, [loadScans]);

  const handleFileChange = async (event) => {
    const file = event.target.files?.[0];
    if (!file || !screeningId) return;
    setUploading(true);
    setStatus(`Validating and uploading ${modality.toUpperCase()} scan...`);
    try {
      const res = await fetch(`${API_BASE_URL}/api/imaging/upload`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/octet-stream",
          "x-screening-id": String(screeningId),
          "x-imaging-modality": modality,
          "x-file-name": file.name
        },
        body: file
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Imaging upload failed");
      setStatus(`${modality.toUpperCase()} scan validated and stored securely.`);
      await loadScans();
    } catch (err) {
      setStatus(err.message || "Error uploading scan");
    } finally {
      setUploading(false);
      event.target.value = "";
    }
  };

  const deleteScan = async (scanId) => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/imaging/${scanId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        setScans((prev) => prev.filter((s) => s.id !== scanId));
        setStatus("Scan deleted.");
      }
    } catch {
      setStatus("Unable to delete scan.");
    }
  };

  return (
    <section className="report-section" aria-label="Brain Imaging (Optional)">
      <h3>Brain Imaging (Optional)</h3>
      <p className="muted-text">
        Optional research upload for 3D MRI or CT volumes (.nii, .nii.gz, .dcm, or DICOM .zip). Screenshots/photos are rejected.
      </p>
      {!screeningId ? (
        <p className="muted-text">Start or select a screening session to attach an optional brain scan.</p>
      ) : (
        <>
          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", alignItems: "center", marginTop: "8px" }}>
            <select value={modality} onChange={(e) => setModality(e.target.value)} disabled={uploading}>
              <option value="mri">Structural MRI</option>
              <option value="ct">Brain CT</option>
            </select>
            <input
              type="file"
              accept=".nii,.nii.gz,.dcm,.zip"
              onChange={handleFileChange}
              disabled={uploading}
              aria-label="Upload brain imaging scan"
            />
          </div>
          {status && <p role="status" style={{ marginTop: "8px" }}>{status}</p>}
          {scans.length > 0 && (
            <div style={{ display: "grid", gap: "8px", marginTop: "10px" }}>
              {scans.map((s) => (
                <div key={s.id} style={{ padding: "8px", border: "1px solid #e2e8f0", borderRadius: "8px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <strong>{s.modality.toUpperCase()} ({s.original_format})</strong> · {s.processing_status}
                    {s.model_output?.status === "available_experimental_poc" ? (
                      <div className="muted-text" style={{ marginTop: "4px" }}>
                        <div>
                          <strong>Experimental MRI Research Label:</strong>{" "}
                          {s.model_output.prediction?.predicted_label || "unavailable"}
                          {s.model_output.prediction?.class_scores && (
                            <span>
                              {" "}(uncalibrated relative scores:{" "}
                              {Object.entries(s.model_output.prediction.class_scores)
                                .map(([k, v]) => `${k}: ${Number(v).toFixed(3)}`)
                                .join(" · ")}
                              )
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: "0.82rem", marginTop: "2px" }}>
                          Model: {s.model_output.model_version} ({s.model_output.model_name}) ·{" "}
                          {s.model_output.disclaimer || "This imaging model is an experimental research prototype and is not intended for clinical diagnosis. Results must be interpreted by qualified healthcare professionals."}
                        </div>
                      </div>
                    ) : (
                      <div className="muted-text">
                        AI status: {s.model_output?.status || "unavailable"} — {s.model_output?.reason || "Research-only"}
                      </div>
                    )}
                  </div>
                  <button type="button" className="ghost-btn" onClick={() => deleteScan(s.id)}>Delete</button>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </section>
  );
}

export default BrainImagingUpload;
