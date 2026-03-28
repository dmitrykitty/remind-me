from __future__ import annotations

from sqlalchemy.orm import Session

from app.models.tables import AppSettings


class SettingsRepository:
    def __init__(self, db: Session) -> None:
        self.db = db

    def get(self) -> AppSettings:
        settings = self.db.query(AppSettings).filter(AppSettings.id == 1).first()
        if not settings:
            settings = AppSettings()
            self.db.add(settings)
            self.db.commit()
            self.db.refresh(settings)
        return settings

    def update(self, **kwargs: object) -> AppSettings:
        settings = self.get()
        for key, value in kwargs.items():
            if value is not None and hasattr(settings, key):
                setattr(settings, key, value)
        self.db.commit()
        self.db.refresh(settings)
        return settings
