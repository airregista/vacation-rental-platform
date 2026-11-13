"use client"

import * as React from "react"
import * as THREE from "three"
import { useFrame } from "@react-three/fiber"
import type { ScenePalette } from "../scene-palette"
import type { SceneTier } from "../scene-types"

export type Vec3 = [number, number, number]

export const FLOOR_TOP = 0.16

export function roundedRectShape(width: number, depth: number, radius: number) {
  const shape = new THREE.Shape()
  const x = -width / 2
  const y = -depth / 2
  shape.moveTo(x + radius, y)
  shape.lineTo(x + width - radius, y)
  shape.quadraticCurveTo(x + width, y, x + width, y + radius)
  shape.lineTo(x + width, y + depth - radius)
  shape.quadraticCurveTo(x + width, y + depth, x + width - radius, y + depth)
  shape.lineTo(x + radius, y + depth)
  shape.quadraticCurveTo(x, y + depth, x, y + depth - radius)
  shape.lineTo(x, y + radius)
  shape.quadraticCurveTo(x, y, x + radius, y)
  shape.closePath()
  return shape
}

/** Persian pointed arch: two curved haunches meeting at a soft apex. */
export function archShape(width: number, height: number, depth: number) {
  const half = width / 2
  const spring = height * 0.58
  const shape = new THREE.Shape()
  shape.moveTo(-half, 0)
  shape.lineTo(-half, spring)
  shape.quadraticCurveTo(-half, height, 0, height)
  shape.quadraticCurveTo(half, height, half, spring)
  shape.lineTo(half, 0)
  shape.closePath()
  return new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: false,
    curveSegments: 8,
  })
}

export function trianglePrism(width: number, height: number, depth: number) {
  const shape = new THREE.Shape()
  shape.moveTo(-width / 2, 0)
  shape.lineTo(width / 2, 0)
  shape.lineTo(0, height)
  shape.closePath()
  return new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: false,
    curveSegments: 4,
  })
}

export function useDisposableGeometry<T extends THREE.BufferGeometry>(geometry: T) {
  React.useEffect(() => () => geometry.dispose(), [geometry])
  return geometry
}

