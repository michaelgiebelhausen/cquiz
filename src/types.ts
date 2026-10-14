export type Person = { id: string; name: string; round?: number };
export type RatingTask = {
  responseId: string;
  speaker: Person;
  speaking: boolean;
};
export type StudentState = {
  id: string;
  name: string;
  mode: string;
  status: string;
  phase: string;
  paused: boolean;
  round: number;
  deadline: number | null;
  remaining: number | null;
  serverTime: number;
  revision: number;
  person: Person & { preflight: boolean };
  table: null | {
    id: string;
    number: number;
    phase: string;
    members: Person[];
    speaker: Person | null;
  };
  question: null | { id: string; prompt: string; topic: string };
  invitation: null | {
    id: string;
    closesAt: number;
    eligible: boolean;
    volunteered: boolean;
  };
  ratings: RatingTask[];
  ownResponses: {
    id: string;
    text: string;
    flagged: boolean;
    submitted: boolean;
  }[];
  currentOwn: null | {
    id: string;
    text: string;
    submitted: boolean;
    draftVersion: number;
  };
  nextTable: null | { number: number; members: Person[] };
  diagnostics: Person[];
};
export type Settings = {
  roundSeconds: number;
  transitionSeconds: number;
  invitationSeconds: number;
  rounds: number;
  weights: { ai: number; peer: number; willingness: number };
};
export type Provider = {
  model: string;
  hasKey: boolean;
  zdr: boolean;
  testedAt: number | null;
};
export type Insight = {
  id: string;
  text: string;
  weight: number;
  guidance: string;
  source: string;
};
export type Question = {
  id: string;
  topic: string;
  prompt: string;
  difficulty: number;
  insights: Insight[];
};
export type RosterPerson = Person & {
  email: string;
  joined?: boolean;
  preflight?: boolean;
  active?: boolean;
};
export type Ranking = Person & {
  rank: number;
  score: number;
  points: number;
  ai: number;
  peer: number;
  willingness: number;
  eligible: number;
  volunteered: number;
  answers: number;
  topics: number;
  peerCount: number;
  influence: number;
  flags: number;
  evidence: string;
  uncertainty: number;
};
export type Contribution = {
  id: string;
  studentId: string;
  round: number;
  tableId: string;
  questionId: string;
  text: string;
  submittedAt: number | null;
  flagged: boolean;
  flagReason: string | null;
  points: number;
  expectedRaters: string[];
  evaluation: {
    status: string;
    error?: string;
    explanation?: string;
    correctness?: number;
    depth?: number;
    model?: string;
    attempts: number;
  };
  creditedInsights: {
    id: string;
    credit: number;
    weight: number;
    reason: string;
  }[];
};
export type ExamSummary = {
  id: string;
  name: string;
  status: string;
  phase: string;
  mode: string;
  round: number;
  participants: number;
  createdAt: number;
};
export type AdminState = {
  provider: Provider;
  bank: Question[];
  roster: RosterPerson[];
  exams: ExamSummary[];
};
export type Exam = ExamSummary & {
  roster: RosterPerson[];
  bank: Question[];
  settings: Settings;
  deadline: number | null;
  paused: boolean;
  remaining: number | null;
  online: string[];
  responses: Contribution[];
  ratings: {
    id: string;
    responseId: string;
    raterId: string;
    targetId: string;
    values: number[];
    currentWeight: number;
    rankSnapshot: { rank: number; ai: number; peer: number };
  }[];
  ranking: Ranking[];
  rankingMeta: {
    converged: boolean;
    iterations: number;
    at: number;
    method: string;
  };
  pendingRatings: number;
  pendingDiagnostics: number;
  tables: {
    id: string;
    number: number;
    phase: string;
    members: string[];
    speakerId: string | null;
    questionId: string | null;
    currentResponseId: string | null;
  }[];
  nextGroups?: {
    id: string;
    number: number;
    members: string[];
    reason: string;
  }[];
};
