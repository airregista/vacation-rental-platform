"use client"

import * as React from "react"
import { useFrame } from "@react-three/fiber"
import type { Mesh } from "three"
import { getScenePalette, type ScenePalette } from "../scene-palette"
import type { SceneTier } from "../scene-types"
import {
  DioramaBase,
  Dust,
  FLOOR_TOP,
  Rope,
  Shrub,
  trianglePrism,
  useDisposableGeometry,
  type Vec3,
} from "./shared"

function Oak({ position, palette }: { position: Vec3; palette: ScenePalette }) {
  return (
    <group position={position}>
      <mesh position={[0, 0.55, 0]} castShadow>
        <cylinderGeometry args={[0.1, 0.16, 1.1, 7]} />
        <meshStandardMaterial color={palette.wood} roughness={0.98} flatShading />
      </mesh>
      <mesh position={[0.25, 1.25, 0.05]} rotation={[0, 0, -0.45]} castShadow>
        <cylinderGeometry args={[0.05, 0.08, 0.7, 6]} />
        <meshStandardMaterial color={palette.wood} roughness={0.98} />
      </mesh>
      <mesh position={[0.02, 1.55, 0]} castShadow>
        <icosahedronGeometry args={[0.52, 1]} />
        <meshStandardMaterial color={palette.green} roughness={0.95} flatShading />
      </mesh>
      <mesh position={[-0.4, 1.4, 0.12]} castShadow>
        <icosahedronGeometry args={[0.34, 1]} />
        <meshStandardMaterial color={palette.green} roughness={0.95} flatShading />
      </mesh>
      <mesh position={[0.48, 1.38, -0.1]} castShadow>
        <icosahedronGeometry args={[0.3, 1]} />
        <meshStandardMaterial color={palette.greenDeep} roughness={0.95} flatShading />
      </mesh>
    </group>
  )
}

