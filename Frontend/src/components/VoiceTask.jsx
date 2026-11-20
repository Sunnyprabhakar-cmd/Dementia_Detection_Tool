import { useEffect, useRef, useState } from "react";
import { API_BASE_URL } from "../api.js";

const SPEECH_TASKS = {
  picture_description: {
    title: "Describe the picture in your own words",
    prompt: "Describe everything you see happening in the landscape picture below.",
    prepSeconds: 5
  },
  semantic_fluency: {
    title: "Semantic verbal fluency (spoken)",
    prompt: "Name as many animals as you can in 20 seconds.",
    prepSeconds: 3
  },
  phonemic_fluency: {
    title: "Phonemic verbal fluency (English only)",
    prompt: "Say as many words starting with the letter 'F' as you can (excluding proper names). Validated for English protocol only.",
    prepSeconds: 3
  },
  spontaneous_speech: {
    title: "Spontaneous speech sample",
    prompt: "Talk about your typical morning routine or a memorable recent event.",
    prepSeconds: 5
  },
  story_retelling: {
    title: "Story retelling",
    prompt: "Read & remember: 'Meera walked to the market early in the morning to buy fresh mangoes and bread before the rain started.' Now retell the story in your own words.",
    prepSeconds: 8
  },
  qa_verbal: {
    title: "Short verbal question-answer",
    prompt: "Explain in your own words how you prepare a cup of tea or coffee from start to finish.",
    prepSeconds: 3
  }
};

