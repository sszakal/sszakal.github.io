import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

export interface SpacePhoto {
	src: string;
	alt: string;
}

interface PlaneEntry {
	mesh: THREE.Mesh;
	material: THREE.MeshBasicMaterial;
	baseScale: THREE.Vector3;
}

const BG = 0x05070a;

// Scatters points inside a forward-facing cone (around +z) rather than a
// full sphere, so most photos are legible face-on from the default camera
// position, while still having real depth to orbit around and reveal.
function clusterPoints(count: number, radius: number): THREE.Vector3[] {
	const points: THREE.Vector3[] = [];
	const golden = Math.PI * (3 - Math.sqrt(5));
	const coneHalfAngle = (48 * Math.PI) / 180;
	for (let i = 0; i < count; i++) {
		const frac = (i + 0.5) / count;
		const theta = Math.acos(1 - frac * (1 - Math.cos(coneHalfAngle)));
		const phi = i * golden;
		const dir = new THREE.Vector3(Math.sin(theta) * Math.cos(phi), Math.sin(theta) * Math.sin(phi), Math.cos(theta));
		const depthJitter = 0.72 + Math.random() * 0.56;
		points.push(dir.multiplyScalar(radius * depthJitter));
	}
	return points;
}

export class GallerySpace {
	private renderer: THREE.WebGLRenderer;
	private scene = new THREE.Scene();
	private camera: THREE.PerspectiveCamera;
	private controls: OrbitControls;
	private raycaster = new THREE.Raycaster();
	private pointer = new THREE.Vector2(-10, -10);
	private entries: PlaneEntry[] = [];
	private container: HTMLElement;
	private raf = 0;
	private clock = new THREE.Clock();
	private hovered: PlaneEntry | null = null;
	private disposed = false;
	private onSelect: (index: number) => void;

	constructor(container: HTMLElement, photos: SpacePhoto[], onSelect: (index: number) => void) {
		this.container = container;
		this.onSelect = onSelect;

		const canvas = document.createElement('canvas');
		canvas.style.display = 'block';
		canvas.style.width = '100%';
		canvas.style.height = '100%';
		container.appendChild(canvas);

		this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
		this.renderer.setClearColor(BG, 1);

		this.scene.fog = new THREE.Fog(BG, 6, 16);

		const radius = 4.2 + photos.length * 0.16;
		this.camera = new THREE.PerspectiveCamera(50, 1, 0.1, 100);
		this.camera.position.set(0, 0, radius + 5.5);

		this.controls = new OrbitControls(this.camera, canvas);
		this.controls.enableDamping = true;
		this.controls.dampingFactor = 0.08;
		this.controls.rotateSpeed = 0.5;
		this.controls.enablePan = false;
		this.controls.minDistance = radius * 0.55;
		this.controls.maxDistance = radius * 2.4;
		this.controls.autoRotate = true;
		this.controls.autoRotateSpeed = 0.5;

		const points = clusterPoints(photos.length, radius);
		const loader = new THREE.TextureLoader();
		loader.crossOrigin = 'anonymous';

		photos.forEach((photo, i) => {
			const geo = new THREE.PlaneGeometry(1.6, 2);
			const material = new THREE.MeshBasicMaterial({
				color: 0xffffff,
				transparent: true,
				opacity: 0,
				side: THREE.DoubleSide,
			});
			const mesh = new THREE.Mesh(geo, material);
			const pos = points[i];
			mesh.position.copy(pos);
			mesh.lookAt(pos.clone().multiplyScalar(2));
			const s = 0.001;
			mesh.scale.set(s, s, s);
			this.scene.add(mesh);

			const entry: PlaneEntry = { mesh, material, baseScale: new THREE.Vector3(1, 1, 1) };
			this.entries.push(entry);
			mesh.userData.index = i;

			loader.load(photo.src, (tex) => {
				tex.colorSpace = THREE.SRGBColorSpace;
				const aspect = tex.image.width / tex.image.height;
				mesh.geometry.dispose();
				mesh.geometry = new THREE.PlaneGeometry(1.6 * aspect, 1.6 / aspect < 2 ? 1.6 / aspect : 2);
				material.map = tex;
				material.needsUpdate = true;
				this.growIn(entry, i * 90);
			});
		});

		canvas.addEventListener('pointermove', this.onPointerMove);
		canvas.addEventListener('pointerdown', this.onPointerDown);
		canvas.addEventListener('pointerup', this.onPointerUp);
		// Auto-rotation is nice ambient motion when idle, but a target that
		// keeps drifting is frustrating to aim at, so pause while engaged.
		canvas.addEventListener('pointerenter', () => {
			this.controls.autoRotate = false;
		});
		canvas.addEventListener('pointerleave', () => {
			this.controls.autoRotate = true;
			this.pointer.set(-10, -10);
		});
		this.resize();
		window.addEventListener('resize', this.resize);
	}

