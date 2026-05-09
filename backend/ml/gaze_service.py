"""
Gaze direction analysis using MediaPipe FaceMesh.
Uses landmarks 33/263 (eye corners) and 468/473 (iris centers) for gaze angle.
"""
import base64
import logging
import time
from typing import Optional

import numpy as np
import cv2

logger = logging.getLogger(__name__)

_face_mesh = None


def _load_face_mesh():
    global _face_mesh
    if _face_mesh is None:
        try:
            import mediapipe as mp
            _face_mesh = mp.solutions.face_mesh.FaceMesh(
                static_image_mode=True,
                max_num_faces=1,
                refine_landmarks=True,  # enables iris landmarks 468-477
                min_detection_confidence=0.5,
                min_tracking_confidence=0.5,
            )
            logger.info("MediaPipe FaceMesh loaded successfully")
        except Exception as e:
            logger.error(f"Failed to load MediaPipe FaceMesh: {e}")
            _face_mesh = None
    return _face_mesh


def _decode_frame(frame_b64: str) -> Optional[np.ndarray]:
    try:
        img_bytes = base64.b64decode(frame_b64)
        arr = np.frombuffer(img_bytes, np.uint8)
        return cv2.imdecode(arr, cv2.IMREAD_COLOR)
    except Exception as e:
        logger.warning(f"Gaze frame decode error: {e}")
        return None


def _compute_gaze_direction(landmarks, img_w: int, img_h: int) -> tuple[str, float]:
    """
    Returns (direction, confidence) using iris and eye corner landmarks.
    Landmarks:
      33  = left eye outer corner
      263 = right eye outer corner
      468 = left iris center  (requires refine_landmarks=True)
      473 = right iris center
    """
    try:
        def lm(idx):
            pt = landmarks.landmark[idx]
            return np.array([pt.x * img_w, pt.y * img_h])

        left_corner  = lm(33)
        right_corner = lm(263)
        left_iris    = lm(468)
        right_iris   = lm(473)

        # Horizontal gaze: compare iris centre x to eye midpoint
        eye_mid_x = (left_corner[0] + right_corner[0]) / 2
        iris_mid_x = (left_iris[0] + right_iris[0]) / 2
        eye_width = abs(right_corner[0] - left_corner[0])

        h_ratio = (iris_mid_x - eye_mid_x) / (eye_width + 1e-6)

        # Vertical gaze: y deviation from eye midpoint
        eye_mid_y = (left_corner[1] + right_corner[1]) / 2
        iris_mid_y = (left_iris[1] + right_iris[1]) / 2
        v_ratio = (iris_mid_y - eye_mid_y) / (eye_width + 1e-6)

        if abs(h_ratio) < 0.08 and abs(v_ratio) < 0.08:
            return "CENTER", 0.92
        elif h_ratio < -0.08:
            return "LEFT", min(0.99, 0.7 + abs(h_ratio))
        elif h_ratio > 0.08:
            return "RIGHT", min(0.99, 0.7 + abs(h_ratio))
        elif v_ratio < -0.08:
            return "UP", min(0.99, 0.7 + abs(v_ratio))
        else:
            return "CENTER", 0.75

    except Exception:
        return "CENTER", 0.5


def analyze_gaze(frame_b64: str) -> dict:
    """
    Analyze gaze direction from a base64 frame.

    Returns:
        {"direction": "LEFT"|"RIGHT"|"UP"|"CENTER"|"ABSENT",
         "duration_ms": int,
         "confidence": float}
    """
    absent_result = {"direction": "ABSENT", "duration_ms": 0, "confidence": 1.0}
    error_result  = {"direction": "CENTER", "duration_ms": 0, "confidence": 0.0}

    if not frame_b64:
        return absent_result

    face_mesh = _load_face_mesh()
    if face_mesh is None:
        return error_result

    frame = _decode_frame(frame_b64)
    if frame is None:
        return error_result

    try:
        t0 = time.time()
        rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        h, w = rgb.shape[:2]
        results = face_mesh.process(rgb)
        duration_ms = int((time.time() - t0) * 1000)

        if not results.multi_face_landmarks:
            return {**absent_result, "duration_ms": duration_ms}

        direction, confidence = _compute_gaze_direction(
            results.multi_face_landmarks[0], w, h
        )
        return {"direction": direction, "duration_ms": duration_ms, "confidence": round(confidence, 4)}

    except Exception as e:
        logger.error(f"Gaze analysis error: {e}")
        return error_result
