# Code Quality Guide
## ESLint + Prettier + Husky + Lint-Staged

> This document explains WHY each tool exists, WHAT problem it solves, and HOW it was set up in the Weather App project.

---

## The Core Problem — Why These Tools Exist

Imagine working on a team:

```
Developer A writes:
var x = "hello";
if(x == "hello"){
    console.log("yes")
}

Developer B writes:
const x = 'hello'
if (x === 'hello') {
  console.log('yes')
}
```

Same logic — completely different style. Over time:
- Codebase becomes inconsistent mess
- Code reviews waste time on formatting debates
- Bugs slip in because of bad practices (var, ==)
- New developers get confused

**These 3 tools solve this completely — automatically.**

---

## The 3 Tools — What Each One Does

```
ESLint      → FINDS problems in your code
              "you used var, use const instead"
              "this variable is never used"

Prettier    → FIXES formatting of your code
              indentation, quotes, semicolons

Husky       → AUTOMATES running ESLint + Prettier
+ Lint-Staged  before every single git commit
              "you cannot commit bad/ugly code"
```

Think of it like this:

```
ESLint    = a strict teacher who finds your mistakes
Prettier  = an editor who formats your essay perfectly
Husky     = a guard who checks both before you submit
```

---

## Tool 1 — ESLint

### What is ESLint?

ESLint is a **linter** — a tool that statically analyzes your code to find problems WITHOUT running it.

### Why do we need it?

JavaScript is very flexible — it lets you write bad code without complaining:

```js
// JavaScript allows all of this — no errors
var x = 5           // var is outdated, should be const/let
let y = 10          // y is never used — wasted memory
if (x == "5") {}    // == is loose comparison, dangerous
```

ESLint catches these BEFORE they cause bugs in production.

### What problems does ESLint catch?

```
Code Quality:
→ var used instead of const/let
→ Variables declared but never used
→ == used instead of ===
→ console.log left in production code

React Specific:
→ Hooks called in wrong place
→ Missing useEffect dependencies
→ Props not defined correctly
```

### The Rules — What We Set and Why

```js
// Our ESLint rules and WHY each one exists

'no-unused-vars': 'warn'
// WHY: Unused variables waste memory and confuse developers
// "why is this variable here if it's never used?"

'no-console': 'warn'
// WHY: console.log is for debugging — shouldn't be in production
// It exposes internal info and slows performance

'prefer-const': 'error'
// WHY: const prevents accidental reassignment
// If you never reassign, use const — makes intent clear

'no-var': 'error'
// WHY: var has function scope (confusing), let/const have block scope (predictable)
// var was the old way — const/let is modern JavaScript

'eqeqeq': 'error'
// WHY: == does type coercion (dangerous)
// 0 == false → true (unexpected!)
// 0 === false → false (correct)
// Always use === for reliable comparisons

'react-hooks/rules-of-hooks': 'error'
// WHY: Hooks MUST follow specific rules
// Can't call hooks inside loops, conditions, or nested functions
// Breaking this rule causes unpredictable bugs

'react-hooks/exhaustive-deps': 'warn'
// WHY: useEffect with missing dependencies = stale data bugs
// Warns you when you forgot to include a dependency
```

### Error vs Warning — What's the difference?

```
'rule': 'error'   → blocks commit, MUST fix
'rule': 'warn'    → shows warning, CAN still commit
'rule': 'off'     → rule disabled completely
```

### ESLint Config File Explained

```js
// client/eslint.config.js

export default [
  // Global ignores — FIRST and SEPARATE
  // WHY: These folders contain third party code
  // We should NEVER lint node_modules, build folders
  // Linting them = 50,000+ errors from library code we don't control
  {
    ignores: [
      'node_modules/**',    // third party packages
      'dist/**',            // build output
      'storybook-static/**', // storybook build
      '.storybook/**',      // storybook config
      'playwright-report/**' // test reports
    ]
  },

  js.configs.recommended, // ESLint's built-in recommended rules

  {
    files: ['src/**/*.{js,jsx}'], // ONLY lint OUR source files
    // WHY: We only care about code WE wrote

    languageOptions: {
      globals: {
        console: 'readonly',   // tell ESLint these browser globals exist
        window: 'readonly',    // otherwise ESLint thinks they're undefined
        document: 'readonly',
        process: 'readonly',
      }
    },

    plugins: {
      react: reactPlugin,           // enables React specific rules
      'react-hooks': reactHooksPlugin // enables hooks specific rules
    },

    rules: { /* our rules */ },

    settings: {
      react: { version: 'detect' } // auto-detect React version
    }
  },

  prettierConfig // LAST — turns off ESLint rules that conflict with Prettier
  // WHY: ESLint and Prettier can disagree on formatting
  // This config tells ESLint "let Prettier handle formatting"
]
```

### How to Run ESLint

```bash
npm run lint        # find all problems
npm run lint:fix    # auto-fix what it can
```

