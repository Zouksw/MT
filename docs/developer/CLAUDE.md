# TradeMind AI - Claude Code Instructions

## Project Overview

TradeMind AI is a time-series data analytics platform built on Apache IoTDB 2.0.5 + AI Node, providing:
- Time-series data storage and querying (IoTDB)
- **AI-powered prediction and anomaly detection** (AI Node - ✅ **RUNNING**)
- RESTful API with Next.js 14 frontend
- PostgreSQL + Redis for application data
- PM2 process management

## Tech Stack

**Backend**: Node.js 18.x, Express 4.x, TypeScript 5.x, Prisma ORM
**Frontend**: Next.js 14, React 19, Ant Design
**Databases**: PostgreSQL 15, Redis 7, IoTDB 2.0.5
**AI Engine**: Apache IoTDB AI Node 2.0.5 (Python 3.10)
**Testing**: Jest + Supertest (1255 tests, 62.57% coverage)
**Process Management**: PM2

## Development Commands

**Backend Development**:
```bash
cd backend
npm run dev        # Start development server with tsx
npm test           # Run tests
npm run test:coverage  # Generate coverage report
npm run build      # Build for production
```

**Frontend Development**:
```bash
cd frontend
npm run dev        # Start Next.js dev server (port 3000)
npm run build      # Build for production
npm run lint       # Run ESLint
```

**Service Management**:
```bash
./start.sh         # Start all services (including AI Node)
./stop.sh          # Stop all services
./check.sh         # Check service status
```

**AI Node Management**:
```bash
./scripts/start-ainode.sh   # Start AI Node only
./scripts/stop-ainode.sh    # Stop AI Node only
```

## Project Structure

```
trademind-ai/
├── backend/
│   ├── src/
│   │   ├── routes/       # API endpoints (express routers)
│   │   ├── services/     # Business logic (IoTDB, AI, alerts, etc.)
│   │   ├── middleware/   # Express middleware (auth, cache, security)
│   │   └── lib/          # Utilities (logger, redis, sentry, jwt)
│   ├── prisma/           # Database schema
│   └── jest.config.cjs   # Test configuration
├── frontend/
│   └── src/
│       ├── app/          # Next.js 14 app router pages
│       └── components/   # React components
├── scripts/              # Operations scripts
│   ├── start-ainode.sh   # AI Node start script
│   └── stop-ainode.sh    # AI Node stop script
└── docs/
    └── ai-node-setup.md  # AI Node documentation
```

## Key Services

- **IoTDB Client**: `backend/src/services/iotdb/client.ts` - RPC client for IoTDB
- **AI Service**: `backend/src/services/iotdb/ai-isolated.ts` - Isolated AI execution
- **Cache Service**: `backend/src/services/cache.ts` - Redis caching
- **Alert Service**: `backend/src/services/alerts.ts` - Alert management
- **Auth Lockout**: `backend/src/services/authLockout.ts` - Account lockout

## AI Node Integration

### Status: ✅ **RUNNING**

The Apache IoTDB AI Node is installed and operational:
- **Installation**: `/opt/iotdb-ainode/apache-iotdb-2.0.5-ainode-bin/`
- **Port**: 10810
- **Python**: 3.10 (virtual environment)
- **Models**: 7 available (ARIMA, Timer_XL, Sundial, Holt-Winters, etc.)

### Available AI Features

**Prediction Models:**
- ARIMA, Timer_XL (LSTM), Sundial (Transformer)
- Holt-Winters, Exponential Smoothing, Naive, STL

**Anomaly Detection:**
- STRAY, Statistical, ML-based

### API Endpoints

```bash
# List available models
GET /api/iotdb/ai/models

# Time series prediction
POST /api/iotdb/ai/predict
{
  "timeseries": "root.sg.device1.temperature",
  "horizon": 10,
  "algorithm": "arima"
}

# Anomaly detection
POST /api/iotdb/ai/anomalies
{
  "timeseries": "root.sg.device1.temperature",
  "method": "statistical"
}

# Train custom model
POST /api/iotdb/ai/models/train
```

### Documentation

See [AI Node Setup Guide](docs/ai-node-setup.md) for complete documentation.

## Security Guidelines

- JWT tokens stored in HttpOnly cookies only (never localStorage)
- CSRF protection enabled (double-submit cookie pattern)
- SQL injection prevention via input validation
- AI features disabled by default, require admin role
- AI isolation: Process isolation with resource limits
- Rate limiting via Redis (100 req/15min per IP)

## Environment Files

- Backend: `backend/.env` (copy from `backend/.env.example`)
- Frontend: `frontend/.env.local` (copy from `frontend/.env.example`)

