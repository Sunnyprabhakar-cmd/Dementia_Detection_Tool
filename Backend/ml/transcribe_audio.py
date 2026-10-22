
import argparse
import json
from pathlib import Path
from typing import Any

if __package__:
    from .audio_validation import AudioValidationError, inspect_audio_file
    from .audio_classifier import classify_configured_audio
    from .speech_features import extract_speech_features
    from .transcript_analysis import analyze_transcript
else:
    from audio_validation import AudioValidationError, inspect_audio_file
    from audio_classifier import classify_configured_audio
    from speech_features import extract_speech_features
    from transcript_analysis import analyze_transcript


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

        segments, info = model.transcribe(
            str(audio_path),
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
                transcript_segments.append({
                    "start": round(segment.start, 2),
                    "end": round(segment.end, 2),
                    "text": text,
                })

        transcript = " ".join(text_parts).strip()
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
            },
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
