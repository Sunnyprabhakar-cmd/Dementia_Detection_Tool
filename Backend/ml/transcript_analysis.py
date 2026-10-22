"""Literal, rule-based observations from an automatic speech transcript."""

import re
from collections import Counter
from collections.abc import Iterable
from typing import Any


ANALYZER_VERSION = "transcript-observations/1.0.0"
DEFAULT_ENGLISH_FILLERS = ("uh", "um", "erm", "er", "ah", "hmm")
_WORD_PATTERN = re.compile(r"[^\W_]+(?:['’][^\W_]+)?", re.UNICODE)
_SENTENCE_BOUNDARY_PATTERN = re.compile(r"[.!?。！？]+")
_SELF_CORRECTION_MARKERS = (
    "i mean",
    "or rather",
    "sorry",
    "no wait",
    "let me rephrase",
)
_VAGUE_EXPRESSIONS = (
    "thing",
    "things",
    "stuff",
    "something",
    "somewhere",
    "some kind of",
    "some sort of",
    "whatever",
)


def _phrase_counts(words: list[str], phrases: Iterable[str]) -> dict[str, int]:
    counts: dict[str, int] = {}
    for phrase in phrases:
        phrase_words = [word.casefold() for word in _WORD_PATTERN.findall(phrase)]
        if not phrase_words:
            continue
        width = len(phrase_words)
        counts[phrase] = sum(
            words[index:index + width] == phrase_words
            for index in range(len(words) - width + 1)
        )
    return counts


def _repeated_short_phrase_count(words: list[str], maximum_words: int = 4) -> int:
    count = 0
    index = 0
    while index < len(words):
        max_width = min(maximum_words, (len(words) - index) // 2)
        repeated_width = next(
            (
                width
                for width in range(max_width, 1, -1)
                if words[index:index + width]
                == words[index + width:index + 2 * width]
            ),
            0,
        )
        if repeated_width:
            count += 1
            index += repeated_width * 2
        else:
            index += 1
    return count


def analyze_transcript(
    transcription: dict[str, Any],
    *,
    filler_words: Iterable[str] = DEFAULT_ENGLISH_FILLERS,
    minimum_words: int = 5,
) -> dict[str, Any]:
    """Count surface patterns without scoring impairment or semantic content."""
    if not isinstance(transcription, dict) or transcription.get("status") != "success":
        return {
            "status": "transcription_error",
            "analyzer_version": ANALYZER_VERSION,
            "observations": {},
            "unavailable_observations": ["transcript_analysis"],
            "message": "Transcript observations are unavailable because transcription did not succeed.",
        }

    transcript = transcription.get("transcript")
    if not isinstance(transcript, str):
        transcript = ""
    tokens = [word.casefold() for word in _WORD_PATTERN.findall(transcript)]
    sentences = [
        segment
        for segment in _SENTENCE_BOUNDARY_PATTERN.split(transcript)
        if _WORD_PATTERN.search(segment)
    ]
    if tokens and not sentences:
        sentences = [transcript]

    language = transcription.get("language")
    english_rules_available = language == "en"
    filler_tokens = {
        token.casefold()
        for phrase in filler_words
        for token in _WORD_PATTERN.findall(phrase)
    }
    unavailable: list[str] = []
    if not english_rules_available:
        unavailable.extend(
            [
                "english_filler_counts",
                "english_self_correction_markers",
                "english_vague_expressions",
            ]
        )

    observations: dict[str, Any] = {
        "word_count": len(tokens),
        "sentence_count": len(sentences),
        "average_words_per_sentence": (
            round(len(tokens) / len(sentences), 2) if sentences else None
        ),
        "filler_word_counts": (
            dict(sorted(Counter(word for word in tokens if word in filler_tokens).items()))
            if english_rules_available
            else None
        ),
        "repeated_adjacent_word_count": sum(
            tokens[index] == tokens[index - 1]
            for index in range(1, len(tokens))
        ),
        "repeated_short_phrase_count": _repeated_short_phrase_count(tokens),
        "unique_word_ratio": (
            round(len(set(tokens)) / len(tokens), 4) if tokens else None
        ),
        "self_correction_marker_counts": (
            _phrase_counts(tokens, _SELF_CORRECTION_MARKERS)
            if english_rules_available
            else None
        ),
        "selected_vague_expression_counts": (
            _phrase_counts(tokens, _VAGUE_EXPRESSIONS)
            if english_rules_available
            else None
        ),
    }

    if not tokens:
        status = "empty"
    elif len(tokens) < minimum_words:
        status = "very_short"
    else:
        status = "complete"

    return {
        "status": status,
        "analyzer_version": ANALYZER_VERSION,
        "language": language if isinstance(language, str) else "unknown",
        "observations": observations,
        "unavailable_observations": unavailable,
        "context": {
            "task": "picture_description",
            "observation": (
                "The prompt is known, but no reference-based semantic comparison "
                "or picture-detail scoring is performed."
            ),
        },
        "limitations": [
            "Experimental speech observations — research prototype, not a diagnosis.",
            "Counts describe literal transcript patterns and do not imply impairment; repetitions, fillers, short sentences, and vague expressions can be ordinary speech.",
            "English-specific rules may be unreliable for other languages, accents, dialects, education backgrounds, fluency, background noise, and other conditions.",
            "Automatic transcription can omit or alter words; review the transcript for errors.",
            "No semantic relevance, missing picture detail, acoustic pause, or speech-rate claim is derived by this transcript-only analyzer.",
        ],
    }