	private growIn(entry: PlaneEntry, delayMs: number) {
		const start = performance.now() + delayMs;
		const duration = 700;
		const tick = () => {
			if (this.disposed) return;
			const t = Math.min(1, Math.max(0, (performance.now() - start) / duration));
			const eased = t * (2 - t);
			entry.mesh.scale.setScalar(0.15 + eased * 0.85);
			entry.material.opacity = eased;
			if (t < 1) requestAnimationFrame(tick);
		};
		requestAnimationFrame(tick);
	}

	private resize = () => {
		const w = this.container.clientWidth || window.innerWidth;
		const h = this.container.clientHeight || window.innerHeight;
		this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
		this.renderer.setSize(w, h, false);
		this.camera.aspect = w / h;
		this.camera.updateProjectionMatrix();
	};

	private onPointerMove = (e: PointerEvent) => {
		const rect = this.container.getBoundingClientRect();
		this.pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
		this.pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
	};

	private downPos = new THREE.Vector2();

	private onPointerDown = (e: PointerEvent) => {
		this.downPos.set(e.clientX, e.clientY);
	};

	private onPointerUp = (e: PointerEvent) => {
		const dist = Math.hypot(e.clientX - this.downPos.x, e.clientY - this.downPos.y);
		if (dist >= 6) return;
		// Raycast fresh at the up-to-date pointer position rather than trusting
		// `this.hovered`, which only refreshes once per animation frame and can
		// be stale relative to a fast move-then-click.
		const entry = this.raycastAt(this.pointer);
		if (entry) this.onSelect(entry.mesh.userData.index as number);
	};

	private raycastAt(ndc: THREE.Vector2): PlaneEntry | null {
		this.raycaster.setFromCamera(ndc, this.camera);
		const hits = this.raycaster.intersectObjects(this.entries.map((e) => e.mesh));
		if (hits.length === 0) return null;
		return this.entries.find((e) => e.mesh === hits[0].object) ?? null;
	}

	private updateHover() {
		const hitEntry = this.raycastAt(this.pointer);

		if (hitEntry !== this.hovered) {
			if (this.hovered) this.hovered.mesh.scale.copy(this.hovered.baseScale);
			this.hovered = hitEntry;
			this.container.style.cursor = hitEntry ? 'pointer' : 'grab';
		}
		if (this.hovered) {
			const s = 1.08 + Math.sin(this.clock.getElapsedTime() * 4) * 0.01;
			this.hovered.mesh.scale.setScalar(s);
		}
	}

	private step = () => {
		if (this.disposed) return;
		this.raf = requestAnimationFrame(this.step);
		this.controls.update();
		this.updateHover();
		this.renderer.render(this.scene, this.camera);
	};

	start() {
		this.container.style.cursor = 'grab';
		this.clock.start();
		this.raf = requestAnimationFrame(this.step);
	}

	dispose() {
		this.disposed = true;
		if (this.raf) cancelAnimationFrame(this.raf);
		window.removeEventListener('resize', this.resize);
		this.controls.dispose();
		this.entries.forEach((e) => {
			e.mesh.geometry.dispose();
			e.material.map?.dispose();
			e.material.dispose();
		});
		this.renderer.dispose();
		this.renderer.domElement.remove();
	}
}
