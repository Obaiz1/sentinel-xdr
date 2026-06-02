"use client";

import { useRef, Suspense, useMemo } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";

function FloatingCube({ position, speed, color }: { position: [number, number, number]; speed: number; color: number }) {
  const ref = useRef<THREE.Mesh>(null);
  const t0 = useMemo(() => Math.random() * Math.PI * 2, []);
  useFrame(({ clock }) => {
    const t = clock.getElapsedTime() * speed + t0;
    if (ref.current) {
      ref.current.rotation.x = t * 0.7;
      ref.current.rotation.y = t * 0.5;
      ref.current.position.y = position[1] + Math.sin(t * 0.8) * 0.4;
    }
  });
  return (
    <mesh ref={ref} position={position}>
      <boxGeometry args={[0.35, 0.35, 0.35]} />
      <meshBasicMaterial color={color} wireframe transparent opacity={0.6} />
    </mesh>
  );
}

function FloatingOctahedron({ position, speed, color }: { position: [number, number, number]; speed: number; color: number }) {
  const ref = useRef<THREE.Mesh>(null);
  const t0 = useMemo(() => Math.random() * Math.PI * 2, []);
  useFrame(({ clock }) => {
    const t = clock.getElapsedTime() * speed + t0;
    if (ref.current) {
      ref.current.rotation.x = t * 0.5;
      ref.current.rotation.z = t * 0.3;
      ref.current.position.y = position[1] + Math.cos(t * 0.6) * 0.5;
    }
  });
  return (
    <mesh ref={ref} position={position}>
      <octahedronGeometry args={[0.28]} />
      <meshBasicMaterial color={color} wireframe transparent opacity={0.5} />
    </mesh>
  );
}

function FloatingTorus({ position, speed, color }: { position: [number, number, number]; speed: number; color: number }) {
  const ref = useRef<THREE.Mesh>(null);
  const t0 = useMemo(() => Math.random() * Math.PI * 2, []);
  useFrame(({ clock }) => {
    const t = clock.getElapsedTime() * speed + t0;
    if (ref.current) {
      ref.current.rotation.y = t * 0.8;
      ref.current.rotation.x = Math.PI / 4 + Math.sin(t * 0.4) * 0.3;
      ref.current.position.y = position[1] + Math.sin(t * 0.5) * 0.35;
    }
  });
  return (
    <mesh ref={ref} position={position}>
      <torusGeometry args={[0.22, 0.06, 8, 40]} />
      <meshBasicMaterial color={color} transparent opacity={0.55} />
    </mesh>
  );
}

export default function FloatingObjects() {
  return (
    <div style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 1 }}>
      <Canvas camera={{ position: [0, 0, 8], fov: 60 }} style={{ background: "transparent" }} gl={{ antialias: true, alpha: true }}>
        <Suspense fallback={null}>
          <FloatingCube position={[-6, 2, -2]} speed={0.4} color={0x00d4ff} />
          <FloatingCube position={[6.5, -1.5, -3]} speed={0.3} color={0x00ff88} />
          <FloatingCube position={[-5.5, -3, -1]} speed={0.5} color={0xa855f7} />
          <FloatingOctahedron position={[5, 3, -2]} speed={0.45} color={0xff3366} />
          <FloatingOctahedron position={[-7, 0, -3]} speed={0.35} color={0x00d4ff} />
          <FloatingTorus position={[7, -3, -2]} speed={0.4} color={0xffa500} />
          <FloatingTorus position={[-4, 3.5, -2]} speed={0.5} color={0x00ff88} />
        </Suspense>
      </Canvas>
    </div>
  );
}
