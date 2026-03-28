from pathlib import Path
from functools import lru_cache

from pydantic_settings import BaseSettings

_BASE_DIR = Path(__file__).resolve().parent.parent


class Settings(BaseSettings):
    """Application configuration. Override via .env or environment variables."""

    app_name: str = "RemindMe"
    debug: bool = True

    # --- paths (relative to backend/) ---
    data_dir: str = str(_BASE_DIR / "data")
    media_dir: str = str(_BASE_DIR / "data" / "media")
    db_url: str = f"sqlite:///{_BASE_DIR / 'data' / 'remindme.db'}"
    chroma_dir: str = str(_BASE_DIR / "data" / "chroma")

    # --- face recognition ---
    face_model: str = "Facenet512"
    face_detector: str = "opencv"
    face_distance_threshold: float = 0.35

    # --- object recognition (CLIP) ---
    clip_model: str = "clip-ViT-B-32"
    object_distance_threshold: float = 0.25

    # --- recognition behaviour ---
    max_faces_per_frame: int = 5
    face_recognition_enabled: bool = True
    object_recognition_enabled: bool = True

    # --- CORS ---
    cors_origins: list[str] = ["http://localhost:5173", "http://localhost:3000"]

    # --- Gemini API (Vertex AI) ---
    gemini_api_key: str = ""
    google_cloud_project: str = ""
    google_cloud_location: str = "us-central1"

    # --- Fishjam ---
    fishjam_id: str = ""
    fishjam_management_token: str = ""

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}


@lru_cache
def get_settings() -> Settings:
    return Settings()
