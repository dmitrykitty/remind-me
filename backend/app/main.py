from __future__ import annotations

import logging
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

import app.state as state
from app.config import get_settings
from app.core.database import init_db
from app.core.vector_store import VectorStore
from app.services.face_service import FaceService
from app.services.object_service import ObjectService
from app.services.recognition_service import RecognitionService
from app.services.room_service import RoomService
from app.services.voice_service import VoiceService

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s  %(name)s  %(message)s",
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app_instance: FastAPI):
    settings = get_settings()

    # Ensure directories
    Path(settings.data_dir).mkdir(parents=True, exist_ok=True)
    Path(settings.media_dir).mkdir(parents=True, exist_ok=True)

    # Database
    init_db()
    logger.info("Database initialised")

    # Vector store
    vector_store = VectorStore()
    state.vector_store = vector_store

    # Services (models are lazy-loaded on first call)
    face_service = FaceService(settings, vector_store)
    object_service = ObjectService(settings, vector_store)
    recognition_service = RecognitionService(face_service, object_service)

    state.face_service = face_service
    state.object_service = object_service
    state.recognition_service = recognition_service

    # Voice service (lazy — Gemini client created on first use)
    voice_service = VoiceService(settings)
    state.voice_service = voice_service

    # Room service (Fishjam volunteer calls)
    if settings.fishjam_id and settings.fishjam_management_token:
        room_service = RoomService(settings)
        state.room_service = room_service
        logger.info("Fishjam room service ready")
    else:
        logger.warning("Fishjam credentials not set — room service disabled")

    logger.info("RemindMe backend ready")
    yield
    logger.info("RemindMe backend shutting down")


def create_app() -> FastAPI:
    settings = get_settings()

    app_instance = FastAPI(
        title=settings.app_name,
        version="0.1.0",
        lifespan=lifespan,
    )

    # CORS
    app_instance.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Routes
    from app.api.routes import agent, health, history, memory, objects, people, recognition, tasks, voice
    from app.api.routes import settings as settings_routes

    app_instance.include_router(health.router)
    app_instance.include_router(people.router)
    app_instance.include_router(objects.router)
    app_instance.include_router(settings_routes.router)
    app_instance.include_router(memory.router)
    app_instance.include_router(recognition.router)
    app_instance.include_router(voice.router)
    app_instance.include_router(agent.router)
    app_instance.include_router(tasks.router)
    app_instance.include_router(history.router)

    # Static media serving
    media_path = Path(settings.media_dir)
    media_path.mkdir(parents=True, exist_ok=True)
    app_instance.mount("/media", StaticFiles(directory=str(media_path)), name="media")

    return app_instance


app = create_app()
