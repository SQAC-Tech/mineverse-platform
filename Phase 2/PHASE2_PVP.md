# MINEVERSE - Phase 2 Online PvP Specification
## Round 3 Mountain Biome: Private Team Question Duels

**Status:** Planning / documentation only  
**Mechanics source:** `../event details/Mineverse_Full_Event_Details.md`  
**Related contracts:** `PHASE2_PRD.md`, `PHASE2_API.md`, `PHASE2_DATABASE.md`, and developer prompts

## 1. Product decision

Round 3 PvP is an online, private, two-team question duel. It is not a public PvP mode, a free-for-all, an attendee-created lobby, an automatic pairing system, or a bracket builder.

The event brief says that Iron Armor is required before PvP and that the team solving the PvP questions in the least time wins. This design implements that directly: an organizer selects two eligible teams and presses **Start PvP**. Both teams receive the same approved question pack at the same server-controlled moment. The fastest team to complete every required answer correctly wins.

## 2. Match flow

```text
Admin selects Team A + Team B + approved PvP pack
        -> eligibility validation
        -> private draft match
        -> Start PvP
        -> server starts timer and reveals same sealed questions to both teams
        -> teams submit answers independently
        -> server validates completion time and resolves winner
        -> winner award + immutable PvP result
        -> Dev 3 qualification review and top-50% confirmation
```

There is no bracket to create. Organizers repeat this flow for the pairs they choose. The qualification screen remains the final organizer-controlled top-50% decision, so an unusual attendance case, voided match, or organizer-approved tiebreak is not hidden behind automatic bracket logic.

## 3. Eligibility and visibility

A team may be selected only when all of the following are true:

- Round 3 is active and unlocked by the existing Phase 1 controls.
- The team has crafted Iron Armor.
- The mandatory Blaze Guardian requirement is satisfied, as defined by the Phase 2 qualification policy.
- The team has no final Round 3 PvP result and is not already in another active PvP match.

Only the two selected teams and authorized admins can read a match. Before it starts, a selected team sees only a waiting state. Once started, it can see its own prompts, deadline, own drafts/submissions, and final result. It never sees answer keys, hidden tests, the opponent's answers, opponent progress, opponent completion time before resolution, or other teams' matches.

## 4. Fairness model

The server is authoritative for every meaningful match fact:

| Fact | Authority |
|---|---|
| Question pack and order | Server snapshot at match creation/start |
| Start time and deadline | Server transaction behind **Start PvP** |
| Correctness | Server-held expected answer, rubric, or test case |
| Completion time | Timestamp of the server-validated final correct answer |
| Winner | Server comparison of elapsed completion time |
| Award and result | Single atomic resolution transaction and resource ledger entry |

Question-pack size and time limit are organizer configuration. The documents intentionally do not invent a numeric value absent from the event brief. The team browser may show a countdown but cannot start, extend, stop, or decide a match. Realtime notifications are optional; the active match view polls the server every five seconds so a missed event or reconnect cannot change the result.

## 5. Result and reward

A team completes only when every required answer in the selected pack is correct. The team with the least server-measured elapsed completion time wins. A transaction locks the match, records winner and loser, applies the winner's award exactly once, and creates the immutable result consumed by qualification.

The canonical winner award from the event brief is:

- Nether Core x1
- +20 Gold
- +15 Iron
- +25 Stone
- +4 Emerald

The losing team receives no invented PvP victory award and does not meet the normal “win PvP to advance” qualification requirement. The qualification flow uses the winning result plus an explicit top-50% confirmation. An exceptional organizer override, if ever needed, must be a separate auditable qualification decision; it is not a normal match outcome.

## 6. Failure, dispute, and replay rules

| Situation | Required handling |
|---|---|
| One team refreshes or briefly disconnects | Match continues on the server; the team reconnects to the same state and deadline. |
| Neither team completes before deadline | Mark `expired`; no automatic award. |
| Organizer stops an invalid/unfair match before resolution | Mark `cancelled` or `voided` with a non-empty audit reason; no automatic award. |
| Equipment/network or organizer issue needs another attempt | Create a new replay match linked to the original; never edit prior match history. |
| Both completion writes arrive concurrently | Lock/resolution transaction selects the minimum server timestamp and writes one result. |
| A result is disputed after resolution | Preserve result, question-pack version, submissions, timestamps, actor/audit data, and linked ledger entry for organizer review. No client-side correction exists. |

A resolved match is immutable. A void cannot overwrite it; a correction requires the existing audited manual-review/qualification process, never a hidden database edit.

## 7. Data and API boundary

Dev 5 owns the admin routes and match storage: create/select, start, monitor, cancel/void, replay, and server resolution. Dev 4 owns only selected-team PvP routes and components. Dev 3 reads the resolved result for qualification. This ownership is deliberately split to avoid merge conflicts.

The required persisted concepts are `pvp_matches`, exactly two `pvp_match_teams`, sealed `pvp_match_questions`, team-specific `pvp_match_submissions`, and immutable `pvp_results`. See `PHASE2_DATABASE.md` for constraints.

The externally visible route contract is:

| Role | Routes | Purpose |
|---|---|---|
| Team | `GET /api/team/pvp/current`, `POST /api/team/pvp/submissions` | Read/submit only own active match. |
| Admin | `POST /api/admin/pvp/matches`, `POST /api/admin/pvp/matches/[id]/start` | Select teams and press Start PvP. |
| Admin | `GET /api/admin/pvp/matches/[id]`, `POST /api/admin/pvp/matches/[id]/void` | Monitor, audit, or void safely. |

Every mutation uses server-side session/scope checks, schema validation, an idempotency key, and the existing atomic resource-ledger contract. No route accepts a browser-supplied team identity, admin identity, winner, elapsed time, or resource award as authority.

## 8. Explicit non-goals

- No attendee-created match or opponent selection.
- No public lobby, public queue, spectator feed, chat, ranking ladder, or bracket visualizer.
- No client-to-client authority or client clock scoring.
- No opponent answer/progress reveal before final resolution.
- No automatic replay or automatic qualification decision.
- No change to Phase 3 Round 4: its PvP-labelled mini-games remain offline volunteer-run activities.

**Last updated:** 2026-07-14
