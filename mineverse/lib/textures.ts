"use client";

import * as THREE from 'three';

const textureCache: Record<string, THREE.CanvasTexture> = {};

function generateNoiseCanvas(
  baseColor: string, 
  noiseColor: string, 
  density: number = 0.5,
  isSideGrass: boolean = false
): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = 16;
  canvas.height = 16;
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;

  // Base fill
  ctx.fillStyle = baseColor;
  ctx.fillRect(0, 0, 16, 16);

  if (isSideGrass) {
    // Fill bottom half with dirt
    ctx.fillStyle = '#79553a'; // Dirt base
    ctx.fillRect(0, 8, 16, 8);
    
    // Add dirt noise
    for (let i = 0; i < 256; i++) {
      const x = i % 16;
      const y = Math.floor(i / 16);
      if (y >= 8 && Math.random() < density) {
        ctx.fillStyle = '#593e2a'; // Dirt noise
        ctx.fillRect(x, y, 1, 1);
      }
    }
  }

  // Add primary noise
  for (let i = 0; i < 256; i++) {
    const x = i % 16;
    const y = Math.floor(i / 16);
    
    if (isSideGrass && y >= 8) continue; // Skip dirt area if side grass
    
    if (Math.random() < density) {
      ctx.fillStyle = noiseColor;
      ctx.fillRect(x, y, 1, 1);
    }
  }

  return canvas;
}

function createTexture(base: string, noise: string, density: number = 0.5, isSideGrass: boolean = false) {
  const cacheKey = `${base}-${noise}-${isSideGrass}`;
  if (textureCache[cacheKey]) return textureCache[cacheKey];

  const canvas = generateNoiseCanvas(base, noise, density, isSideGrass);
  const texture = new THREE.CanvasTexture(canvas);
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  
  textureCache[cacheKey] = texture;
  return texture;
}

export function getBlockTextures() {
  if (typeof window === 'undefined') return {} as any; // SSR fallback

  const dirt = createTexture('#79553a', '#593e2a');
  const grassTop = createTexture('#5c9e31', '#477a26');
  const grassSide = createTexture('#5c9e31', '#477a26', 0.5, true);
  
  const stone = createTexture('#7d7d7d', '#5a5a5a');
  const woodSide = createTexture('#5c4033', '#3e2723', 0.6); // bark
  const woodTop = createTexture('#8b5a2b', '#a0522d'); // rings
  const leaves = createTexture('#2d7a1f', '#1e5214', 0.4);
  
  const netherrack = createTexture('#5c1414', '#380a0a');
  const lava = createTexture('#ff8c00', '#e55b00', 0.3);
  
  const endstone = createTexture('#dfdf9d', '#bfbf7b');
  const obsidian = createTexture('#1c1c1e', '#0f0f10');
  
  const bedrock = createTexture('#333333', '#111111');

  // Water — deep blue with lighter ripple streaks
  const waterTex = createTexture('#1a4d7a', '#1e6091', 0.35);
  waterTex.wrapS = THREE.RepeatWrapping;
  waterTex.wrapT = THREE.RepeatWrapping;

  // Nether Brick — distinct dark red brickwork
  const netherBrickCanvas = document.createElement('canvas');
  netherBrickCanvas.width = 16;
  netherBrickCanvas.height = 16;
  const nbc = netherBrickCanvas.getContext('2d')!;
  nbc.fillStyle = '#2d0a0a';
  nbc.fillRect(0, 0, 16, 16);
  // Mortar lines
  nbc.fillStyle = '#1a0404';
  nbc.fillRect(0, 7, 16, 2);
  nbc.fillRect(0, 15, 16, 1);
  nbc.fillRect(8, 0, 1, 7);
  nbc.fillRect(0, 8, 1, 7);
  // Brick tint variation
  nbc.fillStyle = '#3d0d0d';
  nbc.fillRect(1, 1, 6, 5);
  nbc.fillRect(10, 1, 5, 5);
  nbc.fillRect(2, 9, 5, 5);
  nbc.fillRect(9, 9, 6, 5);
  const netherBrickTex = new THREE.CanvasTexture(netherBrickCanvas);
  netherBrickTex.magFilter = THREE.NearestFilter;
  netherBrickTex.minFilter = THREE.NearestFilter;
  netherBrickTex.colorSpace = THREE.SRGBColorSpace;

  return {
    dirt,
    grassTop,
    grassSide,
    stone,
    woodSide,
    woodTop,
    leaves,
    netherrack,
    lava,
    endstone,
    obsidian,
    bedrock,
    netherBrick: netherBrickTex,
    water: waterTex,
  };
}
