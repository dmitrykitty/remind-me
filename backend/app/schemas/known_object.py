from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel


class KnownObjectCreate(BaseModel):
    name: str
    category: str = ""
    notes: str = ""


class KnownObjectPhotoOut(BaseModel):
    id: str
    photo_path: str
    sample_index: int
    created_at: datetime

    model_config = {"from_attributes": True}


class KnownObjectOut(BaseModel):
    id: str
    name: str
    category: str
    notes: str
    created_at: datetime
    updated_at: datetime
    photos: list[KnownObjectPhotoOut] = []

    model_config = {"from_attributes": True}
