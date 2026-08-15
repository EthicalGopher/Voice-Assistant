import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { AssistantState, ColorTheme } from '../types';
import { audioEngineInstance } from '../lib/audioEngine';

interface ParticleFieldProps {
  state: AssistantState;
  theme: ColorTheme;
  count?: number;
}

function createSeededRandom(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

export function ParticleField({ state, theme, count = 1200 }: ParticleFieldProps) {
  const pointsRef = useRef<THREE.Points>(null);

  // Generate initial particle positions and colors
  const { positions, colors } = useMemo(() => {
    const random = createSeededRandom(42);
    const pos = new Float32Array(count * 3);
    const col = new Float32Array(count * 3);

    const colorPrimary = new THREE.Color(theme.primary);
    const colorSecondary = new THREE.Color(theme.secondary);
    const colorAccent = new THREE.Color(theme.accent);

    for (let i = 0; i < count; i++) {
      // Orbital distribution around the center sphere
      const radius = 1.6 + random() * 4.5;
      const theta = random() * Math.PI * 2;
      const phi = Math.acos(2 * random() - 1);

      pos[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
      pos[i * 3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
      pos[i * 3 + 2] = radius * Math.cos(phi);

      // Mix palette
      const r = random();
      const chosenColor = r < 0.5 ? colorPrimary : r < 0.85 ? colorSecondary : colorAccent;
      col[i * 3] = chosenColor.r;
      col[i * 3 + 1] = chosenColor.g;
      col[i * 3 + 2] = chosenColor.b;
    }

    return { positions: pos, colors: col };
  }, [count, theme]);

  useFrame((stateCtx) => {
    const time = stateCtx.clock.getElapsedTime();
    const audioData = audioEngineInstance.getAudioData(state, time);

    if (pointsRef.current) {
      let speed = 0.15;
      if (state === 'listening') speed = 0.45;
      if (state === 'processing') speed = 0.8;
      if (state === 'speaking') speed = 0.55;

      // Rotate particle cloud
      pointsRef.current.rotation.y = time * speed;
      pointsRef.current.rotation.x = Math.sin(time * 0.1) * 0.15;

      // Pulsing particle scale expansion based on volume
      const expansion = 1.0 + audioData.smoothedVolume * 0.4;
      pointsRef.current.scale.set(expansion, expansion, expansion);
    }
  });

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          args={[positions, 3]}
        />
        <bufferAttribute
          attach="attributes-color"
          args={[colors, 3]}
        />
      </bufferGeometry>
      <pointsMaterial
        size={0.06}
        vertexColors={true}
        transparent={true}
        opacity={0.8}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
        sizeAttenuation={true}
      />
    </points>
  );
}
