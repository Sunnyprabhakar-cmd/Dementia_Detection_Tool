
import argparse
import json
from pathlib import Path
from typing import Any

if __package__:
    from .audio_validation import AudioValidationError, inspect_audio_file
    from .audio_classifier import classify_acoustic_poc, classify_configured_audio
    from .speech_features import extract_speech_features
    from .transcript_analysis import analyze_transcript
    from .preprocessing.speech_features import extract_speech_intelligence
else:
    from audio_validation import AudioValidationError, inspect_audio_file
    from audio_classifier import classify_acoustic_poc, classify_configured_audio
    from speech_features import extract_speech_features
    from transcript_analysis import analyze_transcript
    from preprocessing.speech_features import extract_speech_intelligence


def _decode_audio_16k_mono(audio_path: Path):
    """Decode audio to 16 kHz mono float32 ndarray using PyAV without metadata_errors kwarg."""
    import av
    import numpy as np

    resampler = av.AudioResampler(format="fltp", layout="mono", rate=16000)
    chunks = []
    with av.open(str(audio_path), mode="r") as container:
        audio_streams = [s for s in container.streams if s.type == "audio"]
        for frame in container.decode(audio_streams[0]):
            for out_frame in resampler.resample(frame):
                arr = out_frame.to_ndarray()
                if arr.size:
                    chunks.append(arr.reshape(-1))
        for out_frame in resampler.resample(None):
            arr = out_frame.to_ndarray()
            if arr.size:
                chunks.append(arr.reshape(-1))
    if not chunks:
        return np.zeros(0, dtype=np.float32)
    return np.concatenate(chunks).astype(np.float32, copy=False)


def transcribe_audio(audio_path: Path) -> dict[str, Any]:
    if not audio_path.exists() or not audio_path.is_file():
        return {
            "status": "error",
            "processing_status": "failed",
            "error": {
                "code": "audio_not_found",
                "message": "The temporary audio file was not available for processing.",
            },
        }

    try:
        audio_inspection = inspect_audio_file(audio_path)
    except AudioValidationError as error:
        return {
            "status": "error",
            "processing_status": "rejected",
            "audio_duration_seconds": error.duration_seconds,
            "error": {
                "code": error.code,
                "message": str(error),
            },
        }

    try:
        from faster_whisper import WhisperModel

        model = WhisperModel(
            "base",
            device="cpu",
            compute_type="int8",
        )

        try:
            segments, info = model.transcribe(
                str(audio_path),
                language=None,
                beam_size=5,
                vad_filter=True,
            )
        except TypeError as err:
            if "metadata_errors" not in str(err):
                raise
            audio_16k = _decode_audio_16k_mono(audio_path)
            segments, info = model.transcribe(
                audio_16k,
                language=None,
                beam_size=5,
                vad_filter=True,
            )

        transcript_segments = []
        text_parts = []

        for segment in segments:
            text = segment.text.strip()
            if text:
                text_parts.append(text)
                seg_entry: dict[str, Any] = {
                    "start": round(segment.start, 2),
                    "end": round(segment.end, 2),
                    "text": text,
                }
                if hasattr(segment, "avg_logprob") and segment.avg_logprob is not None:
                    seg_entry["avg_logprob"] = round(float(segment.avg_logprob), 4)
                if hasattr(segment, "no_speech_prob") and segment.no_speech_prob is not None:
                    seg_entry["no_speech_prob"] = round(float(segment.no_speech_prob), 4)
                transcript_segments.append(seg_entry)

        transcript = " ".join(text_parts).strip()
        warnings = list(audio_inspection.get("quality_warnings") or [])
        if round(info.language_probability, 4) < 0.6:
            warnings.append("low_language_confidence")
        if not transcript:
            warnings.append("empty_transcript")

        result: dict[str, Any] = {
            "status": "success",
            "processing_status": "completed",
            "transcript": transcript,
            "language": info.language,
            "language_probability": round(info.language_probability, 4),
            "duration_seconds": audio_inspection["duration_seconds"],
            "audio_inspection": {
                "status": "decoded",
                "sample_rate_hz": audio_inspection["sample_rate_hz"],
                "decoded_samples": audio_inspection["decoded_samples"],
                "clipping_ratio": audio_inspection.get("clipping_ratio", 0.0),
            },
            "quality_warnings": sorted(set(warnings)),
            "segments": transcript_segments,
            "model": "faster-whisper-base",
            "limitation": (
                "Speech transcription and descriptive features only; "
                "any model output is research-only and not a clinical inference."
            ),
            "provenance": {
                "task": "automatic_speech_transcription",
                "model": "faster-whisper-base",
                "language_detection": "automatic",
                "source_audio_persisted": False,
                "audio_validation": "decoded_before_transcription",
            },
        }
        result["speech_features"] = extract_speech_features(result)
        result["transcript_analysis"] = analyze_transcript(result)
        temp_wav_path: Path | None = None
        try:
            wav_arg: Path | None = audio_path if audio_path.suffix.lower() == ".wav" else None
            if wav_arg is None:
                import os
                import tempfile
                import numpy as np
                from scipy.io import wavfile

                pcm_source = _decode_audio_16k_mono(audio_path)
                if pcm_source.size > 0:
                    fd, tmp_name = tempfile.mkstemp(suffix=".wav")
                    os.close(fd)
                    temp_wav_path = Path(tmp_name)
                    pcm_i16 = np.clip(pcm_source, -1.0, 1.0)
                    wavfile.write(str(temp_wav_path), 16000, (pcm_i16 * 32767.0).astype(np.int16))
                    wav_arg = temp_wav_path

            result["speech_intelligence"] = extract_speech_intelligence(
                wav_path=wav_arg,
                transcript=transcript,
                language=info.language,
            )
        except Exception:
            result["speech_intelligence"] = extract_speech_intelligence(
                transcript=transcript,
                language=info.language,
            )
        finally:
            if temp_wav_path is not None:
                temp_wav_path.unlink(missing_ok=True)
        try:
            result["classifier"] = classify_configured_audio(
                result["speech_features"]
            )
        except Exception:
            result["classifier"] = {
                "status": "unavailable",
                "model_version": None,
                "prediction": None,
                "message": "Audio model inference could not be completed.",
                "missing_inputs": ["audio_model_inference_failed"],
                "limitations": [
                    "Research-only; unavailable output is not a negative result.",
                    "No diagnosis or clinical risk estimate is produced.",
                ],
            }
        try:
            result["acoustic_classifier_poc"] = classify_acoustic_poc(
                result["speech_intelligence"]
            )
        except Exception:
            result["acoustic_classifier_poc"] = {
                "status": "unavailable",
                "model_version": None,
                "prediction": None,
                "message": "Experimental acoustic PoC inference could not be completed.",
                "missing_inputs": ["acoustic_poc_inference_failed"],
                "limitations": [
                    "Experimental speech-based research screening output — not a clinical diagnosis.",
                ],
            }
        return result
    except Exception:
        return {
            "status": "error",
            "processing_status": "failed",
            "error": {
                "code": "transcription_unavailable",
                "message": (
                    "Speech transcription is unavailable. Please retry or "
                    "continue without a transcript."
                ),
            },
        }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--audio", required=True, help="Path to audio file")
    args = parser.parse_args()

    result = transcribe_audio(Path(args.audio).resolve())
    print(json.dumps(result, ensure_ascii=False, allow_nan=False))
    return 0 if result["status"] == "success" else 1


if __name__ == "__main__":
    main()
