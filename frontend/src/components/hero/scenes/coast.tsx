"use client"

import * as React from "react"
import * as THREE from "three"
import { useFrame } from "@react-three/fiber"
import { getScenePalette, type ScenePalette } from "../scene-palette"
import type { SceneTier } from "../scene-types"
import { DioramaBase, Dust, FLOOR_TOP, Palm, Shrub, WarmWindow, type Vec3 } from "./shared"

function Sea({ palette, quality }: { palette: ScenePalette; quality: SceneTier }) {
  const mesh = React.useRef<THREE.Mesh>(null)
  const base = React.useRef<Float32Array | null>(null)

  useFrame(({ clock }) => {
    if (quality !== "full" || !mesh.current) return
    const geometry = mesh.current.geometry as THREE.PlaneGeometry
    const position = geometry.attributes.position as THREE.BufferAttribute
    if (!base.current) {
      base.current = Float32Array.from(position.array as Float32Array)
    }
    const time = clock.getElapsedTime()
    for (let index = 0; index < position.count; index += 1) {
      const x = base.current[index * 3]
      const y = base.current[index * 3 + 1]
      position.setZ(
        index,
        Math.sin(x * 2.4 + time * 1.1) * 0.01 + Math.cos(y * 3.1 + time * 0.7) * 0.006,
      )
    }
    position.needsUpdate = true
    geometry.computeVertexNormals()
  })

  return (
    <mesh ref={mesh} position={[0, FLOOR_TOP + 0.035, 1.55]} rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={[4.2, 1.9, quality === "full" ? 28 : 14, 12]} />
      <meshStandardMaterial
        color={palette.teal}
        roughness={0.3}
        metalness={0.12}
        emissive={palette.tealDeep}
        emissiveIntensity={0.1}
      />
    </mesh>
  )
}

function Boat({ palette, quality }: { palette: ScenePalette; quality: SceneTier }) {
  const group = React.useRef<THREE.Group>(null)

  const sailGeometry = React.useMemo(() => {
    const shape = new THREE.Shape()
    shape.moveTo(0, 0)
    shape.lineTo(0.46, 0.03)
    shape.lineTo(0, 0.66)
    shape.closePath()
    return new THREE.ShapeGeometry(shape)
  }, [])
  React.useEffect(() => () => sailGeometry.dispose(), [sailGeometry])

  useFrame(({ clock }) => {
    if (!group.current || quality !== "full") return
    const time = clock.getElapsedTime()
    group.current.position.y = FLOOR_TOP + 0.03 + Math.sin(time * 1.15) * 0.012
    group.current.rotation.z = Math.sin(time * 0.85 + 0.6) * 0.018
  })

  return (
    <group ref={group} position={[1.2, FLOOR_TOP + 0.03, 1.8]} rotation={[0, 0.42, 0]}>
      {/* Hull with raised bow and stern */}
      <mesh position={[0, 0.1, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.95, 0.2, 0.38]} />
        <meshStandardMaterial color={palette.wood} roughness={0.94} flatShading />
      </mesh>
      <mesh position={[0.46, 0.18, 0]} rotation={[0, 0, -0.32]} castShadow>
        <boxGeometry args={[0.18, 0.16, 0.32]} />
        <meshStandardMaterial color={palette.wood} roughness={0.94} flatShading />
      </mesh>
      <mesh position={[-0.46, 0.17, 0]} rotation={[0, 0, 0.28]} castShadow>
        <boxGeometry args={[0.16, 0.14, 0.3]} />
        <meshStandardMaterial color={palette.wood} roughness={0.94} flatShading />
      </mesh>

      {/* Painted gunwale stripe */}
      {[0.2, -0.2].map((z) => (
        <mesh key={z} position={[0, 0.19, z]}>
          <boxGeometry args={[0.82, 0.035, 0.015]} />
          <meshStandardMaterial color={palette.cream} roughness={0.85} />
        </mesh>
      ))}

      {/* Deck, bench and lantern */}
      <mesh position={[0.02, 0.205, 0]} rotation={[0, 0, -0.02]}>
        <boxGeometry args={[0.72, 0.025, 0.28]} />
        <meshStandardMaterial color={palette.clayDeep} roughness={0.95} />
      </mesh>
      <mesh position={[0.18, 0.27, 0]} castShadow>
        <boxGeometry args={[0.28, 0.04, 0.26]} />
        <meshStandardMaterial color={palette.cream} roughness={0.9} />
      </mesh>
      <mesh position={[0.06, 0.27, 0]}>
        <sphereGeometry args={[0.035, 8, 8]} />
        <meshStandardMaterial
          color={palette.glow}
          emissive={palette.ember}
          emissiveIntensity={1.4}
          roughness={0.5}
        />
      </mesh>

      {/* Mast, sail and pennant */}
      <mesh position={[-0.3, 0.56, 0]} castShadow>
        <cylinderGeometry args={[0.018, 0.024, 0.72, 6]} />
        <meshStandardMaterial color={palette.wood} roughness={0.92} />
      </mesh>
      <mesh geometry={sailGeometry} position={[-0.29, 0.29, 0]}>
        <meshStandardMaterial color={palette.cream} side={THREE.DoubleSide} roughness={0.88} />
      </mesh>
      <mesh position={[-0.23, 0.9, 0]} rotation={[0, 0, -0.06]}>
        <boxGeometry args={[0.15, 0.055, 0.012]} />
        <meshStandardMaterial color={palette.red} roughness={0.9} />
      </mesh>

      {/* Oar resting across the gunwale */}
      <mesh position={[0.12, 0.24, 0.22]} rotation={[0, 0.18, 1.15]} castShadow>
        <cylinderGeometry args={[0.014, 0.018, 0.72, 5]} />
        <meshStandardMaterial color={palette.wood} roughness={0.94} />
      </mesh>
    </group>
  )
}

