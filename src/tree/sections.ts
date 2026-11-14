/** Scroll stops shared by the DOM overlays and the 3D camera path. Order = scroll order. */
export const SECTIONS = [
  { id: 'roots', label: 'Roots' },
  { id: 'about', label: 'About' },
  { id: 'skills', label: 'Skills' },
  { id: 'projects', label: 'Projects' },
  { id: 'experience', label: 'Experience' },
  { id: 'contact', label: 'Contact' },
  { id: 'resume', label: 'Resume' },
  { id: 'canopy', label: 'Canopy' },
] as const;
export type SectionId = typeof SECTIONS[number]['id'];

/** Scroll progress (0..1) at which each section's card is centred in the viewport. */
export function measureStops(): number[] {
  const max = Math.max(1, document.documentElement.scrollHeight - innerHeight);
  return SECTIONS.map((s, i) => {
    if (i === 0) return 0;
    if (i === SECTIONS.length - 1) return 1;
    const el = document.getElementById(s.id);
    if (!el) return i / (SECTIONS.length - 1);
    return Math.min(1, Math.max(0, (el.offsetTop + el.offsetHeight / 2 - innerHeight / 2) / max));
  });
}

export function scrollProgress() {
  return Math.min(1, Math.max(0, scrollY / Math.max(1, document.documentElement.scrollHeight - innerHeight)));
}
