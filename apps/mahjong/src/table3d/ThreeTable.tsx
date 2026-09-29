import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js'
import { TileModel } from './TileModel'
import gsap from 'gsap'
import type { Game, Tile } from '../engine'
import { getWallState, type WallTileState } from '../wallState'

type Props = { game: Game; selectedId: number | null; onSelect: (id: number) => void }

class MahjongScene {
  private renderer: THREE.WebGLRenderer
  private scene = new THREE.Scene()
  private camera = new THREE.PerspectiveCamera(35, 16 / 9, .1, 100)
  private model = new TileModel()
  private wall = new THREE.Group()
  private environment: THREE.WebGLRenderTarget
  private flights = new Set<THREE.Group>()
  private floor = new THREE.Mesh(new THREE.PlaneGeometry(23, 23), new THREE.ShadowMaterial({ opacity: .22 }))
  private dynamic = new THREE.Group()
  private latestGlow = new THREE.Group()
  private glowInner = new THREE.Mesh(new THREE.PlaneGeometry(.72, .93), new THREE.MeshBasicMaterial({ color: 0xffca59, transparent: true, opacity: .72, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }))
  private glowOuter = new THREE.Mesh(new THREE.PlaneGeometry(.96, 1.17), new THREE.MeshBasicMaterial({ color: 0xffa832, transparent: true, opacity: .22, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }))
  private glowLight = new THREE.PointLight(0xffcf7a, 1.8, 1.65, 2)
  private slots: WallTileState[] = []
  private previousRemaining = -1
  private previousVisible = new Set<number>()
  private raycaster = new THREE.Raycaster()
  private pointer = new THREE.Vector2()
  private raf = 0
  private resizeObserver: ResizeObserver
  private onSelect: (id: number) => void
  private canSelect = false

