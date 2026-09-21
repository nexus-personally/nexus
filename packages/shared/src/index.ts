export type ResumeTemplateId =
  'tech-core' | 'tech-modern' | 'tech-minimal' | 'tech-executive' | 'tech-creative';

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

export interface ResumeColors {
  accent: string;
  heading: string;
  body: string;
  name: string;
  headline: string;
  contact: string;
  sectionTitle: string;
  organization: string;
  role: string;
  meta: string;
  description: string;
  bullet: string;
  skillLabel: string;
  skillText: string;
}

export interface ResumePhotoCrop {
  x: number;
  y: number;
  zoom: number;
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
  photoSourceDataUrl?: string;
  photoDataUrl?: string;
  photoVisible?: boolean;
  photoCrop?: ResumePhotoCrop;
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
  colors?: ResumeColors;
  fieldColors?: Record<string, string>;
  typography?: ResumeTypography;
  fieldTypography?: Record<string, ResumeTypography>;
  /** Sanitized inline emphasis for contenteditable fields, keyed like fieldTypography. */
  richText?: Record<string, string>;
  status: ResumeStatus;
  content: ResumeContent;
  sectionOrder: string[];
  createdAt: string;
  updatedAt: string;
  lastSavedAt?: string;
}

/** Optional overrides; missing values preserve the chosen template's typography. */
export interface ResumeTypography {
  fontFamily?: string;
  fontScale?: number;
  fontSize?: number;
  fontWeight?: number;
  fontStyle?: 'normal' | 'italic';
  letterSpacing?: number;
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
    name: 'ATS Classic',
    description: 'Clean, ATS-friendly single-column layout for any profession.',
    photoDefault: 'circle',
    atsFriendly: true,
  },
  {
    id: 'tech-modern',
    name: 'Modern Profile',
    description: 'Two-column layout with an optional profile photo and clear hierarchy.',
    photoDefault: 'circle',
    atsFriendly: true,
  },
  {
    id: 'tech-minimal',
    name: 'Minimal',
    description: 'Balanced two-column layout with a profile header and focused skill blocks.',
    photoDefault: 'circle',
    atsFriendly: true,
  },
  {
    id: 'tech-executive',
    name: 'Executive',
    description: 'Classic serif CV emphasizing leadership, progression, and impact.',
    photoDefault: 'circle',
    atsFriendly: true,
  },
  {
    id: 'tech-creative',
    name: 'Creative',
    description: 'Editorial portfolio resume with stronger color and visual identity.',
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

function resumeColorDefaults(
  accent: string,
  heading: string,
  body: string,
  overrides: Partial<ResumeColors> = {},
): ResumeColors {
  return {
    accent,
    heading,
    body,
    name: heading,
    headline: accent,
    contact: body,
    sectionTitle: accent,
    organization: heading,
    role: heading,
    meta: body,
    description: body,
    bullet: body,
    skillLabel: heading,
    skillText: body,
    ...overrides,
  };
}

export const RESUME_TEMPLATE_COLOR_DEFAULTS: Record<ResumeTemplateId, ResumeColors> = {
  'tech-core': resumeColorDefaults('#0f9fb8', '#20272a', '#30383b'),
  'tech-modern': resumeColorDefaults('#34b9c2', '#17262b', '#30383b', {
    name: '#ffffff',
    headline: '#8ed8df',
    contact: '#c2ced0',
  }),
  'tech-minimal': resumeColorDefaults('#356d72', '#282c2e', '#373d3f', {
    contact: '#ffffff',
  }),
  'tech-executive': resumeColorDefaults('#8c6a35', '#1d2427', '#303638', {
    role: '#8c6a35',
    skillLabel: '#8c6a35',
  }),
  'tech-creative': resumeColorDefaults('#d45a69', '#20262a', '#30373a', {
    name: '#ffffff',
    headline: '#eda6af',
    contact: '#cbd6d7',
    sectionTitle: '#ffffff',
  }),
};

export function resolveResumeColors(
  resume: Pick<ResumeRecord, 'templateId' | 'themeId' | 'colors'>,
) {
  const defaults = RESUME_TEMPLATE_COLOR_DEFAULTS[resume.templateId];
  if (resume.colors) {
    const stored = resume.colors as Partial<ResumeColors>;
    return {
      ...defaults,
      ...stored,
      name: stored.name ?? stored.heading ?? defaults.name,
      headline: stored.headline ?? stored.accent ?? defaults.headline,
      contact: stored.contact ?? stored.body ?? defaults.contact,
      sectionTitle: stored.sectionTitle ?? stored.accent ?? defaults.sectionTitle,
      organization: stored.organization ?? stored.heading ?? defaults.organization,
      role: stored.role ?? stored.heading ?? defaults.role,
      meta: stored.meta ?? stored.body ?? defaults.meta,
      description: stored.description ?? stored.body ?? defaults.description,
      bullet: stored.bullet ?? stored.body ?? defaults.bullet,
      skillLabel: stored.skillLabel ?? stored.heading ?? defaults.skillLabel,
      skillText: stored.skillText ?? stored.body ?? defaults.skillText,
    };
  }

  const legacyAccent = RESUME_THEMES.find((theme) => theme.id === resume.themeId)?.accent;
  return { ...defaults, accent: legacyAccent ?? defaults.accent };
}

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
    colors: { ...RESUME_TEMPLATE_COLOR_DEFAULTS[templateId] },
    status: 'draft',
    content: {
      profile: {
        fullName: 'Your Name',
        headline: 'Full Stack Engineer',
        email: 'you@example.com',
        phone: '+1 555 0100',
        location: 'United States',
        photoVisible: false,
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

export function validateSlug(
  input: string,
): { ok: true; slug: string } | { ok: false; message: string } {
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
