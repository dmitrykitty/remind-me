from __future__ import annotations

import uuid
from pathlib import Path

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from sqlalchemy.orm import Session

import app.state as state
from app.config import get_settings
from app.core.database import get_session
from app.repositories.object_repo import ObjectRepository
from app.schemas.known_object import KnownObjectCreate, KnownObjectOut
from app.utils.image import bytes_to_pil

router = APIRouter(prefix="/api/objects", tags=["objects"])


@router.get("", response_model=list[KnownObjectOut])
def list_objects(db: Session = Depends(get_session)):
    return ObjectRepository(db).list_all()


@router.post("", response_model=KnownObjectOut, status_code=201)
def create_object(body: KnownObjectCreate, db: Session = Depends(get_session)):
    return ObjectRepository(db).create(
        name=body.name,
        category=body.category,
        notes=body.notes,
    )


@router.get("/{object_id}", response_model=KnownObjectOut)
def get_object(object_id: str, db: Session = Depends(get_session)):
    obj = ObjectRepository(db).get_by_id(object_id)
    if not obj:
        raise HTTPException(404, "Object not found")
    return obj


@router.delete("/{object_id}", status_code=204)
def delete_object(object_id: str, db: Session = Depends(get_session)):
    repo = ObjectRepository(db)
    obj = repo.get_by_id(object_id)
    if not obj:
        raise HTTPException(404, "Object not found")

    if state.object_service:
        state.object_service.remove_object_embeddings(object_id)
    repo.delete(object_id)


@router.post("/{object_id}/samples", response_model=KnownObjectOut)
def add_object_samples(
    object_id: str,
    files: list[UploadFile] = File(...),
    db: Session = Depends(get_session),
):
    repo = ObjectRepository(db)
    obj = repo.get_by_id(object_id)
    if not obj:
        raise HTTPException(404, "Object not found")

    obj_svc = state.object_service
    if not obj_svc:
        raise HTTPException(503, "Object service not ready")

    settings = get_settings()
    obj_dir = Path(settings.media_dir) / "objects" / object_id
    obj_dir.mkdir(parents=True, exist_ok=True)

    existing_count = repo.count_photos(object_id)

    for idx, upload in enumerate(files):
        content = upload.file.read()
        ext = Path(upload.filename or "photo.jpg").suffix or ".jpg"
        photo_name = f"sample_{existing_count + idx}{ext}"
        photo_file = obj_dir / photo_name
        photo_file.write_bytes(content)

        try:
            pil_img = bytes_to_pil(content)
        except Exception:
            continue

        embedding = obj_svc.compute_embedding(pil_img)
        emb_id = str(uuid.uuid4())
        obj_svc.add_embedding(emb_id, embedding, object_id)

        rel_path = f"objects/{object_id}/{photo_name}"
        repo.add_photo(
            object_id, rel_path, emb_id, sample_index=existing_count + idx
        )

    db.refresh(obj)
    return obj
