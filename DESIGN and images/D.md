# Minecraft Nether Dashboard — Design Doc

**Theme:** Nether Portal / Crimson Forest aesthetic
**Reference:** Deep purple-black cave, glowing lava river, obsidian portal, warped crystals
**Core rule:** Font color is always the *negative/inverse* of whatever sits behind it — light glowing text on dark rock, dark obsidian text on bright lava-orange surfaces.

---

## 1. Concept

The dashboard should feel like you're standing inside the reference screenshot — a Nether cave lit only by a lava river and a glowing portal. UI panels are "obsidian slabs" floating in the dark, text glows like lava/portal particles, and accent actions (buttons, active states, alerts) borrow the molten orange of the lava.

Mood words: **volcanic, moody, glowing, blocky, ancient-tech.**

---

## 2. Color Palette

Extracted directly from the reference image.

| Token | Name | Hex | Usage |
|---|---|---|---|
| `--bg-void` | Void Purple | `#16000B` | App background, deepest shadow |
| `--bg-panel` | Obsidian Plum | `#26021C` | Card / panel background |
| `--bg-panel-raised` | Nether Violet | `#32034D` | Hover / raised panel, modal bg |
| `--accent-secondary` | Portal Magenta | `#4C0855` | Portal glow accents, secondary buttons, links |
| `--accent-danger` | Crimson Ember | `#550C1B` | Error states, destructive actions |
| `--accent-primary` | Lava Core | `#EB4704` | Primary CTA, active nav, key numbers |
| `--accent-primary-hover` | Molten Orange | `#D43B05` | Hover/pressed state of primary |
| `--accent-muted` | Ash Ember | `#96230E` | Borders, dividers, disabled-but-warm elements |
| `--text-onDark` | Glowstone White | `#FDF4E3` | Text on dark panels (Void/Plum/Violet) |
| `--text-onLava` | Obsidian Black | `#120008` | Text on lava-orange surfaces (buttons, highlights) |
| `--text-portal` | Portal Lilac | `#D9B3FF` | Secondary/muted text, links on dark bg — echoes the portal glow |

### Contrast rule (the "negative font" logic you asked for)
- Background is **dark purple/black → text is warm/light** (`--text-onDark` or `--text-portal`).
- Background is **lava orange (buttons, highlighted rows, active tab pill) → text is near-black** (`--text-onLava`), same as how Minecraft item text sits dark against glowing lava/gold.
- Never place `--text-onDark` on `--accent-primary` and never place `--text-onLava` on `--bg-void` — that's the one hard rule of this system.

---

## 3. Typography — "Minecraft" fonts

Minecraft's actual game fonts aren't licensed for general web/product use, but these are the standard free look-alikes used across the community for this exact aesthetic:

| Role | Font | Style notes | Where to get it |
|---|---|---|---|
| Display / Headings, big numbers | **Minecraft Ten** (aka "Minecraftia") | Blocky pixel font, all-caps friendly, closest match to the game's title font | Free — dafont.com / fontmeme, self-host the `.ttf`/`.woff2` |
| Body / UI text | **Mojangles** or **Monocraft** | Monocraft is a proper monospaced pixel font built to look like Minecraft's UI font but stays readable at small sizes — better for dashboard body text than Minecraftia | GitHub: `IdreesInc/Monocraft` (open source, has a proper webfont build) |
| Fallback stack | `'Minecraft Ten', 'Monocraft', 'Press Start 2P', monospace` | Always include a pixel-adjacent fallback since custom fonts can fail to load | — |

**Usage guidance:**
- Headings, section titles, KPI numbers → Minecraft Ten, uppercase, slight letter-spacing (`0.5–1px`) to mimic the game's blocky title cards.
- Body copy, table data, labels → Monocraft at 13–14px. It's monospaced, so numeric tables (stats, resource counts) line up naturally like an inventory grid.
- Avoid using the pixel display font below ~16px — it turns into mush. Drop to Monocraft or a plain system sans (Inter/Segoe UI) for dense small text if Monocraft itself gets too tight.
- Text-shadow trick for glow: `text-shadow: 0 0 6px rgba(235,71,4,0.6)` on primary lava-colored text/icons to sell the "glowing" feel — use sparingly (headlines, active states only), not on every line.

---

## 4. Layout & Surfaces

