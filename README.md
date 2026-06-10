# ⚡ Aria — Multi-Agent Live Debate Engine

Three LangGraph agents argue any topic in real time over WebSockets.

```
🔴 Advocate  →  researches + argues FOR
🔵 Critic    →  researches + argues AGAINST  (run in parallel)
⚖️  Judge     →  scores both, delivers cited verdict
```

---

## Stack

| Layer | Tech |
|---|---|
| Frontend | React + TypeScript + Tailwind (Vite) |
| Backend | Django 5 + DRF |
| Realtime | Django Channels + Redis |
| Async | Celery + Redis |
| AI Agents | LangGraph + OpenAI gpt-4o-mini |
| Database | PostgreSQL |

---

## Local Setup (3 commands)

### Prerequisites
- Python 3.12+
- Node 20+
- PostgreSQL running locally
- Redis running locally (`redis-server`)
- OpenAI API key

### 1. Backend

```bash
cd backend
cp .env.example .env          # fill in OPENAI_API_KEY + DB creds
python -m venv venv
source venv/bin/activate       # Windows: venv\Scripts\activate
pip install -r requirements.txt
python manage.py migrate
python manage.py runserver 0.0.0.0:8000   # ASGI via uvicorn recommended:
# uvicorn aria.asgi:application --host 0.0.0.0 --port 8000 --reload
```

### 2. Celery worker (new terminal)

```bash
cd backend
source venv/bin/activate
celery -A aria worker --loglevel=info --concurrency=4
```

### 3. Frontend (new terminal)

```bash
cd frontend
cp .env.example .env
npm install
npm run dev
```

Open **http://localhost:5173**

---

## Docker (alternative)

```bash
cp backend/.env.example backend/.env   # fill in OPENAI_API_KEY
docker-compose up --build
```

---

## Architecture

```
React + TypeScript  (3-panel live UI)
       ↕  WebSocket  (Django Channels — one channel per agent)
Django + DRF  (REST API, debate sessions)
       ↕
Celery + Redis  (parallel agent execution)
  ├── Advocate task  (LangGraph + DuckDuckGo search)
  ├── Critic task    (LangGraph + DuckDuckGo search)
  └── Judge task     (scores + verdict after rebuttal)
       ↕
PostgreSQL  (debate history, scores, citations)
```

---

## API

| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/debates/` | Create debate + fire agents |
| GET | `/api/debates/` | List all debates |
| GET | `/api/debates/<id>/` | Get debate with outputs |
| GET | `/api/debates/suggestions/` | Topic suggestions |

**WebSocket:** `ws://localhost:8000/ws/debate/<id>/<advocate\|critic\|judge>/`

---

