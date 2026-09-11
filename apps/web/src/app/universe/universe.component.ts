import {
  AfterViewInit,
  ChangeDetectorRef,
  Component,
  ElementRef,
  NgZone,
  OnDestroy,
  ViewChild,
  inject,
} from '@angular/core';
import { Router } from '@angular/router';
import * as THREE from 'three';

const GALAXY_VERTEX_SHADER = `
  attribute float aScale;
  attribute float aPhase;

  uniform float uTime;
  uniform float uPixelRatio;
  uniform float uInteraction;
  uniform float uWarp;
  uniform vec2 uPointer;

  varying vec3 vColor;
  varying float vAlpha;

  void main() {
    vec3 particle = position;
    float ellipticalRadius = length(vec2(particle.x, particle.y / 0.58));
    float spin = uTime * (0.055 + 0.34 / (1.0 + ellipticalRadius * 0.11));
    float cosine = cos(spin);
    float sine = sin(spin);
    particle.xy = mat2(cosine, -sine, sine, cosine) * particle.xy;

    float flow = sin(uTime * 0.42 + aPhase + ellipticalRadius * 0.44);
    particle.y += flow * (0.08 + ellipticalRadius * 0.004);
    particle.z += flow * (0.42 + ellipticalRadius * 0.018);

    vec2 delta = particle.xy - uPointer;
    float pointerDistance = length(delta);
    float influence = smoothstep(11.5, 0.0, pointerDistance) * uInteraction;
    vec2 direction = normalize(delta + vec2(0.0001));
    vec2 tangent = vec2(-direction.y, direction.x);
    particle.xy += tangent * influence * (1.35 + sin(aPhase) * 0.45);
    particle.xy += direction * influence * 0.52;
    particle.z += sin(aPhase + uTime * 1.65) * influence * 2.9;

    float warpScale = 1.0 + uWarp * (2.8 + max(0.0, particle.z) * 0.035);
    particle.xy *= warpScale;
    particle.z -= uWarp * (10.0 + ellipticalRadius * 0.72);

    vec4 modelPosition = modelViewMatrix * vec4(particle, 1.0);
    gl_Position = projectionMatrix * modelPosition;

    float perspective = 112.0 / max(16.0, -modelPosition.z);
    gl_PointSize = clamp(
      aScale * uPixelRatio * perspective * (1.0 + influence * 0.72 + uWarp * 1.6),
      1.0,
      11.0
    );
    vColor = color;
    vAlpha = mix(0.62, 1.0, smoothstep(-5.0, 5.0, particle.z));
  }
`;

const GALAXY_FRAGMENT_SHADER = `
  uniform float uOpacity;

  varying vec3 vColor;
  varying float vAlpha;

  void main() {
    vec2 centered = gl_PointCoord - vec2(0.5);
    float distanceFromCenter = length(centered) * 2.0;
    if (distanceFromCenter > 1.0) {
      discard;
    }

    float halo = pow(1.0 - distanceFromCenter, 2.15);
    float core = 1.0 - smoothstep(0.0, 0.23, distanceFromCenter);
    float alpha = (halo * 0.94 + core * 0.88) * vAlpha * uOpacity;
    vec3 illuminated = vColor * (1.08 + core * 2.15);
    gl_FragColor = vec4(illuminated, alpha);
  }
`;

const STAR_VERTEX_SHADER = `
  attribute float aScale;

  uniform float uPixelRatio;

  varying float vAlpha;

  void main() {
    vec4 modelPosition = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * modelPosition;
    gl_PointSize = clamp(aScale * uPixelRatio * (92.0 / max(14.0, -modelPosition.z)), 1.0, 5.5);
    vAlpha = 1.0 - smoothstep(18.0, 120.0, -modelPosition.z);
  }
`;

const STAR_FRAGMENT_SHADER = `
  uniform vec3 uColor;
  uniform float uOpacity;

  varying float vAlpha;

  void main() {
    float distanceFromCenter = length(gl_PointCoord - vec2(0.5)) * 2.0;
    if (distanceFromCenter > 1.0) {
      discard;
    }
    float glow = pow(1.0 - distanceFromCenter, 1.9);
    gl_FragColor = vec4(uColor * (0.75 + glow), glow * uOpacity * vAlpha);
  }
`;