---

## Tool 2 — Prettier

### What is Prettier?

Prettier is a **code formatter** — it takes your code and rewrites it in a consistent, opinionated style.

### Why do we need it if we already have ESLint?

```
ESLint  → finds CODE QUALITY issues (logic, best practices)
Prettier → fixes CODE FORMATTING issues (style, appearance)

They do different jobs:
ESLint:   "you used var instead of const" → logic problem
Prettier: "your indentation is wrong" → style problem
```

You need BOTH because ESLint doesn't format code — it only flags problems.

### What does Prettier actually change?

```js
// BEFORE Prettier (your messy code)
const obj={name:"Ritwiz",age:20,role:"developer"}
function hello(name){
    return "hello "+name
}
const double=(x)=>{return x*2}

// AFTER Prettier (clean, consistent)
const obj = { name: 'Ritwiz', age: 20, role: 'developer' }
function hello(name) {
  return 'hello ' + name
}
const double = x => x * 2
```

Same code — completely different readability.

### Our Prettier Rules and WHY

```json
{
  "semi": false,
  // WHY: Semicolons are optional in JavaScript (ASI handles it)
  // Removing them = cleaner, less visual noise
  // Modern JS style — React, Vue teams prefer no semis

  "singleQuote": true,
  // WHY: Single quotes are standard in JS ecosystem
  // Easier to type, consistent with Node.js conventions
  // Double quotes reserved for HTML attributes

  "tabWidth": 2,
  // WHY: 2 spaces is the JavaScript/React community standard
  // 4 spaces takes too much horizontal space
  // Tabs cause inconsistency across editors

  "trailingComma": "es5",
  // WHY: Trailing commas make git diffs cleaner
  // Without: adding new item = 2 line change (comma + new item)
  // With: adding new item = 1 line change (just new item)
  // Supported in ES5+ so safe to use

  "printWidth": 80,
  // WHY: 80 characters is the classic terminal width
  // Keeps code readable without horizontal scrolling
  // Forces you to break up long lines into readable chunks

  "bracketSpacing": true,
  // WHY: Spaces inside objects improve readability
  // {name:'Ritwiz'} → hard to read
  // { name: 'Ritwiz' } → easy to read

  "arrowParens": "avoid"
  // WHY: Single parameter arrows don't need parens
  // (x) => x * 2 → unnecessary parens
  // x => x * 2 → cleaner
}
```

### .prettierignore — What and Why

```
node_modules      → third party code, don't touch
dist              → build output, auto-generated
storybook-static  → storybook build, auto-generated
public            → static assets, not JS code
```

WHY ignore these? Prettier reformatting build files = breaking them. They're not meant to be human-readable.

### How to Run Prettier

```bash
npm run format        # formats ALL files (changes files)
npm run format:check  # checks without changing (CI friendly)
```

---

## Tool 3 — Husky + Lint-Staged

### What is Husky?

Husky is a tool that lets you run scripts automatically at specific Git events (hooks).

### What are Git Hooks?

Git has built-in trigger points called hooks:

```
pre-commit  → runs BEFORE a commit is created
pre-push    → runs BEFORE code is pushed
commit-msg  → runs when commit message is written
post-merge  → runs AFTER a merge completes
```

Husky makes these hooks easy to configure.

### Why do we need Husky?

Without Husky:
```
Developer forgets to run ESLint
Commits bad code
Bad code enters the repo
Other developers pull bad code
Problem spreads 😩
```

With Husky:
```
Developer tries to commit
Husky intercepts automatically
Runs ESLint + Prettier
Bad code → commit BLOCKED ❌
Developer forced to fix it
Only clean code enters repo ✅
```

**You can't forget — it's automatic.**

### What is Lint-Staged?

Lint-staged runs linters on ONLY the files you're about to commit (staged files).

### Why lint-staged instead of linting everything?

```
Without lint-staged:
git commit → ESLint runs on ALL files → slow (minutes)
Why check files you didn't change?

With lint-staged:
git commit → ESLint runs on ONLY changed files → fast (seconds)
Only check what you actually modified
```

This is the key insight — efficiency. Don't lint the entire codebase on every commit.

### How They Work Together

```
You write code
↓
git add . (stage your files)
↓
git commit -m "feat: something"
↓
Husky fires pre-commit hook
↓
lint-staged checks which files are staged
↓
Runs ESLint + Prettier on ONLY those files
↓
ESLint finds error → commit BLOCKED ❌
Fix the error → git add → git commit again
↓
ESLint passes + Prettier formats → commit goes through ✅
Clean code in repo
```

### The Pre-commit Hook File

```bash
# .husky/pre-commit
npx lint-staged
```

One line — that's all Husky needs. When you commit, this file runs automatically.

### Lint-Staged Config — What and Why

