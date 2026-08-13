import { useRef, useEffect } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { AssistantState, ColorTheme } from '../types';
import { AIOrb } from './AIOrb';
import { EnergyRings } from './EnergyRings';
import { AudioWaveform } from './AudioWaveform';
import { ParticleField } from './ParticleField';

interface AIVisualizationProps {
  state: AssistantState;
  theme: ColorTheme;
  particleCount?: number;
}

// Smooth Camera Parallax without frame jitter
function CameraParallax() {
  const mouseRef = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      const x = (e.clientX / window.innerWidth - 0.5) * 2;
      const y = (e.clientY / window.innerHeight - 0.5) * 2;
      mouseRef.current = { x, y };
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  useFrame((stateCtx) => {
    const { camera } = stateCtx;
    const targetX = mouseRef.current.x * 0.25;
    const targetY = -mouseRef.current.y * 0.2;

    camera.position.x += (targetX - camera.position.x) * 0.05;
    camera.position.y += (targetY - camera.position.y) * 0.05;
    camera.lookAt(0, 0, 0);
  });

  return null;
}

export function AIVisualization({
  state,
  theme,
  particleCount = 1000,
}: AIVisualizationProps) {
  return (
    <div className="relative w-full h-full pointer-events-none select-none">
      <Canvas
        camera={{ position: [0, 0, 7.5], fov: 45 }}
        gl={{
          antialias: true,
          alpha: true,
          powerPreference: 'high-performance',
          toneMapping: THREE.NoToneMapping,
        }}
        className="w-full h-full"
      >
        <CameraParallax />

        {/* Lighting */}
        <ambientLight intensity={0.6} />
        <directionalLight position={[5, 5, 5]} intensity={0.9} />

        {/* Dynamic 3D Scene Components */}
        <group position={[0, 0.2, 0]}>
          <AIOrb state={state} theme={theme} />
          <EnergyRings state={state} theme={theme} />
          <AudioWaveform state={state} theme={theme} />
          <ParticleField state={state} theme={theme} count={particleCount} />
        </group>
      </Canvas>

      {/* Radial background aura gradient matching reference image */}
      <div
        className="absolute inset-0 -z-10 transition-all duration-1000 ease-out pointer-events-none"
        style={{
          background: `radial-gradient(circle at 50% 45%, ${theme.backgroundGlow} 0%, rgba(5,7,13,0.95) 60%, #05070d 100%)`,
        }}
      />
    </div>
  );
}
