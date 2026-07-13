# MINEVERSE — Landing Page Timeline Section (Spec)

Reference format: vertical stepped timeline with left-side time labels, connecting line, and stage markers (as seen in the "Event Timeline" section of the Housie of Fame reference) combined with the compact card-grid density of the Espionage "Operations Schedule" section. Since Mineverse spans 2 days, this spec uses a **day-tabbed vertical timeline**: two toggle tabs (Day 1 / Day 2) above a single connected stepper, so the section doesn't get too long on one scroll.

---

## Section Header

- **Eyebrow label:** `SCHEDULE`
- **Heading:** `Event Timeline`
- **Sub-line:** `Two days. Five rounds. One champion.`

## Day Toggle

Two pill/tab buttons above the stepper:
- `DAY 1`
- `DAY 2`

Default active: `DAY 1`. Switching tabs swaps the stepper list below with a fade/slide transition.

---

## DAY 1 — Timeline Items

| Time | Stage | Marker Style | Description |
|---|---|---|---|
| |
| 9:00 – 10:00 AM | Registration & Check-in | ○ default | Team registration, ID verification, welcome kit distribution, seating arrangement |
| 10:00 – 10:40 AM | Opening Ceremony | ○ default | Welcome address, faculty speech, sponsor introduction, inauguration, club introduction |
| 10:40 – 11:00 AM | Gameplay Briefing & Platform Demo | ○ default | Explain rules, scoring, gameplay mechanics, crafting, structures, platform demonstration |
| 11:00 – 11:45 AM | Round 1 — Forest Biome | ● highlight (active round) | Coding challenges, Forest Guardian, Wooden Pickaxe crafting |
| 11:45 AM – 12:00 PM | Buffer Time | ○ muted | Submission collection, answer evaluation, resource calculation, technical sync |
| 12:00 – 1:00 PM | Round 2 — Cave Biome | ● highlight | Coding challenges, Skeleton Archer, world event, marketplace, Stone Pickaxe crafting |
| 1:00 – 1:10 PM | Buffer Time | ○ muted | Resource calculation, structure upgrade verification, marketplace updates, technical sync |
| 1:10 – 2:00 PM | Lunch Break | ○ muted | 50 min (10 min counted in buffer) |
| 2:10 – 3:20 PM | Round 3 — Mountain Biome | ● highlight | Coding challenges, Blaze Guardian, world event, marketplace, Iron Pickaxe crafting |
| 3:20 – 3:30 PM | Buffer Time | ○ muted | Final resource verification, qualification validation, leaderboard finalization |
| 3:30 – 3:45 PM | Qualification (PvP Battle) & Leaderboard | ★ special | Verify scores and resources, announce teams qualified for Day 2 |
| 3:45 – 4:00 PM | Snack Break | ○ muted | Tea, coffee, snacks *(if arranged)* |
| 4:00 – 4:40 PM | Fun Activities & Day 1 Closing | ○ default | Minecraft Quiz, Speed Debugging, Sponsor Activities; recap, qualified teams announcement, Nether Finale teaser |

## DAY 2 — Timeline Items

| Time | Stage | Marker Style | Description |
|---|---|---|---|
| 9:00 – 10:00 AM | Venue Preparation | ○ default | Final technical setup, volunteer briefing, resource verification |
| 10:00 – 10:20 AM | Welcome Back & Day 1 Recap | ○ default | Recap, explain the final round, clarify doubts, verify inventories |
| 10:20 – 11:20 AM | Round 4 — Pre-Final Round | ● highlight | All physical games played in this round (Nether Portal repair) |
| 11:20 – 11:35 AM | Buffer Time | ○ muted | Resource calculation and verification |
| 11:35 AM – 12:35 PM | Round 5 — Final Round | ● highlight | Coding and technical challenges (The End) |
| 12:45 – 1:45 PM | Lunch Break | ○ muted | 60 min |
| 1:45 – 2:15 PM | Final Result Compilation | ○ default | Final scoring and winner confirmation; fun activity during this time |
| 2:15 – 3:00 PM | Prize Distribution & Closing Ceremony | ★ special | Winners announcement, certificates, special awards, vote of thanks, group photo |
| 3:00 – 3:30 PM | OC Debriefing | ○ muted | Internal wrap-up (organizing committee only) |

---

## Visual / Marker Legend

- **○ default** — standard round-dot marker, neutral color
- **○ muted** — smaller/lower-opacity marker for breaks & buffers (de-emphasized on the line)
- **● highlight** — filled marker in accent color, slightly larger, used for the 5 main gameplay rounds
- **★ special** — star/trophy-style marker for qualification and prize-distribution moments (mirrors the Housie reference's amber dot on "Game Begins")

## Layout Notes (for dev handoff)

1. **Structure:** left-aligned time column → vertical connecting line → marker → content card (title + description), matching the Housie of Fame reference layout.
2. **Line behavior:** the connecting line should visually "fill" or brighten up to the current/most recent item if this is used live during the event (optional progressive-fill state); otherwise static.
3. **Mobile:** collapse time column to sit above the title inside each card (stacked), keep the vertical line on the far left as in both references.
4. **Day toggle:** persists scroll position; switching tabs should not jump the page.
5. **Color:** use the site's existing accent color for `highlight` and `special` markers; `default`/`muted` markers use neutral border/gray tones — consistent with how both references reserve color for emphasis only (red/gold accents in Housie, coral/red in Espionage).
6. **Buffer/break rows:** keep visually lighter/smaller than main round rows so the 5 core rounds remain the visual anchors of the section, similar to how Espionage's schedule grid separates "Rounds" from "Bonus"/"Intermission" entries by weight, not just labels.

---

*Content sourced from `Mineverse_Full_Event_Details.md`. Update this file if round timings or names change (note: reconcile "Ice Golem" vs "Blaze Guardian" naming for Round 3 before final copy goes live).*