**AI Configuration** (in `backend/.env`):
```bash
AI_FEATURES_DISABLED=false    # Enable AI features
IOTDB_AI_ENABLED=true         # Enable IoTDB AI
AI_NODE_HOST=127.0.0.1        # AI Node host
AI_NODE_PORT=10810            # AI Node port
AI_MAX_MEMORY=512M            # Memory limit per request
AI_TIMEOUT=120000             # Timeout (ms)
```

## Current Development Focus

Based on ROADMAP.md, the next phases are:

**Phase 3 - Advanced Features** (In Progress):
- ✅ AI Node integration and verification
- Observability & Monitoring (OpenTelemetry, Prometheus, Grafana)
- Performance Optimization (Advanced caching, read replicas)
- Security Enhancements (2FA, RBAC, CSP)
- Developer Experience (SDK generation, dev tools)

**Phase 4 - Scalability** (Planned):
- Kubernetes deployment
- Auto-scaling (HPA, VPA)
- High availability (database HA, multi-region)

## Testing Guidelines

- All new code requires tests
- Aim for >80% coverage on new modules
- Run tests before committing: `cd backend && npm test`
- Use `/ship` skill for automated release workflow

## Common Issues

**AI Node not responding?**
```bash
# Check AI Node status
nc -z localhost 10810 && echo "AI Node OK" || echo "AI Node DOWN"

# View AI Node logs
tail -50 /opt/iotdb-ainode/apache-iotdb-2.0.5-ainode-bin/logs/log_ainode_error.log

# Restart AI Node
./scripts/stop-ainode.sh && ./scripts/start-ainode.sh
```

**Tests failing?**
- Check PostgreSQL and Redis are running
- Verify environment variables are set
- Run `cd backend && npm test` to see specific failures

**IoTDB connection issues?**
- Check IoTDB is running: `nc -z localhost 6667`
- Verify credentials in `backend/.env`
- Check AI Node if using AI features: `nc -z localhost 10810`

**PM2 processes not starting?**
- Check logs: `pm2 logs`
- Verify ports aren't already in use
- Run `./check.sh` for status overview

## gstack Integration

### Available Skills

Use the following gstack skills for development:

**Planning & Design**:
- `/office-hours` - Reframe product features before coding
- `/plan-ceo-review` - CEO-level feature review and scope validation
- `/plan-eng-review` - Engineering architecture review
- `/plan-design-review` - Design quality assessment
- `/design-consultation` - Design system guidance

**Code Quality**:
- `/review` - PR review with bug detection
- `/investigate` - Root-cause debugging
- `/design-review` - Design audit and fixes

**Testing & Release**:
- `/qa` - Full QA testing with real browser
- `/qa-only` - Bug report only (no fixes)
- `/ship` - Automated release workflow

**Documentation**:
- `/document-release` - Update docs after shipping
- `/retro` - Weekly retrospective and stats

**Utilities**:
- `/browse` - Real browser for testing
- `/setup-browser-cookies` - Import auth cookies
- `/careful` - Safety guardrails for destructive commands
- `/freeze` - Edit lock to one directory
- `/guard` - Full safety mode
- `/unfreeze` - Unlock edits
- `/gstack-upgrade` - Update gstack

### Browser Usage

**IMPORTANT**: Use `/browse` from gstack for all web browsing. Never use `mcp__claude-in-chrome__*` tools.

### Skill Not Working?

If gstack skills aren't working, run:
```bash
cd .claude/skills/gstack && ./setup
```

---

## Design System

**IMPORTANT**: Always read `DESIGN.md` before making any visual or UI decisions.

### Design Philosophy
TradeMind AI uses an **Industrial Data +** aesthetic — warm, approachable, technical but not cold. The design system balances:
- **Data density** — power users see more at once
- **Readability** — Geist Mono ensures perfect data alignment
- **Warmth** — amber primary (`#F59E0B`) stands out from sea of blue tools
- **Professionalism** — grid-disciplined layouts, consistent spacing

### Core Design Decisions

**Colors**:
- **Primary**: Amber `#F59E0B` — warm, industrial, distinctive
- **Secondary**: Slate Blue `#475569` — bridges warm to cool
- **Success**: Emerald `#10B981` | **Warning**: Amber `#F59E0B` | **Error**: Red `#EF4444` | **Info**: Blue `#3B82F6`
- **Neutrals**: Cool grays `#F8FAFC` to `#0F172A` (near-black for dark mode)

**Typography**:
- **Display/Hero**: Satoshi (Bold 700) — page titles, hero sections
- **Body**: DM Sans (400/500/600) — paragraphs, labels, navigation
- **Data/Tables**: Geist Mono — **critical for time-series values**, tabular nums
- **Code**: JetBrains Mono — API docs, config files

**Spacing**:
- **Base unit**: 4px (all spacing is multiples of 4)
- **Density**: Comfortable-dense (tighter than consumer apps, more breathing room than enterprise tools)
- **Scale**: 2xs(4px) xs(8px) sm(12px) md(16px) lg(24px) xl(32px) 2xl(48px) 3xl(64px)

