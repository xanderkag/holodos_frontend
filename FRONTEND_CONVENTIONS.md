# Frontend Conventions & Standards: HOLODOS AI 🧊🤖

This document defines the technical standards, UI/UX patterns, and integration rules for the HOLODOS AI frontend. It serves as the primary onboarding guide for frontend developers and a reference for the product/backend teams.

---

## 1. Tech Stack Overview
- **Framework**: React 19 (Functional Components, Hooks).
- **Build Tool**: Vite 8.
- **Language**: TypeScript (Strict mode).
- **Mobile**: Capacitor 8 (Cross-platform iOS/Android/PWA).
- **Styles**: Vanilla CSS with modern features (Nesting, Variables, Backdrop filters).
- **Infrastructure**: Firebase Auth & Firestore, Yandex Cloud S3 (Media).

---

## 2. UI/UX Design System
The app follows a **Premium Glassmorphism** aesthetic.

### Design Tokens (`index.css`)
- Use CSS Variables for all colors, gaps, and radiuses.
- **Themes**: Support for `[data-theme="light"]` (default) and `[data-theme="dark"]`.
- **Density**: Support for `[data-density="comfortable"]` and `[data-density="compact"]`.

### Key Class Patterns:
- `.glass-panel`: Major UI containers with heavy blur and subtle borders.
- `.glass-pill`: Secondary interactive elements.
- `.animated-pop`: Default entrance animation for modals and cards.

### Mobile-First Rules:
- **Safe Areas**: Always use `--sat` (top) and `--sab` (bottom) variables derived from `env(safe-area-inset-*)`.
- **Haptics**: Always trigger `navigator.vibrate` on successful primary actions (add, send, switch tab).
- **Visual Viewport**: Smart Input must handle `window.visualViewport` to stay visible above the soft keyboard on iOS.

---

## 3. Component Architecture: The "Smart Bar"
The interaction hub consists of the `SmartInput` and `TabBar` components.

### SmartInput States:
1. `hidden`: Out of sight.
2. `active`: Visible above TabBar, text input ready.
3. `recording`: Voice session active (Wave indicator).
4. `media`: Image selection (Camera/Gallery) active.

### Gesture System:
- **TabBar Central Button**:
    - Click 1: Open SmartInput (`active`).
    - Click 2: Navigate to Chat (if not there) or Hide (if already in Chat).
    - Swipe Left/Right: Immediate Mic/Camera activation.
- **SmartInput Bar**: Parallax horizontal swipe to trigger Media/Voice without clicking.

---

## 4. Backend Integration (AI & State)
The frontend implements a **Stateless Backend Pattern**.

### Single Source of Truth:
Refer to [AI_ENDPOINTS.md](file:///Users/alexanderliapustin/Desktop/Antigravity2/backend/api_contracts/AI_ENDPOINTS.md) and [AUTH_ENDPOINTS.md](file:///Users/alexanderliapustin/Desktop/Antigravity2/backend/api_contracts/AUTH_ENDPOINTS.md) for current API contracts.

> [!CAUTION]
> **No Backend Mutation**: The frontend is a consumer of the API. Changing request structures, endpoint paths, or JSON schemas without explicit agreement from the backend team is strictly prohibited.

### Integration Flow:
1. **State Collection**: Frontend gathers `list`, `stock`, `diary`, and `baseline` from `DataContext`.
2. **AI Request**: Payload is sent via `api.ts` (Firebase Auth enabled).
3. **Action Execution**:
    - Backend returns an array of `AiAction`.
    - `AiContext.tsx` parses these actions and applies them to the global state.
    - **Classification**: If `item.cat` is missing, the frontend MUST call `classify(item.name)` locally.

### Error Handling Requirements:
- **413**: Inform user about image size, ensure compression is active.
- **401/403**: Trigger re-authentication flow.
- **5xx**: Show "Assistant is resting" Toast, do not break the app loop.

---

## 5. Deployment Workflow & "Economy"
To save resources and prevent broken production builds, we follow a strict pre-push process.

### Mandatory Pre-Push Checklist:
1.  **Local Verification**: Run `npm run verify` (Build + TypeCheck + Preview) locally.
2.  **Environment Sync**: Ensure `.env` mirrors all keys in `.env.example`.
3.  **Bundle Check**: Verify that `index.js` remains at a healthy size (warn if > 500KB).

> [!IMPORTANT]
> **Bypass Prohibition**: Pushing to the `main` branch before a successful local build is an architecture violation.

---
*Created by Antigravity (Frontend Agent). Updated: April 2026.*