const SHORE_ROCKS: Vec3[] = [
  [-2.15, FLOOR_TOP + 0.07, 0.95],
  [-1.75, FLOOR_TOP + 0.05, 1.3],
  [2.2, FLOOR_TOP + 0.06, 1.15],
]

export function CoastScene({ quality }: { quality: SceneTier }) {
  const palette = React.useMemo(() => getScenePalette(), [])

  return (
    <group>
      <DioramaBase palette={palette} floorColor={palette.sand} />

      {/* Sea and shoreline */}
      <Sea palette={palette} quality={quality} />
      {[
        [1.2, 2.6, 0.34],
        [1.5, 2.0, 0.28],
        [1.8, 2.8, 0.22],
      ].map(([z, width, opacity], index) => (
        <mesh
          key={index}
          position={[index % 2 === 0 ? -0.35 : 0.4, FLOOR_TOP + 0.02, z]}
          rotation={[-Math.PI / 2, 0, 0]}
        >
          <planeGeometry args={[width, 0.05]} />
          <meshStandardMaterial
            color={palette.cream}
            transparent
            opacity={opacity}
            roughness={0.9}
          />
        </mesh>
      ))}
      <mesh position={[0, FLOOR_TOP + 0.018, 0.62]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[4.2, 0.09]} />
        <meshStandardMaterial color={palette.cream} roughness={0.9} />
      </mesh>

      {/* Coastal house */}
      <group position={[0, FLOOR_TOP, -1.2]}>
        <mesh position={[0, 0.58, 0]} castShadow receiveShadow>
          <boxGeometry args={[2.3, 1.16, 1.5]} />
          <meshStandardMaterial color={palette.coral} roughness={0.96} flatShading />
        </mesh>

        {/* Parapet */}
        <mesh position={[0, 1.19, 0.7]} castShadow>
          <boxGeometry args={[2.36, 0.14, 0.12]} />
          <meshStandardMaterial color={palette.cream} roughness={0.95} />
        </mesh>
        <mesh position={[0, 1.19, -0.7]} castShadow>
          <boxGeometry args={[2.36, 0.14, 0.12]} />
          <meshStandardMaterial color={palette.cream} roughness={0.95} />
        </mesh>

        {/* Windcatcher */}
        <group position={[-0.74, 0, 0]}>
          <mesh position={[0, 1.78, 0]} castShadow>
            <boxGeometry args={[0.5, 1.16, 0.5]} />
            <meshStandardMaterial color={palette.plaster} roughness={0.96} flatShading />
          </mesh>
          <mesh position={[0, 2.4, 0]} castShadow>
            <boxGeometry args={[0.6, 0.08, 0.6]} />
            <meshStandardMaterial color={palette.coral} roughness={0.95} />
          </mesh>
          {[-0.15, 0, 0.15].map((x) => (
            <mesh key={x} position={[x, 1.8, 0.255]}>
              <boxGeometry args={[0.065, 0.82, 0.03]} />
              <meshStandardMaterial color={palette.ink} roughness={0.9} />
            </mesh>
          ))}
          {[-0.15, 0, 0.15].map((z) => (
            <mesh key={z} position={[-0.255, 1.8, z]}>
              <boxGeometry args={[0.03, 0.82, 0.065]} />
              <meshStandardMaterial color={palette.ink} roughness={0.9} />
            </mesh>
          ))}
        </group>

        <WarmWindow position={[0.72, 0.66, 0.76]} size={[0.32, 0.3]} palette={palette} />

        {/* Teal shutters with cream slats */}
        {[0.45, 0.99].map((x) => (
          <group key={x} position={[x, 0.66, 0.765]}>
            <mesh castShadow>
              <boxGeometry args={[0.14, 0.4, 0.025]} />
              <meshStandardMaterial color={palette.tealDeep} roughness={0.9} />
            </mesh>
            {[-0.12, -0.04, 0.04, 0.12].map((y) => (
              <mesh key={y} position={[0, y, 0.016]}>
                <boxGeometry args={[0.11, 0.025, 0.008]} />
                <meshStandardMaterial color={palette.cream} roughness={0.9} />
              </mesh>
            ))}
          </group>
        ))}

        {/* Door with a lime-washed frame */}
        <mesh position={[0.1, 0.38, 0.77]} castShadow>
          <boxGeometry args={[0.44, 0.64, 0.035]} />
          <meshStandardMaterial color={palette.cream} roughness={0.95} />
        </mesh>
        <mesh position={[0.1, 0.35, 0.79]} castShadow>
          <boxGeometry args={[0.34, 0.54, 0.03]} />
          <meshStandardMaterial color={palette.wood} roughness={0.95} />
        </mesh>
        <mesh position={[0.24, 0.34, 0.81]}>
          <sphereGeometry args={[0.02, 8, 8]} />
          <meshStandardMaterial color={palette.gold} metalness={0.5} roughness={0.35} />
        </mesh>
        <mesh position={[0.1, 0.03, 0.9]} receiveShadow>
          <boxGeometry args={[0.56, 0.06, 0.3]} />
          <meshStandardMaterial color={palette.stone} roughness={0.95} flatShading />
        </mesh>

        {/* Shaded porch */}
        <mesh position={[0, 0.05, 0.9]} castShadow receiveShadow>
          <boxGeometry args={[2.55, 0.1, 0.85]} />
          <meshStandardMaterial color={palette.wood} roughness={0.95} />
        </mesh>
        {[-1.16, 1.16].map((x) => (
          <group key={x}>
            <mesh position={[x, 0.58, 1.26]} castShadow>
              <boxGeometry args={[0.09, 1.08, 0.09]} />
              <meshStandardMaterial color={palette.wood} roughness={0.95} />
            </mesh>
            <mesh position={[x, 0.22, 1.26]} castShadow>
              <boxGeometry args={[0.11, 0.06, 0.11]} />
              <meshStandardMaterial color={palette.stone} roughness={0.95} />
            </mesh>
          </group>
        ))}
        <mesh position={[0, 1.1, 0.87]} rotation={[0.09, 0, 0]} castShadow>
          <boxGeometry args={[2.5, 0.06, 0.9]} />
          <meshStandardMaterial color={palette.cream} roughness={0.95} />
        </mesh>
        <mesh position={[0, 1.05, 0.43]} castShadow>
          <boxGeometry args={[2.6, 0.09, 0.1]} />
          <meshStandardMaterial color={palette.wood} roughness={0.95} />
        </mesh>
      </group>

      {/* Porch kilim, tea tray and cushions */}
      <group position={[0, FLOOR_TOP, 0.28]}>
        <mesh position={[0, 0.012, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[1.3, 0.55]} />
          <meshStandardMaterial color={palette.clayDeep} roughness={0.98} />
        </mesh>
        {[-0.23, 0.23].map((z) => (
          <mesh key={z} position={[0, 0.016, z]} rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[1.26, 0.045]} />
            <meshStandardMaterial color={palette.cream} roughness={0.96} />
          </mesh>
        ))}
        <mesh position={[0, 0.018, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[1.26, 0.07]} />
          <meshStandardMaterial color={palette.teal} roughness={0.96} />
        </mesh>
        {[-1, 1].flatMap((side) =>
          Array.from({ length: 7 }, (_, index) => (
            <mesh key={`${side}-${index}`} position={[-0.57 + index * 0.19, 0.014, side * 0.29]}>
              <boxGeometry args={[0.035, 0.012, 0.075]} />
              <meshStandardMaterial color={palette.cream} roughness={0.96} />
            </mesh>
          )),
        )}

        {/* Tea tray with two glasses */}
        <mesh position={[0, 0.035, 0]} castShadow>
          <cylinderGeometry args={[0.14, 0.14, 0.022, 16]} />
          <meshStandardMaterial color={palette.gold} metalness={0.05} roughness={0.42} />
        </mesh>
        {[-0.055, 0.055].map((x) => (
          <group key={x} position={[x, 0.06, 0]}>
            <mesh>
              <cylinderGeometry args={[0.032, 0.026, 0.075, 10]} />
              <meshStandardMaterial
                color={palette.cream}
                transparent
                opacity={0.72}
                roughness={0.2}
              />
            </mesh>
            <mesh position={[0, 0.02, 0]}>
              <cylinderGeometry args={[0.026, 0.026, 0.022, 10]} />
              <meshStandardMaterial color={palette.gold} roughness={0.3} />
            </mesh>
          </group>
        ))}

        {[
          { x: -0.38, color: palette.cream },
          { x: 0.38, color: palette.teal },
        ].map((cushion) => (
          <mesh key={cushion.x} position={[cushion.x, 0.1, 0]} castShadow>
            <boxGeometry args={[0.42, 0.16, 0.4]} />
            <meshStandardMaterial color={cushion.color} roughness={0.95} />
          </mesh>
        ))}
      </group>

      {/* Hanging lantern under the porch roof */}
      <group position={[0.78, 0, 0.92]}>
        <mesh position={[0, 0.97, 0]}>
          <cylinderGeometry args={[0.006, 0.006, 0.18, 4]} />
          <meshStandardMaterial color={palette.ink} roughness={0.9} />
        </mesh>
        <mesh position={[0, 0.84, 0]}>
          <boxGeometry args={[0.11, 0.14, 0.11]} />
          <meshStandardMaterial
            color={palette.glow}
            emissive={palette.ember}
            emissiveIntensity={2.2}
            roughness={0.5}
          />
        </mesh>
        <mesh position={[0, 0.92, 0]} castShadow>
          <boxGeometry args={[0.16, 0.025, 0.16]} />
          <meshStandardMaterial color={palette.wood} roughness={0.9} flatShading />
        </mesh>
        <mesh position={[0, 0.76, 0]} castShadow>
          <boxGeometry args={[0.16, 0.025, 0.16]} />
          <meshStandardMaterial color={palette.wood} roughness={0.9} flatShading />
        </mesh>
        {[
          [-0.065, -0.065],
          [-0.065, 0.065],
          [0.065, -0.065],
          [0.065, 0.065],
        ].map(([x, z]) => (
          <mesh key={`${x}-${z}`} position={[x, 0.84, z]} castShadow>
            <boxGeometry args={[0.022, 0.16, 0.022]} />
            <meshStandardMaterial color={palette.wood} roughness={0.9} />
          </mesh>
        ))}
        <mesh position={[0, 0.93, 0]} rotation={[0, Math.PI / 4, 0]}>
          <coneGeometry args={[0.12, 0.08, 4]} />
          <meshStandardMaterial color={palette.ink} roughness={0.9} flatShading />
        </mesh>
      </group>

      {/* Clay pot by the step */}
      <group position={[-0.52, FLOOR_TOP, 0.86]}>
        <mesh position={[0, 0.11, 0]} castShadow>
          <cylinderGeometry args={[0.1, 0.075, 0.22, 10]} />
          <meshStandardMaterial color={palette.clay} roughness={0.98} flatShading />
        </mesh>
        <mesh position={[0, 0.16, 0]}>
          <cylinderGeometry args={[0.085, 0.085, 0.02, 10]} />
          <meshStandardMaterial color={palette.clayDeep} roughness={0.98} />
        </mesh>
        <mesh position={[0, 0.27, 0]} castShadow>
          <icosahedronGeometry args={[0.13, 0]} />
          <meshStandardMaterial color={palette.green} roughness={0.95} flatShading />
        </mesh>
      </group>

      <Boat palette={palette} quality={quality} />

      {/* Crates and palms */}
      <mesh position={[1.95, FLOOR_TOP + 0.14, 0.55]} castShadow>
        <boxGeometry args={[0.38, 0.28, 0.38]} />
        <meshStandardMaterial color={palette.wood} roughness={0.95} />
      </mesh>
      <mesh position={[2.15, FLOOR_TOP + 0.36, 0.5]} rotation={[0, 0.4, 0]} castShadow>
        <boxGeometry args={[0.3, 0.22, 0.3]} />
        <meshStandardMaterial color={palette.clay} roughness={0.95} />
      </mesh>

      <Palm position={[-1.95, FLOOR_TOP, 0.35]} scale={0.92} palette={palette} />
      <Palm position={[1.85, FLOOR_TOP, -0.5]} scale={0.72} palette={palette} />

      <Shrub position={[-1.55, FLOOR_TOP, 1.05]} scale={0.7} palette={palette} />
      <Shrub position={[0.95, FLOOR_TOP, 0.55]} scale={0.55} palette={palette} />

      {SHORE_ROCKS.map((position, index) => (
        <mesh key={index} position={position} rotation={[0.2, index, 0.1]} castShadow>
          <dodecahedronGeometry args={[0.11, 0]} />
          <meshStandardMaterial color={palette.stone} roughness={0.95} flatShading />
        </mesh>
      ))}

      <Dust quality={quality} palette={palette} />
    </group>
  )
}