function VoiceTask({ token, onVoiceResult, onFinish }) {
  const [speechTaskType, setSpeechTaskType] = useState("picture_description");
  const [countdown, setCountdown] = useState(20);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isRecording, setIsRecording] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [consented, setConsented] = useState(false);
  const [status, setStatus] = useState("Ready to record a short voice sample.");
  const [errorMessage, setErrorMessage] = useState("");
  const [transcript, setTranscript] = useState("");
  const [transcriptAnalysis, setTranscriptAnalysis] = useState(null);
  const [speechFeatures, setSpeechFeatures] = useState(null);
  const [speechIntelligence, setSpeechIntelligence] = useState(null);
  const [qualityWarnings, setQualityWarnings] = useState([]);
  const [detectedLanguage, setDetectedLanguage] = useState("");
  const [languageConfidence, setLanguageConfidence] = useState(null);
  const [classifierResult, setClassifierResult] = useState(null);
  const [acousticPocResult, setAcousticPocResult] = useState(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [textDescription, setTextDescription] = useState("");
  const recorderRef = useRef(null);
  const streamRef = useRef(null);
  const timerRef = useRef(null);
  const startTimeRef = useRef(null);
  const previewUrlRef = useRef("");

  const stopRecording = () => {
    clearInterval(timerRef.current);
    if (recorderRef.current?.state === "recording") recorderRef.current.stop();
  };

  const uploadRecording = (blob, contentType) => new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open("POST", `${API_BASE_URL}/api/audio/upload`);
    request.setRequestHeader("Authorization", `Bearer ${token}`);
    request.setRequestHeader("Content-Type", contentType);
    request.timeout = 185000;
    request.upload.addEventListener("progress", (event) => {
      if (event.lengthComputable) setUploadProgress(Math.round((event.loaded / event.total) * 100));
    });
    request.addEventListener("load", () => {
      let data;
      try { data = JSON.parse(request.responseText); }
      catch { reject(new Error("The audio service returned an unreadable response. Please retry.")); return; }
      if (request.status < 200 || request.status >= 300) {
        reject(new Error(data.error?.message || data.message || "Audio transcription failed."));
        return;
      }
      resolve(data);
    });
    request.addEventListener("error", () => reject(new Error("Network error while uploading audio. Check your connection and retry.")));
    request.addEventListener("timeout", () => reject(new Error("Audio processing timed out. Try a shorter recording.")));
    request.send(blob);
  });

  useEffect(() => {
    if (!isRecording) return undefined;
    timerRef.current = window.setInterval(() => {
      setCountdown((current) => {
        if (current <= 1) {
          clearInterval(timerRef.current);
          if (recorderRef.current?.state === "recording") recorderRef.current.stop();
          return 0;
        }
        return current - 1;
      });
    }, 1000);
    return () => clearInterval(timerRef.current);
  }, [isRecording]);

  const resetAnalysisState = () => {
    setClassifierResult(null);
    setAcousticPocResult(null);
    setTranscript("");
    setDetectedLanguage("");
    setLanguageConfidence(null);
    setTranscriptAnalysis(null);
    setSpeechFeatures(null);
    setSpeechIntelligence(null);
    setQualityWarnings([]);
  };

  const processAudioBlob = async (blob, contentType) => {
    setIsUploading(true);
    setUploadProgress(0);
    setStatus("Uploading securely for temporary transcription & speech analysis...");
    try {
      if (!blob?.size) throw new Error("No audio was captured. Check microphone permission or file selection.");
      if (blob.size > 12 * 1024 * 1024) throw new Error("This audio file exceeds 12 MB. Please use a shorter sample.");
      if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
      previewUrlRef.current = URL.createObjectURL(blob);
      setPreviewUrl(previewUrlRef.current);

      const data = await uploadRecording(blob, contentType);
      const result = data.transcription;
      if (!result || result.status !== "success") throw new Error("The server did not return a transcript.");
      const transcriptText = String(result.transcript || "").trim();
      setTranscript(transcriptText);
      setDetectedLanguage(result.language || "unknown");
      setLanguageConfidence(result.language_probability ?? null);
      const analysis = data.transcript_analysis || result.transcript_analysis || null;
      setTranscriptAnalysis(analysis);
      setSpeechFeatures(data.speech_features || result.speech_features || null);
      setSpeechIntelligence(data.speech_intelligence || result.speech_intelligence || null);
      setQualityWarnings(data.quality_warnings || result.quality_warnings || []);
      setClassifierResult(data.classifier || { status: "unavailable" });
      setAcousticPocResult(data.acoustic_classifier_poc || result.acoustic_classifier_poc || null);
      if (result.duration_seconds != null) {
        setRecordingSeconds(Number(Number(result.duration_seconds).toFixed(1)));
      }
      setStatus(transcriptText
        ? "Transcription and speech analysis completed."
        : "No speech could be transcribed. You may re-record or continue.");
      onVoiceResult?.({
        status: transcriptText ? "completed" : "empty",
        duration: result.duration_seconds ?? null,
        language: result.language || "unknown",
        speech_features: data.speech_features || result.speech_features || null,
        transcript_analysis: analysis,
        quality_warnings: data.quality_warnings || result.quality_warnings || [],
        quality_reliable: data.speech_intelligence?.quality_reliable ?? null,
        acoustic_classifier_poc: data.acoustic_classifier_poc || result.acoustic_classifier_poc || null,
        provenance: result.provenance || null
      });
    } catch (error) {
      setErrorMessage(error.message || "Audio transcription failed.");
      setStatus("Processing failed. You can re-record or continue without this task.");
      onVoiceResult?.({ status: "unavailable", duration: null, language: "", speech_features: null, transcript_analysis: null, provenance: null });
    } finally {
      setIsUploading(false);
    }
  };

  const handleFileUpload = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    try {
      setErrorMessage("");
      if (!consented) throw new Error("Please confirm consent before uploading audio.");
      if (!token) throw new Error("Please sign in before uploading audio.");
      resetAnalysisState();
      const ext = file.name.split(".").pop()?.toLowerCase();
      const mimeByExt = { wav: "audio/wav", webm: "audio/webm", ogg: "audio/ogg", mp3: "audio/mpeg", m4a: "audio/mp4" };
      const contentType = (file.type && file.type.startsWith("audio/")) ? file.type.split(";")[0].toLowerCase() : (mimeByExt[ext] || "audio/wav");
      await processAudioBlob(file, contentType);
    } catch (error) {
      setErrorMessage(error.message || "Audio upload failed.");
    }
  };

  const startRecording = async () => {
    try {
      setErrorMessage("");
      if (!consented) throw new Error("Please confirm consent before recording.");
      if (!token) throw new Error("Please sign in before recording.");
      if (!navigator.mediaDevices?.getUserMedia) throw new Error("Microphone access is unavailable in this browser.");
      if (!window.MediaRecorder) throw new Error("Audio recording is not supported by this browser.");
      if (transcript && !window.confirm("Replace the previous recording and transcript?")) return;

      resetAnalysisState();

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mimeType = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus"]
        .find((type) => window.MediaRecorder.isTypeSupported(type));
      const recorder = mimeType
        ? new window.MediaRecorder(stream, { mimeType })
        : new window.MediaRecorder(stream);
      const chunks = [];
      recorder.ondataavailable = (event) => { if (event.data?.size) chunks.push(event.data); };
      recorder.onstop = async () => {
        setIsRecording(false);
        setRecordingSeconds(Number(Math.min(20, Math.max(0, (Date.now() - startTimeRef.current) / 1000)).toFixed(1)));
        const blobType = recorder.mimeType || "audio/webm";
        const blob = new Blob(chunks, { type: blobType });
        try {
          await processAudioBlob(blob, blobType.split(";")[0].toLowerCase());
        } finally {
          stream.getTracks().forEach((track) => track.stop());
          streamRef.current = null;
        }
      };
      recorderRef.current = recorder;
      recorder.start();
      setCountdown(20);
      setRecordingSeconds(0);
      startTimeRef.current = Date.now();
      setIsRecording(true);
      setStatus(`Recording (${speechTaskType.replace("_", " ")}) for up to 20 seconds...`);
    } catch (error) {
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      setErrorMessage(error.message || "Unable to start recording.");
    }
  };

  useEffect(() => () => {
    clearInterval(timerRef.current);
    streamRef.current?.getTracks().forEach((track) => track.stop());
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
  }, []);

  const timing = speechIntelligence?.timing_summary || {};
  const acoustic = speechIntelligence?.acoustic_features || {};
  const sf = speechFeatures?.features || {};
  const totalDur = timing.total_duration_seconds ?? sf.audio_duration_seconds ?? null;
  const voicedDur = timing.voiced_duration_seconds ?? sf.speaking_duration_seconds ?? null;
  const voicedPct = totalDur && voicedDur != null ? Math.min(100, Math.round((voicedDur / totalDur) * 100)) : null;

  return (
    <div className="task-box">
      <p className="eyebrow">Voice &amp; Speech Assessment</p>
      <h2>{SPEECH_TASKS[speechTaskType].title}</h2>
      <p>{SPEECH_TASKS[speechTaskType].prompt}</p>

      <label>
        <span>Speech task type</span>
        <select value={speechTaskType} onChange={(e) => setSpeechTaskType(e.target.value)} disabled={isRecording || isUploading}>
          <option value="picture_description">Picture Description</option>
          <option value="semantic_fluency">Semantic Verbal Fluency</option>
          <option value="phonemic_fluency">Phonemic Fluency (English only)</option>
          <option value="spontaneous_speech">Spontaneous Speech</option>
          <option value="story_retelling">Story Retelling</option>
          <option value="qa_verbal">Verbal Question-Answer</option>
        </select>
      </label>

      {speechTaskType === "picture_description" && (
        <div className="picture-stimulus" role="img" aria-label="A landscape illustration with a house, trees, path, flowers, and pond">
          <svg viewBox="0 0 600 280" aria-hidden="true">
            <rect width="600" height="280" fill="#d9efff" /><circle cx="500" cy="58" r="34" fill="#f5c45c" />
            <rect y="175" width="600" height="105" fill="#8fcf9b" /><path d="M0 215 Q140 180 270 220 T600 205 V280 H0Z" fill="#68ad7f" />
            <path d="M247 280 L325 179 L400 280" fill="#d9c39a" /><rect x="92" y="105" width="110" height="86" rx="4" fill="#fff3d4" />
            <path d="M78 109 L147 57 L216 109Z" fill="#b85f57" /><rect x="133" y="143" width="30" height="48" fill="#74564b" />
            <g fill="#397c55"><circle cx="55" cy="140" r="32" /><circle cx="258" cy="128" r="35" /><circle cx="430" cy="151" r="31" /></g>
            <ellipse cx="502" cy="226" rx="59" ry="22" fill="#6dbad0" />
          </svg>
        </div>
      )}

      <label className="consent-field">
        <input type="checkbox" checked={consented} onChange={(e) => setConsented(e.target.checked)} />
        <span>I consent to microphone use and temporary transcription for this task.</span>
      </label>

      <div className="memory-timer-box">
        {isRecording ? `Recording: ${Math.min(20, 20 - countdown)}s / 20s` : `Recorded duration: ${recordingSeconds.toFixed(1)}s`}
      </div>

      <div className="voice-recording-box">
        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", alignItems: "center" }}>
          <button className="primary-btn" type="button" onClick={isRecording ? stopRecording : startRecording} disabled={isUploading}>
            {isRecording ? "Stop recording" : isUploading ? "Uploading & analyzing..." : transcript ? "Re-record" : "Start recording"}
          </button>
          <label className="secondary-btn" style={{ cursor: isUploading || isRecording ? "not-allowed" : "pointer", display: "inline-block" }}>
            Upload WAV / audio file
            <input
              type="file"
              accept=".wav,.webm,.ogg,.mp3,.m4a,audio/*"
              onChange={handleFileUpload}
              disabled={isUploading || isRecording}
              style={{ display: "none" }}
            />
          </label>
        </div>
        <p role="status">{status}</p>
        {errorMessage && <p className="report-warning" role="alert">{errorMessage}</p>}
        {isUploading && (
          <div className="upload-progress" role="status">
            <progress max="100" value={uploadProgress} aria-label="Audio upload progress" />
            <span>{uploadProgress}% uploaded</span>
          </div>
        )}
        {previewUrl && (
          <div className="recording-preview">
            <label htmlFor="voice-playback">Local recording playback</label>
            <audio id="voice-playback" controls src={previewUrl} />
          </div>
        )}
        {(detectedLanguage || speechIntelligence) && (
          <div className="report-section" style={{ marginTop: "10px" }}>
            <h3>Audio Quality</h3>
            <p>
              <strong>Quality reliability:</strong>{" "}
              {speechIntelligence?.quality_reliable === true ? "Reliable for acoustic analysis" : speechIntelligence?.quality_reliable === false ? "Unreliable (gated from experimental scoring)" : "Pending"}
              {acoustic.estimated_snr_db != null ? ` · Estimated SNR: ${acoustic.estimated_snr_db} dB` : ""}
            </p>
            {speechIntelligence?.quality_reliable === false && (
              <div className="report-warning" role="note">
                Recording quality marked unreliable; results should not be interpreted as cognitive findings.
              </div>
            )}
            {qualityWarnings.length > 0 && (
              <div className="report-warning" role="note">
                Audio quality warnings: {qualityWarnings.join(", ")}
              </div>
            )}
          </div>
        )}
        {transcript && (
          <div className="transcript-panel">
            <h3>Speech Transcription</h3>
            {detectedLanguage && (
              <p>
                <strong>Detected language:</strong> {detectedLanguage}
                {languageConfidence != null ? ` (detection score: ${Number(languageConfidence).toFixed(2)})` : ""}
                {speechIntelligence?.language_capabilities && (
                  <span> · Linguistic rules: {speechIntelligence.language_capabilities.linguistic_rules_supported ? "Supported" : "Unavailable"}</span>
                )}
              </p>
            )}
            <p>{transcript}</p>
          </div>
        )}

        {(totalDur != null || acoustic.pitch_mean_hz != null) && (
          <div className="report-section">
            <h3>Acoustic Feature Analysis (Non-diagnostic)</h3>
            {voicedPct != null && (
              <div style={{ marginBottom: "10px" }}>
                <small>Voiced ({voicedDur?.toFixed(1)}s) vs Silence ({totalDur?.toFixed(1)}s total)</small>
                <div style={{ height: "10px", background: "#e2e8f0", borderRadius: "6px", overflow: "hidden" }}>
                  <div style={{ width: `${voicedPct}%`, height: "100%", background: "#2563eb" }} />
                </div>
              </div>
            )}
            <ul className="feature-list">
              <li>Speaking rate: {timing.speaking_rate_wpm ?? sf.speech_rate_words_per_minute ?? "Not measured"} words/min</li>
              <li>Pauses: {timing.pause_count ?? sf.pause_count ?? "Not measured"} (mean: {timing.mean_pause_seconds ?? sf.mean_pause_seconds ?? "N/A"}s)</li>
              <li>Pitch (F0): {acoustic.pitch_mean_hz != null ? `${acoustic.pitch_mean_hz} Hz (std: ${acoustic.pitch_std_hz} Hz)` : "Not measured"}</li>
              <li>Jitter / Shimmer / HNR: {acoustic.jitter_local != null ? `${acoustic.jitter_local} / ${acoustic.shimmer_local ?? "N/A"} / ${acoustic.hnr_mean_db ?? "N/A"} dB` : "Not measured"}</li>
              <li>Spectral centroid: {acoustic.spectral_centroid_hz != null ? `${acoustic.spectral_centroid_hz} Hz` : "Not measured"}</li>
            </ul>
          </div>
        )}

        <div className="report-section" style={{ marginTop: "10px" }}>
          <h3>Experimental Research Classifier Output</h3>
          {classifierResult?.status === "available_research_only"
            ? <p className="research-model-output">Experimental speech-model output: <strong>{classifierResult.prediction?.predicted_label || "unavailable"}</strong></p>
            : acousticPocResult?.status === "available_experimental_poc"
              ? (
                <div className="research-model-output">
                  <p>
                    <strong>Predicted research label:</strong> {acousticPocResult.prediction?.predicted_label || "unavailable"}
                  </p>
                  {acousticPocResult.prediction?.class_scores && (
                    <p>
                      <strong>Uncalibrated relative scores (not probabilities of dementia):</strong>{" "}
                      {Object.entries(acousticPocResult.prediction.class_scores)
                        .map(([k, v]) => `${k}: ${Number(v).toFixed(3)}`)
                        .join(" · ")}
                    </p>
                  )}
                </div>
              )
              : (
                <p className="muted-text">
                  {acousticPocResult?.message || "Speech classifier unavailable for this recording."}
                </p>
              )}
        </div>

        <div className="report-warning" role="note" style={{ marginTop: "10px" }}>
          <strong>Model Limitations &amp; Disclaimer:</strong>{" "}
          Experimental speech-based research screening output. This system is not a diagnostic tool and cannot establish whether a person has dementia.
          {acousticPocResult?.model_version && (
            <span>
              {" "}({acousticPocResult.model_version} / {acousticPocResult.model_name}; trained on DementiaNet public-figure YouTube interviews with weak biographical labels, English-only.)
            </span>
          )}
        </div>

        <label className="prompt-field" style={{ marginTop: "12px" }}>
          <span>Optional typed description (if not using microphone)</span>
          <textarea
            value={textDescription}
            onChange={(e) => setTextDescription(e.target.value)}
            placeholder="Describe what you see..."
            maxLength={1000}
          />
        </label>
      </div>

      <div className="task-actions">
        <button className="primary-btn" type="button" onClick={onFinish} disabled={isRecording || isUploading}>
          Continue
        </button>
      </div>
    </div>
  );
}

export default VoiceTask;
