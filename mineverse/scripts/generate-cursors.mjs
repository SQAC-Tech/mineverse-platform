/**
 * Generates the MINEVERSE pixel-art cursor set.
 *
 * Each cursor is authored as a 16x16 character grid, upscaled 2x with
 * nearest-neighbour to a 32x32 PNG, then inlined as a base64 data URI into
 * `app/cursors.css`. Data URIs (rather than /public files) mean the cursor is
 * present on the very first pointer move with no network round-trip.
 *
 * Run: node scripts/generate-cursors.mjs
 * Preview: node scripts/generate-cursors.mjs --preview  (writes scratch/cursor-sheet.png)
 */

import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const GRID = 16;
const SCALE = 2;

// Minecraft-ish item palette: every shape is outlined, then shaded light -> dark.
const PALETTE = {
  K: "#12100Eff", // outline
  W: "#FFFFFFff", // white
  S: "#C9D4DBff", // silver / iron light
  s: "#8A99A3ff", // iron dark
  D: "#8CF7E7ff", // diamond light
  d: "#43D3C2ff", // diamond mid
  x: "#1E8C82ff", // diamond dark
  G: "#FFD95Aff", // gold light
  g: "#C08A22ff", // gold dark
  P: "#9B6432ff", // wood light
  p: "#5E3A18ff", // wood dark
  R: "#E24B3Aff", // redstone light
  r: "#992A20ff", // redstone dark
  F: "#E8B78Fff", // skin light
  f: "#B5825Cff", // skin dark
  T: "#3B7FE0ff", // shirt light (Steve cyan-blue)
  t: "#245BA8ff", // shirt dark
};

/**
 * Diamond sword, tip at top-left. This is the resting cursor, so the blade
 * stays 2px slim — it reads as a pointer at a glance rather than as an item.
 * The gold cross-guard runs on the anti-diagonal so the silhouette is
 * unmistakably a sword even at 32px.
 */
const SWORD = [
  "KK..............",
  "KDK.............",
  ".KDdK...........",
  "..KDdK..........",
  "...KDdK.........",
  "....KDdK........",
  ".....KDdK..KK...",
  "......KDxKKGGK..",
  ".......KxGGGK...",
  "......KGGGKPpK..",
  ".....KGGK..KPpK.",
  "....KGK.....KPpK",
  "....KK.......KPK",
  "..............KK",
  "................",
  "................",
];

/**
 * Iron pickaxe: two prongs and an arc for the head, wooden handle running
 * down-right. Hotspot sits on the left prong so the point that "mines" is the
 * point that clicks.
 */
const PICKAXE = [
  "KK..............",
  "KSKKKKKKKKKK....",
  "KSSSSSSSSSSSK...",
  "KSsSKKKKKSssK...",
  "KSsK.....KSsK...",
  "KSsK.....KSsK...",
  ".KsK.....KKsSK..",
  ".KK.......KPpK..",
  "..........KPpK..",
  "...........KPpK.",
  "...........KPpK.",
  "............KPpK",
  "............KPpK",
  ".............KPK",
  ".............KK.",
  "................",
];

/** Pixel I-beam for text fields. Centred hotspot. */
const BEAM = [
  "................",
  "................",
  ".....KKKKKK.....",
  ".....KWWWWK.....",
  "......KKWKK.....",
  ".......KWK......",
  ".......KWK......",
  ".......KWK......",
  ".......KWK......",
  ".......KWK......",
  ".......KWK......",
  "......KKWKK.....",
  ".....KWWWWK.....",
  ".....KKKKKK.....",
  "................",
  "................",
];

/** Barrier block for disabled controls. Centred hotspot. */
const BARRIER = [
  "................",
  "................",
  "................",
  "...KKKKKKKKKK...",
  "...KrrRRRRrrK...",
  "...KRrrRRrrRK...",
  "...KRRrrrrRRK...",
  "...KRRRrrRRRK...",
  "...KRRRrrRRRK...",
  "...KRRrrrrRRK...",
  "...KRrrRRrrRK...",
  "...KrrRRRRrrK...",
  "...KKKKKKKKKK...",
  "................",
  "................",
  "................",
];

/** Steve's open hand — draggable things at rest. */
const HAND_OPEN = [
  "................",
  "......KKK.......",
  "..KKKKFFKKKK....",
  "..KFFKFFKFFKK...",
  "..KFFKFFKFFKFK..",
  "..KFFFFFFFFFFK..",
  "..KFFFFFFFFFFK..",
  "..KfFFFFFFFFfK..",
  "..KFFFFFFFFFFK..",
  "...KFFFFFFFFK...",
  "...KfFFFFFFfK...",
  "....KFFFFFFK....",
  ".....KKKKKK.....",
  "................",
  "................",
  "................",
];

/** Steve's closed fist — mid-drag. */
const HAND_CLOSED = [
  "................",
  "................",
  "................",
  "..KKKKKKKK......",
  ".KFFFFFFFFK.....",
  ".KFKFKFKFFFK....",
  ".KFFFFFFFFFK....",
  "KKFFFFFFFFFK....",
  "KFFFFFFFFFFK....",
  "KFfFFFFFFFFK....",
  ".KFFFFFFFFFK....",
  "..KfFFFFFFfK....",
  "...KFFFFFFK.....",
  "....KKKKKK......",
  "................",
  "................",
];

