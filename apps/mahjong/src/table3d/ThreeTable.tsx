import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js'
import { TileModel } from './TileModel'
import gsap from 'gsap'
import { sortTiles, type Game, type Tile } from '../engine'
import { getWallState, type WallTileState } from '../wallState'

type Props = { game: Game; selectedId: number | null; onSelect: (id: number) => void }

const MOBILE_MAX_PIXEL_RATIO = 1.35
const DESKTOP_MAX_PIXEL_RATIO = 1.5
const TARGET_FRAME_INTERVAL = 1000 / 30

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
  private glowLight = new THREE.PointLight(0xffcf7a, 1.8, 1.65, 2)
  private latestArrow = new THREE.Mesh(new THREE.ConeGeometry(.22, .52, 3), new THREE.MeshBasicMaterial({ color: 0xffd15b, toneMapped: false }))
  private slots: WallTileState[] = []
  private previousRemaining = -1
  private previousVisible = new Set<number>()
  private previousFlowerIds = new Set<number>()
  private flowersInitialized = false
  private raycaster = new THREE.Raycaster()
  private pointer = new THREE.Vector2()
  private raf = 0
  private lastFrame = 0
  private continuousRendering = true
  private resizeObserver: ResizeObserver
  private onSelect: (id: number) => void
  private canSelect = false

  constructor(private host: HTMLDivElement, onSelect: (id: number) => void) {
    this.onSelect = onSelect
    const coarsePointer = window.matchMedia('(pointer: coarse)').matches
    this.renderer = new THREE.WebGLRenderer({ antialias: !coarsePointer, alpha: true, powerPreference: coarsePointer ? 'low-power' : 'default' })
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, coarsePointer ? MOBILE_MAX_PIXEL_RATIO : DESKTOP_MAX_PIXEL_RATIO))
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
    key.shadow.mapSize.set(1024, 1024)
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
    this.glowLight.position.y = .6
    this.latestArrow.rotation.z = Math.PI
    this.latestArrow.position.set(0, 1.15, 0)
    this.latestGlow.add(this.glowLight, this.latestArrow)
    this.latestGlow.visible = false
    this.scene.add(this.floor, this.wall, this.dynamic, this.latestGlow)
    this.renderer.domElement.addEventListener('pointerdown', this.pickTile)
    document.addEventListener('visibilitychange', this.handleVisibility)
    this.resizeObserver = new ResizeObserver(() => this.resize())
    this.resizeObserver.observe(host)
    this.resize()
    if (this.continuousRendering) this.raf = requestAnimationFrame(this.loop)
  }

  setOnSelect(onSelect: (id: number) => void) { this.onSelect = onSelect }

  private resize() {
    const { width, height } = this.host.getBoundingClientRect()
    if (!width || !height) return
    this.renderer.setSize(width, height, false)
    this.camera.aspect = width / height
    this.camera.updateProjectionMatrix()
    this.renderFrame(performance.now())
  }

  private renderFrame(now: number) {
    const pulse = Math.sin(now * .004)
    this.model.pulseGlow(pulse)
    if (this.latestGlow.visible) {
      this.glowLight.intensity = 1.65 + pulse * .3
      this.latestArrow.position.y = 1.12 + pulse * .1
    }
    this.renderer.render(this.scene, this.camera)
  }

  private loop = (now: number) => {
    this.raf = 0
    if (document.hidden) return
    if (now - this.lastFrame >= TARGET_FRAME_INTERVAL) {
      this.lastFrame = now
      this.renderFrame(now)
    }
    if (this.continuousRendering) this.raf = requestAnimationFrame(this.loop)
  }

  private handleVisibility = () => {
    if (document.hidden) {
      cancelAnimationFrame(this.raf)
      this.raf = 0
      gsap.ticker.sleep()
      return
    }
    gsap.ticker.wake()
    this.lastFrame = 0
    if (this.continuousRendering && !this.raf) this.raf = requestAnimationFrame(this.loop)
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

  private flowerTransform(seat: number, index: number, total: number, count: number) {
    const column = index % 4
    const row = Math.floor(index / 4)
    const scale = total > 8 ? .56 : .68
    if (seat === 0) return { x: 5.05 + column * .56, z: 1.65 - row * .68, scale }
    if (seat === 2) return { x: 11.15 - column * .56, z: -7.15 - row * .58, scale }
    if (seat === 1) return { x: (count === 4 ? 10.15 : 10.4) + row * .58, z: 6.85 - column * .58, scale }
    return { x: -10.15 - row * .58, z: -6.85 + column * .58, scale }
  }

  private animateNewFlower(mesh: THREE.Group, from: WallTileState | undefined, target: { x: number; y?: number; z: number }) {
    const glow = this.model.createGlow()
    mesh.add(glow)
    if (from) {
      mesh.position.set(from.x, Math.max(1.25, from.y + .7), from.z)
      mesh.scale.multiplyScalar(.82)
      gsap.to(mesh.position, { x: target.x, y: target.y ?? .45, z: target.z, duration: .62, ease: 'power2.inOut' })
      gsap.to(mesh.scale, { x: mesh.scale.x / .82, y: mesh.scale.y / .82, z: mesh.scale.z / .82, duration: .62, ease: 'back.out(1.5)' })
    }
    gsap.to(glow.scale, { x: 1.18, y: 1.18, z: 1.18, duration: .28, repeat: 1, yoyo: true, onComplete: () => { glow.visible = false } })
  }

  update(game: Game, selectedId: number | null) {
    this.continuousRendering = game.phase !== 'result' && game.phase !== 'match-result'
    this.slots = getWallState(game)
    const remaining = game.wall.length
    const newlyDrawnSlots = this.slots.filter(slot => slot.drawn && this.previousVisible.has(slot.id))
    const flowerSource = newlyDrawnSlots.at(0)
    if (this.previousRemaining >= 0 && this.previousRemaining > remaining && this.previousRemaining - remaining <= 4) {
      for (const slot of this.slots) if (slot.drawn && this.previousVisible.has(slot.id)) this.animateDraw(slot, game)
    }
    this.previousRemaining = remaining
    this.previousVisible = new Set(game.wall.map(tile => tile.id))
    this.model.updateWall(this.wall, this.slots)

    this.scene.remove(this.dynamic)
    this.dynamic = new THREE.Group()
    this.scene.add(this.dynamic)
    this.canSelect = game.phase !== 'result' && game.phase !== 'match-result'
    const revealHands = game.phase === 'result' || game.phase === 'match-result'
    const me = game.players[0]
    const drawnTile = game.phase === 'discard' && game.lastDraw?.seat === 0
      ? me.hand.find(tile => tile.id === game.lastDraw?.tileId)
      : undefined
    const hand = sortTiles(me.hand.filter(tile => tile.id !== drawnTile?.id))
    if (drawnTile) hand.push(drawnTile)
    const handSpan = Math.max(0, hand.length - 1) * 1.12 + (drawnTile ? .58 : 0)
    hand.forEach((tile, index) => {
      const mesh = revealHands ? this.flatTile(tile, .72) : this.standingTile(tile, true, 1.45)
      if (!revealHands) mesh.rotation.x = -.12
      const x = revealHands
        ? (index - (hand.length - 1) / 2) * .58
        : -handSpan / 2 + index * 1.12 + (drawnTile && tile.id === drawnTile.id ? .58 : 0)
      mesh.position.set(x, revealHands ? .45 : tile.id === selectedId ? 1.31 : 1.07, 6.55)
      if (tile.id === selectedId) mesh.add(this.model.createGlow())
      mesh.userData.handTileId = tile.id
      this.dynamic.add(mesh)
    })

    const meldSpan = (seat: number) => game.players[seat].melds.reduce((n, meld) => n + meld.tiles.length * .56 + .15, 0)
    if (game.players[2]) {
      const player = game.players[2]
      player.hand.forEach((tile, index) => {
        const mesh = revealHands ? this.flatTile(tile, .72) : this.standingTile(null, false, 1.05)
        mesh.position.set((index - (player.hand.length - 1) / 2) * (revealHands ? .58 : .79) - meldSpan(2) / 2, revealHands ? .45 : .82, -9.8)
        if (revealHands) mesh.rotation.z = Math.PI
        else mesh.rotation.y = Math.PI
        this.dynamic.add(mesh)
      })
    }

    const sideSeats = game.count === 4 ? [{ seat: 1, x: 10, angle: Math.PI / 2 }, { seat: 3, x: -10, angle: -Math.PI / 2 }] : [{ seat: 1, x: 10.25, angle: Math.PI / 2 }]
    sideSeats.forEach(({ seat, x, angle }) => {
      const player = game.players[seat]
      player.hand.forEach((tile, index) => {
        const mesh = revealHands ? this.flatTile(tile, .72) : this.standingTile(null, false, 1.05)
        if (revealHands) mesh.rotation.z = seat === 3 ? -Math.PI / 2 : Math.PI / 2
        else mesh.rotation.y = angle
        mesh.position.set(x, revealHands ? .45 : .81, -1.3 + (index - (player.hand.length - 1) / 2) * (revealHands ? .58 : .81) - meldSpan(seat) / 2)
        this.dynamic.add(mesh)
      })
    })

    // Bonus tiles are public information. Opponents keep theirs in the three marked
    // edge zones and orient the faces toward their own seat, like physical play.
    game.players.forEach((player, seat) => {
      player.flowers.forEach((tile, index) => {
        const target = { ...this.flowerTransform(seat, index, player.flowers.length, game.count), y: seat === 2 ? .58 : .45 }
        const mesh = this.flatTile(tile, target.scale)
        mesh.rotation.z = seat === 1 ? Math.PI / 2 : seat === 2 ? Math.PI : seat === 3 ? -Math.PI / 2 : 0
        mesh.position.set(target.x, target.y, target.z)
        this.dynamic.add(mesh)
        if (this.flowersInitialized && !this.previousFlowerIds.has(tile.id)) this.animateNewFlower(mesh, flowerSource, target)
      })
    })
    this.previousFlowerIds = new Set(game.players.flatMap(player => player.flowers.map(tile => tile.id)))
    this.flowersInitialized = true

    this.latestGlow.visible = false
    const selectedCode = me.hand.find(tile => tile.id === selectedId)?.code
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
        if (tile.id === game.latestRiverTileId || selectedCode && tile.code === selectedCode) mesh.add(this.model.createGlow())
        this.dynamic.add(mesh)
      })
      const total = player.melds.reduce((sum, meld) => sum + meld.tiles.length, 0)
      let cursor = 0
      player.melds.forEach((meld, meldIndex) => meld.tiles.forEach((tile, tileIndex) => {
        const mesh = this.flatTile(tile, .70)
        const along = (cursor++ - (total - 1) / 2) * .56 + (meldIndex - (player.melds.length - 1) / 2) * .15
        if (seat === 0) mesh.position.set(along, .45, 5.25)
        else if (seat === 2) mesh.position.set(along + player.hand.length * .79 / 2 + .2, .45, -9.8)
        else {
          mesh.rotation.z = seat === 3 ? -Math.PI / 2 : Math.PI / 2
          const sideX = game.count === 4 ? 10 : 10.25
          mesh.position.set(seat === 3 ? -sideX : sideX, .45, -1.3 + along + player.hand.length * .81 / 2 + .2)
        }
        const representedCode = meld.represented?.[tileIndex] || tile.code
        if (selectedCode && representedCode === selectedCode) mesh.add(this.model.createGlow())
        this.dynamic.add(mesh)
      }))
    })
    if (!document.hidden) {
      this.renderFrame(performance.now())
      if (this.continuousRendering && !this.raf) this.raf = requestAnimationFrame(this.loop)
    }
  }

  dispose() {
    cancelAnimationFrame(this.raf)
    this.resizeObserver.disconnect()
    document.removeEventListener('visibilitychange', this.handleVisibility)
    this.renderer.domElement.removeEventListener('pointerdown', this.pickTile)
    this.renderer.dispose()
    this.renderer.domElement.remove()
    for (const fly of this.flights) gsap.killTweensOf(fly.position)
    this.flights.clear()
    this.wall.traverse(object => { if (object instanceof THREE.InstancedMesh) object.dispose() })
    this.model.dispose()
    this.environment.dispose()
    this.floor.geometry.dispose(); this.floor.material.dispose()
    this.latestArrow.geometry.dispose(); this.latestArrow.material.dispose()
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
