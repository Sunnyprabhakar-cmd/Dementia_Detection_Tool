"""Decode and validate audio before running the speech recognizer."""

from pathlib import Path
from typing import Any


class AudioValidationError(ValueError):
    def __init__(self, code: str, message: str, duration_seconds: float | None = None):
        super().__init__(message)
        self.code = code
        self.duration_seconds = duration_seconds


def inspect_audio_file(
    audio_path: Path,
    *,
    minimum_duration_seconds: float = 0.15,
    maximum_duration_seconds: float = 120.0,
    silence_rms_threshold: float = 0.0001,
) -> dict[str, Any]:
    """Decode the full clip, measure duration and reject empty/digital-silent audio."""
    try:
        import av
        import numpy as np
    except ImportError as error:
        raise AudioValidationError(
            "audio_decoder_unavailable",
            "Audio decoding is unavailable. Install the configured audio requirements.",
        ) from error

    try:
        with av.open(str(audio_path), mode="r") as container:
            audio_streams = [stream for stream in container.streams if stream.type == "audio"]
            if not audio_streams:
                raise AudioValidationError(
                    "audio_track_missing",
                    "The uploaded file does not contain an audio track.",
                )

            sample_count = 0
            duration_seconds = 0.0
            square_sum = 0.0
            value_count = 0
            peak = 0.0
            sample_rate = None

            for frame in container.decode(audio_streams[0]):
                rate = frame.sample_rate or audio_streams[0].rate
                if not rate or frame.samples <= 0:
                    continue

                samples = np.asarray(frame.to_ndarray())
                if samples.size == 0 or not np.issubdtype(samples.dtype, np.number):
                    continue
                normalized = samples.astype(np.float64, copy=False)
                if np.issubdtype(samples.dtype, np.integer):
                    limits = np.iinfo(samples.dtype)
                    normalized = normalized / max(abs(limits.min), limits.max)
                if not np.isfinite(normalized).all():
                    raise AudioValidationError(
                        "invalid_audio",
                        "The uploaded audio contains invalid sample values.",
                    )

                square_sum += float(np.square(normalized).sum())
                value_count += int(normalized.size)
                peak = max(peak, float(np.max(np.abs(normalized))))
                sample_count += int(frame.samples)
                duration_seconds += float(frame.samples) / float(rate)
                sample_rate = int(rate)

                if duration_seconds > maximum_duration_seconds:
                    raise AudioValidationError(
                        "audio_too_long",
                        f"Audio must be {maximum_duration_seconds:g} seconds or shorter.",
                        round(duration_seconds, 3),
                    )
    except AudioValidationError:
        raise
    except Exception as error:
        raise AudioValidationError(
            "invalid_audio",
            "The uploaded audio could not be decoded. Check the file and try again.",
        ) from error

    if sample_count <= 0 or duration_seconds <= 0 or value_count <= 0:
        raise AudioValidationError(
            "empty_audio",
            "The uploaded file contains no decodable audio samples.",
        )
    if duration_seconds < minimum_duration_seconds:
        raise AudioValidationError(
            "audio_too_short",
            f"Audio must be at least {minimum_duration_seconds:g} seconds long.",
            round(duration_seconds, 3),
        )

    rms = (square_sum / value_count) ** 0.5
    if rms < silence_rms_threshold or peak < silence_rms_threshold:
        raise AudioValidationError(
            "silent_audio",
            "No audible speech was detected in the recording. Please record again.",
            round(duration_seconds, 3),
        )

    return {
        "duration_seconds": round(duration_seconds, 3),
        "sample_rate_hz": sample_rate,
        "decoded_samples": sample_count,
        "rms_amplitude": round(rms, 7),
    }