/** Minecraft crosshair for the round/game screens. Centred hotspot. */
const CROSSHAIR = [
  "......KKKK......",
  "......KWWK......",
  "......KWWK......",
  "......KWWK......",
  "......KWWK......",
  "......KWWK......",
  "KKKKKKKWWKKKKKKK",
  "KWWWWWWWWWWWWWWK",
  "KWWWWWWWWWWWWWWK",
  "KKKKKKKWWKKKKKKK",
  "......KWWK......",
  "......KWWK......",
  "......KWWK......",
  "......KWWK......",
  "......KWWK......",
  "......KKKK......",
];

/**
 * `hotspot` is in grid cells; it is multiplied by SCALE for the CSS value.
 * `fallback` is the native cursor used where the image cannot load.
 */
const CURSORS = [
  { name: "sword", grid: SWORD, hotspot: [0, 0], fallback: "default" },
  { name: "pickaxe", grid: PICKAXE, hotspot: [0, 0], fallback: "pointer" },
  { name: "beam", grid: BEAM, hotspot: [8, 8], fallback: "text" },
  { name: "barrier", grid: BARRIER, hotspot: [8, 6], fallback: "not-allowed" },
  { name: "hand-open", grid: HAND_OPEN, hotspot: [6, 7], fallback: "grab" },
  { name: "hand-closed", grid: HAND_CLOSED, hotspot: [6, 7], fallback: "grabbing" },
  { name: "crosshair", grid: CROSSHAIR, hotspot: [8, 8], fallback: "crosshair" },
];

function assertGrid(name, grid) {
  if (grid.length !== GRID) {
    throw new Error(`${name}: expected ${GRID} rows, got ${grid.length}`);
  }
  grid.forEach((row, y) => {
    if (row.length !== GRID) {
      throw new Error(`${name}: row ${y} is ${row.length} chars, expected ${GRID}`);
    }
    for (const char of row) {
      if (char !== "." && !PALETTE[char]) {
        throw new Error(`${name}: row ${y} uses unknown palette key "${char}"`);
      }
    }
  });
}

/** Renders a grid to an RGBA buffer, upscaled by `scale` with hard pixel edges. */
function render(grid, scale) {
  const size = GRID * scale;
  const raw = Buffer.alloc(size * size * 4); // zero-filled = transparent
  for (let y = 0; y < GRID; y++) {
    for (let x = 0; x < GRID; x++) {
      const hex = PALETTE[grid[y][x]];
      if (!hex) continue;
      const [r, g, b, a] = [1, 3, 5, 7].map((i) => parseInt(hex.slice(i, i + 2), 16));
      for (let dy = 0; dy < scale; dy++) {
        for (let dx = 0; dx < scale; dx++) {
          const offset = ((y * scale + dy) * size + (x * scale + dx)) * 4;
          raw.set([r, g, b, a], offset);
        }
      }
    }
  }
  return sharp(raw, { raw: { width: size, height: size, channels: 4 } }).png({
    compressionLevel: 9,
    palette: true,
  });
}

async function main() {
  for (const { name, grid } of CURSORS) assertGrid(name, grid);

  if (process.argv.includes("--preview")) {
    // Two rows at 12x — once over a light band and once over a dark one, since
    // the cursors have to stay legible over both the cave and daylight pages.
    const tiles = await Promise.all(CURSORS.map((c) => render(c.grid, 12).toBuffer()));
    const cell = GRID * 12;
    const bands = ["#b9c4cc", "#1c1a18"];
    mkdirSync(join(ROOT, "scratch"), { recursive: true });
    const strips = await Promise.all(
      bands.map((background) =>
        sharp({
          create: { width: cell * CURSORS.length, height: cell, channels: 4, background },
        })
          .composite(tiles.map((input, i) => ({ input, left: i * cell, top: 0 })))
          .png()
          .toBuffer(),
      ),
    );
    await sharp({
      create: {
        width: cell * CURSORS.length,
        height: cell * bands.length,
        channels: 4,
        background: "#000000",
      },
    })
      .composite(strips.map((input, i) => ({ input, left: 0, top: i * cell })))
      .png()
      .toFile(join(ROOT, "scratch", "cursor-sheet.png"));
    console.log(`Preview: scratch/cursor-sheet.png (${CURSORS.map((c) => c.name).join(", ")})`);
    return;
  }

  const rules = [];
  let total = 0;
  for (const { name, grid, hotspot, fallback } of CURSORS) {
    const png = await render(grid, SCALE).toBuffer();
    total += png.length;
    const uri = `data:image/png;base64,${png.toString("base64")}`;
    const [hx, hy] = hotspot.map((n) => n * SCALE);
    rules.push(`  --mv-cursor-${name}: url("${uri}") ${hx} ${hy}, ${fallback};`);
  }

  const css = `/* GENERATED by scripts/generate-cursors.mjs — do not edit by hand. */
/* Edit the pixel grids in that script and re-run it instead. */
/* Consumed by the cursor rules at the bottom of globals.css. */

:root {
${rules.join("\n")}
}
`;
  writeFileSync(join(ROOT, "app", "cursors.css"), css);
  console.log(`Wrote app/cursors.css — ${CURSORS.length} cursors, ${total} bytes of PNG.`);
}

main();
