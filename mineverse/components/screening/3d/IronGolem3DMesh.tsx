'use client';

import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import type { Group } from 'three';

interface IronGolem3DMeshProps {
  eyeState?: 'neutral' | 'glowing' | 'angry';
  position?: [number, number, number];
  rotation?: [number, number, number];
  scale?: number;
}

export function IronGolem3DMesh({
  eyeState = 'neutral',
  position = [-3.2, -1.2, 0],
  rotation = [0, 0.4, 0],
  scale = 0.85,
}: IronGolem3DMeshProps) {
  const groupRef = useRef<Group>(null);
  const headRef = useRef<Group>(null);

  // Dynamic eye glow color
  const eyeColor =
    eyeState === 'angry'
      ? '#ef4444' // Red
      : eyeState === 'glowing'
      ? '#f59e0b' // Amber/Gold
      : '#10b981'; // Emerald/Cyan

  // Idle breathing animation in 3D
  useFrame((state) => {
    const t = state.clock.getElapsedTime();
    if (groupRef.current) {
      // Subtle idle breathing movement
      groupRef.current.position.y = position[1] + Math.sin(t * 1.5) * 0.05;
    }
    if (headRef.current) {
      // Head slight look-around
      headRef.current.rotation.y = Math.sin(t * 0.8) * 0.08;
      headRef.current.rotation.x = Math.cos(t * 1.2) * 0.04;
    }
  });

  return (
    <group ref={groupRef} position={position} rotation={rotation} scale={[scale, scale, scale]}>
      {/* GOLEM BASE / SITTING HIPS */}
      <mesh position={[0, 0.4, 0]}>
        <boxGeometry args={[1.6, 0.8, 1.2]} />
        <meshStandardMaterial color="#71717a" roughness={0.6} metalness={0.7} />
      </mesh>

      {/* LEGS (FOLDED SITTING POSITION) */}
      <mesh position={[-0.6, 0.2, 0.5]} rotation={[0.4, 0, 0]}>
        <boxGeometry args={[0.6, 0.6, 1.2]} />
        <meshStandardMaterial color="#52525b" roughness={0.7} metalness={0.6} />
      </mesh>
      <mesh position={[0.6, 0.2, 0.5]} rotation={[0.4, 0, 0]}>
        <boxGeometry args={[0.6, 0.6, 1.2]} />
        <meshStandardMaterial color="#52525b" roughness={0.7} metalness={0.6} />
      </mesh>

      {/* TORSO / CHEST (MASSIVE ANCIENT IRON BLOCK) */}
      <mesh position={[0, 1.8, 0]}>
        <boxGeometry args={[2.2, 1.8, 1.4]} />
        <meshStandardMaterial color="#a1a1aa" roughness={0.5} metalness={0.8} />
      </mesh>

      {/* CHEST PLATE HIGHLIGHT */}
      <mesh position={[0, 2.0, 0.71]}>
        <boxGeometry args={[1.8, 1.0, 0.05]} />
        <meshStandardMaterial color="#d4d4d8" roughness={0.4} metalness={0.9} />
      </mesh>

      {/* VINES & MOSS ACCENTS ON CHEST */}
      <mesh position={[-0.5, 1.7, 0.72]}>
        <boxGeometry args={[0.6, 0.8, 0.06]} />
        <meshStandardMaterial color="#15803d" roughness={0.9} />
      </mesh>
      <mesh position={[0.6, 2.1, 0.72]}>
        <boxGeometry args={[0.5, 0.5, 0.06]} />
        <meshStandardMaterial color="#16a34a" roughness={0.9} />
      </mesh>

      {/* RED POPPY FLOWER EMBLEM ON CHEST */}
      <mesh position={[0.7, 1.5, 0.73]}>
        <boxGeometry args={[0.25, 0.25, 0.08]} />
        <meshStandardMaterial color="#dc2626" emissive="#7f1d1d" emissiveIntensity={0.5} />
      </mesh>

      {/* MASSIVE ARMS RESTING ON GROUND */}
      {/* Left Arm */}
      <mesh position={[-1.5, 1.2, 0.3]} rotation={[0.2, 0, -0.1]}>
        <boxGeometry args={[0.6, 2.2, 0.7]} />
        <meshStandardMaterial color="#a1a1aa" roughness={0.5} metalness={0.8} />
      </mesh>
      {/* Right Arm */}
      <mesh position={[1.5, 1.2, 0.3]} rotation={[0.2, 0, 0.1]}>
        <boxGeometry args={[0.6, 2.2, 0.7]} />
        <meshStandardMaterial color="#a1a1aa" roughness={0.5} metalness={0.8} />
      </mesh>

      {/* HEAD GROUP (WITH GLOWING EYES & NOSE) */}
      <group ref={headRef} position={[0, 3.1, 0.1]}>
        {/* Head Cube */}
        <mesh position={[0, 0, 0]}>
          <boxGeometry args={[1.1, 1.1, 1.1]} />
          <meshStandardMaterial color="#d4d4d8" roughness={0.4} metalness={0.85} />
        </mesh>

        {/* Brow Line */}
        <mesh position={[0, 0.45, 0.56]}>
          <boxGeometry args={[1.15, 0.2, 0.1]} />
          <meshStandardMaterial color="#71717a" roughness={0.6} />
        </mesh>

        {/* Long Nose */}
        <mesh position={[0, -0.1, 0.65]}>
          <boxGeometry args={[0.22, 0.45, 0.25]} />
          <meshStandardMaterial color="#b45309" roughness={0.8} />
        </mesh>

        {/* GLOWING 3D EYES */}
        {/* Left Eye */}
        <mesh position={[-0.28, 0.12, 0.56]}>
          <boxGeometry args={[0.22, 0.12, 0.08]} />
          <meshStandardMaterial color={eyeColor} emissive={eyeColor} emissiveIntensity={2.5} />
        </mesh>
        {/* Right Eye */}
        <mesh position={[0.28, 0.12, 0.56]}>
          <boxGeometry args={[0.22, 0.12, 0.08]} />
          <meshStandardMaterial color={eyeColor} emissive={eyeColor} emissiveIntensity={2.5} />
        </mesh>

        {/* Subtle Eye Point Light */}
        <pointLight position={[0, 0.1, 0.8]} color={eyeColor} intensity={eyeState === 'angry' ? 4 : 2} distance={3} />
      </group>
    </group>
  );
}
