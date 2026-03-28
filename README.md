# RemindMe — AR Memory Assistant PoC

A camera-first web application that helps people with memory difficulties by recognising enrolled faces and known objects in real-time, showing lightweight AR-style overlays with contextual information.

---

## Quick Start

### Prerequisites

| Tool | Version |
|------|---------|
| Python | 3.11 + |
| [uv](https://docs.astral.sh/uv/) | latest |
| Node.js | 18 + |
| npm / pnpm | any |

A webcam (or phone camera via browser) is required for the live demo.

### 1. Backend

```bash
cd backend
uv sync                                   # creates venv + installs deps
uv run uvicorn app.main:app --reload      # starts on http://localhost:8000
```

> **First run note:** The first recognition frame will trigger model downloads  
> (Facenet512 ≈ 90 MB, CLIP ViT-B/32 ≈ 350 MB). Subsequent starts are instant.

### 2. Frontend

```bash
cd frontend
npm install
npm run dev            # starts on http://localhost:5173
```

Open **http://localhost:5173** in Chrome/Edge. Grant camera access when prompted.

---

## Architecture

```
┌─────────────────────────────────────────────────┐
│  Browser (React + TS + Tailwind + Framer Motion)│
│  ┌────────────┐  ┌──────────┐  ┌─────────────┐ │
│  │ Camera View │  │ Overlays │  │ Panels/Modal│ │
│  └─────┬──────┘  └────▲─────┘  └──────┬──────┘ │
│        │  JPEG frames  │  results      │ REST   │
│        ▼               │               ▼        │
│  ┌─────────────────────┴──────────────────────┐ │
│  │        WebSocket /ws/recognize             │ │
│  │        REST API   /api/*                   │ │
│  └────────────────────┬───────────────────────┘ │
└───────────────────────┼─────────────────────────┘
                        │
┌───────────────────────┼─────────────────────────┐
│  FastAPI Backend      │                         │
│  ┌────────────────────▼────────────────────┐    │
│  │         Recognition Service             │    │
│  │  ┌──────────────┐ ┌──────────────────┐  │    │
│  │  │ Face Service  │ │ Object Service   │  │    │
│  │  │ (DeepFace)    │ │ (CLIP)           │  │    │
│  │  └──────┬───────┘ └────────┬─────────┘  │    │
│  └─────────┼──────────────────┼────────────┘    │
│            ▼                  ▼                  │
│  ┌──────────────────────────────────────────┐   │
│  │        Vector Store (ChromaDB)           │   │
│  │  face_embeddings  │  object_embeddings   │   │
│  └──────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────┐   │
│  │     Metadata DB (SQLite)                 │   │
│  │  people · person_photos                  │   │
│  │  known_objects · known_object_photos     │   │
│  │  app_settings                            │   │
│  └──────────────────────────────────────────┘   │
└─────────────────────────────────────────────────┘
```

### Key Decisions

| Decision | Rationale |
|----------|-----------|
| **ChromaDB** for vectors | Local, persistent, cosine HNSW search, Python-native. Zero config vs Faiss (which needs manual persistence) |
| **DeepFace / Facenet512** for faces | Proven 512-dim face embeddings with built-in detection. `enforce_detection=False` allows graceful no-face frames |
| **CLIP ViT-B/32** for objects | Produces robust image embeddings suitable for few-shot known-item matching. Not generic detection — enrollment → match only |
| **WebSocket** for live recognition | Simplest bidirectional transport; client controls frame rate; server drops frames while busy |
| **SQLite** for metadata | Single-file, zero-config, perfect for local PoC |
| **Frame throttling on client** | Default 1.5 s interval avoids overloading the backend and keeps latency human-friendly |

---

## Project Structure

```
remindme/
├── backend/
│   ├── pyproject.toml
│   ├── app/
│   │   ├── main.py              # FastAPI app + lifespan
│   │   ├── config.py            # Pydantic Settings
│   │   ├── state.py             # Singleton service references
│   │   ├── api/routes/
│   │   │   ├── health.py
│   │   │   ├── people.py        # CRUD + sample upload
│   │   │   ├── objects.py       # CRUD + sample upload
│   │   │   ├── settings.py      # Runtime settings
│   │   │   ├── memory.py        # Full reset
│   │   │   └── recognition.py   # WebSocket handler
│   │   ├── core/
│   │   │   ├── database.py      # SQLAlchemy engine + session
│   │   │   └── vector_store.py  # ChromaDB wrapper
│   │   ├── models/tables.py     # ORM models
│   │   ├── schemas/             # Pydantic request/response DTOs
│   │   ├── repositories/        # DB CRUD per entity
│   │   ├── services/
│   │   │   ├── face_service.py
│   │   │   ├── object_service.py
│   │   │   └── recognition_service.py
│   │   └── utils/image.py
│   └── data/                    # Runtime: DB, ChromaDB, media
├── frontend/
│   ├── package.json
│   ├── vite.config.ts
│   └── src/
│       ├── App.tsx
│       ├── api/                 # REST + types
│       ├── hooks/               # useCamera, useRecognition
│       └── components/          # CameraView, Overlays, Panels, Modals
└── README.md
```

---

## API Reference

### REST Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/health` | Health check |
| GET | `/api/settings` | Get app settings |
| PUT | `/api/settings` | Update app settings |
| GET | `/api/people` | List enrolled people |
| POST | `/api/people` | Create person |
| GET | `/api/people/{id}` | Get person details |
| DELETE | `/api/people/{id}` | Delete person + embeddings |
| POST | `/api/people/{id}/samples` | Upload face photos |
| GET | `/api/objects` | List enrolled objects |
| POST | `/api/objects` | Create object |
| GET | `/api/objects/{id}` | Get object details |
| DELETE | `/api/objects/{id}` | Delete object + embeddings |
| POST | `/api/objects/{id}/samples` | Upload object photos |
| POST | `/api/memory/reset` | Clear all data |

### WebSocket

| Path | Direction | Payload |
|------|-----------|---------|
| `/ws/recognize` | Client → Server | `{ "type": "frame", "data": "<base64 JPEG>" }` |
| `/ws/recognize` | Server → Client | `{ "faces": [...], "objects": [...], "frame_width": N, "frame_height": N, "processing_ms": N }` |

---

## Recognition Pipelines

### Face Recognition
1. Client captures video frame → scales to ≤640 px wide → base64 JPEG → WebSocket
2. Server decodes → DeepFace detects faces + computes Facenet512 embeddings
3. Each embedding → cosine nearest-neighbor query in ChromaDB `face_embeddings`
4. Best match under distance threshold → attach person metadata → return with bounding box
5. Client scales bounding box from frame coords to screen coords → renders overlay

### Object / Item Recognition
1. Same frame → converted to PIL Image
2. CLIP ViT-B/32 encodes full frame → 512-dim embedding
3. Cosine nearest-neighbor query in ChromaDB `object_embeddings`
4. Best match under distance threshold → attach object metadata → return
5. Client shows floating notification pill (no bounding box — CLIP is frame-level)

> **Important:** Object recognition matches the *entire frame* against enrolled close-up photos. It works best when the enrolled object is the dominant subject. This is a PoC limitation — a production system would add an object detector (e.g. YOLOv8) for localisation before embedding.

---

## Configuration

All settings can be adjusted at runtime via the Settings panel or the `/api/settings` endpoint.

| Setting | Default | Description |
|---------|---------|-------------|
| `face_distance_threshold` | 0.35 | Max cosine distance for face match (lower = stricter) |
| `object_distance_threshold` | 0.40 | Max cosine distance for object match |
| `frame_interval_ms` | 1500 | Client-side frame capture interval |
| `face_recognition_enabled` | true | Toggle face pipeline |
| `object_recognition_enabled` | true | Toggle object pipeline |

Static configuration via environment variables (`.env` or shell):

| Variable | Default |
|----------|---------|
| `FACE_MODEL` | Facenet512 |
| `FACE_DETECTOR` | opencv |
| `CLIP_MODEL` | clip-ViT-B-32 |
| `DEBUG` | true |

---

## Demo Flow

1. **Start backend + frontend** (see Quick Start)
2. **Enroll a person:** Click ＋ → Add Person → capture 1-3 photos of a face → fill name + relationship → Save
3. **Recognise face:** Point camera at the enrolled person → overlay appears with name, relationship, notes
4. **Enroll an object:** Click ＋ → Add Object → capture 1-3 close-up photos → fill name + category → Save
5. **Recognise object:** Point camera at the enrolled item → floating pill overlay appears
6. **Manage memory:** Click 🧠 → browse enrolled people/objects → delete entries
7. **Adjust settings:** Click ⚙️ → tweak thresholds, toggle pipelines, clear all memory

---

## Known Limitations

- **Object localisation:** CLIP matches the full frame — no bounding boxes for detected objects. Works best when the target object fills most of the frame.
- **First-frame latency:** Model loading on the first recognition frame takes 10-30 seconds (cached after that).
- **Single-threaded processing:** Only one frame processed at a time; others are dropped. Acceptable for the 1.5 s interval.
- **No GPU acceleration by default:** Runs on CPU. GPU support depends on the installed TensorFlow / PyTorch CUDA builds.
- **No authentication:** Open access — intended for local demo only.
- **Face detection can be noisy:** With `enforce_detection=False`, DeepFace may return low-quality embeddings from non-face regions. The 0.50 confidence filter mitigates this.
- **No WebSocket reconnection:** If the backend restarts, the page must be refreshed.

---

## Future Roadmap

The architecture is intentionally prepared for these extensions without rewriting the core:

| Feature | Integration Point |
|---------|-------------------|
| **Gemini Pro Live API** | New service under `app/services/assistant_service.py` orchestrating tool calls. Recognition results feed into Gemini context. |
| **Whisper voice input** | Add audio capture in frontend, stream to a new `/ws/audio` endpoint, pipe to Whisper service. |
| **Command mode** | Parse Whisper transcripts → structured intents → route to skills (enroll, query memory, etc.) |
| **Ambient summarisation** | Buffer recognition events → periodic Gemini summarisation → store in a `conversation_log` table. |
| **Skills / tool execution** | `skills-lock.json` defines available tools. Assistant service resolves and invokes them. |
| **Object detection + localisation** | Add YOLOv8/RT-DETR before CLIP embedding to get bounding boxes for objects. |
| **Multi-device / cloud** | Swap SQLite → PostgreSQL, ChromaDB → managed vector DB, add auth middleware. |

---

## License

Hackathon project — not licensed for production use.
