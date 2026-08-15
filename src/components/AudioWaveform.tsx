import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { AssistantState, ColorTheme } from '../types';
import { audioEngineInstance } from '../lib/audioEngine';

interface AudioWaveformProps {
  state: AssistantState;
  theme: ColorTheme;
}

// GLSL shader for multi-contoured silk glowing waveform ribbon without illegal GLSL ES 1.0 array indexing
const WaveformVertexShader = `
  uniform float uTime;
  uniform float uAudioVolume;
  uniform float uAudioBass;
  uniform float uAudioTreble;
  uniform float uAudioPitch;
  uniform float uSpeed;
  uniform float uStrandIndex;
  
  varying vec2 vUv;
  varying float vDisplacement;
  varying float vEnvelope;

  void main() {
    vUv = uv;

    float x = position.x;

    // Gaussian envelope centered at x = 0 (peaking in center, tapering to zero at screen edges)
    float envelope = exp(-pow(x * 0.18, 2.0));
    vEnvelope = envelope;

    // Multi-harmonic silk wave curves modulated by pitch
    float phaseShift = uStrandIndex * 1.047;
    float freq1 = (0.45 + uStrandIndex * 0.08) * (0.8 + uAudioPitch * 0.5);
    float freq2 = (0.95 + uStrandIndex * 0.12) * (0.8 + uAudioPitch * 0.6);
    float freq3 = (2.10 - uStrandIndex * 0.15) * (0.9 + uAudioPitch * 0.4);

    float wave1 = sin(x * freq1 + uTime * uSpeed * 1.8 + phaseShift);
    float wave2 = sin(x * freq2 - uTime * uSpeed * 1.2 + phaseShift * 1.4);
    float wave3 = cos(x * freq3 + uTime * uSpeed * 2.4);

    float combinedWave = wave1 * 0.5 + wave2 * 0.35 + wave3 * 0.15;

    // Vertical Y displacement with pitch harmonic boost
    float audioBoost = uAudioVolume * 1.4 + uAudioBass * 0.8 + uAudioTreble * 0.6 + uAudioPitch * uAudioVolume * 0.6;
    float amplitude = (0.28 + audioBoost) * envelope;
    float yDisplacement = combinedWave * amplitude;

    // Z depth modulation for 3D ribbon separation
    float zDisplacement = sin(x * 0.3 + uStrandIndex * 1.1) * 0.15 * envelope;

    vDisplacement = yDisplacement;

    vec3 newPosition = position;
    newPosition.y += yDisplacement;
    newPosition.z += zDisplacement;

    gl_Position = projectionMatrix * modelViewMatrix * vec4(newPosition, 1.0);
  }
`;

const WaveformFragmentShader = `
  uniform vec3 uColor1;
  uniform vec3 uColor2;
  uniform float uStrandIndex;
  uniform float uAlpha;

  varying vec2 vUv;
  varying float vDisplacement;
  varying float vEnvelope;

  void main() {
    // Horizontal gradient mixing along the wave
    float mixFactor = vUv.x;
    vec3 color = mix(uColor1, uColor2, mixFactor);

    // Brighten central peaks
    float glow = pow(vEnvelope, 1.5) * 1.4;
    color *= (0.7 + glow * 0.6);

    float finalAlpha = uAlpha * vEnvelope * (0.45 + glow * 0.55);
    gl_FragColor = vec4(color, finalAlpha);
  }
`;

export function AudioWaveform({ state, theme }: AudioWaveformProps) {
  const meshRefs = useRef<(THREE.Mesh | null)[]>([]);
  const materialRefs = useRef<(THREE.ShaderMaterial | null)[]>([]);

  // Create horizontal ribbon geometries (-16 to +16 in 3D world units)
  const geometry = useMemo(() => {
    return new THREE.PlaneGeometry(32, 0.1, 180, 1);
  }, []);

  const strandConfigs = useMemo(() => {
    return [
      { color1: theme.primary, color2: theme.secondary, alpha: 0.95, z: -0.2 },
      { color1: theme.secondary, color2: theme.accent, alpha: 0.85, z: -0.4 },
      { color1: theme.accent, color2: theme.primary, alpha: 0.75, z: 0.2 },
      { color1: theme.coreGlow, color2: theme.primary, alpha: 0.65, z: -0.6 },
      { color1: theme.primary, color2: theme.coreGlow, alpha: 0.8, z: 0.4 },
      { color1: theme.secondary, color2: theme.accent, alpha: 0.5, z: -0.8 },
    ];
  }, [theme]);

  useFrame((stateCtx) => {
    const time = stateCtx.clock.getElapsedTime();
    const audioData = audioEngineInstance.getAudioData(state, time);

    let speed = 1.0;
    if (state === 'listening') speed = 2.4;
    if (state === 'processing') speed = 3.6;
    if (state === 'speaking') speed = 2.8;

    materialRefs.current.forEach((mat, idx) => {
      if (mat) {
        mat.uniforms.uTime.value = time;
        mat.uniforms.uAudioVolume.value = audioData.smoothedVolume;
        mat.uniforms.uAudioBass.value = audioData.bass;
        mat.uniforms.uAudioTreble.value = audioData.treble;
        mat.uniforms.uAudioPitch.value = audioData.pitch;
        mat.uniforms.uSpeed.value = speed;

        const cfg = strandConfigs[idx % strandConfigs.length];
        mat.uniforms.uColor1.value.set(cfg.color1);
        mat.uniforms.uColor2.value.set(cfg.color2);
      }
    });
  });

  return (
    <group position={[0, 0, -0.2]}>
      {strandConfigs.map((cfg, idx) => (
        <mesh
          key={idx}
          ref={(el) => { meshRefs.current[idx] = el; }}
          geometry={geometry}
          position={[0, 0, cfg.z]}
        >
          <shaderMaterial
            ref={(el) => { materialRefs.current[idx] = el; }}
            vertexShader={WaveformVertexShader}
            fragmentShader={WaveformFragmentShader}
            uniforms={{
              uTime: { value: 0 },
              uAudioVolume: { value: 0 },
              uAudioBass: { value: 0 },
              uAudioTreble: { value: 0 },
              uAudioPitch: { value: 0.5 },
              uSpeed: { value: 1.0 },
              uStrandIndex: { value: idx },
              uColor1: { value: new THREE.Color(cfg.color1) },
              uColor2: { value: new THREE.Color(cfg.color2) },
              uAlpha: { value: cfg.alpha },
            }}
            transparent={true}
            side={THREE.DoubleSide}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
          />
        </mesh>
      ))}

      {/* Center glowing line */}
      <mesh position={[0, 0, -0.1]}>
        <planeGeometry args={[34, 0.02]} />
        <meshBasicMaterial
          color={theme.primary}
          transparent={true}
          opacity={0.4}
          blending={THREE.AdditiveBlending}
        />
      </mesh>
    </group>
  );
}
