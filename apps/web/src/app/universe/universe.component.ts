import { AfterViewInit, Component, ElementRef, OnDestroy, ViewChild, inject } from '@angular/core';
import { Router } from '@angular/router';
import * as THREE from 'three';

@Component({
  selector: 'nexus-universe',
  standalone: true,
  template: `
    <main class="universe" (click)="skipIntro()" (keydown)="skipIntro()" tabindex="0">
      <canvas #canvas aria-label="NEXUS particle universe"></canvas>
      <section class="intro" [class.done]="introDone">
        <p>NEXUS</p>
      </section>
      <button class="resume-node" type="button" (click)="enterResume($event)">
        <span>Resume</span>
        <small>Tech Resume Studio</small>
      </button>
    </main>
  `,
  styles: [
    `
      .universe {
        position: relative;
        min-height: 100vh;
        overflow: hidden;
        background: #07080d;
        color: #f7f4ef;
      }

      canvas {
        position: absolute;
        inset: 0;
        width: 100%;
        height: 100%;
      }

      .intro {
        position: absolute;
        inset: 0;
        display: grid;
        place-items: center;
        background: #07080d;
        transition: opacity 700ms ease, visibility 700ms ease;
        z-index: 2;
      }

      .intro.done {
        opacity: 0;
        visibility: hidden;
      }

      .intro p {
        margin: 0;
        font-size: clamp(3rem, 9vw, 8rem);
        letter-spacing: 0;
        font-weight: 800;
      }

      .resume-node {
        position: absolute;
        left: min(68vw, calc(100% - 15rem));
        top: 42vh;
        z-index: 1;
        width: 13rem;
        height: 13rem;
        border: 1px solid rgba(64, 186, 201, 0.5);
        border-radius: 50%;
        color: #f7f4ef;
        background: rgba(11, 25, 36, 0.48);
        box-shadow: 0 0 60px rgba(46, 181, 199, 0.28);
        cursor: pointer;
        display: grid;
        place-items: center;
        transition: transform 250ms ease, border-color 250ms ease;
      }

      .resume-node:hover,
      .resume-node:focus-visible {
        transform: scale(1.08);
        border-color: #e5b84e;
        outline: none;
      }

      .resume-node span,
      .resume-node small {
        grid-area: 1 / 1;
      }

      .resume-node span {
        font-size: 1.35rem;
        font-weight: 800;
      }

      .resume-node small {
        transform: translateY(2rem);
        color: #a9c8cd;
      }
    `,
  ],
})
export class UniverseComponent implements AfterViewInit, OnDestroy {
  @ViewChild('canvas', { static: true }) private canvas?: ElementRef<HTMLCanvasElement>;
  protected introDone = false;
  private readonly router = inject(Router);
  private renderer?: THREE.WebGLRenderer;
  private animationId = 0;

  ngAfterViewInit() {
    const canvas = this.canvas?.nativeElement;
    if (!canvas) {
      return;
    }

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(65, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.z = 70;

    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.6));
    this.renderer.setSize(window.innerWidth, window.innerHeight);

    const particleCount = window.innerWidth < 760 ? 900 : 1800;
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(particleCount * 3);
    for (let i = 0; i < particleCount * 3; i += 3) {
      positions[i] = (Math.random() - 0.5) * 180;
      positions[i + 1] = (Math.random() - 0.5) * 120;
      positions[i + 2] = (Math.random() - 0.5) * 110;
    }
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    const material = new THREE.PointsMaterial({
      color: 0x74d7e6,
      size: 0.28,
      transparent: true,
      opacity: 0.78,
    });
    const stars = new THREE.Points(geometry, material);
    scene.add(stars);

    const animate = () => {
      stars.rotation.y += 0.0009;
      stars.rotation.x += 0.00025;
      this.renderer?.render(scene, camera);
      this.animationId = requestAnimationFrame(animate);
    };
    animate();

    window.setTimeout(() => {
      this.introDone = true;
    }, 2600);
  }

  protected skipIntro() {
    this.introDone = true;
  }

  protected enterResume(event: MouseEvent) {
    event.stopPropagation();
    this.introDone = true;
    void this.router.navigateByUrl('/resume');
  }

  ngOnDestroy() {
    cancelAnimationFrame(this.animationId);
    this.renderer?.dispose();
  }
}
