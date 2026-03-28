from __future__ import annotations

import logging

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

import app.state as state
from app.core.database import get_session

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/agent", tags=["agent"])


class StartHelpResponse(BaseModel):
    room_id: str
    peer_token: str
    peer_id: str


class StopHelpRequest(BaseModel):
    room_id: str


@router.post("/start-help", response_model=StartHelpResponse)
async def start_help(db: Session = Depends(get_session)):
    """Create a Fishjam room with an AI voice agent and return a peer token."""
    if not state.agent_service:
        raise HTTPException(503, "Agent service not configured")
    try:
        result = await state.agent_service.start_help_session(db)
        return result
    except Exception as exc:
        logger.error("Failed to start help session: %s", exc, exc_info=True)
        raise HTTPException(500, f"Could not start help session: {exc}")


@router.post("/stop-help")
async def stop_help(body: StopHelpRequest):
    """Stop an active help session."""
    if not state.agent_service:
        raise HTTPException(503, "Agent service not configured")
    stopped = await state.agent_service.stop_help_session(body.room_id)
    if not stopped:
        raise HTTPException(404, "No active session for this room")
    return {"status": "stopped"}
