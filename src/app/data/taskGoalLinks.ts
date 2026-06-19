import { getPersonalGoals, type PersonalGoal } from './personalGoals';
import { getAllTasksForProfile, type Task } from './profiles';

// ──────────────────────────────────────────────
// Task-Goal Link Types
// ──────────────────────────────────────────────

export interface TaskGoalLink {
  taskId: string;
  goalId: string;
  profileId: string;
  suggestedAmount?: number; // Default amount to suggest when task is completed
  isUserCreated: boolean; // true if user manually created, false if from smart suggestions
  createdAt: number;
}

export interface TaskGoalSuggestion {
  goal: PersonalGoal;
  reason: string; // Why this goal is suggested
  suggestedAmount: number;
  confidence: 'high' | 'medium' | 'low';
}

// ──────────────────────────────────────────────
// LocalStorage Helpers
// ──────────────────────────────────────────────

function linkKey(profileId: string) {
  return `arbol-task-goal-links-${profileId}`;
}

function rejectedKey(profileId: string) {
  return `arbol-rejected-suggestions-${profileId}`;
}

// Default links seeded on first load (before user creates any)
const DEFAULT_TASK_GOAL_LINKS: TaskGoalLink[] = [
  // Rafael: Sunday Work → Emergency Fund (direct income source)
  { taskId: 'rafael-sun-1', goalId: 'rafael-emergency-fund', profileId: 'rafael', suggestedAmount: 200, isUserCreated: false, createdAt: 0 },
  // Rafael: Study tasks → Emergency Fund (academic progress → career → savings)
  { taskId: 'rafael-mon-2', goalId: 'rafael-emergency-fund', profileId: 'rafael', suggestedAmount: 0, isUserCreated: false, createdAt: 0 },
  { taskId: 'rafael-mon-5', goalId: 'rafael-emergency-fund', profileId: 'rafael', suggestedAmount: 0, isUserCreated: false, createdAt: 0 },
  { taskId: 'rafael-tue-2', goalId: 'rafael-emergency-fund', profileId: 'rafael', suggestedAmount: 0, isUserCreated: false, createdAt: 0 },
  { taskId: 'rafael-tue-4', goalId: 'rafael-emergency-fund', profileId: 'rafael', suggestedAmount: 0, isUserCreated: false, createdAt: 0 },
  { taskId: 'rafael-wed-4', goalId: 'rafael-emergency-fund', profileId: 'rafael', suggestedAmount: 0, isUserCreated: false, createdAt: 0 },
  { taskId: 'rafael-thu-3', goalId: 'rafael-emergency-fund', profileId: 'rafael', suggestedAmount: 0, isUserCreated: false, createdAt: 0 },
  { taskId: 'rafael-fri-2', goalId: 'rafael-emergency-fund', profileId: 'rafael', suggestedAmount: 0, isUserCreated: false, createdAt: 0 },
  { taskId: 'rafael-fri-4', goalId: 'rafael-emergency-fund', profileId: 'rafael', suggestedAmount: 0, isUserCreated: false, createdAt: 0 },
  { taskId: 'rafael-sat-4', goalId: 'rafael-emergency-fund', profileId: 'rafael', suggestedAmount: 0, isUserCreated: false, createdAt: 0 },
  { taskId: 'rafael-sun-2', goalId: 'rafael-emergency-fund', profileId: 'rafael', suggestedAmount: 0, isUserCreated: false, createdAt: 0 },
];

export function getTaskGoalLinks(profileId: string): TaskGoalLink[] {
  const stored = localStorage.getItem(linkKey(profileId));
  if (stored) return JSON.parse(stored);

  // Seed defaults on first load
  const defaults = DEFAULT_TASK_GOAL_LINKS.filter(l => l.profileId === profileId);
  if (defaults.length > 0) {
    saveTaskGoalLinks(profileId, defaults);
    return defaults;
  }
  return [];
}