interface StarLayer {
  points: THREE.Points<THREE.BufferGeometry, THREE.ShaderMaterial>;
  parallax: number;
  drift: number;
}

@Component({
  selector: 'nexus-universe',
  standalone: true,
  template: `
    <main
      class="universe"
      [class.ready]="introDone"
      [class.entering]="entering"
      (click)="skipIntro()"
      (keydown)="handleKey($event)"
      tabindex="0"
    >
      <canvas #canvas aria-hidden="true"></canvas>

      <header class="universe-header">
        <a class="wordmark" href="/" aria-label="NEXUS home">NEXUS</a>
        <div class="system-state"><i></i><span>PERSONAL UNIVERSE / LIVE</span></div>
      </header>

      <section class="intro-copy" [class.done]="introDone" aria-live="polite">
        <p>FORMING YOUR UNIVERSE</p>
        <span>Move to explore</span>
      </section>

      <button
        class="resume-node"
        [class.near]="proximity"
        type="button"
        (mouseenter)="setNodeFocus(true)"
        (mouseleave)="setNodeFocus(false)"
        (focus)="setNodeFocus(true)"
        (blur)="setNodeFocus(false)"
        (click)="enterResume($event)"
        aria-label="Open Resume Studio"
      >
        <span class="signal-ring signal-ring-outer" aria-hidden="true"></span>
        <span class="signal-ring signal-ring-inner" aria-hidden="true"></span>
        <span class="node-core" aria-hidden="true"></span>
        <span class="node-line" aria-hidden="true"></span>
        <span class="node-copy">
          <small>ACTIVE SYSTEM 01</small>
          <strong>Resume</strong>
          <em>Enter workspace</em>
        </span>
      </button>

      <div class="coordinate coordinate-left" aria-hidden="true">
        <span>NXS / GALAXY 01</span>
        <strong>Move through the field</strong>
      </div>
      <div class="coordinate coordinate-right" aria-hidden="true">
        <span>{{ quality }}</span>
        <strong>LIVE PARTICLE FIELD</strong>
      </div>

      <div class="entry-flash" aria-hidden="true"></div>
    </main>
  `,
  styles: [
    `
      :host {
        display: block;
        background: #010205;
      }

      .universe {
        position: relative;
        width: 100%;
        min-height: 100svh;
        overflow: hidden;
        background: #010205;
        color: #f4f9ff;
        cursor: crosshair;
        isolation: isolate;
      }

      canvas {
        position: absolute;
        inset: 0;
        z-index: 0;
        width: 100%;
        height: 100%;
      }

      .universe-header {
        position: absolute;
        top: clamp(1.35rem, 3vw, 2.7rem);
        left: clamp(1.35rem, 3.5vw, 3.6rem);
        right: clamp(1.35rem, 3.5vw, 3.6rem);
        z-index: 3;
        display: flex;
        align-items: center;
        justify-content: space-between;
        opacity: 0;
        transition: opacity 700ms ease 180ms;
      }

      .ready .universe-header {
        opacity: 1;
      }

      .wordmark {
        color: #f4f9ff;
        font-size: 0.9rem;
        font-weight: 800;
        letter-spacing: 0;
        text-decoration: none;
      }

      .system-state {
        display: flex;
        align-items: center;
        gap: 0.65rem;
        color: #788493;
        font-family: ui-monospace, SFMono-Regular, Consolas, monospace;
        font-size: 0.64rem;
        letter-spacing: 0;
      }

      .system-state i {
        width: 5px;
        height: 5px;
        border-radius: 50%;
        background: #69e8f4;
        box-shadow: 0 0 12px rgba(105, 232, 244, 0.88);
      }

      .intro-copy {
        position: absolute;
        left: 50%;
        bottom: 9vh;
        z-index: 4;
        translate: -50% 0;
        text-align: center;
        transition:
          opacity 420ms ease,
          visibility 420ms ease;
      }

      .intro-copy.done {
        opacity: 0;
        visibility: hidden;
      }

      .intro-copy p,
      .intro-copy span {
        display: block;
        margin: 0;
        font-family: ui-monospace, SFMono-Regular, Consolas, monospace;
        letter-spacing: 0;
      }

      .intro-copy p {
        color: #cbd9e2;
        font-size: 0.66rem;
      }

      .intro-copy span {
        margin-top: 0.45rem;
        color: #52606e;
        font-size: 0.58rem;
      }

      .resume-node {
        position: absolute;
        left: 62%;
        top: 47%;
        z-index: 4;
        width: 15rem;
        height: 15rem;
        translate: -50% -50%;
        border: 0;
        padding: 0;
        color: inherit;
        background: transparent;
        cursor: pointer;
        opacity: 0;
        scale: 0.72;
        transition:
          opacity 800ms ease 220ms,
          scale 850ms cubic-bezier(0.16, 1, 0.3, 1);
      }

      .ready .resume-node {
        opacity: 1;
        scale: 1;
      }

      .signal-ring,
      .node-core,
      .node-line {
        position: absolute;
        left: 50%;
        top: 50%;
        pointer-events: none;
      }

      .signal-ring {
        border: 1px solid rgba(112, 222, 242, 0.26);
        border-radius: 50%;
        opacity: 0.68;
        transition:
          border-color 280ms ease,
          opacity 280ms ease,
          scale 480ms cubic-bezier(0.16, 1, 0.3, 1);
      }

      .signal-ring-outer {
        width: 5.5rem;
        height: 5.5rem;
        margin: -2.75rem;
        border-style: dashed;
        animation: orbit 20s linear infinite;
      }

      .signal-ring-inner {
        width: 2.3rem;
        height: 2.3rem;
        margin: -1.15rem;
        animation: orbit-reverse 12s linear infinite;
      }

      .node-core {
        width: 7px;
        height: 7px;
        margin: -3.5px;
        border-radius: 50%;
        background: #e8fdff;
        box-shadow:
          0 0 12px #9ef3ff,
          0 0 34px rgba(42, 201, 255, 0.9),
          0 0 68px rgba(126, 72, 255, 0.56);
        transition:
          scale 300ms ease,
          box-shadow 300ms ease;
      }

      .node-line {
        width: 0;
        height: 1px;
        margin-left: 1.35rem;
        background: rgba(151, 231, 246, 0.64);
        opacity: 0;
        transition:
          width 420ms cubic-bezier(0.16, 1, 0.3, 1),
          opacity 220ms ease;
      }

      .node-copy {
        position: absolute;
        left: calc(50% + 6rem);
        top: calc(50% - 1.45rem);
        display: grid;
        min-width: 12rem;
        text-align: left;
        opacity: 0;
        translate: -0.9rem 0;
        transition:
          opacity 260ms ease,
          translate 420ms cubic-bezier(0.16, 1, 0.3, 1);
      }

      .near .node-copy,
      .resume-node:hover .node-copy,
      .resume-node:focus-visible .node-copy {
        opacity: 1;
        translate: 0 0;
      }

      .near .node-line,
      .resume-node:hover .node-line,
      .resume-node:focus-visible .node-line {
        width: 3.8rem;
        opacity: 1;
      }

      .near .signal-ring,
      .resume-node:hover .signal-ring,
      .resume-node:focus-visible .signal-ring {
        border-color: rgba(164, 241, 255, 0.78);
        opacity: 1;
        scale: 1.28;
      }

      .near .node-core,
      .resume-node:hover .node-core,
      .resume-node:focus-visible .node-core {
        scale: 1.65;
        box-shadow:
          0 0 18px #e8fdff,
          0 0 54px rgba(42, 201, 255, 1),
          0 0 90px rgba(227, 43, 184, 0.72);
      }

      .resume-node:focus-visible {
        outline: 1px solid rgba(164, 241, 255, 0.58);
        outline-offset: -2.8rem;
      }

      .node-copy small,
      .node-copy em {
        font-family: ui-monospace, SFMono-Regular, Consolas, monospace;
        font-style: normal;
        letter-spacing: 0;
      }

      .node-copy small {
        color: #74e7f6;
        font-size: 0.56rem;
      }

      .node-copy strong {
        margin-top: 0.25rem;
        font-size: 1.7rem;
        font-weight: 550;
        line-height: 1.05;
      }

      .node-copy em {
        margin-top: 0.3rem;
        color: #7b8797;
        font-size: 0.62rem;
      }

      .coordinate {
        position: absolute;
        bottom: clamp(1.35rem, 3vw, 2.7rem);
        z-index: 3;
        display: grid;
        gap: 0.2rem;
        opacity: 0;
        color: #536171;
        font-family: ui-monospace, SFMono-Regular, Consolas, monospace;
        font-size: 0.58rem;
        letter-spacing: 0;
        transition: opacity 700ms ease 250ms;
      }

      .ready .coordinate {
        opacity: 1;
      }

      .coordinate strong {
        color: #a8b5bf;
        font-size: 0.58rem;
        font-weight: 500;
      }

      .coordinate-left {
        left: clamp(1.35rem, 3.5vw, 3.6rem);
      }

      .coordinate-right {
        right: clamp(1.35rem, 3.5vw, 3.6rem);
        text-align: right;
      }

      .entry-flash {
        position: absolute;
        inset: 0;
        z-index: 7;
        pointer-events: none;
        background: #e7fbff;
        opacity: 0;
      }

      .entering .entry-flash {
        animation: entry-flash 1.25s cubic-bezier(0.72, 0, 0.18, 1) forwards;
      }

      .entering .universe-header,
      .entering .coordinate,
      .entering .node-copy {
        opacity: 0;
        transition-delay: 0ms;
      }

      @keyframes orbit {
        to {
          rotate: 360deg;
        }
      }

      @keyframes orbit-reverse {
        to {
          rotate: -360deg;
        }
      }

      @keyframes entry-flash {
        0%,
        52% {
          opacity: 0;
        }
        72% {
          opacity: 0.18;
        }
        90% {
          opacity: 0.92;
        }
        100% {
          opacity: 1;
        }
      }

      @media (max-width: 760px) {
        .system-state {
          display: none;
        }

        .resume-node {
          left: 57%;
          top: 48%;
          width: 12rem;
          height: 12rem;
        }

        .node-copy {
          left: 50%;
          top: calc(50% + 4.6rem);
          min-width: 11rem;
          translate: -50% -0.5rem;
          text-align: center;
        }

        .near .node-copy,
        .resume-node:hover .node-copy,
        .resume-node:focus-visible .node-copy {
          translate: -50% 0;
        }

        .node-line {
          display: none;
        }

        .coordinate strong {
          display: none;
        }
      }

      @media (prefers-reduced-motion: reduce) {
        .signal-ring {
          animation: none;
        }

        .entry-flash {
          display: none;
        }
      }
    `,
  ],
})
export class UniverseComponent implements AfterViewInit, OnDestroy {
  @ViewChild('canvas', { static: true }) private canvas?: ElementRef<HTMLCanvasElement>;

