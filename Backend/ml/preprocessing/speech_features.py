"""Stage 5 speech intelligence: acoustic, timing, and language-aware linguistic features."""

from __future__ import annotations

import re
from collections import Counter
from pathlib import Path
from typing import Any

import numpy as np

from .audio_preprocessing import extract_acoustic_features, validate_wav_audio


SPEECH_PIPELINE_VERSION = "speech-intelligence/2.0.0"
# Include Devanagari (U+0900..U+097F) and Gurmukhi (U+0A00..U+0A7F) combining marks inside words.
_WORD_PATTERN = re.compile(r"(?:[^\W_]|[\u0900-\u097F\u0A00-\u0A7F])+(?:['’](?:[^\W_]|[\u0900-\u097F\u0A00-\u0A7F])+)?", re.UNICODE)
_SENTENCE_PATTERN = re.compile(r"[.!?।॥。！？]+")

# Language-specific disfluency / filler token sets kept strictly separate per language.
LANGUAGE_FILLERS: dict[str, set[str]] = {
    "en": {"uh", "um", "erm", "er", "ah", "hmm"},
    "hi": {"उम्म", "अम्म", "आ", "मतलब", "वो", "हम्म"},
    "pa": {"ਉਮ", "ਅਮ", "ਹਮ", "ਮਤਲਬ", "ਉਹ"},
}
SUPPORTED_LANGUAGES = {"en", "hi", "pa"}

LANGUAGE_CAPABILITY_REGISTRY: dict[str, dict[str, Any]] = {
    "en": {
        "language_code": "en",
        "label": "English",
        "transcription_supported": True,
        "acoustic_extraction_supported": True,
        "linguistic_rules_supported": True,
        "dementia_inference_supported": False,
        "requires_validation": True,
        "notes": "Whisper transcription + English filler/repetition/utterance rules available; dementia inference requires authorized ADReSSo/Pitt data.",
    },
    "hi": {
        "language_code": "hi",
        "label": "Hindi",
        "transcription_supported": True,
        "acoustic_extraction_supported": True,
        "linguistic_rules_supported": True,
        "dementia_inference_supported": False,
        "requires_validation": True,
        "notes": "Whisper transcription + Devanagari filler tokenization available; no Hindi dementia speech model is trained.",
    },
    "pa": {
        "language_code": "pa",
        "label": "Punjabi",
        "transcription_supported": True,
        "acoustic_extraction_supported": True,
        "linguistic_rules_supported": True,
        "dementia_inference_supported": False,
        "requires_validation": True,
        "notes": "Whisper transcription + Gurmukhi filler tokenization available; no Punjabi dementia speech model is trained.",
    },
    "si": {
        "language_code": "si",
        "label": "Sinhala",
        "transcription_supported": False,
        "acoustic_extraction_supported": True,
        "linguistic_rules_supported": False,
        "dementia_inference_supported": False,
        "requires_validation": True,
        "notes": "Acoustic extraction only; Sinhala linguistic rules and dementia inference are unavailable.",
    },
    "ta": {
        "language_code": "ta",
        "label": "Tamil",
        "transcription_supported": False,
        "acoustic_extraction_supported": True,
        "linguistic_rules_supported": False,
        "dementia_inference_supported": False,
        "requires_validation": True,
        "notes": "Acoustic extraction only; Tamil linguistic rules and dementia inference are unavailable.",
    },
}


def get_language_capabilities(language: str | None) -> dict[str, Any]:
    lang = (language or "unknown").strip().lower()
    if lang in LANGUAGE_CAPABILITY_REGISTRY:
        return LANGUAGE_CAPABILITY_REGISTRY[lang]
    return {
        "language_code": lang,
        "label": lang,
        "transcription_supported": False,
        "acoustic_extraction_supported": True,
        "linguistic_rules_supported": False,
        "dementia_inference_supported": False,
        "requires_validation": True,
        "notes": f"Language '{lang}' is unsupported for linguistic rules and dementia inference.",
    }


