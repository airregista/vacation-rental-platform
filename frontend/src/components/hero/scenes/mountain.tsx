"use client"

import * as React from "react"
import { useFrame } from "@react-three/fiber"
import type { Mesh } from "three"
import { getScenePalette, type ScenePalette } from "../scene-palette"
import type { SceneTier } from "../scene-types"
import { DioramaBase, Dust, FLOOR_TOP, Shrub, WarmWindow, type Vec3 } from "./shared"

const PATH_STONES: Vec3[] = [
  [0.34, FLOOR_TOP + 0.02, 0.4],
  [0.16, FLOOR_TOP + 0.02, 0.9],
  [0.02, FLOOR_TOP + 0.02, 1.4],
]

const SPRING_RING = Array.from({ length: 9 }, (_, index) => {
  const angle = (index / 9) * Math.PI * 2
  const radius = index % 2 === 0 ? 0.64 : 0.6
  return {
    position: [Math.cos(angle) * radius, 0.05, Math.sin(angle) * radius] as Vec3,
    scale: 0.09 + (index % 3) * 0.015,
  }
})

const BOULDERS: { position: Vec3; size: number }[] = [
  { position: [-2.05, FLOOR_TOP + 0.11, 1.95], size: 0.17 },
  { position: [1.9, FLOOR_TOP + 0.1, 1.7], size: 0.15 },
  { position: [2.15, FLOOR_TOP + 0.08, -0.85], size: 0.12 },
  { position: [-2.25, FLOOR_TOP + 0.07, 0.55], size: 0.1 },
]

function Peak({
  position,
  radius,
  height,
  segments,
  palette,
}: {
  position: Vec3
  radius: number
  height: number
  segments: number
  palette: ScenePalette
}) {
  const capHeight = height * 0.34
  // Sit slightly outside the rock cone so the two surfaces never z-fight.
  const capRadius = radius * (capHeight / height) * 1.03

  return (
    <group position={position}>
      <mesh position={[0, height / 2, 0]} castShadow receiveShadow>
        <coneGeometry args={[radius, height, segments]} />
        <meshStandardMaterial color={palette.stone} roughness={0.98} flatShading />
      </mesh>
      <mesh position={[0, height - capHeight / 2 + 0.004, 0]} castShadow>
        <coneGeometry args={[capRadius, capHeight, segments]} />
        <meshStandardMaterial color={palette.snow} roughness={0.92} flatShading />
      </mesh>
    </group>
  )
}

/** A three-summit massif reads as Sabalan rather than a lone witch hat. */
function Massif({ palette, segments }: { palette: ScenePalette; segments: number }) {
  return (
    <group position={[0.35, FLOOR_TOP, -1.88]} scale={[1, 1, 0.5]}>
      <Peak
        position={[-1.05, 0, 0.28]}
        radius={1.0}
        height={1.45}
        segments={segments}
        palette={palette}
      />
      <Peak
        position={[0.95, 0, 0.16]}
        radius={0.85}
        height={1.2}
        segments={segments}
        palette={palette}
      />
      <Peak position={[0, 0, 0]} radius={1.55} height={2.1} segments={segments} palette={palette} />
    </group>
  )
}