- **App background:** `--bg-void`, optionally with a very low-opacity (8–12%) version of the reference image as a fixed/blurred backdrop behind the whole dashboard — mountains + lava river silhouette peeking through, not competing with content.
- **Panels/cards:** `--bg-panel`, 2px border in `--accent-muted` at 40% opacity, **no rounded corners** (or max 2px radius) — Minecraft is blocky, avoid soft/rounded UI that breaks the theme.
- **Elevation instead of shadow blur:** since real Minecraft has no soft shadows, fake depth with a hard 1-block offset: `box-shadow: 4px 4px 0 #000000` (like inventory slot bevels) rather than a blurred drop shadow.
- **Grid:** treat major dashboard widgets like inventory slots — consistent square/rectangular blocks in a grid, small consistent gutters (8px multiples), snapping to a "block" rhythm.
- **Portal accent zone:** reserve one visual anchor (e.g., top-right of header, or a hero stat card) to render like the portal itself — magenta/purple gradient with an animated subtle shimmer — as the visual "landmark" of the dashboard, same role the portal plays in the image.

---

## 5. Components

| Component | Background | Text/Icon color | Border/Accent |
|---|---|---|---|
| Primary button | `--accent-primary` (Lava Core), hover → `--accent-primary-hover` | `--text-onLava` | none, hard shadow offset |
| Secondary button | `--bg-panel-raised` | `--text-onDark` | 1px `--accent-secondary` |
| Danger button | `--accent-danger` | `--text-onDark` | none |
| Nav sidebar | `--bg-void` | inactive: `--text-portal`, active: `--text-onLava` on a Lava Core pill | active item = orange pill |
| Cards/widgets | `--bg-panel` | `--text-onDark` headers, `--text-portal` sub-labels | `--accent-muted` border |
| KPI / stat numbers | inherits card bg | `--accent-primary` (glow text-shadow) | — |
| Data tables | `--bg-panel`, alt rows `--bg-void` | `--text-onDark` | row divider `--accent-muted` 20% |
| Alerts/toasts | success: keep lava-orange as "good" (torch light), error: `--accent-danger` | `--text-onLava` on orange, `--text-onDark` on crimson | — |
| Input fields | `--bg-void`, focus border `--accent-primary` | `--text-onDark`, placeholder `--text-portal` 60% | 1px `--accent-muted` |

---

## 6. Iconography & Texture Details

- Icons: pixel/blocky style icon set (16x16 or 32x32 grid feel) — no smooth vector icons; if using an icon library, pick one with a "retro/8-bit" variant or restyle with `image-rendering: pixelated` on small pixel-art icons.
- Optional decorative touches pulled straight from the reference: small purple crystal-cluster motif (like the Crimson Forest crystals in the image) as a corner flourish on empty states; a thin animated "lava crack" divider line between major sections using a horizontal gradient (`--accent-primary` → transparent) with a subtle pulse animation.
- Loading states: use a small pixel-art "lava bubble" or portal-swirl spinner instead of a generic spinner, to stay in-theme.

---

## 7. Accessibility Notes

- Lava Core (`#EB4704`) on Obsidian Black (`#120008`) and Glowstone White (`#FDF4E3`) on Void Purple (`#16000B`) both pass WCAG AA for normal text — verified as the two core pairings.
- Portal Lilac on Void Purple is best reserved for secondary/muted text (labels, timestamps) — check contrast if used for body copy at small sizes; bump to Glowstone White if a table gets dense.
- Don't rely on the orange/purple color pairing alone for status (e.g. success vs. error) — pair with icon or label text too, since this palette has a narrow hue range for colorblind users.

---

## 8. Quick CSS Variable Block

```css
:root {
  --bg-void: #16000B;
  --bg-panel: #26021C;
  --bg-panel-raised: #32034D;
  --accent-secondary: #4C0855;
  --accent-danger: #550C1B;
  --accent-primary: #EB4704;
  --accent-primary-hover: #D43B05;
  --accent-muted: #96230E;
  --text-onDark: #FDF4E3;
  --text-onLava: #120008;
  --text-portal: #D9B3FF;

  --font-display: 'Minecraft Ten', 'Press Start 2P', monospace;
  --font-body: 'Monocraft', monospace;
}
```

---

## 9. Next Steps

1. Confirm/license the two fonts (Monocraft is free/open-source on GitHub; Minecraft Ten needs checking for your use case — commercial vs. personal project).
2. I can build a working HTML/React prototype of this dashboard (sidebar + cards + a couple of charts) using this exact token set — say the word and I'll spin it up as an artifact.
3. Once layout is picked, we can generate the actual pixel-art decorative assets (crystal corners, lava divider, portal icon) to match.
