# Phase 3 Frontend — Day 2 Gameplay UI (planning stage — builds after Phase 2)

**Status: not built yet.** This translates the UI-relevant parts of `PHASE3_MASTER.md` and the three Phase 3 `PROMPT_DEV_*.md` files. Those `PROMPT_DEV` files are the binding file-path contract — this doc is the plain-language tour on top of them.

Read [00-how-the-frontend-works.md](./00-how-the-frontend-works.md), [02-phase-2-frontend.md](./02-phase-2-frontend.md), and [../backend/03-phase-3-backend.md](../backend/03-phase-3-backend.md) first. Phase 3 reuses Phase 2's round shell, resource bar, and question components rather than building parallel copies — most of Dev 4's Phase 3 work is *extending* files they already own, not creating new ones.

## New top-level routes and who builds them

```
app/(day2)/portal/page.tsx             Dev 3 — Portal Repair status screen
app/(day2)/final-boss/page.tsx         Dev 3 — Final Boss fight screen
app/(game)/round/[round_id]/**          Dev 4 — EXTENDED to also serve Round 5 (The End)
app/leaderboard/**                      Dev 4 — EXTENDED with a "final/provisional" mode
app/admin/day2-ops/page.tsx            Dev 5 — organizer console for Day 2 operations
```

`(day2)` is another route group like `(game)` — organizing folder, invisible in the URL. New component folders: `components/day2/portal/**`, `components/day2/final-boss/**`, `components/day2/winner/**` (Dev 3); `components/day2/end-round/**` (Dev 4, alongside their existing `components/game/**`); `components/admin/day2-ops/**` (Dev 5). Same rule as Phase 2: nest inside these nowhere-flat directories, or two devs' PRs will collide on file paths that were never supposed to overlap.

## The very first thing every Day 2 screen does: check qualification

Before rendering anything else, every Day 2 page/route checks the team's frozen Phase 2 `qualified_for_day2` flag server-side. A non-qualified team sees a plain, respectful "Day 2 access is not available for your team" message — **it must never reveal who did qualify, or why it failed**, just its own status. Design this state deliberately; it's not an error page, it's an expected outcome for roughly half the teams.

## `/portal` — Portal Repair status (Dev 3)

Round 4's actual mini-games are run physically by volunteers — this screen is a **status display, not a game**. It shows one of: locked, collecting, missing-core, missing-fragment, diamonds-needed (with a running count toward 15), ready-to-repair, or repaired. Once every requirement shows green, a **Repair Portal** button appears — clicking it sends no resource counts at all (the server independently re-verifies everything), so the button is really just "ask the server to check and finalize," not "spend my resources."

The screen must clearly communicate, in copy, that a volunteer records the actual Round 4 game outcomes (Memory Challenge, Spot the Difference, Insta lollipop/soap, Crack the Code, Cup Flip) at their table — there's no self-report form here, and building one would be a scope violation of Dev 3's boundary.

## `/final-boss` — the climax screen (Dev 3)

Three states to build for:

1. **Locked** — shows exactly what's missing: portal not repaired, and/or Diamond Pickaxe not yet crafted (that craft button lives in Dev 4's Round 5/crafting UI, this screen just links to it), and/or Round 5 not active yet.
2. **Attempt in progress** — the boss question(s) for the current attempt only; never a future pack. A clean, high-stakes presentation is worth extra design care here — this is the moment the whole event builds to.
3. **Result** — a defeat shows the 3-minute cooldown counting down and an unlimited-retries message once it clears. A victory shows a **provisional** result, worded carefully: the team is told they won their fight, but the copy should not claim "you are the champion" — actual champion certification is a separate, admin-confirmed step that might (rarely) involve a tie-break. Simply starting an attempt — win or lose — visibly and permanently marks the team as having "weakened the Dragon," which matters if the Dragon's Fury event triggers later; consider surfacing that as a small status note.

## Round 5 — "The End" (Dev 4, extending their existing Phase 2 round shell)

