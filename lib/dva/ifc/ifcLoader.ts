// Browser-only glue between web-ifc (WASM IFC parser) and three.js. Not unit
// tested — jsdom has no WebGL/WebAssembly-file-fetch story worth mocking here;
// the pure "picked element -> JunctionComponent" logic lives in mapping.ts
// instead, where it can be tested without a real GPU/browser.
//
// Import this only from a client component, and only at the point of use
// (dynamic import) — it pulls in the web-ifc WASM loader and three.js, neither
// of which should touch the server render.

import * as THREE from 'three'
import { IfcAPI, type FlatMesh } from 'web-ifc'

// web-ifc reads the file's own declared length unit (whatever it is — mm, m,
// feet...) and bakes a conversion to METRES directly into each placed
// element's flatTransformation matrix, as part of its internal geometry
// pipeline. That's true regardless of what the file declares: verified by
// loading a real Revit-exported (millimetre) IFC file and inspecting the
// transformation matrix directly — its scale component was exactly 0.001,
// confirming web-ifc had already converted from the file's mm to metres
// before we ever see the data. So the ONLY conversion this code needs to do
// itself is a fixed metres -> millimetres scale after applying that
// transform — there is no "detect the file's unit" step to get right or
// wrong; web-ifc has already normalized it away.
const METRES_TO_MM = 1000

let sharedApi: IfcAPI | null = null

async function getIfcApi(): Promise<IfcAPI> {
  if (sharedApi) return sharedApi
  const api = new IfcAPI()
  api.SetWasmPath('/wasm/', true)
  await api.Init(undefined, true) // forceSingleThread: avoids needing COOP/COEP headers for the mt build
  sharedApi = api
  return api
}

export interface LoadedIfcModel {
  api: IfcAPI
  modelID: number
  group: THREE.Group
}

export async function loadIfcFile(data: Uint8Array): Promise<LoadedIfcModel> {
  const api = await getIfcApi()
  const modelID = api.OpenModel(data)
  const group = buildMeshes(api, modelID)
  return { api, modelID, group }
}

function buildMeshes(api: IfcAPI, modelID: number): THREE.Group {
  const group = new THREE.Group()
  const flatMeshes = api.LoadAllGeometry(modelID)

  for (let i = 0; i < flatMeshes.size(); i++) {
    const flatMesh: FlatMesh = flatMeshes.get(i)
    const elementExpressID = flatMesh.expressID
    // GetLineType/GetNameFromTypeCode are synchronous — cheap enough to do for every
    // element up front, so category filtering doesn't need an async lookup per click.
    const elementIfcType = api.GetNameFromTypeCode(api.GetLineType(modelID, elementExpressID)) ?? 'Unknown'

    for (let j = 0; j < flatMesh.geometries.size(); j++) {
      const placedGeometry = flatMesh.geometries.get(j)
      const ifcGeometry = api.GetGeometry(modelID, placedGeometry.geometryExpressID)

      const vertexData = api.GetVertexArray(ifcGeometry.GetVertexData(), ifcGeometry.GetVertexDataSize())
      const indexData = api.GetIndexArray(ifcGeometry.GetIndexData(), ifcGeometry.GetIndexDataSize())

      // web-ifc interleaves position (xyz) + normal (xyz) per vertex, 6 floats each.
      const positions = new Float32Array(vertexData.length / 2)
      for (let v = 0; v < vertexData.length / 6; v++) {
        positions[v * 3] = vertexData[v * 6]
        positions[v * 3 + 1] = vertexData[v * 6 + 1]
        positions[v * 3 + 2] = vertexData[v * 6 + 2]
      }

      const geometry = new THREE.BufferGeometry()
      geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
      geometry.setIndex(new THREE.BufferAttribute(indexData, 1))
      geometry.applyMatrix4(new THREE.Matrix4().fromArray(placedGeometry.flatTransformation))
      // flatTransformation always places geometry in metres (see METRES_TO_MM above) —
      // convert to millimetres here so bounding boxes, camera framing, and anything
      // downstream never has to think about model units again.
      geometry.scale(METRES_TO_MM, METRES_TO_MM, METRES_TO_MM)
      geometry.computeVertexNormals()

      const { x: r, y: g, z: b, w: a } = placedGeometry.color
      const material = new THREE.MeshStandardMaterial({
        color: new THREE.Color(r, g, b),
        transparent: a < 1,
        opacity: a,
        side: THREE.DoubleSide,
      })

      const mesh = new THREE.Mesh(geometry, material)
      mesh.userData.expressID = elementExpressID
      mesh.userData.ifcType = elementIfcType
      group.add(mesh)
    }
  }

  return group
}

