# 🎙️ Aria AI Voice Assistant

A futuristic, full-stack AI Voice Assistant featuring a dynamic **3D Liquid Neural Orb** (built with Three.js / React Three Fiber), local LLM inference powered by **Ollama (`llama3.2`)**, and high-fidelity neural voice synthesis powered by **F5-TTS**.

---

## ✨ Features

- 🌊 **3D Liquid Neural Orb**: Dynamic shader orb modulated in real time by speech volume and vocal pitch autocorrelation ($r_1, r_2, r_3$ multi-harmonic ripples).
- 🧠 **Local LLM Engine**: Connected to Ollama (`llama3.2`) for fast, local conversational intelligence.
- 🗣️ **F5-TTS Voice Synthesis & Voice Cloning**: Zero-shot neural voice cloning with custom reference audio upload support (`/api/tts` & `/api/upload_reference`).
- 🎙️ **Push-to-Talk & Silence Detection**: Hold the **'M' key** to record speech; release 'M' to automatically process and speak the response. Also supports continuous silence auto-submit.
- 🐳 **Multi-Container Docker Architecture**: Includes pre-configured Docker Compose with automatic model pulling (`ollama-init`) and HuggingFace cache volume persistence.

---

## 🛠️ Prerequisites

- **Node.js**: `v20.0.0+`
- **npm**: `v10.0.0+`
- **Python**: `v3.10` or `v3.11` (with `pip` and virtual environment)
- **Docker & Docker Compose** *(Optional, for containerized execution)*
- **Ollama** *(Optional, if running natively outside Docker)*

---

## 📦 Installation & Setup

### 1. Clone the Repository
```bash
git clone https://github.com/EthicalGopher/Voice-Assistant.git
cd Voice-Assistant
```

### 2. Install Dependencies
You can install both Node.js and Python dependencies automatically with `make`:

```bash
make install
```

*Or install them manually:*

```bash
# Install Frontend (Node) dependencies
npm install

# Install Backend (Python) dependencies
python3 -m pip install -r backend/requirements.txt
```

---

## 🚀 Running Locally

### Option A: Using `make` (Recommended)

Start the Python FastAPI backend in the background and launch the Vite React dev server:

```bash
make dev
```
Open **`http://localhost:5173`** in your browser.

- To stop all local processes:
  ```bash
  make stop
  ```

---

### Option B: Docker Compose (Single Command Launch)

Launch the full stack (**React Frontend + Python FastAPI Backend + Ollama LLM + Auto Model Puller**):

```bash
make docker-up
```
Or directly using Docker Compose:
```bash
docker compose up --build -d
```

- **Frontend UI**: `http://localhost:5173`
- **FastAPI Backend**: `http://localhost:8000`
- **Ollama Engine**: `http://localhost:11434`

To view container logs or stop the stack:
```bash
make docker-logs   # View live logs
make docker-down   # Stop all containers
```

---

## 📋 Makefile Commands Reference

| Command | Category | Description |
| :--- | :--- | :--- |
| `make install` | **Setup** | Installs both frontend (`npm install`) and backend (`pip install`) dependencies. |
| `make install-frontend` | **Setup** | Installs Node.js packages for the React UI. |
| `make install-backend` | **Setup** | Installs Python requirements for FastAPI and F5-TTS. |
| `make dev` / `make start` | **Execution** | Starts the backend server in the background and launches Vite dev server in the foreground. |
| `make stop` | **Execution** | Gracefully terminates background backend and frontend processes. |
| `make restart` | **Execution** | Restarts the background backend and launches the dev server. |
| `make backend-bg` | **Backend** | Starts the FastAPI backend daemon in the background (PID: `.backend.pid`, Logs: `backend.log`). |
| `make backend-stop` | **Backend** | Stops the background FastAPI server daemon. |
| `make backend-status` | **Backend** | Checks FastAPI backend `/health` endpoint status. |
| `make backend-logs` | **Backend** | Tails the background backend log file (`tail -f backend.log`). |
| `make backend` | **Backend** | Runs the backend server directly in the foreground. |
| `make frontend` | **Frontend** | Runs the Vite frontend development server in the foreground. |
| `make build` | **Build** | Type-checks and compiles the production bundle (`dist/`). |
| `make lint` | **Quality** | Runs ESLint on the codebase. |
| `make share` | **Sharing** | Prepares static build & backend daemon for sharing via tunnel (Ngrok / Localtunnel). |
| `make docker-up` | **Docker** | Builds and launches all multi-container Docker services. |
| `make docker-down` | **Docker** | Stops all running Docker Compose containers. |
| `make docker-logs` | **Docker** | Tails live logs from all Docker Compose services. |
| `make clean` | **Maintenance** | Removes temporary log files, PIDs, `dist/`, and `__pycache__`. |

---

## ⌨️ Keyboard Shortcuts

| Key | Action |
| :--- | :--- |
| **Hold `M`** | **Push-to-Talk**: Record microphone input while holding; release `M` to send to AI. |
| **`Spacebar`** | Toggle continuous microphone recording session. |
| **`K`** | Open typed directive text modal. |
| **`S`** | Toggle sound effects / mute audio. |
| **`Esc`** | Close active modals / stop voice session. |

---

## 🌐 Sharing with Friends (Tunneling)

To share your AI assistant with friends over the internet using Ngrok or Localtunnel:

```bash
make share
```

Then run your preferred tunneling tool:
```bash
ngrok http 8000
# OR
npx localtunnel --port 8000
```
Send the generated `https://...` link to your friends!

---

## 📜 License

Distributed under the MIT License. See `LICENSE` for more information.
