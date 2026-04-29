#!/bin/bash
#
# IoTDB AI Node Stop Script
# AINode runs on-demand via backend ai.ts, no daemon to stop
#

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${GREEN}================================================${NC}"
echo -e "${GREEN}   IoTDB AI Node - Stop${NC}"
echo -e "${GREEN}================================================${NC}"
echo ""

# Kill any lingering Python processes spawned by ai.ts
PIDS=$(pgrep -f "ainode.*model_manager\|ainode.*inference_manager" 2>/dev/null || true)
if [ -n "$PIDS" ]; then
    echo "Killing AINode Python processes: $PIDS"
    echo "$PIDS" | xargs kill 2>/dev/null || true
    sleep 2
fi

echo -e "${GREEN}AINode is on-demand (no daemon to stop)${NC}"
echo ""
echo -e "${GREEN}================================================${NC}"
