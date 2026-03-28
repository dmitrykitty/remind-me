from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.database import get_session
from app.repositories.settings_repo import SettingsRepository
from app.schemas.settings import AppSettingsOut, AppSettingsUpdate

router = APIRouter(prefix="/api/settings", tags=["settings"])


@router.get("", response_model=AppSettingsOut)
def get_settings(db: Session = Depends(get_session)):
    return SettingsRepository(db).get()


@router.put("", response_model=AppSettingsOut)
def update_settings(body: AppSettingsUpdate, db: Session = Depends(get_session)):
    return SettingsRepository(db).update(**body.model_dump(exclude_none=True))
