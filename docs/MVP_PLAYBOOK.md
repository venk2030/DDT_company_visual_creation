# MVP Playbook — DDT Company Visual Creation

## MVP 1 — Onboard & Render (today)
- ✅ Keep reference outputs in `out/` so WFH juniors can compare builds quickly.
- ✅ README + ONBOARDING + First-Run Checklist (`docs/FIRST_RUN_CHECKLIST.md`).
- ✅ Makefile + `tools/` helpers for repeatable runs.
- ✅ Private repo while we set standards.
- **Baby steps**
  1) `npm install`
  2) `npm run build` → verify `out/timeline.png`
  3) Edit `data.json` → rebuild → see change
  4) Explore templates:  
     - default: `npm run build`  
     - `TEMPLATE=curved npm run build`  
     - `TEMPLATE=zigzag npm run build`
  5) Branch & push:  
     ```bash
     git checkout -b feat/<name>-first-run
     git add .
     git commit -m "chore: first run"
     git push -u origin HEAD
     ```

## MVP 2 — Guardrails & Quality (next)
- **Schema validation** on `data.json` (Ajv, `npm run lint:data`) — fails fast if shape breaks.
- **Debug ergonomics**: `.vscode/launch.json`, `HEADLESS=false` option.
- **Renderer switch** via env (`TEMPLATE=...`) to evaluate designs quickly.
- **Docs discipline**: Every PR updates ONBOARDING or CHECKLIST if behavior changes.
- **Baby steps**
  1) `npm run lint:data` must pass before PR.
  2) Add/modify template under `src/` → test with `TEMPLATE=<name>`.
  3) If build fails: try system Chrome:  
     `PUPPETEER_EXECUTABLE_PATH="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" npm run build`
  4) Attach new/changed `out/` screenshots in PR.
  5) Keep `main` stable; feature branches only.

## Later (post-MVP)
- Golden image diffs (visual regression).
- Optionally prune `out/` from main once juniors are fluent; keep in releases only.
- Decide: keep private or go public (scrub demos).
