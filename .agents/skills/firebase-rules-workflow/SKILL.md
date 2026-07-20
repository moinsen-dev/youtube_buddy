---
name: firebase-rules-workflow
description: Versioned workflow for Firestore/Storage security rules and indexes — repo as source of truth, MCP/CLI validation, emulator-based rules tests, approval-gated deploys. Use whenever changing security rules, adding Firestore queries that need indexes, or debugging permission-denied errors.
---

# Firebase Rules & Indexes Workflow

## Source of truth is the repo

`firestore.rules`, `storage.rules`, `firestore.indexes.json` are versioned files. **Never edit rules in the Firebase console** — console edits drift from the repo and get silently overwritten on the next deploy.

## Change flow

1. **Edit** the rules file in the repo (small, reviewable diff).
2. **Validate** before anything else: use the Firebase MCP rules-validation tool, or `firebase deploy --only firestore:rules --dry-run` equivalents from the CLI.
3. **Test against the emulator.** Rules changes ship with emulator-based tests (`@firebase/rules-unit-testing` or equivalent):

   ```sh
   firebase emulators:exec --only firestore 'npm run test:rules'
   ```

   Cover at minimum: unauthenticated denied, wrong-user denied, owner allowed, malformed payloads rejected.

4. **Deploy (dev only, without asking):** `firebase use default && firebase deploy --only firestore:rules,firestore:indexes,storage`
5. **Deploy to prod: only with explicit approval.**

## Indexes

- A query failing with `FAILED_PRECONDITION` + a console link means: missing composite index. Don't click the console link to create it — add the index to `firestore.indexes.json` and deploy.
- Deploy indexes together with rules so they stay in lockstep.

## Debugging permission-denied

1. Reproduce against the emulator (deterministic, no prod risk).
2. Check the simulator/evaluator output: which rule line, which `request` fields.
3. Fix the rule or the query shape — prefer making queries match rules over widening rules.
