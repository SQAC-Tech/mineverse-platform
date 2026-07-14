'use client';

import { useRef, useMemo, useEffect, useState, useCallback } from 'react';
import * as THREE from 'three';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import Link from 'next/link';
import { RegistrationForm } from '../forms/registration-form';

// ═══════════════════════════════════════════════════════════
//  SCROLL STATE
// ═══════════════════════════════════════════════════════════
let scrollP = 0;
let isAnimating = false;

// Shared typography style for Minecraft font
const mc = { fontFamily: 'var(--font-minecraft), system-ui, sans-serif' };

if (typeof window !== 'undefined') {
  const triggerEnter = () => {
    if (isAnimating || scrollP >= 1) return;
    isAnimating = true;
    const start = Date.now();
    const duration = 1500;
    
    const anim = () => {
      const p = Math.min((Date.now() - start) / duration, 1);
      scrollP = p * (2 - p); // easeOutQuad
      
      window.dispatchEvent(new Event('custom_scroll'));
      if (p < 1) requestAnimationFrame(anim);
    };
    requestAnimationFrame(anim);
  };
  
  window.addEventListener('scroll', () => {
    // If the user scrolls down at all, trigger the animation
    if (window.scrollY > 5 && !isAnimating && scrollP < 1) {
      triggerEnter();
    }
  }, { passive: true });
}

// ═══════════════════════════════════════════════════════════
//  PIXEL TEXTURE FACTORY
// ═══════════════════════════════════════════════════════════
function px(fn: (g: CanvasRenderingContext2D) => void, rx = 1, ry = 1) {
  if (typeof window === 'undefined') return new THREE.Texture();
  const c = document.createElement('canvas');
  c.width = 16; c.height = 16;
  fn(c.getContext('2d')!);
  const t = new THREE.CanvasTexture(c);
  t.magFilter = THREE.NearestFilter;
  t.minFilter = THREE.NearestFilter;
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(rx, ry);
  return t;
}

function speckle(g: CanvasRenderingContext2D, colors: string[], count: number, maxW = 3, maxH = 3) {
  for (let i = 0; i < count; i++) {
    g.fillStyle = colors[i % colors.length];
    g.fillRect(~~(Math.random() * 14), ~~(Math.random() * 14), ~~(Math.random() * maxW) + 1, ~~(Math.random() * maxH) + 1);
  }
}

// Base Materials
const mkStone = (rx = 1, ry = 1) => px(g => {
  g.fillStyle = '#7a7a7a'; g.fillRect(0, 0, 16, 16);
  speckle(g, ['#5e5e5e', '#6e6e6e', '#8e8e8e', '#757575'], 180, 2, 2);
}, rx, ry);

const mkDeepslate = (rx = 1, ry = 1) => px(g => {
  g.fillStyle = '#3a3a3a'; g.fillRect(0, 0, 16, 16);
  speckle(g, ['#2a2a2a', '#4a4a4a', '#303030', '#252525'], 180, 2, 2);
}, rx, ry);

const mkStoneBrick = () => px(g => {
  g.fillStyle = '#8a8a8a'; g.fillRect(0, 0, 16, 16);
  g.fillStyle = '#555555';
  g.fillRect(0, 7, 16, 2); g.fillRect(7, 0, 2, 7); g.fillRect(0, 9, 2, 7);
  g.fillStyle = '#9a9a9a';
  g.fillRect(1, 1, 5, 5); g.fillRect(10, 1, 5, 5);
  g.fillRect(3, 10, 4, 5); g.fillRect(11, 10, 4, 5);
});

const mkGrassTop = (rx = 1, ry = 1) => px(g => {
  g.fillStyle = '#64af2c'; g.fillRect(0, 0, 16, 16);
  speckle(g, ['#4d8a1f', '#77cf38', '#5ca326', '#6ac032'], 120, 2, 2);
}, rx, ry);

const mkGrassSide = () => px(g => {
  g.fillStyle = '#794a28'; g.fillRect(0, 0, 16, 16);
  speckle(g, ['#543219', '#965e34', '#663c1e'], 80, 2, 2);
  g.fillStyle = '#64af2c'; g.fillRect(0, 0, 16, 4);
  const fringe = [2,3,2,4, 1,2,3,2, 4,3,2,1, 2,3,4,2];
  for (let i = 0; i < 16; i++) {
    g.fillStyle = '#64af2c'; g.fillRect(i, 4, 1, fringe[i]);
    g.fillStyle = '#4d8a1f'; g.fillRect(i, 4 + fringe[i], 1, 1);
  }
});

const mkDirt = (rx = 1, ry = 1) => px(g => {
  g.fillStyle = '#794a28'; g.fillRect(0, 0, 16, 16);
  speckle(g, ['#543219', '#965e34', '#663c1e', '#85512d'], 120);
}, rx, ry);

const mkLeaf = () => px(g => {
  g.fillStyle = '#317822'; g.fillRect(0, 0, 16, 16);
  speckle(g, ['#215217', '#3d942a', '#29631d', '#368525'], 150, 2, 2);
  g.clearRect(1, 1, 2, 2); g.clearRect(5, 4, 3, 2); g.clearRect(12, 2, 2, 2);
  g.clearRect(2, 9, 2, 3); g.clearRect(9, 10, 2, 2); g.clearRect(13, 12, 2, 2);
  g.clearRect(6, 13, 3, 2); g.clearRect(0, 6, 2, 2); g.clearRect(14, 7, 2, 2);
});

const mkWood = () => px(g => {
  g.fillStyle = '#5c4033'; g.fillRect(0, 0, 16, 16);
  for (let i = 0; i < 40; i++) {
    g.fillStyle = i % 2 ? '#3e2723' : '#6d4c33';
    g.fillRect(~~(Math.random() * 14), ~~(Math.random() * 14), 1, ~~(Math.random() * 6) + 2);
  }
});

const mkDiamondOre = () => px(g => {
  g.fillStyle = '#3a3a3a'; g.fillRect(0, 0, 16, 16);
  speckle(g, ['#2a2a2a', '#4a4a4a'], 100, 2, 2);
  speckle(g, ['#00e6ff', '#00b3cc', '#80f2ff'], 20, 2, 2); // Diamonds
});

const mkMushroom = () => px(g => {
  g.fillStyle = '#d11d1d'; g.fillRect(0, 0, 16, 16);
  speckle(g, ['#a81111', '#8f0c0c'], 50, 2, 2);
  // White spots
  g.fillStyle = '#ffffff';
  g.fillRect(2, 2, 3, 3); g.fillRect(10, 3, 4, 3); g.fillRect(4, 9, 4, 4); g.fillRect(12, 11, 2, 2);
});

// ═══════════════════════════════════════════════════════════
//  TERRAIN & CAVERN GENERATION
// ═══════════════════════════════════════════════════════════
function hash(x: number, y: number) {
  let h = Math.imul(x ^ (y << 5), 0x9e3779b1);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296.0;
}
function noise(x: number, y: number) {
  const ix = Math.floor(x), iy = Math.floor(y);
  const fx = x - ix, fy = y - iy;
  const a = hash(ix, iy), b = hash(ix + 1, iy);
  const c = hash(ix, iy + 1), d = hash(ix + 1, iy + 1);
  const ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy);
  return a + (b - a) * ux + (c - a + (a - b - c + d) * ux) * uy;
}

