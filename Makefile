SHELL := /bin/bash
.DEFAULT_GOAL := help

ROOT_DIR := $(shell pwd)
PID_FILE := $(ROOT_DIR)/.backend.pid
LOG_FILE := $(ROOT_DIR)/backend.log
BACKEND_DIR := $(ROOT_DIR)/backend
BACKEND_PORT := 8000
FRONTEND_PORT := 5173
PYTHON ?= $(shell which python3 || echo python3)

.PHONY: help dev start stop restart backend backend-bg backend-stop backend-status backend-logs frontend install install-frontend install-backend build lint clean

## Show available Makefile commands
help:
	@echo ""
	@echo "AI Voice Assistant - Make Commands"
	@echo "==================================="
	@echo "  make dev            Start backend in background (if not running) and frontend in foreground"
	@echo "  make start          Alias for 'make dev'"
	@echo "  make stop           Stop both background backend and frontend dev servers"
	@echo "  make restart        Restart backend background server and launch frontend"
	@echo ""
	@echo "Backend Commands:"
	@echo "  make backend-bg     Start backend server in the background (saves PID to $(PID_FILE))"
	@echo "  make backend-stop   Stop background backend server"
	@echo "  make backend-status Check backend health status"
	@echo "  make backend-logs   Tail background backend log file ($(LOG_FILE))"
	@echo "  make backend        Run backend server in foreground"
	@echo ""
	@echo "Frontend Commands:"
	@echo "  make frontend       Run frontend Vite dev server in foreground"
	@echo "  make build          Build production bundle (TypeScript + Vite)"
	@echo "  make lint           Run ESLint linter"
	@echo ""
	@echo "Setup & Maintenance:"
	@echo "  make install        Install both frontend and backend dependencies"
	@echo "  make clean          Clean build artifacts, pid files, and logs"
	@echo ""

## Start backend in background, then run frontend in foreground
dev: backend-bg
	@echo ""
	@echo "⚡ Starting Frontend Dev Server..."
	@echo "---------------------------------"
	@npm run dev

start: dev

## Start backend server in the background
backend-bg:
	@if [ -f "$(PID_FILE)" ] && kill -0 $$(cat "$(PID_FILE)") 2>/dev/null; then \
		echo "✅ Backend is already running in background (PID: $$(cat "$(PID_FILE)"))"; \
	elif curl -s http://localhost:$(BACKEND_PORT)/health >/dev/null 2>&1; then \
		echo "✅ Backend is already running on port $(BACKEND_PORT)"; \
	else \
		echo "🚀 Starting F5-TTS Backend in background on port $(BACKEND_PORT)..."; \
		(cd "$(BACKEND_DIR)" && nohup $(PYTHON) -m uvicorn server:app --host 0.0.0.0 --port $(BACKEND_PORT) > "$(LOG_FILE)" 2>&1 & echo $$! > "$(PID_FILE)"); \
		for i in 1 2 3 4 5; do \
			if curl -s http://localhost:$(BACKEND_PORT)/health >/dev/null 2>&1; then \
				break; \
			fi; \
			sleep 0.5; \
		done; \
		if [ -f "$(PID_FILE)" ] && kill -0 $$(cat "$(PID_FILE)") 2>/dev/null; then \
			echo "✅ Backend started successfully (PID: $$(cat "$(PID_FILE)"))"; \
			echo "   Health check: http://localhost:$(BACKEND_PORT)/health"; \
			echo "   Logs: $(LOG_FILE)"; \
		else \
			echo "⚠️ Backend did not respond. Check $(LOG_FILE):"; \
			tail -n 15 "$(LOG_FILE)" 2>/dev/null || true; \
		fi; \
	fi

## Stop backend background server
backend-stop:
	@echo "🛑 Stopping Backend server..."
	@if [ -f "$(PID_FILE)" ]; then \
		PID=$$(cat "$(PID_FILE)"); \
		if kill -0 $$PID 2>/dev/null; then \
			kill $$PID 2>/dev/null || true; \
			sleep 0.5; \
			if kill -0 $$PID 2>/dev/null; then \
				kill -9 $$PID 2>/dev/null || true; \
			fi; \
			echo "✅ Backend (PID: $$PID) stopped."; \
		else \
			echo "ℹ️ Process $$PID not running."; \
		fi; \
		rm -f "$(PID_FILE)"; \
	else \
		echo "ℹ️ No $(PID_FILE) found."; \
	fi
	@PIDS=$$(lsof -ti :$(BACKEND_PORT) 2>/dev/null || true); \
	if [ -n "$$PIDS" ]; then \
		echo "Killing residual process on port $(BACKEND_PORT): $$PIDS"; \
		kill -9 $$PIDS 2>/dev/null || true; \
	fi

