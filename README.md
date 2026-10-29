# Vaibhav Tripathi — Iron / 047

An Iron Man–inspired personal portfolio with a procedural, interactive arc reactor. Built with React, TypeScript, Vite, Three.js, and GSAP. All supplied professional facts and the supplied profile artwork are preserved.

## Run

```sh
npm install
npm run dev -- --host 127.0.0.1 --port 5173
```

## Production build

```sh
npm run build
npm run preview -- --host 127.0.0.1 --port 5174
```

The build type-checks, bundles the application, and prerenders its professional content into `dist/index.html`. Deploy `dist/` to a static host. No paid assets, API keys, or backend are required for the core site. Essential identity, resume, project descriptions, contact details, and the fallback reactor remain readable without JavaScript.

## Edit the profile

`src/profile.ts` is the editable content source: name, role, biography, years of experience, artwork/alt text, projects, skills, education, certification, social links, resume URL, and contact endpoint.

Missing information is marked as pending. The project images are original concept artwork, not product screenshots. Client names, outcomes, project stacks, dates, educational institution, and certification verification have not been invented. Add files to `public/` and use paths such as `/images/project.png` or `/resume.pdf`.

## Reactor experience

One persistent WebGL canvas renders the same model during the boot sequence, hero inspection, and scroll-responsive background.

- **Boot:** components arrive from different depths, assemble in sequence, ignite, project the interface, and move into the hero over approximately 6.5 seconds.
- **Skip / replay:** Skip intro and Escape are available immediately. Replay boot sequence is visible below the reactor. The boot plays once per session; direct project/resume links bypass it.
- **Inspect:** drag the reactor housing with a mouse; use the visible left/right buttons or focus the model and use arrow keys. Reset view restores its orientation.
- **Exploded view:** separates the housing, coils, inner assembly, and core. Reassemble reverses the transition. Part labels appear during inspection.
- **Visual power:** Standby dims the core; Powered restores normal activity; Overdrive intensifies it for eight seconds and automatically returns to Powered. These are visual modes, not real hardware diagnostics.
- **Pulse:** click the core or use Pulse core. Energy travels through the strands attached to the hero content. Hover/focus also activates the corresponding connection.
- **Background:** the model moves into a subdued background position as the visitor scrolls. Mobile backgrounds stop rendering once the hero is offscreen.

The model has a segmented red-metal shell, machined steel rings, copper-colored coils, radial illuminated channels, glass, a white/cyan core, bounded particles, and controlled bloom. No external 3D models or paid assets are used.

## Motion, sound, and rendering

Experience settings include Full, Reduced, and Off motion modes, Pause Ambient Motion, optional synthesized sounds, and Auto/Low/High visual quality.

The first motion setting follows the operating system. Explicit motion and pause choices are saved locally. Sound starts muted and needs a user gesture. Reduced/Off retain a static 3D scene if supported and apply interaction changes immediately. They do not run ambient render loops.

The renderer caps pixel density and particle count, reduces quality after sustained slow frames, stops when the tab is hidden, and disposes of geometry, materials, environment maps, and postprocessing resources when unmounted. Unsupported WebGL, context loss, or a failed scene import leaves an SVG illustration and usable content. Animation failure cannot indefinitely block the page.

## Existing portfolio features

- Accessible navigation and mobile menu.
- Project filters, shareable detail dialogs, focus containment, Escape dismissal, and focus restoration.
- Interactive skill diagram plus a normal skill list.
- Expandable experience and certification records.
- Recruiter view at `/?view=resume#resume`.
- Project links at `/?project=supremo-ai` and `/?project=khoj-ai`.
- Print / Save as PDF renders only the readable resume, without the reactor, backgrounds, or controls.
- Contact validation, copy email, and truthful draft/submission feedback.

## Contact configuration

With `contactEndpoint: null`, the form opens a prepared draft in the visitor's email app. It does not send email and explicitly says so. The form also has a native mailto fallback without JavaScript.

To enable actual submission, configure `contactEndpoint` with a service that accepts `POST` JSON `{ name, email, message }`. Success is shown only for a successful HTTP response. Failures and a 12-second timeout are handled. Configure validation, delivery, and abuse protection on the server. Never put secret credentials in this frontend.

A dedicated PDF is not currently supplied; the print/save flow is available. Set `resumeUrl` when a downloadable PDF exists. Before public deployment, set canonical/absolute social metadata URLs to the final domain in `index.html` if required by the host or sharing service.

## Verification

With the production preview running on port 5174:

```sh
python3 tests/browser_test.py
```

Requires Python Playwright and its Chromium browser. The suite exercises the boot stages and skips, power modes, timed overdrive return, drag/keyboard inspection, explosion/reassembly, geometry reuse, motion/pause render-loop stopping, quality settings, projects, dialogs, skills, contact drafting, printing, recruiter mode, responsive widths, touch emulation, no-JavaScript content, and missing-asset/WebGL fallbacks.

`tests/reactor_recon.py` captures the actual boot phases and visual layouts. Outputs are in `test-results/iron/`. Browser emulation is not a physical-device certification. Real email delivery still depends on a configured backend.

## Source map

- `src/profile.ts` — editable profile data.
- `src/reactorModel.ts` — procedural reactor geometry and materials.
- `src/ReactorScene.tsx` — shared renderer, boot timeline, inspection, background, and lifecycle.
- `src/CinematicIntro.tsx` — intro chapters and accessible skip control.
- `src/ReactorControls.tsx` — power, inspection, pulse, and replay controls.
- `src/EnergyConnections.tsx` — geometry attached to actual hero elements.
- `src/MotionSettings.tsx` — motion, audio, and quality controls.
- `src/ProjectDetails.tsx` — shareable project details.
- `src/ResumeView.tsx` — professional and printable resume.
- `src/components.tsx` — shared dialog, arc emblem, artwork, SVG fallback, and scene error boundary.
- `src/styles.css` — visual tokens, responsive layout, interactions, and print styles.
- `public/fonts/` — self-hosted fonts and licenses.

The site is a personal themed portfolio; it has not been published automatically.
