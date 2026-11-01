# Freefall adaptation

Reference inspected: https://github.com/gireeshkumarreddy/freefall-portfolio-code

The reference's key mechanisms are one scroll-controlled fall, depth typography, an impact transition, a rise reveal, project showcases, and a final doorway. Its original films and images are excluded from the linked code-only repository.

This portfolio implements an original interpretation in the existing React app: a procedural beveled armored figure with an arc-reactor chest and repulsors; gold shaft lighting; flying type; altitude tied to story scroll progress; a landing pulse; a rise reveal; and a doorway treatment before contact. No reference code or film files are bundled. Existing profile information stays in `src/profile.ts`.

Run `npm run dev -- --host 127.0.0.1 --port 5173`, then scroll. Activate Repulsors gives a brief cyan thrust boost. Skip to Profile and header navigation jump directly to content. Recruiter View skips the story. Experience settings control motion, ambient pause, audio, and rendering quality.

Build: `npm run build`. Browser verification: `python3 tests/freefall_check.py`. This covers the live scene, story chapters, project dialogs, recruiter mode, four screen widths, and OS reduced-motion behavior.
