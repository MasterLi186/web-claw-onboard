#!/bin/bash
CONFIG_FILE="/root/.openclaw/openclaw.json"

# 使用 node 解析 JSON 更可靠
if [ -f "$CONFIG_FILE" ]; then
    TOKEN=$(node -e "
      const fs = require('fs');
      try {
        const config = JSON.parse(fs.readFileSync('$CONFIG_FILE', 'utf8'));
        console.log(config.gateway?.auth?.token || '');
      } catch(e) {
        console.log('');
      }
    ")
    
    if [ -n "$TOKEN" ]; then
        echo "Starting OpenClaw Gateway with token..."
        export OPENCLAW_GATEWAY_TOKEN="$TOKEN"
        exec openclaw gateway --token="$TOKEN"
    fi
fi

echo "Starting OpenClaw Gateway without token..."
exec openclaw gateway
