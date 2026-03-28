from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel


class PersonCreate(BaseModel):
    name: str
    relationship_label: str = ""
    notes: str = ""


class PersonPhotoOut(BaseModel):
    id: str
    photo_path: str
    sample_index: int
    created_at: datetime

    model_config = {"from_attributes": True}


class PersonOut(BaseModel):
    id: str
    name: str
    relationship_label: str
    notes: str
    created_at: datetime
    updated_at: datetime
    photos: list[PersonPhotoOut] = []

    model_config = {"from_attributes": True}
