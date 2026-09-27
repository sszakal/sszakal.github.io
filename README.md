# x86.cc

Personal blog, built with [Astro](https://astro.build) and deployed to GitHub Pages.

## Structure

```text
├── public/            static files copied as-is (favicons, CNAME)
├── src/
│   ├── assets/        images, fonts
│   ├── components/    Astro components
│   ├── content/blog/  blog posts (Markdown/MDX)
│   ├── layouts/
│   └── pages/         routes (index, about, blog listing)
├── astro.config.mjs
└── package.json
```

## Commands

Run from the repo root:

| Command             | Action                                      |
| :------------------ | :------------------------------------------ |
| `npm install`        | Install dependencies                        |
| `npm run dev`         | Start local dev server at `localhost:4321` |
| `npm run build`       | Build the production site to `./dist/`     |
| `npm run preview`     | Preview the production build locally       |

## Writing a post

Add a new Markdown or MDX file under `src/content/blog/`. Front matter fields are defined in `src/content.config.ts`.

## Deployment

Pushes to `master` trigger `.github/workflows/deploy.yml`, which builds the site with Astro and publishes it to GitHub Pages. The custom domain is configured via `public/CNAME`, and the target URL is set in `astro.config.mjs` (`site`).

To enable this the first time, set the repository's Pages source to **GitHub Actions** under Settings → Pages.