/** Shared museum plinth + floor so every climate reads as one collection. */
export function DioramaBase({
  palette,
  floorColor,
}: {
  palette: ScenePalette
  floorColor?: string
}) {
  const floorGeometry = useDisposableGeometry(
    React.useMemo(() => {
      const shape = roundedRectShape(5.1, 5.1, 0.55)
      return new THREE.ExtrudeGeometry(shape, {
        depth: FLOOR_TOP,
        bevelEnabled: false,
        curveSegments: 6,
      }).rotateX(-Math.PI / 2)
    }, []),
  )

  return (
    <group>
      {/* Soft grounding shadow under the floating plinth */}
      <mesh position={[0, -0.47, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[9, 9]} />
        <shadowMaterial transparent opacity={0.17} />
      </mesh>

      <mesh position={[0, -0.15, 0]} rotation={[0, Math.PI / 8, 0]} receiveShadow>
        <cylinderGeometry args={[3.18, 3.3, 0.3, 8]} />
        <meshStandardMaterial color={palette.sandDeep} roughness={0.95} flatShading />
      </mesh>
      <mesh position={[0, -0.38, 0]} rotation={[0, Math.PI / 8, 0]} receiveShadow>
        <cylinderGeometry args={[3.42, 3.5, 0.16, 8]} />
        <meshStandardMaterial color={palette.clayDeep} roughness={0.95} flatShading />
      </mesh>

      <mesh geometry={floorGeometry} receiveShadow>
        <meshStandardMaterial color={floorColor ?? palette.sand} roughness={0.96} />
      </mesh>
    </group>
  )
}

export function Cypress({
  position,
  scale = 1,
  segments,
  palette,
}: {
  position: Vec3
  scale?: number
  segments: number
  palette: ScenePalette
}) {
  return (
    <group position={position} scale={scale}>
      <mesh position={[0, 0.22, 0]} castShadow>
        <cylinderGeometry args={[0.055, 0.085, 0.44, 6]} />
        <meshStandardMaterial color={palette.wood} roughness={0.9} />
      </mesh>
      <mesh position={[0, 0.95, 0]} castShadow>
        <coneGeometry args={[0.4, 1.15, segments]} />
        <meshStandardMaterial color={palette.green} roughness={0.85} flatShading />
      </mesh>
      <mesh position={[0, 1.55, 0]} castShadow>
        <coneGeometry args={[0.29, 0.85, segments]} />
        <meshStandardMaterial color={palette.greenDeep} roughness={0.85} flatShading />
      </mesh>
      <mesh position={[0, 1.98, 0]} castShadow>
        <coneGeometry args={[0.19, 0.6, segments]} />
        <meshStandardMaterial color={palette.green} roughness={0.85} flatShading />
      </mesh>
    </group>
  )
}

export function Pine({
  position,
  scale = 1,
  segments,
  palette,
  snow = false,
}: {
  position: Vec3
  scale?: number
  segments: number
  palette: ScenePalette
  snow?: boolean
}) {
  const tiers = [
    { y: 1.0, r: 0.45, h: 1.2 },
    { y: 1.7, r: 0.36, h: 0.95 },
    { y: 2.28, r: 0.27, h: 0.72 },
  ]

  return (
    <group position={position} scale={scale}>
      <mesh position={[0, 0.55, 0]} castShadow>
        <cylinderGeometry args={[0.06, 0.09, 1.1, 6]} />
        <meshStandardMaterial color={palette.wood} roughness={0.9} />
      </mesh>
      {tiers.map((tier) => (
        <group key={tier.y}>
          <mesh position={[0, tier.y, 0]} castShadow>
            <coneGeometry args={[tier.r, tier.h, segments]} />
            <meshStandardMaterial color={palette.greenDeep} roughness={0.85} flatShading />
          </mesh>
          {snow ? (
            <mesh position={[0, tier.y + tier.h * 0.38, 0]} castShadow>
              <coneGeometry args={[tier.r * 0.55, tier.h * 0.38, segments]} />
              <meshStandardMaterial color={palette.snow} roughness={0.9} flatShading />
            </mesh>
          ) : null}
        </group>
      ))}
    </group>
  )
}

export function Palm({
  position,
  scale = 1,
  palette,
}: {
  position: Vec3
  scale?: number
  palette: ScenePalette
}) {
  const angles = [0, 45, 90, 135, 180, 225, 270, 315]

  return (
    <group position={position} scale={scale}>
      <mesh position={[0, 0.72, 0]} rotation={[0, 0, 0.05]} castShadow>
        <cylinderGeometry args={[0.05, 0.1, 1.45, 6]} />
        <meshStandardMaterial color={palette.wood} roughness={0.95} />
      </mesh>
      <group position={[0.04, 1.45, 0]}>
        {angles.map((angle) => (
          <group key={angle} rotation={[0, (angle * Math.PI) / 180, 0]}>
            <mesh position={[0.32, 0.02, 0]} rotation={[0, 0, -0.42]} castShadow>
              <boxGeometry args={[0.68, 0.025, 0.13]} />
              <meshStandardMaterial color={palette.green} roughness={0.85} flatShading />
            </mesh>
            <mesh position={[0.24, -0.04, 0]} rotation={[0, 0, -0.85]} castShadow>
              <boxGeometry args={[0.42, 0.02, 0.1]} />
              <meshStandardMaterial color={palette.greenDeep} roughness={0.85} flatShading />
            </mesh>
          </group>
        ))}
        {[
          [0.13, -0.02, 0.08],
          [-0.12, -0.03, 0.05],
          [0.02, -0.05, -0.13],
          [-0.05, 0.01, 0.13],
        ].map((point, index) => (
          <mesh key={index} position={point as Vec3}>
            <sphereGeometry args={[0.035, 8, 8]} />
            <meshStandardMaterial color={palette.gold} roughness={0.6} />
          </mesh>
        ))}
      </group>
    </group>
  )
}

export function Shrub({
  position,
  scale = 1,
  palette,
}: {
  position: Vec3
  scale?: number
  palette: ScenePalette
}) {
  return (
    <group position={position} scale={scale}>
      <mesh position={[0, 0.16, 0]} castShadow>
        <icosahedronGeometry args={[0.2, 0]} />
        <meshStandardMaterial color={palette.greenDeep} roughness={0.95} flatShading />
      </mesh>
      <mesh position={[0.15, 0.12, 0.08]} castShadow>
        <icosahedronGeometry args={[0.14, 0]} />
        <meshStandardMaterial color={palette.green} roughness={0.95} flatShading />
      </mesh>
    </group>
  )
}

export function Rope({
  from,
  to,
  color,
  radius = 0.009,
}: {
  from: Vec3
  to: Vec3
  color: string
  radius?: number
}) {
  const start = new THREE.Vector3(...from)
  const end = new THREE.Vector3(...to)
  const direction = end.clone().sub(start)
  const length = direction.length()
  const midpoint = start.clone().add(end).multiplyScalar(0.5)
  const quaternion = new THREE.Quaternion().setFromUnitVectors(
    new THREE.Vector3(0, 1, 0),
    direction.normalize(),
  )

  return (
    <mesh position={midpoint} quaternion={quaternion}>
      <cylinderGeometry args={[radius, radius, length, 5]} />
      <meshStandardMaterial color={color} roughness={0.95} />
    </mesh>
  )
}

export function WarmWindow({
  position,
  palette,
  size = [0.32, 0.3],
}: {
  position: Vec3
  palette: ScenePalette
  size?: [number, number]
}) {
  return (
    <group position={position}>
      <mesh>
        <boxGeometry args={[size[0] + 0.08, size[1] + 0.08, 0.04]} />
        <meshStandardMaterial color={palette.wood} roughness={0.9} />
      </mesh>
      <mesh position={[0, 0, 0.025]}>
        <boxGeometry args={[size[0], size[1], 0.02]} />
        <meshStandardMaterial
          color={palette.glow}
          emissive={palette.ember}
          emissiveIntensity={1.7}
          roughness={0.5}
        />
      </mesh>
      <pointLight
        position={[0, 0, 0.22]}
        color={palette.ember}
        intensity={1.5}
        distance={2.4}
        decay={2}
      />
    </group>
  )
}

export function Dust({ quality, palette }: { quality: SceneTier; palette: ScenePalette }) {
  const count = quality === "full" ? 42 : 20
  const positions = React.useMemo(() => {
    // Deterministic scatter — keeps the component pure between renders.
    const rand = (seed: number) => {
      const value = Math.sin(seed) * 43758.5453
      return value - Math.floor(value)
    }
    const values = new Float32Array(count * 3)
    for (let i = 0; i < count; i += 1) {
      const offset = i * 3
      values[offset] = (rand(offset + 1) - 0.5) * 4.6
      values[offset + 1] = 0.35 + rand(offset + 2) * 2.2
      values[offset + 2] = (rand(offset + 3) - 0.5) * 4.2
    }
    return values
  }, [count])

  const ref = React.useRef<THREE.Points>(null)
  useFrame((state) => {
    if (!ref.current) return
    ref.current.rotation.y = state.clock.elapsedTime * 0.035
  })

  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial
        color={palette.cream}
        size={0.035}
        sizeAttenuation
        transparent
        opacity={0.55}
        depthWrite={false}
      />
    </points>
  )
}
