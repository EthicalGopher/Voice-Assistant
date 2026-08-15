# Stage 1: Build the React Frontend
FROM node:20-alpine AS frontend-builder
WORKDIR /app

# Copy package manifest & install dependencies
COPY package.json package-lock.json ./
RUN npm ci

# Copy frontend source files & build static dist bundle
COPY index.html vite.config.ts tsconfig.json tsconfig.app.json tsconfig.node.json ./
COPY src ./src
COPY public ./public
RUN npm run build

# Stage 2: Final Production Application (FastAPI + F5-TTS + Static UI)
FROM python:3.11-slim AS runner

# Install system audio & media dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    libsndfile1 \
    git \
    curl \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy Python requirements & install dependencies
COPY backend/requirements.txt ./backend/requirements.txt
RUN pip install --no-cache-dir -r backend/requirements.txt

# Copy built frontend static bundle from builder stage
COPY --from=frontend-builder /app/dist ./dist

# Copy backend application code
COPY backend ./backend

# Default Environment Variables
ENV PORT=8000
ENV HOST=0.0.0.0
ENV PYTHONPATH=/app/backend
ENV OLLAMA_HOST=http://ollama:11434
ENV OLLAMA_MODEL=llama3.2

WORKDIR /app/backend

EXPOSE 8000

# Start FastAPI server
CMD ["python", "-m", "uvicorn", "server:app", "--host", "0.0.0.0", "--port", "8000"]
