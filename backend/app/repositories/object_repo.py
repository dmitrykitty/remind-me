from __future__ import annotations

from sqlalchemy.orm import Session

from app.models.tables import KnownObject, KnownObjectPhoto


class ObjectRepository:
    def __init__(self, db: Session) -> None:
        self.db = db

    def list_all(self) -> list[KnownObject]:
        return (
            self.db.query(KnownObject).order_by(KnownObject.created_at.desc()).all()
        )

    def get_by_id(self, object_id: str) -> KnownObject | None:
        return (
            self.db.query(KnownObject).filter(KnownObject.id == object_id).first()
        )

    def create(
        self, name: str, category: str = "", notes: str = ""
    ) -> KnownObject:
        obj = KnownObject(name=name, category=category, notes=notes)
        self.db.add(obj)
        self.db.commit()
        self.db.refresh(obj)
        return obj

    def delete(self, object_id: str) -> bool:
        obj = self.get_by_id(object_id)
        if not obj:
            return False
        self.db.delete(obj)
        self.db.commit()
        return True

    def add_photo(
        self,
        object_id: str,
        photo_path: str,
        embedding_id: str,
        sample_index: int = 0,
    ) -> KnownObjectPhoto:
        photo = KnownObjectPhoto(
            object_id=object_id,
            photo_path=photo_path,
            embedding_id=embedding_id,
            sample_index=sample_index,
        )
        self.db.add(photo)
        self.db.commit()
        self.db.refresh(photo)
        return photo

    def count_photos(self, object_id: str) -> int:
        return (
            self.db.query(KnownObjectPhoto)
            .filter(KnownObjectPhoto.object_id == object_id)
            .count()
        )

    def delete_all(self) -> None:
        self.db.query(KnownObjectPhoto).delete()
        self.db.query(KnownObject).delete()
        self.db.commit()
