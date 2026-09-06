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
import { detectLengthUnit } from './units'

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
  /** Whatever the model's own length unit was, so an extracted dimension is always mm. */
  unitLabel: string
  unitDetected: boolean
}

export async function loadIfcFile(data: Uint8Array): Promise<LoadedIfcModel> {
  const api = await getIfcApi()
  const modelID = api.OpenModel(data)
  const unit = detectLengthUnit(api, modelID)
  const group = buildMeshes(api, modelID, unit.scaleToMm)
  return { api, modelID, group, unitLabel: unit.label, unitDetected: unit.detected }
}

function buildMeshes(api: IfcAPI, modelID: number, scaleToMm: number): THREE.Group {
  const group = new THREE.Group()
  const flatMeshes = api.LoadAllGeometry(modelID)

  for (let i = 0; i < flatMeshes.size(); i++) {
    const flatMesh: FlatMesh = flatMeshes.get(i)
    const elementExpressID = flatMesh.expressID

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
      // Normalize every model to millimetres at load time, so bounding boxes, camera
      // framing, and anything downstream never has to think about model units again.
      geometry.scale(scaleToMm, scaleToMm, scaleToMm)
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
  group.traverse((obj) => {
    if (obj instanceof THREE.Mesh && obj.userData.expressID === expressID) {
      box.union(new THREE.Box3().setFromObject(obj))
    }
  })
  const size = new THREE.Vector3()
  box.getSize(size)

  let name = `Element #${expressID}`
  let ifcType = 'Unknown'
  try {
    const props = await api.properties.getItemProperties(modelID, expressID)
    if (props?.Name?.value) name = props.Name.value
    const typeCode = api.GetLineType(modelID, expressID)
    ifcType = api.GetNameFromTypeCode(typeCode) ?? ifcType
  } catch {
    // Some entities (or malformed files) don't resolve properties cleanly — the
    // bounding box is still useful even if the name/type lookup fails.
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
