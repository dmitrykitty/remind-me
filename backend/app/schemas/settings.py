from __future__ import annotations

from pydantic import BaseModel


class AppSettingsOut(BaseModel):
    face_distance_threshold: float
    object_distance_threshold: float
    frame_interval_ms: int
    face_recognition_enabled: bool
    object_recognition_enabled: bool

    model_config = {"from_attributes": True}


class AppSettingsUpdate(BaseModel):
    face_distance_threshold: float | None = None
    object_distance_threshold: float | None = None
    frame_interval_ms: int | None = None
    face_recognition_enabled: bool | None = None
    object_recognition_enabled: bool | None = None
