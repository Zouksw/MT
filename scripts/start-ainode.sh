#!/bin/bash
#
# IoTDB AI Node Start Script
# Verifies the AINode Python environment is ready
#

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

AINODE_HOME="/opt/iotdb/apache-iotdb-2.0.8-all-bin"

echo -e "${GREEN}================================================${NC}"
echo -e "${GREEN}   IoTDB AI Node - Environment Check${NC}"
echo -e "${GREEN}================================================${NC}"
echo ""

if [ ! -d "$AINODE_HOME/venv" ]; then
    echo -e "${RED}ERROR: AINode venv not found at $AINODE_HOME/venv${NC}"
    exit 1
fi

PYTHON="$AINODE_HOME/venv/bin/python3"
if [ ! -f "$PYTHON" ]; then
    echo -e "${RED}ERROR: Python not found at $PYTHON${NC}"
    exit 1
fi

# Verify key imports
echo "Checking AINode Python environment..."
$PYTHON -c "
from ainode.core.manager.model_manager import ModelManager
from iotdb.Session import Session
import numpy, pandas, scipy, sklearn, statsmodels
print('All ML libraries OK')
" 2>&1 | tail -1

if [ $? -eq 0 ]; then
    echo -e "${GREEN}AINode Python environment is ready${NC}"
    echo "  venv: $AINODE_HOME/venv"
    echo ""
    echo "AINode runs on-demand via backend ai.ts (no separate daemon needed)"
else
    echo -e "${RED}ERROR: AINode Python environment has issues${NC}"
    exit 1
fi

echo ""
echo -e "${GREEN}================================================${NC}"
echo -e "${GREEN}   AI Node Ready${NC}"
echo -e "${GREEN}================================================${NC}"
