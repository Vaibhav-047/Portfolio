// Kept apart from tree.ts so the page shell can import it without pulling in Three.js.
export const SECTION_IDS = ['about', 'projects', 'skills', 'journey', 'contact'] as const;
export type SectionId = typeof SECTION_IDS[number];
