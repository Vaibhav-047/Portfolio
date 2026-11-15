# Vaibhav Tripathi — portfolio

A world tree in a blue-hour grove. Each section of the portfolio is a glowing vine: choose one and a pulse of light
races from the roots, round the trunk and out along a branch to a gem, which opens into that section.
Built with React, TypeScript, Three.js and GSAP.

## Run

```sh
npm install
npm run dev
npm run check   # type-check + production build
```

## Edit content

All text comes from `src/content.json` (bio, experience, skills, education, certification, projects). The `<noscript>`
summary in `index.html` is separate; update it too.

## How it is built

| File | What it holds |
| --- | --- |
| `scripts/build_tree.py` | Blender script: rope-twisted trunk, roots, branches, bark grooves and UVs → `public/tree/tree.glb`; vine splines and leaf clumps → `src/tree-data.json`. Rebuild with `npm run tree` (needs Blender). |
| `src/tree.ts` | Bark material, instanced leaves, vines (flow/pulse shader), gems, wind. |
| `src/world.ts` | Sky, moon, forest layers, ground, grass, mushrooms, fog, fireflies, pollen, falling leaves, god rays. |
| `src/scene.ts` | Renderer, quality tiers, bloom / depth of field / grain, picking, the GSAP vine journey. |
| `src/App.tsx`, `src/styles.css` | Labels, panels, loader, URL hash routing. |

Quality tier is picked automatically (`?tier=high|mid|low` forces one; `?motion=reduced` forces the reduced-motion path).
Section links are plain hashes: `#about`, `#projects`, `#skills`, `#journey`, `#contact`.
