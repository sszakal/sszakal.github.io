import * as THREE from 'three';

// Compact 3D simplex noise (Ashima Arts, public domain) — used for the
// organic swirl in both the burst/disperse motion and the idle ambient drift.
const NOISE_GLSL = `
vec3 mod289(vec3 x){return x-floor(x*(1.0/289.0))*289.0;}
vec4 mod289(vec4 x){return x-floor(x*(1.0/289.0))*289.0;}
vec4 permute(vec4 x){return mod289(((x*34.0)+1.0)*x);}
vec4 taylorInvSqrt(vec4 r){return 1.79284291400159-0.85373472095314*r;}
float snoise(vec3 v){
  const vec2 C=vec2(1.0/6.0,1.0/3.0);
  const vec4 D=vec4(0.0,0.5,1.0,2.0);
  vec3 i=floor(v+dot(v,C.yyy));
  vec3 x0=v-i+dot(i,C.xxx);
  vec3 g=step(x0.yzx,x0.xyz);
  vec3 l=1.0-g;
  vec3 i1=min(g.xyz,l.zxy);
  vec3 i2=max(g.xyz,l.zxy);
  vec3 x1=x0-i1+C.xxx;
  vec3 x2=x0-i2+C.yyy;
  vec3 x3=x0-D.yyy;
  i=mod289(i);
  vec4 p=permute(permute(permute(
      i.z+vec4(0.0,i1.z,i2.z,1.0))
    +i.y+vec4(0.0,i1.y,i2.y,1.0))
    +i.x+vec4(0.0,i1.x,i2.x,1.0));
  float n_=0.142857142857;
  vec3 ns=n_*D.wyz-D.xzx;
  vec4 j=p-49.0*floor(p*ns.z*ns.z);
  vec4 x_=floor(j*ns.z);
  vec4 y_=floor(j-7.0*x_);
  vec4 x=x_*ns.x+ns.yyyy;
  vec4 y=y_*ns.x+ns.yyyy;
  vec4 h=1.0-abs(x)-abs(y);
  vec4 b0=vec4(x.xy,y.xy);
  vec4 b1=vec4(x.zw,y.zw);
  vec4 s0=floor(b0)*2.0+1.0;
  vec4 s1=floor(b1)*2.0+1.0;
  vec4 sh=-step(h,vec4(0.0));
  vec4 a0=b0.xzyw+s0.xzyw*sh.xxyy;
  vec4 a1=b1.xzyw+s1.xzyw*sh.zzww;
  vec3 p0=vec3(a0.xy,h.x);
  vec3 p1=vec3(a0.zw,h.y);
  vec3 p2=vec3(a1.xy,h.z);
  vec3 p3=vec3(a1.zw,h.w);
  vec4 norm=taylorInvSqrt(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3)));
  p0*=norm.x; p1*=norm.y; p2*=norm.z; p3*=norm.w;
  vec4 m=max(0.6-vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)),0.0);
  m=m*m;
  return 42.0*dot(m*m,vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));
}
`;

const VERTEX_SHADER = `
uniform float uMixT;
uniform float uBurstAmt;
uniform float uIdleAmt;
uniform float uDisperse;
uniform float uTime;
uniform float uPointScale;
uniform float uPxScale;
uniform float uSpacing;
uniform vec2 uPointer;
attribute vec3 aStart;
attribute vec3 aTarget;
attribute vec3 aBurst;
attribute vec3 aColor;
attribute float aSize;
attribute float aPhase;
varying vec3 vColor;
varying float vAlpha;
${NOISE_GLSL}
void main() {
  float t = smoothstep(0.0, 1.0, uMixT);
  vec3 base = mix(aStart, aTarget, t);

  vec3 n = vec3(
    snoise(vec3(aTarget.xy * 0.9, uTime * 0.12 + aPhase)),
    snoise(vec3(aTarget.yx * 0.9 + 19.3, uTime * 0.12 + aPhase)),
    snoise(vec3(aTarget.xy * 0.9 + 71.7, uTime * 0.12 + aPhase))
  );

  vec3 pos = base + aBurst * uDisperse * uBurstAmt + n * uSpacing * (0.15 + uIdleAmt * 0.5);

  pos.x += uPointer.x * (0.5 + pos.z * 0.6) * 0.5;
  pos.y += uPointer.y * (0.5 + pos.z * 0.6) * 0.5;

  vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
  gl_Position = projectionMatrix * mvPosition;
  gl_PointSize = aSize * uPointScale * (uPxScale / -mvPosition.z);

  vColor = aColor;
  vAlpha = clamp(1.0 - uBurstAmt * 0.55, 0.1, 1.0);
}
`;

