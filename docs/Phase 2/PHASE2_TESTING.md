# MINEVERSE — Phase 2 Testing Document

> **Partly superseded by [`../REMOVED_SYSTEMS.md`](../REMOVED_SYSTEMS.md) (14 Aug 2026).** Structures,
> negative world events, and platform-recorded offline games were removed. Where this document
> describes any of them, it is a record of what was planned, not of what exists.
## Day 1 Gameplay Engine: Test Strategy and Event-Day Rehearsal

**Test stack:** Continue Phase 1: Vitest for unit/integration tests, Playwright for E2E, and k6 for load checks. Do not introduce Jest merely for Phase 2.  
**Source of scenarios:** `../event details/Mineverse_Full_Event_Details.md`

## 1. Test environment and fixtures

- Use an isolated Supabase project/schema and non-production provider keys.
- Freeze test time for round start/end, world-event expiry, and guardian cooldown cases.
- Mock Groq and Piston in unit/integration suites; run a separately tagged live-provider smoke test only with safe credentials.
- Seed teams with Phase 1 session fixtures, explicit round access, and a deterministic starting inventory.
- Never put production questions/answer keys in public fixtures or browser-visible snapshots.

## 2. Unit tests

### 2.1 Resource atomicity and ledger (Dev 4/5)

- Full, partial, zero, and event-multiplied awards use the chosen rounding rule.
- Costs cannot make a balance negative; a failed cost changes neither balance nor ledger.
- Same idempotency key returns the initial result and creates one ledger entry.
- Concurrent craft/purchase/event requests leave a correct non-negative balance.
- A score override applies only the score delta, including reversal from 100 to 50.
- Ledger `balance_after` matches the current balance after every committed mutation.

### 2.2 Questions, submissions, and crafting (Dev 4)

- Safe question serialization omits expected answers, rubrics, hidden cases, and protected rewards.
- A submission revision replaces the pending response; final grading is tied to the final revision.
- Locked/expired/unauthorized round submissions are rejected.
- Wooden Pickaxe, Stone Pickaxe, and Iron Armor use canonical costs.
- Forge and Master Forge discounts use one tested round-up rule.
- Duplicate craft requests can never unlock or deduct twice.

### 2.3 Guardians, structures, marketplace, qualification (Dev 3)

- Guardian reward can be claimed once; defeat cooldown lasts exactly three minutes.
- Totem prevents one penalty; retry token bypasses only a valid cooldown; strength potion affects one valid victory only.
- Base structures are free and only one is selectable per applicable round.
- Creeper/Bat Cave, Lava/Bastion, structure damage, repair, TNT consumption, and upgrades use canonical rules/costs.
- Marketplace purchase and subsequent item use are separate and idempotent.
- Each choice event can be decided once.
- Qualification rejects missing Iron Armor or missing recorded PvP result and freezes only after explicit admin confirmation.

### 2.4 Grading and world events (Dev 5)

- Normalization rules are deterministic and do not turn an ambiguous debugging answer into a guaranteed correct grade.
- Piston timeout/provider failure sends the submission to manual review and awards nothing.
- Groq JSON is schema-validated, clamped 0–100, and malformed output is recoverable failure.
- A grading run can resume without duplicate finalization or award.
- Positive modifiers affect only qualifying awards in their active window; guardian rewards are excluded from Heavy Rain.
- Protection/damage behavior for every negative event is covered.

### 2.5 Private online PvP (Dev 4/5)

- Only an admin can create a Round 3 match; it contains exactly two different teams, a canonical approved pack, and no bracket/public-join state.
- Match creation rejects a missing Iron Armor craft, unmet mandatory Guardian requirement, inactive Round 3, duplicate team selection, a team already in an active match, or a team with a final PvP result.
- Questions become visible to only the two selected teams after server `started_at`; neither response serializes answer keys, hidden tests, opponent answers, or opponent progress.
- Server completion time is created only after all required answers are correct. Winner selection uses server elapsed time, never a browser timestamp.
- Two concurrent final submissions resolve one winner and create exactly one PvP result and one winning reward ledger entry.
- Disconnect, deadline expiry, cancel, and void create no reward. Void requires a reason; a replay is a new linked match and cannot replace an already-resolved match.

## 3. Integration tests

