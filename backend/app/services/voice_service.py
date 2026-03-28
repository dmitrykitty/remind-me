from __future__ import annotations

import json
import logging
import uuid
from pathlib import Path
from typing import Any

import cv2
import numpy as np
from sqlalchemy.orm import Session

from app.config import Settings, get_settings
from app.repositories.object_repo import ObjectRepository
from app.repositories.person_repo import PersonRepository

logger = logging.getLogger(__name__)

# Lazy import for google-genai
_genai_client = None


def _get_genai_client():
    global _genai_client
    if _genai_client is None:
        from google import genai

        settings = get_settings()

        if settings.google_cloud_project:
            # Vertex AI mode — uses ADC (gcloud auth application-default login)
            _genai_client = genai.Client(
                vertexai=True,
                project=settings.google_cloud_project,
                location=settings.google_cloud_location,
            )
            logger.info("Gemini client: Vertex AI (project=%s)", settings.google_cloud_project)
        elif settings.gemini_api_key:
            # AI Studio mode — uses API key
            _genai_client = genai.Client(api_key=settings.gemini_api_key)
            logger.info("Gemini client: AI Studio (API key)")
        else:
            raise RuntimeError(
                "Set GOOGLE_CLOUD_PROJECT (for Vertex AI) or GEMINI_API_KEY (for AI Studio)"
            )
    return _genai_client


SYSTEM_PROMPT = """\
You are a voice command parser for an AR memory assistant app that helps people with memory difficulties.
The user speaks commands in Polish or English. Your job is to:
1. Transcribe the audio accurately
2. Parse the intent into a structured JSON command

Supported commands:
- add_person: Add a person visible on camera to the database
  Parameters: name (string), relationship (string, optional), notes (string, optional)
  Example voice: "To jest mój ojciec Jan. Lubi łowić ryby."
  -> {"intent": "add_person", "name": "Jan", "relationship": "ojciec", "notes": "Lubi łowić ryby"}

- add_object: Add an object visible on camera to the database
  Parameters: name (string), category (string, optional), notes (string, optional)
  Example voice: "To są moje klucze od domu"
  -> {"intent": "add_object", "name": "klucze", "category": "personal", "notes": "klucze od domu"}

- unknown: If the command doesn't match any supported intent
  -> {"intent": "unknown", "transcript": "...the transcribed text..."}

IMPORTANT:
- Always respond with valid JSON only, no markdown, no extra text
- Extract the person/object name carefully from the speech
- The "notes" field should contain any descriptive information mentioned
- The "relationship" field should capture family/social relationship (ojciec, matka, brat, siostra, przyjaciel, kolega, etc.)
- If the language is Polish, keep notes in Polish
- Return ONLY the JSON object, nothing else
"""


