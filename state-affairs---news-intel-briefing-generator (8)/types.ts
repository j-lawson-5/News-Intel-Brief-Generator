
export type Industry = string;

export enum DateRange {
  Past30 = 30,
  Past60 = 60,
  Past90 = 90
}

export interface Article {
  title: string;
  date: string;
  url: string;
  topic: string; // Used to store 'Relevance Reason' from backend for semantic categorization
  state: string;
  category: string; // Target for auto-categorization (e.g., Regulatory, Legislation)
  summary?: string;
}

export interface RegionalData {
  state: string;
  status: string;
  impact: string;
}

export interface BriefingContent {
  bluf: {
    intro: string;
    bullets: string[];
    actions: string[];
  };
  forcingFunction?: {
    what: string;
    forecast: string[];
    why: string;
  };
  signals: {
    title: string;
    activity: string;
    developments: string[];
  }[];
  regional: RegionalData[];
  watchList: string[];
  sources: { title: string; url: string }[];
  strategicInsight: {
    title: string;
    insight: string;
  };
}

export interface Version {
  num: number;
  createdAt: string;
  createdBy: string;
  content: BriefingContent;
}

export interface Briefing {
  id: string;
  topic: Industry;
  dateRange: DateRange;
  context: string;
  articleCount: number;
  versions: Version[];
  currentVersion: number;
}
