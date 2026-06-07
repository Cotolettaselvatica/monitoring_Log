---
name: cruscotto-catis
description: >-
  Develop and maintain the Cruscotto CATIS CH React dashboard (machines, logs,
  alerts, reports, audit). Use for any task in this repo involving MUI layout,
  TanStack Query data fetching, D3 charts, Italian UI copy, API integration, or
  export flows with jspdf/xlsx already in the project.
---

# Cruscotto CATIS CH

## Stack (do not replace without explicit request)

- React 18 + TypeScript + Vite
- MUI 6 (`@mui/material`, `@mui/x-data-grid`, `@mui/x-date-pickers`)
- TanStack React Query for server state
- React Router 6 — routes in `src/App.tsx`
- Charts: D3 in `src/components/charts/`
- HTTP: Axios (existing API layer)
- Export: `jspdf` / `jspdf-autotable` and `xlsx` (already dependencies)

## Project layout

| Area | Path |
|------|------|
| Pages | `src/pages/` |
| Layout shell | `src/components/layout/AppShell.tsx` |
| Dashboard | `src/components/dashboard/`, `src/pages/DashboardPage.tsx` |
| Machines | `src/components/machines/`, `src/pages/MachinesListPage.tsx`, `MachineDetailPage.tsx` |
| Logs / filters | `src/components/logs/`, `src/components/filters/` |
| Shared UI | `src/components/common/` |
| Settings | `src/context/SettingsContext.tsx`, `src/pages/SettingsPage.tsx` |

## Conventions

1. **MUI first** — Use theme tokens, `sx`, and existing patterns (`KpiCard`, `DataGridShell`, `ChartCardWithExport`, `StatusChip`). Do not introduce Tailwind or shadcn unless the user asks.
2. **Data** — Prefer existing query hooks and API modules; keep loading/error/empty states consistent with `LoadingState`, `ErrorState`, `EmptyState`, `RequiresApiAlert`.
3. **i18n** — UI strings are Italian for operators; keep tone concise and operational.
4. **Scope** — Minimal diffs; match import aliases (`@/`) and file naming already in `src/`.
5. **Tests** — Vitest (`npm test`); align with existing test style when adding coverage.

## Skill routing (this repo)

| Task | Also load |
|------|-----------|
| New UI, dashboard polish, visual design | `frontend-design` |
| Browser/E2E verification of running dev server | `webapp-testing` |
| Spreadsheet export beyond in-app `xlsx` usage | `xlsx` |
| PDF generation beyond in-app `jspdf` usage | `pdf` |
| Specs / internal docs for stakeholders | `doc-coauthoring` |
| Create or tune Agent Skills | `skill-creator` |

## Out of scope unless requested

- `web-artifacts-builder` (Tailwind/shadcn artifacts) — conflicts with MUI stack
- `brand-guidelines` — Anthropic branding, not CATIS
- `claude-api` — unless integrating Anthropic SDK in this frontend
