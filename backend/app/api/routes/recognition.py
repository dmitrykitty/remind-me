from __future__ import annotations

import asyncio
import base64
import json
import logging

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

import app.state as state
from app.core.database import get_session_sync
from app.repositories.settings_repo import SettingsRepository

logger = logging.getLogger(__name__)
router = APIRouter()


def _process_frame_sync(frame_bytes: bytes) -> dict:
    """Run recognition pipeline in a worker thread (blocking)."""
    if not state.recognition_service:
        return {"faces": [], "objects": [], "error": "Recognition service not ready"}

    db = get_session_sync()
    try:
        repo = SettingsRepository(db)
        app_settings = repo.get()
        settings_dict = {
            "face_distance_threshold": app_settings.face_distance_threshold,
            "object_distance_threshold": app_settings.object_distance_threshold,
            "face_recognition_enabled": app_settings.face_recognition_enabled,
            "object_recognition_enabled": app_settings.object_recognition_enabled,
        }
        result = state.recognition_service.process_frame(frame_bytes, db, settings_dict)
        return result.model_dump()
    finally:
        db.close()


@router.websocket("/ws/recognize")
async def websocket_recognize(websocket: WebSocket):
    await websocket.accept()
    logger.info("Recognition WebSocket connected")

    processing = False

    try:
        while True:
            raw = await websocket.receive_text()

            try:
                data = json.loads(raw)
            except json.JSONDecodeError:
                continue

            if data.get("type") != "frame":
                continue

            if processing:
                # Drop frame — still busy with previous one
                continue

            processing = True
            try:
                frame_b64 = data.get("data", "")
                frame_bytes = base64.b64decode(frame_b64)

                result = await asyncio.to_thread(_process_frame_sync, frame_bytes)
                await websocket.send_json(result)

            except Exception as exc:
                logger.error("Frame processing error: %s", exc, exc_info=True)
                await websocket.send_json(
                    {"faces": [], "objects": [], "error": str(exc)}
                )
            finally:
                processing = False

    except WebSocketDisconnect:
        logger.info("Recognition WebSocket disconnected")
    except Exception as exc:
        logger.error("WebSocket unexpected error: %s", exc, exc_info=True)