class VoiceService:
    """Processes voice commands via Gemini API."""

    def __init__(self, settings: Settings) -> None:
        self.settings = settings

    async def process_voice_command(
        self,
        audio_bytes: bytes,
        audio_mime: str,
        frame_bytes: bytes | None,
        db: Session,
    ) -> dict[str, Any]:
        """Process audio + optional frame through Gemini and execute the parsed command."""
        client = _get_genai_client()
        from google.genai import types

        # Build content parts
        parts = [
            types.Part.from_bytes(data=audio_bytes, mime_type=audio_mime),
        ]

        if frame_bytes:
            parts.append(
                types.Part.from_bytes(data=frame_bytes, mime_type="image/jpeg")
            )
            parts.append(
                "Transcribe the audio and parse it into a command. "
                "The image shows what the camera currently sees. "
                "Respond with JSON only."
            )
        else:
            parts.append(
                "Transcribe the audio and parse it into a command. "
                "Respond with JSON only."
            )

        response = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=parts,
            config=types.GenerateContentConfig(
                system_instruction=SYSTEM_PROMPT,
                temperature=0.1,
            ),
        )

        # Parse Gemini response
        raw_text = response.text.strip()
        # Strip markdown code fences if present
        if raw_text.startswith("```"):
            raw_text = raw_text.split("\n", 1)[1] if "\n" in raw_text else raw_text[3:]
            if raw_text.endswith("```"):
                raw_text = raw_text[:-3].strip()

        try:
            command = json.loads(raw_text)
        except json.JSONDecodeError:
            logger.warning("Gemini returned non-JSON: %s", raw_text)
            return {
                "success": False,
                "error": "Could not parse voice command",
                "transcript": raw_text,
            }

        intent = command.get("intent", "unknown")
        logger.info("Voice command parsed: intent=%s command=%s", intent, command)

        # Execute command
        if intent == "add_person":
            return await self._execute_add_person(command, frame_bytes, db)
        elif intent == "add_object":
            return await self._execute_add_object(command, frame_bytes, db)
        else:
            return {
                "success": True,
                "intent": "unknown",
                "transcript": command.get("transcript", raw_text),
                "message": "Command not recognized",
            }

    async def _execute_add_person(
        self, command: dict, frame_bytes: bytes | None, db: Session
    ) -> dict[str, Any]:
        """Create a person and enroll their face from the current frame."""
        import app.state as state

        name = command.get("name", "Unknown")
        relationship = command.get("relationship", "")
        notes = command.get("notes", "")

        # Create person in DB
        repo = PersonRepository(db)
        person = repo.create(
            name=name,
            relationship_label=relationship,
            notes=notes,
        )

        enrolled_face = False

        # If we have a frame, try to detect and enroll face
        if frame_bytes and state.face_service:
            np_arr = np.frombuffer(frame_bytes, np.uint8)
            image = cv2.imdecode(np_arr, cv2.IMREAD_COLOR)
            if image is not None:
                faces = state.face_service.detect_and_embed(image)
                if faces:
                    # Use the first (largest/most prominent) face
                    embedding = faces[0]["embedding"]
                    emb_id = str(uuid.uuid4())
                    state.face_service.add_embedding(emb_id, embedding, person.id)

                    # Save the frame as a sample photo
                    settings = get_settings()
                    person_dir = Path(settings.media_dir) / "people" / person.id
                    person_dir.mkdir(parents=True, exist_ok=True)
                    photo_name = "sample_0.jpg"
                    photo_file = person_dir / photo_name
                    photo_file.write_bytes(frame_bytes)

                    rel_path = f"people/{person.id}/{photo_name}"
                    repo.add_photo(person.id, rel_path, emb_id, sample_index=0)
                    enrolled_face = True

        return {
            "success": True,
            "intent": "add_person",
            "person_id": person.id,
            "name": name,
            "relationship": relationship,
            "notes": notes,
            "face_enrolled": enrolled_face,
            "message": f"Added {name}" + (" with face" if enrolled_face else " (no face detected)"),
        }

    async def _execute_add_object(
        self, command: dict, frame_bytes: bytes | None, db: Session
    ) -> dict[str, Any]:
        """Create an object and enroll its appearance from the current frame."""
        import app.state as state
        from app.utils.image import bytes_to_pil

        name = command.get("name", "Unknown object")
        category = command.get("category", "")
        notes = command.get("notes", "")

        repo = ObjectRepository(db)
        obj = repo.create(name=name, category=category, notes=notes)

        enrolled_appearance = False

        if frame_bytes and state.object_service:
            try:
                pil_img = bytes_to_pil(frame_bytes)
                embedding = state.object_service.compute_embedding(pil_img)
                emb_id = str(uuid.uuid4())
                state.object_service.add_embedding(emb_id, embedding, obj.id)

                # Save as sample photo
                settings = get_settings()
                obj_dir = Path(settings.media_dir) / "objects" / obj.id
                obj_dir.mkdir(parents=True, exist_ok=True)
                photo_name = "sample_0.jpg"
                photo_file = obj_dir / photo_name
                photo_file.write_bytes(frame_bytes)

                rel_path = f"objects/{obj.id}/{photo_name}"
                repo.add_photo(obj.id, rel_path, emb_id, sample_index=0)
                enrolled_appearance = True
            except Exception as exc:
                logger.warning("Failed to enroll object appearance: %s", exc)

        return {
            "success": True,
            "intent": "add_object",
            "object_id": obj.id,
            "name": name,
            "category": category,
            "notes": notes,
            "appearance_enrolled": enrolled_appearance,
            "message": f"Added {name}" + (" with photo" if enrolled_appearance else " (no photo)"),
        }
