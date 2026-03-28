from __future__ import annotations

import logging

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.database import get_session
from app.models.tables import HistoryEntry

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/history", tags=["history"])


class HistoryOut(BaseModel):
    id: str
    kind: str
    title: str
    summary: str
    transcript: str
    created_at: str

    class Config:
        from_attributes = True


class HistoryCreate(BaseModel):
    kind: str
    title: str
    summary: str = ""
    transcript: str = ""


class SummarizeRequest(BaseModel):
    transcript: str


def _to_out(h: HistoryEntry) -> HistoryOut:
    return HistoryOut(
        id=h.id,
        kind=h.kind,
        title=h.title,
        summary=h.summary,
        transcript=h.transcript,
        created_at=h.created_at.isoformat(),
    )


@router.get("", response_model=list[HistoryOut])
def list_history(limit: int = 50, db: Session = Depends(get_session)):
    entries = (
        db.query(HistoryEntry)
        .order_by(HistoryEntry.created_at.desc())
        .limit(limit)
        .all()
    )
    return [_to_out(e) for e in entries]


@router.post("", response_model=HistoryOut, status_code=201)
def create_history(body: HistoryCreate, db: Session = Depends(get_session)):
    entry = HistoryEntry(
        kind=body.kind,
        title=body.title,
        summary=body.summary,
        transcript=body.transcript,
    )
    db.add(entry)
    db.commit()
    db.refresh(entry)
    return _to_out(entry)


@router.post("/summarize")
async def summarize_transcript(body: SummarizeRequest):
    """Use Gemini to summarize a conversation transcript."""
    if not body.transcript.strip():
        raise HTTPException(400, "Empty transcript")

    from app.services.voice_service import _get_genai_client

    try:
        client = _get_genai_client()
        from google.genai import types

        response = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=[
                (
                    "Summarize the following conversation in 2-3 sentences (in the same language as the conversation). "
                    "Focus on key decisions, advices, and action items:\n\n"
                    + body.transcript
                )
            ],
            config=types.GenerateContentConfig(temperature=0.3),
        )
        summary = response.text.strip()
        return {"summary": summary}
    except Exception as exc:
        logger.error("Summarize error: %s", exc, exc_info=True)
        raise HTTPException(500, f"Summarize failed: {exc}")


@router.delete("/{entry_id}", status_code=204)
def delete_history_entry(entry_id: str, db: Session = Depends(get_session)):
    entry = db.get(HistoryEntry, entry_id)
    if not entry:
        raise HTTPException(404, "Entry not found")
    db.delete(entry)
    db.commit()
