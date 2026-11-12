"use client"

import * as React from "react"
import * as THREE from "three"
import { getScenePalette, type ScenePalette } from "../scene-palette"
import type { SceneTier } from "../scene-types"
import {
  archShape,
  DioramaBase,
  Dust,
  FLOOR_TOP,
  Palm,
  Shrub,
  useDisposableGeometry,
  type Vec3,
} from "./shared"

const STONES: Vec3[] = [
  [-1.55, FLOOR_TOP + 0.04, 2.05],
  [1.55, FLOOR_TOP + 0.04, 2.2],
  [-0.4, FLOOR_TOP + 0.03, 1.9],
]

function useMudbrickTexture(palette: ScenePalette) {
  const texture = React.useMemo(() => {
    const canvas = document.createElement("canvas")
    canvas.width = 256
    canvas.height = 256
    const ctx = canvas.getContext("2d")
    if (!ctx) return null

    ctx.fillStyle = palette.plaster
    ctx.fillRect(0, 0, 256, 256)

    ctx.globalAlpha = 0.26
    ctx.fillStyle = palette.sandDeep
    for (let row = 0; row < 6; row += 1) {
      const y = row * 42
      ctx.fillRect(0, y, 256, 3)
      const offset = row % 2 === 0 ? 0 : 42
      for (let x = offset; x < 256; x += 84) {
        ctx.fillRect(x, y, 3, 42)
      }
    }

    ctx.globalAlpha = 0.08
    ctx.fillStyle = palette.clayDeep
    for (let index = 0; index < 150; index += 1) {
      const x = (index * 73) % 256
      const y = (index * 131) % 256
      ctx.fillRect(x, y, 2 + (index % 3), 2)
    }

    const map = new THREE.CanvasTexture(canvas)
    map.wrapS = THREE.RepeatWrapping
    map.wrapT = THREE.RepeatWrapping
    map.repeat.set(2, 1.4)
    map.colorSpace = THREE.SRGBColorSpace
    map.anisotropy = 4
    return map
  }, [palette])

  React.useEffect(() => () => texture?.dispose(), [texture])
  return texture
}

function DesertRug({ palette }: { palette: ScenePalette }) {
  const texture = React.useMemo(() => {
    const canvas = document.createElement("canvas")
    canvas.width = 256
    canvas.height = 144
    const ctx = canvas.getContext("2d")
    if (!ctx) return null

    ctx.fillStyle = palette.clayDeep
    ctx.fillRect(0, 0, 256, 144)
    ctx.strokeStyle = palette.cream
    ctx.lineWidth = 8
    ctx.strokeRect(8, 8, 240, 128)
    ctx.strokeStyle = palette.teal
    ctx.lineWidth = 3
    ctx.strokeRect(20, 20, 216, 104)

    ctx.fillStyle = palette.cream
    ctx.beginPath()
    ctx.moveTo(128, 34)
    ctx.lineTo(184, 72)
    ctx.lineTo(128, 110)
    ctx.lineTo(72, 72)
    ctx.closePath()
    ctx.fill()
    ctx.fillStyle = palette.red
    ctx.beginPath()
    ctx.moveTo(128, 48)
    ctx.lineTo(164, 72)
    ctx.lineTo(128, 96)
    ctx.lineTo(92, 72)
    ctx.closePath()
    ctx.fill()
    ctx.fillStyle = palette.cream
    ctx.beginPath()
    ctx.arc(128, 72, 9, 0, Math.PI * 2)
    ctx.fill()

    for (let index = 0; index < 6; index += 1) {
      const x = 34 + index * 38
      for (const y of [30, 114]) {
        ctx.fillStyle = palette.cream
        ctx.beginPath()
        ctx.moveTo(x, y - 5)
        ctx.lineTo(x + 5, y)
        ctx.lineTo(x, y + 5)
        ctx.lineTo(x - 5, y)
        ctx.closePath()
        ctx.fill()
      }
    }

    const map = new THREE.CanvasTexture(canvas)
    map.colorSpace = THREE.SRGBColorSpace
    map.anisotropy = 4
    return map
  }, [palette])

  React.useEffect(() => () => texture?.dispose(), [texture])

  return (
    <mesh position={[-1.3, FLOOR_TOP + 0.008, 1.85]} rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={[1.15, 0.62]} />
      <meshStandardMaterial map={texture ?? undefined} color="white" roughness={0.97} />
    </mesh>
  )
}