/** Sarein hot spring: a stone basin with slowly drifting steam. */
function HotSpring({ palette, quality }: { palette: ScenePalette; quality: SceneTier }) {
  const count = quality === "full" ? 5 : 3
  const puffs = React.useRef<Array<Mesh | null>>([])

  useFrame(({ clock }) => {
    const time = clock.getElapsedTime()
    puffs.current.forEach((puff, index) => {
      if (!puff || Array.isArray(puff.material)) return
      const phase = (time * 0.14 + index / count) % 1
      puff.position.y = 0.18 + phase * 1.05
      puff.position.x = 0.1 + phase * 0.22 + Math.sin(time * 0.5 + index * 1.6) * 0.1
      const scale = 0.65 + phase * 1.35
      puff.scale.setScalar(scale)
      puff.material.opacity = 0.55 * (1 - phase)
    })
  })

  return (
    <group position={[-1.35, FLOOR_TOP, 1.18]}>
      {SPRING_RING.map((stone, index) => (
        <mesh key={index} position={stone.position} castShadow>
          <dodecahedronGeometry args={[stone.scale, 0]} />
          <meshStandardMaterial color={palette.stone} roughness={0.98} flatShading />
        </mesh>
      ))}

      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.012, 0]} receiveShadow>
        <circleGeometry args={[0.54, 24]} />
        <meshStandardMaterial
          color={palette.tealDeep}
          emissive={palette.teal}
          emissiveIntensity={0.2}
          metalness={0.25}
          roughness={0.12}
        />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.016, 0]}>
        <circleGeometry args={[0.4, 24]} />
        <meshStandardMaterial color={palette.teal} transparent opacity={0.55} roughness={0.15} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
        <circleGeometry args={[0.14, 16]} />
        <meshStandardMaterial color={palette.cream} transparent opacity={0.35} roughness={0.3} />
      </mesh>

      {/* Expanding rings on the water surface */}
      {[0.26, 0.4].map((radius, index) => (
        <mesh
          key={radius}
          rotation={[-Math.PI / 2, 0, 0]}
          position={[0.02, 0.024 + index * 0.002, 0.02]}
        >
          <ringGeometry args={[radius, radius + 0.025, 24]} />
          <meshBasicMaterial
            color={palette.cream}
            transparent
            opacity={0.22 - index * 0.06}
            depthWrite={false}
          />
        </mesh>
      ))}

      {/* Wooden spout feeding the basin */}
      <group>
        <mesh position={[0.66, 0.24, 0.14]} castShadow>
          <cylinderGeometry args={[0.045, 0.055, 0.48, 6]} />
          <meshStandardMaterial color={palette.wood} roughness={0.96} flatShading />
        </mesh>
        <mesh position={[0.42, 0.4, 0.1]} rotation={[0, 0, 1.18]} castShadow>
          <cylinderGeometry args={[0.04, 0.05, 0.55, 6]} />
          <meshStandardMaterial color={palette.wood} roughness={0.96} flatShading />
        </mesh>
        <mesh position={[0.18, 0.3, 0.06]}>
          <cylinderGeometry args={[0.035, 0.035, 0.03, 8]} />
          <meshStandardMaterial color={palette.clayDeep} roughness={0.9} />
        </mesh>
        {/* Thin falling stream */}
        <mesh position={[0.17, 0.18, 0.06]}>
          <cylinderGeometry args={[0.012, 0.016, 0.24, 6]} />
          <meshStandardMaterial
            color={palette.cream}
            transparent
            opacity={0.55}
            roughness={0.2}
            depthWrite={false}
          />
        </mesh>
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0.17, 0.028, 0.06]}>
          <circleGeometry args={[0.09, 12]} />
          <meshBasicMaterial color={palette.cream} transparent opacity={0.3} depthWrite={false} />
        </mesh>
      </group>

      {Array.from({ length: count }, (_, index) => (
        <mesh
          key={index}
          ref={(element) => {
            puffs.current[index] = element
          }}
          position={[0, 0.2, 0]}
        >
          <sphereGeometry args={[0.2, 8, 8]} />
          <meshBasicMaterial color={palette.mist} transparent opacity={0.55} depthWrite={false} />
        </mesh>
      ))}

      <pointLight
        position={[0, 0.45, 0]}
        color={palette.teal}
        intensity={0.5}
        distance={2.2}
        decay={2}
      />
    </group>
  )
}

function ChimneySmoke({ palette, quality }: { palette: ScenePalette; quality: SceneTier }) {
  const count = quality === "full" ? 4 : 2
  const puffs = React.useRef<Array<Mesh | null>>([])

  useFrame(({ clock }) => {
    if (quality !== "full") return
    const time = clock.getElapsedTime()
    puffs.current.forEach((puff, index) => {
      if (!puff || Array.isArray(puff.material)) return
      const phase = (time * 0.1 + index / count) % 1
      puff.position.y = 0.12 + phase * 0.8
      puff.position.x = Math.sin(time * 0.4 + index * 2.2) * 0.09 + phase * 0.16
      puff.position.z = Math.cos(time * 0.32 + index * 1.7) * 0.06
      puff.scale.setScalar(0.65 + phase * 1.05)
      puff.material.opacity = 0.24 * (1 - phase)
    })
  })

  return (
    <group>
      {Array.from({ length: count }, (_, index) => (
        <mesh
          key={index}
          ref={(element) => {
            puffs.current[index] = element
          }}
          position={[0, 0.16 + index * 0.24, 0]}
          scale={0.7 + index * 0.18}
        >
          <sphereGeometry args={[0.1, 8, 8]} />
          <meshBasicMaterial color={palette.mist} transparent opacity={0.22} depthWrite={false} />
        </mesh>
      ))}
    </group>
  )
}

