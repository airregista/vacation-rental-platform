"use client"

import * as React from "react"
import { getScenePalette } from "../scene-palette"
import type { SceneTier } from "../scene-types"
import {
  DioramaBase,
  Dust,
  FLOOR_TOP,
  Pine,
  Shrub,
  trianglePrism,
  useDisposableGeometry,
  WarmWindow,
  type Vec3,
} from "./shared"

const PINES: { position: Vec3; scale: number }[] = [
  { position: [-2.05, FLOOR_TOP, -1.5], scale: 1.05 },
  { position: [1.95, FLOOR_TOP, -1.55], scale: 0.95 },
  { position: [2.2, FLOOR_TOP, 0.55], scale: 0.8 },
  { position: [-2.25, FLOOR_TOP, 0.8], scale: 0.72 },
]

const STONES: Vec3[] = [
  [-1.55, FLOOR_TOP + 0.06, 0.25],
  [-1.92, FLOOR_TOP + 0.05, 1.55],
  [-1.28, FLOOR_TOP + 0.04, 2.15],
  [-2.05, FLOOR_TOP + 0.03, 2.3],
  [1.45, FLOOR_TOP + 0.05, 1.95],
]

export function ForestScene({ quality }: { quality: SceneTier }) {
  const palette = React.useMemo(() => getScenePalette(), [])
  const segments = quality === "full" ? 9 : 6

  const gableGeometry = useDisposableGeometry(
    React.useMemo(() => trianglePrism(2.1, 0.62, 1.55), []),
  )

  return (
    <group>
      <DioramaBase palette={palette} floorColor={palette.greenDeep} />

      {/* Mossy patches and a sandy approach */}
      {[
        [-0.9, 1.35, 0.52],
        [1.55, 1.7, 0.38],
        [-2.05, -0.3, 0.34],
      ].map(([x, z, radius], index) => (
        <mesh
          key={index}
          position={[x, FLOOR_TOP + 0.006, z]}
          rotation={[-Math.PI / 2, 0, 0]}
          receiveShadow
        >
          <circleGeometry args={[radius, 14]} />
          <meshStandardMaterial color={palette.green} roughness={0.95} transparent opacity={0.45} />
        </mesh>
      ))}
      <mesh position={[0.1, FLOOR_TOP + 0.004, 1.35]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[0.9, 2.1]} />
        <meshStandardMaterial color={palette.sandDeep} roughness={0.98} />
      </mesh>

      {/* Cabin */}
      <group position={[0, FLOOR_TOP, -1.0]}>
        <mesh position={[0, 0.58, 0]} castShadow receiveShadow>
          <boxGeometry args={[2.2, 1.16, 1.55]} />
          <meshStandardMaterial color={palette.wood} roughness={0.9} />
        </mesh>

        {/* Log bands */}
        {[-0.34, 0.02, 0.38].map((y) => (
          <mesh key={y} position={[0, 0.58 + y, 0.79]}>
            <boxGeometry args={[2.22, 0.05, 0.03]} />
            <meshStandardMaterial color={palette.cream} roughness={0.95} />
          </mesh>
        ))}

        {/* Gable + roof */}
        <mesh geometry={gableGeometry} position={[0, 1.16, -0.775]} castShadow>
          <meshStandardMaterial color={palette.plasterShade} roughness={0.95} />
        </mesh>
        <mesh position={[-0.5, 1.43, 0]} rotation={[0, 0, 0.56]} castShadow>
          <boxGeometry args={[1.35, 0.09, 1.85]} />
          <meshStandardMaterial color={palette.clayDeep} roughness={0.9} flatShading />
        </mesh>
        <mesh position={[0.5, 1.43, 0]} rotation={[0, 0, -0.56]} castShadow>
          <boxGeometry args={[1.35, 0.09, 1.85]} />
          <meshStandardMaterial color={palette.clayDeep} roughness={0.9} flatShading />
        </mesh>
        <mesh position={[0, 1.79, 0]} castShadow>
          <boxGeometry args={[0.12, 0.09, 1.9]} />
          <meshStandardMaterial color={palette.wood} roughness={0.9} />
        </mesh>

        {/* Door and warm window */}
        <mesh position={[0.38, 0.68, 0.79]} castShadow>
          <boxGeometry args={[0.38, 0.64, 0.04]} />
          <meshStandardMaterial color={palette.clayDeep} roughness={0.9} />
        </mesh>
        <mesh position={[0.38, 0.78, 0.815]}>
          <sphereGeometry args={[0.02, 8, 8]} />
          <meshStandardMaterial color={palette.gold} roughness={0.5} />
        </mesh>
        <WarmWindow position={[-0.55, 0.76, 0.79]} size={[0.34, 0.3]} palette={palette} />

        {/* Stone chimney */}
        <mesh position={[0.86, 1.7, -0.35]} castShadow>
          <boxGeometry args={[0.24, 0.9, 0.24]} />
          <meshStandardMaterial color={palette.stone} roughness={0.95} flatShading />
        </mesh>
        {[
          { y: 2.24, size: 0.1, opacity: 0.28 },
          { y: 2.46, size: 0.14, opacity: 0.2 },
          { y: 2.7, size: 0.18, opacity: 0.12 },
        ].map((puff) => (
          <mesh key={puff.y} position={[0.86, puff.y, -0.35]}>
            <sphereGeometry args={[puff.size, 8, 8]} />
            <meshStandardMaterial
              color={palette.mist}
              transparent
              opacity={puff.opacity}
              roughness={1}
              depthWrite={false}
            />
          </mesh>
        ))}

        {/* Deck and railing */}
        <mesh position={[0, 0.05, 1.08]} castShadow receiveShadow>
          <boxGeometry args={[2.5, 0.1, 0.68]} />
          <meshStandardMaterial color={palette.wood} roughness={0.9} />
        </mesh>
        {[-1.16, 1.16].map((x) => (
          <group key={x} position={[x, 0.34, 1.36]}>
            <mesh castShadow>
              <boxGeometry args={[0.07, 0.58, 0.07]} />
              <meshStandardMaterial color={palette.wood} roughness={0.9} />
            </mesh>
            <mesh position={[0, 0.29, 0]}>
              <boxGeometry args={[0.07, 0.06, 0.4]} />
              <meshStandardMaterial color={palette.wood} roughness={0.9} />
            </mesh>
          </group>
        ))}
        <mesh position={[0, 0.6, 1.36]} castShadow>
          <boxGeometry args={[2.32, 0.06, 0.06]} />
          <meshStandardMaterial color={palette.wood} roughness={0.9} />
        </mesh>
      </group>

      {/* Stream and stepping stones */}
      <mesh position={[-1.7, FLOOR_TOP + 0.015, 1.25]} rotation={[-Math.PI / 2, 0, 0.22]}>
        <planeGeometry args={[0.52, 2.3]} />
        <meshStandardMaterial
          color={palette.teal}
          roughness={0.12}
          metalness={0.3}
          emissive={palette.tealDeep}
          emissiveIntensity={0.2}
        />
      </mesh>
      {STONES.map((position, index) => (
        <mesh key={index} position={position} rotation={[0.2, index, 0.1]} castShadow>
          <icosahedronGeometry args={[0.11 + (index % 2) * 0.04, 0]} />
          <meshStandardMaterial color={palette.stone} roughness={0.95} flatShading />
        </mesh>
      ))}
      {[
        [0.32, 1.7],
        [0.08, 2.06],
        [-0.2, 2.34],
      ].map(([x, z], index) => (
        <mesh key={index} position={[x, FLOOR_TOP + 0.02, z]} rotation={[-Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.16, 0.18, 0.04, 10]} />
          <meshStandardMaterial color={palette.sandDeep} roughness={0.98} />
        </mesh>
      ))}

      {/* Footbridge over the stream */}
      <group position={[-1.7, FLOOR_TOP + 0.12, 1.25]} rotation={[0, 0.22, 0]}>
        {[-0.2, -0.1, 0, 0.1, 0.2].map((z) => (
          <mesh key={z} position={[0, 0, z]} castShadow receiveShadow>
            <boxGeometry args={[1.0, 0.04, 0.09]} />
            <meshStandardMaterial color={palette.wood} roughness={0.92} />
          </mesh>
        ))}
        {[-0.24, 0.24].map((z) => (
          <mesh key={z} position={[0, 0.2, z]} castShadow>
            <boxGeometry args={[1.05, 0.05, 0.05]} />
            <meshStandardMaterial color={palette.wood} roughness={0.92} />
          </mesh>
        ))}
        {[-0.45, 0.45].flatMap((x) =>
          [-0.24, 0.24].map((z) => (
            <mesh key={`${x}-${z}`} position={[x, 0.04, z]} castShadow>
              <boxGeometry args={[0.05, 0.32, 0.05]} />
              <meshStandardMaterial color={palette.wood} roughness={0.92} />
            </mesh>
          )),
        )}
      </group>

      {/* Stacked firewood beside the cabin */}
      <group position={[1.62, FLOOR_TOP, 0.3]}>
        {[0, 1, 2, 3, 4].map((index) => (
          <mesh
            key={index}
            position={[0, 0.1 + Math.floor(index / 3) * 0.1, -0.12 + (index % 3) * 0.12]}
            rotation={[0, 0, Math.PI / 2]}
            castShadow
          >
            <cylinderGeometry args={[0.05, 0.05, 0.46, 7]} />
            <meshStandardMaterial color={palette.wood} roughness={0.95} />
          </mesh>
        ))}
        <mesh position={[-0.08, 0.06, 0.24]} castShadow>
          <cylinderGeometry args={[0.1, 0.12, 0.12, 8]} />
          <meshStandardMaterial color={palette.wood} roughness={0.98} />
        </mesh>
      </group>

      {PINES.map((pine, index) => (
        <Pine
          key={index}
          position={pine.position}
          scale={pine.scale}
          segments={segments}
          palette={palette}
        />
      ))}

      <Shrub position={[-1.15, FLOOR_TOP, 0.55]} palette={palette} />
      <Shrub position={[1.35, FLOOR_TOP, 0.9]} scale={0.8} palette={palette} />
      <Shrub position={[-1.95, FLOOR_TOP, 1.75]} scale={0.7} palette={palette} />

      <Dust quality={quality} palette={palette} />
    </group>
  )
}
