import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { AssistantState, ColorTheme } from '../types';
import { audioEngineInstance } from '../lib/audioEngine';

interface EnergyRingsProps {
  state: AssistantState;
  theme: ColorTheme;
}

export function EnergyRings({ state, theme }: EnergyRingsProps) {
  const ring1Ref = useRef<THREE.Group>(null);
  const ring2Ref = useRef<THREE.Group>(null);
  const ring3Ref = useRef<THREE.Group>(null);

  useFrame((stateCtx) => {
    const time = stateCtx.clock.getElapsedTime();
    const audioData = audioEngineInstance.getAudioData(state, time);

    // Subtle audio pulse scale without rotation spinning
    if (ring1Ref.current) {
      const scale1 = 1 + audioData.bass * 0.15;
      ring1Ref.current.scale.set(scale1, scale1, scale1);
    }

    if (ring2Ref.current) {
      const scale2 = 1 + audioData.mid * 0.18;
      ring2Ref.current.scale.set(scale2, scale2, scale2);
    }

    if (ring3Ref.current) {
      const scale3 = 1 + audioData.treble * 0.15;
      ring3Ref.current.scale.set(scale3, scale3, scale3);
    }
  });

  return (
    <group position={[0, 0, 0]}>
      {/* Ring 1 - Cyan / Primary translucent torus at static angle */}
      <group ref={ring1Ref} rotation={[Math.PI * 0.35, 0, Math.PI * 0.15]}>
        <mesh>
          <torusGeometry args={[2.1, 0.02, 24, 96]} />
          <meshBasicMaterial
            color={theme.primary}
            transparent={true}
            opacity={0.65}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
          />
        </mesh>
      </group>

      {/* Ring 2 - Violet / Secondary torus at static angle */}
      <group ref={ring2Ref} rotation={[-Math.PI * 0.28, Math.PI * 0.2, -Math.PI * 0.1]}>
        <mesh>
          <torusGeometry args={[2.45, 0.015, 24, 96]} />
          <meshBasicMaterial
            color={theme.secondary}
            transparent={true}
            opacity={0.55}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
          />
        </mesh>
      </group>

      {/* Ring 3 - Outer thin Accent halo at static angle */}
      <group ref={ring3Ref} rotation={[Math.PI * 0.65, -Math.PI * 0.15, Math.PI * 0.25]}>
        <mesh>
          <torusGeometry args={[2.8, 0.01, 16, 96]} />
          <meshBasicMaterial
            color={theme.accent}
            transparent={true}
            opacity={0.45}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
          />
        </mesh>
      </group>
    </group>
  );
}
