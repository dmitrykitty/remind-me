from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.database import get_session
from app.models.tables import Task, HistoryEntry

router = APIRouter(prefix="/api/tasks", tags=["tasks"])


class TaskCreate(BaseModel):
    title: str
    due_at: str | None = None


class TaskUpdate(BaseModel):
    title: str | None = None
    done: bool | None = None
    due_at: str | None = None


class TaskOut(BaseModel):
    id: str
    title: str
    done: bool
    due_at: str | None
    created_at: str
    updated_at: str

    class Config:
        from_attributes = True


def _to_out(t: Task) -> TaskOut:
    return TaskOut(
        id=t.id,
        title=t.title,
        done=t.done,
        due_at=t.due_at.isoformat() if t.due_at else None,
        created_at=t.created_at.isoformat(),
        updated_at=t.updated_at.isoformat(),
    )


@router.get("", response_model=list[TaskOut])
def list_tasks(db: Session = Depends(get_session)):
    tasks = db.query(Task).order_by(Task.created_at.desc()).all()
    return [_to_out(t) for t in tasks]


@router.post("", response_model=TaskOut, status_code=201)
def create_task(body: TaskCreate, db: Session = Depends(get_session)):
    from datetime import datetime, timezone

    due = None
    if body.due_at:
        try:
            due = datetime.fromisoformat(body.due_at)
        except ValueError:
            pass

    task = Task(title=body.title, due_at=due)
    db.add(task)

    # Log to history
    entry = HistoryEntry(
        kind="task_added",
        title=f"Task added: {body.title}",
    )
    db.add(entry)

    db.commit()
    db.refresh(task)
    return _to_out(task)


@router.patch("/{task_id}", response_model=TaskOut)
def update_task(task_id: str, body: TaskUpdate, db: Session = Depends(get_session)):
    task = db.get(Task, task_id)
    if not task:
        raise HTTPException(404, "Task not found")

    if body.title is not None:
        task.title = body.title
    if body.done is not None:
        was_done = task.done
        task.done = body.done
        if body.done and not was_done:
            entry = HistoryEntry(
                kind="task_done",
                title=f"Task completed: {task.title}",
            )
            db.add(entry)
    if body.due_at is not None:
        from datetime import datetime
        try:
            task.due_at = datetime.fromisoformat(body.due_at)
        except ValueError:
            task.due_at = None

    db.commit()
    db.refresh(task)
    return _to_out(task)


@router.delete("/{task_id}", status_code=204)
def delete_task(task_id: str, db: Session = Depends(get_session)):
    task = db.get(Task, task_id)
    if not task:
        raise HTTPException(404, "Task not found")
    db.delete(task)
    db.commit()
