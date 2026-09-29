import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'

/** One physical tile. Standing hands and face-down walls share these dimensions. */
export class TileModel {
  readonly width = .74
  readonly height = 1.02
  readonly depth = .48
  readonly pitch = .77
  private body = new RoundedBoxGeometry(.74, 1.02, .4, 6, .062)
  private back = new RoundedBoxGeometry(.742, 1.022, .2, 6, .055)
  private face = new THREE.PlaneGeometry(.59, .85)
  private ivory = new THREE.MeshPhysicalMaterial({ color: 0xf0e3c9, roughness: .3, metalness: 0, clearcoat: .4, clearcoatRoughness: .24, envMapIntensity: .65 })
  private jade = new THREE.MeshPhysicalMaterial({ color: 0x004c2a, roughness: .3, metalness: 0, clearcoat: .65, clearcoatRoughness: .24, envMapIntensity: .65 })
  private textures = new Map<string, THREE.MeshStandardMaterial>()
  private loader = new THREE.TextureLoader()

  private ink(code: string) {
    let material = this.textures.get(code)
    if (!material) {
      const map = this.loader.load(`/mahjong/assets/tiles/${code}.svg`)
      map.colorSpace = THREE.SRGBColorSpace
      map.anisotropy = 16
      material = new THREE.MeshStandardMaterial({ map, transparent: true, roughness: .48, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1 })
      this.textures.set(code, material)
    }
    return material
  }

  create(code?: string) {
    const tile = new THREE.Group()
    const body = new THREE.Mesh(this.body, this.ivory)
    body.position.z = .025
    const back = new THREE.Mesh(this.back, this.jade)
    back.position.z = -.155
    body.castShadow = back.castShadow = true
    body.receiveShadow = back.receiveShadow = true
    tile.add(body, back)
    if (code) {
      const face = new THREE.Mesh(this.face, this.ink(code))
      face.position.z = .226
      tile.add(face)
    }
    return tile
  }

  /** Green back upwards, white face down. Each stack contains two real tiles. */
  wall(stacks: number) {
    const row = new THREE.Group()
    const bodies = new THREE.InstancedMesh(this.body, this.ivory, stacks * 2)
    const backs = new THREE.InstancedMesh(this.back, this.jade, stacks * 2)
    const transform = new THREE.Object3D()
    const bodyOffset = new THREE.Matrix4().makeTranslation(0, 0, .025)
    const backOffset = new THREE.Matrix4().makeTranslation(0, 0, -.155)
    const matrix = new THREE.Matrix4()
    for (let stack = 0; stack < stacks; stack++) {
      for (let layer = 0; layer < 2; layer++) {
        const index = stack * 2 + layer
        transform.position.set((stack - (stacks - 1) / 2) * this.pitch, .225 + layer * .485, 0)
        transform.rotation.set(Math.PI / 2, 0, 0)
        transform.updateMatrix()
        bodies.setMatrixAt(index, matrix.multiplyMatrices(transform.matrix, bodyOffset))
        backs.setMatrixAt(index, matrix.multiplyMatrices(transform.matrix, backOffset))
      }
    }
    bodies.castShadow = backs.castShadow = true
    bodies.receiveShadow = backs.receiveShadow = true
    bodies.computeBoundingSphere(); backs.computeBoundingSphere()
    row.add(bodies, backs)
    return row
  }

  /** Same approved tile geometry, positioned from authoritative per-tile slots. */
  updateWall(row: THREE.Group, slots: readonly { x: number; y: number; z: number; rotation: number; drawn: boolean }[]) {
    if (!row.children.length) {
      const bodies = new THREE.InstancedMesh(this.body, this.ivory, 144)
      const backs = new THREE.InstancedMesh(this.back, this.jade, 144)
      bodies.castShadow = backs.castShadow = true
      bodies.receiveShadow = backs.receiveShadow = true
      row.add(bodies, backs)
    }
    const bodies = row.children[0] as THREE.InstancedMesh
    const backs = row.children[1] as THREE.InstancedMesh
    const transform = new THREE.Object3D()
    const bodyOffset = new THREE.Matrix4().makeTranslation(0, 0, .025)
    const backOffset = new THREE.Matrix4().makeTranslation(0, 0, -.155)
    const matrix = new THREE.Matrix4()
    for (let i = 0; i < 144; i++) {
      const slot = slots[i]
      if (slot && !slot.drawn) {
        transform.position.set(slot.x, slot.y, slot.z)
        transform.rotation.set(Math.PI / 2, 0, -slot.rotation)
        transform.updateMatrix()
        bodies.setMatrixAt(i, matrix.multiplyMatrices(transform.matrix, bodyOffset))
        backs.setMatrixAt(i, matrix.multiplyMatrices(transform.matrix, backOffset))
      } else {
        matrix.makeScale(0, 0, 0)
        bodies.setMatrixAt(i, matrix); backs.setMatrixAt(i, matrix)
      }
    }
    for (const mesh of [bodies, backs]) {
      mesh.instanceMatrix.needsUpdate = true
      mesh.computeBoundingSphere()
    }
  }

  dispose() {
    this.body.dispose(); this.back.dispose(); this.face.dispose()
    this.ivory.dispose(); this.jade.dispose()
    for (const material of this.textures.values()) { material.map?.dispose(); material.dispose() }
    this.textures.clear()
  }
}