**Layout**:
- **Grid**: 12-column system, max-width 1280px (marketing), 1440px (dashboard)
- **Border radius**: sm(4px) md(8px) lg(12px) xl(16px) full(9999px)
- **Dark mode**: Default — use `#0F172A` background, not pure black

**Motion**:
- **Approach**: Intentional (meaningful transitions, not over-decorated)
- **Easing**: enter(ease-out) exit(ease-in) move(ease-in-out)
- **Duration**: micro(50-100ms) short(150-250ms) medium(250-400ms) long(400-700ms)

### Component Guidelines

**Buttons**:
- Primary: Amber background, white text, rounded-sm (4px)
- Secondary: Slate blue background
- Ghost: Transparent with amber border
- Hover: Slight lift (-1px translateY) + shadow

**Cards**:
- Background: White (light mode), `#1E293B` (dark mode)
- Border: `#E2E8F0` (light mode), `#334155` (dark mode)
- Border-radius: 8px (md)
- Padding: 16px (md)
- Hover: Shadow + subtle lift

**Data Tables**:
- **Use Geist Mono** for all data cells
- Tabular nums enabled for alignment
- Row height: 48px (compact) or 56px (standard)
- Header: Uppercase, 12px, tracking-wider, gray-500
- Hover: Gray-50 background

**Forms**:
- Input height: 40px
- Border: 1px solid #E2E8F0
- Focus: Amber border + 3px amber shadow
- Label: DM Sans 500, 14px
- Spacing: 16px between fields

### Page Types

**Marketing Pages** (Home, Pricing, About):
- Hero: Center-aligned, 72px vertical spacing
- Features: 3-column grid, 48px section spacing
- CTA sections: Full-width background, centered container
- Animation: Intentional, not overwhelming

**Dashboard/App Pages**:
- Sidebar: 240px wide, fixed
- Top bar: 64px high, fixed
- Main content: 24px padding
- Cards: Responsive grid, auto-flow
- Data-dense but readable

**Data Tables Pages**:
- Full-width table, horizontal scroll
- Proportional column widths
- Pagination: Bottom-right aligned
- Filters: Top-right, above table

**Form Pages**:
- Form container: Max 600px wide, centered
- Field spacing: 24px
- Submit button: 44px height, full width

### Dark Mode

**Default**: Dark mode is the default for dashboard/app pages (matches user expectations in monitoring tools)

**Implementation**:
- Use CSS custom properties + class switching
- Tailwind: `dark:` prefix
- Reduce saturation 10-15% for semantic colors
- Background: `#0F172A` (not pure black)

### Accessibility

**Contrast**: WCAG AA minimum (4.5:1), AAA preferred (7:1)

**Keyboard Navigation**:
- Clear focus rings (3px amber outline)
- Logical tab order
- Skip links for main content

**Screen Readers**:
- ARIA labels on all interactive elements
- Semantic HTML
- Live regions for dynamic updates

### Implementation Priority

**Phase 1** (Foundation):
1. Install fonts (Satoshi, DM Sans, Geist Mono, JetBrains Mono)
2. Configure Tailwind with design tokens
3. Create global styles and CSS variables
4. Build base components (Button, Input, Card)
5. Set up dark mode toggle

**Phase 2** (Pages):
1. Marketing pages (home, pricing, about)
2. Dashboard/app pages (sidebar, top bar, stats cards)
3. Data table pages (tables, filters, pagination)
4. Form pages (login, create device, settings)

**Phase 3** (Polish):
1. Animations and micro-interactions
2. Responsive adjustments
3. Accessibility audit
4. Performance optimization

### Migration Notes

**Backward Compatible**:
- Keep Ant Design for existing pages (gradual migration)
- New pages use new design system
- Can run both systems in parallel

**Key Files**:
- `DESIGN.md` — Complete design system reference
- `frontend/tailwind.config.ts` — Design tokens
- `frontend/src/app/globals.css` — Global styles
- `frontend/src/components/ui/` — Base components

### Design Review Checklist

Before implementing any UI changes, ensure:
- [ ] Colors match DESIGN.md palette
- [ ] Typography uses correct font for the context (Geist Mono for data)
- [ ] Spacing follows 4px base unit
- [ ] Border radius uses scale (sm/md/lg/xl)
- [ ] Dark mode works (if applicable)
- [ ] Accessibility requirements met (contrast, keyboard, screen reader)
- [ ] Animation follows duration/easing guidelines

**In QA Mode**: Flag any code that doesn't match DESIGN.md.

**References**:
- [Design System Document](DESIGN.md) — Complete reference
- [Tailwind CSS Docs](https://tailwindcss.com/docs) — Utility framework
- [Lucide Icons](https://lucide.dev/) — Icon library
- [Radix UI](https://www.radix-ui.com/) — Accessible components