function getHeight(x: number, z: number): number {
  if (z >= 18) return 0;
  const ax = Math.abs(x);
  
  let centerH = 0;
  if (ax <= 8) centerH = 15;
  else if (ax <= 18) centerH = Math.max(0, 15 - (ax - 8) * 0.8);
  
  // AAA Voxel Hills - organic rolling hills
  const rollingH = 5 + noise(x * 0.03, z * 0.03) * 12 + noise(x * 0.08, z * 0.08) * 5 + noise(x * 0.2, z * 0.2) * 2;
  let baseH = Math.max(centerH, rollingH);
  
  const slopeZ = z + 5; 
  if (slopeZ > 0) baseH -= slopeZ * 0.5;
  
  let finalH = Math.floor(baseH);
  if (finalH < 0) finalH = 0;
  
  // Winding dirt path leading into cave
  const pathDist = Math.abs(x + Math.sin(z * 0.2) * 2);
  if (pathDist <= 3 && z >= -2) {
    if (finalH > 0) finalH = 0; 
  }
  
  return finalH;
}

// ═══════════════════════════════════════════════════════════
//  INSTANCED BLOCKS
// ═══════════════════════════════════════════════════════════
function Blocks({ pts, mat, geo }: { pts: [number, number, number][]; mat: any; geo: any }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  useEffect(() => {
    if (!ref.current || !pts.length) return;
    const d = new THREE.Object3D();
    pts.forEach(([x, y, z], i) => {
      d.position.set(x, y, z);
      d.updateMatrix();
      ref.current!.setMatrixAt(i, d.matrix);
    });
    ref.current.instanceMatrix.needsUpdate = true;
  }, [pts]);
  if (!pts.length) return null;
  return <instancedMesh ref={ref} args={[geo, mat, pts.length]} receiveShadow />;
}

// ═══════════════════════════════════════════════════════════
//  CAMERA RIG & FOG (Story-driven scroll)
// ═══════════════════════════════════════════════════════════
function CameraRig() {
  const { camera, scene } = useThree();
  
  useFrame(() => {
    // Phases:
    // 0.0 - 0.2: Start outside, approach entrance (z=22 -> z=5)
    // 0.2 - 0.4: Enter tunnel, darkens (z=5 -> z=-12)
    // 0.4 - 1.0: Stop inside Cavern, look around slowly, UI fades in (z=-12)
    
    let targetZ = 22;
    if (scrollP < 0.25) {
       targetZ = 22 - (scrollP / 0.25) * 17; // 22 to 5
    } else if (scrollP < 0.5) {
       targetZ = 5 - ((scrollP - 0.25) / 0.25) * 11; // 5 to -6 (stop at back wall)
    } else {
       targetZ = -6; // Stay at back wall
    }
    
    // Smooth camera interpolation
    camera.position.z += (targetZ - camera.position.z) * 0.05;
    camera.position.y += (3 - camera.position.y) * 0.05;
    
    // Pitch black fog - darken as we approach and enter
    if (scene.fog) {
      const enterProgress = Math.max(0, Math.min(1, (5 - camera.position.z) / 8));
      if (camera.position.z < 5) {
         scene.fog.color.set('#040202'); 
         (scene.fog as THREE.Fog).near = 1 + (1 - enterProgress) * 8;
         (scene.fog as THREE.Fog).far = 8 + (1 - enterProgress) * 20; 
      } else {
         scene.fog.color.set('#ff9944'); // Golden hour fog
         (scene.fog as THREE.Fog).near = 10;
         (scene.fog as THREE.Fog).far = 60;
      }
    }
    
    // Darken background as we enter cave by fading the HTML element
    const bgProgress = Math.max(0, Math.min(1, (8 - camera.position.z) / 8));
    scene.background = null;
    const bgEl = document.getElementById('bg-mountain');
    if (bgEl) {
      bgEl.style.opacity = (1 - bgProgress).toString();
    }
  });
  return null;
}

// ═══════════════════════════════════════════════════════════
//  DYNAMIC TORCH
// ═══════════════════════════════════════════════════════════
function Torch({ pos, activateAt = 0 }: { pos: [number, number, number], activateAt?: number }) {
  const l = useRef<THREE.PointLight>(null);
  
  useFrame(({ clock }) => {
    if (l.current) {
      // Light up based on scroll
      let intensity = 0;
      if (scrollP > activateAt) {
        // Flicker effect
        intensity = 8 + Math.sin(clock.elapsedTime * 8) * 1.5 + Math.cos(clock.elapsedTime * 12) * 1.5;
      }
      // Smoothly transition intensity
      l.current.intensity += (intensity - l.current.intensity) * 0.1;
    }
  });

  return (
    <group position={pos}>
      <mesh><boxGeometry args={[0.15, 0.7, 0.15]} /><meshStandardMaterial color="#3d2817" /></mesh>
      <mesh position={[0, 0.45, 0]}><boxGeometry args={[0.2, 0.2, 0.2]} /><meshBasicMaterial color="#ffcc00" /></mesh>
      <pointLight ref={l} color="#ffaa00" intensity={0} distance={18} position={[0, 0.6, 0]} />
    </group>
  );
}