const FRAGMENT_SHADER = `
precision mediump float;
uniform float uOpacity;
uniform vec3 uTint;
uniform bool uGlow;
varying vec3 vColor;
varying float vAlpha;
void main() {
  vec2 uv = gl_PointCoord - 0.5;
  float d = length(uv);
  float edge = uGlow ? 0.5 : 0.42;
  float alpha = smoothstep(edge, 0.0, d) * vAlpha * uOpacity;
  if (alpha < 0.015) discard;
  vec3 color = uGlow ? mix(vColor, uTint, 0.35) : vColor;
  gl_FragColor = vec4(color, alpha);
}
`;

interface SampleResult {
	positions: Float32Array;
	colors: Float32Array;
	sizes: Float32Array;
	spacing: number;
}

function sampleImage(img: HTMLImageElement, count: number, planeW: number, planeH: number): SampleResult {
	const planeAspect = planeW / planeH;
	const cols = Math.round(Math.sqrt(count * planeAspect));
	const rows = Math.max(1, Math.round(count / cols));
	const total = cols * rows;

	const off = document.createElement('canvas');
	off.width = cols;
	off.height = rows;
	const ctx = off.getContext('2d', { willReadFrequently: true })!;

	// object-fit: cover mapping from source image into the cols x rows grid
	const imgAspect = img.naturalWidth / img.naturalHeight;
	let sx = 0;
	let sy = 0;
	let sw = img.naturalWidth;
	let sh = img.naturalHeight;
	if (imgAspect > planeAspect) {
		sw = img.naturalHeight * planeAspect;
		sx = (img.naturalWidth - sw) / 2;
	} else {
		sh = img.naturalWidth / planeAspect;
		sy = (img.naturalHeight - sh) / 2;
	}
	ctx.drawImage(img, sx, sy, sw, sh, 0, 0, cols, rows);
	const data = ctx.getImageData(0, 0, cols, rows).data;

	const positions = new Float32Array(total * 3);
	const colors = new Float32Array(total * 3);
	const sizes = new Float32Array(total);
	const spacing = planeW / cols;

	for (let row = 0; row < rows; row++) {
		for (let col = 0; col < cols; col++) {
			const i = row * cols + col;
			const px = i * 4;
			const r = data[px] / 255;
			const g = data[px + 1] / 255;
			const b = data[px + 2] / 255;
			const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;

			const x = (col + 0.5) / cols - 0.5;
			const y = 0.5 - (row + 0.5) / rows;

			positions[i * 3] = x * planeW;
			positions[i * 3 + 1] = y * planeH;
			positions[i * 3 + 2] = (luminance - 0.5) * spacing * 6 + (Math.random() - 0.5) * spacing * 0.6;

			colors[i * 3] = r;
			colors[i * 3 + 1] = g;
			colors[i * 3 + 2] = b;

			sizes[i] = spacing * (1.1 + luminance * 0.9);
		}
	}

	return { positions, colors, sizes, spacing };
}

function loadImage(url: string): Promise<HTMLImageElement> {
	return new Promise((resolve, reject) => {
		const img = new Image();
		img.crossOrigin = 'anonymous';
		img.onload = () => resolve(img);
		img.onerror = reject;
		img.src = url;
	});
}

export interface ParticleFieldOptions {
	count?: number;
	mode?: 'loop' | 'once';
	pointScale?: number;
	disperse?: number;
	parallax?: boolean;
}

