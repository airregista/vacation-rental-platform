"use client"

import * as React from "react"
import * as THREE from "three"
import { getScenePalette, type ScenePalette } from "../scene-palette"
import type { SceneTier } from "../scene-types"
import {
  archShape,
  Cypress,
  DioramaBase,
  Dust,
  FLOOR_TOP,
  useDisposableGeometry,
  type Vec3,
} from "./shared"

function PomegranateTree({
  position,
  segments,
  palette,
}: {
  position: Vec3
  segments: number
  palette: ScenePalette
}) {
  const fruit = React.useMemo<Vec3[]>(
    () => [
      [0.2, 1.05, 0.12],
      [-0.24, 0.95, 0.1],
      [0.05, 1.22, -0.2],
      [0.16, 0.82, -0.18],
      [-0.1, 1.12, 0.22],
    ],
    [],
  )

  return (
    <group position={position}>
      <mesh position={[0, 0.26, 0]} castShadow>
        <cylinderGeometry args={[0.06, 0.09, 0.52, 6]} />
        <meshStandardMaterial color={palette.wood} roughness={0.95} />
      </mesh>
      <mesh position={[0.02, 0.98, 0]} castShadow>
        <icosahedronGeometry args={[0.38, 1]} />
        <meshStandardMaterial color={palette.green} roughness={0.9} flatShading />
      </mesh>
      <mesh position={[-0.26, 0.88, 0.1]} castShadow>
        <icosahedronGeometry args={[0.27, 1]} />
        <meshStandardMaterial color={palette.greenDeep} roughness={0.9} flatShading />
      </mesh>
      <mesh position={[0.24, 0.86, -0.12]} castShadow>
        <icosahedronGeometry args={[0.24, 1]} />
        <meshStandardMaterial color={palette.green} roughness={0.9} flatShading />
      </mesh>
      {fruit.map((point, index) => (
        <mesh key={index} position={point}>
          <sphereGeometry args={[0.045, segments, segments]} />
          <meshStandardMaterial color={palette.red} roughness={0.6} />
        </mesh>
      ))}
    </group>
  )
}

