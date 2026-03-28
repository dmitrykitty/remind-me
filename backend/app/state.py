"""
Mutable application-wide singletons.

Populated during FastAPI lifespan startup. Avoids circular imports by keeping
references in a neutral module that any layer can import.
"""

from __future__ import annotations

from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from app.core.vector_store import VectorStore
    from app.services.face_service import FaceService
    from app.services.object_service import ObjectService
    from app.services.recognition_service import RecognitionService
    from app.services.room_service import RoomService
    from app.services.voice_service import VoiceService

vector_store: "VectorStore | None" = None
face_service: "FaceService | None" = None
object_service: "ObjectService | None" = None
recognition_service: "RecognitionService | None" = None
voice_service: "VoiceService | None" = None
room_service: "RoomService | None" = None
