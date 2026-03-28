from __future__ import annotations

from pydantic import BaseModel


class FaceBBox(BaseModel):
    x: int
    y: int
    w: int
    h: int


class RecognizedFace(BaseModel):
    person_id: str
    name: str
    relationship_label: str
    notes: str
    confidence: float
    bbox: FaceBBox


class UnknownFace(BaseModel):
    """A detected face that didn't match any enrolled person."""
    face_id: str
    bbox: FaceBBox
    crop_base64: str  # JPEG face crop for quick enrollment


class RecognizedObject(BaseModel):
    object_id: str
    name: str
    category: str
    notes: str
    confidence: float


class RecognitionResult(BaseModel):
    faces: list[RecognizedFace] = []
    unknown_faces: list[UnknownFace] = []
    objects: list[RecognizedObject] = []
    frame_width: int = 0
    frame_height: int = 0
    processing_ms: float = 0.0