function Sheep({ position, palette }: { position: Vec3; palette: ScenePalette }) {
  return (
    <group position={position} scale={0.9}>
      <mesh position={[0, 0.26, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
        <capsuleGeometry args={[0.13, 0.2, 4, 8]} />
        <meshStandardMaterial color={palette.cream} roughness={1} />
      </mesh>
      <mesh position={[0.21, 0.33, 0]} castShadow>
        <sphereGeometry args={[0.08, 8, 8]} />
        <meshStandardMaterial color={palette.tent} roughness={0.95} />
      </mesh>
      {[
        [-0.1, 0.09],
        [0.1, 0.09],
      ].map(([x, z]) => (
        <mesh key={`${x}${z}`} position={[x, 0.1, z >= 0 ? 0.06 : -0.06]}>
          <boxGeometry args={[0.035, 0.2, 0.035]} />
          <meshStandardMaterial color={palette.tent} roughness={0.95} />
        </mesh>
      ))}
    </group>
  )
}

function Smoke({ palette, quality }: { palette: ScenePalette; quality: SceneTier }) {
  const count = quality === "full" ? 4 : 2
  const puffs = React.useRef<Array<Mesh | null>>([])

  useFrame(({ clock }) => {
    const time = clock.getElapsedTime()
    puffs.current.forEach((puff, index) => {
      if (!puff || Array.isArray(puff.material)) return
      const phase = (time * 0.11 + index / count) % 1
      puff.position.y = 0.62 + phase * 0.7
      puff.position.x = Math.sin(time * 0.45 + index * 2.1) * 0.09 + phase * 0.08
      puff.scale.setScalar(0.75 + phase * 1.15)
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
          position={[0, 0.68, 0]}
        >
          <sphereGeometry args={[0.09, 8, 8]} />
          <meshBasicMaterial color={palette.mist} transparent opacity={0.2} depthWrite={false} />
        </mesh>
      ))}
    </group>
  )
}

export function ZagrosScene({ quality }: { quality: SceneTier }) {
  const palette = React.useMemo(() => getScenePalette(), [])

  const tentRoofGeometry = useDisposableGeometry(
    React.useMemo(() => trianglePrism(3.05, 0.72, 1.95), []),
  )

  return (
    <group>
      <DioramaBase palette={palette} floorColor={palette.sandDeep} />

      {/* Rocky ridge behind the camp */}
      {[
        [-1.9, -2.25, 0.5],
        [-1.1, -2.4, 0.35],
        [0.15, -2.35, 0.45],
        [1.35, -2.25, 0.55],
        [2.1, -2.4, 0.32],
      ].map(([x, z, size], index) => (
        <mesh
          key={index}
          position={[x, FLOOR_TOP + size * 0.6, z]}
          rotation={[0.2, index * 0.6, 0.1]}
          castShadow
        >
          <dodecahedronGeometry args={[size, 0]} />
          <meshStandardMaterial color={palette.stone} roughness={0.98} flatShading />
        </mesh>
      ))}

      {/* Black tent */}
      <mesh position={[0, FLOOR_TOP + 0.3, -0.95]} castShadow receiveShadow>
        <boxGeometry args={[3.0, 0.6, 1.9]} />
        <meshStandardMaterial color={palette.tent} roughness={1} flatShading />
      </mesh>
      <mesh
        geometry={tentRoofGeometry}
        position={[0, FLOOR_TOP + 0.6, -1.9]}
        castShadow
        receiveShadow
      >
        <meshStandardMaterial color={palette.tent} roughness={1} flatShading />
      </mesh>
      {/* Woven bands above the doorway */}
      <mesh position={[0, FLOOR_TOP + 0.65, 0.06]}>
        <boxGeometry args={[2.9, 0.06, 0.02]} />
        <meshStandardMaterial color={palette.cream} roughness={0.95} />
      </mesh>
      <mesh position={[0, FLOOR_TOP + 0.6, 0.06]}>
        <boxGeometry args={[2.75, 0.025, 0.02]} />
        <meshStandardMaterial color={palette.red} roughness={0.95} />
      </mesh>

      {/* Tent opening with warm interior, kept inside the wall */}
      <mesh position={[0, FLOOR_TOP + 0.29, 0.014]}>
        <planeGeometry args={[1.12, 0.42]} />
        <meshStandardMaterial color={palette.ink} roughness={1} />
      </mesh>
      <mesh position={[0, FLOOR_TOP + 0.26, 0.02]}>
        <planeGeometry args={[0.66, 0.32]} />
        <meshStandardMaterial
          color={palette.glow}
          emissive={palette.ember}
          emissiveIntensity={1.5}
          roughness={0.8}
        />
      </mesh>

      {/* Wooden door frame and threshold */}
      {[-0.6, 0.6].map((x) => (
        <mesh key={x} position={[x, FLOOR_TOP + 0.3, 0.035]} castShadow>
          <boxGeometry args={[0.06, 0.5, 0.05]} />
          <meshStandardMaterial color={palette.wood} roughness={0.95} />
        </mesh>
      ))}
      <mesh position={[0, FLOOR_TOP + 0.54, 0.035]} castShadow>
        <boxGeometry args={[1.26, 0.06, 0.05]} />
        <meshStandardMaterial color={palette.wood} roughness={0.95} />
      </mesh>
      <mesh position={[0, FLOOR_TOP + 0.035, 0.08]}>
        <boxGeometry args={[1.3, 0.07, 0.16]} />
        <meshStandardMaterial color={palette.cream} roughness={0.95} />
      </mesh>
      <pointLight
        position={[0, FLOOR_TOP + 0.45, 0.4]}
        color={palette.ember}
        intensity={1.6}
        distance={2.8}
        decay={2}
      />
      {/* Tent poles and guy ropes anchored beside the doorway */}
      {[-1.0, 1.0].map((x) => (
        <mesh key={x} position={[x, FLOOR_TOP + 0.42, 0.06]} castShadow>
          <cylinderGeometry args={[0.03, 0.04, 0.86, 5]} />
          <meshStandardMaterial color={palette.wood} roughness={0.95} />
        </mesh>
      ))}
      <Rope from={[-1.0, FLOOR_TOP + 0.85, 0.06]} to={[-2.1, FLOOR_TOP, 1.1]} color={palette.ink} />
      <Rope from={[1.0, FLOOR_TOP + 0.85, 0.06]} to={[2.1, FLOOR_TOP, 1.3]} color={palette.ink} />

      {/* Kilim and cushions at the tent mouth */}
      <group position={[-0.95, FLOOR_TOP, 0.62]}>
        <mesh position={[0, 0.012, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[1.0, 0.7]} />
          <meshStandardMaterial color={palette.clayDeep} roughness={0.98} />
        </mesh>
        <mesh position={[0, 0.017, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[0.86, 0.56]} />
          <meshStandardMaterial color={palette.red} roughness={0.98} />
        </mesh>
        <mesh position={[0, 0.021, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[0.62, 0.34]} />
          <meshStandardMaterial color={palette.cream} roughness={0.98} />
        </mesh>
        {[-0.22, 0, 0.22].map((x) => (
          <mesh key={x} position={[x, 0.025, 0]} rotation={[0, Math.PI / 4, 0]}>
            <boxGeometry args={[0.1, 0.006, 0.1]} />
            <meshStandardMaterial color={palette.red} roughness={0.98} />
          </mesh>
        ))}
        {[-0.36, 0.36].flatMap((z) =>
          Array.from({ length: 7 }, (_, index) => (
            <mesh key={`${z}-${index}`} position={[-0.42 + index * 0.14, 0.014, z]}>
              <boxGeometry args={[0.03, 0.01, 0.07]} />
              <meshStandardMaterial color={palette.cream} roughness={0.97} />
            </mesh>
          )),
        )}
      </group>
      {[
        { x: -1.35, z: 0.92, color: palette.cream },
        { x: -0.56, z: 0.9, color: palette.teal },
      ].map((cushion) => (
        <group key={cushion.x} position={[cushion.x, FLOOR_TOP, cushion.z]}>
          <mesh position={[0, 0.09, 0]} castShadow>
            <boxGeometry args={[0.38, 0.14, 0.38]} />
            <meshStandardMaterial color={cushion.color} roughness={0.95} />
          </mesh>
          <mesh position={[0, 0.2, 0.16]} rotation={[-0.2, 0, 0]} castShadow>
            <boxGeometry args={[0.36, 0.24, 0.09]} />
            <meshStandardMaterial color={cushion.color} roughness={0.95} />
          </mesh>
        </group>
      ))}

      {/* Fire pit */}
      <group position={[1.25, FLOOR_TOP, 1.05]}>
        {Array.from({ length: 9 }, (_, index) => {
          const angle = (index / 9) * Math.PI * 2
          return (
            <mesh
              key={index}
              position={[Math.cos(angle) * 0.38, 0.06, Math.sin(angle) * 0.38]}
              rotation={[0.3, angle, 0.2]}
              castShadow
            >
              <dodecahedronGeometry args={[0.09, 0]} />
              <meshStandardMaterial color={palette.stone} roughness={0.98} flatShading />
            </mesh>
          )
        })}
        <mesh position={[0, 0.08, 0]} rotation={[0, 0.4, Math.PI / 2]} castShadow>
          <cylinderGeometry args={[0.055, 0.055, 0.55, 6]} />
          <meshStandardMaterial color={palette.wood} roughness={0.98} />
        </mesh>
        <mesh position={[0, 0.08, 0]} rotation={[0, -0.7, Math.PI / 2]}>
          <cylinderGeometry args={[0.045, 0.045, 0.5, 6]} />
          <meshStandardMaterial color={palette.wood} roughness={0.98} />
        </mesh>
        <mesh position={[0, 0.26, 0]} castShadow>
          <coneGeometry args={[0.16, 0.5, 6]} />
          <meshStandardMaterial
            color={palette.ember}
            emissive={palette.ember}
            emissiveIntensity={1.1}
            roughness={0.5}
          />
        </mesh>
        <mesh position={[0, 0.2, 0]}>
          <coneGeometry args={[0.09, 0.3, 5]} />
          <meshStandardMaterial
            color={palette.glow}
            emissive={palette.gold}
            emissiveIntensity={1.6}
            roughness={0.4}
          />
        </mesh>
        <mesh position={[0.08, 0.18, 0.03]} rotation={[0, 0, -0.12]}>
          <coneGeometry args={[0.06, 0.26, 5]} />
          <meshStandardMaterial
            color={palette.gold}
            emissive={palette.ember}
            emissiveIntensity={1.2}
            roughness={0.45}
          />
        </mesh>

        {/* Tripod and soot-black tea kettle */}
        {[0, (Math.PI * 2) / 3, (Math.PI * 4) / 3].map((angle) => (
          <Rope
            key={angle}
            from={[Math.cos(angle) * 0.34, 0.05, Math.sin(angle) * 0.34]}
            to={[0, 0.82, 0]}
            color={palette.wood}
            radius={0.011}
          />
        ))}
        <mesh position={[0, 0.63, 0]} castShadow>
          <sphereGeometry args={[0.09, 12, 10]} />
          <meshStandardMaterial color={palette.ink} metalness={0.45} roughness={0.38} />
        </mesh>
        <mesh position={[0.1, 0.66, 0]} rotation={[0, 0, -1.05]}>
          <cylinderGeometry args={[0.016, 0.026, 0.14, 7]} />
          <meshStandardMaterial color={palette.ink} metalness={0.45} roughness={0.4} />
        </mesh>
        <mesh position={[0, 0.72, 0]} rotation={[0, 0, 0]}>
          <torusGeometry args={[0.055, 0.011, 6, 12, Math.PI]} />
          <meshStandardMaterial color={palette.ink} metalness={0.45} roughness={0.4} />
        </mesh>
        <mesh position={[0, 0.73, 0]}>
          <sphereGeometry args={[0.022, 8, 8]} />
          <meshStandardMaterial color={palette.gold} metalness={0.5} roughness={0.35} />
        </mesh>

        <Smoke palette={palette} quality={quality} />

        <pointLight
          position={[0, 0.5, 0]}
          color={palette.ember}
          intensity={2.4}
          distance={4}
          decay={2}
        />
      </group>

      <Oak position={[-1.95, FLOOR_TOP, -0.55]} palette={palette} />

      <Shrub position={[1.85, FLOOR_TOP, 0.2]} palette={palette} />
      <Shrub position={[-1.55, FLOOR_TOP, 1.7]} scale={0.75} palette={palette} />
      <Shrub position={[2.15, FLOOR_TOP, 1.35]} scale={0.6} palette={palette} />

      <Sheep position={[1.7, FLOOR_TOP, 0.45]} palette={palette} />
      <Sheep position={[2.05, FLOOR_TOP, 0.95]} palette={palette} />

      <Dust quality={quality} palette={palette} />
    </group>
  )
}
