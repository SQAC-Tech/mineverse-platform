# MINEVERSE — Phase 3 Testing Document

> **Partly superseded by [`../REMOVED_SYSTEMS.md`](../REMOVED_SYSTEMS.md) (14 Aug 2026).** Structures,
> negative world events, and platform-recorded offline games were removed. Where this document
> describes any of them, it is a record of what was planned, not of what exists.
## Day 2 Portal, Final Boss & Winner Certification

**Test stack:** Continue Phase 1/2: Vitest for unit/integration, Playwright for E2E, and k6 for bounded load checks.  
**Scenario authority:** `../event details/Mineverse_Full_Event_Details.md`

## 1. Test environment and fixtures

- Use an isolated Supabase schema/project with Phase 1 and Phase 2 migrations applied in order.
- Freeze server time for portal repair, event expiry, boss cooldown, and winner-order tests.
- Create explicit qualified and non-qualified Phase 2 handoff fixtures; never mock qualification only in the client.
- Mock Groq/Piston for regular suites. Any live provider smoke test is separately tagged and uses no production question/boss data.
- Seed a controlled Round 5 pack and a versioned Final Boss pack whose answer/test data is server-only.

## 2. Unit tests

### 2.1 Admission and portal state (Dev 3)

- Every Day 2 read/write rejects a non-qualified team before exposing state.
- Portal repair fails with Nether Core missing, fragment missing, 15-Diamond threshold missing, and combined missing states.
- Exactly one Nether Core, one fragment, and 15 Diamonds repair the portal once; retries do not create another repair or ledger entry.
- Portal repair does not deduct core/fragment/Diamonds under the current event rule.
- Offline result awards update portal progress only after an accepted, idempotent operator record.

### 2.2 Round 5 delivery and crafting (Dev 4)

- Team serialization hides answers, rubrics, boss links, hidden tests, and unselected logic-puzzle variants.
- Exactly 3 coding, 2 logic, and 2 debug/output questions are seeded/displayed.
- Round locks/expiry prevent submission revisions and resource awards after the cutoff.
- Coding/logic/debug rewards match the event brief.
- Diamond Pickaxe requires repaired portal and exact cost before persisted discount policy; duplicate craft cannot deduct twice.

### 2.3 Final Boss and winner records (Dev 3)

- Boss start requires qualified status, repaired portal, Diamond Pickaxe, an active Round 5, and no cooldown.
- Defeat creates a three-minute cooldown; retries after it are allowed; active attempt cannot be started twice.
- Victory writes one immutable completion timestamp and one candidate claim.
- Earlier valid server completion wins provisional claim; later victory cannot replace it.
- Equal completion timestamps enter `pending_tiebreak`; certification requires a documented resolver decision.
- A certified winner can be overturned only through a new immutable audit record, not an update in place.

### 2.4 Operations and events (Dev 5)

- Each Round 4 individual/PvP activity validates canonical win/loss reward rules and pays only once.
- The no-numeric-award lollipop/soap activity rejects an award unless organizer configuration is present.
- Chorus Fruit Blessing adds +2 Emeralds only to qualifying coding awards within its server window.
- Enderman Ambush deducts 8 Diamonds atomically and never makes a balance negative.
- Dragon’s Fury deducts 10 Diamonds only from teams with no started Final Boss attempt; a team with any started attempt (win or lose) is protected and gets a zero-effect protection record.
- The Dragon’s Fury weakened check reads server-side boss-attempt state; a client-supplied “weakened” claim has no effect.
- Grading/provider failure creates manual-review state, not an assumed zero/success.
- Manual adjustments and reconciliations require admin scope, reason, idempotency, and complete audit links.

## 3. Integration tests