| Scenario | Required assertion |
|---|---|
| Team question fetch | Valid team sees only its unlocked active round and no hidden answer data. |
| Submission lifecycle | Draft/revise/lock/grade works; post-lock update returns `403`; one final award exists. |
| Grade checkpoint | Existing round control locks first; run progresses through deterministic, rubric, manual-review, and completed states. |
| Resource mutation | Craft/purchase/event/offline result/override each write one signed ledger entry. |
| Guardian | Start → fail → cooldown → retry; consumables and one-time victory claim work. |
| World event | Trigger persists before broadcast; direct team re-fetch sees state even without Realtime. |
| Offline entry | Duplicate request does not pay twice; records identity, notes, and idempotency key. |
| Online PvP | Admin selects two eligible teams and starts a sealed match; only participants can submit; one server-resolved result/award is produced. |
| Qualification | Only Iron-Armor PvP winners enter the eligible set; organizer confirms cutoff, decision freezes, export is stable. |
| Authorization | Team cannot read/mutate another team; attendance panel cannot use admin routes; header admin key is rejected/irrelevant. |

## 4. E2E tests (Playwright)

### 4.1 Round 1 happy path

1. Sign in with a Phase 1 team session and enter an unlocked Forest round.
2. Save/revise a submission and verify no answer key appears in the browser.
3. Admin locks the round and completes the grading run.
4. Team sees updated balance through refetch/poll.
5. Trigger Heavy Rain and verify its banner/state, then test the optional guardian.
6. Craft Wooden Pickaxe and confirm Round 2 access.

### 4.2 Round 2 strategic path

1. Confirm structures become selectable only after ten minutes and cost no resources.
2. Build Bat Cave, trigger Creeper Explosion, and verify advance-warning protection plus damage/repair handling.
3. Record an offline game result once; verify the ledger update.
4. Apply Forge discount and craft Stone Pickaxe.
5. Select Ancient Shrine option and confirm it cannot be selected again.

### 4.3 Round 3 and organizer path

1. Run a Gold Rush and a protected/unprotected Lava Eruption scenario.
2. Craft Iron Armor and resolve the mandatory guardian for two selected teams.
3. Admin creates the private match, presses Start PvP, and verify both teams receive only their sealed question set.
4. Submit correct answers with distinct completion times; verify one winner award/result, no opponent-data leak, and eligibility review.
5. Void an interrupted practice match with a reason, then run a linked replay; verify no duplicate result/reward.
6. Confirm the top-50% cutoff, verify qualified and non-qualified team messages, and export the frozen list.

## 5. Manual event-day rehearsal

- Test on the actual organizer phones/laptops and projected display resolution.
- Rehearse round lock, “add five minutes,” grade start/resume, manual grade correction, world-event trigger, offline entry, selected-team Start PvP, disconnect/void/replay, and qualification confirmation.
- Simulate Groq failure, Piston timeout, a missed Realtime broadcast, a browser refresh, a duplicate double-click, and a weak network connection.
- Reconcile the final organizer-approved question pack, rewards, event definitions, and physical-game award plan against the event-detail source before seeding.
- Verify a volunteer can explain when to use the platform versus the offline score sheet.

## 6. Load and security checks

### 6.1 Load (k6)

At minimum test 50 simultaneous question reads/submissions, simultaneous answer submits from both sides of one PvP match, a grading checkpoint with the planned team count, and a world-event broadcast followed by polling fallback. Measure error rate, lock contention, duplicate ledger rows, result-resolution time, and time to resource visibility. Provider-bound grading load uses mocks unless explicitly approved.

### 6.2 Security checklist

- [ ] No team route trusts a browser-supplied team id.
- [ ] No Phase 2 table is directly readable/writable by an anonymous browser session.
- [ ] No expected answer, rubric, test case, Groq key, Piston key, or admin secret reaches client code/logs.
- [ ] Every admin route verifies the Phase 1 admin cookie and scope.
- [ ] Zod validates every route payload; IDs and enum keys are allowlisted.
- [ ] Idempotency and authorization are tested for all resource-changing operations.
- [ ] Error messages are safe and do not disclose another team’s state.

## 7. Sign-off criteria

Phase 2 is ready only when the full Round 1 rehearsal and one Round 2/3 strategic scenario pass; migration rollback/restore has been practiced in staging; no duplicate resource ledger entry appears under retry; operator fallback for Groq/Piston has been rehearsed; and the Day 2 handoff export is stable and auditable.
