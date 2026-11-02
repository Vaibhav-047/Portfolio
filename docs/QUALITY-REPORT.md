> Historical report for the previous Field Notes version. The current Personal Computer portfolio no longer includes Quality Lab, Rust, JavaScript as a listed skill, or the Personal Computer project. Use the current README and tests/pc_check.py for the active implementation.

# Portfolio Quality Lab — implementation and evidence

Reviewed November 1, 2026. This is an implementation report, not a fabricated partner review or a claim of passing every human judgement in the PDF.

## Scope and audience

Primary audience: potential collaborators and freelance clients. The first screen identifies Vaibhav Tripathi as a frontend developer in Pune and offers a direct path to work. The public worksheet also serves students reviewing their own portfolios.

All four pages of the source PDF were extracted and visually inspected. Its thirteen exercises, audit questions, improvement prompts, release checklist, and optional stretch are included on `/quality-lab`; the original PDF is linked there. No blank worksheet responses were interpreted as facts about the owner.

## Coverage

| PDF topic | Implementation / evidence |
| --- | --- |
| 10-second test | Clear name, role, and work CTA; actual partner recall has not been tested. Worksheet fields remain blank for the visitor. |
| Audience | Collaborator/client navigation, work, contact, resume. Worksheet supports selecting a different primary audience. |
| Freeze version 1 | `test-results/field-notes/before.png` and previous source snapshot saved before replacement. |
| Identity / credibility | User-supplied bio and experience; no invented clients, metrics, testimonials, dates, or institutions. Field Notes has a concrete case study disclosing AI collaboration. Supremo AI and Khoj AI explicitly have unpublished details. Their problem/contribution still require owner input. |
| Visual choices | Original paper sculpture; restrained ivory/charcoal/rust/olive palette; local readable type; distinct project, narrative, skill, and contact layouts. |
| Visitor journey | Conventional section labels, mobile menu, working filters and focus-managed dialogs, public worksheet link, direct email/GitHub, print resume. |
| No-HTML editing | All active portfolio facts/projects in `src/content.json`; editing instructions in README. About sentence and project add/edit/remove exercised with a temporary fixture; original data restored. |
| Persistence | Source edits appear after reload and in a fresh browser context against the local dev server. Publication requires rebuilding and deployment. Worksheet answers use localStorage and explicitly do not sync. Tested reload, fresh-context isolation, export, reset. |
| Real-world tests | Chromium at 320, 390, 768, 1440 px: no horizontal overflow. Keyboard sculpture control, Escape/focus restoration, mobile menu, native disclosure, clipboard feedback, print view, saved/OS reduced motion, worksheet input, PDF response. |
| Prompts / iteration log | The public page includes the full prompt frame and two iteration record sets. Actual changes below. |
| Peer review | Not performed. Public fields are for real peer responses. |
| Release gate | Technical checks passed as listed below; owner claims, human review, and publication remain separate. |
| Optional stretch | No authenticated CMS or cross-device answer syncing; no screen-reader certification claimed. |

## Meaningful iterations

1. **Identity clarity:** the early hero introduced only “Vaibhav” with the surname in a small wordmark. The hero now displays the full name from the same content file. Desktop and phone screenshots were inspected after the change.
2. **Accessible worksheet selection:** the browser check could not resolve the audience selector by its exact accessible name. An explicit accessible label fixes the ambiguity. The test now selects “Someone else”, fills its description, reloads, and verifies the saved values.
3. **Content-edit test reliability:** rapid file writes followed immediately by reload raced Vite's file watcher. The test waits briefly for source invalidation, then verifies the result. Source restoration is in a `finally` block; no QA project is retained.

## Commands and results

- `npx tsc --noEmit`: passed.
- `npm run build`: passed.
- `python3 tests/field_notes_check.py`: passed. Project filters, dialog/Escape/focus/shareable hash, keyboard sculpture, pause, skills, clipboard, print, motion preferences, responsive layouts, all 13 exercises, answer persistence/isolation/export/reset, original PDF; no runtime errors observed.
- `python3 tests/field_notes_visual.py`: passed. Pointer drag, scroll-driven sculpture transforms, offscreen ambient pause, keyboard worksheet entry; viewport screenshots captured and inspected.
- `python3 tests/content_edit_check.py`: temporary source-file editing workflow exercised and original data restored. The local development server is the test target; no deployment is implied.

Screenshots: `test-results/field-notes/hero-final.png`, `mobile-final.png`, `scroll-final.png`, `lab-mobile.png`, `quality-lab.png`. The test-results directory is ignored by Git.

## Honest limits

Not tested on physical phones, Safari, Firefox, or with a screen reader. No actual email was sent; the mailto destination and clipboard behavior were checked. No public deployment or friend-device check was performed. Worksheet data is local to each browser and can be erased by clearing browser data. The supplied professional claims have not been independently verified. Supremo AI and Khoj AI need real case-study details before their individual credibility criteria can be marked complete.
