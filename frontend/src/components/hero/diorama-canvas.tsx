"use client"

import * as React from "react"
import * as THREE from "three"
import { Canvas, useFrame, useThree } from "@react-three/fiber"
import { getScene } from "./scene-registry"
import { getScenePalette } from "./scene-palette"
import type { SceneId, SceneTier } from "./scene-types"

function Rig({ quality, children }: { quality: SceneTier; children: React.ReactNode }) {
  const group = React.useRef<THREE.Group>(null)
  const { camera, size } = useThree()
  const pointer = React.useRef({ x: 0, y: 0 })
  const scroll = React.useRef(0)

  React.useEffect(() => {
    const onPointer = (event: PointerEvent) => {
      if (event.pointerType !== "mouse") return
      pointer.current.x = (event.clientX / window.innerWidth) * 2 - 1
      pointer.current.y = (event.clientY / window.innerHeight) * 2 - 1
    }
    const onScroll = () => {
      scroll.current = Math.min(1, window.scrollY / Math.max(1, window.innerHeight * 0.9))
    }

    window.addEventListener("pointermove", onPointer, { passive: true })
    window.addEventListener("scroll", onScroll, { passive: true })
    onScroll()

    return () => {
      window.removeEventListener("pointermove", onPointer)
      window.removeEventListener("scroll", onScroll)
    }
  }, [])

  // Frame the diorama differently for portrait/landscape canvases.
  React.useEffect(() => {
    const aspect = size.width / Math.max(1, size.height)
    const perspective = camera as THREE.PerspectiveCamera

    // Three.js cameras are imperative objects owned by the renderer, so the
    // usual "never mutate hook values" rule does not apply here.
    /* eslint-disable react-hooks/immutability */
    if (aspect < 1.12) {
      perspective.fov = 42
      perspective.position.set(6.9, 5.2, 7.9)
    } else {
      perspective.fov = 32
      perspective.position.set(7.0, 5.1, 7.95)
    }
    perspective.lookAt(0, 0.95, 0)
    perspective.updateProjectionMatrix()
    /* eslint-enable react-hooks/immutability */
  }, [camera, size.width, size.height])

  useFrame((state, delta) => {
    if (!group.current) return
    const damping = Math.min(1, delta * 3)
    const time = state.clock.elapsedTime
    const pointerWeight = quality === "full" ? 1 : 0.35

    const targetY = pointer.current.x * 0.1 * pointerWeight + scroll.current * 0.16
    const targetX = pointer.current.y * 0.035 * pointerWeight

    group.current.rotation.y += (targetY - group.current.rotation.y) * damping
    group.current.rotation.x += (targetX - group.current.rotation.x) * damping
    group.current.position.y = Math.sin(time * 0.5) * 0.018
  })

  return <group ref={group}>{children}</group>
}

export default function DioramaCanvas({
  scene,
  quality,
  active,
  onReady,
}: {
  scene: SceneId
  quality: SceneTier
  active: boolean
  onReady?: () => void
}) {
  const palette = React.useMemo(() => getScenePalette(), [])
  const Scene = getScene(scene).Scene

  return (
    <Canvas
      dpr={quality === "full" ? [1, 1.5] : [1, 1.25]}
      shadows={quality === "full" ? "percentage" : false}
      frameloop={active ? "always" : "never"}
      gl={{ alpha: true, antialias: true, powerPreference: "high-performance" }}
      camera={{ fov: 32, near: 0.1, far: 60, position: [6.0, 4.4, 6.8] }}
      onCreated={({ gl }) => {
        gl.toneMapping = THREE.ACESFilmicToneMapping
        gl.toneMappingExposure = 1.03
        onReady?.()
      }}
    >
      <ambientLight intensity={0.55} color={palette.lightWarm} />
      <hemisphereLight
        intensity={0.55}
        color={palette.lightSky}
        groundColor={palette.lightGround}
      />
      <directionalLight
        position={[5.5, 8, 4.5]}
        intensity={2.3}
        color={palette.lightKey}
        castShadow={quality === "full"}
        shadow-mapSize-width={quality === "full" ? 2048 : 1024}
        shadow-mapSize-height={quality === "full" ? 2048 : 1024}
        shadow-camera-left={-5}
        shadow-camera-right={5}
        shadow-camera-top={5}
        shadow-camera-bottom={-5}
        shadow-camera-near={0.5}
        shadow-camera-far={22}
        shadow-bias={-0.0004}
        shadow-radius={2.5}
      />
      <directionalLight position={[-5, 3.5, -3]} intensity={0.45} color={palette.lightRim} />

      <Rig quality={quality}>
        <Scene key={scene} quality={quality} />
      </Rig>
    </Canvas>
  )
}
