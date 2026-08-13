import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { AssistantState, ColorTheme } from '../types';
import { audioEngineInstance } from '../lib/audioEngine';

interface AIOrbProps {
  state: AssistantState;
  theme: ColorTheme;
}

// GLSL Shader for realistic vibrating liquid water drop (Static position, no rotation spinning)
const WaterDropShader = {
  vertexShader: `
    uniform float uTime;
    uniform float uAudioVolume;
    uniform float uVibrationSpeed;
    uniform float uVibrationIntensity;
    
    varying vec3 vNormal;
    varying vec3 vPosition;
    varying float vRipple;

    void main() {
      vNormal = normalize(normalMatrix * normal);
      vPosition = position;

      // Teardrop shape morphing (slightly tapered top, rounded fluid bottom)
      vec3 pos = position;
      float dropShape = 1.0 - (pos.y * 0.12);
      pos.xz *= dropShape;

      // Fluid liquid surface ripples and water-drop vibrations
      float r1 = sin(pos.x * 5.0 + pos.y * 7.0 + uTime * uVibrationSpeed * 4.0);
      float r2 = cos(pos.y * 8.0 - pos.z * 6.0 + uTime * uVibrationSpeed * 3.2);
      float r3 = sin(pos.z * 10.0 + pos.x * 8.0 + uTime * uVibrationSpeed * 5.0);

      float combinedRipple = (r1 * 0.45 + r2 * 0.35 + r3 * 0.2);
      float displacement = combinedRipple * (0.05 + uAudioVolume * 0.38 + uVibrationIntensity * 0.15);
      vRipple = displacement;

      vec3 finalPosition = pos + normal * displacement;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(finalPosition, 1.0);
    }
  `,
  fragmentShader: `
    uniform float uTime;
    uniform float uAudioVolume;
    uniform vec3 uColorPrimary;
    uniform vec3 uColorSecondary;
    uniform vec3 uColorAccent;

    varying vec3 vNormal;
    varying vec3 vPosition;
    varying float vRipple;

    void main() {
      vec3 viewDir = normalize(cameraPosition - vPosition);
      float fresnel = pow(1.0 - max(0.0, dot(vNormal, viewDir)), 2.5);

      // Water droplet caustics color gradient
      vec3 liquidBase = mix(uColorSecondary, uColorPrimary, vRipple * 4.0 + 0.5);
      vec3 liquidHighlight = mix(liquidBase, uColorAccent, fresnel * 0.9);

      // Specular liquid reflection
      vec3 lightDir = normalize(vec3(1.0, 1.5, 2.0));
      vec3 reflectDir = reflect(-lightDir, vNormal);
      float specular = pow(max(0.0, dot(viewDir, reflectDir)), 32.0);

      vec3 finalColor = liquidHighlight + uColorPrimary * fresnel * (1.2 + uAudioVolume * 1.5);
      finalColor += vec3(1.0) * specular * 0.6; // High gloss water sheen

      float alpha = clamp(0.82 + fresnel * 0.18, 0.0, 1.0);
      gl_FragColor = vec4(finalColor, alpha);
    }
  `,
};

