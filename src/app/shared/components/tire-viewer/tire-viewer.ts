import { isPlatformBrowser } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  PLATFORM_ID,
  afterNextRender,
  inject,
  input,
  signal,
  viewChild,
} from '@angular/core';

import { MotionService } from '@core/services/motion.service';

/**
 * Single-tire 3D viewer (spec 02/05 §6, animation A8). Three.js is imported
 * dynamically inside this component AND the component itself only ever loads
 * via `@defer` — Three never touches the initial bundle. OrbitControls are
 * constrained per spec: no pan, limited polar angle, clamped zoom. Auto-rotate
 * honors reduced motion centrally via MotionService. The GLTFLoader is wired
 * with a DRACOLoader (decoder shipped under /assets/draco/) so real
 * draco-compressed scans drop in with zero code changes.
 */
@Component({
  selector: 'app-tire-viewer',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="viewer" #host>
      @if (!ready()) {
        <p class="viewer__loading" i18n>3D მოდელი იტვირთება…</p>
      }
      @if (failed()) {
        <p class="viewer__loading" i18n>3D მოდელი მიუწვდომელია</p>
      }
    </div>
  `,
  styles: `
    :host {
      display: block;
      width: 100%;
      height: 100%;
    }

    .viewer {
      position: relative;
      width: 100%;
      height: 100%;
      min-height: 280px;

      canvas {
        display: block;
      }
    }

    .viewer__loading {
      position: absolute;
      inset: 0;
      display: grid;
      place-items: center;
      color: var(--ink-1);
      font-size: var(--text-sm);
    }
  `,
})
export class TireViewer {
  readonly glbUrl = input.required<string>();

  protected readonly ready = signal(false);
  protected readonly failed = signal(false);

  private readonly host = viewChild.required<ElementRef<HTMLDivElement>>('host');
  private readonly motion = inject(MotionService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  constructor() {
    afterNextRender(() => void this.init());
  }

  private async init(): Promise<void> {
    if (!this.isBrowser) {
      return;
    }
    const host = this.host().nativeElement;
    const [THREE, { GLTFLoader }, { DRACOLoader }, { OrbitControls }] = await Promise.all([
      import('three'),
      import('three/examples/jsm/loaders/GLTFLoader.js'),
      import('three/examples/jsm/loaders/DRACOLoader.js'),
      import('three/examples/jsm/controls/OrbitControls.js'),
    ]);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(host.clientWidth, host.clientHeight || 320);
    host.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(
      38,
      host.clientWidth / (host.clientHeight || 320),
      0.05,
      10,
    );
    camera.position.set(0.45, 0.22, 0.85);

    scene.add(new THREE.HemisphereLight(0xf2f1ed, 0x16161a, 1.4));
    const key = new THREE.DirectionalLight(0xffffff, 2.4);
    key.position.set(2, 3, 2);
    scene.add(key);
    const fill = new THREE.DirectionalLight(0xd9a441, 0.5);
    fill.position.set(-2, 1, -1.5);
    scene.add(fill);

    // Constrained orbit (spec 02): no pan, limited polar, clamped zoom.
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.enablePan = false;
    controls.minDistance = 0.5;
    controls.maxDistance = 1.5;
    controls.minPolarAngle = Math.PI * 0.28;
    controls.maxPolarAngle = Math.PI * 0.62;
    controls.autoRotate = !this.motion.reduced();
    controls.autoRotateSpeed = 1.6;

    const loader = new GLTFLoader();
    const draco = new DRACOLoader();
    draco.setDecoderPath('/assets/draco/');
    loader.setDRACOLoader(draco);
    loader.load(
      this.glbUrl(),
      (gltf) => {
        const box = new THREE.Box3().setFromObject(gltf.scene);
        const center = box.getCenter(new THREE.Vector3());
        gltf.scene.position.sub(center);
        scene.add(gltf.scene);
        this.ready.set(true);
      },
      undefined,
      () => this.failed.set(true),
    );

    let frame = 0;
    const loop = () => {
      controls.autoRotate = !this.motion.reduced();
      controls.update();
      renderer.render(scene, camera);
      frame = requestAnimationFrame(loop);
    };
    loop();

    const observer = new ResizeObserver(() => {
      const w = host.clientWidth;
      const h = host.clientHeight || 320;
      renderer.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    });
    observer.observe(host);

    this.destroyRef.onDestroy(() => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      controls.dispose();
      draco.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    });
  }
}
