# NeuralDSA implementation plan (Copilot)

## Problem statement
The MVP base is already present (Firebase auth, onboarding, dashboard, roadmap, session UI, FastAPI websocket tutor, mastery updates), but `Claude.md` has drift from the actual code and there are core reliability + deployment gaps to close for the hackathon demo.

## Current-state review (high level)
1. Core tutor loop exists end-to-end.
2. Spec drift exists (`Claude.md` vs code versions/model references).
3. Core scoring reliability issue: correctness is inferred from text matching instead of structured evaluation.
4. Onboarding guard is not enforced even though route props suggest it.
5. Frontend and backend duplicate roadmap recommendation logic.
6. Deployment configs are not yet added in repo.

## Execution strategy (hackathon-first)
1. **Core reliability + feature impact together** (top priority).
2. **Fast deployment** (Vercel + Render/Railway, minimal ops).
3. **Claude.md alignment** (implemented-now vs planned).

## TODOs
1. **audit-align-claude-md**
   - Split into implemented now / next milestones / stretch.
   - Fix stack and model naming drift.
   - Add clear API payloads and acceptance criteria.

2. **fix-onboarding-gate**
   - Enforce `requireOnboarded` in `ProtectedRoute`.
   - Make post-login routing deterministic.

3. **wire-structured-evaluation**
   - Use `evaluate_answer(...)` in session scoring path.
   - Persist structured feedback fields in session state.

4. **harden-mastery-engine**
   - Update mastery using structured evaluation, hints, timing.
   - Handle missing topic data and outlier timings safely.
   - Track hesitation/hint counters consistently.

5. **unify-roadmap-logic**
   - Make backend authoritative for roadmap/recommendation.
   - Frontend consumes `/user/roadmap` only.

6. **session-persistence-upgrade**
   - Save bounded compressed message history.
   - Store `masteryDelta` and update `totalMinutes`.
   - Improve session metadata consistency.

7. **add-problem-catalog-layer**
   - Add canonical topic->problem mapping (NeetCode/Striver/LC).
   - Force tutor question selection from this catalog.

8. **feature-pack-judge-impact**
   - Prerequisite-gap intervention card in session.
   - “Why this topic next” explanation on dashboard.
   - Session replay summary (Q/A + mastery effect).

9. **deploy-backend-efficiently**
   - Add simple Render/Railway-ready deployment config.
   - Minimal healthcheck + required env validation.
   - Keep hackathon-essential websocket safeguards.

10. **deploy-frontend-efficiently**
   - Add Vercel config and required env checks.
   - Ensure websocket URL derivation from `VITE_BACKEND_URL`.
   - Add startup/build checks for Firebase env vars.

11. **observability-and-demo-hardening**
   - Add structured backend session/model-failure logs.
   - Add JSON parse fallback logging path.
   - Prepare demo runbook + fallback flow.

## Dependency order
- `fix-onboarding-gate` + `wire-structured-evaluation` before most feature work.
- `harden-mastery-engine` depends on `wire-structured-evaluation`.
- `unify-roadmap-logic` before recommendation UX polish.
- Deployment tasks after core behavior stabilizes.
- Observability/demo hardening after deployment setup.

## Deployment blueprint (hackathon efficient)
- **Frontend**: Vercel.
- **Backend**: Render or Railway.
- **Data/Auth**: Firebase Auth + Firestore.
- **Frontend envs**: `VITE_FIREBASE_*`, `VITE_BACKEND_URL`.
- **Backend envs**: `GEMINI_API_KEY`, `FIREBASE_SERVICE_ACCOUNT_JSON`, `ALLOWED_ORIGINS`.

## Notes
- Prioritize visible reliability and judge-facing impact.
- Keep backend as source of truth for core logic.
- Keep `Claude.md` as an execution contract, not only a concept note.