// ═══════════════════════════════════════════════════════════
//  SCENE GENERATION
// ═══════════════════════════════════════════════════════════
function CaveScene() {
  const geo = useMemo(() => new THREE.BoxGeometry(1, 1, 1), []);

  const mats = useMemo(() => {
    return {
      stone: new THREE.MeshStandardMaterial({ map: mkStone(), roughness: 0.9 }),
      stoneBrick: new THREE.MeshStandardMaterial({ map: mkStoneBrick(), roughness: 0.8 }),
      dirt: new THREE.MeshStandardMaterial({ map: mkDirt(), roughness: 1.0 }),
      leaf: new THREE.MeshStandardMaterial({ map: mkLeaf(), transparent: true, alphaTest: 0.1, side: THREE.DoubleSide }),
      wood: new THREE.MeshStandardMaterial({ map: mkWood() }),
      grassBlock: [
        new THREE.MeshStandardMaterial({ map: mkGrassSide(), roughness: 0.9 }),
        new THREE.MeshStandardMaterial({ map: mkGrassSide(), roughness: 0.9 }),
        new THREE.MeshStandardMaterial({ map: mkGrassTop(), roughness: 0.8 }),
        new THREE.MeshStandardMaterial({ map: mkDirt(), roughness: 1.0 }),
        new THREE.MeshStandardMaterial({ map: mkGrassSide(), roughness: 0.9 }),
        new THREE.MeshStandardMaterial({ map: mkGrassSide(), roughness: 0.9 }),
      ],
      deepslate: new THREE.MeshStandardMaterial({ map: mkDeepslate(), color: '#333' }), // Darker
      diamond: new THREE.MeshStandardMaterial({ map: mkDiamondOre(), color: '#555' }),
      mushroom: new THREE.MeshStandardMaterial({ map: mkMushroom() }),
    }
  }, []);

  // 1. Outside Terrain
  const { grassPts, dirtPts, stonePts } = useMemo(() => {
    const grass: [number, number, number][] = [];
    const dirt: [number, number, number][] = [];
    const stone: [number, number, number][] = [];

    for (let x = -30; x <= 30; x++) {
      for (let z = -2; z <= 18; z++) { // Only generate outside terrain up to tunnel start
        const h = getHeight(x, z);
        if (h <= 0) continue;

        for (let y = 0; y < h; y++) {
          if (Math.abs(x) <= 4 && y <= 8 && z >= 1) continue; // Entrance frame hole
          const isTop = (y === h - 1), isBottom = (y === 0);
          const isSide = getHeight(x + 1, z) <= y || getHeight(x - 1, z) <= y || getHeight(x, z + 1) <= y || getHeight(x, z - 1) <= y;
          const adjCave = (Math.abs(x) === 5 && y <= 8 && z >= 1) || (Math.abs(x) <= 4 && y === 9 && z >= 1);
          
          if (!isTop && !isBottom && !isSide && !adjCave) continue;
          
          const dirtDepth = 2 + Math.floor(hash(x, z) * 3);
          if (isTop) grass.push([x, y, z]);
          else if (y >= h - dirtDepth) dirt.push([x, y, z]);
          else stone.push([x, y, z]);
        }
      }
    }
    return { grassPts: grass, dirtPts: dirt, stonePts: stone };
  }, []);

  // 2. Entrance Frame & Tunnel (shortened, sealed with back wall)
  const { archPts, darkTunnelPts } = useMemo(() => {
    const arch: [number, number, number][] = [];
    const tunnel: [number, number, number][] = [];
    // Front Arch
    for (let x = -4; x <= 4; x++) {
      for (let y = 0; y <= 8; y++) {
        if (Math.abs(x) <= 2 && y <= 6) continue;
        if (Math.abs(x) === 4 && y === 8) continue;
        arch.push([x, y, 4]); arch.push([x, y, 5]);
      }
    }
    // Tunnel walls (z: 3 to -15)
    for (let z = 3; z >= -15; z--) {
      for (let y = 0; y <= 8; y++) { 
        tunnel.push([-3, y, z]); tunnel.push([3, y, z]); 
        if (z < 4) { tunnel.push([-4, y, z]); tunnel.push([4, y, z]); }
      }
      for (let x = -2; x <= 2; x++) tunnel.push([x, 7, z]); // ceiling
      for (let x = -2; x <= 2; x++) tunnel.push([x, 8, z]); // outer ceiling
      for (let x = -2; x <= 2; x++) tunnel.push([x, 0, z]); // floor
    }
    // BACK WALL — solid wall to seal the cave and block sky
    for (let x = -4; x <= 4; x++) {
      for (let y = 0; y <= 8; y++) {
        tunnel.push([x, y, -15]);
        tunnel.push([x, y, -16]);
      }
    }
    return { archPts: arch, darkTunnelPts: tunnel };
  }, []);

  // 3. Cavern removed — we transition to 2D image instead

  // 4. Outside Trees & Path
  const { trunkPts, leafPts, pathPts } = useMemo(() => {
    const trunks: [number, number, number][] = [];
    const leaves: [number, number, number][] = [];
    const path: [number, number, number][] = [];
    
    for (let tx = -28; tx <= 28; tx += 4) {
      for (let tz = -8; tz <= 16; tz += 4) {
        if (Math.abs(tx) <= 8 && tz > -2) continue;
        const treeDensity = noise(tx * 0.1, tz * 0.1);
        if (hash(tx * 1.5, tz * 1.5) < 0.2 + treeDensity * 0.5) {
          const actualTx = tx + Math.floor(hash(tx, tz) * 3 - 1);
          const actualTz = tz + Math.floor(hash(tz, tx) * 3 - 1);
          const base = getHeight(actualTx, actualTz);
          if (base <= 0 || base > 18) continue;
          
          const treeTypeHash = hash(actualTx, actualTz * 2);
          const heightVar = Math.floor(hash(actualTz, actualTx) * 3);
          
          if (treeTypeHash > 0.6) {
            // Spruce (Tall, conical)
            for (let dy = 0; dy <= 6 + heightVar; dy++) trunks.push([actualTx, base + dy, actualTz]);
            for (let y = 2; y <= 7 + heightVar; y += 2) {
              const radius = Math.max(1, 4 - Math.floor(y/2));
              for (let dx = -radius; dx <= radius; dx++) {
                for (let dz = -radius; dz <= radius; dz++) {
                  if (Math.abs(dx) === radius && Math.abs(dz) === radius && hash(dx, dz) > 0.5) continue;
                  leaves.push([actualTx + dx, base + y, actualTz + dz]);
                  leaves.push([actualTx + dx, base + y + 1, actualTz + dz]);
                }
              }
            }
            leaves.push([actualTx, base + 8 + heightVar, actualTz]);
          } else {
            // Oak / Birch
            const trunkHeight = 4 + heightVar;
            for (let dy = 0; dy <= trunkHeight; dy++) trunks.push([actualTx, base + dy, actualTz]);
            const h = base + trunkHeight - 2;
            for (let y = 0; y <= 1; y++) {
              for (let dx = -2; dx <= 2; dx++) {
                for (let dz = -2; dz <= 2; dz++) {
                  if (Math.abs(dx) === 2 && Math.abs(dz) === 2 && hash(actualTx+dx, actualTz+dz) > 0.5) continue;
                  leaves.push([actualTx + dx, h + y, actualTz + dz]);
                }
              }
            }
            for (let dx = -1; dx <= 1; dx++) {
              for (let dz = -1; dz <= 1; dz++) {
                if (Math.abs(dx) === 1 && Math.abs(dz) === 1 && hash(actualTx+dx+1, actualTz+dz+1) > 0.3) continue;
                leaves.push([actualTx + dx, h + 2, actualTz + dz]);
              }
            }
            leaves.push([actualTx, h + 3, actualTz]);
            leaves.push([actualTx-1, h + 3, actualTz]); leaves.push([actualTx+1, h + 3, actualTz]);
            leaves.push([actualTx, h + 3, actualTz-1]); leaves.push([actualTx, h + 3, actualTz+1]);
          }
        }
      }
    }
    
    // Path mixing dirt and stone
    for (let x = -3; x <= 3; x++) {
      for (let z = 5; z <= 25; z++) {
        if (getHeight(x, z) > 0) continue;
        if (hash(x * 10, z * 10) < (1 - (Math.abs(x) / 4)) * 0.8) {
           path.push([x, 0, z]); 
        }
      }
    }
    return { trunkPts: trunks, leafPts: leaves, pathPts: path };
  }, []);


  return (
    <group>
      {/* Outside Ground */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.49, 10]} receiveShadow material={mats.grassBlock[2]}>
        <planeGeometry args={[120, 80]} />
      </mesh>

      {/* Rendering Instances */}
      <Blocks pts={grassPts} mat={mats.grassBlock} geo={geo} />
      <Blocks pts={dirtPts} mat={mats.dirt} geo={geo} />
      <Blocks pts={stonePts} mat={mats.stone} geo={geo} />
      <Blocks pts={archPts} mat={mats.stoneBrick} geo={geo} />
      <Blocks pts={darkTunnelPts} mat={mats.deepslate} geo={geo} />
      
      {/* Darkness Volume in Tunnel */}
      {Array.from({ length: 8 }).map((_, i) => (
        <mesh key={`dark-${i}`} position={[0, 4, 3 - i * 1.5]}>
          <planeGeometry args={[12, 12]} />
          <meshBasicMaterial color="#000000" opacity={0.35} transparent depthWrite={false} />
        </mesh>
      ))}
      
      <Blocks pts={trunkPts} mat={mats.wood} geo={geo} />
      <Blocks pts={leafPts} mat={mats.leaf} geo={geo} />
      <Blocks pts={pathPts} mat={mats.dirt} geo={geo} />
      
      {/* Cavern removed — transitions to 2D image */}
    </group>
  );
}

