# First-Run Checklist (Baby-Dev)

> Goal: green build fast, verified output, start exploring templates.

## 0) Machine + Access sanity
``bash
node -v && npm -v             # expect Node 18+/20+
nvm use --lts || nvm install --lts
ssh -T github.com && ssh -T github-work
git rev-parse --is-inside-work-tree || echo "clone first"

## 1) Repo structure check
which tree || brew install tree
tree -L 2
git ls-files | egrep '^(node_modules/|dist/|\.cache/)'   # should print nothing

## 2) Install deps
npm install             # or: npm ci
# if fail:
rm -rf node_modules package-lock.json
npm cache clean --force
nvm use --lts && npm install
xcode-select --install || true   # mac build tools if node-gyp yells

## 3) Build check
npm run build          # or: make build
ls -lah out/ | egrep 'timeline\.(png|svg)$'
open out/timeline.png  # macOS

## 4) Debug mode (VS Code & Node)

VS Code → Run & Debug ▶️ (we ship a launch config)

CLI: node --inspect-brk generator.js then attach debugger in VS Code.

## 5) Build fail quick fixes

Chromium errors? Use system Chrome:

PUPPETEER_EXECUTABLE_PATH="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" npm run build


Cache/perm weirdness: clear caches, reinstall (see §2).

## 6) Data input JSON

Edit data.json (small change), rebuild, confirm output updated.

## 7) Toggle template
TEMPLATE=curved npm run build
TEMPLATE=zigzag npm run build

## 8) Git basics
git checkout -b feat/<yourname>-first-run
git add .
git commit -m "chore: first run; tweak data"
git push -u origin HEAD

## 9) Ready to level up

Read ONBOARDING.md and PROJECT_OBJECTIVE.md

Pick a mini-task from job assignments.

## 10) Appendix

    A. Quick diffs

        git status
        git diff --stat
        git log --oneline -n 5


    B. Verify .gitignore

        echo junk > node_modules/.probe
        git status --ignored | egrep node_modules
        rm -f node_modules/.probe


    C. Remote hygiene

        git remote -v
        # personal:
        # git remote set-url origin git@github.com:<user>/<repo>.git
        # work:
        # git remote set-url origin git@github-work:<user>/<repo>.git

## 11) Dev job assignments (pick one)

    Docs Captain – keeps README/ONBOARDING updated per PR.

    Template Wrangler – add src/* variants (curved/zigzag/compact).

    Data Modeler – JSON schema + validation pre-build.

    Build/Tooling – Makefile targets, VS Code config, CI smoke.

    QA Visual Diff – manage golden images + pixel-diff checks.


---

 `.vscode/launch.json` (ready-made VS Code debug)

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "type": "node",
      "request": "launch",
      "name": "Run generator.js",
      "program": "${workspaceFolder}/generator.js",
      "cwd": "${workspaceFolder}",
      "console": "integratedTerminal",
      "skipFiles": ["<node_internals>/**"]
    }
  ]
}


Commit this to the repo so juniors just hit ▶️ and go.

