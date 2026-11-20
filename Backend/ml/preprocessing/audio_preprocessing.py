"""Acoustic audio validation and signal-level feature extraction (MFCC, pitch, pauses)."""

from __future__ import annotations

import math
import wave
from pathlib import Path
from typing import Any

import numpy as np
from scipy.fftpack import dct


def validate_wav_audio(audio_path: Path, min_duration_sec: float = 0.25) -> dict[str, Any]:
    """Validate a WAV audio file and return decoded mono float32 samples + metadata."""
    if not audio_path.is_file():
        raise FileNotFoundError(f"Audio file not found: {audio_path}")

    with wave.open(str(audio_path), "rb") as wf:
        channels = wf.getnchannels()
        sample_width = wf.getsampwidth()
        sample_rate = wf.getframerate()
        n_frames = wf.getnframes()
        raw = wf.readframes(n_frames)

    if sample_rate <= 0 or n_frames <= 0:
        raise ValueError("Audio file has zero frames or invalid sample rate.")

    duration = n_frames / float(sample_rate)
    if duration < min_duration_sec:
        raise ValueError(f"Audio duration ({duration:.2f}s) is below minimum ({min_duration_sec}s).")

    if sample_width == 1:
        samples = (np.frombuffer(raw, dtype=np.uint8).astype(np.float32) - 128.0) / 128.0
    elif sample_width == 2:
        samples = np.frombuffer(raw, dtype=np.int16).astype(np.float32) / 32768.0
    elif sample_width == 4:
        samples = np.frombuffer(raw, dtype=np.int32).astype(np.float32) / 2147483648.0
    else:
        raise ValueError(f"Unsupported WAV sample width: {sample_width} bytes.")

    if channels > 1:
        samples = samples.reshape(-1, channels).mean(axis=1)

    rms = float(np.sqrt(np.mean(np.square(samples)))) if len(samples) else 0.0
    if rms < 1e-5:
        raise ValueError("Audio signal appears silent (RMS below threshold).")

    clipping_ratio = float(np.mean(np.abs(samples) >= 0.99))
    quality_warnings: list[str] = []
    if clipping_ratio > 0.01:
        quality_warnings.append("clipping_detected")
    if rms < 0.01:
        quality_warnings.append("low_volume")

    return {
        "sample_rate": int(sample_rate),
        "channels": int(channels),
        "duration_seconds": round(duration, 4),
        "rms": round(rms, 6),
        "clipping_ratio": round(clipping_ratio, 6),
        "quality_warnings": quality_warnings,
        "samples": samples,
    }


def _hz_to_mel(hz: np.ndarray | float) -> np.ndarray | float:
    return 2595.0 * np.log10(1.0 + np.asarray(hz) / 700.0)


def _mel_to_hz(mel: np.ndarray | float) -> np.ndarray | float:
    return 700.0 * (10.0 ** (np.asarray(mel) / 2595.0) - 1.0)


