# Question bank

The seeded content for the `questions` table. One file per round; Round 4 has no file
because on the platform it is only the Nether Portal repair — every game in that hour is
run off-platform and credited on `/admin/resources` (see `docs/REMOVED_SYSTEMS.md`).

> **These files contain every answer key.** Anyone who can read this folder can win the
> event. Keep repo access to organizers, or move the folder out of git before the event.

## Editing

```bash
node scripts/seed-questions.mjs                     # dry run, every round
node scripts/seed-questions.mjs --round=1           # dry run, one round
node scripts/seed-questions.mjs --round=1 --confirm # write it
```

Rows are matched on `(round_id, order_index)` — the table's unique key — so re-running is
safe. An existing question is updated in place and keeps its `id`, which means every
submission pointing at it stays valid. The dry run prints `insert` / `update` / `unchanged`
per row before anything is written.

Two guards worth knowing:

- The script **refuses to write to a round that already has submissions**. Editing a
  question after teams have answered changes what they were graded against. `--force`
  overrides it; only use that before the round opens.
- `--prune` deletes rows the JSON no longer lists, but skips any question a team has
  already answered.

## Field reference

| Field | Notes |
|---|---|
| `order_index` | `1–99` round questions · `101+` guardian pack · `201+` PvP pack. Unique per round across all three. |
| `type` | `crossword · aptitude · output · debugging · code_completion · coding · pvp · logic_puzzle · debug_output` |
| `title` | Review metadata only. The script does not write it to the database. |
| `prompt` | A string, or an array of lines joined with newlines — the array is easier to edit. Rendered as pre-wrapped monospace, so code blocks keep their shape. |
| `reward` | Paid automatically when the answer grades correct. Must be empty for guardian and PvP questions — their own resolver pays those, so a reward here pays the team twice. The script rejects it. |
| `expected_answer` | `{ "any_of": [...] }`. Matching is trim + lowercase + collapsed spaces, so list every spelling a team might reasonably type. No key at all ⇒ the answer goes to manual review, never auto-marked wrong. |
| `guardian_name` | `forest_guardian · skeleton_archer · blaze_guardian`. Served only inside a battle, never in the round list. |
| `hidden_test_cases` | Round 5 `coding` only, used by the Piston runner. |

## What grades itself, and what does not

| Round | Path | Result |
|---|---|---|
| 1, 2 | deterministic answer key | fully automatic |
| 3 | deterministic for debugging / guardian / PvP | the 2 `coding` questions go to manual review |
| 5 | `coding` → Piston, everything else → answer key | fully automatic |

Round 5 grading (`lib/grading/day2-round5.ts`) tries these in order:

1. **`coding` → Piston.** Each hidden test case runs on its own; all of them must match.
   Code that fails to compile is a wrong answer. A transport error, a 401 or a quota
   refusal is *not* — that parks in manual review so nobody is marked wrong by an outage.
2. **A seeded answer key.** This now beats the language model, so the logic puzzles — which
   ask for a single number — are checked against `expected_answer` rather than sent to an LLM.
3. **Groq**, for a question that has a `rubric` and no answer key. Nothing seeded routes
   here today; it is the fallback for open-ended questions added later.
4. **Manual review**, when none of the above can decide.

`PISTON_API_URL` and `PISTON_API_KEY` are set in `.env.local` and verified working for
Python, C++, C and Java. `GROQ_API_KEY` is present but empty — paste a key from
console.groq.com if you add a rubric question.

The Round 5 UI lets a team pick its language, and the choice is what gets run. Java
submissions must use `public class Main`, which the question prompts say.