  protected introDone = false;
  protected entering = false;
  protected proximity = false;
  protected quality = this.prefersAdaptiveQuality() ? 'ADAPTIVE' : 'HIGH FIDELITY';

  private readonly router = inject(Router);
  private readonly zone = inject(NgZone);
  private readonly changeDetector = inject(ChangeDetectorRef);
  private readonly pointer = new THREE.Vector2();
  private readonly pointerTarget = new THREE.Vector2();
  private readonly pointerWorld = new THREE.Vector2(60, 60);
  private readonly pointerWorldTarget = new THREE.Vector2(60, 60);
  private readonly starLayers: StarLayer[] = [];

  private renderer?: THREE.WebGLRenderer;
  private scene?: THREE.Scene;
  private camera?: THREE.PerspectiveCamera;
  private galaxy?: THREE.Points<THREE.BufferGeometry, THREE.ShaderMaterial>;
  private galaxyGroup?: THREE.Group;
  private introPoints?: THREE.Points<THREE.BufferGeometry, THREE.PointsMaterial>;
  private introFrom?: Float32Array;
  private introTarget?: Float32Array;
  private introScatter?: Float32Array;
  private animationId = 0;
  private introStartedAt = 0;
  private entryStartedAt = 0;
  private entryTimer?: number;
  private pointerEnergy = 0;
  private pointerEnergyTarget = 0;
  private lastPointerX = 0;
  private lastPointerY = 0;
  private readonly onResize = () => this.resize();
  private readonly onPointerMove = (event: PointerEvent) => this.updatePointer(event);
  private readonly onPointerLeave = () => this.releasePointer();

