from __future__ import annotations

import uuid
from pathlib import Path

import cv2
import numpy as np
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from sqlalchemy.orm import Session

import app.state as state
from app.core.database import get_session
from app.config import get_settings
from app.repositories.person_repo import PersonRepository
from app.schemas.person import PersonCreate, PersonOut

router = APIRouter(prefix="/api/people", tags=["people"])


@router.get("", response_model=list[PersonOut])
def list_people(db: Session = Depends(get_session)):
    return PersonRepository(db).list_all()


@router.post("", response_model=PersonOut, status_code=201)
def create_person(body: PersonCreate, db: Session = Depends(get_session)):
    return PersonRepository(db).create(
        name=body.name,
        relationship_label=body.relationship_label,
        notes=body.notes,
    )


@router.get("/{person_id}", response_model=PersonOut)
def get_person(person_id: str, db: Session = Depends(get_session)):
    person = PersonRepository(db).get_by_id(person_id)
    if not person:
        raise HTTPException(404, "Person not found")
    return person


@router.delete("/{person_id}", status_code=204)
def delete_person(person_id: str, db: Session = Depends(get_session)):
    repo = PersonRepository(db)
    person = repo.get_by_id(person_id)
    if not person:
        raise HTTPException(404, "Person not found")

    if state.face_service:
        state.face_service.remove_person_embeddings(person_id)
    repo.delete(person_id)


@router.post("/{person_id}/samples", response_model=PersonOut)
def add_person_samples(
    person_id: str,
    files: list[UploadFile] = File(...),
    db: Session = Depends(get_session),
):
    repo = PersonRepository(db)
    person = repo.get_by_id(person_id)
    if not person:
        raise HTTPException(404, "Person not found")

    face_svc = state.face_service
    if not face_svc:
        raise HTTPException(503, "Face service not ready")

    settings = get_settings()
    person_dir = Path(settings.media_dir) / "people" / person_id
    person_dir.mkdir(parents=True, exist_ok=True)

    existing_count = repo.count_photos(person_id)

    for idx, upload in enumerate(files):
        content = upload.file.read()
        ext = Path(upload.filename or "photo.jpg").suffix or ".jpg"
        photo_name = f"sample_{existing_count + idx}{ext}"
        photo_file = person_dir / photo_name
        photo_file.write_bytes(content)

        np_arr = np.frombuffer(content, np.uint8)
        image = cv2.imdecode(np_arr, cv2.IMREAD_COLOR)
        if image is None:
            continue

        faces = face_svc.detect_and_embed(image)
        if not faces:
            continue

        embedding = faces[0]["embedding"]
        emb_id = str(uuid.uuid4())
        face_svc.add_embedding(emb_id, embedding, person_id)

        rel_path = f"people/{person_id}/{photo_name}"
        repo.add_photo(
            person_id, rel_path, emb_id, sample_index=existing_count + idx
        )

    db.refresh(person)
    return person