export function saveTaskGoalLinks(profileId: string, links: TaskGoalLink[]) {
  localStorage.setItem(linkKey(profileId), JSON.stringify(links));
}

export function addTaskGoalLink(link: TaskGoalLink) {
  const links = getTaskGoalLinks(link.profileId);
  // Check if link already exists
  const exists = links.find(l => l.taskId === link.taskId && l.goalId === link.goalId);
  if (exists) return;

  links.push(link);
  saveTaskGoalLinks(link.profileId, links);
}

export function removeTaskGoalLink(profileId: string, taskId: string, goalId: string) {
  const links = getTaskGoalLinks(profileId);
  const filtered = links.filter(l => !(l.taskId === taskId && l.goalId === goalId));
  saveTaskGoalLinks(profileId, filtered);
}

export function getLinksForTask(profileId: string, taskId: string): TaskGoalLink[] {
  const links = getTaskGoalLinks(profileId);
  return links.filter(l => l.taskId === taskId);
}

// Track rejected suggestions to avoid re-suggesting
export function markSuggestionRejected(profileId: string, taskId: string, goalId: string) {
  const stored = localStorage.getItem(rejectedKey(profileId));
  const rejected: Record<string, string[]> = stored ? JSON.parse(stored) : {};

  if (!rejected[taskId]) rejected[taskId] = [];
  if (!rejected[taskId].includes(goalId)) {
    rejected[taskId].push(goalId);
  }

  localStorage.setItem(rejectedKey(profileId), JSON.stringify(rejected));
}

export function wasRejected(profileId: string, taskId: string, goalId: string): boolean {
  const stored = localStorage.getItem(rejectedKey(profileId));
  if (!stored) return false;
  const rejected: Record<string, string[]> = JSON.parse(stored);
  return rejected[taskId]?.includes(goalId) ?? false;
}

// ──────────────────────────────────────────────
// Smart Suggestion Engine
// ──────────────────────────────────────────────

// Keyword mapping for smart suggestions
const GOAL_KEYWORDS: Record<string, { keywords: string[]; amountRange: [number, number] }> = {
  savings: {
    keywords: ['save', 'budget', 'frugal', 'cut', 'reduce', 'avoid', 'skip', 'cook', 'home', 'diy'],
    amountRange: [50, 200],
  },
  investment: {
    keywords: ['invest', 'etf', 'stock', 'portfolio', 'financial', 'career', 'learn', 'study', 'skill'],
    amountRange: [100, 500],
  },
  health: {
    keywords: ['exercise', 'workout', 'walk', 'run', 'gym', 'wellness', 'health', 'stretch', 'water'],
    amountRange: [0, 100], // Often time investment, sometimes money saved
  },
  education: {
    keywords: ['study', 'learn', 'read', 'course', 'class', 'homework', 'assignment', 'exam', 'review'],
    amountRange: [0, 50],
  },
  productivity: {
    keywords: ['work', 'focus', 'complete', 'finish', 'task', 'priority', 'goal', 'plan'],
    amountRange: [0, 0], // Time-based, not money
  },
};

// Category-to-goal type mapping
const CATEGORY_GOAL_MAP: Record<string, string[]> = {
  'wellness': ['savings', 'health'],
  'class-flow': ['education', 'investment'],
  'main-priorities': ['productivity', 'investment'],
  'personal-goals': ['investment', 'savings'],
  // Kyle categories
  'k-internship': ['investment', 'productivity'],
  'k-study': ['education', 'investment'],
  'k-wellness': ['health', 'savings'],
  // Rafael categories
  'r-school': ['education', 'savings'],
  'r-wellness': ['health', 'savings'],
  // John categories
  'j-priorities': ['productivity', 'savings'],
  'j-career': ['investment', 'productivity'],
  'j-wellness': ['health', 'savings'],
};

function matchesKeywords(text: string, keywords: string[]): number {
  const lowerText = text.toLowerCase();
  let matches = 0;
  keywords.forEach(keyword => {
    if (lowerText.includes(keyword)) matches++;
  });
  return matches;
}

