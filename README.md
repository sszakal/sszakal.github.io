# x86.cc

Stefan Szakal's photography site — a one-page gallery with a lightbox, built with Astro, React, and Tailwind CSS.

## Tech stack

- **[Astro 7](https://astro.build)** — static site framework
- **[React 19](https://react.dev)** — powers the gallery/lightbox island
- **[Tailwind CSS 4](https://tailwindcss.com)** — styling

## Development

```bash
npm install
npm run dev       # http://localhost:4321
```

## Adding photos

Drop image files into `src/assets/`. The gallery globs that directory automatically and generates optimized full-size and thumbnail versions at build time — no manual registration needed.

## Deployment

Pushes to `master` trigger `.github/workflows/deploy.yml`, which builds the site and publishes it to GitHub Pages. The custom domain is configured via `public/CNAME`.

## Credits

This site's gallery/lightbox is built on [Astro Multiverse](https://github.com/area44/astro-multiverse) by [AREA44](https://github.com/AREA44), re-imagining the original **Multiverse** design by [HTML5 UP](https://html5up.net). Used and modified under the [Creative Commons Attribution 3.0](LICENSE) license.