## Check backend status
backend-status:
	@if curl -s http://localhost:$(BACKEND_PORT)/health >/dev/null 2>&1; then \
		echo "✅ Backend is ONLINE on http://localhost:$(BACKEND_PORT)"; \
		curl -s http://localhost:$(BACKEND_PORT)/health; \
		echo ""; \
	else \
		echo "❌ Backend is OFFLINE on http://localhost:$(BACKEND_PORT)"; \
	fi
	@if [ -f "$(PID_FILE)" ]; then \
		echo "PID File: $(PID_FILE) (PID: $$(cat "$(PID_FILE)"))"; \
	fi

## Tail backend logs
backend-logs:
	@if [ -f "$(LOG_FILE)" ]; then \
		tail -f "$(LOG_FILE)"; \
	else \
		echo "No $(LOG_FILE) found. Start the backend first with 'make backend-bg'."; \
	fi

## Run backend in foreground
backend:
	@echo "🚀 Starting Backend server in foreground on port $(BACKEND_PORT)..."
	@cd "$(BACKEND_DIR)" && $(PYTHON) -m uvicorn server:app --host 0.0.0.0 --port $(BACKEND_PORT) --reload

## Run frontend dev server in foreground
frontend:
	@echo "⚡ Starting Frontend Dev Server..."
	@npm run dev

## Stop all services
stop: backend-stop
	@echo "🛑 Stopping any remaining dev servers..."
	@PIDS=$$(lsof -ti :$(FRONTEND_PORT) 2>/dev/null || true); \
	if [ -n "$$PIDS" ]; then \
		kill -9 $$PIDS 2>/dev/null || true; \
		echo "✅ Stopped frontend processes on port $(FRONTEND_PORT)"; \
	fi

## Restart background backend and launch frontend
restart: backend-stop dev

## Install dependencies for both frontend and backend
install: install-frontend install-backend

install-frontend:
	@echo "📦 Installing Node dependencies..."
	@npm install

install-backend:
	@echo "📦 Installing Python dependencies..."
	@$(PYTHON) -m pip install -r "$(BACKEND_DIR)/requirements.txt"

## Build production frontend
build:
	@npm run build

## Lint frontend code
lint:
	@npm run lint

## Build production frontend & launch backend for sharing via tunnel
share: build backend-bg
	@echo ""
	@echo "=========================================================="
	@echo "🌐 FULL-STACK APPLICATION IS READY TO SHARE WITH FRIENDS!"
	@echo "=========================================================="
	@echo "Your FastAPI backend is serving both the React UI and API at:"
	@echo "👉 Local Access: http://localhost:8000"
	@echo ""
	@echo "To share a PUBLIC link with your friends:"
	@echo "1. Run ngrok:            ngrok http 8000"
	@echo "   OR localtunnel:       npx localtunnel --port 8000"
	@echo "   OR cloudflare:        cloudflared tunnel --url http://localhost:8000"
	@echo ""
	@echo "2. Send the generated HTTPS link (e.g. https://xxxx.ngrok-free.app) to your friends!"
	@echo "=========================================================="
	@echo ""

## Docker Commands
docker-up:
	@echo "🐳 Launching Docker Compose stack (React + F5-TTS + Ollama)..."
	docker compose up --build -d
	@echo "✅ Docker stack is running at http://localhost:8000"

docker-down:
	@echo "🛑 Stopping Docker Compose stack..."
	docker compose down

docker-logs:
	docker compose logs -f

## Clean up logs, pid files, dist, and pycache
clean: backend-stop
	@echo "🧹 Cleaning temporary files..."
	@rm -rf "$(PID_FILE)" "$(LOG_FILE)" dist
	@find . -type d -name "__pycache__" -exec rm -rf {} + 2>/dev/null || true
	@find . -type f -name "*.pyc" -delete 2>/dev/null || true
	@echo "✨ Clean complete."
