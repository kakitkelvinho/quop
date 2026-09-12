"use client";

import { Canvas, useFrame } from "@react-three/fiber";
import { Html, Line } from "@react-three/drei";
import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { Group } from "three";
import * as THREE from "three";

import { navSections, type NavSection } from "@/components/navigation";

const ORBIT_SECONDS = 30;
const ANGULAR_SPEED = (Math.PI * 2) / ORBIT_SECONDS;

function OrbitRing({
  color,
  radius,
  rotation,
}: {
  color: string;
  radius: number;
  rotation: [number, number, number];
}) {
  const points = useMemo(() => {
    const orbitPoints: THREE.Vector3[] = [];

    for (let index = 0; index <= 200; index += 1) {
      const angle = (index / 200) * Math.PI * 2;
      orbitPoints.push(
        new THREE.Vector3(
          Math.cos(angle) * radius,
          Math.sin(angle) * radius * 0.24,
          0,
        ),
      );
    }

    return orbitPoints;
  }, [radius]);

  return (
    <group rotation={rotation}>
      <Line color={color} lineWidth={0.8} opacity={0.28} points={points} transparent />
    </group>
  );
}

function Electron({
  section,
  index,
}: {
  section: NavSection;
  index: number;
}) {
  const router = useRouter();
  const groupRef = useRef<Group | null>(null);
  const radius = 1.8 + index * 0.78;
  const rotation: [number, number, number] = [
    0.5 + index * 0.26,
    index * 0.72,
    0.12 + index * 0.18,
  ];

  useFrame(({ clock }) => {
    const group = groupRef.current;

    if (!group) {
      return;
    }

    const angle = clock.getElapsedTime() * ANGULAR_SPEED + section.orbitalPhase;
    group.position.set(
      Math.cos(angle) * radius,
      Math.sin(angle) * radius * 0.24,
      Math.sin(angle * 0.9) * 0.22,
    );
  });

  return (
    <group rotation={rotation}>
      <group ref={groupRef}>
        <mesh>
          <sphereGeometry args={[0.08, 24, 24]} />
          <meshStandardMaterial color={section.accent} emissive={section.accent} emissiveIntensity={0.85} />
        </mesh>
        <mesh scale={1.9}>
          <sphereGeometry args={[0.08, 18, 18]} />
          <meshBasicMaterial color={section.accent} transparent opacity={0.07} />
        </mesh>
        <Html center distanceFactor={8.5}>
          <button
            className="atomMinimal__electronLabel"
            onClick={() => router.push(section.href)}
            type="button"
          >
            {section.label}
          </button>
        </Html>
      </group>
    </group>
  );
}

function AtomScene() {
  const rootRef = useRef<Group | null>(null);

  useFrame((state) => {
    const group = rootRef.current;

    if (!group) {
      return;
    }

    const targetY = state.pointer.x * 0.28;
    const targetX = state.pointer.y * 0.18;

    group.rotation.y += (targetY - group.rotation.y) * 0.02;
    group.rotation.x += (targetX - group.rotation.x) * 0.02;
    group.position.x += (state.pointer.x * 0.22 - group.position.x) * 0.03;
    group.position.y += (state.pointer.y * 0.16 - group.position.y) * 0.03;
  });

  return (
    <group ref={rootRef}>
      <ambientLight intensity={0.8} />
      <pointLight color="#ffd39f" intensity={16} position={[0, 0, 0]} />
      <pointLight color="#8cbcff" intensity={4} position={[4, 2, 4]} />

      <mesh>
        <sphereGeometry args={[0.55, 40, 40]} />
        <meshStandardMaterial color="#fff1d6" emissive="#ffc780" emissiveIntensity={1.1} roughness={0.24} />
      </mesh>
      <mesh scale={1.7}>
        <sphereGeometry args={[0.55, 24, 24]} />
        <meshBasicMaterial color="#ffbe71" transparent opacity={0.06} />
      </mesh>

      {navSections.map((section, index) => (
        <OrbitRing
          color={section.accent}
          key={`${section.href}-orbit`}
          radius={1.8 + index * 0.78}
          rotation={[0.5 + index * 0.26, index * 0.72, 0.12 + index * 0.18]}
        />
      ))}

      {navSections.map((section, index) => (
        <Electron index={index} key={section.href} section={section} />
      ))}
    </group>
  );
}

function StaticAtomFallback() {
  return (
    <div className="atomMinimal__fallback">
      <div className="atomMinimal__fallbackCore">QUOP</div>
      {navSections.map((section, index) => (
        <a
          className={`atomMinimal__fallbackElectron atomMinimal__fallbackElectron--${index + 1}`}
          href={section.href}
          key={section.href}
        >
          {section.label}
        </a>
      ))}
    </div>
  );
}

export default function AtomHero() {
  const [useFallback] = useState(() => {
    if (typeof window === "undefined") {
      return false;
    }

    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const canvas = document.createElement("canvas");
    const hasWebgl = Boolean(
      canvas.getContext("webgl") || canvas.getContext("experimental-webgl"),
    );

    return prefersReducedMotion || !hasWebgl;
  });

  return (
    <div className="atomMinimal">
      {!useFallback ? (
        <Canvas camera={{ fov: 30, position: [0, 0, 9] }} dpr={[1, 1.5]}>
          <AtomScene />
        </Canvas>
      ) : (
        <StaticAtomFallback />
      )}
      <div className="atomMinimal__coreLabel">QUOP</div>
    </div>
  );
}
