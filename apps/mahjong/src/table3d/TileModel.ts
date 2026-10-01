import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'
import { SPECIAL_TILE_ATLAS, SPECIAL_TILE_ATLAS_SIZE, specialTileRegion } from '../specialTiles'

/** One physical tile. Standing hands and face-down walls share these dimensions. */
export class TileModel {
  readonly width = .74
  readonly height = 1.02
  readonly depth = .48
  readonly pitch = .77
  private body = new RoundedBoxGeometry(.74, 1.02, .4, 6, .062)
  private back = new RoundedBoxGeometry(.742, 1.022, .2, 6, .055)
  private face = new THREE.PlaneGeometry(.59, .85)
  private specialFace = new THREE.PlaneGeometry(.67, .85)
  private ivory = new THREE.MeshPhysicalMaterial({ color: 0xf0e3c9, roughness: .3, metalness: 0, clearcoat: .4, clearcoatRoughness: .24, envMapIntensity: .65 })
  private jade = new THREE.MeshPhysicalMaterial({ color: 0x004c2a, roughness: .3, metalness: 0, clearcoat: .65, clearcoatRoughness: .24, envMapIntensity: .65 })
  private glowEdge = new THREE.MeshBasicMaterial({ color: 0xffc64d, side: THREE.BackSide, transparent: true, opacity: .8, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false })
  private glowSurface = new THREE.MeshBasicMaterial({ color: 0xffdf8a, transparent: true, opacity: .16, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, polygonOffset: true, polygonOffsetFactor: -2 })
  private textures = new Map<string, THREE.MeshStandardMaterial>()
  private loader = new THREE.TextureLoader()
  private specialAtlas: THREE.Texture | null = null

  private ink(code: string) {
    let material = this.textures.get(code)
    if (!material) {
      const region = specialTileRegion(code)
      const map = region ? (this.specialAtlas ??= this.loader.load(SPECIAL_TILE_ATLAS)).clone() : this.loader.load(`/mahjong/assets/tiles/${code}.svg`)
      if (region) {
        map.repeat.set(region.width / SPECIAL_TILE_ATLAS_SIZE.width, region.height / SPECIAL_TILE_ATLAS_SIZE.height)
        map.offset.set(region.x / SPECIAL_TILE_ATLAS_SIZE.width, 1 - (region.y + region.height) / SPECIAL_TILE_ATLAS_SIZE.height)
        map.needsUpdate = true
      }
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
      const face = new THREE.Mesh(specialTileRegion(code) ? this.specialFace : this.face, this.ink(code))
      face.position.z = .226
      tile.add(face)
    }
    return tile
  }

  /** A thin, tile-shaped halo that follows the physical tile's rotation and scale. */
  createGlow() {
    const glow = new THREE.Group()
    const body = new THREE.Mesh(this.body, this.glowEdge)
    body.position.z = .025
    body.scale.set(1.12, 1.09, 1.22)
    const back = new THREE.Mesh(this.back, this.glowEdge)
    back.position.z = -.155
    back.scale.set(1.12, 1.09, 1.35)
    const surface = new THREE.Mesh(this.body, this.glowSurface)
    surface.position.z = .025
    surface.scale.set(1.012, 1.012, 1.012)
    glow.add(body, back, surface)
    return glow
  }

  pulseGlow(pulse: number) {
    this.glowEdge.opacity = .65 + pulse * .18
    this.glowSurface.opacity = .12 + pulse * .055
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
      const bodies = new THREE.InstancedMesh(this.body, this.ivory, 152)
      const backs = new THREE.InstancedMesh(this.back, this.jade, 152)
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
    for (let i = 0; i < 152; i++) {
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
    this.body.dispose(); this.back.dispose(); this.face.dispose(); this.specialFace.dispose()
    this.ivory.dispose(); this.jade.dispose(); this.glowEdge.dispose(); this.glowSurface.dispose()
    for (const material of this.textures.values()) { material.map?.dispose(); material.dispose() }
    this.specialAtlas?.dispose()
    this.textures.clear()
  }
}
