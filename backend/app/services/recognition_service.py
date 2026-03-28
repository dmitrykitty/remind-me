from __future__ import annotations

import base64
import logging
import time
import uuid

import cv2
from PIL import Image
from sqlalchemy.orm import Session

from app.repositories.object_repo import ObjectRepository
from app.repositories.person_repo import PersonRepository
from app.schemas.recognition import (
    FaceBBox,
    RecognizedFace,
    RecognizedObject,
    RecognitionResult,
    UnknownFace,
)
from app.services.face_service import FaceService
from app.services.object_service import ObjectService
from app.utils.image import decode_image_bytes

logger = logging.getLogger(__name__)


class RecognitionService:
    """Orchestrates face + object recognition on a single frame.

    All heavy work runs synchronously and is expected to be called via
    ``asyncio.to_thread`` from the WebSocket handler.
    """

    def __init__(
        self, face_service: FaceService, object_service: ObjectService
    ) -> None:
        self.face_service = face_service
        self.object_service = object_service

    def process_frame(
        self,
        image_bytes: bytes,
        db: Session,
        settings: dict,
    ) -> RecognitionResult:
        t0 = time.perf_counter()

        image = decode_image_bytes(image_bytes)
        if image is None:
            return RecognitionResult()

        h, w = image.shape[:2]
        face_results: list[RecognizedFace] = []
        unknown_face_results: list[UnknownFace] = []
        object_results: list[RecognizedObject] = []

        face_threshold = settings.get("face_distance_threshold", 0.35)
        object_threshold = settings.get("object_distance_threshold", 0.40)
        face_enabled = settings.get("face_recognition_enabled", True)
        object_enabled = settings.get("object_recognition_enabled", True)

        # ---- Face recognition ------------------------------------------------
        if face_enabled:
            faces = self.face_service.detect_and_embed(image)
            person_repo = PersonRepository(db)
            seen_persons: set[str] = set()

            for face in faces:
                area = face.get("facial_area", {})
                bbox = FaceBBox(
                    x=int(area.get("x", 0)),
                    y=int(area.get("y", 0)),
                    w=int(area.get("w", 0)),
                    h=int(area.get("h", 0)),
                )

                person_id, confidence = self.face_service.find_match(
                    face["embedding"], threshold=face_threshold
                )
                if person_id and person_id not in seen_persons:
                    seen_persons.add(person_id)
                    person = person_repo.get_by_id(person_id)
                    if person:
                        face_results.append(
                            RecognizedFace(
                                person_id=person_id,
                                name=person.name,
                                relationship_label=person.relationship_label or "",
                                notes=person.notes or "",
                                confidence=confidence,
                                bbox=bbox,
                            )
                        )
                else:
                    # Unknown face — crop and encode for quick enrollment
                    x1 = max(0, bbox.x)
                    y1 = max(0, bbox.y)
                    x2 = min(w, bbox.x + bbox.w)
                    y2 = min(h, bbox.y + bbox.h)
                    if x2 > x1 and y2 > y1:
                        crop = image[y1:y2, x1:x2]
                        _, buf = cv2.imencode(".jpg", crop, [cv2.IMWRITE_JPEG_QUALITY, 85])
                        crop_b64 = base64.b64encode(buf.tobytes()).decode()
                        unknown_face_results.append(
                            UnknownFace(
                                face_id=str(uuid.uuid4()),
                                bbox=bbox,
                                crop_base64=crop_b64,
                            )
                        )

        # ---- Object recognition ----------------------------------------------
        if object_enabled:
            try:
                pil_image = Image.fromarray(cv2.cvtColor(image, cv2.COLOR_BGR2RGB))
                obj_embedding = self.object_service.compute_embedding(pil_image)
                object_id, confidence = self.object_service.find_match(
                    obj_embedding, threshold=object_threshold
                )
                if object_id:
                    obj_repo = ObjectRepository(db)
                    obj = obj_repo.get_by_id(object_id)
                    if obj:
                        object_results.append(
                            RecognizedObject(
                                object_id=object_id,
                                name=obj.name,
                                category=obj.category or "",
                                notes=obj.notes or "",
                                confidence=confidence,
                            )
                        )
            except Exception as exc:
                logger.warning("Object recognition error: %s", exc)

        elapsed = round((time.perf_counter() - t0) * 1000, 1)
        return RecognitionResult(
            faces=face_results,
            unknown_faces=unknown_face_results,
            objects=object_results,
            frame_width=w,
            frame_height=h,
            processing_ms=elapsed,
        )