def analyze_multilingual_transcript(
    transcript: str | None,
    language: str | None,
) -> dict[str, Any]:
    """Extract language-aware fluency metrics without cross-language rule leakage."""
    lang = (language or "unknown").strip().lower()
    raw_text = transcript.strip() if isinstance(transcript, str) else ""

    if not raw_text:
        return {
            "status": "empty",
            "language": lang,
            "language_supported": lang in SUPPORTED_LANGUAGES,
            "original_transcript_preserved": False,
            "unavailable_reason": "Transcript is empty; linguistic metrics were not calculated.",
            "features": {
                "total_spoken_words": None,
                "utterance_count": None,
                "average_utterance_length_words": None,
                "adjacent_repetition_count": None,
                "filled_pause_count": None,
                "lexical_diversity": None,
            },
        }

    words = _WORD_PATTERN.findall(raw_text)
    normalized = [w.casefold() for w in words]
    utterances = [
        seg.strip()
        for seg in _SENTENCE_PATTERN.split(raw_text)
        if _WORD_PATTERN.search(seg)
    ]
    if words and not utterances:
        utterances = [raw_text]

    repetitions = sum(
        normalized[i] == normalized[i - 1] for i in range(1, len(normalized))
    )
    lexical_diversity = (
        round(len(set(normalized)) / len(normalized), 4) if normalized else None
    )

    if lang in LANGUAGE_FILLERS:
        filler_set = LANGUAGE_FILLERS[lang]
        filler_counts = dict(sorted(Counter(w for w in normalized if w in filler_set).items()))
        filled_pause_count = sum(filler_counts.values())
        filler_status = "available"
    else:
        filler_counts = None
        filled_pause_count = None
        filler_status = f"unavailable_for_language:{lang}"

    return {
        "status": "complete" if len(words) >= 3 else "very_short",
        "language": lang,
        "language_supported": lang in SUPPORTED_LANGUAGES,
        "filler_analysis_status": filler_status,
        "original_transcript_preserved": True,
        "features": {
            "total_spoken_words": len(words),
            "utterance_count": len(utterances),
            "average_utterance_length_words": round(len(words) / len(utterances), 2)
            if utterances
            else None,
            "adjacent_repetition_count": repetitions,
            "filled_pause_count": filled_pause_count,
            "filler_token_counts": filler_counts,
            "lexical_diversity": lexical_diversity,
        },
    }


def extract_speech_intelligence(
    *,
    samples: np.ndarray | None = None,
    sample_rate: int | None = None,
    wav_path: Path | None = None,
    transcript: str | None = None,
    language: str | None = None,
    stimulus_offset_seconds: float | None = None,
) -> dict[str, Any]:
    """Extract combined acoustic, timing, and language-aware linguistic speech features."""
    quality_warnings: list[str] = []

    if wav_path is not None:
        decoded = validate_wav_audio(wav_path)
        samples = decoded["samples"]
        sample_rate = decoded["sample_rate"]
        quality_warnings.extend(decoded.get("quality_warnings", []))

    acoustic: dict[str, Any] = {}
    if samples is not None and sample_rate is not None:
        acoustic = extract_acoustic_features(samples, sample_rate)
        if acoustic.get("estimated_snr_db") is not None and acoustic["estimated_snr_db"] < 10.0:
            quality_warnings.append("high_background_noise")
        if stimulus_offset_seconds is not None and stimulus_offset_seconds >= 0:
            acoustic["response_latency_seconds"] = round(
                max(0.0, float(acoustic["response_latency_seconds"]) - float(stimulus_offset_seconds)),
                4,
            )

    linguistic = analyze_multilingual_transcript(transcript, language)
    word_count = linguistic["features"].get("total_spoken_words")
    total_dur = acoustic.get("audio_duration_seconds")
    voiced_dur = acoustic.get("voiced_duration_seconds")

    speaking_rate_wpm = (
        round((word_count / total_dur) * 60.0, 2)
        if word_count and total_dur and total_dur >= 0.5
        else None
    )
    articulation_rate_wpm = (
        round((word_count / voiced_dur) * 60.0, 2)
        if word_count and voiced_dur and voiced_dur >= 0.5
        else None
    )

    return {
        "pipeline_version": SPEECH_PIPELINE_VERSION,
        "language_capabilities": get_language_capabilities(language),
        "quality_reliable": len(quality_warnings) == 0,
        "quality_warnings": sorted(set(quality_warnings)),
        "acoustic_features": acoustic,
        "linguistic_analysis": linguistic,
        "timing_summary": {
            "total_duration_seconds": total_dur,
            "voiced_duration_seconds": voiced_dur,
            "silence_duration_seconds": acoustic.get("silence_duration_seconds"),
            "pause_count": acoustic.get("waveform_pause_count"),
            "long_pause_count": acoustic.get("waveform_long_pause_count"),
            "mean_pause_seconds": acoustic.get("waveform_mean_pause_seconds"),
            "speaking_rate_wpm": speaking_rate_wpm,
            "articulation_rate_wpm": articulation_rate_wpm,
            "response_latency_seconds": acoustic.get("response_latency_seconds"),
        },
    }
