import { useEffect, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import * as THREE from 'three'
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { TileModel } from './table3d/TileModel'
import './tile-study.css'

type Mode = 'tile' | 'stack' | 'table'
type View = 'south' | 'east' | 'north' | 'west'
const modes: { value: Mode; label: string; note: string }[] = [
  { value: 'tile', label: '单张与厚度', note: '同一模型的正面、侧面与背面。拖动查看真实厚度与圆角。' },
  { value: 'stack', label: '双层牌墙', note: '两张牌上下叠成一墩，绿色牌背朝上，白色牌身自然露出。' },
  { value: 'table', label: '上下左右', note: '四边使用同一模型，转动 90° 排列。中央留出弃牌空间。' },
]
const views: { value: View; label: string }[] = [{ value: 'south', label: '从下方看' }, { value: 'west', label: '从左侧看' }, { value: 'north', label: '从上方看' }, { value: 'east', label: '从右侧看' }]

function Scene({ mode, view }: { mode: Mode; view: View }) {
  const host = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!host.current) return
    const mount = host.current
    const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.outputColorSpace = THREE.SRGBColorSpace
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 1.05
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = THREE.PCFShadowMap
    renderer.domElement.setAttribute('aria-label', '可拖动旋转的麻将三维模型')
    mount.appendChild(renderer.domElement)
    const scene = new THREE.Scene()
    scene.background = new THREE.Color(0x10261e)
    const pmrem = new THREE.PMREMGenerator(renderer)
    const environment = new RoomEnvironment()
    const env = pmrem.fromScene(environment, .06)
    scene.environment = env.texture
    scene.environmentIntensity = .35
    environment.dispose(); pmrem.dispose()
    scene.add(new THREE.HemisphereLight(0xfff4da, 0x162a21, .8))
    const key = new THREE.DirectionalLight(0xffe9c5, 2)
    key.position.set(-7, 12, 8)
    key.castShadow = true
    key.shadow.mapSize.set(2048, 2048)
    key.shadow.camera.left = -10; key.shadow.camera.right = 10
    key.shadow.camera.top = 10; key.shadow.camera.bottom = -10
    key.shadow.normalBias = .025
    key.shadow.radius = 3
    scene.add(key)
    const fill = new THREE.DirectionalLight(0xd4e8e0, 1)
    fill.position.set(6, 7, -9); scene.add(fill)
    const floorGeometry = new THREE.BoxGeometry(60, .15, 60)
    const floorMaterial = new THREE.MeshStandardMaterial({ color: 0x052214, roughness: .97 })
    const floor = new THREE.Mesh(floorGeometry, floorMaterial)
    floor.position.y = -.075
    floor.receiveShadow = true
    scene.add(floor)
    const model = new TileModel()
    if (mode === 'tile') {
      const angles = [.12, -Math.PI / 3, Math.PI + .2]
      angles.forEach((angle, index) => {
        const tile = model.create(index === 2 ? undefined : 'm6')
        tile.position.set((index - 1) * 1.6, .511, 0)
        tile.rotation.y = angle
        scene.add(tile)
      })
    } else if (mode === 'stack') {
      const row = model.wall(8)
      scene.add(row)
      const stack = model.wall(1)
      stack.position.set(-4.2, 0, .6)
      stack.rotation.y = -.18
      scene.add(stack)
    } else {
      ;[{ x: 0, z: 5.7, angle: 0 }, { x: 0, z: -5.7, angle: Math.PI }, { x: -5.7, z: 0, angle: Math.PI / 2 }, { x: 5.7, z: 0, angle: -Math.PI / 2 }].forEach(({ x, z, angle }) => {
        const row = model.wall(12)
        row.position.set(x, 0, z); row.rotation.y = angle
        scene.add(row)
      })
    }
    const camera = new THREE.PerspectiveCamera(35, 1, .1, 120)
    const controls = new OrbitControls(camera, renderer.domElement)
    controls.target.set(0, mode === 'tile' ? .5 : .1, 0)
    controls.enablePan = false
    controls.enableDamping = true
    controls.minPolarAngle = .18; controls.maxPolarAngle = Math.PI / 2 - .04
    const extent = mode === 'table' ? 17 : mode === 'stack' ? 8.1 : 4.8
    const directions: Record<View, [number, number]> = { south: [0, 1], east: [1, 0], north: [0, -1], west: [-1, 0] }
    const [x, z] = directions[view]
    camera.position.set(x * extent, extent * .85, z * extent)
    controls.minDistance = extent * .55; controls.maxDistance = extent * 2.5
    controls.update()
    const resize = () => {
      const { width, height } = mount.getBoundingClientRect()
      renderer.setSize(width, height)
      camera.aspect = width / height
      camera.updateProjectionMatrix()
    }
    const observer = new ResizeObserver(resize)
    observer.observe(mount); resize()
    let raf = 0
    const render = () => { controls.update(); renderer.render(scene, camera); raf = requestAnimationFrame(render) }
    render()
    return () => {
      cancelAnimationFrame(raf); observer.disconnect(); controls.dispose(); model.dispose()
      floorGeometry.dispose(); floorMaterial.dispose(); key.shadow.map?.dispose(); env.dispose(); renderer.dispose(); renderer.domElement.remove()
    }
  }, [mode, view])
  return <div className="model-scene" ref={host} />
}

function Study() {
  const [mode, setMode] = useState<Mode>('table')
  const [view, setView] = useState<View>('south')
  const [reference, setReference] = useState(false)
  return <main className="study">
    <header><div><span className="eyebrow">港雀 · 牌型打样</span><h1>厚实的牌身，真实的四面透视。</h1></div><button onClick={() => setReference(true)}>对照参考图</button></header>
    <nav aria-label="模型展示内容">{modes.map(item => <button key={item.value} aria-pressed={mode === item.value} onClick={() => setMode(item.value)}>{item.label}</button>)}</nav>
    <section className="viewer" aria-label="模型实景预览"><Scene mode={mode} view={view} /><div className="scene-caption"><span>实时 3D 渲染</span><p>{modes.find(item => item.value === mode)?.note}</p></div><div className="view-controls" aria-label="观察方向">{views.map(item => <button key={item.value} aria-pressed={view === item.value} onClick={() => setView(item.value)}>{item.label}</button>)}</div></section>
    <footer><p>拖动旋转 · 滚轮缩放</p><p>当前为外观打样；正式牌局的数量由游戏引擎决定。</p><a href="/">返回现有游戏</a></footer>
    {reference && <div className="reference-shade" role="dialog" aria-modal="true" aria-label="选定的参考设计"><button autoFocus onClick={() => setReference(false)}>关闭参考图</button><img src="/mahjong/assets/tile-study-reference.png" alt="选定的茶楼麻将设计：厚实圆角牌身、绿色牌背和白色双层牌墙" /></div>}
  </main>
}
createRoot(document.getElementById('app')!).render(<Study />)
