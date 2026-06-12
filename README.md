# ⚡ Aria — Multi-Agent Live Debate Platform

> **🎬 Demo video:** [Watch on Google Drive](https://drive.google.com/drive/folders/1DLB--kwo3p7-ElnoKgqU4q79OUZWKhN6?usp=sharing)  

**Aria** is a real-time, multi-agent debate engine. Three AI agents — Advocate, Critic, and Judge — research a topic on the web, argue in structured rounds, stream their reasoning live over WebSockets, and deliver a scored verdict with citations.

Drop any motion. Watch the argument unfold. Optionally step into the debate yourself.

```
🔴 Advocate  →  researches + argues FOR the motion
🔵 Critic    →  researches + argues AGAINST the motion
⚖️  Judge     →  scores evidence & logic, delivers verdict
```

---

## Features

| Feature | Description |
|---|---|
| **Live multi-agent debates** | Advocate and Critic alternate in 1–4 configurable rounds; Judge evaluates the full transcript |
| **Real-time streaming** | Token-by-token output over WebSockets (Django Channels) |
| **Web-grounded arguments** | Tavily search injects live sources; inline `[1]` citation badges link to evidence |
| **Topic intelligence** | AI-powered topic suggestions and auto-improvement of vague motions |
| **Interactive mode** *(logged in)* | After Round 1, pick a side and write your thoughts — both agents read your text and try to convince you |
| **Text-to-speech** | Per-bubble voice playback with live word highlighting (browser Web Speech API) |
| **Share & export** | Copy a shareable debate link; download a PDF transcript when complete |
| **User accounts** | Email/password auth + Google OAuth; JWT sessions with refresh tokens |
| **Debate history** | Signed-in users save and revisit past debates |
| **Scoreboard** | Judge scores evidence quality and logical coherence (0–10) for each side |

---

## Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | React 18, TypeScript, Vite, Tailwind CSS, React Router |
| **Backend** | Django 5, Django REST Framework |
| **Auth** | django-allauth (Google OAuth), SimpleJWT (access + refresh) |
| **Realtime** | Django Channels + Redis (WebSocket per agent) |
| **Task queue** | Celery + Redis (debate orchestration) |
| **AI orchestration** | LangGraph (Advocate, Critic, Judge agent graphs) |
| **LLM** | OpenRouter — `meta-llama/llama-3.3-70b-instruct` |
| **Web search** | Tavily API (advanced search, up to 5 results per turn) |
| **Database** | PostgreSQL |
| **Deployment** | Docker Compose (Postgres, Redis, backend, Celery, frontend) |

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  React SPA  (DebatePage, Auth, History)                     │
│  • WebSocket client per agent (advocate / critic / judge)   │
│  • JWT in localStorage, OAuth callback token exchange       │
└──────────────────────────┬──────────────────────────────────┘
                           │ REST + WebSocket
┌──────────────────────────▼──────────────────────────────────┐
│  Django + DRF + Channels (ASGI via Uvicorn)                 │
│  • Debate CRUD, auth, stance API                            │
│  • WebSocket consumers stream tokens / citations / scores     │
└──────────────────────────┬──────────────────────────────────┘
                           │ Celery task dispatch
┌──────────────────────────▼──────────────────────────────────┐
│  Celery Worker                                              │
│  run_debate → [Round 1..N: Advocate → Critic] → Judge       │
│  continue_debate → (interactive mode after user stance)      │
│                                                             │
│  LangGraph agents: search (Tavily) → argue (stream LLM)     │
└──────────────────────────┬──────────────────────────────────┘
                           │
              PostgreSQL  ·  Redis (Channels + Celery broker)
```

### Debate pipeline

1. User submits a topic and round count (1–4).
2. `POST /api/debates/` creates a `Debate` record and enqueues `run_debate`.
3. Frontend opens three WebSockets: `ws/debate/<id>/advocate/`, `.../critic/`, `.../judge/`.
4. Each round: **Advocate turn** → **Critic turn** (sequential, with full prior context).
5. **Interactive mode**: after Round 1, debate pauses; user submits side + written thoughts via `POST /api/debates/<id>/stance/`; `continue_debate` resumes with personalized prompts (max ~120 words per agent turn).
6. **Judge** reads the full transcript, streams analysis, and pushes scores + verdict.
7. Debate status moves: `pending` → `running` → `judging` → `completed`.

---

## Project Structure

```
aria/
├── frontend/                 # React + TypeScript SPA
│   └── src/
│       ├── pages/            # DebatePage, AuthPage, HistoryPage, …
│       ├── components/       # DebateThread, TopicInput, StancePanel, …
│       ├── hooks/            # useDebateSocket, useSpeech
│       ├── context/          # AuthContext (JWT persistence)
│       └── lib/              # axios API client
├── backend/
│   ├── aria/                 # Django project settings, ASGI, Celery
│   ├── accounts/             # Register, login, Google OAuth JWT exchange
│   ├── debates/              # Models, REST API, WebSocket consumers, PDF export
│   └── agents/               # LangGraph graphs (advocate, critic, judge), Celery tasks
├── docs/
│   └── Aria_Project_Report.pdf   # Project report (vision, tech, use cases)
├── scripts/
│   └── generate_project_report.py
└── docker-compose.yml
```

---

## Prerequisites

- **Python** 3.12+
- **Node.js** 20+
- **PostgreSQL** (local or Docker)
- **Redis** (`redis-server` or Docker)
- **OpenRouter API key** ([openrouter.ai](https://openrouter.ai))
- **Tavily API key** ([tavily.com](https://tavily.com)) — web search for agents
- **Google OAuth credentials** *(optional)* — for “Continue with Google”

---

## Local Setup

### 1. Environment variables

**Backend** — copy and fill in `backend/.env`:

```bash
cd backend
cp .env.example .env
```

| Variable | Required | Description |
|---|---|---|
| `SECRET_KEY` | Yes | Django secret key |
| `DB_*` | Yes | PostgreSQL connection |
| `REDIS_URL` | Yes | Redis for Channels |
| `CELERY_BROKER_URL` | Yes | Celery broker (Redis) |
| `CELERY_RESULT_BACKEND` | Yes | Celery results (Redis) |
| `OPENROUTER_API_KEY` | Yes | LLM API key |
| `TAVILY_API_KEY` | Yes | Web search for agents |
| `CORS_ALLOWED_ORIGINS` | Yes | e.g. `http://localhost:5173` |
| `FRONTEND_URL` | OAuth | e.g. `http://localhost:5173` |
| `GOOGLE_CLIENT_ID` | OAuth | Google Cloud OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | OAuth | Google Cloud OAuth secret |

**Frontend** — copy `frontend/.env.example` to `frontend/.env` (defaults work for local dev).

**Google OAuth setup:** Add authorized redirect URI  
`http://localhost:8000/accounts/google/login/callback/` in Google Cloud Console.

### 2. Backend

```bash
cd backend
python -m venv venv
source venv/bin/activate          # Windows: venv\Scripts\activate
pip install -r requirements.txt
python manage.py migrate
uvicorn aria.asgi:application --host 0.0.0.0 --port 8000 --reload
```

### 3. Celery worker *(new terminal)*

```bash
cd backend
source venv/bin/activate
celery -A aria worker --loglevel=info --concurrency=4
```

### 4. Frontend *(new terminal)*

```bash
cd frontend
npm install
npm run dev
```

Open **http://localhost:5173**

---

## Docker

```bash
cp backend/.env.example backend/.env   # fill in API keys
docker-compose up --build
```

| Service | Port |
|---|---|
| Frontend | 5173 |
| Backend API + WebSocket | 8000 |
| PostgreSQL | 5433 |
| Redis | 6380 |

---

## API Reference

### Debates

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `POST` | `/api/debates/` | Optional | Create debate. Body: `{ topic, num_rounds, interactive_mode? }` |
| `GET` | `/api/debates/` | Required | List user's debates |
| `GET` | `/api/debates/<id>/` | — | Get debate + agent outputs |
| `POST` | `/api/debates/<id>/stance/` | Required | Submit stance: `{ stance, thought? }` |
| `GET` | `/api/debates/<id>/export/` | — | Download PDF transcript (completed debates) |
| `GET` | `/api/debates/suggestions/` | — | Curated topic suggestions |
| `POST` | `/api/debates/improve-topic/` | — | AI topic rewrite |

### Accounts

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/accounts/register/` | Email registration → JWT |
| `POST` | `/api/accounts/login/` | Email login → JWT |
| `POST` | `/api/accounts/logout/` | Blacklist refresh token |
| `GET` | `/api/accounts/me/` | Current user profile |
| `POST` | `/api/accounts/token/refresh/` | Refresh access token |
| `GET` | `/api/accounts/google/status/` | Check if Google OAuth is configured |
| `POST` | `/api/accounts/google/token/` | Exchange OAuth token for JWT |
| `GET` | `/accounts/google/login/` | Start Google OAuth flow |

### WebSocket

```
ws://localhost:8000/ws/debate/<debate_id>/<advocate|critic|judge>/
```

**Message types:** `connected`, `round_start`, `status`, `token`, `citation`, `score`, `done`, `error`

---

## Real-World Use Cases

- **IRMUN & G-Summit conferences** — delegates and startup teams argue motions while Aria scrapes the web for live sources, counter-arguments, and an impartial judge scorecard — no manual research sprint required.
- **Classroom & moot court prep** — students practice rebuttals against an AI critic with cited sources.
- **Policy & boardrooms** — stress-test decisions before meetings with adversarial AI analysis.
- **Media & journalism** — explore both sides of a story with linked evidence.
- **Startup pitch practice** — founders defend their thesis; the Critic simulates investor objections.

Full write-up: **[docs/Aria_Project_Report.pdf](docs/Aria_Project_Report.pdf)**

Regenerate after edits: `pip install reportlab && python scripts/generate_project_report.py`

---

## License
MIT — see repository for details.

---

<p align="center">
  Built with LangGraph · Django Channels · React<br/>
  <strong>Aria</strong> — where AI agents argue so humans decide smarter.
</p>
