import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { computeSectionPlane, summarizeCategories } from '../ifcLoader'

function meshOfType(ifcType: string, expressID: number): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1))
  mesh.userData.ifcType = ifcType
  mesh.userData.expressID = expressID
  return mesh
}

describe('summarizeCategories', () => {
  it('counts distinct elements per IFC type, sorted alphabetically', () => {
    const group = new THREE.Group()
    group.add(
      meshOfType('IfcWall', 1),
      meshOfType('IfcWall', 2),
      meshOfType('IfcSlab', 3),
      meshOfType('IfcBeam', 4)
    )

    const result = summarizeCategories(group)

    expect(result).toEqual([
      { ifcType: 'IfcBeam', count: 1 },
      { ifcType: 'IfcSlab', count: 1 },
      { ifcType: 'IfcWall', count: 2 },
    ])
  })

  it('counts an element with multiple geometry pieces (shared expressID) once, not per mesh', () => {
    const group = new THREE.Group()
    // Same element (expressID 1), three separate geometry pieces — a single door with a frame and glazing, say.
    group.add(meshOfType('IfcDoor', 1), meshOfType('IfcDoor', 1), meshOfType('IfcDoor', 1))

    expect(summarizeCategories(group)).toEqual([{ ifcType: 'IfcDoor', count: 1 }])
  })

  it('falls back to "Unknown" for a mesh with no tagged type', () => {
    const group = new THREE.Group()
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1))
    mesh.userData.expressID = 1
    group.add(mesh)

    expect(summarizeCategories(group)).toEqual([{ ifcType: 'Unknown', count: 1 }])
  })

  it('returns an empty list for an empty group', () => {
    expect(summarizeCategories(new THREE.Group())).toEqual([])
  })

  it('only counts meshes nested inside child groups too', () => {
    const group = new THREE.Group()
    const nested = new THREE.Group()
    nested.add(meshOfType('IfcColumn', 1))
    group.add(nested)

    expect(summarizeCategories(group)).toEqual([{ ifcType: 'IfcColumn', count: 1 }])
  })
})

describe('computeSectionPlane', () => {
  it('keeps points at or above the cut position on the positive-normal side', () => {
    const plane = computeSectionPlane('x', 500, false)
    expect(plane.normal).toEqual(new THREE.Vector3(1, 0, 0))
    // A point exactly at the cut plane has distance 0; points beyond it (x > 500) are positive.
    expect(plane.distanceToPoint(new THREE.Vector3(500, 0, 0))).toBeCloseTo(0)
    expect(plane.distanceToPoint(new THREE.Vector3(600, 0, 0))).toBeGreaterThan(0)
    expect(plane.distanceToPoint(new THREE.Vector3(400, 0, 0))).toBeLessThan(0)
  })

  it('flips which side is kept when flipped is true', () => {
    const plane = computeSectionPlane('x', 500, true)
    expect(plane.normal.x).toBe(-1)
    expect(plane.normal.y).toBeCloseTo(0) // negating gives -0 here, numerically equal to 0
    expect(plane.normal.z).toBeCloseTo(0)
    expect(plane.distanceToPoint(new THREE.Vector3(600, 0, 0))).toBeLessThan(0)
    expect(plane.distanceToPoint(new THREE.Vector3(400, 0, 0))).toBeGreaterThan(0)
  })

  it('builds the plane perpendicular to whichever axis is requested', () => {
    const yPlane = computeSectionPlane('y', 250, false)
    expect(yPlane.normal).toEqual(new THREE.Vector3(0, 1, 0))
    expect(yPlane.distanceToPoint(new THREE.Vector3(9999, 250, -9999))).toBeCloseTo(0)

    const zPlane = computeSectionPlane('z', -100, false)
    expect(zPlane.normal).toEqual(new THREE.Vector3(0, 0, 1))
    expect(zPlane.distanceToPoint(new THREE.Vector3(9999, -9999, -100))).toBeCloseTo(0)
  })
})
