# AGENTS.md
This file provides guidance to WARP (warp.dev) when working with code in this repository.

## Common commands
- Install deps: `npm install`
- Start dev server (Expo): `npx expo start` (or `npm run start`)
- Run Android: `npm run android` (runs `expo run:android`)
- Run iOS: `npm run ios` (runs `expo run:ios`)
- Run web: `npm run web` (runs `expo start --web`)
- Lint: `npm run lint` (Expo lint)
- Reset starter template: `npm run reset-project` (moves starter code to `app-example/` and recreates `app/`)

## High-level architecture
- **Expo + expo-router**: Entry point is `expo-router/entry`. Routes live in `app/` using file‑based routing. `_layout.js` sets up the stack and safe-area provider. Key screens include `app/index.js` (home), `app/camera.js` (capture), `app/preview.js` (single “thought”), `app/ask.js` (chat), and `app/profiles/*` (pet profiles).
- **UI layer**: Reusable UI primitives live in `src/components/ui/` (`Screen`, `TTButton`). Shared UI pieces (e.g., `ThoughtBottomBar`, `SpeechBubble`) are in `src/components/`.
- **Theme system**: `src/theme/index.js` exposes `useTTTheme()` for light/dark palettes and spacing/typography; `src/theme/globalStyles.js` composes common styles used across screens.
- **Data & state**:
  - Local persistence is mostly `AsyncStorage` in `src/services/pets.js` (pet profiles + active pet).
  - Device ID is stored in SecureStore (see `app/index.js`, `app/preview.js`, `app/ask.js`, and `src/services/deviceId.js`).
- **Backend API**:
  - Primary API base is `process.env.EXPO_PUBLIC_API_URL` with fallback to `https://tiny-tales-oms6.onrender.com` in `src/services/ai.js`.
  - `src/services/ai.js` handles health/status, “thought” generation, chat (`/ask`), and classification (`/classify`), with timeouts and JSON error handling.
- **Images**: `src/services/imageDataUrl.js` converts local image URIs to base64 data URLs with size tiers for free/pro.
- **Monetization**:
  - Ads: `src/ads/admob.js` uses `react-native-google-mobile-ads` (test banners in dev).
  - Subscription flow: `app/ask.js` uses `expo-iap` and syncs entitlement to `/entitlement/sync`.
  - Legacy/dev credit flow: `src/services/credits.js` and `app/preview.js` include a dev credit endpoint for “smart thought” balance.