export class ParticleField {
	private renderer: THREE.WebGLRenderer;
	private scene = new THREE.Scene();
	private camera: THREE.PerspectiveCamera;
	private geometry: THREE.BufferGeometry;
	private core: THREE.Points;
	private glow: THREE.Points;
	private count: number;
	private mode: 'loop' | 'once';
	private planeW = 10;
	private planeH = 6;
	private container: HTMLElement;
	private raf = 0;
	private clock = new THREE.Clock();
	private cache = new Map<string, SampleResult>();
	private currentUrl: string | null = null;

	private tweenStart = 0;
	private tweenDuration = 1500;
	private tweening = false;
	private pointerTarget = new THREE.Vector2(0, 0);
	private pointerCurrent = new THREE.Vector2(0, 0);
	private disposed = false;
	private onSettledCb: (() => void) | null = null;
	private parallax: boolean;

	constructor(container: HTMLElement, opts: ParticleFieldOptions = {}) {
		this.container = container;
		this.count = opts.count ?? 9000;
		this.mode = opts.mode ?? 'loop';
		this.parallax = opts.parallax ?? true;

		const canvas = document.createElement('canvas');
		canvas.style.display = 'block';
		canvas.style.width = '100%';
		canvas.style.height = '100%';
		container.appendChild(canvas);

		this.renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: 'high-performance' });
		this.renderer.setClearColor(0x000000, 0);

		this.camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
		this.camera.position.z = 12;

		this.geometry = new THREE.BufferGeometry();
		const n = this.count;
		this.geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
		this.geometry.setAttribute('aStart', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
		this.geometry.setAttribute('aTarget', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
		this.geometry.setAttribute('aBurst', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
		this.geometry.setAttribute('aColor', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
		this.geometry.setAttribute('aSize', new THREE.BufferAttribute(new Float32Array(n), 1));
		this.geometry.setAttribute('aPhase', new THREE.BufferAttribute(new Float32Array(n), 1));

		const phase = this.geometry.getAttribute('aPhase') as THREE.BufferAttribute;
		for (let i = 0; i < n; i++) phase.setX(i, Math.random() * 1000);

		this.core = new THREE.Points(this.geometry, this.buildMaterial(false, opts.pointScale ?? 1));
		this.glow = new THREE.Points(this.geometry, this.buildMaterial(true, (opts.pointScale ?? 1) * 2.6));
		this.scene.add(this.glow);
		this.scene.add(this.core);

		this.uniformsShared.uDisperse.value = opts.disperse ?? 3.2;

		this.resize();
		window.addEventListener('resize', this.resize);
		if (this.parallax) {
			window.addEventListener('pointermove', this.onPointerMove);
		}
	}

	private uniformsShared = {
		uMixT: { value: 0 },
		uBurstAmt: { value: 1 },
		uIdleAmt: { value: 0 },
		uDisperse: { value: 3.2 },
		uTime: { value: 0 },
		uPointScale: { value: 1 },
		uPxScale: { value: 1 },
		uSpacing: { value: 0.1 },
		uPointer: { value: new THREE.Vector2(0, 0) },
	};

	private buildMaterial(glow: boolean, pointScale: number) {
		return new THREE.ShaderMaterial({
			uniforms: {
				uMixT: this.uniformsShared.uMixT,
				uBurstAmt: this.uniformsShared.uBurstAmt,
				uIdleAmt: this.uniformsShared.uIdleAmt,
				uDisperse: this.uniformsShared.uDisperse,
				uTime: this.uniformsShared.uTime,
				uPointer: this.uniformsShared.uPointer,
				uPxScale: this.uniformsShared.uPxScale,
				uSpacing: this.uniformsShared.uSpacing,
				uPointScale: { value: pointScale },
				uOpacity: { value: glow ? 0.16 : 0.95 },
				uTint: { value: new THREE.Color(0x9fb4ff) },
				uGlow: { value: glow },
			},
			vertexShader: VERTEX_SHADER,
			fragmentShader: FRAGMENT_SHADER,
			transparent: true,
			depthWrite: false,
			depthTest: false,
			blending: glow ? THREE.AdditiveBlending : THREE.NormalBlending,
		});
	}

	private onPointerMove = (e: PointerEvent) => {
		const nx = (e.clientX / window.innerWidth) * 2 - 1;
		const ny = (e.clientY / window.innerHeight) * 2 - 1;
		this.pointerTarget.set(nx, -ny);
	};

	private resize = () => {
		const w = this.container.clientWidth || window.innerWidth;
		const h = this.container.clientHeight || window.innerHeight;
		const pr = Math.min(window.devicePixelRatio, 2);
		this.renderer.setPixelRatio(pr);
		this.renderer.setSize(w, h, false);
		this.camera.aspect = w / h;
		const vFov = (this.camera.fov * Math.PI) / 180;
		const dist = this.camera.position.z;
		this.planeH = 2 * Math.tan(vFov / 2) * dist;
		this.planeW = this.planeH * (w / h);
		this.camera.updateProjectionMatrix();
		// gl_PointSize is specified in device pixels; convert a world-space
		// size at the particle plane's depth into device pixels.
		this.uniformsShared.uPxScale.value = ((h * pr) / this.planeH) * dist;
		// Cached samples were mapped to the previous plane size; drop them so
		// the next load/transition resamples at the new viewport size.
		this.cache.clear();
	};

	private writeAttribute(name: string, data: Float32Array) {
		const attr = this.geometry.getAttribute(name) as THREE.BufferAttribute;
		const dst = attr.array as Float32Array;
		dst.set(data.subarray(0, Math.min(data.length, dst.length)));
		attr.needsUpdate = true;
	}

	private randomizeBurst() {
		const attr = this.geometry.getAttribute('aBurst') as THREE.BufferAttribute;
		const arr = attr.array as Float32Array;
		for (let i = 0; i < this.count; i++) {
			const theta = Math.random() * Math.PI * 2;
			const phi = Math.acos(Math.random() * 2 - 1);
			const r = 0.5 + Math.random() * 0.5;
			arr[i * 3] = Math.sin(phi) * Math.cos(theta) * r;
			arr[i * 3 + 1] = Math.sin(phi) * Math.sin(theta) * r;
			arr[i * 3 + 2] = Math.cos(phi) * r * 0.6;
		}
		attr.needsUpdate = true;
	}

	private async getSample(url: string): Promise<SampleResult> {
		const cached = this.cache.get(url);
		if (cached) return cached;
		const img = await loadImage(url);
		const sample = sampleImage(img, this.count, this.planeW, this.planeH);
		this.cache.set(url, sample);
		return sample;
	}

	async loadInitial(url: string) {
		const sample = await this.getSample(url);
		this.uniformsShared.uSpacing.value = sample.spacing;
		this.writeAttribute('aStart', sample.positions);
		this.writeAttribute('aTarget', sample.positions);
		this.writeAttribute('position', sample.positions);
		this.writeAttribute('aColor', sample.colors);
		this.writeAttribute('aSize', sample.sizes);
		this.randomizeBurst();
		this.currentUrl = url;
		this.uniformsShared.uMixT.value = 1;
		this.uniformsShared.uBurstAmt.value = this.mode === 'once' ? 1 : 0;
		this.uniformsShared.uIdleAmt.value = this.mode === 'once' ? 0 : 1;
		if (this.mode === 'once') {
			this.tweenStart = performance.now();
			this.tweening = true;
		}
		this.start();
	}

	async transitionTo(url: string, onSettled?: () => void) {
		if (url === this.currentUrl) return;
		const sample = await this.getSample(url);
		this.uniformsShared.uSpacing.value = sample.spacing;

		// Snapshot the current (possibly mid-tween) on-screen positions as the
		// new start, so an interrupted transition doesn't pop. This mirrors the
		// vertex shader's position formula (minus the cosmetic noise term).
		const startAttr = this.geometry.getAttribute('aStart') as THREE.BufferAttribute;
		const targetAttr = this.geometry.getAttribute('aTarget') as THREE.BufferAttribute;
		const burstAttr = this.geometry.getAttribute('aBurst') as THREE.BufferAttribute;
		const s = startAttr.array as Float32Array;
		const tg = targetAttr.array as Float32Array;
		const bu = burstAttr.array as Float32Array;
		const rawT = this.uniformsShared.uMixT.value;
		const mixT = rawT * rawT * (3 - 2 * rawT);
		const burstAmt = this.uniformsShared.uBurstAmt.value;
		const disperse = this.uniformsShared.uDisperse.value;
		const snapshot = new Float32Array(this.count * 3);
		for (let i = 0; i < snapshot.length; i++) {
			snapshot[i] = s[i] + (tg[i] - s[i]) * mixT + bu[i] * disperse * burstAmt;
		}
		startAttr.array.set(snapshot);
		startAttr.needsUpdate = true;

		this.writeAttribute('aTarget', sample.positions);
		this.writeAttribute('aColor', sample.colors);
		this.writeAttribute('aSize', sample.sizes);
		this.randomizeBurst();
		this.currentUrl = url;

		this.uniformsShared.uMixT.value = 0;
		this.uniformsShared.uIdleAmt.value = 0;
		this.tweenStart = performance.now();
		this.tweenDuration = 1500;
		this.tweening = true;
		this.onSettledCb = onSettled ?? null;
	}

	async revealOnce(url: string, onSettled?: () => void) {
		const sample = await this.getSample(url);
		this.uniformsShared.uSpacing.value = sample.spacing;
		this.writeAttribute('aTarget', sample.positions);
		this.writeAttribute('aColor', sample.colors);
		this.writeAttribute('aSize', sample.sizes);
		this.writeAttribute('position', sample.positions);
		this.writeAttribute('aStart', sample.positions);
		this.randomizeBurst();
		this.currentUrl = url;
		this.uniformsShared.uMixT.value = 1;
		this.uniformsShared.uBurstAmt.value = 1;
		this.uniformsShared.uIdleAmt.value = 0;
		this.tweenStart = performance.now();
		this.tweenDuration = 1400;
		this.tweening = true;
		this.onSettledCb = onSettled ?? null;
		this.start();
	}

	private step = () => {
		if (this.disposed) return;
		this.raf = requestAnimationFrame(this.step);
		const dt = this.clock.getDelta();
		this.uniformsShared.uTime.value += dt;

		this.pointerCurrent.lerp(this.pointerTarget, 0.06);
		this.uniformsShared.uPointer.value.copy(this.pointerCurrent);

		if (this.tweening) {
			const t = Math.min(1, (performance.now() - this.tweenStart) / this.tweenDuration);
			if (this.mode === 'once') {
				this.uniformsShared.uBurstAmt.value = Math.pow(1 - t, 2);
			} else {
				this.uniformsShared.uMixT.value = t;
				this.uniformsShared.uBurstAmt.value = Math.sin(t * Math.PI);
			}
			if (t >= 1) {
				this.tweening = false;
				this.uniformsShared.uIdleAmt.value = this.mode === 'loop' ? 1 : 0;
				const cb = this.onSettledCb;
				this.onSettledCb = null;
				if (cb) cb();
				if (this.mode === 'once') {
					this.stop();
					return;
				}
			}
		}

		this.renderer.render(this.scene, this.camera);
	};

	start() {
		if (this.raf) return;
		this.clock.start();
		this.raf = requestAnimationFrame(this.step);
	}

	stop() {
		if (this.raf) cancelAnimationFrame(this.raf);
		this.raf = 0;
	}

	dispose() {
		this.disposed = true;
		this.stop();
		window.removeEventListener('resize', this.resize);
		if (this.parallax) window.removeEventListener('pointermove', this.onPointerMove);
		this.geometry.dispose();
		(this.core.material as THREE.Material).dispose();
		(this.glow.material as THREE.Material).dispose();
		this.renderer.dispose();
		this.renderer.domElement.remove();
	}
}

export function isWebGLAvailable(): boolean {
	try {
		const canvas = document.createElement('canvas');
		return !!(window.WebGLRenderingContext && (canvas.getContext('webgl') || canvas.getContext('experimental-webgl')));
	} catch {
		return false;
	}
}
