from __future__ import annotations

import logging
from typing import TYPE_CHECKING

from app.config import Settings
from app.core.vector_store import VectorStore

if TYPE_CHECKING:
    from PIL import Image
    from sentence_transformers import SentenceTransformer

logger = logging.getLogger(__name__)

_SentenceTransformer = None


def _get_sentence_transformer():
    global _SentenceTransformer
    if _SentenceTransformer is None:
        from sentence_transformers import SentenceTransformer as _ST
        _SentenceTransformer = _ST
    return _SentenceTransformer


class ObjectService:
    """Known-object embedding and matching via CLIP + ChromaDB.

    This is NOT generic object detection. It matches the full frame (or a
    cropped region) against previously enrolled known items using cosine
    similarity of CLIP embeddings.
    """

    def __init__(self, settings: Settings, vector_store: VectorStore) -> None:
        self.settings = settings
        self.vector_store = vector_store
        self._model: SentenceTransformer | None = None

    def _ensure_model(self) -> None:
        if self._model is None:
            logger.info("Loading CLIP model: %s ...", self.settings.clip_model)
            self._model = _get_sentence_transformer()(self.settings.clip_model)
            logger.info("CLIP model ready")

    # ------------------------------------------------------------------
    # Embedding
    # ------------------------------------------------------------------

    def compute_embedding(self, image: Image.Image) -> list[float]:
        self._ensure_model()
        assert self._model is not None
        vec = self._model.encode(image)
        return vec.tolist()

    # ------------------------------------------------------------------
    # Matching
    # ------------------------------------------------------------------

    def find_match(
        self, embedding: list[float], threshold: float | None = None
    ) -> tuple[str | None, float]:
        """Return (object_id, confidence) or (None, 0.0)."""
        if threshold is None:
            threshold = self.settings.object_distance_threshold

        results = self.vector_store.query_objects(embedding, n_results=5)

        if not results["distances"][0]:
            return None, 0.0

        # De-duplicate by object_id, keep best (lowest distance)
        seen: dict[str, float] = {}
        for dist, meta in zip(results["distances"][0], results["metadatas"][0]):
            oid = meta["object_id"]
            if oid not in seen or dist < seen[oid]:
                seen[oid] = dist

        best_oid, best_dist = min(seen.items(), key=lambda t: t[1])
        logger.debug("CLIP best match: object_id=%s distance=%.4f threshold=%.4f", best_oid, best_dist, threshold)
        if best_dist <= threshold:
            return best_oid, round(1.0 - best_dist, 3)

        return None, 0.0

    # ------------------------------------------------------------------
    # Enrollment helpers
    # ------------------------------------------------------------------

    def add_embedding(
        self, embedding_id: str, embedding: list[float], object_id: str
    ) -> None:
        self.vector_store.add_object_embedding(embedding_id, embedding, object_id)

    def remove_object_embeddings(self, object_id: str) -> None:
        self.vector_store.delete_object_embeddings(object_id)