// ═══════════════════════════════════════════════════════════
//  ATMOSPHERE (Dust Particles)
// ═══════════════════════════════════════════════════════════
function DustParticles() {
  const count = 300;
  
  const geometry = useMemo(() => {
    const pos = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 20; // x
      pos[i * 3 + 1] = Math.random() * 8;      // y
      pos[i * 3 + 2] = Math.random() * 20 - 5; // z
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    return geo;
  }, []);
  
  const ref = useRef<THREE.Points>(null);
  useFrame(({ clock }) => {
    if (ref.current) {
      ref.current.position.y = Math.sin(clock.elapsedTime * 0.2) * 0.5;
      ref.current.rotation.y = clock.elapsedTime * 0.02;
    }
  });

  return (
    <points ref={ref} geometry={geometry}>
      <pointsMaterial size={0.08} color="#ffddaa" transparent opacity={0.4} depthWrite={false} sizeAttenuation={true} />
    </points>
  );
}

// ═══════════════════════════════════════════════════════════
//  WORLD
// ═══════════════════════════════════════════════════════════
function World() {
  const ambientLight = useRef<THREE.AmbientLight>(null);
  const hemiLight = useRef<THREE.HemisphereLight>(null);
  const dirLight = useRef<THREE.DirectionalLight>(null);

  useFrame(({ camera }) => {
    // Fade out global lights as we enter the cave
    const enterProgress = Math.max(0, Math.min(1, (5 - camera.position.z) / 8));
    const outIntensity = 1 - enterProgress;
    
    if (ambientLight.current) ambientLight.current.intensity = 0.5 * outIntensity;
    if (hemiLight.current) hemiLight.current.intensity = 0.4 * outIntensity;
    if (dirLight.current) dirLight.current.intensity = 2.5 * outIntensity;
  });

  return (
    <>
      <fog attach="fog" args={['#ff9944', 10, 60]} />

      {/* Outside Sun — fades out in cave */}
      <ambientLight ref={ambientLight} intensity={0.2} />
      <hemisphereLight ref={hemiLight} args={['#ffcc88', '#2a4411', 0.8]} />
      <directionalLight
        ref={dirLight}
        color="#ffaa44"
        position={[-30, 15, 20]}
        intensity={3.5}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-left={-40}
        shadow-camera-right={40}
        shadow-camera-top={40}
        shadow-camera-bottom={-40}
      />

      <CameraRig />
      <CaveScene />
      <DustParticles />

      {/* Torches Outside (Always on) */}
      <Torch pos={[-3.3, 3, 4.5]} />
      <Torch pos={[3.3, 3, 4.5]} />
      
      {/* Torches in Tunnel (Activate as you enter) */}
      <Torch pos={[-2.3, 3, 0]} activateAt={0.15} />
      <Torch pos={[2.3, 3, 0]} activateAt={0.15} />
      <Torch pos={[-2.3, 3, -5]} activateAt={0.3} />
      <Torch pos={[2.3, 3, -5]} activateAt={0.3} />
    </>
  );
}

// ═══════════════════════════════════════════════════════════
//  MINECRAFT THEMED TIMELINE DATA
// ═══════════════════════════════════════════════════════════

const DAY1_TIMELINE = [
  { time: '8:00 – 9:00 AM', activity: 'Venue Setup', icon: '🏗️', desc: 'Venue decoration, registration desk setup, technical testing, volunteer briefing', biome: 'Overworld' },
  { time: '9:00 – 10:00 AM', activity: 'Registration & Check-in', icon: '📋', desc: 'Team registration, ID verification, welcome kit distribution, seating arrangement', biome: 'Overworld' },
  { time: '10:00 – 10:40 AM', activity: 'Opening Ceremony', icon: '🎺', desc: 'Welcome address, faculty speech, sponsor introduction, inauguration, club introduction', biome: 'Overworld' },
  { time: '10:40 – 11:00 AM', activity: 'Gameplay Briefing & Platform Demo', icon: '🎮', desc: 'Explain rules, scoring, gameplay mechanics, crafting, structures, and platform demonstration', biome: 'Overworld' },
  { time: '11:00 – 11:45 AM', activity: 'Round 1 – Forest Biome', icon: '🌲', desc: 'Coding challenges, Forest Guardian, Wooden Pickaxe crafting', biome: 'Forest' },
  { time: '11:45 – 12:00 PM', activity: 'Buffer Time', icon: '⏳', desc: 'Submission collection, answer evaluation, resource calculation, and technical synchronization', biome: 'Forest' },
  { time: '12:00 – 1:00 PM', activity: 'Round 2 – Cave Biome', icon: '⛏️', desc: 'Coding challenges, Skeleton Archer, world event, marketplace, structure building, Stone Pickaxe crafting', biome: 'Cave' },
  { time: '1:00 – 1:10 PM', activity: 'Buffer Time', icon: '⏳', desc: 'Resource calculation, structure upgrade verification, marketplace updates, and technical synchronization', biome: 'Cave' },
  { time: '1:10 – 2:00 PM', activity: 'Lunch Break', icon: '🍖', desc: 'Refuel your hunger bar!', biome: 'Cave' },
  { time: '2:10 – 3:20 PM', activity: 'Round 3 – Mountain Biome', icon: '🏔️', desc: 'Coding challenges, Ice Golem, world event, marketplace, structure building, Iron Pickaxe crafting', biome: 'Mountain' },
  { time: '3:20 – 3:30 PM', activity: 'Buffer Time', icon: '⏳', desc: 'Final resource verification, qualification validation, leaderboard finalization', biome: 'Mountain' },
  { time: '3:30 – 3:45 PM', activity: 'Qualification (PvP Battle) & Leaderboard', icon: '⚔️', desc: 'Verify scores, resources, and announce teams qualified for Day 2', biome: 'Nether' },
  { time: '3:45 – 4:00 PM', activity: 'Snack Break', icon: '🍪', desc: 'Tea, coffee, snacks', biome: 'Nether' },
  { time: '4:00 – 4:40 PM', activity: 'Fun Activities & Day 1 Closing', icon: '🎉', desc: 'Minecraft Quiz, Speed Debugging, Sponsor Activities. Day 1 recap, qualified teams announcement, teaser for the Nether Finale', biome: 'Nether' },
];