export function DesertScene({ quality }: { quality: SceneTier }) {
  const palette = React.useMemo(() => getScenePalette(), [])
  const wallTexture = useMudbrickTexture(palette)
  const archGeometry = useDisposableGeometry(
    React.useMemo(() => archShape(0.9, 1.15, 0.04), [])
  )

  return (
    <group>
      <DioramaBase palette={palette} floorColor={palette.sandDeep} />

      {/* Adobe house */}
      <group position={[0, FLOOR_TOP, -1.35]}>
        <mesh position={[0, 0.62, 0]} castShadow receiveShadow>
          <boxGeometry args={[2.5, 1.25, 1.5]} />
          <meshStandardMaterial
            map={wallTexture ?? undefined}
            color="white"
            roughness={0.98}
            flatShading
          />
        </mesh>

        {/* Parapet */}
        <mesh position={[0, 1.28, 0.7]} castShadow>
          <boxGeometry args={[2.56, 0.16, 0.12]} />
          <meshStandardMaterial color={palette.clay} roughness={0.95} />
        </mesh>

        {/* Dome */}
        <mesh position={[0.42, 1.24, 0]} scale={[1, 1.05, 1]} castShadow>
          <sphereGeometry args={[0.62, 18, 12, 0, Math.PI * 2, 0, Math.PI / 2]} />
          <meshStandardMaterial color={palette.plasterShade} roughness={0.97} flatShading />
        </mesh>
        <mesh position={[0.42, 1.24, 0]} castShadow>
          <cylinderGeometry args={[0.64, 0.66, 0.12, 18]} />
          <meshStandardMaterial color={palette.clay} roughness={0.95} />
        </mesh>
        <mesh position={[0.42, 1.95, 0]}>
          <sphereGeometry args={[0.07, 10, 10]} />
          <meshStandardMaterial color={palette.gold} roughness={0.45} metalness={0.3} />
        </mesh>

        {/* Windcatcher */}
        <group position={[-0.78, 0, 0]}>
          <mesh position={[0, 1.93, 0]} castShadow>
            <boxGeometry args={[0.52, 1.45, 0.52]} />
            <meshStandardMaterial
              map={wallTexture ?? undefined}
              color="white"
              roughness={0.98}
              flatShading
            />
          </mesh>
          <mesh position={[0, 2.68, 0]} castShadow>
            <boxGeometry args={[0.62, 0.08, 0.62]} />
            <meshStandardMaterial color={palette.clay} roughness={0.95} />
          </mesh>
          {[-0.16, 0, 0.16].map((x) => (
            <mesh key={x} position={[x, 1.95, 0.265]}>
              <boxGeometry args={[0.07, 1.05, 0.03]} />
              <meshStandardMaterial color={palette.ink} roughness={0.9} />
            </mesh>
          ))}
          {[-0.16, 0, 0.16].map((z) => (
            <mesh key={z} position={[-0.265, 1.95, z]}>
              <boxGeometry args={[0.03, 1.05, 0.07]} />
              <meshStandardMaterial color={palette.ink} roughness={0.9} />
            </mesh>
          ))}
        </group>

        {/* Arched doorway */}
        <mesh geometry={archGeometry} position={[0.42, 0.02, 0.755]} castShadow>
          <meshStandardMaterial color={palette.clayDeep} roughness={0.95} />
        </mesh>
        <pointLight
          position={[0.42, 0.72, 0.5]}
          color={palette.ember}
          intensity={1.5}
          distance={2.4}
          decay={2}
        />
      </group>

      {/* Courtyard walls */}
      <mesh position={[2.35, FLOOR_TOP + 0.38, 0.15]} castShadow receiveShadow>
        <boxGeometry args={[0.16, 0.76, 2.7]} />
        <meshStandardMaterial
          map={wallTexture ?? undefined}
          color="white"
          roughness={0.98}
          flatShading
        />
      </mesh>
      <mesh position={[2.35, FLOOR_TOP + 0.8, 0.15]} castShadow>
        <boxGeometry args={[0.28, 0.1, 2.8]} />
        <meshStandardMaterial color={palette.clay} roughness={0.95} />
      </mesh>
      <mesh position={[-2.35, FLOOR_TOP + 0.3, 0.55]} castShadow receiveShadow>
        <boxGeometry args={[0.16, 0.6, 1.9]} />
        <meshStandardMaterial
          map={wallTexture ?? undefined}
          color="white"
          roughness={0.98}
          flatShading
        />
      </mesh>
      <mesh position={[-2.35, FLOOR_TOP + 0.63, 0.55]} castShadow>
        <boxGeometry args={[0.28, 0.08, 2.0]} />
        <meshStandardMaterial color={palette.clay} roughness={0.95} />
      </mesh>

      {/* Crenellations on the courtyard walls */}
      {[-1.0, -0.4, 0.2, 0.8, 1.4].map((z) => (
        <mesh key={`right-${z}`} position={[2.35, FLOOR_TOP + 0.92, z]} castShadow>
          <boxGeometry args={[0.22, 0.18, 0.18]} />
          <meshStandardMaterial color={palette.plaster} roughness={0.98} flatShading />
        </mesh>
      ))}
      {[-0.2, 0.3, 0.8, 1.3].map((z) => (
        <mesh key={`left-${z}`} position={[-2.35, FLOOR_TOP + 0.74, z]} castShadow>
          <boxGeometry args={[0.22, 0.18, 0.18]} />
          <meshStandardMaterial color={palette.plaster} roughness={0.98} flatShading />
        </mesh>
      ))}

      {/* Central pool */}
      <group position={[0.35, FLOOR_TOP, 0.6]}>
        <mesh position={[0, 0.06, 0]} receiveShadow>
          <boxGeometry args={[1.55, 0.12, 0.95]} />
          <meshStandardMaterial color={palette.clay} roughness={0.95} />
        </mesh>
        <mesh position={[0, 0.125, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[1.33, 0.75]} />
          <meshStandardMaterial
            color={palette.teal}
            roughness={0.15}
            metalness={0.25}
            emissive={palette.tealDeep}
            emissiveIntensity={0.2}
          />
        </mesh>

        {/* Cream tile rim */}
        {[
          { position: [-0.7, 0.135, 0] as Vec3, size: [0.08, 0.03, 0.85] as Vec3 },
          { position: [0.7, 0.135, 0] as Vec3, size: [0.08, 0.03, 0.85] as Vec3 },
          { position: [0, 0.135, -0.41] as Vec3, size: [1.35, 0.03, 0.08] as Vec3 },
          { position: [0, 0.135, 0.41] as Vec3, size: [1.35, 0.03, 0.08] as Vec3 },
        ].map((rim, index) => (
          <mesh key={index} position={rim.position} castShadow>
            <boxGeometry args={rim.size} />
            <meshStandardMaterial color={palette.cream} roughness={0.9} />
          </mesh>
        ))}

        <mesh position={[0, 0.16, 0]} castShadow>
          <cylinderGeometry args={[0.11, 0.13, 0.16, 10]} />
          <meshStandardMaterial color={palette.clayDeep} roughness={0.9} />
        </mesh>
        <mesh position={[0, 0.26, 0]}>
          <sphereGeometry args={[0.055, 10, 10]} />
          <meshStandardMaterial
            color={palette.teal}
            emissive={palette.tealDeep}
            emissiveIntensity={0.35}
            roughness={0.25}
          />
        </mesh>
        <mesh position={[0, 0.36, 0]}>
          <cylinderGeometry args={[0.012, 0.018, 0.18, 6]} />
          <meshStandardMaterial color={palette.cream} transparent opacity={0.75} />
        </mesh>
        <mesh position={[0, 0.128, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.24, 0.27, 20]} />
          <meshStandardMaterial color={palette.cream} transparent opacity={0.28} />
        </mesh>
      </group>

      {/* Bench and rug */}
      <group position={[-1.15, FLOOR_TOP, 1.25]}>
        <mesh position={[0, 0.14, 0]} castShadow receiveShadow>
          <boxGeometry args={[1.35, 0.28, 0.55]} />
          <meshStandardMaterial color={palette.sand} roughness={0.98} />
        </mesh>
        <mesh position={[-0.3, 0.32, 0.02]} castShadow>
          <boxGeometry args={[0.5, 0.1, 0.44]} />
          <meshStandardMaterial color={palette.cream} roughness={0.95} />
        </mesh>
        <mesh position={[0.3, 0.32, 0.02]} castShadow>
          <boxGeometry args={[0.5, 0.1, 0.44]} />
          <meshStandardMaterial color={palette.clay} roughness={0.95} />
        </mesh>
      </group>
      <DesertRug palette={palette} />

      <Palm position={[1.95, FLOOR_TOP, 0.55]} scale={0.9} palette={palette} />
      <Palm position={[-1.85, FLOOR_TOP, 1.75]} scale={0.62} palette={palette} />

      <Shrub position={[1.35, FLOOR_TOP, 1.5]} scale={0.8} palette={palette} />
      <Shrub position={[-0.2, FLOOR_TOP, 2.05]} scale={0.7} palette={palette} />

      {STONES.map((position, index) => (
        <mesh key={index} position={position} rotation={[0.3, index, 0.2]} castShadow>
          <icosahedronGeometry args={[0.1, 0]} />
          <meshStandardMaterial color={palette.stone} roughness={0.95} flatShading />
        </mesh>
      ))}

      {/* Clay tandoor with a thread of smoke */}
      <group position={[2.0, FLOOR_TOP, 2.08]}>
        <mesh position={[0, 0.2, 0]} castShadow receiveShadow>
          <cylinderGeometry args={[0.2, 0.27, 0.4, 12]} />
          <meshStandardMaterial color={palette.clay} roughness={0.98} flatShading />
        </mesh>
        <mesh position={[0, 0.405, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <circleGeometry args={[0.16, 12]} />
          <meshStandardMaterial color={palette.ink} roughness={1} />
        </mesh>
        <mesh position={[0, 0.41, 0]}>
          <sphereGeometry args={[0.05, 8, 8]} />
          <meshStandardMaterial
            color={palette.glow}
            emissive={palette.ember}
            emissiveIntensity={1.8}
            roughness={0.6}
          />
        </mesh>
        {[0.56, 0.72, 0.88].map((y, index) => (
          <mesh key={y} position={[index * 0.03, y, 0]}>
            <sphereGeometry args={[0.06 + index * 0.02, 8, 8]} />
            <meshStandardMaterial
              color={palette.mist}
              transparent
              opacity={0.2 - index * 0.04}
              roughness={1}
              depthWrite={false}
            />
          </mesh>
        ))}
        <pointLight
          position={[0, 0.6, 0]}
          color={palette.ember}
          intensity={0.8}
          distance={1.6}
          decay={2}
        />
      </group>

      {/* Courtyard lantern post */}
      <group position={[1.6, FLOOR_TOP, 1.35]}>
        <mesh position={[0, 0.5, 0]} castShadow>
          <cylinderGeometry args={[0.025, 0.03, 1.0, 6]} />
          <meshStandardMaterial color={palette.ink} roughness={0.85} />
        </mesh>
        <mesh position={[0, 1.06, 0]} castShadow>
          <boxGeometry args={[0.18, 0.24, 0.18]} />
          <meshStandardMaterial color={palette.clayDeep} roughness={0.7} />
        </mesh>
        <mesh position={[0, 1.06, 0]}>
          <boxGeometry args={[0.12, 0.17, 0.12]} />
          <meshStandardMaterial
            color={palette.glow}
            emissive={palette.ember}
            emissiveIntensity={2.4}
            roughness={0.4}
          />
        </mesh>
        <mesh position={[0, 1.21, 0]} castShadow>
          <coneGeometry args={[0.15, 0.11, 4]} />
          <meshStandardMaterial color={palette.ink} roughness={0.85} />
        </mesh>
        <pointLight
          position={[0, 1.06, 0]}
          color={palette.ember}
          intensity={1.8}
          distance={2.8}
          decay={2}
        />
      </group>

      <Dust quality={quality} palette={palette} />
    </group>
  )
}
