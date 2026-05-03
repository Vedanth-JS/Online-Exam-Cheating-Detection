"""
Audio voice activity detection using webrtcvad.
Accepts base64-encoded 16-bit PCM audio, returns speech detection results.
"""
import base64
import logging
import math
import struct

logger = logging.getLogger(__name__)

_vad = None


def _load_vad(aggressiveness: int = 2):
    """Load webrtcvad VAD with aggressiveness 0-3 (3 = most aggressive)."""
    global _vad
    if _vad is None:
        try:
            import webrtcvad
            _vad = webrtcvad.Vad(aggressiveness)
            logger.info("webrtcvad loaded successfully")
        except Exception as e:
            logger.error(f"Failed to load webrtcvad: {e}")
            _vad = None
    return _vad


def _decode_audio(audio_b64: str) -> bytes:
    """Decode base64 PCM audio bytes."""
    return base64.b64decode(audio_b64)


def _compute_energy(pcm_bytes: bytes) -> float:
    """Compute RMS energy of 16-bit PCM samples, normalised to [0.0, 1.0]."""
    if len(pcm_bytes) < 2:
        return 0.0
    num_samples = len(pcm_bytes) // 2
    samples = struct.unpack(f"<{num_samples}h", pcm_bytes[:num_samples * 2])
    rms = math.sqrt(sum(s * s for s in samples) / num_samples)
    return round(min(rms / 32768.0, 1.0), 4)


def analyze_audio(audio_b64: str, sample_rate: int = 16000) -> dict:
    """
    Analyze base64-encoded 16-bit mono PCM audio for voice activity.

    webrtcvad requires frames of exactly 10ms, 20ms, or 30ms.
    We use 30ms frames at 16kHz → 960 samples → 1920 bytes.

    Returns:
        {"speech_detected": bool, "energy_level": float, "duration_ms": int}
    """
    default = {"speech_detected": False, "energy_level": 0.0, "duration_ms": 0}

    if not audio_b64:
        return default

    try:
        pcm_bytes = _decode_audio(audio_b64)
    except Exception as e:
        logger.warning(f"Audio decode error: {e}")
        return default

    if len(pcm_bytes) < 4:
        return default

    energy = _compute_energy(pcm_bytes)
    duration_ms = int(len(pcm_bytes) / 2 / sample_rate * 1000)

    vad = _load_vad()
    if vad is None:
        # Fallback: energy threshold heuristic
        speech_detected = energy > 0.01
        return {"speech_detected": speech_detected, "energy_level": energy, "duration_ms": duration_ms}

    try:
        frame_duration_ms = 30
        frame_bytes = int(sample_rate * frame_duration_ms / 1000) * 2  # 16-bit = 2 bytes/sample

        if sample_rate not in (8000, 16000, 32000, 48000):
            logger.warning(f"Unsupported sample rate {sample_rate}, falling back to energy detection")
            return {"speech_detected": energy > 0.01, "energy_level": energy, "duration_ms": duration_ms}

        speech_frames = 0
        total_frames = 0

        for i in range(0, len(pcm_bytes) - frame_bytes + 1, frame_bytes):
            frame = pcm_bytes[i:i + frame_bytes]
            if len(frame) == frame_bytes:
                total_frames += 1
                try:
                    if vad.is_speech(frame, sample_rate):
                        speech_frames += 1
                except Exception:
                    pass

        speech_detected = total_frames > 0 and (speech_frames / total_frames) >= 0.3

        return {
            "speech_detected": speech_detected,
            "energy_level": energy,
            "duration_ms": duration_ms,
        }

    except Exception as e:
        logger.error(f"VAD processing error: {e}")
        return {"speech_detected": energy > 0.01, "energy_level": energy, "duration_ms": duration_ms}
