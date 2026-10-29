/** The single source of truth. Replace null values with verified information. */
export const profile = {
  name: 'Vaibhav Tripathi', role: 'Frontend Developer',
  introduction: 'I make good frontend for people willing to pay.',
  bio: 'Hi, I’m Vaibhav from Pune, India. I’m a frontend developer, and I like listening to music.',
  location: 'Pune, India', email: 'raunaktripathi047@gmail.com',
  github: 'https://github.com/Vaibhav-047', linkedin: null as string | null,
  otherLinks: [] as { label: string; url: string }[],
  availability: 'Available for freelance', photo: '/images/profile.png',
  photoAlt: 'Vaibhav’s chosen profile artwork: Charizard breathing fire',
  yearsExperience: 3,
  resumeUrl: null as string | null,
  /** Set to a service accepting POST JSON {name,email,message}. Never put secret keys here. */
  contactEndpoint: null as string | null,
  experience: [{
    role: 'Freelance Frontend Developer', company: 'Independent', duration: '3 years', dates: null as string | null,
    summary: 'Three years of freelance experience, working on premium projects for a range of clients.',
    responsibilities: ['Frontend development for client projects.', 'Premium freelance project work.'],
    note: 'Client names, project outcomes, and exact dates will be added when available.'
  }],
  projects: [
    { id: 'supremo-ai', name: 'Supremo AI', number: '01', category: 'Supremo AI', kind: 'Featured project', visual: 'supremo',
      description: 'A selected project from my portfolio. The full story is coming soon.',
      problem: null, contribution: null, approach: null, outcome: null,
      technologies: [] as string[], demo: null as string | null, source: null as string | null,
      preview: null as string | null },
    { id: 'khoj-ai', name: 'Khoj AI', number: '02', category: 'Khoj AI', kind: 'Featured project', visual: 'khoj',
      description: 'A selected project from my portfolio. The full story is coming soon.',
      problem: null, contribution: null, approach: null, outcome: null,
      technologies: [] as string[], demo: null as string | null, source: null as string | null,
      preview: null as string | null }
  ],
  skillGroups: [
    { name: 'Frontend', skills: ['HTML', 'CSS', 'JavaScript'] },
    { name: 'Programming', skills: ['Python', 'Rust'] }
  ],
  education: { degree: 'B.Tech. Computer Science & Engineering', specialization: 'Artificial Intelligence & Machine Learning', institution: null as string | null, dates: null as string | null },
  certification: { title: 'Python Course Completion', issuer: null as string | null, date: null as string | null, url: null as string | null },
  testimonials: [] as { quote: string; name: string; role: string }[]
};
export type Project = typeof profile.projects[number];