export function MountainScene({ quality }: { quality: SceneTier }) {
  const palette = React.useMemo(() => getScenePalette(), [])
  const segments = quality === "full" ? 8 : 6

  return (
    <group>
      <DioramaBase palette={palette} floorColor={palette.snow} />

      {/* Sabalan massif */}
      <Massif palette={palette} segments={segments} />

      {/* Cleared path through the snow */}
      <mesh position={[0.22, FLOOR_TOP + 0.004, 1.2]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[0.7, 2.2]} />
        <meshStandardMaterial color={palette.plasterShade} roughness={0.98} />
      </mesh>
      {PATH_STONES.map((position, index) => (
        <mesh key={index} position={position} rotation={[-Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.15, 0.17, 0.04, 10]} />
          <meshStandardMaterial color={palette.stone} roughness={0.98} />
        </mesh>
      ))}

      {/* Low stone refuge with a flat, snow-loaded roof */}
      <group position={[0.05, FLOOR_TOP, -0.55]}>
        <mesh position={[0, 0.45, 0]} castShadow receiveShadow>
          <boxGeometry args={[1.95, 0.9, 1.35]} />
          <meshStandardMaterial color={palette.stone} roughness={0.98} flatShading />
        </mesh>

        {/* Flat roof and its snow slab */}
        <mesh position={[0, 0.95, 0]} castShadow>
          <boxGeometry args={[2.16, 0.1, 1.56]} />
          <meshStandardMaterial color={palette.wood} roughness={0.95} flatShading />
        </mesh>
        <mesh position={[0, 1.06, 0]} castShadow>
          <boxGeometry args={[2.22, 0.12, 1.62]} />
          <meshStandardMaterial color={palette.snow} roughness={0.95} flatShading />
        </mesh>

        {/* Door, window and threshold */}
        <mesh position={[0.38, 0.35, 0.681]} castShadow>
          <boxGeometry args={[0.4, 0.7, 0.05]} />
          <meshStandardMaterial color={palette.clayDeep} roughness={0.95} />
        </mesh>
        <mesh position={[0.38, 0.04, 0.76]} receiveShadow>
          <boxGeometry args={[0.5, 0.08, 0.24]} />
          <meshStandardMaterial color={palette.stone} roughness={0.98} flatShading />
        </mesh>
        <WarmWindow position={[-0.45, 0.52, 0.681]} size={[0.34, 0.28]} palette={palette} />

        {/* Side window facing the woodpile */}
        <group position={[0.985, 0.5, -0.1]} rotation={[0, Math.PI / 2, 0]}>
          <WarmWindow position={[0, 0, 0]} size={[0.28, 0.24]} palette={palette} />
        </group>

        {/* Stone chimney with a slow plume of smoke */}
        <group position={[-0.58, 1.12, -0.18]}>
          <mesh position={[0, 0.26, 0]} castShadow>
            <boxGeometry args={[0.24, 0.52, 0.24]} />
            <meshStandardMaterial color={palette.stone} roughness={0.98} flatShading />
          </mesh>
          <mesh position={[0, 0.54, 0]} castShadow>
            <boxGeometry args={[0.3, 0.07, 0.3]} />
            <meshStandardMaterial color={palette.stone} roughness={0.98} flatShading />
          </mesh>
          <mesh position={[0, 0.578, 0]}>
            <boxGeometry args={[0.16, 0.015, 0.16]} />
            <meshStandardMaterial color={palette.ink} roughness={1} />
          </mesh>
          <group position={[0, 0.6, 0]}>
            <ChimneySmoke palette={palette} quality={quality} />
          </group>
        </group>
      </group>

      {/* Split firewood stacked against the wall */}
      <group position={[1.28, FLOOR_TOP, 0.3]}>
        {[
          [0, 0.055, 0.16],
          [0, 0.055, 0.28],
          [0, 0.055, 0.4],
          [0, 0.15, 0.22],
          [0, 0.15, 0.34],
        ].map(([x, y, z], index) => (
          <mesh key={index} position={[x, y, z]} rotation={[0, 0, Math.PI / 2]} castShadow>
            <cylinderGeometry args={[0.052, 0.052, 0.46, 7]} />
            <meshStandardMaterial color={palette.wood} roughness={0.96} flatShading />
          </mesh>
        ))}
        <mesh position={[0, 0.215, 0.28]} castShadow>
          <boxGeometry args={[0.44, 0.035, 0.26]} />
          <meshStandardMaterial color={palette.snow} roughness={0.98} />
        </mesh>
      </group>

      {/* Stone bench with a folded blanket, facing the spring */}
      <group position={[-0.38, FLOOR_TOP, 1.98]}>
        {[-0.24, 0.24].map((x) => (
          <mesh key={x} position={[x, 0.1, 0]} castShadow>
            <boxGeometry args={[0.1, 0.2, 0.24]} />
            <meshStandardMaterial color={palette.stone} roughness={0.98} flatShading />
          </mesh>
        ))}
        <mesh position={[0, 0.23, 0]} castShadow receiveShadow>
          <boxGeometry args={[0.66, 0.07, 0.3]} />
          <meshStandardMaterial color={palette.wood} roughness={0.95} flatShading />
        </mesh>
        <mesh position={[-0.18, 0.285, 0]} castShadow>
          <boxGeometry args={[0.22, 0.045, 0.26]} />
          <meshStandardMaterial color={palette.red} roughness={0.95} />
        </mesh>
      </group>

      {/* Snow drifts and hardy alpine shrubs */}
      {[
        { x: -2.05, z: 0.1, scale: [0.55, 0.12, 0.32] as Vec3 },
        { x: 2.0, z: 1.28, scale: [0.34, 0.08, 0.22] as Vec3 },
        { x: -2.12, z: 1.82, scale: [0.36, 0.08, 0.24] as Vec3 },
      ].map((drift, index) => (
        <mesh
          key={index}
          position={[drift.x, FLOOR_TOP + 0.03, drift.z]}
          scale={drift.scale}
          castShadow
          receiveShadow
        >
          <sphereGeometry args={[1, 12, 8]} />
          <meshStandardMaterial color={palette.snow} roughness={0.98} flatShading />
        </mesh>
      ))}
      <Shrub position={[1.62, FLOOR_TOP, 1.28]} scale={0.85} palette={palette} />
      <Shrub position={[-1.95, FLOOR_TOP, 0.02]} scale={0.65} palette={palette} />

      {/* Low dry-stone wall */}
      <mesh position={[2.25, FLOOR_TOP + 0.21, 0.25]} castShadow receiveShadow>
        <boxGeometry args={[0.18, 0.42, 1.9]} />
        <meshStandardMaterial color={palette.stone} roughness={0.98} flatShading />
      </mesh>
      <mesh position={[2.25, FLOOR_TOP + 0.45, 0.25]} castShadow>
        <boxGeometry args={[0.24, 0.07, 2]} />
        <meshStandardMaterial color={palette.snow} roughness={0.95} />
      </mesh>

      {/* Boulders */}
      {BOULDERS.map(({ position, size }, index) => (
        <mesh key={index} position={position} rotation={[0.2, index, 0.1]} castShadow>
          <dodecahedronGeometry args={[size, 0]} />
          <meshStandardMaterial color={palette.stone} roughness={0.98} flatShading />
        </mesh>
      ))}

      <HotSpring palette={palette} quality={quality} />

      {/* Cool mountain rim light */}
      <pointLight
        position={[-2.4, 3.1, 1.8]}
        color={palette.lightRim}
        intensity={0.8}
        distance={7}
        decay={2}
      />

      <Dust quality={quality} palette={palette} />
    </group>
  )
}
