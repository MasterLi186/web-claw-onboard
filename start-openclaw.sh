#!/bin/bash

CONFIG_FILE="/root/.openclaw/openclaw.json"

PORT=18789
BIND="lan"
TOKEN=""

if [ -f "$CONFIG_FILE" ]; then
  PORT=$(python3 -c "import json; print(json.load(open('$CONFIG_FILE')).get('gateway', {}).get('port', 18789))" 2>/dev/null || echo 18789)
  BIND=$(python3 -c "import json; print(json.load(open('$CONFIG_FILE')).get('gateway', {}).get('bind', 'lan'))" 2>/dev/null || echo "lan")
  TOKEN=$(python3 -c "import json; print(json.load(open('$CONFIG_FILE')).get('gateway', {}).get('auth', {}).get('token', ''))" 2>/dev/null || echo "")
fi

echo "Starting OpenClaw Gateway: port=$PORT, bind=$BIND, token=$TOKEN"

exec openclaw gateway run --port "$PORT" --bind "$BIND" ${TOKEN:+"--token" "$TOKEN"} --allow-unconfigured
