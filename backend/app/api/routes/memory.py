from __future__ import annotations

import shutil
from pathlib import Path

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

import app.state as state
from app.config import get_settings
from app.core.database import get_session
from app.repositories.object_repo import ObjectRepository
from app.repositories.person_repo import PersonRepository

router = APIRouter(prefix="/api/memory", tags=["memory"])


@router.post("/reset")
def reset_memory(db: Session = Depends(get_session)):
    """Delete ALL enrolled people, objects, embeddings, and media files."""
    PersonRepository(db).delete_all()
    ObjectRepository(db).delete_all()

    if state.vector_store:
        state.vector_store.reset()

    settings = get_settings()
    media = Path(settings.media_dir)
    if media.exists():
        shutil.rmtree(media)
        media.mkdir(parents=True)

    return {"status": "ok", "message": "All memory cleared"}