const DAY2_TIMELINE = [
  { time: '9:00 – 10:00 AM', activity: 'Venue Preparation', icon: '🏗️', desc: 'Final technical setup, volunteer briefing, resource verification', biome: 'Nether' },
  { time: '10:00 – 10:20 AM', activity: 'Welcome Back & Day 1 Recap', icon: '📜', desc: 'Recap, explain the final round, clarify doubts, verify inventories', biome: 'Nether' },
  { time: '10:20 – 11:20 AM', activity: 'Round 4 – Pre Final Round', icon: '🏃', desc: 'All the physical games are played in this round', biome: 'Nether' },
  { time: '11:20 – 11:35 AM', activity: 'Buffer Time', icon: '⏳', desc: 'Resource calculation and verification', biome: 'Nether' },
  { time: '11:35 – 12:35 PM', activity: 'Round 5 – Final Round', icon: '🐉', desc: 'The Final round which is all coding and technical stuff is played', biome: 'End' },
  { time: '12:45 – 1:45 PM', activity: 'Lunch Break', icon: '🍖', desc: 'Refuel before the grand finale!', biome: 'End' },
  { time: '1:45 – 2:15 PM', activity: 'Final Result Compilation', icon: '📊', desc: 'Final scoring and winner confirmation. Fun activities during this time!', biome: 'End' },
  { time: '2:15 – 3:00 PM', activity: 'Prize Distribution & Closing', icon: '🏆', desc: 'Winners announcement, certificates, special awards, vote of thanks, group photo', biome: 'End' },
  { time: '3:00 – 3:30 PM', activity: 'OC Debriefing', icon: '📝', desc: 'Organizing committee debriefing and wrap-up', biome: 'End' },
];

const BIOME_COLORS: Record<string, { bg: string; border: string; glow: string; accent: string }> = {
  'Overworld': { bg: '#2d5a1e', border: '#4a8a2f', glow: 'rgba(100, 175, 44, 0.3)', accent: '#64af2c' },
  'Forest': { bg: '#1a3d0e', border: '#317822', glow: 'rgba(49, 120, 34, 0.3)', accent: '#3d942a' },
  'Cave': { bg: '#2a2a2a', border: '#555555', glow: 'rgba(100, 100, 100, 0.3)', accent: '#7a7a7a' },
  'Mountain': { bg: '#1a2a3a', border: '#3a5a7a', glow: 'rgba(58, 90, 122, 0.3)', accent: '#5a8aba' },
  'Nether': { bg: '#3a1111', border: '#8a2222', glow: 'rgba(200, 50, 50, 0.3)', accent: '#ff4444' },
  'End': { bg: '#1a0a2a', border: '#5a2a8a', glow: 'rgba(120, 50, 180, 0.3)', accent: '#aa55ff' },
};

