import { ParticleField, isWebGLAvailable } from './particle-field';

export function setupTileReveal(selector = '[data-reveal]') {
	const els = document.querySelectorAll<HTMLElement>(selector);
	if (els.length === 0) return;

	if (!isWebGLAvailable()) {
		els.forEach((el) => showPlainImage(el));
		return;
	}

	const io = new IntersectionObserver(
		(entries) => {
			for (const entry of entries) {
				if (!entry.isIntersecting) continue;
				const el = entry.target as HTMLElement;
				io.unobserve(el);
				reveal(el);
			}
		},
		{ threshold: 0.15, rootMargin: '120px 0px' },
	);
	els.forEach((el) => io.observe(el));
}

function showPlainImage(el: HTMLElement) {
	const src = el.dataset.reveal;
	if (!src) return;
	const img = document.createElement('img');
	img.src = src;
	img.alt = el.dataset.alt || '';
	img.loading = 'lazy';
	Object.assign(img.style, { position: 'absolute', inset: '0', width: '100%', height: '100%', objectFit: 'cover' });
	el.appendChild(img);
}

function reveal(el: HTMLElement) {
	const src = el.dataset.reveal;
	const alt = el.dataset.alt || '';
	if (!src) return;

	const canvasHost = document.createElement('div');
	Object.assign(canvasHost.style, { position: 'absolute', inset: '0' });
	el.appendChild(canvasHost);

	const area = el.clientWidth * el.clientHeight;
	const count = Math.max(1200, Math.min(3200, Math.round(area / 90)));
	const field = new ParticleField(canvasHost, { count, mode: 'once', disperse: 1.8, parallax: false });

	field.revealOnce(src, () => {
		const img = document.createElement('img');
		img.src = src;
		img.alt = alt;
		img.loading = 'eager';
		Object.assign(img.style, {
			position: 'absolute',
			inset: '0',
			width: '100%',
			height: '100%',
			objectFit: 'cover',
			opacity: '0',
			transition: 'opacity 500ms ease',
		});
		el.appendChild(img);
		requestAnimationFrame(() => {
			img.style.opacity = '1';
		});
		setTimeout(() => {
			canvasHost.style.transition = 'opacity 400ms ease';
			canvasHost.style.opacity = '0';
			setTimeout(() => {
				field.dispose();
				canvasHost.remove();
			}, 420);
		}, 250);
	});
}