export interface PickedElement {
  expressID: number
  name: string
  ifcType: string
  bounds: { width: number; height: number; depth: number }
}

/**
 * An IFC element can be made of several geometry pieces (e.g. a panel with an
 * opening, or per-material splits) that all land as separate meshes sharing
 * the same expressID. Measuring only the clicked piece would understate the
 * element's real size, so this unions every mesh with a matching expressID.
 */
export async function describePickedElement(
  api: IfcAPI,
  modelID: number,
  group: THREE.Group,
  expressID: number
): Promise<PickedElement> {
  const box = new THREE.Box3()
  let ifcType = 'Unknown'
  group.traverse((obj) => {
    if (obj instanceof THREE.Mesh && obj.userData.expressID === expressID) {
      box.union(new THREE.Box3().setFromObject(obj))
      ifcType = obj.userData.ifcType ?? ifcType
    }
  })
  const size = new THREE.Vector3()
  box.getSize(size)

  let name = `Element #${expressID}`
  try {
    const props = await api.properties.getItemProperties(modelID, expressID)
    if (props?.Name?.value) name = props.Name.value
  } catch {
    // Some entities (or malformed files) don't resolve properties cleanly — the
    // bounding box is still useful even if the name lookup fails.
  }

  return {
    expressID,
    name,
    ifcType,
    bounds: { width: size.x, height: size.y, depth: size.z },
  }
}

export function disposeIfcModel(loaded: LoadedIfcModel): void {
  loaded.group.traverse((obj) => {
    if (obj instanceof THREE.Mesh) {
      obj.geometry.dispose()
      if (Array.isArray(obj.material)) obj.material.forEach((m) => m.dispose())
      else obj.material.dispose()
    }
  })
  loaded.api.CloseModel(loaded.modelID)
}

export interface CategoryCount {
  ifcType: string
  count: number
}

/**
 * Distinct IFC element types present in a loaded model, with how many elements of
 * each — for a filter panel. Counts distinct expressIDs, not meshes: an element can
 * be made of several geometry pieces (see describePickedElement above), and a filter
 * panel showing "662 railings" when there are really 60 would be actively misleading.
 */
export function summarizeCategories(group: THREE.Group): CategoryCount[] {
  const idsByType = new Map<string, Set<number>>()
  group.traverse((obj) => {
    if (obj instanceof THREE.Mesh) {
      const type = obj.userData.ifcType ?? 'Unknown'
      const ids = idsByType.get(type) ?? new Set<number>()
      ids.add(obj.userData.expressID)
      idsByType.set(type, ids)
    }
  })
  return Array.from(idsByType.entries())
    .map(([ifcType, ids]) => ({ ifcType, count: ids.size }))
    .sort((a, b) => a.ifcType.localeCompare(b.ifcType))
}

export type SectionAxis = 'x' | 'y' | 'z'

/**
 * A clipping plane perpendicular to the given axis, at `position` along it (in the
 * same world units as the model — mm, per buildMeshes above). `flipped` swaps which
 * side of the cut stays visible. For a plane through point p with unit normal n,
 * points on the plane satisfy n·point + constant = 0, so constant = -n·p.
 */
export function computeSectionPlane(axis: SectionAxis, position: number, flipped: boolean): THREE.Plane {
  const normal = new THREE.Vector3(axis === 'x' ? 1 : 0, axis === 'y' ? 1 : 0, axis === 'z' ? 1 : 0)
  if (flipped) normal.multiplyScalar(-1)
  const pointOnPlane = new THREE.Vector3(axis === 'x' ? position : 0, axis === 'y' ? position : 0, axis === 'z' ? position : 0)
  const constant = -normal.dot(pointOnPlane)
  return new THREE.Plane(normal, constant)
}
