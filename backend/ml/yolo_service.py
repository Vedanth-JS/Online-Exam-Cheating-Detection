"""
YOLOv8n object detection service.
Detects: cell phone, book, person — objects that indicate cheating.
"""
import base64
import logging
from typing import Optional

import numpy as np
import cv2

logger = logging.getLogger(__name__)

# COCO classes we care about (indices in YOLOv8 COCO model)
_TARGET_CLASSES = {"cell phone", "book", "person"}
_CONFIDENCE_THRESHOLD = 0.65

_model = None


def _load_model():
    global _model
    if _model is None:
        try:
            from ultralytics import YOLO
            _model = YOLO("yolov8n.pt")  # downloads automatically on first run
            logger.info("YOLOv8n model loaded successfully")
        except Exception as e:
            logger.error(f"Failed to load YOLOv8 model: {e}")
            _model = None
    return _model


def _decode_frame(frame_b64: str) -> Optional[np.ndarray]:
    try:
        img_bytes = base64.b64decode(frame_b64)
        arr = np.frombuffer(img_bytes, np.uint8)
        frame = cv2.imdecode(arr, cv2.IMREAD_COLOR)
        return frame
    except Exception as e:
        logger.warning(f"Failed to decode frame: {e}")
        return None


def detect_objects(frame_b64: str) -> list[dict]:
    """
    Detect cheating-related objects in a base64-encoded JPEG/PNG frame.

    Returns:
        List of dicts: [{"label": str, "confidence": float, "bbox": [x, y, w, h]}]
        Returns [] on any error (graceful degradation).
    """
    if not frame_b64:
        return []

    model = _load_model()
    if model is None:
        return []

    frame = _decode_frame(frame_b64)
    if frame is None:
        return []

    try:
        results = model(frame, verbose=False)
        detections = []

        for result in results:
            boxes = result.boxes
            if boxes is None:
                continue

            for box in boxes:
                conf = float(box.conf[0])
                cls_id = int(box.cls[0])
                label = model.names.get(cls_id, "")

                if label not in _TARGET_CLASSES:
                    continue
                if conf < _CONFIDENCE_THRESHOLD:
                    continue

                x1, y1, x2, y2 = box.xyxy[0].tolist()
                detections.append({
                    "label": label,
                    "confidence": round(conf, 4),
                    "bbox": [int(x1), int(y1), int(x2 - x1), int(y2 - y1)],
                })

        return detections

    except Exception as e:
        logger.error(f"YOLOv8 inference error: {e}")
        return []