export function AIOrb({ state, theme }: AIOrbProps) {
  const mainGroupRef = useRef<THREE.Group>(null);
  const waterDropRef = useRef<THREE.Mesh>(null);
  const waterDropMatRef = useRef<THREE.ShaderMaterial>(null);

  // Smooth lerp values for scale & vibration intensity
  const speedLerpRef = useRef(1.0);
  const intensityLerpRef = useRef(0.5);
  const scaleLerpRef = useRef(1.0);

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uAudioVolume: { value: 0 },
      uVibrationSpeed: { value: 1.0 },
      uVibrationIntensity: { value: 0.5 },
      uColorPrimary: { value: new THREE.Color(theme.primary) },
      uColorSecondary: { value: new THREE.Color(theme.secondary) },
      uColorAccent: { value: new THREE.Color(theme.accent) },
    }),
    [theme]
  );

  // Swirling liquid rings positioned at static organic angles without continuous rotation
  const ringConfigs = useMemo(
    () => [
      { radius: 1.48, tube: 0.032, rx: Math.PI * 0.35, ry: 0, rz: Math.PI * 0.15, color: theme.primary, opacity: 0.9 },
      { radius: 1.66, tube: 0.026, rx: -Math.PI * 0.28, ry: Math.PI * 0.2, rz: -Math.PI * 0.1, color: theme.secondary, opacity: 0.8 },
      { radius: 1.84, tube: 0.02, rx: Math.PI * 0.55, ry: -Math.PI * 0.15, rz: Math.PI * 0.25, color: theme.accent, opacity: 0.7 },
    ],
    [theme]
  );

  useFrame((stateCtx) => {
    const time = stateCtx.clock.getElapsedTime();
    const audioData = audioEngineInstance.getAudioData(state, time);

    let targetSpeed = 1.0;
    let targetIntensity = 0.5;
    let targetScale = 1.0 + audioData.smoothedVolume * 0.35;

    if (state === 'listening') {
      targetSpeed = 2.4;
      targetIntensity = 1.2;
      targetScale += 0.1;
    } else if (state === 'processing') {
      targetSpeed = 4.0;
      targetIntensity = 1.8;
      targetScale += 0.06;
    } else if (state === 'speaking') {
      targetSpeed = 2.8;
      targetIntensity = 1.3;
      targetScale += Math.sin(time * 8) * 0.06;
    }

    // Smooth lerps for vibration and scale (NO ROTATION)
    speedLerpRef.current += (targetSpeed - speedLerpRef.current) * 0.05;
    intensityLerpRef.current += (targetIntensity - intensityLerpRef.current) * 0.05;
    scaleLerpRef.current += (targetScale - scaleLerpRef.current) * 0.08;

    const smoothSpeed = speedLerpRef.current;
    const smoothIntensity = intensityLerpRef.current;
    const smoothScale = scaleLerpRef.current;

    if (waterDropMatRef.current) {
      waterDropMatRef.current.uniforms.uTime.value = time;
      waterDropMatRef.current.uniforms.uAudioVolume.value = audioData.smoothedVolume;
      waterDropMatRef.current.uniforms.uVibrationSpeed.value = smoothSpeed;
      waterDropMatRef.current.uniforms.uVibrationIntensity.value = smoothIntensity;
      waterDropMatRef.current.uniforms.uColorPrimary.value.set(theme.primary);
      waterDropMatRef.current.uniforms.uColorSecondary.value.set(theme.secondary);
      waterDropMatRef.current.uniforms.uColorAccent.value.set(theme.accent);
    }

    // Scale breathing (steady orientation, no rotation)
    if (mainGroupRef.current) {
      mainGroupRef.current.scale.set(smoothScale, smoothScale, smoothScale);
    }
  });

  return (
    <group ref={mainGroupRef} position={[0, 0, 0]}>
      {/* 1. Vibrating Liquid Water Drop Mesh */}
      <mesh ref={waterDropRef}>
        <sphereGeometry args={[1.3, 96, 96]} />
        <shaderMaterial
          ref={waterDropMatRef}
          vertexShader={WaterDropShader.vertexShader}
          fragmentShader={WaterDropShader.fragmentShader}
          uniforms={uniforms}
          transparent={true}
        />
      </mesh>

      {/* 2. Soft Liquid Atmosphere Halo */}
      <mesh>
        <sphereGeometry args={[1.42, 32, 32]} />
        <meshBasicMaterial
          color={theme.primary}
          transparent={true}
          opacity={0.25}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>

      {/* 3. Static Liquid Silk Energy Rings at Organic Angles */}
      <group>
        {ringConfigs.map((cfg, idx) => (
          <mesh key={idx} rotation={[cfg.rx, cfg.ry, cfg.rz]}>
            <torusGeometry args={[cfg.radius, cfg.tube, 32, 128]} />
            <meshStandardMaterial
              color={cfg.color}
              emissive={cfg.color}
              emissiveIntensity={state === 'listening' ? 1.8 : 1.0}
              roughness={0.1}
              metalness={0.1}
              transparent={true}
              opacity={cfg.opacity}
              blending={THREE.AdditiveBlending}
              depthWrite={false}
            />
          </mesh>
        ))}
      </group>

      {/* Dynamic Specular Point Lights */}
      <pointLight color={theme.primary} intensity={5.0} distance={10} />
      <pointLight color={theme.accent} intensity={3.0} distance={8} position={[1, 1.5, 2]} />
    </group>
  );
}
