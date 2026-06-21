# Design System — MT

## Product Context
- **What this is:** Commodity market analytics platform with AI-powered multi-model signal engine
- **Who it's for:** Commodity traders, market analysts, risk managers
- **Space/industry:** Financial analytics, commodity markets (agriculture, energy, metals)
- **Project type:** Web app (dashboard) + marketing site
- **Memorable thing:** AI Authority — the design makes intelligence tangible

## Aesthetic Direction
- **Direction:** Refined Industrial — dark, precise, signal-focused
- **Decoration level:** Minimal-intentional — gold accent IS the decoration
- **Mood:** Professional, authoritative, precise. Every gold element signals "AI intelligence lives here."
- **Reference:** Bloomberg's information density + Vercel's visual restraint

## Typography
- **Display/Hero:** Geist Sans, 48-60px, weight 600, tracking -2.4px — billboard impact for marketing
- **Page title:** Geist Sans, 24px, weight 600, tracking -0.96px — internal page headings
- **Section heading:** Geist Sans, 18px, weight 600 — within-page sections
- **Card title:** Geist Sans, 16px, weight 600 — card headers
- **Body:** Geist Sans, 14-16px, weight 400 — standard reading
- **Data value:** Geist Sans (tnum), 28px, weight 600, tracking -0.32px — StatCard numbers
- **Data label:** Geist Mono, 12px, weight 500, uppercase — metadata, technical labels
- **Code/technical:** Geist Mono, 13-14px, weight 400 — code blocks, terminal output
- **Loading:** Self-hosted via next/font/local (already configured)
- **Scale:** 8px base unit. Display 48-60, Title 24, Section 18, Card 16, Body 14-16, Label 12

## Color
- **Approach:** Restrained with gold as authority signal
- **Background:** `#0a0a0a` — near-black page canvas
- **Surface:** `#171717` — cards, panels, sidebar
- **Surface elevated:** `#1f1f1f` — hover states, dropdowns
- **Primary text:** `#fafafa` — headings, important data
- **Secondary text:** `#a1a1aa` — descriptions, labels
- **Muted text:** `#71717a` — timestamps, metadata
- **Gold accent:** `#B8860B` — AI signals, CTAs, key metrics (THE signature)
- **Gold tint:** `rgba(184,134,11,0.08)` — AI feature backgrounds
- **Gold light:** `#D4A030` — Gold hover state, lighter variant
- **Up/Bullish:** `#22c55e` — positive market signals
- **Down/Bearish:** `#ef4444` — negative market signals
- **Border:** `rgba(255,255,255,0.08)` — shadow-as-border technique
- **Focus:** `hsla(45,88%,39%,0.8)` — gold-tinted accessibility focus rings
- **Dark mode:** Default and primary. Light mode supported but secondary.

## Spacing
- **Base unit:** 8px
- **Density:** Comfortable — data-dense but breathing room around AI elements
- **Scale:** 4, 8, 12, 16, 24, 32, 48, 64

## Layout
- **Approach:** Grid-disciplined (app), editorial (marketing)
- **Grid:** Sidebar (240px) + main content. 2-4 column grids for stat cards.
- **Max content width:** ~1200px
- **Border radius:** sm 4px, md 8px, lg 12px, 2xl 16px, full 9999px

## Motion
- **Approach:** Minimal-functional — only transitions that aid comprehension
- **Easing:** enter ease-out, exit ease-in, move ease-in-out
- **Duration:** micro 50-100ms, short 150-250ms, medium 250-400ms

## Shadow System (Vercel technique)
- **Level 0 (Flat):** No shadow — page background, text
- **Level 1 (Ring):** `rgba(255,255,255,0.08) 0px 0px 0px 1px` — shadow-as-border for cards
- **Level 2 (Subtle):** Ring + `rgba(0,0,0,0.3) 0px 2px 4px` — standard cards
- **Level 3 (Elevated):** Ring + Subtle + `rgba(0,0,0,0.3) 0px 8px 16px -4px` — featured cards
- **Focus (Accessibility):** `2px solid hsla(45,88%,39%,0.8)` — gold focus ring

## Rules
1. Gold = AI intelligence. Every gold element signals AI content. Use sparingly.
2. Green/red = market direction ONLY. Never use for UI status.
3. Shadow-as-border, never CSS border on cards (Vercel technique).
4. Three font weights: 400 (read), 500 (interact), 600 (announce).
5. Geist Mono uppercase for data labels. Geist Sans for everything else.
6. Dark mode is default. Design dark-first, light-second.

## Decisions Log
| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-04-25 | Initial design system created | /design-consultation based on codebase analysis + competitive knowledge |
| 2026-04-25 | Gold as authority signal | Memorable thing = AI authority; gold signals intelligence |
| 2026-04-25 | Refined Industrial aesthetic | Bloomberg density + Vercel restraint; fits commodity analytics |
| 2026-04-25 | Skip research, use existing knowledge | Detailed codebase exploration already done; competitive knowledge sufficient |