// ═══════════════════════════════════════════════════════════
//  MINECRAFT PANEL COMPONENT
// ═══════════════════════════════════════════════════════════
function McPanel({ children, className = '', style = {} }: { children: React.ReactNode; className?: string; style?: React.CSSProperties }) {
  return (
    <div
      className={className}
      style={{
        background: 'linear-gradient(180deg, #3a2a1a 0%, #2a1f15 50%, #1a150e 100%)',
        border: '4px solid #1a110a',
        boxShadow: 'inset 0 2px 0 #4a3a28, inset 0 -2px 0 #0a0502, inset 2px 0 0 #4a3a28, inset -2px 0 0 #0a0502, 0 8px 32px rgba(0,0,0,0.8)',
        imageRendering: 'pixelated' as any,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

function McButton({ children, onClick, href, variant = 'primary' }: { children: React.ReactNode; onClick?: () => void; href?: string; variant?: 'primary' | 'secondary' }) {
  const colors = variant === 'primary' 
    ? { bg: '#3e8e2b', top: '#5aba3c', bottom: '#1f4a15' }
    : { bg: '#555555', top: '#777777', bottom: '#333333' };
  
  const style: React.CSSProperties = {
    background: colors.bg,
    borderTop: `4px solid ${colors.top}`,
    borderLeft: `4px solid ${colors.top}`,
    borderBottom: `4px solid ${colors.bottom}`,
    borderRight: `4px solid ${colors.bottom}`,
    padding: '12px 32px',
    cursor: 'pointer',
    fontFamily: 'system-ui, sans-serif',
    color: '#fff',
    textShadow: '2px 2px 0 #111',
    fontSize: '0.75rem',
    letterSpacing: '0.1em',
    transition: 'filter 0.1s, transform 0.1s',
    display: 'inline-block',
  };
  
  if (href) {
    return <Link href={href}><span style={style} className="hover:brightness-110 active:scale-95">{children}</span></Link>;
  }
  return <button onClick={onClick} style={style} className="hover:brightness-110 active:scale-95">{children}</button>;
}

// ═══════════════════════════════════════════════════════════
//  ANIMATED TIMELINE ENTRY
// ═══════════════════════════════════════════════════════════
function TimelineEntry({ item, index, side }: { item: typeof DAY1_TIMELINE[0]; index: number; side: 'left' | 'right' }) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setVisible(true); obs.disconnect(); } },
      { threshold: 0.2, rootMargin: '0px 0px -50px 0px' }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  
  const colors = BIOME_COLORS[item.biome] || BIOME_COLORS['Overworld'];
  
  return (
    <div
      ref={ref}
      style={{
        display: 'flex',
        justifyContent: side === 'left' ? 'flex-end' : 'flex-start',
        paddingLeft: side === 'right' ? 'calc(50% + 24px)' : '16px',
        paddingRight: side === 'left' ? 'calc(50% + 24px)' : '16px',
        marginBottom: '16px',
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateX(0)' : `translateX(${side === 'left' ? '-40px' : '40px'})`,
        transition: `opacity 0.6s ease ${index * 0.05}s, transform 0.6s ease ${index * 0.05}s`,
      }}
    >
      <div
        style={{
          background: `linear-gradient(135deg, ${colors.bg}ee, ${colors.bg}cc)`,
          border: `3px solid ${colors.border}`,
          boxShadow: `inset 0 1px 0 ${colors.border}88, 0 4px 20px rgba(0,0,0,0.6), 0 0 15px ${colors.glow}`,
          padding: '14px 18px',
          maxWidth: '420px',
          width: '100%',
          position: 'relative',
          imageRendering: 'pixelated' as any,
        }}
      >
        {/* Torch connector dot */}
        <div style={{
          position: 'absolute',
          top: '50%',
          [side === 'left' ? 'right' : 'left']: '-34px',
          transform: 'translateY(-50%)',
          width: '16px',
          height: '16px',
          background: `radial-gradient(circle, #ffcc00, ${colors.accent})`,
          boxShadow: `0 0 12px ${colors.accent}, 0 0 24px ${colors.glow}`,
          imageRendering: 'pixelated' as any,
        }} />
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
          <span style={{ fontSize: '1.3rem' }}>{item.icon}</span>
          <span style={{
            ...mc,
            fontSize: '0.6rem',
            color: colors.accent,
            textShadow: `1px 1px 0 #000`,
            letterSpacing: '0.05em',
          }}>
            {item.activity.toUpperCase()}
          </span>
        </div>
        
        <div style={{
          ...mc,
          fontSize: '1rem',
          color: '#fde047',
          textShadow: '1px 1px 0 #000',
          marginBottom: '6px',
          letterSpacing: '0.08em',
        }}>
          {item.time}
        </div>
        
        <p style={{
          ...mc,
          fontSize: '0.4rem',
          color: '#cccccc',
          textShadow: '1px 1px 0 #000',
          lineHeight: '1.6',
          margin: 0,
        }}>
          {item.desc}
        </p>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
//  MOBILE TIMELINE ENTRY
// ═══════════════════════════════════════════════════════════
function MobileTimelineEntry({ item, index }: { item: typeof DAY1_TIMELINE[0]; index: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setVisible(true); obs.disconnect(); } },
      { threshold: 0.2, rootMargin: '0px 0px -30px 0px' }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  
  const colors = BIOME_COLORS[item.biome] || BIOME_COLORS['Overworld'];
  
  return (
    <div
      ref={ref}
      style={{
        paddingLeft: '36px',
        marginBottom: '14px',
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(20px)',
        transition: `opacity 0.5s ease ${index * 0.04}s, transform 0.5s ease ${index * 0.04}s`,
      }}
    >
      <div
        style={{
          background: `linear-gradient(135deg, ${colors.bg}ee, ${colors.bg}cc)`,
          border: `3px solid ${colors.border}`,
          boxShadow: `0 4px 16px rgba(0,0,0,0.5), 0 0 10px ${colors.glow}`,
          padding: '12px 14px',
          position: 'relative',
        }}
      >
        {/* Connector dot */}
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '-28px',
          transform: 'translateY(-50%)',
          width: '12px',
          height: '12px',
          background: `radial-gradient(circle, #ffcc00, ${colors.accent})`,
          boxShadow: `0 0 8px ${colors.accent}`,
        }} />
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
          <span style={{ fontSize: '1rem' }}>{item.icon}</span>
          <span style={{
            ...mc,
            fontSize: '0.9rem',
            color: colors.accent,
            textShadow: '1px 1px 0 #000',
          }}>
            {item.activity.toUpperCase()}
          </span>
        </div>
        
        <div style={{
          ...mc,
          fontSize: '0.8rem',
          color: '#fde047',
          textShadow: '1px 1px 0 #000',
          marginBottom: '4px',
        }}>
          {item.time}
        </div>
        
        <p style={{
          ...mc,
          fontSize: '0.6rem',
          color: '#cccccc',
          textShadow: '1px 1px 0 #000',
          lineHeight: '1.5',
          margin: 0,
        }}>
          {item.desc}
        </p>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
//  DAY SECTION HEADER
// ═══════════════════════════════════════════════════════════
function DayHeader({ day, subtitle }: { day: string; subtitle: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setVisible(true); obs.disconnect(); } },
      { threshold: 0.3 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  
  return (
    <div
      ref={ref}
      style={{
        textAlign: 'center',
        padding: '40px 20px 30px',
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0) scale(1)' : 'translateY(30px) scale(0.9)',
        transition: 'opacity 0.8s ease, transform 0.8s ease',
      }}
    >
      <h2 style={{
        ...mc,
        fontSize: 'clamp(1.5rem, 4vw, 2.5rem)',
        color: '#fde047',
        textShadow: '0 2px 0 #b8860b, 0 4px 0 #8b6508, 3px 6px 8px rgba(0,0,0,0.8)',
        margin: '0 0 8px',
        letterSpacing: '0.15em',
      }}>
        {day}
      </h2>
      <p style={{
        ...mc,
        fontSize: 'clamp(0.4rem, 1.2vw, 0.65rem)',
        color: '#aaaaaa',
        textShadow: '1px 1px 0 #000',
        letterSpacing: '0.2em',
      }}>
        {subtitle}
      </p>
      {/* Decorative line */}
      <div style={{
        width: '120px',
        height: '4px',
        background: 'linear-gradient(90deg, transparent, #fde047, transparent)',
        margin: '16px auto 0',
        boxShadow: '0 0 12px rgba(253, 224, 71, 0.4)',
      }} />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
//  PRIZE CARD
// ═══════════════════════════════════════════════════════════
function PrizeCard({ place, amount, icon, color, delay }: { place: string; amount: string; icon: string; color: string; delay: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setVisible(true); obs.disconnect(); } },
      { threshold: 0.3 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  
  return (
    <div
      ref={ref}
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0) scale(1)' : 'translateY(40px) scale(0.8)',
        transition: `opacity 0.7s ease ${delay}s, transform 0.7s ease ${delay}s`,
        flex: '1 1 200px',
        maxWidth: '280px',
      }}
    >
      <McPanel
        style={{
          padding: '24px 16px',
          textAlign: 'center',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Glow effect */}
        <div style={{
          position: 'absolute',
          top: '-20px',
          left: '50%',
          transform: 'translateX(-50%)',
          width: '100px',
          height: '100px',
          background: `radial-gradient(circle, ${color}44, transparent)`,
          pointerEvents: 'none',
        }} />
        
        <div style={{ fontSize: '2.5rem', marginBottom: '12px' }}>{icon}</div>
        
        <h3 style={{
          fontFamily: 'system-ui, sans-serif',
          fontSize: '0.7rem',
          color: color,
          textShadow: '2px 2px 0 #000',
          marginBottom: '10px',
          letterSpacing: '0.1em',
        }}>
          {place}
        </h3>
        
        <p style={{
          fontFamily: 'system-ui, sans-serif',
          fontSize: '1.1rem',
          color: '#fde047',
          textShadow: '2px 2px 0 #000, 0 0 10px rgba(253,224,71,0.4)',
          margin: 0,
          fontWeight: 'bold',
        }}>
          {amount}
        </p>
      </McPanel>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
//  PARTICLE SYSTEM (Floating particles in cavern)
// ═══════════════════════════════════════════════════════════
function CavernParticles() {
  const [particles] = useState(() => {
    const p = [];
    for (let i = 0; i < 50; i++) {
      p.push({
        x: Math.random() * 100,
        y: Math.random() * 100,
        size: Math.random() * 3 + 1,
        speed: Math.random() * 0.3 + 0.1,
        opacity: Math.random() * 0.4 + 0.1,
        delay: Math.random() * 8,
        color: ['#ffaa00', '#00e6ff', '#ff6600', '#aa55ff'][Math.floor(Math.random() * 4)],
      });
    }
    return p;
  });
  
  return (
    <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 2, overflow: 'hidden' }}>
      {particles.map((p, i) => (
        <div
          key={i}
          style={{
            position: 'absolute',
            left: `${p.x}%`,
            top: `${p.y}%`,
            width: `${p.size}px`,
            height: `${p.size}px`,
            background: p.color,
            opacity: p.opacity,
            boxShadow: `0 0 ${p.size * 3}px ${p.color}`,
            animation: `floatParticle ${8 / p.speed}s ease-in-out ${p.delay}s infinite alternate`,
            imageRendering: 'pixelated' as any,
          }}
        />
      ))}
      <style>{`
        @keyframes floatParticle {
          0% { transform: translateY(0) translateX(0); }
          50% { transform: translateY(-30px) translateX(10px); }
          100% { transform: translateY(-60px) translateX(-10px); }
        }
      `}</style>
    </div>
  );
}


// ═══════════════════════════════════════════════════════════
//  UI - COMPLETE STORYBOARD WITH TIMELINE
// ═══════════════════════════════════════════════════════════
function StoryboardUI({ config }: { config: any }) {
  const [caveEntered, setCaveEntered] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    
    const handleScroll = () => {
      if (scrollP >= 0.45 && !caveEntered) setCaveEntered(true);
    };
    window.addEventListener('custom_scroll', handleScroll);
    return () => {
      window.removeEventListener('custom_scroll', handleScroll);
      window.removeEventListener('resize', checkMobile);
    };
  }, [caveEntered]);
  
  const mc: React.CSSProperties = { fontFamily: 'var(--font-minecraft)' };
  
  // Fade out main title as we enter the cave
  const titleOpacity = Math.max(0, 1 - scrollP * 4);

  return (
    <>
      {/* SCROLL TO ENTER TITLE */}
      <div className="fixed top-0 left-0 w-full z-10 flex flex-col items-center pointer-events-none transition-opacity duration-300" style={{ paddingTop: '6vh', opacity: titleOpacity }}>
        <h1 style={{
          ...mc, fontWeight: 900, fontSize: 'clamp(2.5rem, 7vw, 5.5rem)', color: '#d4d4d4',
          WebkitTextStroke: '2px #000', textShadow: '0 2px 0 #000, 0 4px 0 #555, 0 6px 0 #555, 0 8px 0 #000, 4px 12px 10px rgba(0,0,0,.8)',
        }}>MINEVERSE</h1>
        <p style={{ ...mc, color: '#fde047', fontSize: 'clamp(.7rem, 1.8vw, 1.1rem)', textShadow: '2px 2px 0 #000', marginTop: '.6rem' }}>
          A CODING ADVENTURE
        </p>
        <div style={{ marginTop: '2.5rem', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <span style={{ ...mc, color: '#fff', textShadow: '1px 1px 0 #000', fontSize: '.58rem', letterSpacing: '.18em', marginBottom: '.5rem' }}>
            SCROLL TO ENTER
          </span>
          <div className="animate-bounce" style={{ width: 18, height: 18, borderBottom: '3px solid white', borderRight: '3px solid white', transform: 'rotate(45deg)' }} />
        </div>
      </div>
    </>
  );
}


// ═══════════════════════════════════════════════════════════
//  CAVERN CONTENT SECTION (Post-cave scroll)
// ═══════════════════════════════════════════════════════════
function CavernContent({ config }: { config: any }) {
  const [isMobile, setIsMobile] = useState(false);
  
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const mc = { fontFamily: 'var(--font-minecraft)' };

  return (
    <div style={{
      position: 'relative',
      zIndex: 5,
      background: '#0a0a0a',
    }}>
      {/* Cavern BG image with overlay */}
      <div style={{
        position: 'fixed',
        inset: 0,
        zIndex: -1,
        backgroundImage: 'url(/cavern-bg.png)',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
      }}>
        <div style={{
          position: 'absolute',
          inset: 0,
          background: 'linear-gradient(180deg, rgba(0,0,0,0.1) 0%, rgba(0,0,0,0.4) 50%, rgba(0,0,0,0.8) 100%)',
        }} />
      </div>
      
      {/* Floating Particles */}
      <CavernParticles />

      {/* ═══════ WELCOME BANNER ═══════ */}
      <div style={{ padding: '40px 20px 40px', textAlign: 'center' }}>
        <h1 style={{
          ...mc,
          fontSize: 'clamp(2.5rem, 6vw, 4.5rem)',
          color: '#fde047',
          textShadow: '0 2px 0 #b8860b, 0 4px 0 #8b6508, 0 6px 0 #5a4205, 4px 8px 12px rgba(0,0,0,0.9)',
          margin: '0 0 16px',
          letterSpacing: '0.15em',
        }}>
          MINEVERSE
        </h1>
        <p style={{
          ...mc,
          fontSize: 'clamp(0.7rem, 2vw, 1rem)',
          color: '#aaaaaa',
          textShadow: '1px 1px 0 #000',
          letterSpacing: '0.25em',
          marginBottom: '40px',
        }}>
          A CODING ADVENTURE
        </p>
        
        {/* Info Cards */}
        <div style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '16px',
          justifyContent: 'center',
          maxWidth: '900px',
          margin: '0 auto',
          padding: '0 16px',
        }}>
          <McPanel style={{ flex: '1 1 200px', maxWidth: '260px', padding: '20px 16px', textAlign: 'center' }}>
            <div style={{ fontSize: '1.5rem', marginBottom: '8px' }}>📅</div>
            <h3 style={{ fontFamily: 'system-ui, sans-serif', fontSize: '0.55rem', color: '#fca311', textShadow: '1px 1px 0 #000', marginBottom: '6px' }}>DATE</h3>
            <p style={{ fontFamily: 'system-ui, sans-serif', fontSize: '1rem', color: '#e5e5e5', textShadow: '1px 1px 0 #000', lineHeight: '1.6' }}>25TH – 27TH<br/>JULY, 2025</p>
          </McPanel>
          
          <McPanel style={{ flex: '1 1 200px', maxWidth: '260px', padding: '20px 16px', textAlign: 'center' }}>
            <div style={{ fontSize: '1.5rem', marginBottom: '8px' }}>📍</div>
            <h3 style={{ fontFamily: 'system-ui, sans-serif', fontSize: '0.55rem', color: '#fca311', textShadow: '1px 1px 0 #000', marginBottom: '6px' }}>VENUE</h3>
            <p style={{ fontFamily: 'system-ui, sans-serif', fontSize: '1rem', color: '#e5e5e5', textShadow: '1px 1px 0 #000', lineHeight: '1.6' }}>ONLINE + SELECT<br/>VENUES</p>
          </McPanel>
          
          <McPanel style={{ flex: '1 1 200px', maxWidth: '260px', padding: '20px 16px', textAlign: 'center' }}>
            <div style={{ fontSize: '1.5rem', marginBottom: '8px' }}>🎮</div>
            <h3 style={{ fontFamily: 'system-ui, sans-serif', fontSize: '0.55rem', color: '#fca311', textShadow: '1px 1px 0 #000', marginBottom: '6px' }}>WHO CAN JOIN</h3>
            <p style={{ fontFamily: 'system-ui, sans-serif', fontSize: '1rem', color: '#e5e5e5', textShadow: '1px 1px 0 #000', lineHeight: '1.6' }}>OPEN FOR ALL<br/>CODERS!</p>
          </McPanel>
        </div>
      </div>

      {/* Divider */}
      <div style={{ 
        width: '80%', maxWidth: '600px', height: '4px', margin: '20px auto 0',
        background: 'repeating-linear-gradient(90deg, #4a3a28 0px, #4a3a28 8px, transparent 8px, transparent 16px)',
        imageRendering: 'pixelated' as any,
      }} />

      {/* ═══════ PRIZES SECTION ═══════ */}
      <div style={{ padding: '40px 20px' }}>
        <div style={{ textAlign: 'center', marginBottom: '30px' }}>
          <h2 style={{
            ...mc,
            fontSize: 'clamp(1.2rem, 3vw, 2rem)',
            color: '#fde047',
            textShadow: '0 2px 0 #b8860b, 3px 4px 8px rgba(0,0,0,0.8)',
            letterSpacing: '0.15em',
          }}>
            ⚔️ LOOT TABLE ⚔️
          </h2>
          <p style={{
            ...mc,
            fontSize: '0.9rem',
            color: '#888888',
            textShadow: '1px 1px 0 #000',
            letterSpacing: '0.2em',
            marginTop: '8px',
          }}>
            REWARDS FOR THE BRAVEST ADVENTURERS
          </p>
        </div>
        
        <div style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '20px',
          justifyContent: 'center',
          maxWidth: '900px',
          margin: '0 auto',
        }}>
          <PrizeCard place="1ST PLACE" amount="₹50,000" icon="💎" color="#00e6ff" delay={0} />
          <PrizeCard place="2ND PLACE" amount="₹25,000" icon="🥇" color="#ffd700" delay={0.15} />
          <PrizeCard place="3RD PLACE" amount="₹10,000" icon="🥉" color="#cd7f32" delay={0.3} />
        </div>
        
        {/* Goodies banner */}
        <div style={{ textAlign: 'center', marginTop: '24px' }}>
          <McPanel style={{ display: 'inline-block', padding: '12px 30px' }}>
            <span style={{
              ...mc,
              fontSize: '0.6rem',
              color: '#fca311',
              textShadow: '1px 1px 0 #000',
              letterSpacing: '0.15em',
            }}>
              🎁 GOODIES & SWAGS FOR ALL PARTICIPANTS! 🎁
            </span>
          </McPanel>
        </div>
      </div>

      {/* Divider */}
      <div style={{ 
        width: '80%', maxWidth: '600px', height: '4px', margin: '20px auto',
        background: 'repeating-linear-gradient(90deg, #4a3a28 0px, #4a3a28 8px, transparent 8px, transparent 16px)',
        imageRendering: 'pixelated' as any,
      }} />

      {/* ═══════ WHAT TO EXPECT ═══════ */}
      <div style={{ padding: '40px 20px', textAlign: 'center' }}>
        <h2 style={{
          ...mc,
          fontSize: 'clamp(1.2rem, 3vw, 2rem)',
          color: '#fde047',
          textShadow: '0 2px 0 #b8860b, 3px 4px 8px rgba(0,0,0,0.8)',
          letterSpacing: '0.15em',
          marginBottom: '30px',
        }}>
          🗺️ WHAT TO EXPECT
        </h2>
        
        <div style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '16px',
          justifyContent: 'center',
          maxWidth: '900px',
          margin: '0 auto',
        }}>
          {[
            { icon: '💻', title: 'CODING CHALLENGES', desc: '5 rounds of increasing difficulty across biomes' },
            { icon: '⚔️', title: 'PVP BATTLES', desc: 'Compete head-to-head with other teams' },
            { icon: '🏗️', title: 'STRUCTURE BUILDING', desc: 'Build and upgrade your team\'s base' },
            { icon: '🎲', title: 'PHYSICAL GAMES', desc: 'Fun activities and mini-games between rounds' },
            { icon: '🏪', title: 'MARKETPLACE', desc: 'Trade resources and strategize upgrades' },
            { icon: '🏆', title: 'EPIC PRIZES', desc: 'Cash prizes, certificates, and exclusive swag' },
          ].map((item, i) => (
            <ExpectCard key={i} {...item} delay={i * 0.1} />
          ))}
        </div>
      </div>

      {/* ═══════ REGISTRATION FORM ═══════ */}
      <div id="register" style={{
        padding: '60px 20px 80px',
        textAlign: 'center',
        position: 'relative',
        display: 'flex',
        justifyContent: 'center'
      }}>
        <RegistrationForm />
      </div>
      
      {/* Footer */}
      <div style={{
        padding: '20px',
        textAlign: 'center',
        borderTop: '3px solid #1a110a',
        background: 'rgba(0,0,0,0.5)',
      }}>
        <p style={{
          ...mc,
          fontSize: '0.8rem',
          color: '#555555',
          textShadow: '1px 1px 0 #000',
          letterSpacing: '0.15em',
        }}>
          MINEVERSE © 2025 — CRAFTED WITH ❤️
        </p>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
