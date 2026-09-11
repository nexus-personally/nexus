export type ResumeTemplateId =
  | 'tech-core'
  | 'tech-modern'
  | 'tech-minimal'
  | 'tech-executive'
  | 'tech-creative';

export type ResumeSectionType =
  | 'summary'
  | 'experience'
  | 'education'
  | 'projects'
  | 'skills'
  | 'certifications'
  | 'languages'
  | 'awards'
  | 'interests'
  | 'custom';

export type ResumeStatus = 'draft' | 'published' | 'archived';

export interface ResumeTheme {
  id: string;
  name: string;
  accent: string;
}

export interface ResumeTemplateMeta {
  id: ResumeTemplateId;
  name: string;
  description: string;
  photoDefault: 'hidden' | 'square' | 'circle';
  atsFriendly: boolean;
}

export interface ResumeProfile {
  fullName: string;
  headline: string;
  email: string;
  phone: string;
  location: string;
  website?: string;
  linkedin?: string;
  github?: string;
}

export interface ResumeSectionBase {
  id: string;
  type: ResumeSectionType;
  title: string;
  hidden: boolean;
}

export interface SummarySection extends ResumeSectionBase {
  type: 'summary';
  body: string;
}

export interface ExperiencePosition {
  id: string;
  title: string;
  startDate: string;
  endDate: string;
  bullets: string[];
}

export interface ExperienceItem {
  id: string;
  company: string;
  location: string;
  positions: ExperiencePosition[];
}

export interface ExperienceSection extends ResumeSectionBase {
  type: 'experience';
  items: ExperienceItem[];
}

export interface EducationItem {
  id: string;
  school: string;
  degree: string;
  location: string;
  dates: string;
}

export interface EducationSection extends ResumeSectionBase {
  type: 'education';
  items: EducationItem[];
}

export interface ProjectItem {
  id: string;
  name: string;
  role: string;
  description: string;
  technologies: string[];
  dates: string;
  projectUrl?: string;
  githubUrl?: string;
}

export interface ProjectsSection extends ResumeSectionBase {
  type: 'projects';
  items: ProjectItem[];
}

export interface SkillsSection extends ResumeSectionBase {
  type: 'skills';
  groups: Array<{ id: string; name: string; skills: string[] }>;
}

export interface SimpleListSection extends ResumeSectionBase {
  type: 'certifications' | 'languages' | 'awards' | 'interests' | 'custom';
  items: string[];
}

export type ResumeSection =
  | SummarySection
  | ExperienceSection
  | EducationSection
  | ProjectsSection
  | SkillsSection
  | SimpleListSection;

export interface ResumeContent {
  profile: ResumeProfile;
  sections: ResumeSection[];
}

export interface ResumeRecord {
  id: string;
  name: string;
  templateId: ResumeTemplateId;
  themeId: string;
  status: ResumeStatus;
  content: ResumeContent;
  sectionOrder: string[];
  createdAt: string;
  updatedAt: string;
  lastSavedAt?: string;
}

export interface ResumePublication {
  id: string;
  resumeId: string;
  slug: string;
  enabled: boolean;
  publishedSnapshot: ResumeRecord;
  publishedAt?: string;
  unpublishedAt?: string;
  seoTitle?: string;
  seoDescription?: string;
}

export const RESUME_TEMPLATES: ResumeTemplateMeta[] = [
  {
    id: 'tech-core',
    name: 'Tech Core',
    description: 'Dense ATS-first single-column resume for software and platform roles.',
    photoDefault: 'hidden',
    atsFriendly: true,
  },
  {
    id: 'tech-modern',
    name: 'Tech Modern',
    description: 'Modern tech layout with a narrow sidebar and grouped expertise.',
    photoDefault: 'square',
    atsFriendly: true,
  },
  {
    id: 'tech-minimal',
    name: 'Tech Minimal',
    description: 'Clean single-column layout with whitespace and light dividers.',
    photoDefault: 'hidden',
    atsFriendly: true,
  },
  {
    id: 'tech-executive',
    name: 'Tech Executive',
    description: 'Senior leadership resume emphasizing impact, progression, and scope.',
    photoDefault: 'hidden',
    atsFriendly: true,
  },
  {
    id: 'tech-creative',
    name: 'Tech Creative',
    description: 'Portfolio-facing technology layout with stronger visual identity.',
    photoDefault: 'circle',
    atsFriendly: false,
  },
];

