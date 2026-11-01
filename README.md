# Vaibhav Tripathi — Field Notes

An original interactive portfolio: warm paper, serif typography, an interactive folded-paper sculpture, a scroll-driven idea journey, and a public Portfolio Quality Lab. No anime or superhero assets are loaded by the active site.

## Run

```sh
npm install
npm run dev -- --host 127.0.0.1 --port 5173
npm run build
npx tsc --noEmit
npm run test:e2e
```

The browser test needs Python Playwright and Chromium, with the dev server running. `src/manga-main.tsx` is the historical entry filename; it now loads `src/FieldNotes.tsx` and `src/field-notes.css`. Earlier designs remain inactive for recovery.

## Update content without HTML

Edit **`src/content.json`**. Change `bio` to update About. Add, edit, or remove objects in `projects`. Each project needs a unique `id`, `name`, `category`, `status`, `description`, `technologies` array, and the `problem`, `contribution`, `approach`, `outcome`, `url`, and `source` keys (use `null` where unpublished). Copy an existing project object to preserve its structure. Categories currently filter as All / Web / AI. Use real claims only; a learning project with an honest status is enough.

Optional live/source links must begin with `https://` or `http://`; missing links are omitted. Do not put credentials, a private address, or secrets in this public file. The existing content includes public contact information supplied by the owner. No institutional names, client names, results, or project metrics have been invented.

Vite picks up changes while developing. For a published site, rebuild and deploy the updated files for visitors to see the change. Editing the source file is a shared-content workflow **only after deployment**. There is no public administrative editor or authenticated backend.

The `<noscript>` summary and HTML metadata in `index.html` are static fallbacks; update these too if identity/contact details change. They do not control the interactive site's content.

## Quality Lab

Visit **`/quality-lab`**. All 13 exercises from the supplied four-page worksheet are available, with the original PDF at `public/documents/portfolio-quality-lab.pdf`. The PDF is an assessment worksheet, not the owner's CV. The public page presents its instructions to visitors; they are not automatic claims that the portfolio passed them.

Answers save to **this browser profile's localStorage** under `vt-quality-lab-v1`. They are not transmitted or published. Incognito windows and other devices have separate drafts. Storage failure shows a warning. Export produces a JSON file; Reset asks before clearing the current draft. Browser-data clearing deletes saved answers. There is no cross-device sync, grading, or fabricated peer review.

A static host must route `/quality-lab` to `index.html` (SPA fallback). Vite's development/preview servers already do this. Asset paths assume deployment at the domain root.

## Interactions and accessibility

- Pointer drag or keyboard range control turns the original SVG paper sculpture.
- Ambient floating pauses via the adjacent control and when the sculpture is offscreen or the browser tab is hidden.
- Native scrolling drives the paper-sculpture fall and oversized type. No forced scrolling.
- Motion mode honors the OS initially and persists locally; reduced mode makes the journey static and shorter.
- Filters, native skill disclosures, focus-managed project dialogs, shareable project hashes, clipboard feedback, and mobile navigation work without hidden hover-only content.
- Email uses the visitor's email app. No contact submission backend is claimed.
- Print / Save resume uses selectable text. No resume PDF was supplied.
- A static no-JavaScript summary and original worksheet PDF remain available.

## References and verification

See `docs/QUALITY-REPORT.md` for the PDF criteria, evidence, and human-review limits. See `docs/DESIGN-REFERENCES.md` for references. Browser screenshots are in `test-results/field-notes/` (ignored by Git).
