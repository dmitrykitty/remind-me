from __future__ import annotations

import logging

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

import app.state as state

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/room", tags=["room"])


class StartHelpResponse(BaseModel):
    room_id: str
    peer_token: str
    peer_id: str


class RoomIdRequest(BaseModel):
    room_id: str


class WaitingRoom(BaseModel):
    room_id: str
    waiting_seconds: int


@router.post("/create", response_model=StartHelpResponse)
async def create_help_room():
    """User clicks SOS → create a Fishjam room and return their peer token."""
    if not state.room_service:
        raise HTTPException(503, "Room service not configured (Fishjam credentials missing)")
    try:
        room = state.room_service.create_help_room()
        return {
            "room_id": room.room_id,
            "peer_token": room.user_peer_token,
            "peer_id": room.user_peer_id,
        }
    except Exception as exc:
        logger.error("Failed to create help room: %s", exc, exc_info=True)
        raise HTTPException(500, f"Could not create room: {exc}")


@router.get("/waiting", response_model=list[WaitingRoom])
async def list_waiting_rooms():
    """Volunteer panel polls this to see rooms waiting for help."""
    if not state.room_service:
        raise HTTPException(503, "Room service not configured")
    return state.room_service.list_waiting_rooms()


@router.post("/join", response_model=StartHelpResponse)
async def volunteer_join(body: RoomIdRequest):
    """Volunteer joins an existing room."""
    if not state.room_service:
        raise HTTPException(503, "Room service not configured")
    try:
        result = state.room_service.volunteer_join(body.room_id)
        return result
    except ValueError as exc:
        raise HTTPException(404, str(exc))
    except Exception as exc:
        logger.error("Failed to join room: %s", exc, exc_info=True)
        raise HTTPException(500, f"Could not join room: {exc}")


@router.post("/close")
async def close_room(body: RoomIdRequest):
    """Either party ends the call."""
    if not state.room_service:
        raise HTTPException(503, "Room service not configured")
    closed = state.room_service.close_room(body.room_id)
    if not closed:
        raise HTTPException(404, "Room not found")
    return {"status": "closed"}