export const RESUME_THEMES: ResumeTheme[] = [
  { id: 'signal-cyan', name: 'Signal Cyan', accent: '#0f9fb8' },
  { id: 'solar-gold', name: 'Solar Gold', accent: '#b87912' },
  { id: 'oxide-red', name: 'Oxide Red', accent: '#b43737' },
  { id: 'moss-green', name: 'Moss Green', accent: '#34785f' },
];

export const RESERVED_PUBLIC_SLUGS = new Set([
  'api',
  'app',
  'assets',
  'dashboard',
  'health',
  'login',
  'logout',
  'r',
  'resume',
  'settings',
]);

export function createStarterResume(
  id: string,
  name: string,
  templateId: ResumeTemplateId = 'tech-core',
): ResumeRecord {
  const now = new Date().toISOString();
  const sections: ResumeSection[] = [
    {
      id: 'summary',
      type: 'summary',
      title: 'Summary',
      hidden: false,
      body: 'Product-minded software engineer focused on reliable full-stack systems, elegant interfaces, and measurable delivery.',
    },
    {
      id: 'experience',
      type: 'experience',
      title: 'Experience',
      hidden: false,
      items: [
        {
          id: 'exp-1',
          company: 'NEXUS Labs',
          location: 'Remote',
          positions: [
            {
              id: 'pos-1',
              title: 'Full Stack Engineer',
              startDate: '2023',
              endDate: 'Present',
              bullets: [
                'Built TypeScript applications across Angular, NestJS, and PostgreSQL.',
                'Improved product workflows through focused UX polish and reliable APIs.',
              ],
            },
          ],
        },
      ],
    },
    {
      id: 'projects',
      type: 'projects',
      title: 'Projects',
      hidden: false,
      items: [
        {
          id: 'project-1',
          name: 'Resume Studio',
          role: 'Creator',
          description: 'Designed an inline A4 resume editor with template-controlled typography.',
          technologies: ['Angular', 'NestJS', 'PostgreSQL'],
          dates: '2026',
        },
      ],
    },
    {
      id: 'skills',
      type: 'skills',
      title: 'Skills',
      hidden: false,
      groups: [
        { id: 'skills-1', name: 'Frontend', skills: ['Angular', 'TypeScript', 'SCSS'] },
        { id: 'skills-2', name: 'Backend', skills: ['NestJS', 'PostgreSQL', 'REST APIs'] },
      ],
    },
  ];

  return {
    id,
    name,
    templateId,
    themeId: 'signal-cyan',
    status: 'draft',
    content: {
      profile: {
        fullName: 'Your Name',
        headline: 'Full Stack Engineer',
        email: 'you@example.com',
        phone: '+1 555 0100',
        location: 'United States',
        website: 'https://example.com',
        linkedin: 'https://linkedin.com/in/your-name',
        github: 'https://github.com/your-name',
      },
      sections,
    },
    sectionOrder: sections.map((section) => section.id),
    createdAt: now,
    updatedAt: now,
    lastSavedAt: now,
  };
}

export function normalizeSlug(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-|-$/g, '');
}

export function validateSlug(input: string): { ok: true; slug: string } | { ok: false; message: string } {
  const slug = normalizeSlug(input);

  if (slug.length < 3 || slug.length > 64) {
    return { ok: false, message: 'Slug must be between 3 and 64 characters.' };
  }

  if (!/^[a-z0-9][a-z0-9-]*[a-z0-9]$/.test(slug)) {
    return { ok: false, message: 'Slug can contain lowercase letters, numbers, and hyphens.' };
  }

  if (RESERVED_PUBLIC_SLUGS.has(slug)) {
    return { ok: false, message: 'That URL is reserved.' };
  }

  return { ok: true, slug };
}