function getGoalTypeFromTask(task: Task): { type: string; confidence: 'high' | 'medium' | 'low' } | null {
  // Check category mapping first
  const categoryMatches = CATEGORY_GOAL_MAP[task.category];

  // Check keywords in task label
  let bestMatch: { type: string; score: number } | null = null;

  Object.entries(GOAL_KEYWORDS).forEach(([type, config]) => {
    const score = matchesKeywords(task.label, config.keywords);
    if (score > 0 && (!bestMatch || score > bestMatch.score)) {
      bestMatch = { type, score };
    }
  });

  // Category match + keyword match = high confidence
  if (categoryMatches && bestMatch && categoryMatches.includes(bestMatch.type)) {
    return { type: bestMatch.type, confidence: 'high' };
  }

  // Category match only = medium confidence
  if (categoryMatches && categoryMatches.length > 0) {
    return { type: categoryMatches[0], confidence: 'medium' };
  }

  // Keyword match only = medium/low confidence
  if (bestMatch) {
    return { type: bestMatch.type, confidence: bestMatch.score >= 2 ? 'medium' : 'low' };
  }

  return null;
}

function getSuggestedAmount(goalType: string, task: Task): number {
  const config = GOAL_KEYWORDS[goalType];
  if (!config) return 0;

  const [min, max] = config.amountRange;

  // Task type influences amount
  if (task.type === 'priority') return max;
  if (task.type === 'goal') return Math.round((min + max) / 2);
  return min; // routine
}

function getReason(goalType: string, task: Task, goal: PersonalGoal): string {
  const reasons: Record<string, string> = {
    savings: `Completing "${task.label}" can help you save toward your ${goal.title}`,
    investment: `"${task.label}" builds skills/knowledge that support your ${goal.title}`,
    health: `Staying healthy with "${task.label}" helps you avoid future expenses`,
    education: `Learning from "${task.label}" is an investment in your future`,
    productivity: `Completing "${task.label}" moves you closer to your goals`,
  };

  return reasons[goalType] || `"${task.label}" supports your ${goal.title}`;
}

export function getSmartSuggestions(
  profileId: string,
  task: Task
): TaskGoalSuggestion[] {
  // Get user's goals
  const goals = getPersonalGoals(profileId);
  if (goals.length === 0) return [];

  // Check existing links
  const existingLinks = getLinksForTask(profileId, task.id);

  // Get goal type from task
  const match = getGoalTypeFromTask(task);
  if (!match) return [];

  const suggestions: TaskGoalSuggestion[] = [];

  // Match goals to the detected type
  goals.forEach(goal => {
    // Skip if already linked
    if (existingLinks.find(l => l.goalId === goal.id)) return;

    // Skip if previously rejected
    if (wasRejected(profileId, task.id, goal.id)) return;

    // Match goal type to suggestion
    let shouldSuggest = false;

    // Emergency fund / savings goals
    if ((goal.title.toLowerCase().includes('save') ||
         goal.title.toLowerCase().includes('emergency') ||
         goal.title.toLowerCase().includes('fund')) &&
        (match.type === 'savings' || match.type === 'health')) {
      shouldSuggest = true;
    }

    // Investment / ETF goals
    if ((goal.title.toLowerCase().includes('invest') ||
         goal.title.toLowerCase().includes('etf') ||
         goal.title.toLowerCase().includes('portfolio')) &&
        (match.type === 'investment' || match.type === 'education' || match.type === 'productivity')) {
      shouldSuggest = true;
    }

    if (shouldSuggest) {
      suggestions.push({
        goal,
        reason: getReason(match.type, task, goal),
        suggestedAmount: getSuggestedAmount(match.type, task),
        confidence: match.confidence,
      });
    }
  });

  // Sort by confidence
  return suggestions.sort((a, b) => {
    const confidenceOrder = { high: 3, medium: 2, low: 1 };
    return confidenceOrder[b.confidence] - confidenceOrder[a.confidence];
  });
}
