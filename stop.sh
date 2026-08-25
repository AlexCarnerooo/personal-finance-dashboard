#!/bin/bash

PROJECT_DIR="$HOME/dev/personal-finance-dashboard"

echo "Deteniendo Personal Finance Dashboard..."

for service in backend frontend ngrok
do
    PID_FILE="$PROJECT_DIR/.$service.pid"

    if [ -f "$PID_FILE" ]; then
        PID=$(cat "$PID_FILE")

        if kill -0 "$PID" 2>/dev/null; then
            kill "$PID"
            echo "$service detenido."
        else
            echo "$service ya estaba detenido."
        fi

        rm "$PID_FILE"
    fi
done

echo "Todo detenido."
