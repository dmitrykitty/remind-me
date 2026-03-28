from __future__ import annotations

import logging

import chromadb

from app.config import get_settings

logger = logging.getLogger(__name__)


class VectorStore:
    """Thin wrapper around ChromaDB for face and object embedding collections."""

    def __init__(self) -> None:
        settings = get_settings()
        self._client = chromadb.PersistentClient(path=settings.chroma_dir)

        self.faces = self._client.get_or_create_collection(
            name="face_embeddings",
            metadata={"hnsw:space": "cosine"},
        )
        self.objects = self._client.get_or_create_collection(
            name="object_embeddings",
            metadata={"hnsw:space": "cosine"},
        )
        logger.info(
            "VectorStore ready — faces: %d, objects: %d",
            self.faces.count(),
            self.objects.count(),
        )

    # ---- faces ----

    def add_face_embedding(
        self, embedding_id: str, embedding: list[float], person_id: str
    ) -> None:
        self.faces.add(
            ids=[embedding_id],
            embeddings=[embedding],
            metadatas=[{"person_id": person_id}],
        )

    def query_faces(self, embedding: list[float], n_results: int = 5) -> dict:
        count = self.faces.count()
        if count == 0:
            return {"ids": [[]], "distances": [[]], "metadatas": [[]]}
        return self.faces.query(
            query_embeddings=[embedding],
            n_results=min(n_results, count),
        )

    def delete_face_embeddings(self, person_id: str) -> None:
        results = self.faces.get(where={"person_id": person_id})
        if results["ids"]:
            self.faces.delete(ids=results["ids"])

    # ---- objects ----

    def add_object_embedding(
        self, embedding_id: str, embedding: list[float], object_id: str
    ) -> None:
        self.objects.add(
            ids=[embedding_id],
            embeddings=[embedding],
            metadatas=[{"object_id": object_id}],
        )

    def query_objects(self, embedding: list[float], n_results: int = 5) -> dict:
        count = self.objects.count()
        if count == 0:
            return {"ids": [[]], "distances": [[]], "metadatas": [[]]}
        return self.objects.query(
            query_embeddings=[embedding],
            n_results=min(n_results, count),
        )

    def delete_object_embeddings(self, object_id: str) -> None:
        results = self.objects.get(where={"object_id": object_id})
        if results["ids"]:
            self.objects.delete(ids=results["ids"])

    # ---- admin ----

    def reset(self) -> None:
        """Drop and recreate both collections."""
        self._client.delete_collection("face_embeddings")
        self._client.delete_collection("object_embeddings")
        self.faces = self._client.get_or_create_collection(
            name="face_embeddings",
            metadata={"hnsw:space": "cosine"},
        )
        self.objects = self._client.get_or_create_collection(
            name="object_embeddings",
            metadata={"hnsw:space": "cosine"},
        )
        logger.info("VectorStore reset")
