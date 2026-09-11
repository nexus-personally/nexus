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
        <div class="system-state"><i></i><span>PERSONAL SPACE / ONLINE</span></div>
      </header>

      <section class="intro-copy" [class.done]="introDone" aria-live="polite">
        <p>INITIALIZING PERSONAL UNIVERSE</p>
        <span>Click or press any key to skip</span>
      </section>

      <button
        class="resume-node"
        [class.near]="proximity"
        type="button"
        (mouseenter)="proximity = true"
        (mouseleave)="proximity = false"
        (focus)="proximity = true"
        (blur)="proximity = false"
        (click)="enterResume($event)"
        aria-label="Open Resume Studio"
      >
        <span class="orbit orbit-outer" aria-hidden="true"></span>
        <span class="orbit orbit-inner" aria-hidden="true"></span>
        <span class="node-core" aria-hidden="true"></span>
        <span class="node-copy">
          <small>ACTIVE NODE 01</small>
          <strong>Resume</strong>
          <em>Tech Resume Studio</em>
        </span>
      </button>

      <footer class="universe-footer">
        <div><span>NXS / 01</span><strong>ONE ACTIVE SYSTEM</strong></div>
        <p>Move toward the signal</p>
        <div class="quality">
          <span>{{ quality }}</span
          ><strong>ADAPTIVE FIELD</strong>
        </div>
      </footer>

      <div class="entry-flash" aria-hidden="true"></div>
    </main>
  `,
  styles: [
    `
      :host {
        display: block;
        background: #05070a;
      }

      .universe {
        position: relative;
        width: 100%;
        min-height: 100svh;
        overflow: hidden;
        background: #05070a;
        color: #f2f5f4;
        cursor: crosshair;
        isolation: isolate;
      }

      .universe::after {
        content: '';
        position: absolute;
        inset: 0;
        z-index: 1;
        pointer-events: none;
        background-image:
          linear-gradient(rgba(255, 255, 255, 0.018) 1px, transparent 1px),
          linear-gradient(90deg, rgba(255, 255, 255, 0.018) 1px, transparent 1px);
        background-size: 64px 64px;
        mask-image: linear-gradient(to bottom, transparent, #000 25%, #000 75%, transparent);
      }

      canvas {
        position: absolute;
        inset: 0;
        width: 100%;
        height: 100%;
        z-index: 0;
      }

      .universe-header,
      .universe-footer {
        position: absolute;
        left: clamp(1.25rem, 3.5vw, 3.5rem);
        right: clamp(1.25rem, 3.5vw, 3.5rem);
        z-index: 3;
        display: flex;
        align-items: center;
        justify-content: space-between;
        opacity: 0;
        transition: opacity 700ms ease 200ms;
      }

      .ready .universe-header,
      .ready .universe-footer {
        opacity: 1;
      }

      .universe-header {
        top: clamp(1.25rem, 3vw, 2.5rem);
      }

      .wordmark {
        color: #f2f5f4;
        font-size: 0.95rem;
        font-weight: 800;
        letter-spacing: 0.18em;
        text-decoration: none;
      }

      .system-state {
        display: flex;
        align-items: center;
        gap: 0.65rem;
        color: #8a969d;
        font-family: ui-monospace, SFMono-Regular, Consolas, monospace;
        font-size: 0.66rem;
      }

      .system-state i {
        width: 5px;
        height: 5px;
        border-radius: 50%;
        background: #63d7c1;
        box-shadow: 0 0 12px #63d7c1;
      }

      .intro-copy {
        position: absolute;
        left: 50%;
        bottom: 12vh;
        z-index: 4;
        translate: -50% 0;
        text-align: center;
        transition:
          opacity 500ms ease,
          visibility 500ms ease;
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
        letter-spacing: 0.12em;
      }

      .intro-copy p {
        color: #d8e3e5;
        font-size: 0.68rem;
      }

      .intro-copy span {
        margin-top: 0.55rem;
        color: #59656d;
        font-size: 0.6rem;
      }

      .resume-node {
        position: absolute;
        left: 69%;
        top: 46%;
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
        scale: 0.8;
        transition:
          opacity 900ms ease 350ms,
          scale 900ms cubic-bezier(0.16, 1, 0.3, 1);
      }

      .ready .resume-node {
        opacity: 1;
        scale: 1;
      }

      .orbit,
      .node-core {
        position: absolute;
        left: 50%;
        top: 50%;
        border-radius: 50%;
        pointer-events: none;
      }

      .orbit {
        border: 1px solid rgba(112, 211, 222, 0.18);
        transition:
          border-color 300ms ease,
          scale 500ms cubic-bezier(0.16, 1, 0.3, 1);
      }

      .orbit-outer {
        width: 11rem;
        height: 11rem;
        margin: -5.5rem;
        border-style: dashed;
        animation: orbit 24s linear infinite;
      }

      .orbit-inner {
        width: 5.25rem;
        height: 5.25rem;
        margin: -2.625rem;
        animation: orbit-reverse 14s linear infinite;
      }

      .node-core {
        width: 9px;
        height: 9px;
        margin: -4.5px;
        background: #dafaff;
        box-shadow:
          0 0 14px #8de8f0,
          0 0 42px rgba(63, 186, 200, 0.72);
        transition:
          scale 350ms ease,
          box-shadow 350ms ease;
      }

      .node-copy {
        position: absolute;
        left: calc(50% + 4.2rem);
        top: calc(50% - 0.8rem);
        display: grid;
        min-width: 13rem;
        text-align: left;
        opacity: 0;
        translate: -0.75rem 0;
        transition:
          opacity 300ms ease,
          translate 400ms cubic-bezier(0.16, 1, 0.3, 1);
      }

      .near .node-copy,
      .resume-node:hover .node-copy,
      .resume-node:focus-visible .node-copy {
        opacity: 1;
        translate: 0 0;
      }

      .near .orbit,
      .resume-node:hover .orbit,
      .resume-node:focus-visible .orbit {
        border-color: rgba(137, 231, 239, 0.55);
        scale: 1.13;
      }

      .near .node-core,
      .resume-node:hover .node-core,
      .resume-node:focus-visible .node-core {
        scale: 1.55;
        box-shadow:
          0 0 20px #d6fbff,
          0 0 70px rgba(63, 186, 200, 0.88);
      }

      .resume-node:focus-visible {
        outline: 1px solid rgba(137, 231, 239, 0.75);
        outline-offset: -1.5rem;
      }

      .node-copy small,
      .node-copy em {
        font-family: ui-monospace, SFMono-Regular, Consolas, monospace;
        font-style: normal;
        letter-spacing: 0.08em;
      }

      .node-copy small {
        color: #72d8e3;
        font-size: 0.6rem;
      }

      .node-copy strong {
        margin-top: 0.35rem;
        font-size: 2rem;
        font-weight: 650;
      }

      .node-copy em {
        margin-top: 0.2rem;
        color: #78858d;
        font-size: 0.65rem;
      }

      .universe-footer {
        bottom: clamp(1.25rem, 3vw, 2.5rem);
        align-items: end;
        color: #76828a;
        font-family: ui-monospace, SFMono-Regular, Consolas, monospace;
        font-size: 0.62rem;
      }

      .universe-footer div {
        display: grid;
        gap: 0.2rem;
      }

      .universe-footer strong {
        color: #cbd3d4;
        font-size: 0.62rem;
        font-weight: 500;
      }

      .universe-footer p {
        margin: 0;
        color: #4f5a61;
      }

      .quality {
        text-align: right;
      }

      .entry-flash {
        position: absolute;
        inset: 0;
        z-index: 6;
        pointer-events: none;
        background: #dffcff;
        opacity: 0;
      }

      .entering .entry-flash {
        animation: entry-flash 1.25s cubic-bezier(0.7, 0, 0.2, 1) forwards;
      }

      .entering .universe-header,
      .entering .universe-footer,
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
        62% {
          opacity: 0;
        }
        78% {
          opacity: 0.9;
        }
        100% {
          opacity: 1;
        }
      }

      @media (max-width: 760px) {
        .system-state,
        .universe-footer p {
          display: none;
        }

        .resume-node {
          left: 54%;
          top: 48%;
          width: 12rem;
          height: 12rem;
        }

        .node-copy {
          left: 50%;
          top: calc(50% + 4.8rem);
          min-width: 12rem;
          translate: -50% -0.5rem;
          text-align: center;
        }

        .near .node-copy,
        .resume-node:hover .node-copy,
        .resume-node:focus-visible .node-copy {
          translate: -50% 0;
        }
      }

      @media (prefers-reduced-motion: reduce) {
        .orbit {
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
  private renderer?: THREE.WebGLRenderer;
  private scene?: THREE.Scene;
  private camera?: THREE.PerspectiveCamera;
  private galaxy?: THREE.Group;
  private introPoints?: THREE.Points<THREE.BufferGeometry, THREE.PointsMaterial>;
  private introFrom?: Float32Array;
  private introTarget?: Float32Array;
  private introScatter?: Float32Array;
  private animationId = 0;
  private introStartedAt = 0;
  private entryStartedAt = 0;
  private entryTimer?: number;
  private pointerX = 0;
  private pointerY = 0;
  private readonly onResize = () => this.resize();
  private readonly onPointerMove = (event: PointerEvent) => this.updatePointer(event);

  ngAfterViewInit() {
    const canvas = this.canvas?.nativeElement;
    if (!canvas) {
      return;
    }

    const lowPower = this.prefersAdaptiveQuality();

    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.FogExp2(0x05070a, 0.012);
    this.camera = new THREE.PerspectiveCamera(58, window.innerWidth / window.innerHeight, 0.1, 500);
    this.camera.position.set(0, 0, 68);

    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: !lowPower, alpha: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, lowPower ? 1 : 1.6));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setClearColor(0x05070a, 1);

    this.scene.add(this.createField(lowPower ? 550 : 1100, 0xc5d4d8, 0.1, 180, 130));
    this.scene.add(this.createField(lowPower ? 260 : 620, 0x4d8792, 0.18, 130, 80));
    this.galaxy = this.createGalaxy(lowPower ? 650 : 1500);
    this.scene.add(this.galaxy);
    this.createIntroWord(lowPower ? 850 : 1700);

    window.addEventListener('resize', this.onResize);
    window.addEventListener('pointermove', this.onPointerMove, { passive: true });
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

  protected enterResume(event: MouseEvent) {
    event.stopPropagation();
    if (this.entering) {
      return;
    }

    this.finishIntro();
    this.entering = true;
    this.entryStartedAt = performance.now();
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
    this.scene?.traverse((object) => {
      const renderable = object as THREE.Mesh;
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

  private createField(count: number, color: number, size: number, spread: number, depth: number) {
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i += 1) {
      const offset = i * 3;
      positions[offset] = (Math.random() - 0.5) * spread;
      positions[offset + 1] = (Math.random() - 0.5) * spread * 0.62;
      positions[offset + 2] = (Math.random() - 0.5) * depth;
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    return new THREE.Points(
      geometry,
      new THREE.PointsMaterial({
        color,
        size,
        transparent: true,
        opacity: 0.72,
        sizeAttenuation: true,
      }),
    );
  }

  private createGalaxy(count: number) {
    const group = new THREE.Group();
    group.position.set(18, 0, 3);
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const cool = new THREE.Color(0x71d7e2);
    const warm = new THREE.Color(0xd7b765);

    for (let i = 0; i < count; i += 1) {
      const offset = i * 3;
      const radius = Math.sqrt(Math.random()) * 22;
      const arm = (i % 3) * ((Math.PI * 2) / 3);
      const angle = arm + radius * 0.42 + (Math.random() - 0.5) * 0.8;
      positions[offset] = Math.cos(angle) * radius;
      positions[offset + 1] = Math.sin(angle) * radius * 0.38;
      positions[offset + 2] = (Math.random() - 0.5) * (5 + radius * 0.16);
      const color = cool.clone().lerp(warm, Math.max(0, 1 - radius / 8) * Math.random());
      colors[offset] = color.r;
      colors[offset + 1] = color.g;
      colors[offset + 2] = color.b;
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    group.add(
      new THREE.Points(
        geometry,
        new THREE.PointsMaterial({
          size: 0.24,
          vertexColors: true,
          transparent: true,
          opacity: 0.9,
          depthWrite: false,
        }),
      ),
    );

    return group;
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

    for (let i = 0; i < count; i += 1) {
      const [x, y] = samples[Math.floor((i / count) * samples.length)];
      const offset = i * 3;
      this.introTarget[offset] = (x / sampler.width - 0.5) * 58;
      this.introTarget[offset + 1] = (0.5 - y / sampler.height) * 15.5;
      this.introTarget[offset + 2] = (Math.random() - 0.5) * 1.5;
      this.introFrom[offset] = (Math.random() - 0.5) * 120;
      this.introFrom[offset + 1] = (Math.random() - 0.5) * 70;
      this.introFrom[offset + 2] = (Math.random() - 0.5) * 45;
      this.introScatter[offset] = this.introTarget[offset] * 1.9 + (Math.random() - 0.5) * 30;
      this.introScatter[offset + 1] =
        this.introTarget[offset + 1] * 1.9 + (Math.random() - 0.5) * 24;
      this.introScatter[offset + 2] = -24 - Math.random() * 35;
      positions[offset] = this.introFrom[offset];
      positions[offset + 1] = this.introFrom[offset + 1];
      positions[offset + 2] = this.introFrom[offset + 2];
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    this.introPoints = new THREE.Points(
      geometry,
      new THREE.PointsMaterial({ color: 0xe8f8fa, size: 0.2, transparent: true, opacity: 0.95 }),
    );
    this.introPoints.frustumCulled = false;
    this.scene.add(this.introPoints);
  }

  private animate = (timestamp = performance.now()) => {
    if (!this.renderer || !this.scene || !this.camera) {
      return;
    }

    const elapsed = timestamp - this.introStartedAt;
    if (
      !this.introDone &&
      this.introPoints &&
      this.introFrom &&
      this.introTarget &&
      this.introScatter
    ) {
      const positions = this.introPoints.geometry.getAttribute('position') as THREE.BufferAttribute;
      const array = positions.array as Float32Array;
      const gathering = Math.min(1, elapsed / 1050);
      const gatherEase = 1 - Math.pow(1 - gathering, 3);
      const dissolving = Math.max(0, Math.min(1, (elapsed - 1500) / 1050));
      const dissolveEase = dissolving * dissolving;
      for (let i = 0; i < array.length; i += 1) {
        const formed = THREE.MathUtils.lerp(this.introFrom[i], this.introTarget[i], gatherEase);
        array[i] = THREE.MathUtils.lerp(formed, this.introScatter[i], dissolveEase);
      }
      positions.needsUpdate = true;
      this.introPoints.material.opacity = 0.95 * (1 - dissolving);
      if (elapsed >= 2600) {
        this.finishIntro();
      }
    }

    const time = timestamp * 0.00012;
    if (this.galaxy) {
      this.galaxy.rotation.z = time * 0.34 + this.pointerX * 0.045;
      this.galaxy.rotation.x = -0.18 + this.pointerY * 0.08;
      if (this.entering) {
        const progress = Math.min(1, (timestamp - this.entryStartedAt) / 1250);
        const eased = progress * progress * (3 - 2 * progress);
        this.galaxy.scale.setScalar(1 + eased * 5.5);
        this.camera.position.z = 68 - eased * 55;
      }
    }

    if (!this.entering) {
      this.camera.position.x += (this.pointerX * 2.4 - this.camera.position.x) * 0.035;
      this.camera.position.y += (-this.pointerY * 1.6 - this.camera.position.y) * 0.035;
    }

    this.scene.rotation.y = Math.sin(time) * 0.012;
    this.renderer.render(this.scene, this.camera);
    this.animationId = requestAnimationFrame(this.animate);
  };

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
    this.pointerX = (event.clientX / window.innerWidth) * 2 - 1;
    this.pointerY = (event.clientY / window.innerHeight) * 2 - 1;
    const nodeX = window.innerWidth * (window.innerWidth < 760 ? 0.54 : 0.69);
    const nodeY = window.innerHeight * (window.innerWidth < 760 ? 0.48 : 0.46);
    const isNear = Math.hypot(event.clientX - nodeX, event.clientY - nodeY) < 260;
    if (isNear !== this.proximity) {
      this.zone.run(() => {
        this.proximity = isNear;
      });
    }
  }

  private resize() {
    if (!this.camera || !this.renderer) {
      return;
    }

    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  private prefersAdaptiveQuality() {
    return (
      window.innerWidth < 760 ||
      window.matchMedia('(prefers-reduced-motion: reduce)').matches ||
      (navigator.hardwareConcurrency ?? 8) <= 4
    );
  }
}
