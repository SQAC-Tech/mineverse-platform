'use client';

import React, { useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Float, OrbitControls, Sparkles } from '@react-three/drei';
import type { Group } from 'three';
import { IronGolem3DMesh } from './IronGolem3DMesh';

interface GardenGateScene3DProps {
  eyeState?: 'neutral' | 'glowing' | 'angry';
  gateOpen?: boolean;
}

function AncientGateMesh({ gateOpen = false }: { gateOpen?: boolean }) {
  const leftDoorRef = useRef<Group>(null);
  const rightDoorRef = useRef<Group>(null);

  useFrame(() => {
    // 3D Gate Opening Animation
    if (leftDoorRef.current && rightDoorRef.current) {
      const targetLeftRot = gateOpen ? -1.4 : 0;
      const targetRightRot = gateOpen ? 1.4 : 0;

      leftDoorRef.current.rotation.y += (targetLeftRot - leftDoorRef.current.rotation.y) * 0.05;
      rightDoorRef.current.rotation.y += (targetRightRot - rightDoorRef.current.rotation.y) * 0.05;
    }
  });

  return (
    <group position={[0, -0.5, -2]}>
      {/* LEFT PILLAR */}
      <mesh position={[-3, 2.5, 0]}>
        <boxGeometry args={[1.2, 6, 1.2]} />
        <meshStandardMaterial color="#3f3f46" roughness={0.8} />
      </mesh>
      <mesh position={[-3, 5.8, 0]}>
        <boxGeometry args={[1.6, 0.6, 1.6]} />
        <meshStandardMaterial color="#52525b" roughness={0.7} />
      </mesh>

      {/* RIGHT PILLAR */}
      <mesh position={[3, 2.5, 0]}>
        <boxGeometry args={[1.2, 6, 1.2]} />
        <meshStandardMaterial color="#3f3f46" roughness={0.8} />
      </mesh>
      <mesh position={[3, 5.8, 0]}>
        <boxGeometry args={[1.6, 0.6, 1.6]} />
        <meshStandardMaterial color="#52525b" roughness={0.7} />
      </mesh>

      {/* ARCH / LINTEL TOP BEAM */}
      <mesh position={[0, 5.7, 0]}>
        <boxGeometry args={[7.2, 0.8, 1.4]} />
        <meshStandardMaterial color="#27272a" roughness={0.7} />
      </mesh>
      {/* ARCH EMBLEM / GLYPH */}
      <mesh position={[0, 5.7, 0.75]}>
        <boxGeometry args={[1.2, 0.5, 0.1]} />
        <meshStandardMaterial color="#b45309" emissive="#78350f" emissiveIntensity={0.6} />
      </mesh>

      {/* NETHER PORTAL BEHIND GATE (REVEALED WHEN OPEN) */}
      <mesh position={[0, 2.5, -0.2]}>
        <planeGeometry args={[4.4, 5.2]} />
        <meshStandardMaterial
          color="#9333ea"
          emissive="#a855f7"
          emissiveIntensity={gateOpen ? 3.0 : 0.4}
          roughness={0.2}
        />
      </mesh>

      {/* LEFT GATE DOOR */}
      <group ref={leftDoorRef} position={[-2.2, 2.5, 0]}>
        <mesh position={[1.1, 0, 0]}>
          <boxGeometry args={[2.2, 5.2, 0.3]} />
          <meshStandardMaterial color="#18181b" roughness={0.6} metalness={0.8} />
        </mesh>
        {/* Iron Bars */}
        <mesh position={[1.1, 0, 0.16]}>
          <boxGeometry args={[1.8, 4.6, 0.05]} />
          <meshStandardMaterial color="#3f3f46" metalness={0.9} roughness={0.3} />
        </mesh>
      </group>

      {/* RIGHT GATE DOOR */}
      <group ref={rightDoorRef} position={[2.2, 2.5, 0]}>
        <mesh position={[-1.1, 0, 0]}>
          <boxGeometry args={[2.2, 5.2, 0.3]} />
          <meshStandardMaterial color="#18181b" roughness={0.6} metalness={0.8} />
        </mesh>
        {/* Iron Bars */}
        <mesh position={[-1.1, 0, 0.16]}>
          <boxGeometry args={[1.8, 4.6, 0.05]} />
          <meshStandardMaterial color="#3f3f46" metalness={0.9} roughness={0.3} />
        </mesh>
      </group>
    </group>
  );
}

function OverworldGardenTerrain() {
  return (
    <group position={[0, -1.8, 0]}>
      {/* GRASS / MOSS GROUND PLANE */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
        <planeGeometry args={[30, 30]} />
        <meshStandardMaterial color="#14532d" roughness={0.9} />
      </mesh>

      {/* MOSS & COBBLESTONES */}
      {[-4, -2, 2, 4].map((x, i) => (
        <mesh key={i} position={[x, 0.05, (i % 2 === 0 ? 1 : -1) * 2]}>
          <boxGeometry args={[1.2, 0.1, 1.2]} />
          <meshStandardMaterial color="#3f3f46" roughness={0.8} />
        </mesh>
      ))}
    </group>
  );
}

export function GardenGateScene3D({ eyeState = 'neutral', gateOpen = false }: GardenGateScene3DProps) {
  return (
    <div className="absolute inset-0 w-full h-full pointer-events-none select-none z-0 overflow-hidden">
      <Canvas
        camera={{ position: [0, 1.2, 7.5], fov: 48 }}
        gl={{ antialias: true, alpha: true }}
        style={{ width: '100%', height: '100%' }}
      >
        {/* LIGHTING SETUP */}
        <ambientLight intensity={0.6} color="#dcfce7" />
        <directionalLight position={[5, 10, 5]} intensity={1.2} color="#fef08a" castShadow />
        <pointLight position={[-3, 2, 2]} intensity={2.0} color="#38bdf8" distance={8} />

        {/* FLOATING GARDEN SPORES & GLOW PARTICLES */}
        <Sparkles count={60} scale={[12, 8, 10]} size={3} speed={0.4} color="#fef08a" />
        <Sparkles count={40} scale={[8, 6, 8]} size={4} speed={0.8} color="#a855f7" />

        {/* 3D ANCIENT GARDEN TERRAIN */}
        <OverworldGardenTerrain />

        {/* 3D ANCIENT STONE GATE */}
        <AncientGateMesh gateOpen={gateOpen} />

        {/* 3D IRON GOLEM GATEKEEPER (SITTING ON LEFT SIDE OF GATE) */}
        <Float speed={1.2} rotationIntensity={0.1} floatIntensity={0.2}>
          <IronGolem3DMesh
            eyeState={eyeState}
            position={[-3.2, -1.2, 0.5]}
            rotation={[0, 0.45, 0]}
            scale={0.85}
          />
        </Float>

        <OrbitControls
          enableZoom={false}
          enablePan={false}
          maxPolarAngle={Math.PI / 2.1}
          minPolarAngle={Math.PI / 3}
          maxAzimuthAngle={Math.PI / 6}
          minAzimuthAngle={-Math.PI / 6}
        />
      </Canvas>
    </div>
  );
}