  ngAfterViewInit() {
    const canvas = this.canvas?.nativeElement;
    if (!canvas) {
      return;
    }

    const lowPower = this.prefersAdaptiveQuality();
    const pixelRatio = Math.min(window.devicePixelRatio, lowPower ? 1.15 : 1.7);

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(54, window.innerWidth / window.innerHeight, 0.1, 320);
    this.camera.position.set(0, 0, 60);

    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: !lowPower, alpha: false });
    this.renderer.setPixelRatio(pixelRatio);
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setClearColor(0x010205, 1);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    this.addStarLayer(lowPower ? 420 : 950, 0xb8d5e8, 0.52, 0.18, -24, pixelRatio);
    this.addStarLayer(lowPower ? 300 : 760, 0x3164ad, 0.78, 0.42, -5, pixelRatio);
    this.addStarLayer(lowPower ? 140 : 360, 0x7a4fd0, 1.05, 0.82, 17, pixelRatio);

    this.galaxyGroup = new THREE.Group();
    this.galaxy = this.createGalaxy(lowPower ? 11800 : 32000, pixelRatio);
    this.galaxyGroup.add(this.galaxy);
    this.scene.add(this.galaxyGroup);
    this.createIntroWord(lowPower ? 720 : 1450);

    window.addEventListener('resize', this.onResize);
    window.addEventListener('pointermove', this.onPointerMove, { passive: true });
    document.addEventListener('pointerleave', this.onPointerLeave);
    this.introStartedAt = performance.now();
    this.zone.runOutsideAngular(() => this.animate());
  }

  protected handleKey(event: KeyboardEvent) {
    if (event.key !== 'Tab') {
      this.skipIntro();
    }
  }

  protected skipIntro() {
    if (!this.introDone) {
      this.finishIntro();
    }
  }

  protected setNodeFocus(focused: boolean) {
    this.proximity = focused;
    this.pointerEnergyTarget = focused ? 1.45 : Math.min(this.pointerEnergyTarget, 0.88);
  }

  protected enterResume(event: MouseEvent) {
    event.stopPropagation();
    if (this.entering) {
      return;
    }

    this.finishIntro();
    this.entering = true;
    this.entryStartedAt = performance.now();
    this.pointerEnergyTarget = 2.2;
    this.changeDetector.detectChanges();
    const duration = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 120 : 1250;
    this.entryTimer = window.setTimeout(() => {
      void this.router.navigateByUrl('/resume');
    }, duration);
  }

  ngOnDestroy() {
    cancelAnimationFrame(this.animationId);
    window.clearTimeout(this.entryTimer);
    window.removeEventListener('resize', this.onResize);
    window.removeEventListener('pointermove', this.onPointerMove);
    document.removeEventListener('pointerleave', this.onPointerLeave);
    this.scene?.traverse((object) => {
      const renderable = object as THREE.Points;
      renderable.geometry?.dispose();
      const material = renderable.material;
      if (Array.isArray(material)) {
        material.forEach((item) => item.dispose());
      } else {
        material?.dispose();
      }
    });
    this.renderer?.dispose();
  }

  private addStarLayer(
    count: number,
    color: number,
    size: number,
    parallax: number,
    depthOffset: number,
    pixelRatio: number,
  ) {
    if (!this.scene) {
      return;
    }

    const positions = new Float32Array(count * 3);
    const scales = new Float32Array(count);
    for (let index = 0; index < count; index += 1) {
      const offset = index * 3;
      positions[offset] = (Math.random() - 0.5) * 145;
      positions[offset + 1] = (Math.random() - 0.5) * 88;
      positions[offset + 2] = (Math.random() - 0.5) * 34 + depthOffset;
      scales[index] = size * (0.55 + Math.random() * 1.45);
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('aScale', new THREE.BufferAttribute(scales, 1));
    const material = new THREE.ShaderMaterial({
      vertexShader: STAR_VERTEX_SHADER,
      fragmentShader: STAR_FRAGMENT_SHADER,
      uniforms: {
        uColor: { value: new THREE.Color(color) },
        uOpacity: { value: parallax < 0.3 ? 0.52 : 0.72 },
        uPixelRatio: { value: pixelRatio },
      },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const points = new THREE.Points(geometry, material);
    this.starLayers.push({ points, parallax, drift: (Math.random() + 0.45) * 0.08 });
    this.scene.add(points);
  }

  private createGalaxy(count: number, pixelRatio: number) {
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const scales = new Float32Array(count);
    const phases = new Float32Array(count);
    const coreColor = new THREE.Color(0xc8fbff);
    const cyanColor = new THREE.Color(0x13cffa);
    const blueColor = new THREE.Color(0x1756ff);
    const violetColor = new THREE.Color(0x7445e8);
    const magentaColor = new THREE.Color(0xed329f);

    for (let index = 0; index < count; index += 1) {
      const offset = index * 3;
      const zone = Math.random();
      const inCore = zone < 0.2;
      const inArm = zone < 0.88;
      const radius = inCore
        ? Math.pow(Math.random(), 1.85) * 8.5
        : Math.pow(Math.random(), inArm ? 0.68 : 0.44) * (inArm ? 33 : 39);
      const arm = (index % 4) * (Math.PI * 0.5);
      const armWidth = 0.11 + radius * 0.013;
      const angle =
        arm +
        radius * 0.355 +
        this.gaussianRandom() * (inCore ? 0.75 : inArm ? armWidth : 1.8) +
        (inArm ? 0 : Math.random() * Math.PI * 2);
      const radialNoise = this.gaussianRandom() * (0.18 + radius * 0.018);
      const adjustedRadius = radius + radialNoise;
      const verticalSpread = 0.48 + Math.min(4.2, radius * 0.105);

      positions[offset] = Math.cos(angle) * adjustedRadius;
      positions[offset + 1] =
        Math.sin(angle) * adjustedRadius * 0.58 + this.gaussianRandom() * (0.16 + radius * 0.01);
      positions[offset + 2] = this.gaussianRandom() * verticalSpread;

      const band = (Math.sin(angle * 2.2 - radius * 0.29) + 1) * 0.5;
      const color = new THREE.Color();
      if (radius < 4.5) {
        color.copy(coreColor).lerp(cyanColor, radius / 5.5);
      } else if (band > 0.68) {
        color.copy(magentaColor).lerp(violetColor, Math.random() * 0.48);
      } else if (band < 0.25) {
        color.copy(cyanColor).lerp(blueColor, Math.random() * 0.66);
      } else {
        color.copy(blueColor).lerp(violetColor, band * 0.74);
      }
      const brightness = 0.72 + Math.random() * 0.4;
      colors[offset] = color.r * brightness;
      colors[offset + 1] = color.g * brightness;
      colors[offset + 2] = color.b * brightness;

      const brightSpark = Math.random() > 0.978;
      scales[index] = brightSpark ? 3.2 + Math.random() * 2.6 : 0.58 + Math.random() * 1.55;
      phases[index] = Math.random() * Math.PI * 2;
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geometry.setAttribute('aScale', new THREE.BufferAttribute(scales, 1));
    geometry.setAttribute('aPhase', new THREE.BufferAttribute(phases, 1));

    const material = new THREE.ShaderMaterial({
      vertexShader: GALAXY_VERTEX_SHADER,
      fragmentShader: GALAXY_FRAGMENT_SHADER,
      uniforms: {
        uTime: { value: 0 },
        uPixelRatio: { value: pixelRatio },
        uPointer: { value: this.pointerWorld },
        uInteraction: { value: 0 },
        uWarp: { value: 0 },
        uOpacity: { value: 0.1 },
      },
      vertexColors: true,
      transparent: true,
      depthWrite: false,
      depthTest: true,
      blending: THREE.AdditiveBlending,
    });

    const points = new THREE.Points(geometry, material);
    points.frustumCulled = false;
    return points;
  }

  private createIntroWord(maxPoints: number) {
    if (!this.scene) {
      return;
    }

    const sampler = document.createElement('canvas');
    sampler.width = 900;
    sampler.height = 240;
    const context = sampler.getContext('2d', { willReadFrequently: true });
    if (!context) {
      this.finishIntro();
      return;
    }

    context.fillStyle = '#ffffff';
    context.font = '800 172px Arial, sans-serif';
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillText('NEXUS', sampler.width / 2, sampler.height / 2);
    const pixels = context.getImageData(0, 0, sampler.width, sampler.height).data;
    const samples: Array<[number, number]> = [];
    for (let y = 0; y < sampler.height; y += 5) {
      for (let x = 0; x < sampler.width; x += 5) {
        if (pixels[(y * sampler.width + x) * 4 + 3] > 160) {
          samples.push([x, y]);
        }
      }
    }

    const count = Math.min(maxPoints, samples.length);
    this.introFrom = new Float32Array(count * 3);
    this.introTarget = new Float32Array(count * 3);
    this.introScatter = new Float32Array(count * 3);
    const positions = new Float32Array(count * 3);

    for (let index = 0; index < count; index += 1) {
      const [x, y] = samples[Math.floor((index / count) * samples.length)];
      const offset = index * 3;
      this.introTarget[offset] = (x / sampler.width - 0.5) * 51;
      this.introTarget[offset + 1] = (0.5 - y / sampler.height) * 13.5;
      this.introTarget[offset + 2] = (Math.random() - 0.5) * 1.4;
      this.introFrom[offset] = (Math.random() - 0.5) * 100;
      this.introFrom[offset + 1] = (Math.random() - 0.5) * 62;
      this.introFrom[offset + 2] = (Math.random() - 0.5) * 38;
      this.introScatter[offset] = this.introTarget[offset] * 1.35 + (Math.random() - 0.5) * 24;
      this.introScatter[offset + 1] =
        this.introTarget[offset + 1] * 1.35 + (Math.random() - 0.5) * 18;
      this.introScatter[offset + 2] = -18 - Math.random() * 28;
      positions[offset] = this.introFrom[offset];
      positions[offset + 1] = this.introFrom[offset + 1];
      positions[offset + 2] = this.introFrom[offset + 2];
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    this.introPoints = new THREE.Points(
      geometry,
      new THREE.PointsMaterial({
        color: 0xdff9ff,
        size: 0.18,
        transparent: true,
        opacity: 0.92,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    );
    this.introPoints.frustumCulled = false;
    this.scene.add(this.introPoints);
  }

  private animate = (timestamp = performance.now()) => {
    if (!this.renderer || !this.scene || !this.camera || !this.galaxy || !this.galaxyGroup) {
      return;
    }

    const introElapsed = timestamp - this.introStartedAt;
    const revealProgress = this.introDone ? 1 : Math.min(1, introElapsed / 1850);
    const revealEase = 1 - Math.pow(1 - revealProgress, 3);
    this.animateIntro(introElapsed);

    this.pointer.lerp(this.pointerTarget, 0.07);
    this.pointerWorld.lerp(this.pointerWorldTarget, 0.12);
    this.pointerEnergy += (this.pointerEnergyTarget - this.pointerEnergy) * 0.075;
    this.pointerEnergyTarget *= 0.992;

    const time = timestamp * 0.001;
    const warpProgress = this.entering ? Math.min(1, (timestamp - this.entryStartedAt) / 1250) : 0;
    const warpEase = warpProgress * warpProgress * (3 - 2 * warpProgress);
    const uniforms = this.galaxy.material.uniforms;
    uniforms['uTime'].value = time;
    uniforms['uInteraction'].value = Math.min(2.2, this.pointerEnergy);
    uniforms['uWarp'].value = warpEase;
    uniforms['uOpacity'].value = 0.18 + revealEase * 0.82;

    const baseScale = 0.68 + revealEase * 0.32;
    this.galaxyGroup.scale.setScalar(baseScale * (1 + warpEase * 4.6));
    this.galaxyGroup.rotation.z = -0.08 + time * 0.018 + this.pointer.x * 0.028;
    this.galaxyGroup.rotation.x = -0.07 + this.pointer.y * 0.045;
    this.galaxyGroup.position.x += (-this.pointer.x * 1.25 - this.galaxyGroup.position.x) * 0.038;
    this.galaxyGroup.position.y += (-this.pointer.y * 0.72 - this.galaxyGroup.position.y) * 0.038;

    for (const layer of this.starLayers) {
      layer.points.rotation.z = time * layer.drift * 0.035;
      layer.points.position.x +=
        (-this.pointer.x * layer.parallax * 3.5 - layer.points.position.x) * 0.025;
      layer.points.position.y +=
        (-this.pointer.y * layer.parallax * 2.4 - layer.points.position.y) * 0.025;
      if (this.entering) {
        layer.points.scale.setScalar(1 + warpEase * (2.5 + layer.parallax * 3.8));
      }
    }

    if (!this.entering) {
      this.camera.position.x += (this.pointer.x * 1.05 - this.camera.position.x) * 0.03;
      this.camera.position.y += (-this.pointer.y * 0.72 - this.camera.position.y) * 0.03;
      this.camera.position.z += (60 - this.camera.position.z) * 0.05;
    } else {
      this.camera.position.z = 60 - warpEase * 48;
    }

    this.renderer.render(this.scene, this.camera);
    this.animationId = requestAnimationFrame(this.animate);
  };

  private animateIntro(elapsed: number) {
    if (
      this.introDone ||
      !this.introPoints ||
      !this.introFrom ||
      !this.introTarget ||
      !this.introScatter
    ) {
      return;
    }

    const positions = this.introPoints.geometry.getAttribute('position') as THREE.BufferAttribute;
    const array = positions.array as Float32Array;
    const gathering = Math.min(1, elapsed / 720);
    const gatherEase = 1 - Math.pow(1 - gathering, 3);
    const dissolving = Math.max(0, Math.min(1, (elapsed - 980) / 820));
    const dissolveEase = dissolving * dissolving;

    for (let index = 0; index < array.length; index += 1) {
      const formed = THREE.MathUtils.lerp(
        this.introFrom[index],
        this.introTarget[index],
        gatherEase,
      );
      array[index] = THREE.MathUtils.lerp(formed, this.introScatter[index], dissolveEase);
    }
    positions.needsUpdate = true;
    this.introPoints.material.opacity = 0.92 * (1 - dissolving);
    if (elapsed >= 1850) {
      this.finishIntro();
    }
  }

  private finishIntro() {
    if (this.introDone) {
      return;
    }

    this.zone.run(() => {
      this.introDone = true;
      this.changeDetector.detectChanges();
    });
    if (this.introPoints && this.scene) {
      this.scene.remove(this.introPoints);
      this.introPoints.geometry.dispose();
      this.introPoints.material.dispose();
      this.introPoints = undefined;
    }
  }

  private updatePointer(event: PointerEvent) {
    const normalizedX = (event.clientX / window.innerWidth) * 2 - 1;
    const normalizedY = -((event.clientY / window.innerHeight) * 2 - 1);
    this.pointerTarget.set(normalizedX, normalizedY);
    this.pointerWorldTarget.set(normalizedX * 31, normalizedY * 18);

    const movement = Math.hypot(
      event.clientX - this.lastPointerX,
      event.clientY - this.lastPointerY,
    );
    this.lastPointerX = event.clientX;
    this.lastPointerY = event.clientY;
    this.pointerEnergyTarget = Math.min(1.65, 0.62 + movement * 0.026);

    const nodeX = window.innerWidth * (window.innerWidth < 760 ? 0.57 : 0.62);
    const nodeY = window.innerHeight * (window.innerWidth < 760 ? 0.48 : 0.47);
    const isNear = Math.hypot(event.clientX - nodeX, event.clientY - nodeY) < 230;
    if (isNear !== this.proximity) {
      this.zone.run(() => {
        this.proximity = isNear;
      });
    }
  }

  private releasePointer() {
    this.pointerTarget.set(0, 0);
    this.pointerWorldTarget.set(60, 60);
    this.pointerEnergyTarget = 0;
    if (this.proximity) {
      this.zone.run(() => {
        this.proximity = false;
      });
    }
  }

  private resize() {
    if (!this.camera || !this.renderer || !this.galaxy) {
      return;
    }

    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    const lowPower = this.prefersAdaptiveQuality();
    const pixelRatio = Math.min(window.devicePixelRatio, lowPower ? 1.15 : 1.7);
    this.renderer.setPixelRatio(pixelRatio);
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.galaxy.material.uniforms['uPixelRatio'].value = pixelRatio;
    for (const layer of this.starLayers) {
      layer.points.material.uniforms['uPixelRatio'].value = pixelRatio;
    }
  }

  private gaussianRandom() {
    const first = Math.max(Number.EPSILON, Math.random());
    const second = Math.random();
    return Math.sqrt(-2 * Math.log(first)) * Math.cos(Math.PI * 2 * second);
  }

  private prefersAdaptiveQuality() {
    return (
      window.innerWidth < 760 ||
      window.matchMedia('(prefers-reduced-motion: reduce)').matches ||
      (navigator.hardwareConcurrency ?? 8) <= 4
    );
  }
}
