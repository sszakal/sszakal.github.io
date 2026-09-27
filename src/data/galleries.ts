export interface Photo {
	src: string;
	alt: string;
}

export interface Gallery {
	slug: string;
	title: string;
	index: string;
	description: string;
	cover: string;
	photos: Photo[];
}

function picsum(seed: string, w = 1600, h = 2000) {
	return `https://picsum.photos/seed/${seed}/${w}/${h}`;
}

const collections: { slug: string; title: string; description: string; shots: number }[] = [
	{ slug: 'streets', title: 'Streets', description: 'Candid frames from cities at street level.', shots: 7 },
	{ slug: 'portraits', title: 'Portraits', description: 'Studio and available-light portrait work.', shots: 6 },
	{ slug: 'nightscapes', title: 'Nightscapes', description: 'Long exposures after dark.', shots: 6 },
	{ slug: 'coastlines', title: 'Coastlines', description: 'Coastal light, tide, and weather.', shots: 7 },
	{ slug: 'interiors', title: 'Interiors', description: 'Architecture and interior spaces.', shots: 6 },
	{ slug: 'wildlife', title: 'Wildlife', description: 'Animals in their own territory.', shots: 6 },
	{ slug: 'analog', title: 'Analog', description: 'Shot on film, developed by hand.', shots: 6 },
	{ slug: 'monochrome', title: 'Monochrome', description: 'Black and white studies.', shots: 6 },
];

export const galleries: Gallery[] = collections.map((c, i) => ({
	slug: c.slug,
	title: c.title,
	index: String(i + 1).padStart(2, '0'),
	description: c.description,
	cover: picsum(`${c.slug}-cover`),
	photos: Array.from({ length: c.shots }, (_, n) => ({
		src: picsum(`${c.slug}-${n + 1}`),
		alt: `${c.title} ${n + 1}`,
	})),
}));

export function getGallery(slug: string): Gallery | undefined {
	return galleries.find((g) => g.slug === slug);
}
