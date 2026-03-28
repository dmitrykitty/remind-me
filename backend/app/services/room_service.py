"""Fishjam room service for volunteer ↔ user live calls.

Manages Fishjam rooms where a person with memory difficulties
can be connected to a human volunteer for a live audio/video consultation.
"""

from __future__ import annotations

import logging
import time
from dataclasses import dataclass, field

from app.config import Settings

logger = logging.getLogger(__name__)


@dataclass
class HelpRoom:
    """An active help room waiting for or connected to a volunteer."""
    room_id: str
    user_peer_token: str
    user_peer_id: str
    volunteer_peer_token: str | None = None
    volunteer_peer_id: str | None = None
    created_at: float = field(default_factory=time.time)
    status: str = "waiting"  # waiting | active | closed


class RoomService:
    """Manages Fishjam rooms for user ↔ volunteer calls."""

    def __init__(self, settings: Settings) -> None:
        self.settings = settings
        self._fishjam = None
        self.rooms: dict[str, HelpRoom] = {}

    def _get_fishjam(self):
        if self._fishjam is None:
            from fishjam import FishjamClient
            self._fishjam = FishjamClient(
                fishjam_id=self.settings.fishjam_id,
                management_token=self.settings.fishjam_management_token,
            )
        return self._fishjam

    def create_help_room(self) -> HelpRoom:
        """User requests help → create Fishjam room + user peer."""
        fishjam = self._get_fishjam()

        room = fishjam.create_room()
        logger.info("Created Fishjam room: %s", room.id)

        peer, peer_token = fishjam.create_peer(room.id)
        logger.info("Created user peer %s in room %s", peer.id, room.id)

        help_room = HelpRoom(
            room_id=room.id,
            user_peer_token=peer_token,
            user_peer_id=peer.id,
        )
        self.rooms[room.id] = help_room
        return help_room

    def list_waiting_rooms(self) -> list[dict]:
        """Return rooms waiting for a volunteer (for the volunteer panel)."""
        now = time.time()
        waiting = []
        for r in self.rooms.values():
            if r.status == "waiting":
                waiting.append({
                    "room_id": r.room_id,
                    "waiting_seconds": int(now - r.created_at),
                })
        return waiting

    def volunteer_join(self, room_id: str) -> dict:
        """Volunteer joins an existing help room."""
        help_room = self.rooms.get(room_id)
        if not help_room or help_room.status != "waiting":
            raise ValueError("Room not available")

        fishjam = self._get_fishjam()
        peer, peer_token = fishjam.create_peer(room_id)
        logger.info("Volunteer peer %s joined room %s", peer.id, room_id)

        help_room.volunteer_peer_token = peer_token
        help_room.volunteer_peer_id = peer.id
        help_room.status = "active"

        return {
            "room_id": room_id,
            "peer_token": peer_token,
            "peer_id": peer.id,
        }

    def close_room(self, room_id: str) -> bool:
        """Close a room (either party can end the call)."""
        help_room = self.rooms.pop(room_id, None)
        if not help_room:
            return False
        help_room.status = "closed"
        logger.info("Closed room %s", room_id)
        return True
