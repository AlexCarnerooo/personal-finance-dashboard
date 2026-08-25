#!/bin/bash

PROJECT_DIR="$HOME/dev/personal-finance-dashboard"
LOG_DIR="$PROJECT_DIR/logs"

mkdir -p "$LOG_DIR"

echo "Iniciando Personal Finance Dashboard..."

cd "$PROJECT_DIR"

nohup poetry run uvicorn backend.main:app --reload \
  > "$LOG_DIR/backend.log" 2>&1 &
echo $! > "$PROJECT_DIR/.backend.pid"

cd "$PROJECT_DIR/frontend"

nohup npm run dev \
  > "$LOG_DIR/frontend.log" 2>&1 &
echo $! > "$PROJECT_DIR/.frontend.pid"

cd "$PROJECT_DIR"

nohup ngrok http 8000 --url https://juicy-cherlyn-forewarningly.ngrok-free.dev \
  > "$LOG_DIR/ngrok.log" 2>&1 &
echo $! > "$PROJECT_DIR/.ngrok.pid"

echo ""
echo "Todo iniciado."
echo "Dashboard: http://localhost:5173"
echo "API:       http://127.0.0.1:8000"
echo "Swagger:   http://127.0.0.1:8000/docs"
echo ""
echo "Logs disponibles en: $LOG_DIR"
