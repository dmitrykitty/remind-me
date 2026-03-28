from __future__ import annotations

import logging

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from sqlalchemy.orm import Session

import app.state as state
from app.core.database import get_session

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/voice", tags=["voice"])


@router.post("/command")
async def voice_command(
    audio: UploadFile = File(...),
    frame: UploadFile | None = File(None),
    db: Session = Depends(get_session),
):
    """Process a voice command with optional camera frame context.

    - audio: audio file (webm, wav, mp3, etc.)
    - frame: optional JPEG frame from the camera showing what the user sees
    """
    if not state.voice_service:
        raise HTTPException(503, "Voice service not ready")

    audio_bytes = await audio.read()
    if not audio_bytes:
        raise HTTPException(400, "Empty audio file")

    # Determine MIME type
    audio_mime = audio.content_type or "audio/webm"

    frame_bytes = None
    if frame:
        frame_bytes = await frame.read()
        if not frame_bytes:
            frame_bytes = None

    try:
        result = await state.voice_service.process_voice_command(
            audio_bytes=audio_bytes,
            audio_mime=audio_mime,
            frame_bytes=frame_bytes,
            db=db,
        )
        return result
    except RuntimeError as exc:
        raise HTTPException(500, str(exc))
    except Exception as exc:
        logger.error("Voice command error: %s", exc, exc_info=True)
        raise HTTPException(500, f"Voice processing failed: {exc}")
