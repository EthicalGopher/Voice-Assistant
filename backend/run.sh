#!/bin/bash
# F5-TTS Backend Server
# Run: bash run.sh  (or: uvicorn server:app --reload --port 8000)
cd "$(dirname "$0")"
exec uvicorn server:app --host 0.0.0.0 --port 8000 $@
