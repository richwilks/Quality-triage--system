'use client'

import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import {
  CategoryCount,
  LoadedIfcModel,
  PickedElement,
  SectionAxis,
  computeSectionPlane,
  describePickedElement,
  disposeIfcModel,
  loadIfcFile,
  summarizeCategories,
} from '@/lib/dva/ifc/ifcLoader'

const SELECTED_COLOR = new THREE.Color('#2A6F77')

export default function IfcViewer({ onElementPicked }: { onElementPicked: (element: PickedElement) => void }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const modelRef = useRef<LoadedIfcModel | null>(null)
  const selectedRef = useRef<{ mesh: THREE.Mesh; originalColor: THREE.Color }[]>([])
  const modelBoxRef = useRef<THREE.Box3 | null>(null)

  const sceneRef = useRef<THREE.Scene | null>(null)
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null)
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null)
  const controlsRef = useRef<OrbitControls | null>(null)

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [hasModel, setHasModel] = useState(false)

  const [categories, setCategories] = useState<CategoryCount[]>([])
  const [hiddenTypes, setHiddenTypes] = useState<Set<string>>(new Set())
  const [selectedExpressID, setSelectedExpressID] = useState<number | null>(null)
  const [isolated, setIsolated] = useState(false)

  const [sectionEnabled, setSectionEnabled] = useState(false)
  const [sectionAxis, setSectionAxis] = useState<SectionAxis>('x')
  const [sectionFraction, setSectionFraction] = useState(0.5)
  const [sectionFlipped, setSectionFlipped] = useState(false)

  function frameModel() {
    const loaded = modelRef.current
    const camera = cameraRef.current
    const controls = controlsRef.current
    if (!loaded || !camera || !controls) return

    const box = new THREE.Box3().setFromObject(loaded.group)
    modelBoxRef.current = box
    const size = box.getSize(new THREE.Vector3())
    const center = box.getCenter(new THREE.Vector3())
    const maxDim = Math.max(size.x, size.y, size.z) || 1000
    camera.position.set(center.x + maxDim, center.y + maxDim, center.z + maxDim)
    controls.target.copy(center)
    controls.update()
  }

  // Isolating an element takes priority over the category checklist; otherwise each
  // mesh's visibility follows whether its IFC type is checked.
  useEffect(() => {
    const loaded = modelRef.current
    if (!loaded) return
    loaded.group.traverse((obj) => {
      if (!(obj instanceof THREE.Mesh)) return
      if (isolated && selectedExpressID !== null) {
        obj.visible = obj.userData.expressID === selectedExpressID
      } else {
        obj.visible = !hiddenTypes.has(obj.userData.ifcType ?? 'Unknown')
      }
    })
  }, [hiddenTypes, isolated, selectedExpressID, hasModel])

  useEffect(() => {
    const renderer = rendererRef.current
    const box = modelBoxRef.current
    if (!renderer) return
    if (!sectionEnabled || !box) {
      renderer.clippingPlanes = []
      return
    }
    const min = box.min[sectionAxis]
    const max = box.max[sectionAxis]
    const position = min + sectionFraction * (max - min)
    renderer.clippingPlanes = [computeSectionPlane(sectionAxis, position, sectionFlipped)]
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sectionEnabled, sectionAxis, sectionFraction, sectionFlipped, hasModel])

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const scene = new THREE.Scene()
    scene.background = new THREE.Color('#F5F3EE')
    sceneRef.current = scene

    const camera = new THREE.PerspectiveCamera(60, container.clientWidth / container.clientHeight, 0.1, 100000)
    camera.position.set(5000, 5000, 5000)
    cameraRef.current = camera

    const renderer = new THREE.WebGLRenderer({ antialias: true })
    renderer.setSize(container.clientWidth, container.clientHeight)
    renderer.setPixelRatio(window.devicePixelRatio)
    container.appendChild(renderer.domElement)
    rendererRef.current = renderer

    const controls = new OrbitControls(camera, renderer.domElement)
    controls.enableDamping = true
    controlsRef.current = controls

    scene.add(new THREE.AmbientLight(0xffffff, 0.6))
    const directional = new THREE.DirectionalLight(0xffffff, 0.8)
    directional.position.set(1, 2, 1)
    scene.add(directional)

    const raycaster = new THREE.Raycaster()
    const pointer = new THREE.Vector2()

    function onClick(event: MouseEvent) {
      const loaded = modelRef.current
      if (!loaded) return
      const rect = renderer.domElement.getBoundingClientRect()
      pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1
      pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1

      raycaster.setFromCamera(pointer, camera)
      const intersects = raycaster.intersectObjects(loaded.group.children, false)
      const hit = intersects.find((i) => i.object instanceof THREE.Mesh && i.object.visible) as
        | THREE.Intersection<THREE.Mesh>
        | undefined
      if (!hit) return

      for (const { mesh, originalColor } of selectedRef.current) {
        ;(mesh.material as THREE.MeshStandardMaterial).color.copy(originalColor)
      }

      // An IFC element can be split across several meshes (an opening, per-material
      // pieces) that all share the clicked mesh's expressID — highlight all of them,
      // not just the one the ray happened to hit.
      const expressID = hit.object.userData.expressID
      const matchingMeshes: THREE.Mesh[] = []
      loaded.group.traverse((obj) => {
        if (obj instanceof THREE.Mesh && obj.userData.expressID === expressID) matchingMeshes.push(obj)
      })

      selectedRef.current = matchingMeshes.map((mesh) => {
        const material = mesh.material as THREE.MeshStandardMaterial
        const originalColor = material.color.clone()
        material.color.copy(SELECTED_COLOR)
        return { mesh, originalColor }
      })
      setSelectedExpressID(expressID)

      describePickedElement(loaded.api, loaded.modelID, loaded.group, expressID).then(onElementPicked)
    }
    renderer.domElement.addEventListener('click', onClick)

    let frameId: number
    function animate() {
      frameId = requestAnimationFrame(animate)
      controls.update()
      renderer.render(scene, camera)
    }
    animate()

    function onResize() {
      if (!container) return
      camera.aspect = container.clientWidth / container.clientHeight
      camera.updateProjectionMatrix()
      renderer.setSize(container.clientWidth, container.clientHeight)
    }
    window.addEventListener('resize', onResize)

    async function handleFileChange(e: Event) {
      const input = e.target as HTMLInputElement
      const file = input.files?.[0]
      if (!file) return

      setLoading(true)
      setError(null)
      try {
        if (modelRef.current) {
          scene.remove(modelRef.current.group)
          disposeIfcModel(modelRef.current)
          modelRef.current = null
          selectedRef.current = []
        }

        const buffer = await file.arrayBuffer()
        const loaded = await loadIfcFile(new Uint8Array(buffer))
        modelRef.current = loaded
        scene.add(loaded.group)
        setHasModel(true)
        setCategories(summarizeCategories(loaded.group))
        setHiddenTypes(new Set())
        setSelectedExpressID(null)
        setIsolated(false)
        setSectionEnabled(false)
        renderer.clippingPlanes = []

        frameModel()
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Could not read that IFC file.')
      } finally {
        setLoading(false)
      }
    }

    const fileInput = fileInputRef.current
    fileInput?.addEventListener('change', handleFileChange)

    return () => {
      cancelAnimationFrame(frameId)
      window.removeEventListener('resize', onResize)
      renderer.domElement.removeEventListener('click', onClick)
      fileInput?.removeEventListener('change', handleFileChange)
      if (modelRef.current) disposeIfcModel(modelRef.current)
      renderer.dispose()
      container.removeChild(renderer.domElement)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function toggleCategory(ifcType: string) {
    setHiddenTypes((prev) => {
      const next = new Set(prev)
      if (next.has(ifcType)) next.delete(ifcType)
      else next.add(ifcType)
      return next
    })
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3">
        <label
          className={`rounded-md border border-deck-border px-3 py-1.5 text-sm font-medium text-deck-body ${loading ? 'opacity-50' : 'hover:bg-deck-raised'}`}
        >
          {hasModel ? 'Load a different .ifc file' : 'Upload .ifc file'}
          <input ref={fileInputRef} type="file" accept=".ifc" disabled={loading} className="hidden" />
        </label>
        {loading && <span className="text-sm text-deck-dim">Parsing model…</span>}
        {error && <span className="text-sm text-status-rejected">{error}</span>}
        {hasModel && !loading && !error && (
          <>
            <button
              type="button"
              onClick={frameModel}
              className="rounded-md border border-deck-border px-3 py-1.5 text-sm font-medium text-deck-body hover:bg-deck-raised"
            >
              Reset view
            </button>
            {selectedExpressID !== null && (
              <button
                type="button"
                onClick={() => setIsolated((v) => !v)}
                className={`rounded-md border border-deck-border px-3 py-1.5 text-sm font-medium ${isolated ? 'bg-deck-accent text-white' : 'text-deck-body hover:bg-deck-raised'}`}
              >
                {isolated ? 'Show all' : 'Isolate selected'}
              </button>
            )}
          </>
        )}
      </div>
      {hasModel && (
        <p className="mt-1 text-xs text-deck-dim">All dimensions shown in millimetres, regardless of the model's own units.</p>
      )}

      <div ref={containerRef} className="mt-3 h-96 w-full overflow-hidden rounded-lg border border-deck-border" />

      {hasModel && !loading && !error && (
        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          <div className="rounded-lg border border-deck-border p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-deck-dim">Section</p>
            <label className="mt-2 flex items-center gap-2 text-sm text-deck-body">
              <input type="checkbox" checked={sectionEnabled} onChange={(e) => setSectionEnabled(e.target.checked)} />
              Enable section cut
            </label>
            {sectionEnabled && (
              <div className="mt-2 space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-deck-dim">Axis</span>
                  {(['x', 'y', 'z'] as SectionAxis[]).map((axis) => (
                    <button
                      key={axis}
                      type="button"
                      onClick={() => setSectionAxis(axis)}
                      className={`rounded px-2 py-1 text-xs font-medium uppercase ${sectionAxis === axis ? 'bg-deck-accent text-white' : 'border border-deck-border text-deck-body'}`}
                    >
                      {axis}
                    </button>
                  ))}
                  <label className="ml-2 flex items-center gap-1 text-xs text-deck-dim">
                    <input type="checkbox" checked={sectionFlipped} onChange={(e) => setSectionFlipped(e.target.checked)} />
                    Flip
                  </label>
                </div>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.01}
                  value={sectionFraction}
                  onChange={(e) => setSectionFraction(parseFloat(e.target.value))}
                  className="w-full"
                />
              </div>
            )}
          </div>

          <div className="rounded-lg border border-deck-border p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-deck-dim">Filter by category</p>
            <div className="mt-2 max-h-40 space-y-1 overflow-y-auto">
              {categories.map((c) => (
                <label key={c.ifcType} className="flex items-center gap-2 text-sm text-deck-body">
                  <input type="checkbox" checked={!hiddenTypes.has(c.ifcType)} onChange={() => toggleCategory(c.ifcType)} />
                  {c.ifcType} <span className="text-xs text-deck-dim">({c.count})</span>
                </label>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
