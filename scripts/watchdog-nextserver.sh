#!/usr/bin/env bash
# Watchdog: kill duplicate next-server processes, keep only the oldest.
# Run via cron every 2 minutes to prevent memory exhaustion.

count=$(pgrep -c -f "next-server" 2>/dev/null || echo "0")
if [ "$count" -le 1 ]; then
    exit 0
fi

echo "[$(date)] Found $count next-server instances, keeping oldest..."

# Get all next-server PIDs sorted by start time (oldest first)
pids=$(ps -eo pid,start,comm | grep "next-server" | sort -k2 | awk '{print $1}')
oldest=true
for pid in $pids; do
    if $oldest; then
        echo "  keeping PID $pid (oldest)"
        oldest=false
    else
        echo "  killing PID $pid"
        kill "$pid" 2>/dev/null || true
        # Also kill its parent pnpm/refine dev if orphaned
        ppid=$(ps -o ppid= -p "$pid" 2>/dev/null | tr -d ' ')
        [ -n "$ppid" ] && kill "$ppid" 2>/dev/null || true
    fi
done