  constructor(private host: HTMLDivElement, onSelect: (id: number) => void) {
    this.onSelect = onSelect
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' })
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, window.matchMedia('(pointer: coarse)').matches ? 2.5 : 1.75))
    this.renderer.outputColorSpace = THREE.SRGBColorSpace
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping
    this.renderer.toneMappingExposure = 1.05
    this.renderer.shadowMap.enabled = true
    this.renderer.shadowMap.type = THREE.PCFShadowMap
    this.renderer.domElement.setAttribute('aria-label', '立体麻将桌，可点击自己的手牌')
    host.append(this.renderer.domElement)
    this.camera.position.set(0, 20, 20)
    this.camera.lookAt(0, .15, 0)

    const pmrem = new THREE.PMREMGenerator(this.renderer)
    const room = new RoomEnvironment()
    this.environment = pmrem.fromScene(room, .06)
    this.scene.environment = this.environment.texture
    this.scene.environmentIntensity = .35
    room.dispose(); pmrem.dispose()
    this.scene.add(new THREE.HemisphereLight(0xfff4da, 0x162a21, .8))
    const key = new THREE.DirectionalLight(0xffe9c5, 2)
    key.position.set(-7, 12, 8)
    key.castShadow = true
    key.shadow.mapSize.set(2048, 2048)
    key.shadow.camera.left = -14; key.shadow.camera.right = 14
    key.shadow.camera.top = 14; key.shadow.camera.bottom = -14
    key.shadow.normalBias = .025
    this.scene.add(key)
    const fill = new THREE.DirectionalLight(0xd4e8e0, 1)
    fill.position.set(6, 7, -9)
    this.scene.add(fill)
    this.floor.rotation.x = -Math.PI / 2
    this.floor.position.y = .2675
    this.floor.receiveShadow = true
    for (const glow of [this.glowInner, this.glowOuter]) glow.rotation.x = -Math.PI / 2
    this.glowInner.position.y = .003
    this.glowOuter.position.y = .001
    this.glowLight.position.y = .6
    this.latestGlow.add(this.glowOuter, this.glowInner, this.glowLight)
    this.latestGlow.visible = false
    this.scene.add(this.floor, this.wall, this.dynamic, this.latestGlow)
    this.renderer.domElement.addEventListener('pointerdown', this.pickTile)
    this.resizeObserver = new ResizeObserver(() => this.resize())
    this.resizeObserver.observe(host)
    this.resize()
    this.loop()
  }

  setOnSelect(onSelect: (id: number) => void) { this.onSelect = onSelect }

  private resize() {
    const { width, height } = this.host.getBoundingClientRect()
    if (!width || !height) return
    this.renderer.setSize(width, height, false)
    this.camera.aspect = width / height
    this.camera.updateProjectionMatrix()
  }

  private loop = () => {
    this.raf = requestAnimationFrame(this.loop)
    if (this.latestGlow.visible) {
      const pulse = Math.sin(performance.now() * .004)
      ;(this.glowOuter.material as THREE.MeshBasicMaterial).opacity = .20 + pulse * .055
      this.glowLight.intensity = 1.65 + pulse * .3
    }
    this.renderer.render(this.scene, this.camera)
  }

  private pickTile = (event: PointerEvent) => {
    if (!this.canSelect) return
    const rect = this.renderer.domElement.getBoundingClientRect()
    this.pointer.set((event.clientX - rect.left) / rect.width * 2 - 1, -(event.clientY - rect.top) / rect.height * 2 + 1)
    this.raycaster.setFromCamera(this.pointer, this.camera)
    for (const hit of this.raycaster.intersectObjects(this.dynamic.children, true)) {
      let object: THREE.Object3D | null = hit.object
      while (object && object !== this.dynamic) {
        if (typeof object.userData.handTileId === 'number') { this.onSelect(object.userData.handTileId); return }
        object = object.parent
      }
    }
  }

  private standingTile(tile: Tile | null, faceVisible: boolean, scale = 1) {
    const group = this.model.create(faceVisible && tile ? tile.code : undefined)
    group.scale.setScalar(scale)
    return group
  }

  private flatTile(tile: Tile, scale = 1) {
    const group = this.model.create(tile.code)
    group.rotation.x = -Math.PI / 2
    group.scale.setScalar(scale)
    return group
  }

  private animateDraw(from: WallTileState, game: Game) {
    const fly = this.model.create()
    fly.rotation.set(Math.PI / 2, 0, -from.rotation)
    fly.position.set(from.x, from.y, from.z)
    this.scene.add(fly)
    this.flights.add(fly)
    const sideX = game.count === 4 ? 10 : 10.25
    const target = game.active === 0 ? [0, 1.3, 6.55] : game.active === 1 ? [sideX, 1, -1.3] : game.active === 2 ? [0, 1, -9.8] : [-sideX, 1, -1.3]
    gsap.to(fly.position, { x: target[0], y: target[1], z: target[2], duration: .43, ease: 'power2.inOut', onComplete: () => { this.scene.remove(fly); this.flights.delete(fly) } })
  }

  update(game: Game, selectedId: number | null) {
    this.slots = getWallState(game)
    const remaining = game.wall.length
    if (this.previousRemaining >= 0 && this.previousRemaining > remaining && this.previousRemaining - remaining <= 4) {
      for (const slot of this.slots) if (slot.drawn && this.previousVisible.has(slot.id)) this.animateDraw(slot, game)
    }
    this.previousRemaining = remaining
    this.previousVisible = new Set(game.wall.map(tile => tile.id))
    this.model.updateWall(this.wall, this.slots)

    this.scene.remove(this.dynamic)
    this.dynamic = new THREE.Group()
    this.scene.add(this.dynamic)
    this.canSelect = game.active === 0 && game.phase === 'discard'
    const me = game.players[0]
    const hand = [...me.hand].sort((a, b) => a.code.localeCompare(b.code) || a.id - b.id)
    hand.forEach((tile, index) => {
      const mesh = this.standingTile(tile, true, 1.45)
      mesh.rotation.x = -.12
      mesh.position.set((index - (hand.length - 1) / 2) * 1.12, tile.id === selectedId ? 1.31 : 1.07, 6.55)
      mesh.userData.handTileId = tile.id
      this.dynamic.add(mesh)
    })

    me.flowers.forEach((tile, index) => {
      const mesh = this.standingTile(tile, true, .86)
      mesh.rotation.x = -.2
      const column = index % 4
      const row = Math.floor(index / 4)
      mesh.position.set(5.05 + column * .62, .84, 1.65 - row * .78)
      this.dynamic.add(mesh)
    })

    const meldSpan = (seat: number) => game.players[seat].melds.reduce((n, meld) => n + meld.tiles.length * .56 + .15, 0)

    if (game.players[2]) {
      const player = game.players[2]
      player.hand.forEach((_, index) => {
        const mesh = this.standingTile(null, false, 1.05)
        mesh.position.set((index - (player.hand.length - 1) / 2) * .79 - meldSpan(2) / 2, .82, -9.8)
        mesh.rotation.y = Math.PI
        this.dynamic.add(mesh)
      })
    }

    const sideSeats = game.count === 4 ? [{ seat: 1, x: 10, angle: Math.PI / 2 }, { seat: 3, x: -10, angle: -Math.PI / 2 }] : [{ seat: 1, x: 10.25, angle: Math.PI / 2 }]
    sideSeats.forEach(({ seat, x, angle }) => {
      const player = game.players[seat]
      player.hand.forEach((_, index) => {
        const mesh = this.standingTile(null, false, 1.05)
        mesh.rotation.y = angle
        mesh.position.set(x, .81, -1.3 + (index - (player.hand.length - 1) / 2) * .81 - meldSpan(seat) / 2)
        this.dynamic.add(mesh)
      })
    })

    this.latestGlow.visible = false
    game.players.forEach((player, seat) => {
      player.river.slice(-30).forEach((tile, index) => {
        const mesh = this.flatTile(tile, 1.08)
        const horizontal = seat === 0 || seat === 2
        const columns = horizontal ? 8 : 6
        const row = Math.floor(index / columns), col = index % columns
        if (seat === 0) mesh.position.set((col - 3.5) * .84, .44, .75 + row * 1.14)
        else if (seat === 3) mesh.position.set(-5.5 + col * .84, .44, -3 + row * 1.14)
        else if (seat === 2) mesh.position.set((col - 3.5) * .84, .44, -4.3 - row * 1.14)
        else mesh.position.set(2.7 + col * .84, .44, -3 + row * 1.14)
        if (tile.id === game.latestRiverTileId) {
          this.latestGlow.position.set(mesh.position.x, .275, mesh.position.z)
          this.latestGlow.visible = true
        }
        this.dynamic.add(mesh)
      })
      const total = player.melds.reduce((sum, meld) => sum + meld.tiles.length, 0)
      let cursor = 0
      player.melds.forEach((meld, meldIndex) => meld.tiles.forEach(tile => {
        const mesh = this.flatTile(tile, .70)
        const along = (cursor++ - (total - 1) / 2) * .56 + (meldIndex - (player.melds.length - 1) / 2) * .15
        if (seat === 0) mesh.position.set(along, .45, 5.25)
        else if (seat === 2) mesh.position.set(along + player.hand.length * .79 / 2 + .2, .45, -9.8)
        else {
          mesh.rotation.z = seat === 3 ? -Math.PI / 2 : Math.PI / 2
          const sideX = game.count === 4 ? 10 : 10.25
          mesh.position.set(seat === 3 ? -sideX : sideX, .45, -1.3 + along + player.hand.length * .81 / 2 + .2)
        }
        this.dynamic.add(mesh)
      }))
    })
  }

  dispose() {
    cancelAnimationFrame(this.raf)
    this.resizeObserver.disconnect()
    this.renderer.domElement.removeEventListener('pointerdown', this.pickTile)
    this.renderer.dispose()
    this.renderer.domElement.remove()
    for (const fly of this.flights) gsap.killTweensOf(fly.position)
    this.flights.clear()
    this.wall.traverse(object => { if (object instanceof THREE.InstancedMesh) object.dispose() })
    this.model.dispose()
    this.environment.dispose()
    this.floor.geometry.dispose(); this.floor.material.dispose()
    this.glowInner.geometry.dispose(); this.glowOuter.geometry.dispose()
    this.glowInner.material.dispose(); this.glowOuter.material.dispose()
    this.scene.traverse(object => { if (object instanceof THREE.DirectionalLight) object.shadow.dispose() })
  }
}

export function ThreeTable({ game, selectedId, onSelect }: Props) {
  const host = useRef<HTMLDivElement>(null)
  const scene = useRef<MahjongScene | null>(null)
  const callback = useRef(onSelect)
  callback.current = onSelect
  useEffect(() => {
    if (!host.current) return
    scene.current = new MahjongScene(host.current, id => callback.current(id))
    return () => { scene.current?.dispose(); scene.current = null }
  }, [])
  useEffect(() => scene.current?.update(game, selectedId), [game, selectedId])
  return <div className="three-table" ref={host} role="application" aria-label="3D 麻将桌" />
}