function Rug({ palette }: { palette: ScenePalette }) {
  const texture = React.useMemo(() => {
    const canvas = document.createElement("canvas")
    canvas.width = 256
    canvas.height = 352
    const ctx = canvas.getContext("2d")
    if (!ctx) return null

    ctx.fillStyle = palette.clayDeep
    ctx.fillRect(0, 0, 256, 352)

    ctx.strokeStyle = palette.cream
    ctx.lineWidth = 10
    ctx.strokeRect(12, 12, 232, 328)
    ctx.lineWidth = 3
    ctx.strokeRect(28, 28, 200, 296)

    ctx.fillStyle = palette.cream
    ctx.beginPath()
    ctx.moveTo(128, 104)
    ctx.lineTo(188, 176)
    ctx.lineTo(128, 248)
    ctx.lineTo(68, 176)
    ctx.closePath()
    ctx.fill()

    ctx.fillStyle = palette.tealDeep
    ctx.beginPath()
    ctx.moveTo(128, 128)
    ctx.lineTo(168, 176)
    ctx.lineTo(128, 224)
    ctx.lineTo(88, 176)
    ctx.closePath()
    ctx.fill()

    ctx.fillStyle = palette.cream
    ctx.beginPath()
    ctx.arc(128, 176, 16, 0, Math.PI * 2)
    ctx.fill()

    ctx.fillStyle = palette.cream
    for (let i = 0; i < 5; i += 1) {
      const y = 56 + i * 60
      for (const x of [40, 216]) {
        ctx.beginPath()
        ctx.moveTo(x, y - 8)
        ctx.lineTo(x + 7, y)
        ctx.lineTo(x, y + 8)
        ctx.lineTo(x - 7, y)
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
    <group>
      <mesh
        position={[1.72, FLOOR_TOP + 0.006, 1.58]}
        rotation={[-Math.PI / 2, 0, 0]}
        receiveShadow
      >
        <planeGeometry args={[1.2, 1.65]} />
        <meshStandardMaterial map={texture ?? undefined} color="white" roughness={0.95} />
      </mesh>
      {[-0.83, 0.83].flatMap((z) =>
        Array.from({ length: 6 }, (_, index) => (
          <mesh
            key={`${z}-${index}`}
            position={[1.72 + (index - 2.5) * 0.19, FLOOR_TOP + 0.01, 1.58 + z]}
          >
            <boxGeometry args={[0.025, 0.01, 0.1]} />
            <meshStandardMaterial color={palette.cream} roughness={0.95} />
          </mesh>
        )),
      )}
    </group>
  )
}

function PoolApron({ palette }: { palette: ScenePalette }) {
  const texture = React.useMemo(() => {
    const canvas = document.createElement("canvas")
    canvas.width = 256
    canvas.height = 256
    const ctx = canvas.getContext("2d")
    if (!ctx) return null

    const size = 32
    ctx.fillStyle = palette.cream
    ctx.fillRect(0, 0, 256, 256)

    for (let y = 0; y < 8; y += 1) {
      for (let x = 0; x < 8; x += 1) {
        ctx.fillStyle = (x + y) % 2 === 0 ? palette.teal : palette.cream
        ctx.fillRect(x * size, y * size, size, size)

        ctx.fillStyle = palette.clay
        ctx.beginPath()
        ctx.moveTo(x * size + size / 2, y * size + 9)
        ctx.lineTo(x * size + size - 9, y * size + size / 2)
        ctx.lineTo(x * size + size / 2, y * size + size - 9)
        ctx.lineTo(x * size + 9, y * size + size / 2)
        ctx.closePath()
        ctx.fill()
      }
    }

    const map = new THREE.CanvasTexture(canvas)
    map.wrapS = THREE.RepeatWrapping
    map.wrapT = THREE.RepeatWrapping
    map.repeat.set(2, 2)
    map.colorSpace = THREE.SRGBColorSpace
    map.anisotropy = 4
    return map
  }, [palette])

  React.useEffect(() => () => texture?.dispose(), [texture])

  return (
    <mesh position={[0.24, FLOOR_TOP + 0.002, 0.18]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
      <planeGeometry args={[3.25, 2.35]} />
      <meshStandardMaterial map={texture ?? undefined} color="white" roughness={0.85} />
    </mesh>
  )
}

function Seating({ palette }: { palette: ScenePalette }) {
  return (
    <group position={[-1.52, FLOOR_TOP, 1.42]}>
      <mesh position={[0, 0.11, 0]} castShadow receiveShadow>
        <boxGeometry args={[1.95, 0.22, 0.78]} />
        <meshStandardMaterial color={palette.wood} roughness={0.85} />
      </mesh>
      {[
        { x: -0.62, color: palette.cream },
        { x: 0, color: palette.clay },
        { x: 0.62, color: palette.cream },
      ].map((cushion) => (
        <mesh key={cushion.x} position={[cushion.x, 0.29, 0.02]} castShadow>
          <boxGeometry args={[0.52, 0.14, 0.62]} />
          <meshStandardMaterial color={cushion.color} roughness={0.95} />
        </mesh>
      ))}
      <mesh position={[0, 0.37, 0.02]} castShadow>
        <cylinderGeometry args={[0.17, 0.17, 0.025, 18]} />
        <meshStandardMaterial color={palette.gold} roughness={0.4} metalness={0.35} />
      </mesh>
      <mesh position={[0, 0.43, 0.02]}>
        <sphereGeometry args={[0.055, 12, 12]} />
        <meshStandardMaterial color={palette.clayDeep} roughness={0.35} />
      </mesh>
    </group>
  )
}

function Lantern({ palette }: { palette: ScenePalette }) {
  return (
    <group position={[-0.72, FLOOR_TOP, 2.02]}>
      <mesh position={[0, 0.46, 0]} castShadow>
        <cylinderGeometry args={[0.022, 0.03, 0.92, 6]} />
        <meshStandardMaterial color={palette.ink} roughness={0.8} />
      </mesh>
      <mesh position={[0, 1.0, 0]} castShadow>
        <boxGeometry args={[0.19, 0.24, 0.19]} />
        <meshStandardMaterial color={palette.clayDeep} roughness={0.7} />
      </mesh>
      <mesh position={[0, 1.0, 0]}>
        <boxGeometry args={[0.13, 0.17, 0.13]} />
        <meshStandardMaterial
          color={palette.glow}
          emissive={palette.ember}
          emissiveIntensity={2.4}
          roughness={0.4}
        />
      </mesh>
      <mesh position={[0, 1.16, 0]} castShadow>
        <coneGeometry args={[0.16, 0.12, 4]} />
        <meshStandardMaterial color={palette.ink} roughness={0.8} />
      </mesh>
      <pointLight
        position={[0, 1.02, 0]}
        color={palette.ember}
        intensity={2.6}
        distance={3.2}
        decay={2}
      />
    </group>
  )
}

function Pots({ palette }: { palette: ScenePalette }) {
  return (
    <group>
      <mesh position={[2.18, FLOOR_TOP + 0.14, -2.18]} castShadow>
        <cylinderGeometry args={[0.16, 0.12, 0.28, 10]} />
        <meshStandardMaterial color={palette.clay} roughness={0.95} flatShading />
      </mesh>
      <mesh position={[1.86, FLOOR_TOP + 0.1, -2.26]} castShadow>
        <cylinderGeometry args={[0.11, 0.085, 0.2, 10]} />
        <meshStandardMaterial color={palette.clayDeep} roughness={0.95} flatShading />
      </mesh>
      <mesh position={[2.18, FLOOR_TOP + 0.38, -2.18]} castShadow>
        <icosahedronGeometry args={[0.15, 0]} />
        <meshStandardMaterial color={palette.green} roughness={0.9} flatShading />
      </mesh>
    </group>
  )
}

export function KashanScene({ quality }: { quality: SceneTier }) {
  const segments = quality === "full" ? 10 : 7
  const palette = React.useMemo(() => getScenePalette(), [])

  const archGeometry = useDisposableGeometry(React.useMemo(() => archShape(1.0, 1.35, 0.045), []))
  const archPanelGeometry = useDisposableGeometry(
    React.useMemo(() => archShape(0.86, 1.22, 0.03), []),
  )

  return (
    <group>
      <DioramaBase palette={palette} />

      {/* Back wall + coping */}
      <mesh position={[0, FLOOR_TOP + 0.95, -2.52]} castShadow receiveShadow>
        <boxGeometry args={[5.3, 1.9, 0.18]} />
        <meshStandardMaterial color={palette.plaster} roughness={0.97} />
      </mesh>
      <mesh position={[0, FLOOR_TOP + 1.93, -2.52]} castShadow>
        <boxGeometry args={[5.42, 0.1, 0.3]} />
        <meshStandardMaterial color={palette.clay} roughness={0.9} />
      </mesh>

      {/* Side wall + coping */}
      <mesh position={[-2.52, FLOOR_TOP + 0.75, -1.0]} castShadow receiveShadow>
        <boxGeometry args={[0.18, 1.5, 3.2]} />
        <meshStandardMaterial color={palette.plaster} roughness={0.97} />
      </mesh>
      <mesh position={[-2.52, FLOOR_TOP + 1.53, -1.0]} castShadow>
        <boxGeometry args={[0.3, 0.1, 3.32]} />
        <meshStandardMaterial color={palette.clay} roughness={0.9} />
      </mesh>

      {/* Arched niches */}
      {[-1.38, 1.38].map((x) => (
        <group key={x} position={[x, FLOOR_TOP + 0.06, -2.455]}>
          <mesh geometry={archGeometry} castShadow>
            <meshStandardMaterial color={palette.clay} roughness={0.9} />
          </mesh>
          <mesh geometry={archPanelGeometry} position={[0, 0, 0.03]}>
            <meshStandardMaterial color={palette.plasterShade} roughness={0.95} />
          </mesh>
        </group>
      ))}

      <group position={[-2.435, FLOOR_TOP + 0.06, 0.2]} rotation={[0, Math.PI / 2, 0]}>
        <mesh geometry={archGeometry} castShadow>
          <meshStandardMaterial color={palette.clay} roughness={0.9} />
        </mesh>
        <mesh geometry={archPanelGeometry} position={[0, 0, 0.03]}>
          <meshStandardMaterial color={palette.plasterShade} roughness={0.95} />
        </mesh>
      </group>

      {/* Badgir rising over the back wall */}
      <group position={[2.05, FLOOR_TOP, -2.4]}>
        <mesh position={[0, 1.32, 0]} castShadow receiveShadow>
          <boxGeometry args={[0.66, 2.64, 0.46]} />
          <meshStandardMaterial color={palette.plasterShade} roughness={0.97} flatShading />
        </mesh>
        <mesh position={[0, 2.68, 0]} castShadow>
          <boxGeometry args={[0.76, 0.08, 0.56]} />
          <meshStandardMaterial color={palette.clay} roughness={0.92} />
        </mesh>
        {[-0.18, 0, 0.18].map((x) => (
          <mesh key={x} position={[x, 2.33, 0.235]}>
            <boxGeometry args={[0.08, 0.44, 0.02]} />
            <meshStandardMaterial color={palette.ink} roughness={0.9} />
          </mesh>
        ))}
        {[-0.1, 0.1].map((z) => (
          <mesh key={z} position={[0.335, 2.33, z]}>
            <boxGeometry args={[0.02, 0.44, 0.09]} />
            <meshStandardMaterial color={palette.ink} roughness={0.9} />
          </mesh>
        ))}
      </group>

      {/* Pool */}
      <PoolApron palette={palette} />
      <group position={[0.24, FLOOR_TOP, 0.18]}>
        <mesh position={[0, 0.07, 0]} receiveShadow>
          <boxGeometry args={[2.24, 0.14, 1.42]} />
          <meshStandardMaterial color={palette.clay} roughness={0.9} />
        </mesh>
        <mesh position={[0, 0.145, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
          <planeGeometry args={[1.96, 1.16]} />
          <meshStandardMaterial
            color={palette.teal}
            roughness={0.15}
            metalness={0.25}
            emissive={palette.tealDeep}
            emissiveIntensity={0.18}
          />
        </mesh>
        {[
          [-0.55, 0.1],
          [0.35, -0.22],
          [0.6, 0.24],
        ].map(([x, z], index) => (
          <mesh key={index} position={[x, 0.152, z]} rotation={[-Math.PI / 2, 0, 0]}>
            <circleGeometry args={[0.085, segments]} />
            <meshStandardMaterial color={palette.green} roughness={0.8} flatShading />
          </mesh>
        ))}
      </group>

      {/* Central fountain */}
      <group position={[0.24, FLOOR_TOP + 0.15, 0.18]}>
        <mesh position={[0, 0.05, 0]} castShadow>
          <cylinderGeometry args={[0.17, 0.21, 0.1, 8]} />
          <meshStandardMaterial color={palette.clay} roughness={0.92} flatShading />
        </mesh>
        <mesh position={[0, 0.16, 0]}>
          <cylinderGeometry args={[0.026, 0.038, 0.18, 8]} />
          <meshStandardMaterial color={palette.cream} roughness={0.65} />
        </mesh>
        <mesh position={[0, 0.27, 0]}>
          <sphereGeometry args={[0.055, 10, 10]} />
          <meshStandardMaterial
            color={palette.teal}
            emissive={palette.tealDeep}
            emissiveIntensity={0.4}
            roughness={0.2}
          />
        </mesh>
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.006, 0]}>
          <ringGeometry args={[0.28, 0.31, 20]} />
          <meshStandardMaterial color={palette.cream} transparent opacity={0.3} />
        </mesh>
      </group>

      <Rug palette={palette} />
      <Seating palette={palette} />
      <Lantern palette={palette} />
      <Pots palette={palette} />

      {/* Stepping stones */}
      {[
        [-0.42, 1.42],
        [0.02, 1.5],
        [0.46, 1.58],
      ].map(([x, z], index) => (
        <mesh key={index} position={[x, FLOOR_TOP + 0.015, z]} receiveShadow>
          <cylinderGeometry args={[0.19, 0.2, 0.04, 12]} />
          <meshStandardMaterial color={palette.cream} roughness={0.95} />
        </mesh>
      ))}

      <Cypress
        position={[-1.82, FLOOR_TOP, -1.62]}
        scale={0.84}
        segments={segments}
        palette={palette}
      />
      <Cypress
        position={[2.06, FLOOR_TOP, -1.74]}
        scale={0.7}
        segments={segments}
        palette={palette}
      />
      <PomegranateTree position={[-1.98, FLOOR_TOP, 0.32]} segments={segments} palette={palette} />

      {/* Hanging lantern inside the right niche */}
      <mesh position={[1.38, 1.42, -2.35]}>
        <cylinderGeometry args={[0.006, 0.006, 0.28, 5]} />
        <meshStandardMaterial color={palette.ink} roughness={0.8} />
      </mesh>
      <mesh position={[1.38, FLOOR_TOP + 1.08, -2.35]}>
        <sphereGeometry args={[0.075, 12, 12]} />
        <meshStandardMaterial
          color={palette.glow}
          emissive={palette.ember}
          emissiveIntensity={3}
          roughness={0.4}
        />
      </mesh>

      <Dust quality={quality} palette={palette} />
    </group>
  )
}