//  EXPECT CARD
// ═══════════════════════════════════════════════════════════
function ExpectCard({ icon, title, desc, delay }: { icon: string; title: string; desc: string; delay: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setVisible(true); obs.disconnect(); } },
      { threshold: 0.3 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  
  return (
    <div
      ref={ref}
      style={{
        flex: '1 1 240px',
        maxWidth: '280px',
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(30px)',
        transition: `opacity 0.6s ease ${delay}s, transform 0.6s ease ${delay}s`,
      }}
    >
      <McPanel style={{ padding: '20px 16px', textAlign: 'center', height: '100%' }}>
        <div style={{ fontSize: '1.8rem', marginBottom: '10px' }}>{icon}</div>
        <h3 style={{
          fontFamily: 'system-ui, sans-serif',
          fontSize: '1rem',
          color: '#fca311',
          textShadow: '1px 1px 0 #000',
          marginBottom: '8px',
          letterSpacing: '0.1em',
        }}>
          {title}
        </h3>
        <p style={{
          fontFamily: 'system-ui, sans-serif',
          fontSize: '0.85rem',
          color: '#cccccc',
          textShadow: '1px 1px 0 #000',
          lineHeight: '1.6',
          margin: 0,
        }}>
          {desc}
        </p>
      </McPanel>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
//  MAIN EXPORT
// ═══════════════════════════════════════════════════════════
export function MinecraftLanding({ config }: { config: any }) {
  const [showCavern, setShowCavern] = useState(false);
  
  useEffect(() => {
    const handleScroll = () => {
      if (scrollP >= 0.95 && !showCavern) setShowCavern(true);
      else if (scrollP < 0.95 && showCavern) setShowCavern(false);
    };
    window.addEventListener('custom_scroll', handleScroll);
    return () => window.removeEventListener('custom_scroll', handleScroll);
  }, [showCavern]);

  return (
    <div style={{ position: 'relative', background: '#000' }}>
      {/* Section 1: 3D Cave entrance - 110vh so we have a tiny scroll area to trigger animation */}
      <div style={{ position: 'relative', height: showCavern ? '0px' : '110vh', backgroundColor: '#000', overflow: 'hidden' }}>
        <div id="bg-mountain" style={{ 
          position: 'fixed', 
          inset: 0, 
          zIndex: 0,
          backgroundImage: 'url(/image.png)',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }} />
        <div style={{ 
          position: 'fixed', 
          inset: 0, 
          zIndex: 1,
          filter: 'brightness(1.1) contrast(1.15) saturate(1.2)',
          boxShadow: 'inset 0 0 150px rgba(0,0,0,0.8)',
          pointerEvents: 'none'
        }}>
          <div style={{ width: '100%', height: '100%', pointerEvents: 'auto' }}>
            <Canvas
              camera={{ position: [0, 2, 22], fov: 80 }}
              gl={{ antialias: false, powerPreference: 'high-performance' }}
              shadows="basic"
            >
              <World />
            </Canvas>
          </div>
        </div>
        
        {/* Black fade overlay when deep inside cave */}
        <div style={{
          position: 'fixed',
          inset: 0,
          zIndex: 2,
          background: '#000',
          opacity: showCavern ? 1 : 0,
          transition: 'opacity 1.5s ease',
          pointerEvents: showCavern ? 'auto' : 'none',
        }} />
        
        <StoryboardUI config={config} />
      </div>
      
      {/* Section 2: Cavern content with timeline (only renders after transition) */}
      {showCavern && (
        <div style={{
          position: 'relative',
          zIndex: 10,
          opacity: 1,
          animation: 'fadeInCavern 2s ease forwards',
        }}>
          <style>{`
            @keyframes fadeInCavern {
              0% { opacity: 0; }
              100% { opacity: 1; }
            }
          `}</style>
          <CavernContent config={config} />
        </div>
      )}
    </div>
  );
}