| Scenario | Required assertion |
|---|---|
| Day 2 gate | Qualified team succeeds; non-qualified team receives safe `403` on every Day 2 family. |
| Offline entry | Volunteer record writes activity result, resource ledger link, and portal refresh exactly once. |
| Portal repair | Locked transaction sees Nether Core + fragment + Diamonds, repairs once, and makes Round 5 access available. |
| Round 5 submission | Safe question fetch → revision → lock → durable grade run → one final reward. |
| Day 2 events | Persist event before broadcast; polling sees modifier/effect after missed broadcast. |
| Diamond Pickaxe | Insufficient state/cost fails without mutation; success logs craft and unlocks boss once. |
| Boss race | Concurrent valid victory submissions produce ordered candidates with one provisional winner. |
| Reconciliation | Admin record rechecks resource/portal/craft/boss state and winner certification refuses incomplete states. |
| Authorization | Team cannot access other team portal/boss state; attendance/non-admin cookies fail all admin Day 2 APIs. |

## 4. E2E tests (Playwright)

### 4.1 Day 2 return and Portal Repair

1. Sign in as a qualified team and verify carried inventory and locked Portal Repair state.
2. Confirm a non-qualified team receives the Day 1 outcome and cannot navigate to Day 2 gameplay.
3. Admin records Memory Challenge and Spot the Difference; team sees verified rewards after a server refetch.
4. Repair portal at Nether Core ×1 / 1 fragment / 15 Diamonds and verify the state becomes immutable/repaired; verify a fixture team without the Day 1 Nether Core sees “core missing” and cannot repair.

### 4.2 The End and Final Boss

1. Open active Round 5 and verify seven safe question cards and status UI.
2. Submit/revise answers, run grading, then verify balance/ledger updates and Chorus Fruit indicator when active.
3. Craft Diamond Pickaxe and confirm exact displayed/deducted cost.
4. Start Final Boss, simulate defeat, verify cooldown, then retry.
5. Submit a valid victory and verify provisional—not self-certified—winner status.

### 4.3 Results certification

1. Have at least two qualified teams complete boss attempts with different server times.
2. Reconcile the candidate team and certify the winner from the admin console.
3. Verify published standings, retained audit links, and no client can alter the result.
4. Exercise the explicit tie-break path with equal timestamps.

## 5. Manual event-day rehearsal

- Rehearse volunteer use of the Round 4 score sheet and matching admin entry screen.
- Confirm organizers know which activities are offline and that lollipop/soap has no automatic reward unless configured.
- Rehearse portal repair state, Round 5 unlock, grading fallback, Chorus Fruit, Enderman Ambush, Dragon’s Fury (protected and unprotected teams), Diamond Pickaxe, Final Boss cooldown, and winner certification.
- Simulate weak Wi-Fi, browser refresh, duplicate double click, Realtime loss, Piston/Groq failure, and final-boss simultaneous submission.
- Independently compare winner timestamp, portal/craft prerequisites, and ledger result before certification.

## 6. Load and security checks

### 6.1 Load

Test the qualified team count with simultaneous Round 5 fetches/submissions, event polling, and final-boss start/submit requests. Measure error rate, lock contention, duplicate ledger/candidate claims, provider queue recovery, and time from verified victory to provisional state. Do not load-test real providers without explicit approval.

### 6.2 Security checklist

- [ ] Server checks qualification, portal, craft, boss ownership, and round state on every relevant route.
- [ ] Answer keys, logic variants, boss packs, provider secrets, and admin-only audit data do not reach browsers.
- [ ] Admin scope is cookie-verified per route; no header/caller-provided identity grants authority.
- [ ] Idempotency, unique constraints, and authorization are tested under retries/concurrency.
- [ ] Winner certification relies only on server state/time and contains complete audit evidence.
- [ ] Dragon’s Fury protection is decided only by server-side boss-attempt state; no client input can claim it.

## 7. Sign-off criteria

Phase 3 is ready only when a qualified-team Portal Repair → Round 5 → Diamond Pickaxe → Final Boss → certification rehearsal passes; a non-qualified access test passes; no duplicate ledger/craft/claim is observed under retries; provider/manual fallbacks are rehearsed; and organizers have signed off on the final boss pack, offline award configuration, and tie-break policy.