```json
{
  "lint-staged": {
    "client/src/**/*.{js,jsx}": [
      "eslint --fix",    // first: auto-fix what ESLint can
      "prettier --write" // second: format the file
    ],
    "server/**/*.js": [
      "eslint --fix",    // same for server files
      "prettier --write"
    ]
  }
}
```

WHY this order?
1. ESLint fixes code quality issues first
2. Prettier then formats the fixed code

If reversed — Prettier formats, then ESLint might reformat again. Wrong order = conflict.

---

## The Complete Automated Flow

```
You write code (messy or clean — doesn't matter)
↓
git add .
↓
git commit -m "feat: add weather feature"
↓
┌─────────────────────────────────┐
│   HUSKY PRE-COMMIT HOOK FIRES  │
│                                 │
│   lint-staged runs              │
│   ↓                             │
│   ESLint on staged files        │
│   → Error found?                │
│     YES → commit BLOCKED ❌     │
│            fix and try again    │
│     NO  → continue ✅           │
│   ↓                             │
│   Prettier on staged files      │
│   → Formats automatically ✅    │
│                                 │
│   Commit goes through ✅        │
└─────────────────────────────────┘
↓
Clean, formatted, quality code in repo
```

---

## Project Setup — Step by Step

### 1. ESLint Setup (client)

```bash
cd client
npm install -D eslint @eslint/js eslint-plugin-react eslint-plugin-react-hooks eslint-config-prettier --legacy-peer-deps
```

### 2. ESLint Setup (server)

```bash
cd server
npm install -D eslint @eslint/js
```

### 3. Prettier Setup (both)

```bash
# client
cd client
npm install -D prettier eslint-config-prettier --legacy-peer-deps

# server
cd server
npm install -D prettier eslint-config-prettier
```

### 4. Husky + Lint-Staged (root)

```bash
cd weather-app  # root folder
npm init -y
npm install -D husky lint-staged
npx husky init
```

---

## Files Created and Their Purpose

```
weather-app/
├── .husky/
│   └── pre-commit          ← runs lint-staged on every commit
├── package.json            ← contains lint-staged config
│
├── client/
│   ├── eslint.config.js    ← ESLint rules for React frontend
│   ├── .eslintignore       ← folders ESLint should skip
│   ├── .prettierrc         ← Prettier formatting rules
│   └── .prettierignore     ← folders Prettier should skip
│
└── server/
    ├── eslint.config.js    ← ESLint rules for Node backend
    ├── .prettierrc         ← same Prettier rules
    └── .prettierignore     ← folders Prettier should skip
```

---

## Scripts Reference

### Client (client/package.json)

```json
"scripts": {
  "lint": "eslint .",           // find all ESLint issues
  "lint:fix": "eslint . --fix", // auto-fix ESLint issues
  "format": "prettier --write .", // format all files
  "format:check": "prettier --check ." // check without changing
}
```

### Server (server/package.json)

```json
"scripts": {
  "lint": "eslint .",
  "lint:fix": "eslint . --fix",
  "format": "prettier --write .",
  "format:check": "prettier --check ."
}
```

---

## Common Errors and Solutions

### "ESLint couldn't find config file"
```
Problem: eslint.config.js doesn't exist or has typo in name
Solution: Check filename — must be exactly "eslint.config.js"
          Common typo: "eslint.comfig.js" ← extra 'm'
```

### "ERESOLVE could not resolve"
```
Problem: eslint-plugin-react not compatible with ESLint v10
Solution: npm install --legacy-peer-deps
          This bypasses strict peer dependency checking
```

### "51000+ errors from ESLint"
```
Problem: ESLint scanning node_modules or storybook-static
Solution: Add global ignores as FIRST item in eslint.config.js array
          { ignores: ['node_modules/**', 'storybook-static/**'] }
```

### "LF will be replaced by CRLF"
```
Problem: Windows (CRLF) vs Linux/Mac (LF) line endings
Solution: Add .gitattributes in root with "* text=auto"
          Just a warning — not an error, code still works
```

---

## Why This Matters for Your Career

In every professional team you join — these tools will be there. Knowing WHY they exist (not just how to use them) shows maturity.

When an interviewer asks:

> "How do you maintain code quality in a team?"

You can say:

> "We use ESLint for catching code quality issues like unused variables and loose comparisons, Prettier for consistent formatting across the team, and Husky with lint-staged to automate both on every commit so bad code can never enter the repository."

That's a complete, confident, professional answer. 💪

---

## Quick Reference — One Line Each

```
ESLint          → finds code problems before they become bugs
Prettier        → formats code consistently across entire team
Husky           → runs scripts automatically at git events
Lint-Staged     → runs linters only on files being committed
pre-commit hook → the specific git hook that fires before commits
.eslintignore   → tells ESLint which folders to skip
.prettierignore → tells Prettier which folders to skip
--legacy-peer-deps → bypasses npm peer dependency conflicts
```

---

*Weather App | github.com/ritwiz-sys*