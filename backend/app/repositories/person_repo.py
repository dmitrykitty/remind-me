from __future__ import annotations

from sqlalchemy.orm import Session

from app.models.tables import Person, PersonPhoto


class PersonRepository:
    def __init__(self, db: Session) -> None:
        self.db = db

    def list_all(self) -> list[Person]:
        return self.db.query(Person).order_by(Person.created_at.desc()).all()

    def get_by_id(self, person_id: str) -> Person | None:
        return self.db.query(Person).filter(Person.id == person_id).first()

    def create(
        self, name: str, relationship_label: str = "", notes: str = ""
    ) -> Person:
        person = Person(name=name, relationship_label=relationship_label, notes=notes)
        self.db.add(person)
        self.db.commit()
        self.db.refresh(person)
        return person

    def delete(self, person_id: str) -> bool:
        person = self.get_by_id(person_id)
        if not person:
            return False
        self.db.delete(person)
        self.db.commit()
        return True

    def add_photo(
        self,
        person_id: str,
        photo_path: str,
        embedding_id: str,
        sample_index: int = 0,
    ) -> PersonPhoto:
        photo = PersonPhoto(
            person_id=person_id,
            photo_path=photo_path,
            embedding_id=embedding_id,
            sample_index=sample_index,
        )
        self.db.add(photo)
        self.db.commit()
        self.db.refresh(photo)
        return photo

    def count_photos(self, person_id: str) -> int:
        return (
            self.db.query(PersonPhoto)
            .filter(PersonPhoto.person_id == person_id)
            .count()
        )

    def delete_all(self) -> None:
        self.db.query(PersonPhoto).delete()
        self.db.query(Person).delete()
        self.db.commit()