def _mel_filterbank(sample_rate: int, n_fft: int, n_mels: int = 26) -> np.ndarray:
    low_mel = _hz_to_mel(0.0)
    high_mel = _hz_to_mel(sample_rate / 2.0)
    mel_points = np.linspace(low_mel, high_mel, n_mels + 2)
    hz_points = _mel_to_hz(mel_points)
    bins = np.floor((n_fft + 1) * hz_points / sample_rate).astype(int)

    fbank = np.zeros((n_mels, n_fft // 2 + 1), dtype=np.float64)
    for m in range(1, n_mels + 1):
        f_left, f_center, f_right = bins[m - 1], bins[m], bins[m + 1]
        if f_center > f_left:
            for k in range(f_left, f_center):
                fbank[m - 1, k] = (k - f_left) / (f_center - f_left)
        if f_right > f_center:
            for k in range(f_center, f_right):
                fbank[m - 1, k] = (f_right - k) / (f_right - f_center)
    return fbank


def _estimate_frame_f0_and_hnr(
    frame: np.ndarray,
    sample_rate: int,
    fmin: float = 65.0,
    fmax: float = 400.0,
) -> tuple[float | None, float | None]:
    """Autocorrelation-based F0 and Harmonic-to-Noise Ratio (dB) estimator."""
    energy = float(np.mean(frame ** 2))
    if energy < 1e-6:
        return None, None
    centered = frame - np.mean(frame)
    corr = np.correlate(centered, centered, mode="full")[len(centered) - 1:]
    if corr[0] <= 0:
        return None, None
    corr = corr / corr[0]
    min_lag = max(1, int(sample_rate / fmax))
    max_lag = min(len(corr) - 1, int(sample_rate / fmin))
    if max_lag <= min_lag:
        return None, None
    segment = corr[min_lag:max_lag + 1]
    peak_idx = int(np.argmax(segment))
    peak_val = float(segment[peak_idx])
    if peak_val < 0.3:
        return None, None
    f0 = float(sample_rate / (min_lag + peak_idx))
    clamped_r = min(0.999, max(0.001, peak_val))
    hnr_db = 10.0 * math.log10(clamped_r / (1.0 - clamped_r))
    return f0, hnr_db


def extract_acoustic_features(
    samples: np.ndarray,
    sample_rate: int,
    *,
    n_mfcc: int = 13,
    frame_ms: float = 25.0,
    hop_ms: float = 10.0,
) -> dict[str, Any]:
    """Extract MFCCs, pitch (F0), energy, ZCR, and waveform pause/latency features."""
    x = np.asarray(samples, dtype=np.float64)
    if len(x) == 0 or sample_rate <= 0:
        raise ValueError("Empty audio samples or invalid sample rate.")

    frame_len = max(64, int(round(sample_rate * frame_ms / 1000.0)))
    hop_len = max(32, int(round(sample_rate * hop_ms / 1000.0)))
    if len(x) < frame_len:
        x = np.pad(x, (0, frame_len - len(x)))

    n_frames = 1 + (len(x) - frame_len) // hop_len
    window = np.hamming(frame_len)
    n_fft = 1 << (frame_len - 1).bit_length()
    fbank = _mel_filterbank(sample_rate, n_fft, n_mels=26)

    mfccs = np.zeros((n_frames, n_mfcc), dtype=np.float64)
    rms_frames = np.zeros(n_frames, dtype=np.float64)
    zcr_frames = np.zeros(n_frames, dtype=np.float64)
    spectral_centroids: list[float] = []
    spectral_bandwidths: list[float] = []
    spectral_rolloffs: list[float] = []
    f0_values: list[float] = []
    hnr_values: list[float] = []
    voiced_rms_values: list[float] = []
    freqs = np.fft.rfftfreq(n_fft, d=1.0 / float(sample_rate))

    for i in range(n_frames):
        start = i * hop_len
        frame = x[start:start + frame_len]
        rms_frames[i] = math.sqrt(float(np.mean(frame ** 2)))
        zcr_frames[i] = float(np.mean(np.abs(np.diff(np.signbit(frame).astype(int)))))

        win_frame = frame * window
        mag = np.abs(np.fft.rfft(win_frame, n=n_fft))
        mag_sum = float(np.sum(mag))
        if mag_sum > 1e-12:
            centroid = float(np.sum(freqs * mag) / mag_sum)
            bandwidth = math.sqrt(float(np.sum(((freqs - centroid) ** 2) * mag) / mag_sum))
            cum_energy = np.cumsum(mag)
            rolloff_idx = int(np.searchsorted(cum_energy, 0.85 * cum_energy[-1]))
            rolloff = float(freqs[min(rolloff_idx, len(freqs) - 1)])
            spectral_centroids.append(centroid)
            spectral_bandwidths.append(bandwidth)
            spectral_rolloffs.append(rolloff)

        power = (1.0 / n_fft) * (mag ** 2)
        mel_energies = np.dot(power, fbank.T)
        mel_energies = np.where(mel_energies <= 1e-12, 1e-12, mel_energies)
        log_mel = np.log(mel_energies)
        mfccs[i] = dct(log_mel, type=2, norm="ortho")[:n_mfcc]

        f0, hnr_db = _estimate_frame_f0_and_hnr(win_frame, sample_rate)
        if f0 is not None:
            f0_values.append(f0)
            voiced_rms_values.append(rms_frames[i])
            if hnr_db is not None:
                hnr_values.append(hnr_db)

    # Dynamic silence threshold relative to peak RMS
    peak_rms = float(np.max(rms_frames)) if len(rms_frames) else 0.0
    silence_thresh = max(1e-4, 0.1 * peak_rms)
    is_silent = rms_frames < silence_thresh
    frame_sec = hop_len / float(sample_rate)

    # Response latency: leading silence before first active speech frame
    active_indices = np.where(~is_silent)[0]
    response_latency_sec = float(active_indices[0] * frame_sec) if len(active_indices) else float(len(x) / sample_rate)

    # Pause segments (>= 150ms of consecutive silence inside speech)
    min_pause_frames = max(1, int(round(0.15 / frame_sec)))
    pause_durations: list[float] = []
    run = 0
    started = False
    for silent in is_silent:
        if not silent:
            if started and run >= min_pause_frames:
                pause_durations.append(run * frame_sec)
            run = 0
            started = True
        elif started:
            run += 1

    long_pauses = [p for p in pause_durations if p >= 0.5]
    voiced_duration = float(np.sum(~is_silent) * frame_sec)
    silence_duration = max(0.0, (len(x) / float(sample_rate)) - voiced_duration)
    noise_floor_rms = float(np.percentile(rms_frames, 10)) if len(rms_frames) else 0.0
    snr_db = (
        round(20.0 * math.log10(max(1e-9, float(np.mean(rms_frames))) / max(1e-9, noise_floor_rms)), 2)
        if noise_floor_rms > 0
        else None
    )

    # Local jitter (relative period perturbation) and shimmer (relative amplitude perturbation)
    jitter_local = None
    if len(f0_values) >= 3:
        periods = 1.0 / np.asarray(f0_values, dtype=np.float64)
        mean_period = float(np.mean(periods))
        if mean_period > 0:
            jitter_local = round(float(np.mean(np.abs(np.diff(periods))) / mean_period), 5)

    shimmer_local = None
    if len(voiced_rms_values) >= 3:
        amps = np.asarray(voiced_rms_values, dtype=np.float64)
        mean_amp = float(np.mean(amps))
        if mean_amp > 0:
            shimmer_local = round(float(np.mean(np.abs(np.diff(amps))) / mean_amp), 5)

    voiced_ratio = len(f0_values) / float(n_frames)
    features: dict[str, Any] = {
        "audio_duration_seconds": round(len(x) / float(sample_rate), 4),
        "voiced_duration_seconds": round(voiced_duration, 4),
        "silence_duration_seconds": round(silence_duration, 4),
        "response_latency_seconds": round(response_latency_sec, 4),
        "waveform_silence_ratio": round(float(np.mean(is_silent)), 4),
        "waveform_pause_count": len(pause_durations),
        "waveform_long_pause_count": len(long_pauses),
        "waveform_mean_pause_seconds": round(float(np.mean(pause_durations)), 4) if pause_durations else 0.0,
        "energy_rms_mean": round(float(np.mean(rms_frames)), 6),
        "energy_rms_std": round(float(np.std(rms_frames)), 6),
        "background_noise_rms": round(noise_floor_rms, 6),
        "estimated_snr_db": snr_db,
        "zcr_mean": round(float(np.mean(zcr_frames)), 6),
        "spectral_centroid_hz": round(float(np.mean(spectral_centroids)), 2) if spectral_centroids else None,
        "spectral_bandwidth_hz": round(float(np.mean(spectral_bandwidths)), 2) if spectral_bandwidths else None,
        "spectral_rolloff_hz": round(float(np.mean(spectral_rolloffs)), 2) if spectral_rolloffs else None,
        "pitch_mean_hz": round(float(np.mean(f0_values)), 2) if f0_values else None,
        "pitch_median_hz": round(float(np.median(f0_values)), 2) if f0_values else None,
        "pitch_std_hz": round(float(np.std(f0_values)), 2) if f0_values else None,
        "pitch_min_hz": round(float(np.min(f0_values)), 2) if f0_values else None,
        "pitch_max_hz": round(float(np.max(f0_values)), 2) if f0_values else None,
        "pitch_range_hz": round(float(np.max(f0_values) - np.min(f0_values)), 2) if f0_values else None,
        "jitter_local": jitter_local,
        "shimmer_local": shimmer_local,
        "hnr_mean_db": round(float(np.mean(hnr_values)), 2) if hnr_values else None,
        "voiced_frame_ratio": round(voiced_ratio, 4),
        "voiced_unvoiced_ratio": round(voiced_ratio / max(1e-4, 1.0 - voiced_ratio), 4),
    }

    for idx in range(n_mfcc):
        features[f"mfcc_{idx + 1}_mean"] = round(float(np.mean(mfccs[:, idx])), 4)
        features[f"mfcc_{idx + 1}_std"] = round(float(np.std(mfccs[:, idx])), 4)

    return features


def extract_acoustic_features_from_wav(audio_path: Path) -> dict[str, Any]:
    """Validate a WAV file and extract acoustic features."""
    decoded = validate_wav_audio(audio_path)
    features = extract_acoustic_features(decoded["samples"], decoded["sample_rate"])
    return {
        "status": "complete",
        "sample_rate": decoded["sample_rate"],
        "channels": decoded["channels"],
        "features": features,
    }