Same UI machinery as Phase 2's round shell (`app/(game)/round/[round_id]/**`, `components/game/questions|resources|crafting/**`), extended rather than duplicated, plus a new `components/day2/end-round/**` piece for anything Round-5-specific. Seven questions total: 3 coding, 2 logic-puzzle, 2 debug/output — the UI doesn't need type-specific new components beyond what Phase 2 already built for those same question types.

Two Round-5-specific additions:
- **Diamond Pickaxe crafting** — same crafting UI pattern as Phase 2's pickaxes/armor, cost 25 Iron + 20 Gold + 100 Diamonds + 10 Emeralds, and once it succeeds the UI should clearly point the team toward `/final-boss` (which is now unlocked).
- **End Merchant** — a one-time optional trade choice, same "explicit modal before commit" pattern as Phase 2's Ancient Shrine/Piglin Merchant: trade 5 Emeralds→18 Diamonds, or 12 Diamonds→4 Emeralds, or skip.

## `/leaderboard` — extended for Day 2 (Dev 4)

The existing Phase 2 leaderboard page gains a "final standings" mode. Critically, **it stays read-only and explicitly labeled "provisional" until Dev 3 publishes a certified winner** — this page must never look like it's the one declaring a champion. Once certification is published, the UI can switch its label/badge to "Certified."

## `app/admin/day2-ops/page.tsx` — organizer console (Dev 5)

Same "several sections on one console" shape as Phase 2's `game-ops` page:

- **Round 4 offline result entry** — a form per canonical activity (Memory Challenge, Spot the Difference, Insta lollipop/soap, Crack the Code, Cup Flip), each showing the calculated award before confirming, and a repeated-submission-safe confirmation (shows the prior recorded result instead of double-paying).
- **Round 5 grading** — same durable run/manual-review pattern as Phase 2's grading console, reused rather than rebuilt.
- **Day 2 world events** — three buttons: **Chorus Fruit Blessing** (opens a 5-minute +2 Emerald window on qualifying coding answers), **Enderman Ambush** (immediate -8 Diamonds to targeted teams), **Dragon's Fury** (-10 Diamonds to targeted teams that haven't started a Final Boss attempt yet — protected teams get a visible zero-effect record, not silence).
- **Manual adjustments** — same signed-delta + required-reason pattern as Phase 2. Explicitly cannot repair a portal, craft a pickaxe, resolve a boss attempt, or set a winner — those buttons simply don't exist on this console.
- **Reconciliation** — before anyone can be certified champion, this section assembles the evidence (qualification snapshot, resource ledger version, portal status, Diamond Pickaxe status, boss outcome) into a record Dev 3's winner-certification screen consumes. This console **does not** have a "declare winner" button — that authority belongs entirely to Dev 3's `admin/winner/**` routes.

## Winner certification screen (Dev 3, likely inside the admin area)

Reviews provisional victory claims (see [../backend/03-phase-3-backend.md](../backend/03-phase-3-backend.md) for the full server-side tie-break logic), cross-checked against Dev 5's reconciliation record, and lets an organizer certify a champion. Handle the rare tie case explicitly in the UI — if two claims are truly simultaneous down to the millisecond, the screen should present both candidates and require an explicit organizer tie-break decision with a reason, never auto-pick one.

## Design consistency note

This is the emotional climax of the whole event — Final Boss and winner certification deserve the most polished version of the Minecraft-block visual language established in Phase 1/2, not a generic form. The Day 2 operator console (`day2-ops`) can stay utilitarian like the rest of the admin surface.

## File ownership recap

| Dev | Frontend paths |
|---|---|
| Dev 3 | `app/(day2)/portal/page.tsx`, `app/(day2)/final-boss/page.tsx`, `components/day2/portal/`, `final-boss/`, `winner/` |
| Dev 4 | `app/(game)/round/**` (extended), `app/leaderboard/**` (extended), `components/day2/end-round/**` |
| Dev 5 | `app/admin/day2-ops/page.tsx`, `components/admin/day2-ops/**` |

Same frozen list as always: `app/dashboard/**`, `app/admin/(panel)/layout.tsx`, `components/ui/**`, `proxy.ts`, plus now every Phase 1 and Phase 2 owned path too — Phase 3 integrates through APIs and read-only state, never by editing another phase's files.
