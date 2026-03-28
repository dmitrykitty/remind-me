from __future__ import annotations

import io

import cv2
import numpy as np
from PIL import Image


def decode_image_bytes(data: bytes) -> np.ndarray | None:
    """Decode JPEG/PNG bytes to an OpenCV BGR ndarray."""
    np_arr = np.frombuffer(data, np.uint8)
    image = cv2.imdecode(np_arr, cv2.IMREAD_COLOR)
    return image


def bytes_to_pil(data: bytes) -> Image.Image:
    """Convert raw image bytes to a PIL RGB Image."""
    return Image.open(io.BytesIO(data)).convert("RGB")
