"""Deterministic descriptive features derived from a transcription response."""

import math
import re
from typing import Any


FEATURE_EXTRACTOR_VERSION = "speech-transcript-features/1.2.0"
_WORD_PATTERN = re.compile(r"[^\W_]+(?:['’][^\W_]+)?", re.UNICODE)
_SENTENCE_BOUNDARY_PATTERN = re.compile(r"[.!?。！？]+")
_ENGLISH_FILLER_WORDS = {"uh", "um", "erm", "er", "ah"}


def extract_speech_features(transcription: dict[str, Any]) -> dict[str, Any]:
    """Extract timing and transcript counts without inferring missing values."""
    if not isinstance(transcription, dict) or transcription.get("status") != "success":
        return {
            "status": "unavailable",
            "feature_extractor_version": FEATURE_EXTRACTOR_VERSION,
            "missing_inputs": ["successful_transcription"],
            "features": {},
        }

    transcript = transcription.get("transcript")
    if not isinstance(transcript, str):
        transcript = ""
    words = _WORD_PATTERN.findall(transcript)
    normalized_words = [word.casefold() for word in words]
    sentence_word_counts = [
        len(_WORD_PATTERN.findall(sentence))
        for sentence in _SENTENCE_BOUNDARY_PATTERN.split(transcript)
    ]
    sentence_word_counts = [count for count in sentence_word_counts if count]
    language = transcription.get("language")
    duration = transcription.get("duration_seconds")
    if isinstance(duration, bool) or not isinstance(duration, (int, float)):
        duration = None
    elif not math.isfinite(duration) or duration <= 0:
        duration = None
    else:
        duration = float(duration)

    segments = transcription.get("segments")
    if not isinstance(segments, list):
        segments = []

    intervals: list[tuple[float, float]] = []
    invalid_segment = False
    for segment in segments:
        if not isinstance(segment, dict):
            invalid_segment = True
            continue
        start = segment.get("start")
        end = segment.get("end")
        if (
            isinstance(start, bool)
            or isinstance(end, bool)
            or not isinstance(start, (int, float))
            or not isinstance(end, (int, float))
            or not math.isfinite(start)
            or not math.isfinite(end)
            or start < 0
            or end <= start
            or (duration is not None and end > duration + 0.05)
        ):
            invalid_segment = True
            continue
        intervals.append((float(start), float(end)))

    ordered = all(
        intervals[index][0] >= intervals[index - 1][0]
        and intervals[index][0] >= intervals[index - 1][1]
        for index in range(1, len(intervals))
    )
    if not ordered:
        invalid_segment = True
        intervals = []

    speaking_duration = (
        sum(end - start for start, end in intervals) if intervals else None
    )
    pause_gaps = [
        round(intervals[index][0] - intervals[index - 1][1], 3)
        for index in range(1, len(intervals))
    ]
    pause_gaps = [gap for gap in pause_gaps if gap > 0]
    repeated_word_count = sum(
        normalized_words[index] == normalized_words[index - 1]
        for index in range(1, len(normalized_words))
    )

    missing_inputs: list[str] = []
    if duration is None:
        missing_inputs.append("valid_audio_duration")
    if not intervals:
        missing_inputs.append("valid_timed_speech_segments")
    if not words:
        missing_inputs.append("non_empty_transcript")
    if invalid_segment:
        missing_inputs.append("some_segment_timestamps_invalid")
    if language != "en":
        missing_inputs.append("english_language_required_for_filler_count")

    speech_rate = None
    if speaking_duration is not None and speaking_duration >= 2 and words:
        speech_rate = round(len(words) / speaking_duration * 60, 2)
    elif speaking_duration is not None and speaking_duration < 2:
        missing_inputs.append("at_least_2_seconds_of_speech_for_rate")

    filler_word_count = (
        sum(word.casefold() in _ENGLISH_FILLER_WORDS for word in words)
        if language == "en"
        else None
    )
    filler_word_ratio_percent = (
        round(filler_word_count / len(words) * 100, 2)
        if filler_word_count is not None and words
        else None
    )
    estimated_non_speech_ratio = None
    if duration is not None and speaking_duration is not None:
        estimated_non_speech_ratio = round(
            max(0.0, min(1.0, (duration - speaking_duration) / duration)),
            4,
        )

    features = {
        "audio_duration_seconds": duration,
        "speaking_duration_seconds": (
            round(speaking_duration, 3) if speaking_duration is not None else None
        ),
        "transcript_word_count": len(words),
        "transcript_character_count": len(transcript.strip()),
        "speech_rate_words_per_minute": speech_rate,
        "pause_count": len(pause_gaps) if intervals else None,
        "mean_pause_seconds": (
            round(sum(pause_gaps) / len(pause_gaps), 3) if pause_gaps else None
        ),
        "maximum_pause_seconds": max(pause_gaps) if pause_gaps else None,
        "estimated_non_speech_ratio": estimated_non_speech_ratio,
        "filler_word_count": filler_word_count,
        "filler_word_ratio_percent": filler_word_ratio_percent,
        "adjacent_repeated_word_count": repeated_word_count,
        "lexical_diversity": (
            round(len(set(normalized_words)) / len(normalized_words), 4)
            if normalized_words
            else None
        ),
        "sentence_count": len(sentence_word_counts) if words else None,
        "mean_sentence_length_words": (
            round(sum(sentence_word_counts) / len(sentence_word_counts), 2)
            if sentence_word_counts
            else None
        ),
        "pitch_mean_hz": None,
        "pitch_std_hz": None,
    }

    if not words and not intervals:
        status = "empty"
    elif missing_inputs:
        status = "partial"
    else:
        status = "complete"

    return {
        "status": status,
        "feature_extractor_version": FEATURE_EXTRACTOR_VERSION,
        "transcription_model": transcription.get("model"),
        "transcription_language": transcription.get("language"),
        "missing_inputs": sorted(set(missing_inputs)),
        "features": features,
        "unavailable_features": ["pitch_mean_hz", "pitch_std_hz"],
        "limitations": [
            "Descriptive measurements only; not validated speech biomarkers or clinical findings.",
            "Word counts use a general Unicode tokenizer and are not language-validated.",
            "Filler count includes only explicit English disfluencies; fillers in other languages are not estimated.",
            "Estimated non-speech ratio is based on transcription segment timing, not waveform energy; it may include pauses, noise, or omitted speech.",
            "Pitch statistics are unavailable because no acoustic pitch extractor is installed.",
            "Speech rate is omitted unless valid timed speech spans at least two seconds.",
        ],
    }
