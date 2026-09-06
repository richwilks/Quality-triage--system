'use client'

import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { disposeIfcModel, describePickedElement, loadIfcFile, LoadedIfcModel, PickedElement } from '@/lib/dva/ifc/ifcLoader'

const SELECTED_COLOR = new THREE.Color('#2A6F77')

export default function IfcViewer({ onElementPicked }: { onElementPicked: (element: PickedElement) => void }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const modelRef = useRef<LoadedIfcModel | null>(null)
  const selectedRef = useRef<{ mesh: THREE.Mesh; originalColor: THREE.Color }[]>([])

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [hasModel, setHasModel] = useState(false)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const scene = new THREE.Scene()
    scene.background = new THREE.Color('#F5F3EE')

    const camera = new THREE.PerspectiveCamera(60, container.clientWidth / container.clientHeight, 0.1, 100000)
    camera.position.set(5000, 5000, 5000)

    const renderer = new THREE.WebGLRenderer({ antialias: true })
    renderer.setSize(container.clientWidth, container.clientHeight)
    renderer.setPixelRatio(window.devicePixelRatio)
    container.appendChild(renderer.domElement)

    const controls = new OrbitControls(camera, renderer.domElement)
    controls.enableDamping = true

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
      const hit = intersects.find((i) => i.object instanceof THREE.Mesh) as THREE.Intersection<THREE.Mesh> | undefined
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

        const box = new THREE.Box3().setFromObject(loaded.group)
        const size = box.getSize(new THREE.Vector3())
        const center = box.getCenter(new THREE.Vector3())
        const maxDim = Math.max(size.x, size.y, size.z) || 1000
        camera.position.set(center.x + maxDim, center.y + maxDim, center.z + maxDim)
        controls.target.copy(center)
        controls.update()
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
          <span className="text-sm text-deck-dim">Click an element in the model to inspect it.</span>
        )}
      </div>
      {hasModel && (
        <p className="mt-1 text-xs text-deck-dim">All dimensions shown in millimetres, regardless of the model's own units.</p>
      )}
      <div ref={containerRef} className="mt-3 h-96 w-full overflow-hidden rounded-lg border border-deck-border" />
    </div>
  )
}
