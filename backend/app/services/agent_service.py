"""Fishjam + Gemini Live agent service.

Creates a Fishjam room with an AI agent that listens to the user's audio,
forwards it to Gemini Live for real-time conversation, and plays back the
AI response in the room.
"""

from __future__ import annotations

import asyncio
import base64
import logging
from typing import Any

from sqlalchemy.orm import Session

from app.config import Settings, get_settings
from app.repositories.object_repo import ObjectRepository
from app.repositories.person_repo import PersonRepository

logger = logging.getLogger(__name__)


def _build_system_prompt(people: list, objects: list) -> str:
    """Build a context-rich system prompt from the user's memory database."""
    lines = [
        "You are a caring AI assistant for a person with memory difficulties.",
        "You speak both Polish and English — use the same language as the user.",
        "Be patient, warm, and reassuring. Keep answers short and clear.",
        "Help them remember people, places, and things from their life.",
        "If they seem lost or confused, gently ask questions and help them stay calm.",
        "",
    ]

    if people:
        lines.append("=== KNOWN PEOPLE IN THEIR LIFE ===")
        for p in people:
            rel = f" ({p.relationship_label})" if p.relationship_label else ""
            notes = f" — {p.notes}" if p.notes else ""
            lines.append(f"• {p.name}{rel}{notes}")
        lines.append("")

    if objects:
        lines.append("=== KNOWN OBJECTS THEY OWN ===")
        for o in objects:
            cat = f" [{o.category}]" if o.category else ""
            notes = f" — {o.notes}" if o.notes else ""
            lines.append(f"• {o.name}{cat}{notes}")
        lines.append("")

    lines.append(
        "Use the above information to help the user. "
        "If they ask about a person, use the details you know. "
        "If they describe someone, try to match them to a known person."
    )
    return "\n".join(lines)


class AgentSession:
    """Represents an active Fishjam room with a Gemini Live agent."""

    def __init__(self, room_id: str, agent: Any, gemini_session: Any, task: asyncio.Task):
        self.room_id = room_id
        self.agent = agent
        self.gemini_session = gemini_session
        self.task = task

    async def stop(self):
        """Disconnect agent and clean up."""
        try:
            self.task.cancel()
        except Exception:
            pass
        try:
            await self.gemini_session.close()
        except Exception:
            pass
        try:
            self.agent.disconnect()
        except Exception:
            pass


class AgentService:
    """Manages Fishjam rooms with Gemini Live AI agents."""

    def __init__(self, settings: Settings) -> None:
        self.settings = settings
        self._fishjam = None
        self._genai = None
        self.active_sessions: dict[str, AgentSession] = {}

    def _get_fishjam(self):
        if self._fishjam is None:
            from fishjam import FishjamClient

            self._fishjam = FishjamClient(
                fishjam_id=self.settings.fishjam_id,
                management_token=self.settings.fishjam_management_token,
            )
        return self._fishjam

    def _get_genai(self):
        if self._genai is None:
            from google import genai

            settings = self.settings
            # Jeśli skonfigurowano projekt, używamy ścieżki Vertex AI
            if settings.google_cloud_project:
                self._genai = genai.Client(
                    vertexai=True,
                    project=settings.google_cloud_project,
                    location=settings.google_cloud_location,
                    # KLUCZOWA POPRAWKA: Przekazujemy klucz API do Vertex AI
                    api_key=settings.vertex_api_key  
                )
            elif settings.gemini_api_key:
                # Ścieżka dla standardowego Google AI Studio (klucze AIza...)
                self._genai = genai.Client(api_key=settings.gemini_api_key)
            else:
                raise RuntimeError("No Gemini API credentials configured")
        return self._genai

    async def start_help_session(self, db: Session) -> dict[str, str]:
        """Create a Fishjam room with AI agent and return peer token for the user."""
        fishjam = self._get_fishjam()

        # Gather memory context
        people = PersonRepository(db).list_all()
        objects = ObjectRepository(db).list_all()
        system_prompt = _build_system_prompt(people, objects)

        # Create Fishjam room
        room = fishjam.create_room()
        logger.info("Created Fishjam room: %s", room.id)

        # Create peer for the user
        peer, peer_token = fishjam.create_peer(room.id)
        logger.info("Created peer %s for room %s", peer.id, room.id)

        # Start AI agent in background
        task = asyncio.create_task(
            self._run_agent(room.id, system_prompt)
        )

        return {
            "room_id": room.id,
            "peer_token": peer_token,
            "peer_id": peer.id,
        }

    async def _run_agent(self, room_id: str, system_prompt: str):
        """Create and run a Fishjam agent bridging audio to Gemini Live."""
        try:
            fishjam = self._get_fishjam()
            genai = self._get_genai()
            from google.genai import types

            # Agent options — receive audio from peers in PCM16 @ 16kHz
            agent_options = {
                "subscribe_mode": "auto",
                "output": {
                    "audio_format": "pcm16",
                    "audio_sample_rate": 16000,
                },
            }

            agent_callbacks = {
                "on_error": lambda e: logger.error("Agent error: %s", e),
                "on_close": lambda code, reason: logger.info(
                    "Agent closed: %s %s", code, reason
                ),
            }

            # Create agent in the room
            result = await fishjam.create_agent(
                room_id, agent_options, agent_callbacks
            )
            agent = result["agent"] if isinstance(result, dict) else result

            # Create output track for agent speech (Gemini outputs 24kHz)
            output_codec = {
                "encoding": "pcm16",
                "sample_rate": 24000,
                "channels": 1,
            }
            agent_track = agent.create_track(output_codec)

            # Connect to Gemini Live
            session = await genai.aio.live.connect(
                # Dla Vertex AI często wystarczy krótki identyfikator modelu
                model="gemini-2.0-flash-exp", 
                config=types.LiveConnectConfig(
                    system_instruction=system_prompt,
                    response_modalities=["AUDIO"],
                ),
            )

            # Store session for cleanup
            agent_session = AgentSession(room_id, agent, session, asyncio.current_task())
            self.active_sessions[room_id] = agent_session

            # Forward Fishjam audio → Gemini
            @agent.on("track_data")
            def on_audio_from_peer(data):
                asyncio.create_task(
                    session.send_realtime_input(
                        audio={
                            "mime_type": "audio/pcm;rate=16000",
                            "data": base64.b64encode(data["data"]).decode(),
                        }
                    )
                )

            # Forward Gemini audio → Fishjam
            async for msg in session.receive():
                if hasattr(msg, "data") and msg.data:
                    pcm_data = base64.b64decode(msg.data)
                    agent.send_data(agent_track.id, pcm_data)
                if (
                    hasattr(msg, "server_content")
                    and msg.server_content
                    and getattr(msg.server_content, "interrupted", False)
                ):
                    agent.interrupt_track(agent_track.id)

        except asyncio.CancelledError:
            logger.info("Agent task cancelled for room %s", room_id)
        except Exception as exc:
            logger.error("Agent error for room %s: %s", room_id, exc, exc_info=True)
        finally:
            self.active_sessions.pop(room_id, None)

    async def stop_help_session(self, room_id: str) -> bool:
        """Stop an active help session."""
        session = self.active_sessions.get(room_id)
        if session:
            await session.stop()
            self.active_sessions.pop(room_id, None)
            logger.info("Stopped help session for room %s", room_id)
            return True
        return False
