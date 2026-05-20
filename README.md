# Second Opinion Doctor - Premium Healthcare Platform UI

Production-grade frontend scaffold for a cross-platform healthcare product where patients can upload medical records and request secure second opinions from verified doctors worldwide.

## Stack Used in This Repository

- Vite + React + TypeScript
- Mobile-first responsive UI
- Design-token style CSS system (light + dark mode)

## Product Roles

- Patient
- Doctor
- Admin

## Implemented Experience

- Splash, onboarding, and authentication flow
- Patient workspace:
  - dashboard, uploads, doctor discovery/profile
  - consultation (chat/audio/video concept)
  - payments, subscriptions, notifications
  - AI timeline and insights
- Doctor workspace:
  - case queue, performance metrics, availability
- Admin workspace:
  - platform KPIs, fraud monitoring, user controls, CMS/audit

## Run Locally

```bash
npm install
npm run dev
```

Build:

```bash
npm run build
```

## Deploy on Vercel

This repository is Vercel-ready via `vercel.json`.

1. Import the GitHub repository into Vercel **or** use CLI:

```bash
npm i -g vercel
vercel link
vercel --prod
```

2. Vercel settings (already configured in `vercel.json`):
   - Build command: `npm run build`
   - Output directory: `dist`
   - SPA rewrites enabled for React Router routes

## Architecture and Product Docs

- Database schema: `docs/architecture/database-schema.sql`
- API architecture: `docs/architecture/api-architecture.md`
- Backend architecture: `docs/architecture/backend-architecture.md`
- Auth flow: `docs/architecture/authentication-flow.md`
- AI integration: `docs/architecture/ai-integration-architecture.md`
- User flows: `docs/product/user-flows.md`
- Screen inventory: `docs/product/screen-inventory.md`
- Design system: `docs/design/design-system.md`
- Component library: `docs/design/component-library.md`

## Notes

- UI uses logo-inspired cyan/green healthcare palette.
- Built for enterprise SaaS quality visuals with premium cards, clean spacing, rounded corners, and micro-interactions.