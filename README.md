# Vaibhav Tripathi — Personal Computer

A 3D desk that becomes an interactive portfolio desktop through a scroll-driven trip into the monitor. Built with React, TypeScript, Three.js, and GSAP. No new dependency is needed.

## Run and verify

```sh
npm install
npm run dev -- --host 127.0.0.1 --port 5173
npx tsc --noEmit
npm run build
npm run test:e2e
```

Browser tests require Python Playwright and Chromium, with the preview server running. The historical entry filename is `src/manga-main.tsx`; it now loads `src/PersonalComputer.tsx`, `src/ComputerScene.tsx`, and their styles. Earlier implementations are inactive.

## Edit content

Update `src/content.json` without editing HTML. It contains the bio, experience, skills, education, certification, and project records. Project categories generate the filter buttons automatically. Live and source links are optional and require HTTP(S) URLs. Rebuild and deploy to update a published site for everyone. Update `index.html` too when changing the static no-JavaScript identity/contact summary.

Current skills: HTML, CSS, Python. Current projects: Supremo AI and Khoj AI. Their case-study details are not published; the site does not invent them. Quality Lab has been removed from navigation, desktop apps, the monitor illustration, routing, and public downloads. The original user PDF in Downloads is untouched.

## Interactions

- Pointer-responsive 3D desk, clickable monitor, and scroll-driven camera travel.
- Desktop apps for About, Projects, Skills, Contact, and Resume.
- Draggable, centerable, minimized/maximized windows; Start menu and taskbar.
- Project filters and shareable project dialogs with keyboard focus restoration.
- Reduced-motion preference, ambient pause, opt-in short interface sound.
- Lazy-loaded WebGL scene, capped resolution, offscreen/tab rendering pause, and static fallback.
- Real mailto and clipboard actions; print/save PDF resume. No email backend or external submission is claimed.

The site assumes domain-root deployment with an SPA fallback. No deployment is performed by the local build.
