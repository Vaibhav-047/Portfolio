# Vaibhav Tripathi — The Portfolio Tree

A scroll-driven 3D tree of life. The camera starts at the roots at dawn, climbs the trunk, visits one branch per portfolio section, and ends in the canopy at night. Built with React, TypeScript, Three.js, GSAP ScrollTrigger and Lenis. No other dependency.

## Run and verify

```sh
npm install
npm run dev -- --host 127.0.0.1 --port 5173
npx tsc --noEmit
npm run build
npm run test:e2e
```

Browser tests need Python Playwright and Chromium, with the dev server running on port 5173.

## Where things live

- `src/tree-main.tsx` — entry; renders `src/PortfolioTree.tsx` (all readable DOM content, nav, dialog, scroll wiring).
- `src/tree/` — the WebGL scene, lazy-loaded after first paint. The page is fully usable without it.
- `src/tree.css` — styles.
- `src/content.json` — all portfolio content. Edit this, not the components. Update the `index.html` noscript summary too when identity or contact details change.

Earlier implementations (`App.tsx`, reactor, freefall, manga, dragon pages) are inactive and not loaded by `index.html`.

## Branch map

| Scroll stop | Section | In the tree |
| --- | --- | --- |
| Roots | Name, role, intro | Roots at dawn |
| Branch 1 | About | Paper lanterns |
| Branch 2 | Skills, education, certification | Glowing fruits |
| Branch 3 | Projects | Blossoms (click opens the project) |
| Branch 4 | Experience | A nest |
| Branch 5 | Contact | Firefly jar, dusk |
| Hollow | Resume (printable) | Glowing hollow in the trunk |
| Canopy | Outro | Night sky |
