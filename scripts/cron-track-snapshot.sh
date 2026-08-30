#!/usr/bin/env bash
# MT — Weekly track-record snapshot (Mondays 07:30 via cron; v3.2.0 批 1, D9).
#
# Runs the read-only tsx exporter (backend/scripts/weekly-track-snapshot.ts),
# then commits ONLY docs/snapshots/track-record-*.md so the weekly evidence
# artifact lands in git without any manual session — keeping the "clean tree"
# invariant ops relies on. Guards:
#   - index.lock present (an interactive session mid-commit) → leave the file
#     uncommitted; next weekly run picks it up. No waiting, no force.
#   - git commit uses a pathspec limited to docs/snapshots/ so unrelated
#     staged work is never swept into the automated commit.
#   - snapshot generation failure exits non-zero (visible in the cron log).
set -euo pipefail

export PATH="/usr/local/bin:/usr/bin:/bin:$PATH"
NOW=$(date '+%Y-%m-%d %H:%M:%S')
TAG="[track-snapshot]"

echo "$NOW $TAG generating snapshot"
cd /root/backend
if ! npx tsx scripts/weekly-track-snapshot.ts; then
    echo "$NOW $TAG ERROR: snapshot generation failed"
    exit 1
fi

if [ -e /root/.git/index.lock ]; then
    echo "$NOW $TAG git index.lock present — leaving snapshot for next run"
    exit 0
fi

cd /root
git add -- 'docs/snapshots/track-record-*.md' 2>/dev/null || true
if git diff --cached --quiet -- docs/snapshots/ 2>/dev/null; then
    echo "$NOW $TAG no snapshot changes to commit"
else
    git commit -m "docs: weekly track-record snapshot (automated cron)" -- docs/snapshots/ >/dev/null
    echo "$NOW $TAG committed $(git log -1 --format=%h)"
fi
