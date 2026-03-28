from __future__ import annotations

import logging

import numpy as np

from app.config import Settings
from app.core.vector_store import VectorStore

logger = logging.getLogger(__name__)

# Lazy import to avoid loading TensorFlow at startup
DeepFace = None


def _get_deepface():
    global DeepFace
    if DeepFace is None:
        from deepface import DeepFace as _DF
        DeepFace = _DF
    return DeepFace


class FaceService:
    """Face detection, embedding, and matching via DeepFace + ChromaDB."""

    def __init__(self, settings: Settings, vector_store: VectorStore) -> None:
        self.settings = settings
        self.vector_store = vector_store
        self._model_loaded = False

    def _ensure_model(self) -> None:
        if not self._model_loaded:
            logger.info("Loading face model: %s ...", self.settings.face_model)
            _get_deepface().build_model(self.settings.face_model)
            self._model_loaded = True
            logger.info("Face model ready")

    # ------------------------------------------------------------------
    # Detection + embedding
    # ------------------------------------------------------------------

    def detect_and_embed(self, image: np.ndarray) -> list[dict]:
        """Return list of dicts with keys: embedding, facial_area, face_confidence."""
        self._ensure_model()
        try:
            results = _get_deepface().represent(
                img_path=image,
                model_name=self.settings.face_model,
                detector_backend=self.settings.face_detector,
                enforce_detection=False,
                align=True,
            )
            # Filter out very low-confidence pseudo-detections
            return [r for r in results if r.get("face_confidence", 0) > 0.50]
        except Exception as exc:
            logger.warning("Face detection error: %s", exc)
            return []

    # ------------------------------------------------------------------
    # Matching
    # ------------------------------------------------------------------

    def find_match(
        self, embedding: list[float], threshold: float | None = None
    ) -> tuple[str | None, float]:
        """Return (person_id, confidence) or (None, 0.0)."""
        if threshold is None:
            threshold = self.settings.face_distance_threshold

        results = self.vector_store.query_faces(embedding, n_results=5)

        if not results["distances"][0]:
            return None, 0.0

        best_dist = results["distances"][0][0]
        if best_dist <= threshold:
            person_id: str = results["metadatas"][0][0]["person_id"]
            return person_id, round(1.0 - best_dist, 3)

        return None, 0.0

    # ------------------------------------------------------------------
    # Enrollment helpers
    # ------------------------------------------------------------------

    def add_embedding(
        self, embedding_id: str, embedding: list[float], person_id: str
    ) -> None:
        self.vector_store.add_face_embedding(embedding_id, embedding, person_id)

    def remove_person_embeddings(self, person_id: str) -> None:
        self.vector_store.delete_face_embeddings(person_id)
