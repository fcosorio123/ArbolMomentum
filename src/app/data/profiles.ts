// ──────────────────────────────────────────────
// Value Tracking (Reward System)
// ──────────────────────────────────────────────
export interface ValueStats {
  money: number;      // ₱ saved/earned
  health: number;     // calories burned
  opportunity: number; // applications sent, connections made
}

export interface Profile {
  id: string;
  name: string;
  tagline: string;
  // Daily streaks (existing)
  streak: number;
  bestStreak: number;
  // Weekly streaks (Strava-style)
  weeklyStreak: number;
  bestWeeklyStreak: number;
  // Monthly streaks (Strava-style)
  monthlyStreak: number;
  bestMonthlyStreak: number;
  // Profile info
  role: string;
  avatar: string;
  joinedWeek: number;
  completionRate: number;
  bio: string;
}

export const PROFILES: Profile[] = [
  {
    id: 'kyle',
    name: 'Kyle',
    tagline: 'Intern & Student · Week 2',
    streak: 5,
    bestStreak: 8,
    weeklyStreak: 2,
    bestWeeklyStreak: 3,
    monthlyStreak: 1,
    bestMonthlyStreak: 1,
    role: 'Intern · Student',
    avatar: '🧑‍💻',
    joinedWeek: 2,
    completionRate: 72,
    bio: 'Juggling internship and school. Building habits one day at a time.',
  },
  {
    id: 'yesa',
    name: 'Yesa',
    tagline: 'Student · Climber 🧗 · Chill',
    streak: 9,
    bestStreak: 14,
    weeklyStreak: 2,
    bestWeeklyStreak: 3,
    monthlyStreak: 1,
    bestMonthlyStreak: 2,
    role: 'Student · Boulder Climber',
    avatar: '🧗‍♀️',
    joinedWeek: 3,
    completionRate: 68,
    bio: 'Chill vibes, big goals. Loves boulder climbing and spontaneous adventures.',
  },
  {
    id: 'rafael',
    name: 'Rafael',
    tagline: 'School · Work · Organized',
    streak: 14,
    bestStreak: 21,
    weeklyStreak: 3,
    bestWeeklyStreak: 4,
    monthlyStreak: 2,
    bestMonthlyStreak: 2,
    role: 'Student · Worker',
    avatar: '📋',
    joinedWeek: 5,
    completionRate: 88,
    bio: 'Highly organized. Balances school, work, and personal growth with precision.',
  },
  {
    id: 'rooty',
    name: 'Rooty',
    tagline: 'The Complete Experience 🌿',
    streak: 21,
    bestStreak: 28,
    weeklyStreak: 4,
    bestWeeklyStreak: 5,
    monthlyStreak: 2,
    bestMonthlyStreak: 3,
    role: 'All-rounder',
    avatar: '🌿',
    joinedWeek: 8,
    completionRate: 91,
    bio: 'The blend of all worlds. Every habit, every goal, every vibe.',
  },
  {
    id: 'john',
    name: 'John',
    tagline: 'Creative · Part-timer 🎬',
    streak: 3,
    bestStreak: 6,
    weeklyStreak: 1,
    bestWeeklyStreak: 2,
    monthlyStreak: 1,
    bestMonthlyStreak: 1,
    role: 'Creative · Part-timer',
    avatar: '🎬',
    joinedWeek: 1,
    completionRate: 60,
    bio: 'Creative soul with a part-time hustle. Making things happen, one task at a time.',
  },
  {
    id: 'jude',
    name: 'Jude Michael',
    tagline: 'Travel Dreamer · Fitness Focused 🌍',
    streak: 7,
    bestStreak: 12,
    weeklyStreak: 2,
    bestWeeklyStreak: 3,
    monthlyStreak: 1,
    bestMonthlyStreak: 2,
    role: 'Worker · Travel Enthusiast',
    avatar: '✈️',
    joinedWeek: 2,
    completionRate: 78,
    bio: 'Building a better lifestyle while saving for overseas travel. Balancing work, fitness, and future adventures.',
  },
  {
    id: 'favio',
    name: 'Favio',
    tagline: 'Founder · Dad · Building for Longevity 💪',
    streak: 7,
    bestStreak: 12,
    weeklyStreak: 1,
    bestWeeklyStreak: 2,
    monthlyStreak: 1,
    bestMonthlyStreak: 1,
    role: 'Founder · Health Builder',
    avatar: '💪',
    joinedWeek: 1,
    completionRate: 0,
    bio: 'Losing 20 lbs this summer while staying sharp for family and startup. Building sustainable habits one day at a time.',
  },
  {
    id: 'roi',
    name: 'Roi',
    tagline: 'Health First · 3 Jobs · Always Moving 🚴',
    streak: 4,
    bestStreak: 10,
    weeklyStreak: 2,
    bestWeeklyStreak: 3,
    monthlyStreak: 1,
    bestMonthlyStreak: 1,
    role: 'Full-time + 2 Part-time · Cyclist & Climber',
    avatar: '🚴',
    joinedWeek: 1,
    completionRate: 70,
    bio: 'Tries to live and eat healthy while juggling 1 full-time and 2 part-time jobs. Loves cycling and bouldering. Fitness is the anchor that keeps everything together.',
  },
  {
    id: 'eunice',
    name: 'Eunice',
    tagline: 'Creative · Painter · Building Better Days 🎨',
    streak: 6,
    bestStreak: 9,
    weeklyStreak: 2,
    bestWeeklyStreak: 2,
    monthlyStreak: 1,
    bestMonthlyStreak: 1,
    role: 'Creative · Painter · Routine Builder',
    avatar: '🎨',
    joinedWeek: 1,
    completionRate: 65,
    bio: 'Creative soul who paints a lot, needs meditation, and is actively building a healthy daily routine. Finds joy in small rituals - morning walks with the dog, cooking, and making art.',
  },
];

// ──────────────────────────────────────────────
// Task types
// ──────────────────────────────────────────────
export type TimeOfDay = 'morning' | 'evening';
export type TaskType = 'routine' | 'priority' | 'goal';
export type TaskStatus = 'inprogress' | 'done' | 'skipped';
export type ValueType = 'money' | 'health' | 'opportunity';

export interface Task {
  id: string;
  label: string;
  timeOfDay: TimeOfDay;
  type: TaskType;
  category: string;
  // Value tracking (for reward system)
  valueType?: ValueType;
  estimatedValue?: number;
  valueUnit?: string; // '₱', 'cal', 'opportunities'
}

export interface TaskCategory {
  id: string;
  label: string;
  icon: string;
  color: string;
  tasks: Task[];
  goalId?: string; // links this category to a PersonalGoal for Goals > Category > Tasks hierarchy
}

// ──────────────────────────────────────────────
// Yesa & Rooty - shared category set
// ──────────────────────────────────────────────
export const TASK_CATEGORIES: TaskCategory[] = [
  {
    id: 'personal-goals',
    label: 'Goals',
    icon: '🎯',
    color: '#ef4565',
    tasks: [
      { id: 'pg-1', label: 'Write 1 journal entry',      timeOfDay: 'morning', type: 'goal',     category: 'personal-goals' },
      { id: 'pg-2', label: 'Review your goal list',       timeOfDay: 'morning', type: 'goal',     category: 'personal-goals' },
      { id: 'pg-3', label: 'Read 10 pages',               timeOfDay: 'morning', type: 'routine',  category: 'personal-goals' },
      { id: 'pg-4', label: 'Reflect on the day',          timeOfDay: 'evening', type: 'routine',  category: 'personal-goals' },
      { id: 'pg-5', label: "Plan tomorrow's top 3",       timeOfDay: 'evening', type: 'priority', category: 'personal-goals' },
      { id: 'pg-6', label: 'Practice gratitude',          timeOfDay: 'evening', type: 'routine',  category: 'personal-goals' },
    ],
  },
  {
    id: 'main-priorities',
    label: 'Top Priorities',
    icon: '⭐',
    color: '#094067',
    tasks: [
      { id: 'mp-1', label: "Check today's top priorities", timeOfDay: 'morning', type: 'priority', category: 'main-priorities' },
      { id: 'mp-2', label: 'Send follow-up messages',      timeOfDay: 'morning', type: 'priority', category: 'main-priorities' },
      { id: 'mp-3', label: 'Block 90-min focus time',      timeOfDay: 'morning', type: 'routine',  category: 'main-priorities' },
      { id: 'mp-4', label: 'Review completed work',        timeOfDay: 'evening', type: 'routine',  category: 'main-priorities' },
      { id: 'mp-5', label: 'Update to-do list',            timeOfDay: 'evening', type: 'priority', category: 'main-priorities' },
      { id: 'mp-6', label: 'Prepare for tomorrow',         timeOfDay: 'evening', type: 'priority', category: 'main-priorities' },
    ],
  },
  {
    id: 'class-flow',
    label: 'Academics',
    icon: '📚',
    color: '#3da9fc',
    tasks: [
      { id: 'cf-1', label: 'Review class schedule',       timeOfDay: 'morning', type: 'routine',  category: 'class-flow' },
      { id: 'cf-2', label: 'Complete assigned readings',  timeOfDay: 'morning', type: 'priority', category: 'class-flow' },
      { id: 'cf-3', label: 'Prep notes for today',        timeOfDay: 'morning', type: 'priority', category: 'class-flow' },
      { id: 'cf-4', label: 'Do homework / assignments',   timeOfDay: 'evening', type: 'priority', category: 'class-flow' },
      { id: 'cf-5', label: 'Review lecture notes',        timeOfDay: 'evening', type: 'routine',  category: 'class-flow' },
      { id: 'cf-6', label: 'Study for upcoming exams',    timeOfDay: 'evening', type: 'goal',     category: 'class-flow' },
    ],
  },
  {
    id: 'wellness',
    label: 'Healthy Living',
    icon: '🧘',
    color: '#90b4ce',
    tasks: [
      { id: 'wl-1', label: '10-minute stretch',              timeOfDay: 'morning', type: 'routine', category: 'wellness' },
      { id: 'wl-2', label: 'Drink a full glass of water',    timeOfDay: 'morning', type: 'routine', category: 'wellness' },
      { id: 'wl-3', label: 'Have a healthy breakfast',       timeOfDay: 'morning', type: 'routine', category: 'wellness' },
      { id: 'wl-4', label: '20-min walk or movement',        timeOfDay: 'evening', type: 'goal',    category: 'wellness' },
      { id: 'wl-5', label: 'No screens 30 min before bed',   timeOfDay: 'evening', type: 'routine', category: 'wellness' },
      { id: 'wl-6', label: '8 hours sleep target',           timeOfDay: 'evening', type: 'goal',    category: 'wellness' },
    ],
  },
];

// ──────────────────────────────────────────────
// Yesa - Climbing-first weekly schedule
// ──────────────────────────────────────────────
const YESA_BY_DAY: Record<string, TaskCategory[]> = {
  Mon: [
    {
      id: 'y-climb-mon', label: 'Bouldering Training', icon: '🧗', color: '#ef4565', goalId: 'yesa-bouldering-podium',
      tasks: [
        { id: 'yesa-mon-1', label: 'Warm up - 10 min mobility & finger stretches', timeOfDay: 'morning', type: 'routine', category: 'y-climb-mon' },
        { id: 'yesa-mon-2', label: 'Visualize today\'s project route', timeOfDay: 'morning', type: 'goal', category: 'y-climb-mon' },
        { id: 'yesa-mon-3', label: 'Bouldering session - 90 min (focus: footwork)', timeOfDay: 'evening', type: 'priority', category: 'y-climb-mon', valueType: 'health', estimatedValue: 400, valueUnit: 'cal' },
        { id: 'yesa-mon-4', label: 'Cool down & log session notes', timeOfDay: 'evening', type: 'routine', category: 'y-climb-mon' },
      ],
    },
    {
      id: 'y-school-mon', label: 'Academics', icon: '📚', color: '#3da9fc', goalId: 'yesa-stable-job',
      tasks: [
        { id: 'yesa-mon-5', label: 'Complete assigned readings', timeOfDay: 'morning', type: 'priority', category: 'y-school-mon' },
        { id: 'yesa-mon-6', label: 'Review lecture notes', timeOfDay: 'evening', type: 'routine', category: 'y-school-mon' },
      ],
    },
    {
      id: 'y-health-mon', label: 'Healthy Living', icon: '🌿', color: '#90b4ce', goalId: 'yesa-healthy-lifestyle',
      tasks: [
        { id: 'yesa-mon-7', label: 'Eat a protein-rich meal today', timeOfDay: 'morning', type: 'routine', category: 'y-health-mon' },
        { id: 'yesa-mon-8', label: 'Sleep by midnight', timeOfDay: 'evening', type: 'goal', category: 'y-health-mon' },
      ],
    },
  ],
  Tue: [
    {
      id: 'y-social-tue', label: 'Social & Rest', icon: '🤝', color: '#3da9fc', goalId: 'yesa-healthy-lifestyle',
      tasks: [
        { id: 'yesa-tue-1', label: 'Light stretch - no pressure', timeOfDay: 'morning', type: 'routine', category: 'y-social-tue' },
        { id: 'yesa-tue-2', label: 'Catch up with climbing friends', timeOfDay: 'evening', type: 'routine', category: 'y-social-tue' },
        { id: 'yesa-tue-3', label: 'No-screen wind-down (30 min before bed)', timeOfDay: 'evening', type: 'goal', category: 'y-social-tue' },
      ],
    },
    {
      id: 'y-school-tue', label: 'Academics', icon: '📚', color: '#3da9fc', goalId: 'yesa-stable-job',
      tasks: [
        { id: 'yesa-tue-4', label: 'Do homework / assignments', timeOfDay: 'morning', type: 'priority', category: 'y-school-tue' },
        { id: 'yesa-tue-5', label: 'Study for upcoming exams', timeOfDay: 'evening', type: 'goal', category: 'y-school-tue' },
      ],
    },
    {
      id: 'y-job-tue', label: 'Career', icon: '🚀', color: '#094067', goalId: 'yesa-stable-job',
      tasks: [
        { id: 'yesa-tue-6', label: 'Apply to 2-3 jobs', timeOfDay: 'morning', type: 'goal', category: 'y-job-tue', valueType: 'opportunity', estimatedValue: 2, valueUnit: 'opportunities' },
      ],
    },
  ],
  Wed: [
    {
      id: 'y-climb-wed', label: 'Bouldering - Projecting', icon: '🧗', color: '#ef4565', goalId: 'yesa-bouldering-podium',
      tasks: [
        { id: 'yesa-wed-1', label: 'Warm up & activate core', timeOfDay: 'morning', type: 'routine', category: 'y-climb-wed' },
        { id: 'yesa-wed-2', label: 'Projecting session - work your hardest route', timeOfDay: 'evening', type: 'priority', category: 'y-climb-wed', valueType: 'health', estimatedValue: 450, valueUnit: 'cal' },
        { id: 'yesa-wed-3', label: 'Film & analyze your beta', timeOfDay: 'evening', type: 'goal', category: 'y-climb-wed' },
        { id: 'yesa-wed-4', label: 'Stretch & foam roll after session', timeOfDay: 'evening', type: 'routine', category: 'y-climb-wed' },
      ],
    },
    {
      id: 'y-school-wed', label: 'Academics', icon: '📚', color: '#3da9fc', goalId: 'yesa-stable-job',
      tasks: [
        { id: 'yesa-wed-5', label: 'Review class schedule & deadlines', timeOfDay: 'morning', type: 'routine', category: 'y-school-wed' },
        { id: 'yesa-wed-6', label: 'Prep notes for today\'s classes', timeOfDay: 'morning', type: 'priority', category: 'y-school-wed' },
      ],
    },
    {
      id: 'y-health-wed', label: 'Healthy Living', icon: '🌿', color: '#90b4ce', goalId: 'yesa-healthy-lifestyle',
      tasks: [
        { id: 'yesa-wed-7', label: 'High-protein recovery meal after session', timeOfDay: 'evening', type: 'routine', category: 'y-health-wed' },
        { id: 'yesa-wed-8', label: 'Reflect on the day - 5 min journal', timeOfDay: 'evening', type: 'goal', category: 'y-health-wed' },
      ],
    },
  ],
  Thu: [
    {
      id: 'y-recover-thu', label: 'Active Recovery', icon: '🧘', color: '#90b4ce', goalId: 'yesa-healthy-lifestyle',
      tasks: [
        { id: 'yesa-thu-1', label: 'Yoga or gentle mobility - 20 min', timeOfDay: 'morning', type: 'goal', category: 'y-recover-thu', valueType: 'health', estimatedValue: 100, valueUnit: 'cal' },
        { id: 'yesa-thu-2', label: 'Drink water & eat well today (rest day)', timeOfDay: 'morning', type: 'routine', category: 'y-recover-thu' },
        { id: 'yesa-thu-3', label: '8 hours sleep target', timeOfDay: 'evening', type: 'goal', category: 'y-recover-thu' },
      ],
    },
    {
      id: 'y-school-thu', label: 'Academics', icon: '📚', color: '#3da9fc', goalId: 'yesa-stable-job',
      tasks: [
        { id: 'yesa-thu-4', label: 'Do homework / assignments', timeOfDay: 'morning', type: 'priority', category: 'y-school-thu' },
        { id: 'yesa-thu-5', label: 'Study for upcoming exams', timeOfDay: 'evening', type: 'goal', category: 'y-school-thu' },
      ],
    },
    {
      id: 'y-job-thu', label: 'Career', icon: '🚀', color: '#094067', goalId: 'yesa-stable-job',
      tasks: [
        { id: 'yesa-thu-6', label: 'Practice interview questions', timeOfDay: 'evening', type: 'routine', category: 'y-job-thu' },
      ],
    },
  ],
  Fri: [
    {
      id: 'y-climb-fri', label: 'Bouldering - Technique', icon: '🧗', color: '#ef4565', goalId: 'yesa-bouldering-podium',
      tasks: [
        { id: 'yesa-fri-1', label: 'Warm up - footwork focus drills', timeOfDay: 'morning', type: 'routine', category: 'y-climb-fri' },
        { id: 'yesa-fri-2', label: 'Technique session - slab & balance work', timeOfDay: 'evening', type: 'priority', category: 'y-climb-fri', valueType: 'health', estimatedValue: 350, valueUnit: 'cal' },
        { id: 'yesa-fri-3', label: 'Log session & track progress', timeOfDay: 'evening', type: 'goal', category: 'y-climb-fri' },
      ],
    },
    {
      id: 'y-school-fri', label: 'Academics', icon: '📚', color: '#3da9fc', goalId: 'yesa-stable-job',
      tasks: [
        { id: 'yesa-fri-4', label: 'Review lecture notes from the week', timeOfDay: 'morning', type: 'routine', category: 'y-school-fri' },
        { id: 'yesa-fri-5', label: 'Complete any remaining school tasks', timeOfDay: 'evening', type: 'priority', category: 'y-school-fri' },
      ],
    },
    {
      id: 'y-health-fri', label: 'Healthy Living', icon: '🌿', color: '#90b4ce', goalId: 'yesa-healthy-lifestyle',
      tasks: [
        { id: 'yesa-fri-6', label: 'Plan weekend meals', timeOfDay: 'evening', type: 'routine', category: 'y-health-fri' },
        { id: 'yesa-fri-7', label: 'Plan tomorrow\'s top 3', timeOfDay: 'evening', type: 'priority', category: 'y-health-fri' },
      ],
    },
  ],
  Sat: [
    {
      id: 'y-climb-sat', label: 'Boulder Gym / Outdoor', icon: '🧗', color: '#ef4565', goalId: 'yesa-bouldering-podium',
      tasks: [
        { id: 'yesa-sat-1', label: 'Full bouldering session - push your limits', timeOfDay: 'morning', type: 'priority', category: 'y-climb-sat', valueType: 'health', estimatedValue: 500, valueUnit: 'cal' },
        { id: 'yesa-sat-2', label: 'Try one problem above your current grade', timeOfDay: 'morning', type: 'goal', category: 'y-climb-sat' },
        { id: 'yesa-sat-3', label: 'Debrief & cool down', timeOfDay: 'morning', type: 'routine', category: 'y-climb-sat' },
      ],
    },
    {
      id: 'y-job-sat', label: 'Career', icon: '🚀', color: '#094067', goalId: 'yesa-stable-job',
      tasks: [
        { id: 'yesa-sat-4', label: 'Apply to 2-3 jobs', timeOfDay: 'morning', type: 'goal', category: 'y-job-sat', valueType: 'opportunity', estimatedValue: 2, valueUnit: 'opportunities' },
        { id: 'yesa-sat-5', label: 'Update LinkedIn or resume', timeOfDay: 'morning', type: 'routine', category: 'y-job-sat' },
      ],
    },
    {
      id: 'y-health-sat', label: 'Healthy Living', icon: '🌿', color: '#90b4ce', goalId: 'yesa-healthy-lifestyle',
      tasks: [
        { id: 'yesa-sat-6', label: 'Rest & recharge', timeOfDay: 'evening', type: 'routine', category: 'y-health-sat' },
        { id: 'yesa-sat-7', label: 'No screens 30 min before bed', timeOfDay: 'evening', type: 'goal', category: 'y-health-sat' },
      ],
    },
  ],
  Sun: [
    {
      id: 'y-planning-sun', label: 'Weekly Review & Planning', icon: '📋', color: '#094067', goalId: 'yesa-stable-job',
      tasks: [
        { id: 'yesa-sun-1', label: 'Review last week - what went well?', timeOfDay: 'morning', type: 'goal', category: 'y-planning-sun' },
        { id: 'yesa-sun-2', label: 'Plan next week\'s climbing sessions', timeOfDay: 'morning', type: 'priority', category: 'y-planning-sun' },
        { id: 'yesa-sun-3', label: 'Set top 3 goals for the week', timeOfDay: 'morning', type: 'priority', category: 'y-planning-sun' },
      ],
    },
    {
      id: 'y-health-sun', label: 'Healthy Living', icon: '🌿', color: '#90b4ce', goalId: 'yesa-healthy-lifestyle',
      tasks: [
        { id: 'yesa-sun-4', label: 'Meal prep for the week', timeOfDay: 'morning', type: 'routine', category: 'y-health-sun' },
        { id: 'yesa-sun-5', label: 'Rest - full recovery day', timeOfDay: 'evening', type: 'routine', category: 'y-health-sun' },
        { id: 'yesa-sun-6', label: 'Practice gratitude - 3 things', timeOfDay: 'evening', type: 'routine', category: 'y-health-sun' },
      ],
    },
  ],
};

// ──────────────────────────────────────────────
// Kyle - Review Routine (Mon–Sun schedule)
// ──────────────────────────────────────────────
const KYLE_BY_DAY: Record<string, TaskCategory[]> = {
  Mon: [
    {
      id: 'k-education-mon', label: 'Education', icon: '📚', color: '#3da9fc', goalId: 'kyle-graduation',
      tasks: [
        { id: 'kyle-mon-1', label: 'Review CHRA/aCPHR topics', timeOfDay: 'morning', type: 'priority', category: 'k-education-mon' },
        { id: 'kyle-mon-2', label: 'Practice HR case studies', timeOfDay: 'morning', type: 'goal', category: 'k-education-mon' },
      ],
    },
    {
      id: 'k-career-mon', label: 'Career', icon: '🚀', color: '#094067', goalId: 'kyle-emergency-fund',
      tasks: [
        { id: 'kyle-mon-3', label: 'Apply to 3–5 jobs', timeOfDay: 'morning', type: 'priority', category: 'k-career-mon', valueType: 'opportunity', estimatedValue: 4, valueUnit: 'opportunities' },
        { id: 'kyle-mon-4', label: 'Update LinkedIn profile', timeOfDay: 'morning', type: 'goal', category: 'k-career-mon' },
        { id: 'kyle-mon-5', label: 'Practice interview questions', timeOfDay: 'morning', type: 'routine', category: 'k-career-mon' },
      ],
    },
    {
      id: 'k-finance-mon', label: 'Finance', icon: '💰', color: '#ef4565', goalId: 'kyle-birthday-savings',
      tasks: [
        { id: 'kyle-mon-6', label: 'Save ₱50–₱100 today', timeOfDay: 'morning', type: 'goal', category: 'k-finance-mon', valueType: 'money', estimatedValue: 75, valueUnit: '₱' },
        { id: 'kyle-mon-7', label: 'Track daily expenses', timeOfDay: 'evening', type: 'routine', category: 'k-finance-mon' },
      ],
    },
    {
      id: 'k-evening-mon', label: 'Healthy Living', icon: '🌙', color: '#90b4ce', goalId: 'kyle-emergency-fund',
      tasks: [
        { id: 'kyle-mon-8', label: 'Review HR notes', timeOfDay: 'evening', type: 'routine', category: 'k-evening-mon' },
        { id: 'kyle-mon-9', label: 'Track graduation requirements', timeOfDay: 'evening', type: 'priority', category: 'k-evening-mon' },
        { id: 'kyle-mon-10', label: 'Take a break & recharge', timeOfDay: 'evening', type: 'routine', category: 'k-evening-mon' },
      ],
    },
  ],
  Tue: [
    {
      id: 'k-education-tue', label: 'Education', icon: '📚', color: '#3da9fc', goalId: 'kyle-graduation',
      tasks: [
        { id: 'kyle-tue-1', label: 'Review CHRA/aCPHR topics', timeOfDay: 'morning', type: 'priority', category: 'k-education-tue' },
        { id: 'kyle-tue-2', label: 'Practice HR questions', timeOfDay: 'morning', type: 'goal', category: 'k-education-tue' },
      ],
    },
    {
      id: 'k-career-tue', label: 'Career', icon: '🚀', color: '#094067', goalId: 'kyle-emergency-fund',
      tasks: [
        { id: 'kyle-tue-3', label: 'Apply to 3–5 jobs', timeOfDay: 'morning', type: 'priority', category: 'k-career-tue', valueType: 'opportunity', estimatedValue: 4, valueUnit: 'opportunities' },
        { id: 'kyle-tue-4', label: 'Update job application tracker', timeOfDay: 'morning', type: 'routine', category: 'k-career-tue' },
        { id: 'kyle-tue-5', label: 'Practice interview questions', timeOfDay: 'morning', type: 'routine', category: 'k-career-tue' },
      ],
    },
    {
      id: 'k-finance-tue', label: 'Finance', icon: '💰', color: '#ef4565', goalId: 'kyle-birthday-savings',
      tasks: [
        { id: 'kyle-tue-6', label: 'Save ₱50–₱100 today', timeOfDay: 'morning', type: 'goal', category: 'k-finance-tue', valueType: 'money', estimatedValue: 75, valueUnit: '₱' },
        { id: 'kyle-tue-7', label: 'Track daily expenses', timeOfDay: 'evening', type: 'routine', category: 'k-finance-tue' },
      ],
    },
    {
      id: 'k-evening-tue', label: 'Healthy Living', icon: '🌙', color: '#90b4ce', goalId: 'kyle-emergency-fund',
      tasks: [
        { id: 'kyle-tue-8', label: 'Review HR notes', timeOfDay: 'evening', type: 'routine', category: 'k-evening-tue' },
        { id: 'kyle-tue-9', label: 'Work on graduation requirements', timeOfDay: 'evening', type: 'priority', category: 'k-evening-tue' },
        { id: 'kyle-tue-10', label: 'Hobby time / relax', timeOfDay: 'evening', type: 'routine', category: 'k-evening-tue' },
      ],
    },
  ],
  Wed: [
    {
      id: 'k-education-wed', label: 'Education', icon: '📚', color: '#3da9fc', goalId: 'kyle-graduation',
      tasks: [
        { id: 'kyle-wed-1', label: 'Review CHRA/aCPHR topics', timeOfDay: 'morning', type: 'priority', category: 'k-education-wed' },
        { id: 'kyle-wed-2', label: 'Review weak areas from practice', timeOfDay: 'morning', type: 'goal', category: 'k-education-wed' },
      ],
    },
    {
      id: 'k-career-wed', label: 'Career', icon: '🚀', color: '#094067', goalId: 'kyle-emergency-fund',
      tasks: [
        { id: 'kyle-wed-3', label: 'Apply to 3–5 jobs', timeOfDay: 'morning', type: 'priority', category: 'k-career-wed', valueType: 'opportunity', estimatedValue: 4, valueUnit: 'opportunities' },
        { id: 'kyle-wed-4', label: 'Research companies to apply to', timeOfDay: 'morning', type: 'routine', category: 'k-career-wed' },
        { id: 'kyle-wed-5', label: 'Practice interview questions', timeOfDay: 'morning', type: 'routine', category: 'k-career-wed' },
      ],
    },
    {
      id: 'k-finance-wed', label: 'Finance', icon: '💰', color: '#ef4565', goalId: 'kyle-birthday-savings',
      tasks: [
        { id: 'kyle-wed-6', label: 'Save ₱50–₱100 today', timeOfDay: 'morning', type: 'goal', category: 'k-finance-wed', valueType: 'money', estimatedValue: 75, valueUnit: '₱' },
        { id: 'kyle-wed-7', label: 'Track daily expenses', timeOfDay: 'evening', type: 'routine', category: 'k-finance-wed' },
        { id: 'kyle-wed-8', label: 'Review weekly savings progress', timeOfDay: 'evening', type: 'goal', category: 'k-finance-wed' },
      ],
    },
    {
      id: 'k-evening-wed', label: 'Healthy Living', icon: '🌙', color: '#90b4ce', goalId: 'kyle-emergency-fund',
      tasks: [
        { id: 'kyle-wed-9', label: 'Review HR study materials', timeOfDay: 'evening', type: 'routine', category: 'k-evening-wed' },
        { id: 'kyle-wed-10', label: 'Check graduation checklist', timeOfDay: 'evening', type: 'priority', category: 'k-evening-wed' },
      ],
    },
  ],
  Thu: [
    {
      id: 'k-education-thu', label: 'Education', icon: '📚', color: '#3da9fc', goalId: 'kyle-graduation',
      tasks: [
        { id: 'kyle-thu-1', label: 'Review CHRA/aCPHR topics', timeOfDay: 'morning', type: 'priority', category: 'k-education-thu' },
        { id: 'kyle-thu-2', label: 'Practice HR mock questions', timeOfDay: 'morning', type: 'goal', category: 'k-education-thu' },
      ],
    },
    {
      id: 'k-career-thu', label: 'Career', icon: '🚀', color: '#094067', goalId: 'kyle-emergency-fund',
      tasks: [
        { id: 'kyle-thu-3', label: 'Apply to 3–5 jobs', timeOfDay: 'morning', type: 'priority', category: 'k-career-thu', valueType: 'opportunity', estimatedValue: 4, valueUnit: 'opportunities' },
        { id: 'kyle-thu-4', label: 'Follow up on applications', timeOfDay: 'morning', type: 'routine', category: 'k-career-thu' },
        { id: 'kyle-thu-5', label: 'Practice interview questions', timeOfDay: 'morning', type: 'routine', category: 'k-career-thu' },
      ],
    },
    {
      id: 'k-finance-thu', label: 'Finance', icon: '💰', color: '#ef4565', goalId: 'kyle-birthday-savings',
      tasks: [
        { id: 'kyle-thu-6', label: 'Save ₱50–₱100 today', timeOfDay: 'morning', type: 'goal', category: 'k-finance-thu', valueType: 'money', estimatedValue: 75, valueUnit: '₱' },
        { id: 'kyle-thu-7', label: 'Track daily expenses', timeOfDay: 'evening', type: 'routine', category: 'k-finance-thu' },
      ],
    },
    {
      id: 'k-evening-thu', label: 'Healthy Living', icon: '🌙', color: '#90b4ce', goalId: 'kyle-emergency-fund',
      tasks: [
        { id: 'kyle-thu-8', label: 'Review HR notes', timeOfDay: 'evening', type: 'routine', category: 'k-evening-thu' },
        { id: 'kyle-thu-9', label: 'Work on thesis/projects', timeOfDay: 'evening', type: 'priority', category: 'k-evening-thu' },
        { id: 'kyle-thu-10', label: 'Prepare for Friday tasks', timeOfDay: 'evening', type: 'routine', category: 'k-evening-thu' },
      ],
    },
  ],
  Fri: [
    {
      id: 'k-education-fri', label: 'Education', icon: '📚', color: '#3da9fc', goalId: 'kyle-graduation',
      tasks: [
        { id: 'kyle-fri-1', label: 'Review CHRA/aCPHR topics', timeOfDay: 'morning', type: 'priority', category: 'k-education-fri' },
        { id: 'kyle-fri-2', label: 'Review entire week topics', timeOfDay: 'morning', type: 'goal', category: 'k-education-fri' },
      ],
    },
    {
      id: 'k-career-fri', label: 'Career', icon: '🚀', color: '#094067', goalId: 'kyle-emergency-fund',
      tasks: [
        { id: 'kyle-fri-3', label: 'Apply to 3–5 jobs', timeOfDay: 'morning', type: 'priority', category: 'k-career-fri', valueType: 'opportunity', estimatedValue: 4, valueUnit: 'opportunities' },
        { id: 'kyle-fri-4', label: 'Improve resume this week', timeOfDay: 'morning', type: 'goal', category: 'k-career-fri' },
        { id: 'kyle-fri-5', label: 'Practice interview questions', timeOfDay: 'morning', type: 'routine', category: 'k-career-fri' },
      ],
    },
    {
      id: 'k-finance-fri', label: 'Finance', icon: '💰', color: '#ef4565', goalId: 'kyle-birthday-savings',
      tasks: [
        { id: 'kyle-fri-6', label: 'Save ₱50–₱100 today', timeOfDay: 'morning', type: 'goal', category: 'k-finance-fri', valueType: 'money', estimatedValue: 75, valueUnit: '₱' },
        { id: 'kyle-fri-7', label: 'Track daily expenses', timeOfDay: 'evening', type: 'routine', category: 'k-finance-fri' },
        { id: 'kyle-fri-8', label: 'Review total weekly savings', timeOfDay: 'evening', type: 'goal', category: 'k-finance-fri' },
      ],
    },
    {
      id: 'k-evening-fri', label: 'Healthy Living', icon: '🌙', color: '#90b4ce', goalId: 'kyle-emergency-fund',
      tasks: [
        { id: 'kyle-fri-9', label: 'Light study review', timeOfDay: 'evening', type: 'routine', category: 'k-evening-fri' },
        { id: 'kyle-fri-10', label: 'Plan weekend study schedule', timeOfDay: 'evening', type: 'routine', category: 'k-evening-fri' },
      ],
    },
  ],
  Sat: [
    {
      id: 'k-mock-sat', label: 'Exam Readiness', icon: '📝', color: '#ef4565', goalId: 'kyle-graduation',
      tasks: [
        { id: 'kyle-sat-1', label: 'Complete 1 CHRA/aCPHR mock exam', timeOfDay: 'morning', type: 'priority', category: 'k-mock-sat' },
        { id: 'kyle-sat-2', label: 'Review exam mistakes', timeOfDay: 'morning', type: 'priority', category: 'k-mock-sat' },
        { id: 'kyle-sat-3', label: 'Identify weak topics', timeOfDay: 'morning', type: 'goal', category: 'k-mock-sat' },
      ],
    },
    {
      id: 'k-finance-sat', label: 'Finance', icon: '💰', color: '#ef4565', goalId: 'kyle-birthday-savings',
      tasks: [
        { id: 'kyle-sat-4', label: 'Track daily expenses', timeOfDay: 'evening', type: 'routine', category: 'k-finance-sat' },
      ],
    },
    {
      id: 'k-evening-sat', label: 'Healthy Living', icon: '🌙', color: '#90b4ce', goalId: 'kyle-emergency-fund',
      tasks: [
        { id: 'kyle-sat-5', label: 'Hobby time / relax', timeOfDay: 'evening', type: 'routine', category: 'k-evening-sat' },
        { id: 'kyle-sat-6', label: 'Light review only', timeOfDay: 'evening', type: 'routine', category: 'k-evening-sat' },
      ],
    },
  ],
  Sun: [
    {
      id: 'k-planning-sun', label: 'Planning', icon: '📋', color: '#094067', goalId: 'kyle-graduation',
      tasks: [
        { id: 'kyle-sun-1', label: 'Plan next week study topics', timeOfDay: 'morning', type: 'priority', category: 'k-planning-sun' },
        { id: 'kyle-sun-2', label: 'Review graduation checklist', timeOfDay: 'morning', type: 'priority', category: 'k-planning-sun' },
        { id: 'kyle-sun-3', label: 'Organize study materials', timeOfDay: 'morning', type: 'routine', category: 'k-planning-sun' },
      ],
    },
    {
      id: 'k-finance-sun', label: 'Finance', icon: '💰', color: '#ef4565', goalId: 'kyle-birthday-savings',
      tasks: [
        { id: 'kyle-sun-4', label: 'Calculate total weekly savings', timeOfDay: 'morning', type: 'goal', category: 'k-finance-sun' },
        { id: 'kyle-sun-5', label: 'Plan next week budget', timeOfDay: 'morning', type: 'routine', category: 'k-finance-sun' },
      ],
    },
    {
      id: 'k-rest-sun', label: 'Healthy Living', icon: '🌿', color: '#90b4ce', goalId: 'kyle-emergency-fund',
      tasks: [
        { id: 'kyle-sun-6', label: 'Light HR review only', timeOfDay: 'evening', type: 'routine', category: 'k-rest-sun' },
        { id: 'kyle-sun-7', label: 'Rest and recharge', timeOfDay: 'evening', type: 'routine', category: 'k-rest-sun' },
      ],
    },
  ],
};

// ──────────────────────────────────────────────
// John - Weekly to-do list
// ──────────────────────────────────────────────
const JOHN_CATEGORIES: TaskCategory[] = [
  {
    id: 'j-priorities',
    label: 'Top Priorities',
    icon: '⭐',
    color: '#094067',
    tasks: [
      { id: 'john-1', label: 'Cook Carbonara for girlfriend & family',              timeOfDay: 'morning', type: 'goal',     category: 'j-priorities' },
      { id: 'john-2', label: "Help girlfriend with IMS before her demo",             timeOfDay: 'morning', type: 'priority', category: 'j-priorities' },
      { id: 'john-5', label: "Work at Kael's Adventure Land (May 9, Saturday)",     timeOfDay: 'morning', type: 'priority', category: 'j-priorities' },
    ],
  },
  {
    id: 'j-career',
    label: 'Career',
    icon: '🚀',
    color: '#3da9fc',
    tasks: [
      { id: 'john-3', label: 'Job hunting (part-time)',                             timeOfDay: 'morning', type: 'goal',     category: 'j-career' },
      { id: 'john-6', label: 'Video editing - finish by Monday',                   timeOfDay: 'morning', type: 'priority', category: 'j-career' },
      { id: 'john-7', label: 'Update resume',                                      timeOfDay: 'morning', type: 'goal',     category: 'j-career' },
    ],
  },
  {
    id: 'j-wellness',
    label: 'Healthy Living',
    icon: '🧘',
    color: '#90b4ce',
    tasks: [
      { id: 'john-4', label: 'Get a haircut',                                      timeOfDay: 'morning', type: 'goal',     category: 'j-wellness' },
    ],
  },
];

// ──────────────────────────────────────────────
// Jude Michael - Day-specific weekly schedule
// ──────────────────────────────────────────────
const JUDE_BY_DAY: Record<string, TaskCategory[]> = {
  Mon: [
    {
      id: 'j-morning-mon', label: 'Healthy Living', icon: '🌅', color: '#90b4ce',
      tasks: [
        { id: 'jude-mon-1', label: 'Wake up & light stretching', timeOfDay: 'morning', type: 'routine', category: 'j-morning-mon' },
        { id: 'jude-mon-2', label: 'Morning hygiene', timeOfDay: 'morning', type: 'routine', category: 'j-morning-mon' },
        { id: 'jude-mon-3', label: 'Quick daily goal check', timeOfDay: 'morning', type: 'priority', category: 'j-morning-mon' },
      ],
    },
    {
      id: 'j-work-mon', label: 'Finance', icon: '💼', color: '#094067',
      tasks: [
        { id: 'jude-mon-4', label: 'Drink water consistently', timeOfDay: 'morning', type: 'routine', category: 'j-work-mon' },
        { id: 'jude-mon-5', label: '5-min breathing/stretch break', timeOfDay: 'morning', type: 'routine', category: 'j-work-mon' },
        { id: 'jude-mon-6', label: 'Track small daily expenses', timeOfDay: 'morning', type: 'goal', category: 'j-work-mon' },
      ],
    },
    {
      id: 'j-fitness-mon', label: 'Fitness & Health', icon: '🏋️', color: '#ef4565',
      tasks: [
        { id: 'jude-mon-7', label: 'Complete workout (3:30-5PM)', timeOfDay: 'evening', type: 'priority', category: 'j-fitness-mon', valueType: 'health', estimatedValue: 300, valueUnit: 'cal' },
        { id: 'jude-mon-8', label: 'Cool down after workout', timeOfDay: 'evening', type: 'routine', category: 'j-fitness-mon' },
      ],
    },
    {
      id: 'j-evening-mon', label: 'Daily Reset', icon: '🌙', color: '#3da9fc',
      tasks: [
        { id: 'jude-mon-9', label: 'Proper recovery meal', timeOfDay: 'evening', type: 'routine', category: 'j-evening-mon' },
        { id: 'jude-mon-10', label: 'Clean house / organize room', timeOfDay: 'evening', type: 'routine', category: 'j-evening-mon' },
        { id: 'jude-mon-11', label: '5-10 min journal entry', timeOfDay: 'evening', type: 'goal', category: 'j-evening-mon' },
        { id: 'jude-mon-12', label: 'Prepare for tomorrow', timeOfDay: 'evening', type: 'priority', category: 'j-evening-mon' },
      ],
    },
  ],
  Tue: [
    {
      id: 'j-morning-tue', label: 'Healthy Living', icon: '🌅', color: '#90b4ce',
      tasks: [
        { id: 'jude-tue-1', label: 'Wake up & light stretching', timeOfDay: 'morning', type: 'routine', category: 'j-morning-tue' },
        { id: 'jude-tue-2', label: 'Morning hygiene', timeOfDay: 'morning', type: 'routine', category: 'j-morning-tue' },
        { id: 'jude-tue-3', label: 'Quick daily goal check', timeOfDay: 'morning', type: 'priority', category: 'j-morning-tue' },
      ],
    },
    {
      id: 'j-work-tue', label: 'Finance', icon: '💼', color: '#094067',
      tasks: [
        { id: 'jude-tue-4', label: 'Drink water consistently', timeOfDay: 'morning', type: 'routine', category: 'j-work-tue' },
        { id: 'jude-tue-5', label: '5-min breathing/stretch break', timeOfDay: 'morning', type: 'routine', category: 'j-work-tue' },
        { id: 'jude-tue-6', label: 'Track small daily expenses', timeOfDay: 'morning', type: 'goal', category: 'j-work-tue' },
      ],
    },
    {
      id: 'j-fitness-tue', label: 'Fitness & Health', icon: '🏋️', color: '#ef4565',
      tasks: [
        { id: 'jude-tue-7', label: 'Complete workout (3:30-5PM)', timeOfDay: 'evening', type: 'priority', category: 'j-fitness-tue', valueType: 'health', estimatedValue: 300, valueUnit: 'cal' },
        { id: 'jude-tue-8', label: 'Cool down after workout', timeOfDay: 'evening', type: 'routine', category: 'j-fitness-tue' },
      ],
    },
    {
      id: 'j-evening-tue', label: 'Daily Reset', icon: '🌙', color: '#3da9fc',
      tasks: [
        { id: 'jude-tue-9', label: 'Proper recovery meal', timeOfDay: 'evening', type: 'routine', category: 'j-evening-tue' },
        { id: 'jude-tue-10', label: 'Clean house / organize room', timeOfDay: 'evening', type: 'routine', category: 'j-evening-tue' },
        { id: 'jude-tue-11', label: '5-10 min journal entry', timeOfDay: 'evening', type: 'goal', category: 'j-evening-tue' },
        { id: 'jude-tue-12', label: 'Prepare for tomorrow', timeOfDay: 'evening', type: 'priority', category: 'j-evening-tue' },
      ],
    },
  ],
  Wed: [
    {
      id: 'j-morning-wed', label: 'Healthy Living', icon: '🌅', color: '#90b4ce',
      tasks: [
        { id: 'jude-wed-1', label: 'Wake up & light stretching', timeOfDay: 'morning', type: 'routine', category: 'j-morning-wed' },
        { id: 'jude-wed-2', label: 'Morning hygiene', timeOfDay: 'morning', type: 'routine', category: 'j-morning-wed' },
        { id: 'jude-wed-3', label: 'Quick daily goal check', timeOfDay: 'morning', type: 'priority', category: 'j-morning-wed' },
      ],
    },
    {
      id: 'j-work-wed', label: 'Finance', icon: '💼', color: '#094067',
      tasks: [
        { id: 'jude-wed-4', label: 'Drink water consistently', timeOfDay: 'morning', type: 'routine', category: 'j-work-wed' },
        { id: 'jude-wed-5', label: '5-min breathing/stretch break', timeOfDay: 'morning', type: 'routine', category: 'j-work-wed' },
        { id: 'jude-wed-6', label: 'Track small daily expenses', timeOfDay: 'morning', type: 'goal', category: 'j-work-wed' },
        { id: 'jude-wed-7', label: 'Review weekly savings progress', timeOfDay: 'morning', type: 'goal', category: 'j-work-wed' },
      ],
    },
    {
      id: 'j-fitness-wed', label: 'Fitness & Health', icon: '🏋️', color: '#ef4565',
      tasks: [
        { id: 'jude-wed-8', label: 'Complete workout (3:30-5PM)', timeOfDay: 'evening', type: 'priority', category: 'j-fitness-wed', valueType: 'health', estimatedValue: 300, valueUnit: 'cal' },
        { id: 'jude-wed-9', label: 'Cool down after workout', timeOfDay: 'evening', type: 'routine', category: 'j-fitness-wed' },
      ],
    },
    {
      id: 'j-evening-wed', label: 'Daily Reset', icon: '🌙', color: '#3da9fc',
      tasks: [
        { id: 'jude-wed-10', label: 'Proper recovery meal', timeOfDay: 'evening', type: 'routine', category: 'j-evening-wed' },
        { id: 'jude-wed-11', label: 'Clean house / organize room', timeOfDay: 'evening', type: 'routine', category: 'j-evening-wed' },
        { id: 'jude-wed-12', label: '5-10 min journal entry', timeOfDay: 'evening', type: 'goal', category: 'j-evening-wed' },
        { id: 'jude-wed-13', label: 'Prepare for tomorrow', timeOfDay: 'evening', type: 'priority', category: 'j-evening-wed' },
      ],
    },
  ],
  Thu: [
    {
      id: 'j-morning-thu', label: 'Healthy Living', icon: '🌅', color: '#90b4ce',
      tasks: [
        { id: 'jude-thu-1', label: 'Wake up & light stretching', timeOfDay: 'morning', type: 'routine', category: 'j-morning-thu' },
        { id: 'jude-thu-2', label: 'Morning hygiene', timeOfDay: 'morning', type: 'routine', category: 'j-morning-thu' },
        { id: 'jude-thu-3', label: 'Quick daily goal check', timeOfDay: 'morning', type: 'priority', category: 'j-morning-thu' },
      ],
    },
    {
      id: 'j-work-thu', label: 'Finance', icon: '💼', color: '#094067',
      tasks: [
        { id: 'jude-thu-4', label: 'Drink water consistently', timeOfDay: 'morning', type: 'routine', category: 'j-work-thu' },
        { id: 'jude-thu-5', label: '5-min breathing/stretch break', timeOfDay: 'morning', type: 'routine', category: 'j-work-thu' },
        { id: 'jude-thu-6', label: 'Track small daily expenses', timeOfDay: 'morning', type: 'goal', category: 'j-work-thu' },
      ],
    },
    {
      id: 'j-fitness-thu', label: 'Fitness & Health', icon: '🏋️', color: '#ef4565',
      tasks: [
        { id: 'jude-thu-7', label: 'Complete workout (3:30-5PM)', timeOfDay: 'evening', type: 'priority', category: 'j-fitness-thu', valueType: 'health', estimatedValue: 300, valueUnit: 'cal' },
        { id: 'jude-thu-8', label: 'Cool down after workout', timeOfDay: 'evening', type: 'routine', category: 'j-fitness-thu' },
      ],
    },
    {
      id: 'j-evening-thu', label: 'Daily Reset', icon: '🌙', color: '#3da9fc',
      tasks: [
        { id: 'jude-thu-9', label: 'Proper recovery meal', timeOfDay: 'evening', type: 'routine', category: 'j-evening-thu' },
        { id: 'jude-thu-10', label: 'Clean house / organize room', timeOfDay: 'evening', type: 'routine', category: 'j-evening-thu' },
        { id: 'jude-thu-11', label: '5-10 min journal entry', timeOfDay: 'evening', type: 'goal', category: 'j-evening-thu' },
        { id: 'jude-thu-12', label: 'Prepare for tomorrow', timeOfDay: 'evening', type: 'priority', category: 'j-evening-thu' },
      ],
    },
  ],
  Fri: [
    {
      id: 'j-morning-fri', label: 'Healthy Living', icon: '🌅', color: '#90b4ce',
      tasks: [
        { id: 'jude-fri-1', label: 'Wake up & light stretching', timeOfDay: 'morning', type: 'routine', category: 'j-morning-fri' },
        { id: 'jude-fri-2', label: 'Morning hygiene', timeOfDay: 'morning', type: 'routine', category: 'j-morning-fri' },
        { id: 'jude-fri-3', label: 'Quick daily goal check', timeOfDay: 'morning', type: 'priority', category: 'j-morning-fri' },
      ],
    },
    {
      id: 'j-work-fri', label: 'Finance', icon: '💼', color: '#094067',
      tasks: [
        { id: 'jude-fri-4', label: 'Drink water consistently', timeOfDay: 'morning', type: 'routine', category: 'j-work-fri' },
        { id: 'jude-fri-5', label: '5-min breathing/stretch break', timeOfDay: 'morning', type: 'routine', category: 'j-work-fri' },
        { id: 'jude-fri-6', label: 'Track small daily expenses', timeOfDay: 'morning', type: 'goal', category: 'j-work-fri' },
        { id: 'jude-fri-7', label: 'Review total weekly savings', timeOfDay: 'morning', type: 'goal', category: 'j-work-fri' },
      ],
    },
    {
      id: 'j-fitness-fri', label: 'Fitness & Health', icon: '🏋️', color: '#ef4565',
      tasks: [
        { id: 'jude-fri-8', label: 'Complete workout (3:30-5PM)', timeOfDay: 'evening', type: 'priority', category: 'j-fitness-fri', valueType: 'health', estimatedValue: 300, valueUnit: 'cal' },
        { id: 'jude-fri-9', label: 'Cool down after workout', timeOfDay: 'evening', type: 'routine', category: 'j-fitness-fri' },
      ],
    },
    {
      id: 'j-evening-fri', label: 'Daily Reset', icon: '🌙', color: '#3da9fc',
      tasks: [
        { id: 'jude-fri-10', label: 'Proper recovery meal', timeOfDay: 'evening', type: 'routine', category: 'j-evening-fri' },
        { id: 'jude-fri-11', label: 'Clean house / organize room', timeOfDay: 'evening', type: 'routine', category: 'j-evening-fri' },
        { id: 'jude-fri-12', label: '5-10 min journal entry', timeOfDay: 'evening', type: 'goal', category: 'j-evening-fri' },
        { id: 'jude-fri-13', label: 'Plan weekend activities', timeOfDay: 'evening', type: 'priority', category: 'j-evening-fri' },
      ],
    },
  ],
  Sat: [
    {
      id: 'j-morning-sat', label: 'Fitness & Health', icon: '🚶', color: '#90b4ce',
      tasks: [
        { id: 'jude-sat-1', label: 'Morning walk at 5:30 AM', timeOfDay: 'morning', type: 'priority', category: 'j-morning-sat' },
        { id: 'jude-sat-2', label: 'Relaxing / reflective time', timeOfDay: 'morning', type: 'routine', category: 'j-morning-sat' },
      ],
    },
    {
      id: 'j-weekend-sat', label: 'Finance', icon: '🏠', color: '#3da9fc',
      tasks: [
        { id: 'jude-sat-3', label: 'Light house cleaning', timeOfDay: 'morning', type: 'routine', category: 'j-weekend-sat' },
        { id: 'jude-sat-4', label: 'Budget tracking', timeOfDay: 'morning', type: 'goal', category: 'j-weekend-sat' },
        { id: 'jude-sat-5', label: 'Research travel goals/destinations', timeOfDay: 'morning', type: 'goal', category: 'j-weekend-sat' },
      ],
    },
    {
      id: 'j-evening-sat', label: 'Healthy Living', icon: '🌙', color: '#ef4565',
      tasks: [
        { id: 'jude-sat-6', label: 'Watch travel budgeting content', timeOfDay: 'evening', type: 'routine', category: 'j-evening-sat' },
        { id: 'jude-sat-7', label: 'Rest and recharge', timeOfDay: 'evening', type: 'routine', category: 'j-evening-sat' },
      ],
    },
  ],
  Sun: [
    {
      id: 'j-morning-sun', label: 'Fitness & Health', icon: '🚶', color: '#90b4ce',
      tasks: [
        { id: 'jude-sun-1', label: 'Morning walk at 5:30 AM', timeOfDay: 'morning', type: 'priority', category: 'j-morning-sun' },
        { id: 'jude-sun-2', label: 'Relaxing / reflective time', timeOfDay: 'morning', type: 'routine', category: 'j-morning-sun' },
      ],
    },
    {
      id: 'j-weekend-sun', label: 'Planning', icon: '📋', color: '#094067',
      tasks: [
        { id: 'jude-sun-3', label: 'Review weekly savings progress', timeOfDay: 'morning', type: 'goal', category: 'j-weekend-sun' },
        { id: 'jude-sun-4', label: 'Plan next week routine', timeOfDay: 'morning', type: 'priority', category: 'j-weekend-sun' },
        { id: 'jude-sun-5', label: 'Research passport/travel requirements', timeOfDay: 'morning', type: 'goal', category: 'j-weekend-sun' },
      ],
    },
    {
      id: 'j-evening-sun', label: 'Healthy Living', icon: '🌙', color: '#3da9fc',
      tasks: [
        { id: 'jude-sun-6', label: 'Light house cleaning', timeOfDay: 'evening', type: 'routine', category: 'j-evening-sun' },
        { id: 'jude-sun-7', label: 'Prepare for Monday', timeOfDay: 'evening', type: 'priority', category: 'j-evening-sun' },
        { id: 'jude-sun-8', label: 'Rest and recharge', timeOfDay: 'evening', type: 'routine', category: 'j-evening-sun' },
      ],
    },
  ],
};

// ──────────────────────────────────────────────
// Rafael - Day-specific weekly schedule
// ──────────────────────────────────────────────
const RAFAEL_BY_DAY: Record<string, TaskCategory[]> = {
  Mon: [
    {
      id: 'r-school-mon', label: 'Academics', icon: '📚', color: '#3da9fc', goalId: 'rafael-academic',
      tasks: [
        { id: 'rafael-mon-1', label: 'School works', timeOfDay: 'morning', type: 'priority', category: 'r-school-mon' },
        { id: 'rafael-mon-2', label: 'Study', timeOfDay: 'morning', type: 'goal', category: 'r-school-mon' },
        { id: 'rafael-mon-4', label: 'School works', timeOfDay: 'evening', type: 'priority', category: 'r-school-mon' },
        { id: 'rafael-mon-5', label: 'Study', timeOfDay: 'evening', type: 'goal', category: 'r-school-mon' },
      ],
    },
    {
      id: 'r-wellness-mon', label: 'Healthy Living', icon: '🧘', color: '#90b4ce', goalId: 'rafael-healthy-living',
      tasks: [
        { id: 'rafael-mon-3', label: 'Exercise', timeOfDay: 'evening', type: 'routine', category: 'r-wellness-mon' },
      ],
    },
  ],
  Tue: [
    {
      id: 'r-school-tue', label: 'Academics', icon: '📚', color: '#3da9fc', goalId: 'rafael-academic',
      tasks: [
        { id: 'rafael-tue-1', label: 'School works',  timeOfDay: 'morning', type: 'priority', category: 'r-school-tue' },
        { id: 'rafael-tue-2', label: 'Study', timeOfDay: 'morning', type: 'goal', category: 'r-school-tue' },
        { id: 'rafael-tue-4', label: 'Study', timeOfDay: 'evening', type: 'goal', category: 'r-school-tue' },
      ],
    },
    {
      id: 'r-wellness-tue', label: 'Healthy Living', icon: '🧘', color: '#90b4ce', goalId: 'rafael-healthy-living',
      tasks: [
        { id: 'rafael-tue-3', label: 'Exercise', timeOfDay: 'evening', type: 'routine', category: 'r-wellness-tue' },
      ],
    },
  ],
  Wed: [
    {
      id: 'r-school-wed', label: 'Academics', icon: '📚', color: '#3da9fc', goalId: 'rafael-academic',
      tasks: [
        { id: 'rafael-wed-1', label: 'First subject',  timeOfDay: 'morning', type: 'routine', category: 'r-school-wed' },
        { id: 'rafael-wed-2', label: 'Second subject', timeOfDay: 'morning', type: 'routine', category: 'r-school-wed' },
        { id: 'rafael-wed-3', label: 'Third subject',  timeOfDay: 'morning', type: 'routine', category: 'r-school-wed' },
        { id: 'rafael-wed-4', label: 'Study', timeOfDay: 'evening', type: 'goal', category: 'r-school-wed' },
        { id: 'rafael-wed-5', label: 'School works', timeOfDay: 'evening', type: 'priority', category: 'r-school-wed' },
      ],
    },
  ],
  Thu: [
    {
      id: 'r-school-thu', label: 'Academics', icon: '📚', color: '#3da9fc', goalId: 'rafael-academic',
      tasks: [
        { id: 'rafael-thu-1', label: 'First subject',  timeOfDay: 'morning', type: 'routine', category: 'r-school-thu' },
        { id: 'rafael-thu-2', label: 'Second subject', timeOfDay: 'morning', type: 'routine', category: 'r-school-thu' },
        { id: 'rafael-thu-2b', label: 'Practice role play', timeOfDay: 'morning', type: 'priority', category: 'r-school-thu' },
        { id: 'rafael-thu-3', label: 'Study', timeOfDay: 'evening', type: 'goal', category: 'r-school-thu' },
        { id: 'rafael-thu-4', label: 'School works', timeOfDay: 'evening', type: 'priority', category: 'r-school-thu' },
      ],
    },
  ],
  Fri: [
    {
      id: 'r-school-fri', label: 'Academics', icon: '📚', color: '#3da9fc', goalId: 'rafael-academic',
      tasks: [
        { id: 'rafael-fri-1', label: 'School works', timeOfDay: 'morning', type: 'priority', category: 'r-school-fri' },
        { id: 'rafael-fri-2', label: 'Study', timeOfDay: 'morning', type: 'goal', category: 'r-school-fri' },
        { id: 'rafael-fri-3', label: 'School works', timeOfDay: 'evening', type: 'priority', category: 'r-school-fri' },
        { id: 'rafael-fri-4', label: 'Study', timeOfDay: 'evening', type: 'goal', category: 'r-school-fri' },
      ],
    },
    {
      id: 'r-wellness-fri', label: 'Healthy Living', icon: '🧘', color: '#90b4ce', goalId: 'rafael-healthy-living',
      tasks: [
        { id: 'rafael-fri-5', label: 'Exercise', timeOfDay: 'evening', type: 'routine', category: 'r-wellness-fri' },
      ],
    },
  ],
  Sat: [
    {
      id: 'r-school-sat', label: 'Academics', icon: '📚', color: '#3da9fc', goalId: 'rafael-academic',
      tasks: [
        { id: 'rafael-sat-1', label: 'Group Project Art Appreciation', timeOfDay: 'morning', type: 'priority', category: 'r-school-sat' },
        { id: 'rafael-sat-2', label: 'Group Presentation Elective1',  timeOfDay: 'morning', type: 'priority', category: 'r-school-sat' },
        { id: 'rafael-sat-3', label: 'School works', timeOfDay: 'evening', type: 'priority', category: 'r-school-sat' },
        { id: 'rafael-sat-4', label: 'Study', timeOfDay: 'evening', type: 'goal', category: 'r-school-sat' },
      ],
    },
    {
      id: 'r-wellness-sat', label: 'Healthy Living', icon: '🧘', color: '#90b4ce', goalId: 'rafael-healthy-living',
      tasks: [
        { id: 'rafael-sat-5', label: 'Exercise', timeOfDay: 'evening', type: 'routine', category: 'r-wellness-sat' },
      ],
    },
  ],
  Sun: [
    {
      id: 'r-work-sun', label: 'Income & Savings', icon: '💼', color: '#ef4565', goalId: 'rafael-emergency-fund',
      tasks: [
        { id: 'rafael-sun-1', label: 'Work', timeOfDay: 'morning', type: 'priority', category: 'r-work-sun' },
      ],
    },
    {
      id: 'r-school-sun', label: 'Academics', icon: '📚', color: '#3da9fc', goalId: 'rafael-academic',
      tasks: [
        { id: 'rafael-sun-2', label: 'Study', timeOfDay: 'evening', type: 'goal', category: 'r-school-sun' },
      ],
    },
    {
      id: 'r-wellness-sun', label: 'Healthy Living', icon: '🧘', color: '#90b4ce', goalId: 'rafael-healthy-living',
      tasks: [
        { id: 'rafael-sun-3', label: 'Exercise', timeOfDay: 'evening', type: 'routine', category: 'r-wellness-sun' },
      ],
    },
  ],
};

const FAVIO_BY_DAY: Record<string, TaskCategory[]> = {
  Mon: [
    {
      id: 'fav-hl-mon', label: 'Healthy Living', icon: '🥗', color: '#ef4565', goalId: 'favio-lose-weight',
      tasks: [
        { id: 'fav-mon-1', label: 'Protein at breakfast', timeOfDay: 'morning', type: 'priority', category: 'fav-hl-mon' },
        { id: 'fav-mon-2', label: 'Hydration target (3–4 L)', timeOfDay: 'morning', type: 'routine', category: 'fav-hl-mon' },
        { id: 'fav-mon-3', label: 'Protein at lunch', timeOfDay: 'morning', type: 'routine', category: 'fav-hl-mon' },
        { id: 'fav-mon-4', label: 'Protein at dinner', timeOfDay: 'evening', type: 'routine', category: 'fav-hl-mon' },
      ],
    },
    {
      id: 'fav-fit-mon', label: 'Fitness & Strength', icon: '🏋️', color: '#3da9fc', goalId: 'favio-longevity',
      tasks: [
        { id: 'fav-mon-5', label: 'Strength Session 1 (45–55 min)', timeOfDay: 'morning', type: 'priority', category: 'fav-fit-mon' },
        { id: 'fav-mon-6', label: 'Warm-up before lifting', timeOfDay: 'morning', type: 'routine', category: 'fav-fit-mon' },
        { id: 'fav-mon-7', label: '20–30 min Walk', timeOfDay: 'morning', type: 'goal', category: 'fav-fit-mon' },
      ],
    },
    {
      id: 'fav-neck-mon', label: 'Neck Reset', icon: '🧘', color: '#90b4ce', goalId: 'favio-neck-balance',
      tasks: [
        { id: 'fav-mon-8', label: '5-min Neck Reset (chin tucks + shoulder blade squeezes)', timeOfDay: 'morning', type: 'routine', category: 'fav-neck-mon' },
      ],
    },
    {
      id: 'fav-mb-mon', label: 'Mental Balance', icon: '🌙', color: '#094067', goalId: 'favio-founder-performance',
      tasks: [
        { id: 'fav-mon-9', label: 'Intentional time with wife', timeOfDay: 'evening', type: 'priority', category: 'fav-mb-mon' },
        { id: 'fav-mon-10', label: 'No intense work 1 hr before bed', timeOfDay: 'evening', type: 'routine', category: 'fav-mb-mon' },
        { id: 'fav-mon-11', label: '10–20 min Reading before bed', timeOfDay: 'evening', type: 'goal', category: 'fav-mb-mon' },
        { id: 'fav-mon-12', label: 'Log sleep routine (wind-down)', timeOfDay: 'evening', type: 'routine', category: 'fav-mb-mon' },
      ],
    },
  ],
  Tue: [
    {
      id: 'fav-hl-tue', label: 'Healthy Living', icon: '🥗', color: '#ef4565', goalId: 'favio-lose-weight',
      tasks: [
        { id: 'fav-tue-1', label: 'Protein at breakfast', timeOfDay: 'morning', type: 'priority', category: 'fav-hl-tue' },
        { id: 'fav-tue-2', label: 'Hydration target (3–4 L)', timeOfDay: 'morning', type: 'routine', category: 'fav-hl-tue' },
        { id: 'fav-tue-3', label: 'Protein at lunch', timeOfDay: 'morning', type: 'routine', category: 'fav-hl-tue' },
        { id: 'fav-tue-4', label: 'Protein at dinner', timeOfDay: 'evening', type: 'routine', category: 'fav-hl-tue' },
      ],
    },
    {
      id: 'fav-fit-tue', label: 'Fitness & Cardio', icon: '🏃', color: '#3da9fc', goalId: 'favio-longevity',
      tasks: [
        { id: 'fav-tue-5', label: 'Easy Run (20–25 min)', timeOfDay: 'morning', type: 'priority', category: 'fav-fit-tue' },
        { id: 'fav-tue-6', label: 'Warm-up before run', timeOfDay: 'morning', type: 'routine', category: 'fav-fit-tue' },
      ],
    },
    {
      id: 'fav-neck-tue', label: 'Neck Reset', icon: '🧘', color: '#90b4ce', goalId: 'favio-neck-balance',
      tasks: [
        { id: 'fav-tue-7', label: '5-min Neck Reset (chin tucks + shoulder blade squeezes)', timeOfDay: 'morning', type: 'routine', category: 'fav-neck-tue' },
      ],
    },
    {
      id: 'fav-mb-tue', label: 'Mental Balance', icon: '🌙', color: '#094067', goalId: 'favio-founder-performance',
      tasks: [
        { id: 'fav-tue-8', label: '30-min personal / startup project', timeOfDay: 'morning', type: 'goal', category: 'fav-mb-tue' },
        { id: 'fav-tue-9', label: 'Intentional time with wife', timeOfDay: 'evening', type: 'priority', category: 'fav-mb-tue' },
        { id: 'fav-tue-10', label: 'No intense work 1 hr before bed', timeOfDay: 'evening', type: 'routine', category: 'fav-mb-tue' },
        { id: 'fav-tue-11', label: '10–20 min Reading before bed', timeOfDay: 'evening', type: 'goal', category: 'fav-mb-tue' },
        { id: 'fav-tue-12', label: 'Log sleep routine (wind-down)', timeOfDay: 'evening', type: 'routine', category: 'fav-mb-tue' },
      ],
    },
  ],
  Wed: [
    {
      id: 'fav-hl-wed', label: 'Healthy Living', icon: '🥗', color: '#ef4565', goalId: 'favio-lose-weight',
      tasks: [
        { id: 'fav-wed-1', label: 'Protein at breakfast', timeOfDay: 'morning', type: 'priority', category: 'fav-hl-wed' },
        { id: 'fav-wed-2', label: 'Hydration target (3–4 L)', timeOfDay: 'morning', type: 'routine', category: 'fav-hl-wed' },
        { id: 'fav-wed-3', label: 'Protein at lunch', timeOfDay: 'morning', type: 'routine', category: 'fav-hl-wed' },
        { id: 'fav-wed-4', label: 'Protein at dinner', timeOfDay: 'evening', type: 'routine', category: 'fav-hl-wed' },
      ],
    },
    {
      id: 'fav-fit-wed', label: 'Recovery & Mobility', icon: '🤸', color: '#3da9fc', goalId: 'favio-longevity',
      tasks: [
        { id: 'fav-wed-5', label: 'Mobility session (10–15 min)', timeOfDay: 'morning', type: 'routine', category: 'fav-fit-wed' },
      ],
    },
    {
      id: 'fav-neck-wed', label: 'Neck Reset', icon: '🧘', color: '#90b4ce', goalId: 'favio-neck-balance',
      tasks: [
        { id: 'fav-wed-6', label: '5-min Neck Reset (chin tucks + shoulder blade squeezes)', timeOfDay: 'morning', type: 'routine', category: 'fav-neck-wed' },
      ],
    },
    {
      id: 'fav-mb-wed', label: 'Mental Balance & Home', icon: '🏡', color: '#094067', goalId: 'favio-neck-balance',
      tasks: [
        { id: 'fav-wed-7', label: 'Meaningful time with wife (deeper block)', timeOfDay: 'evening', type: 'priority', category: 'fav-mb-wed' },
        { id: 'fav-wed-8', label: 'Home task (small)', timeOfDay: 'evening', type: 'routine', category: 'fav-mb-wed' },
        { id: 'fav-wed-9', label: 'No intense work 1 hr before bed', timeOfDay: 'evening', type: 'routine', category: 'fav-mb-wed' },
        { id: 'fav-wed-10', label: 'Log sleep routine (wind-down)', timeOfDay: 'evening', type: 'routine', category: 'fav-mb-wed' },
      ],
    },
  ],
  Thu: [
    {
      id: 'fav-hl-thu', label: 'Healthy Living', icon: '🥗', color: '#ef4565', goalId: 'favio-lose-weight',
      tasks: [
        { id: 'fav-thu-1', label: 'Protein at breakfast', timeOfDay: 'morning', type: 'priority', category: 'fav-hl-thu' },
        { id: 'fav-thu-2', label: 'Hydration target (3–4 L)', timeOfDay: 'morning', type: 'routine', category: 'fav-hl-thu' },
        { id: 'fav-thu-3', label: 'Protein at lunch', timeOfDay: 'morning', type: 'routine', category: 'fav-hl-thu' },
        { id: 'fav-thu-4', label: 'Protein at dinner', timeOfDay: 'evening', type: 'routine', category: 'fav-hl-thu' },
      ],
    },
    {
      id: 'fav-fit-thu', label: 'Fitness & Strength', icon: '🏋️', color: '#3da9fc', goalId: 'favio-longevity',
      tasks: [
        { id: 'fav-thu-5', label: 'Strength Session 2 (45–55 min)', timeOfDay: 'morning', type: 'priority', category: 'fav-fit-thu' },
        { id: 'fav-thu-6', label: 'Warm-up before lifting', timeOfDay: 'morning', type: 'routine', category: 'fav-fit-thu' },
      ],
    },
    {
      id: 'fav-neck-thu', label: 'Neck Reset', icon: '🧘', color: '#90b4ce', goalId: 'favio-neck-balance',
      tasks: [
        { id: 'fav-thu-7', label: '5-min Neck Reset (chin tucks + shoulder blade squeezes)', timeOfDay: 'morning', type: 'routine', category: 'fav-neck-thu' },
      ],
    },
    {
      id: 'fav-mb-thu', label: 'Mental Balance', icon: '🥁', color: '#094067', goalId: 'favio-founder-performance',
      tasks: [
        { id: 'fav-thu-8', label: 'Drums session (20–30 min)', timeOfDay: 'evening', type: 'goal', category: 'fav-mb-thu' },
        { id: 'fav-thu-9', label: 'Intentional time with wife', timeOfDay: 'evening', type: 'priority', category: 'fav-mb-thu' },
        { id: 'fav-thu-10', label: 'No intense work 1 hr before bed', timeOfDay: 'evening', type: 'routine', category: 'fav-mb-thu' },
        { id: 'fav-thu-11', label: '10–20 min Reading before bed', timeOfDay: 'evening', type: 'goal', category: 'fav-mb-thu' },
        { id: 'fav-thu-12', label: 'Log sleep routine (wind-down)', timeOfDay: 'evening', type: 'routine', category: 'fav-mb-thu' },
      ],
    },
  ],
  Fri: [
    {
      id: 'fav-hl-fri', label: 'Healthy Living', icon: '🥗', color: '#ef4565', goalId: 'favio-lose-weight',
      tasks: [
        { id: 'fav-fri-1', label: 'Protein at breakfast', timeOfDay: 'morning', type: 'priority', category: 'fav-hl-fri' },
        { id: 'fav-fri-2', label: 'Hydration target (3–4 L)', timeOfDay: 'morning', type: 'routine', category: 'fav-hl-fri' },
        { id: 'fav-fri-3', label: 'Protein at lunch', timeOfDay: 'morning', type: 'routine', category: 'fav-hl-fri' },
        { id: 'fav-fri-4', label: 'Protein at dinner', timeOfDay: 'evening', type: 'routine', category: 'fav-hl-fri' },
      ],
    },
    {
      id: 'fav-fit-fri', label: 'Fitness & Cardio', icon: '🏃', color: '#3da9fc', goalId: 'favio-longevity',
      tasks: [
        { id: 'fav-fri-5', label: 'Easy Run or Long Walk (25–40 min)', timeOfDay: 'morning', type: 'priority', category: 'fav-fit-fri' },
        { id: 'fav-fri-6', label: 'Warm-up before cardio', timeOfDay: 'morning', type: 'routine', category: 'fav-fit-fri' },
      ],
    },
    {
      id: 'fav-neck-fri', label: 'Neck Reset', icon: '🧘', color: '#90b4ce', goalId: 'favio-neck-balance',
      tasks: [
        { id: 'fav-fri-7', label: '5-min Neck Reset (chin tucks + shoulder blade squeezes)', timeOfDay: 'morning', type: 'routine', category: 'fav-neck-fri' },
      ],
    },
    {
      id: 'fav-mb-fri', label: 'Mental Balance', icon: '😂', color: '#094067', goalId: 'favio-founder-performance',
      tasks: [
        { id: 'fav-fri-8', label: 'Comedy night / stress relief', timeOfDay: 'evening', type: 'goal', category: 'fav-mb-fri' },
        { id: 'fav-fri-9', label: 'Intentional time with wife', timeOfDay: 'evening', type: 'priority', category: 'fav-mb-fri' },
        { id: 'fav-fri-10', label: 'No intense work 1 hr before bed', timeOfDay: 'evening', type: 'routine', category: 'fav-mb-fri' },
        { id: 'fav-fri-11', label: 'Log sleep routine (wind-down)', timeOfDay: 'evening', type: 'routine', category: 'fav-mb-fri' },
      ],
    },
  ],
  Sat: [
    {
      id: 'fav-hl-sat', label: 'Healthy Living', icon: '🥗', color: '#ef4565', goalId: 'favio-lose-weight',
      tasks: [
        { id: 'fav-sat-1', label: 'Protein at breakfast', timeOfDay: 'morning', type: 'priority', category: 'fav-hl-sat' },
        { id: 'fav-sat-2', label: 'Hydration target (3–4 L)', timeOfDay: 'morning', type: 'routine', category: 'fav-hl-sat' },
        { id: 'fav-sat-3', label: 'Protein at lunch', timeOfDay: 'morning', type: 'routine', category: 'fav-hl-sat' },
        { id: 'fav-sat-4', label: 'Protein at dinner', timeOfDay: 'evening', type: 'routine', category: 'fav-hl-sat' },
      ],
    },
    {
      id: 'fav-fit-sat', label: 'Fitness & Tennis', icon: '🎾', color: '#3da9fc', goalId: 'favio-longevity',
      tasks: [
        { id: 'fav-sat-5', label: 'Tennis + warm-up', timeOfDay: 'morning', type: 'priority', category: 'fav-fit-sat' },
      ],
    },
    {
      id: 'fav-neck-sat', label: 'Neck Reset', icon: '🧘', color: '#90b4ce', goalId: 'favio-neck-balance',
      tasks: [
        { id: 'fav-sat-6', label: '5-min Neck Reset (chin tucks + shoulder blade squeezes)', timeOfDay: 'morning', type: 'routine', category: 'fav-neck-sat' },
      ],
    },
    {
      id: 'fav-mb-sat', label: 'Social & Balance', icon: '👥', color: '#094067', goalId: 'favio-neck-balance',
      tasks: [
        { id: 'fav-sat-7', label: 'Social time (friends / family)', timeOfDay: 'evening', type: 'goal', category: 'fav-mb-sat' },
        { id: 'fav-sat-8', label: 'Intentional time with wife', timeOfDay: 'evening', type: 'priority', category: 'fav-mb-sat' },
        { id: 'fav-sat-9', label: 'Log sleep routine (wind-down)', timeOfDay: 'evening', type: 'routine', category: 'fav-mb-sat' },
      ],
    },
  ],
  Sun: [
    {
      id: 'fav-hl-sun', label: 'Healthy Living', icon: '🥗', color: '#ef4565', goalId: 'favio-lose-weight',
      tasks: [
        { id: 'fav-sun-1', label: 'Protein at breakfast', timeOfDay: 'morning', type: 'priority', category: 'fav-hl-sun' },
        { id: 'fav-sun-2', label: 'Hydration target (3–4 L)', timeOfDay: 'morning', type: 'routine', category: 'fav-hl-sun' },
        { id: 'fav-sun-3', label: 'Meal prep for the week', timeOfDay: 'morning', type: 'goal', category: 'fav-hl-sun' },
        { id: 'fav-sun-4', label: 'Protein at lunch', timeOfDay: 'morning', type: 'routine', category: 'fav-hl-sun' },
        { id: 'fav-sun-5', label: 'Protein at dinner', timeOfDay: 'evening', type: 'routine', category: 'fav-hl-sun' },
      ],
    },
    {
      id: 'fav-fit-sun', label: 'Fitness & Reset', icon: '🚶', color: '#3da9fc', goalId: 'favio-longevity',
      tasks: [
        { id: 'fav-sun-6', label: 'Long Walk (40–60 min)', timeOfDay: 'morning', type: 'priority', category: 'fav-fit-sun' },
        { id: 'fav-sun-7', label: 'Review weight trend (weekly average)', timeOfDay: 'morning', type: 'routine', category: 'fav-fit-sun' },
      ],
    },
    {
      id: 'fav-neck-sun', label: 'Neck Reset', icon: '🧘', color: '#90b4ce', goalId: 'favio-neck-balance',
      tasks: [
        { id: 'fav-sun-8', label: '5-min Neck Reset (chin tucks + shoulder blade squeezes)', timeOfDay: 'morning', type: 'routine', category: 'fav-neck-sun' },
      ],
    },
    {
      id: 'fav-mb-sun', label: 'Weekly Review & Balance', icon: '📋', color: '#094067', goalId: 'favio-founder-performance',
      tasks: [
        { id: 'fav-sun-9', label: 'Weekly review (goals + scoreboard)', timeOfDay: 'morning', type: 'priority', category: 'fav-mb-sun' },
        { id: 'fav-sun-10', label: 'Meaningful time with wife', timeOfDay: 'evening', type: 'priority', category: 'fav-mb-sun' },
        { id: 'fav-sun-11', label: 'No intense work 1 hr before bed', timeOfDay: 'evening', type: 'routine', category: 'fav-mb-sun' },
        { id: 'fav-sun-12', label: '10–20 min Reading before bed', timeOfDay: 'evening', type: 'goal', category: 'fav-mb-sun' },
        { id: 'fav-sun-13', label: 'Log sleep routine (wind-down)', timeOfDay: 'evening', type: 'routine', category: 'fav-mb-sun' },
      ],
    },
  ],
};

// ──────────────────────────────────────────────
// Roi - Healthy Mind & Body (Mon–Sun)
// ──────────────────────────────────────────────
const ROI_BY_DAY: Record<string, TaskCategory[]> = {
  Mon: [
    {
      id: 'roi-mobility-mon', label: 'Neck & Shoulder Mobility', icon: '🧘', color: '#90b4ce', goalId: 'roi-healthy-mind-body',
      tasks: [
        { id: 'roi-mon-1', label: 'Neck circles & chin tucks - 5 min', timeOfDay: 'morning', type: 'routine', category: 'roi-mobility-mon' },
        { id: 'roi-mon-2', label: 'Shoulder rolls & cross-body stretch', timeOfDay: 'morning', type: 'routine', category: 'roi-mobility-mon' },
        { id: 'roi-mon-3', label: 'Doorway chest opener - 3 sets', timeOfDay: 'morning', type: 'goal', category: 'roi-mobility-mon' },
      ],
    },
    {
      id: 'roi-walk-mon', label: 'Daily Walk', icon: '🚶', color: '#3da9fc', goalId: 'roi-healthy-mind-body',
      tasks: [
        { id: 'roi-mon-4', label: 'Walk 30–60 min', timeOfDay: 'evening', type: 'priority', category: 'roi-walk-mon', valueType: 'health', estimatedValue: 200, valueUnit: 'cal' },
      ],
    },
    {
      id: 'roi-hydrate-mon', label: 'Hydration', icon: '💧', color: '#094067', goalId: 'roi-healthy-mind-body',
      tasks: [
        { id: 'roi-mon-5', label: 'Drink 2–3 L water today', timeOfDay: 'morning', type: 'routine', category: 'roi-hydrate-mon' },
        { id: 'roi-mon-6', label: 'No sugary drinks today', timeOfDay: 'evening', type: 'goal', category: 'roi-hydrate-mon' },
      ],
    },
  ],
  Tue: [
    {
      id: 'roi-hip-tue', label: 'Hip Mobility', icon: '🤸', color: '#ef4565', goalId: 'roi-healthy-mind-body',
      tasks: [
        { id: 'roi-tue-1', label: 'Hip flexor stretch - 3 min each side', timeOfDay: 'morning', type: 'routine', category: 'roi-hip-tue' },
        { id: 'roi-tue-2', label: 'Pigeon pose or figure-4 stretch', timeOfDay: 'morning', type: 'routine', category: 'roi-hip-tue' },
        { id: 'roi-tue-3', label: 'Lateral band walks - 3 sets', timeOfDay: 'morning', type: 'goal', category: 'roi-hip-tue' },
      ],
    },
    {
      id: 'roi-bw-tue', label: 'Body Weight Workout', icon: '💪', color: '#3da9fc', goalId: 'roi-healthy-mind-body',
      tasks: [
        { id: 'roi-tue-4', label: 'Push-ups - 3 sets to failure', timeOfDay: 'evening', type: 'priority', category: 'roi-bw-tue', valueType: 'health', estimatedValue: 150, valueUnit: 'cal' },
        { id: 'roi-tue-5', label: 'Squats & lunges - 3 sets each', timeOfDay: 'evening', type: 'priority', category: 'roi-bw-tue' },
        { id: 'roi-tue-6', label: 'Core - planks & crunches', timeOfDay: 'evening', type: 'routine', category: 'roi-bw-tue' },
      ],
    },
    {
      id: 'roi-hydrate-tue', label: 'Hydration', icon: '💧', color: '#094067', goalId: 'roi-healthy-mind-body',
      tasks: [
        { id: 'roi-tue-7', label: 'Drink 2–3 L water today', timeOfDay: 'morning', type: 'routine', category: 'roi-hydrate-tue' },
      ],
    },
  ],
  Wed: [
    {
      id: 'roi-leg-wed', label: 'Leg Day', icon: '🦵', color: '#ef4565', goalId: 'roi-healthy-mind-body',
      tasks: [
        { id: 'roi-wed-1', label: 'Squats - 4 sets x 12–15 reps', timeOfDay: 'morning', type: 'priority', category: 'roi-leg-wed', valueType: 'health', estimatedValue: 250, valueUnit: 'cal' },
        { id: 'roi-wed-2', label: 'Romanian deadlifts - 3 sets', timeOfDay: 'morning', type: 'priority', category: 'roi-leg-wed' },
        { id: 'roi-wed-3', label: 'Calf raises & glute bridges', timeOfDay: 'morning', type: 'routine', category: 'roi-leg-wed' },
      ],
    },
    {
      id: 'roi-walk-wed', label: 'Daily Walk', icon: '🚶', color: '#3da9fc', goalId: 'roi-healthy-mind-body',
      tasks: [
        { id: 'roi-wed-4', label: 'Walk 30–60 min', timeOfDay: 'evening', type: 'goal', category: 'roi-walk-wed', valueType: 'health', estimatedValue: 200, valueUnit: 'cal' },
      ],
    },
    {
      id: 'roi-hydrate-wed', label: 'Hydration', icon: '💧', color: '#094067', goalId: 'roi-healthy-mind-body',
      tasks: [
        { id: 'roi-wed-5', label: 'Drink 2–3 L water today', timeOfDay: 'morning', type: 'routine', category: 'roi-hydrate-wed' },
      ],
    },
  ],
  Thu: [
    {
      id: 'roi-mobility-thu', label: 'Neck & Shoulder Mobility', icon: '🧘', color: '#90b4ce', goalId: 'roi-healthy-mind-body',
      tasks: [
        { id: 'roi-thu-1', label: 'Neck stretch & shoulder mobility flow', timeOfDay: 'morning', type: 'routine', category: 'roi-mobility-thu' },
        { id: 'roi-thu-2', label: 'Foam roll upper back - 5 min', timeOfDay: 'morning', type: 'routine', category: 'roi-mobility-thu' },
      ],
    },
    {
      id: 'roi-bw-thu', label: 'Body Weight Workout', icon: '💪', color: '#3da9fc', goalId: 'roi-healthy-mind-body',
      tasks: [
        { id: 'roi-thu-3', label: 'Pull-ups or inverted rows - 3 sets', timeOfDay: 'evening', type: 'priority', category: 'roi-bw-thu', valueType: 'health', estimatedValue: 180, valueUnit: 'cal' },
        { id: 'roi-thu-4', label: 'Dips & tricep push-ups - 3 sets', timeOfDay: 'evening', type: 'priority', category: 'roi-bw-thu' },
        { id: 'roi-thu-5', label: 'Plank variations - 3 sets', timeOfDay: 'evening', type: 'routine', category: 'roi-bw-thu' },
      ],
    },
    {
      id: 'roi-hydrate-thu', label: 'Hydration', icon: '💧', color: '#094067', goalId: 'roi-healthy-mind-body',
      tasks: [
        { id: 'roi-thu-6', label: 'Drink 2–3 L water today', timeOfDay: 'morning', type: 'routine', category: 'roi-hydrate-thu' },
      ],
    },
  ],
  Fri: [
    {
      id: 'roi-hip-fri', label: 'Hip Mobility', icon: '🤸', color: '#ef4565', goalId: 'roi-healthy-mind-body',
      tasks: [
        { id: 'roi-fri-1', label: 'Full hip mobility circuit - 15 min', timeOfDay: 'morning', type: 'routine', category: 'roi-hip-fri', valueType: 'health', estimatedValue: 80, valueUnit: 'cal' },
        { id: 'roi-fri-2', label: 'Deep squat holds - 5 min', timeOfDay: 'morning', type: 'goal', category: 'roi-hip-fri' },
      ],
    },
    {
      id: 'roi-walk-fri', label: 'Daily Walk', icon: '🚶', color: '#3da9fc', goalId: 'roi-healthy-mind-body',
      tasks: [
        { id: 'roi-fri-3', label: 'Walk 30–60 min', timeOfDay: 'evening', type: 'goal', category: 'roi-walk-fri', valueType: 'health', estimatedValue: 200, valueUnit: 'cal' },
        { id: 'roi-fri-4', label: 'Stretch & cool down after walk', timeOfDay: 'evening', type: 'routine', category: 'roi-walk-fri' },
      ],
    },
    {
      id: 'roi-hydrate-fri', label: 'Hydration', icon: '💧', color: '#094067', goalId: 'roi-healthy-mind-body',
      tasks: [
        { id: 'roi-fri-5', label: 'Drink 2–3 L water today', timeOfDay: 'morning', type: 'routine', category: 'roi-hydrate-fri' },
        { id: 'roi-fri-6', label: 'Eat a clean, high-protein meal', timeOfDay: 'evening', type: 'goal', category: 'roi-hydrate-fri' },
      ],
    },
  ],
  Sat: [
    {
      id: 'roi-cycling-sat', label: 'Cycling Session', icon: '🚴', color: '#ef4565', goalId: 'roi-healthy-mind-body',
      tasks: [
        { id: 'roi-sat-1', label: 'Morning cycling ride - 45–90 min', timeOfDay: 'morning', type: 'priority', category: 'roi-cycling-sat', valueType: 'health', estimatedValue: 500, valueUnit: 'cal' },
        { id: 'roi-sat-2', label: 'Warm-up spin & cool-down stretch', timeOfDay: 'morning', type: 'routine', category: 'roi-cycling-sat' },
      ],
    },
    {
      id: 'roi-boulder-sat', label: 'Bouldering', icon: '🧗', color: '#094067', goalId: 'roi-healthy-mind-body',
      tasks: [
        { id: 'roi-sat-3', label: 'Bouldering session - 1 hr', timeOfDay: 'morning', type: 'goal', category: 'roi-boulder-sat', valueType: 'health', estimatedValue: 400, valueUnit: 'cal' },
        { id: 'roi-sat-4', label: 'Work on one project problem', timeOfDay: 'morning', type: 'priority', category: 'roi-boulder-sat' },
      ],
    },
    {
      id: 'roi-hydrate-sat', label: 'Hydration & Recovery', icon: '💧', color: '#90b4ce', goalId: 'roi-healthy-mind-body',
      tasks: [
        { id: 'roi-sat-5', label: 'Drink 3+ L water (active day)', timeOfDay: 'morning', type: 'routine', category: 'roi-hydrate-sat' },
        { id: 'roi-sat-6', label: 'High-protein recovery meal', timeOfDay: 'evening', type: 'routine', category: 'roi-hydrate-sat' },
        { id: 'roi-sat-7', label: 'Full body stretch - 10 min', timeOfDay: 'evening', type: 'routine', category: 'roi-hydrate-sat' },
      ],
    },
  ],
  Sun: [
    {
      id: 'roi-leg-sun', label: 'Leg Day', icon: '🦵', color: '#ef4565', goalId: 'roi-healthy-mind-body',
      tasks: [
        { id: 'roi-sun-1', label: 'Squats & split squats - 4 sets', timeOfDay: 'morning', type: 'priority', category: 'roi-leg-sun', valueType: 'health', estimatedValue: 220, valueUnit: 'cal' },
        { id: 'roi-sun-2', label: 'Hip hinges & deadlifts - 3 sets', timeOfDay: 'morning', type: 'priority', category: 'roi-leg-sun' },
      ],
    },
    {
      id: 'roi-review-sun', label: 'Weekly Review & Health', icon: '📋', color: '#094067', goalId: 'roi-healthy-mind-body',
      tasks: [
        { id: 'roi-sun-3', label: 'Review this week\'s fitness activity', timeOfDay: 'morning', type: 'goal', category: 'roi-review-sun' },
        { id: 'roi-sun-4', label: 'Plan next week\'s workouts', timeOfDay: 'morning', type: 'priority', category: 'roi-review-sun' },
        { id: 'roi-sun-5', label: 'Drink 2–3 L water today', timeOfDay: 'morning', type: 'routine', category: 'roi-review-sun' },
        { id: 'roi-sun-6', label: 'Rest & active recovery', timeOfDay: 'evening', type: 'routine', category: 'roi-review-sun' },
      ],
    },
  ],
};

// ──────────────────────────────────────────────
// Eunice - Creative Routine Builder (Mon–Sun)
// ──────────────────────────────────────────────
const EUNICE_BY_DAY: Record<string, TaskCategory[]> = {
  Mon: [
    {
      id: 'eu-morning-mon', label: 'Morning Routine', icon: '🌅', color: '#90b4ce', goalId: 'eunice-strava',
      tasks: [
        { id: 'eu-mon-1', label: 'Walk the dog', timeOfDay: 'morning', type: 'priority', category: 'eu-morning-mon', valueType: 'health', estimatedValue: 120, valueUnit: 'cal' },
        { id: 'eu-mon-2', label: 'Stretching - 10 min', timeOfDay: 'morning', type: 'routine', category: 'eu-morning-mon' },
        { id: 'eu-mon-3', label: '5KM walk (Strava)', timeOfDay: 'morning', type: 'goal', category: 'eu-morning-mon', valueType: 'health', estimatedValue: 200, valueUnit: 'cal' },
        { id: 'eu-mon-4', label: 'Cook lunch', timeOfDay: 'morning', type: 'routine', category: 'eu-morning-mon' },
        { id: 'eu-mon-5', label: 'Check work tasks & messages', timeOfDay: 'morning', type: 'priority', category: 'eu-morning-mon' },
      ],
    },
    {
      id: 'eu-evening-mon', label: 'Evening Routine', icon: '🌙', color: '#3da9fc', goalId: 'eunice-artwork',
      tasks: [
        { id: 'eu-mon-6', label: 'Work 3 hours (focused block)', timeOfDay: 'evening', type: 'priority', category: 'eu-evening-mon' },
        { id: 'eu-mon-7', label: 'Play with the dog (5pm)', timeOfDay: 'evening', type: 'routine', category: 'eu-evening-mon' },
        { id: 'eu-mon-8', label: 'Cook dinner', timeOfDay: 'evening', type: 'routine', category: 'eu-evening-mon' },
        { id: 'eu-mon-9', label: 'Wind down - light cleaning', timeOfDay: 'evening', type: 'routine', category: 'eu-evening-mon' },
      ],
    },
  ],
  Tue: [
    {
      id: 'eu-morning-tue', label: 'Morning Routine', icon: '🌅', color: '#90b4ce',
      tasks: [
        { id: 'eu-tue-1', label: 'Walk the dog', timeOfDay: 'morning', type: 'priority', category: 'eu-morning-tue', valueType: 'health', estimatedValue: 120, valueUnit: 'cal' },
        { id: 'eu-tue-2', label: 'Stretching - 10 min', timeOfDay: 'morning', type: 'routine', category: 'eu-morning-tue' },
        { id: 'eu-tue-3', label: 'Cook lunch', timeOfDay: 'morning', type: 'routine', category: 'eu-morning-tue' },
        { id: 'eu-tue-4', label: 'Check work tasks & messages', timeOfDay: 'morning', type: 'priority', category: 'eu-morning-tue' },
      ],
    },
    {
      id: 'eu-paint-tue', label: 'Art & Creativity', icon: '🎨', color: '#ef4565', goalId: 'eunice-artwork',
      tasks: [
        { id: 'eu-tue-5', label: 'Painting session - at least 30 min', timeOfDay: 'morning', type: 'goal', category: 'eu-paint-tue' },
      ],
    },
    {
      id: 'eu-evening-tue', label: 'Evening Routine', icon: '🌙', color: '#3da9fc',
      tasks: [
        { id: 'eu-tue-6', label: 'Work 3 hours (focused block)', timeOfDay: 'evening', type: 'priority', category: 'eu-evening-tue' },
        { id: 'eu-tue-7', label: 'Play with the dog (5pm)', timeOfDay: 'evening', type: 'routine', category: 'eu-evening-tue' },
        { id: 'eu-tue-8', label: 'Cook dinner', timeOfDay: 'evening', type: 'routine', category: 'eu-evening-tue' },
        { id: 'eu-tue-9', label: 'Wind down - light cleaning', timeOfDay: 'evening', type: 'routine', category: 'eu-evening-tue' },
      ],
    },
  ],
  Wed: [
    {
      id: 'eu-morning-wed', label: 'Morning Routine', icon: '🌅', color: '#90b4ce', goalId: 'eunice-strava',
      tasks: [
        { id: 'eu-wed-1', label: 'Walk the dog', timeOfDay: 'morning', type: 'priority', category: 'eu-morning-wed', valueType: 'health', estimatedValue: 120, valueUnit: 'cal' },
        { id: 'eu-wed-2', label: 'Stretching - 10 min', timeOfDay: 'morning', type: 'routine', category: 'eu-morning-wed' },
        { id: 'eu-wed-3', label: '5KM walk (Strava)', timeOfDay: 'morning', type: 'goal', category: 'eu-morning-wed', valueType: 'health', estimatedValue: 200, valueUnit: 'cal' },
        { id: 'eu-wed-4', label: 'Cook lunch', timeOfDay: 'morning', type: 'routine', category: 'eu-morning-wed' },
        { id: 'eu-wed-5', label: 'Check work tasks & messages', timeOfDay: 'morning', type: 'priority', category: 'eu-morning-wed' },
      ],
    },
    {
      id: 'eu-evening-wed', label: 'Evening Routine', icon: '🌙', color: '#3da9fc', goalId: 'eunice-artwork',
      tasks: [
        { id: 'eu-wed-6', label: 'Work 3 hours (focused block)', timeOfDay: 'evening', type: 'priority', category: 'eu-evening-wed' },
        { id: 'eu-wed-7', label: 'Play with the dog (5pm)', timeOfDay: 'evening', type: 'routine', category: 'eu-evening-wed' },
        { id: 'eu-wed-8', label: 'Cook dinner', timeOfDay: 'evening', type: 'routine', category: 'eu-evening-wed' },
        { id: 'eu-wed-9', label: 'Wind down - light cleaning', timeOfDay: 'evening', type: 'routine', category: 'eu-evening-wed' },
      ],
    },
  ],
  Thu: [
    {
      id: 'eu-morning-thu', label: 'Morning Routine', icon: '🌅', color: '#90b4ce',
      tasks: [
        { id: 'eu-thu-1', label: 'Walk the dog', timeOfDay: 'morning', type: 'priority', category: 'eu-morning-thu', valueType: 'health', estimatedValue: 120, valueUnit: 'cal' },
        { id: 'eu-thu-2', label: 'Stretching - 10 min', timeOfDay: 'morning', type: 'routine', category: 'eu-morning-thu' },
        { id: 'eu-thu-3', label: 'Cook lunch', timeOfDay: 'morning', type: 'routine', category: 'eu-morning-thu' },
        { id: 'eu-thu-4', label: 'Check work tasks & messages', timeOfDay: 'morning', type: 'priority', category: 'eu-morning-thu' },
      ],
    },
    {
      id: 'eu-paint-thu', label: 'Art & Creativity', icon: '🎨', color: '#ef4565', goalId: 'eunice-artwork',
      tasks: [
        { id: 'eu-thu-5', label: 'Painting session - at least 30 min', timeOfDay: 'morning', type: 'goal', category: 'eu-paint-thu' },
        { id: 'eu-thu-6', label: 'Meditation - 10 min', timeOfDay: 'morning', type: 'routine', category: 'eu-paint-thu' },
      ],
    },
    {
      id: 'eu-evening-thu', label: 'Evening Routine', icon: '🌙', color: '#3da9fc',
      tasks: [
        { id: 'eu-thu-7', label: 'Work 3 hours (focused block)', timeOfDay: 'evening', type: 'priority', category: 'eu-evening-thu' },
        { id: 'eu-thu-8', label: 'Play with the dog (5pm)', timeOfDay: 'evening', type: 'routine', category: 'eu-evening-thu' },
        { id: 'eu-thu-9', label: 'Cook dinner', timeOfDay: 'evening', type: 'routine', category: 'eu-evening-thu' },
        { id: 'eu-thu-10', label: 'Wind down - light cleaning', timeOfDay: 'evening', type: 'routine', category: 'eu-evening-thu' },
      ],
    },
  ],
  Fri: [
    {
      id: 'eu-morning-fri', label: 'Morning Routine', icon: '🌅', color: '#90b4ce', goalId: 'eunice-strava',
      tasks: [
        { id: 'eu-fri-1', label: 'Walk the dog', timeOfDay: 'morning', type: 'priority', category: 'eu-morning-fri', valueType: 'health', estimatedValue: 120, valueUnit: 'cal' },
        { id: 'eu-fri-2', label: 'Stretching - 10 min', timeOfDay: 'morning', type: 'routine', category: 'eu-morning-fri' },
        { id: 'eu-fri-3', label: '5KM walk (Strava)', timeOfDay: 'morning', type: 'goal', category: 'eu-morning-fri', valueType: 'health', estimatedValue: 200, valueUnit: 'cal' },
        { id: 'eu-fri-4', label: 'Cook lunch', timeOfDay: 'morning', type: 'routine', category: 'eu-morning-fri' },
        { id: 'eu-fri-5', label: 'Check work tasks & messages', timeOfDay: 'morning', type: 'priority', category: 'eu-morning-fri' },
      ],
    },
    {
      id: 'eu-evening-fri', label: 'Evening Routine', icon: '🌙', color: '#3da9fc',
      tasks: [
        { id: 'eu-fri-6', label: 'Work 3 hours (focused block)', timeOfDay: 'evening', type: 'priority', category: 'eu-evening-fri' },
        { id: 'eu-fri-7', label: 'Play with the dog (5pm)', timeOfDay: 'evening', type: 'routine', category: 'eu-evening-fri' },
        { id: 'eu-fri-8', label: 'Cook dinner', timeOfDay: 'evening', type: 'routine', category: 'eu-evening-fri' },
        { id: 'eu-fri-9', label: 'Wind down - light cleaning', timeOfDay: 'evening', type: 'routine', category: 'eu-evening-fri' },
      ],
    },
  ],
  Sat: [
    {
      id: 'eu-morning-sat', label: 'Morning Routine', icon: '🌅', color: '#90b4ce',
      tasks: [
        { id: 'eu-sat-1', label: 'Walk the dog', timeOfDay: 'morning', type: 'priority', category: 'eu-morning-sat', valueType: 'health', estimatedValue: 120, valueUnit: 'cal' },
        { id: 'eu-sat-2', label: 'Stretching & meditation - 15 min', timeOfDay: 'morning', type: 'routine', category: 'eu-morning-sat' },
      ],
    },
    {
      id: 'eu-paint-sat', label: 'Art & Creativity', icon: '🎨', color: '#ef4565', goalId: 'eunice-artwork',
      tasks: [
        { id: 'eu-sat-3', label: 'Painting session - 1–2 hours', timeOfDay: 'morning', type: 'goal', category: 'eu-paint-sat' },
        { id: 'eu-sat-4', label: 'Review artwork progress for living room', timeOfDay: 'morning', type: 'priority', category: 'eu-paint-sat' },
      ],
    },
    {
      id: 'eu-resto-sat', label: 'Weekend Restaurant', icon: '🍽️', color: '#094067', goalId: 'eunice-restaurant',
      tasks: [
        { id: 'eu-sat-5', label: 'Discover & visit a new restaurant', timeOfDay: 'evening', type: 'goal', category: 'eu-resto-sat' },
        { id: 'eu-sat-6', label: 'Write a short review or memory note', timeOfDay: 'evening', type: 'routine', category: 'eu-resto-sat' },
      ],
    },
    {
      id: 'eu-evening-sat', label: 'Evening Wind-down', icon: '🌙', color: '#3da9fc',
      tasks: [
        { id: 'eu-sat-7', label: 'Play with the dog (5pm)', timeOfDay: 'evening', type: 'routine', category: 'eu-evening-sat' },
        { id: 'eu-sat-8', label: 'Light cleaning & tidy up', timeOfDay: 'evening', type: 'routine', category: 'eu-evening-sat' },
      ],
    },
  ],
  Sun: [
    {
      id: 'eu-morning-sun', label: 'Morning Routine', icon: '🌅', color: '#90b4ce',
      tasks: [
        { id: 'eu-sun-1', label: 'Walk the dog', timeOfDay: 'morning', type: 'priority', category: 'eu-morning-sun', valueType: 'health', estimatedValue: 120, valueUnit: 'cal' },
        { id: 'eu-sun-2', label: 'Stretching & meditation - 15 min', timeOfDay: 'morning', type: 'routine', category: 'eu-morning-sun' },
        { id: 'eu-sun-3', label: 'Cook a nice Sunday lunch', timeOfDay: 'morning', type: 'routine', category: 'eu-morning-sun' },
      ],
    },
    {
      id: 'eu-paint-sun', label: 'Art & Creativity', icon: '🎨', color: '#ef4565', goalId: 'eunice-artwork',
      tasks: [
        { id: 'eu-sun-4', label: 'Painting session - 1–2 hours', timeOfDay: 'morning', type: 'goal', category: 'eu-paint-sun' },
      ],
    },
    {
      id: 'eu-resto-sun', label: 'Weekend Restaurant', icon: '🍽️', color: '#094067', goalId: 'eunice-restaurant',
      tasks: [
        { id: 'eu-sun-5', label: 'Explore a new restaurant or café', timeOfDay: 'evening', type: 'goal', category: 'eu-resto-sun' },
      ],
    },
    {
      id: 'eu-planning-sun', label: 'Weekly Planning', icon: '📋', color: '#3da9fc',
      tasks: [
        { id: 'eu-sun-6', label: 'Plan next week\'s routine', timeOfDay: 'evening', type: 'priority', category: 'eu-planning-sun' },
        { id: 'eu-sun-7', label: 'Play with the dog (5pm)', timeOfDay: 'evening', type: 'routine', category: 'eu-planning-sun' },
        { id: 'eu-sun-8', label: 'Wind down - light cleaning', timeOfDay: 'evening', type: 'routine', category: 'eu-planning-sun' },
      ],
    },
  ],
};

// ──────────────────────────────────────────────
// Unified accessor - same UX for all profiles
// ──────────────────────────────────────────────
function getTodayDayName(): string {
  return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][new Date().getDay()];
}

/**
 * Returns task categories for a given profile (and optional day for Kyle/Rafael).
 * Does NOT include the "personal-goals" coming-soon placeholder -
 * TaskList renders that separately as the first section.
 */
export function getTaskCategoriesForProfile(profileId: string, dayName?: string): TaskCategory[] {
  const day = dayName ?? getTodayDayName();
  let categories: TaskCategory[];
  switch (profileId) {
    case 'kyle':   categories = KYLE_BY_DAY[day] ?? []; break;
    case 'john':   categories = JOHN_CATEGORIES; break;
    case 'jude':   categories = JUDE_BY_DAY[day] ?? []; break;
    case 'rafael': categories = RAFAEL_BY_DAY[day] ?? []; break;
    case 'yesa':   categories = YESA_BY_DAY[day] ?? []; break;
    case 'favio':  categories = FAVIO_BY_DAY[day] ?? []; break;
    case 'roi':    categories = ROI_BY_DAY[day] ?? []; break;
    case 'eunice': categories = EUNICE_BY_DAY[day] ?? []; break;
    default:       categories = TASK_CATEGORIES.filter(c => c.id !== 'personal-goals');
  }
  return filterHiddenSeedCategories(profileId, categories);
}

export function getAllTasks(): Task[] {
  return TASK_CATEGORIES.flatMap(cat => cat.tasks);
}

export function getAllTasksForProfile(profileId: string): Task[] {
  const hidden = getPermanentlyHiddenSeedTaskIds(profileId);
  let tasks: Task[];
  switch (profileId) {
    case 'kyle':   tasks = Object.values(KYLE_BY_DAY).flat().flatMap(c => c.tasks); break;
    case 'john':   tasks = JOHN_CATEGORIES.flatMap(c => c.tasks); break;
    case 'jude':   tasks = Object.values(JUDE_BY_DAY).flat().flatMap(c => c.tasks); break;
    case 'rafael': tasks = Object.values(RAFAEL_BY_DAY).flat().flatMap(c => c.tasks); break;
    case 'yesa':   tasks = Object.values(YESA_BY_DAY).flat().flatMap(c => c.tasks); break;
    case 'favio':  tasks = Object.values(FAVIO_BY_DAY).flat().flatMap(c => c.tasks); break;
    case 'roi':    tasks = Object.values(ROI_BY_DAY).flat().flatMap(c => c.tasks); break;
    case 'eunice': tasks = Object.values(EUNICE_BY_DAY).flat().flatMap(c => c.tasks); break;
    default:       tasks = getAllTasks();
  }
  return hidden.size === 0 ? tasks : tasks.filter(t => !hidden.has(t.id));
}

export function getTasksForToday(profileId: string): Task[] {
  return getTaskCategoriesForProfile(profileId).flatMap(c => c.tasks);
}

export function getWeekPlanForProfile(profileId: string): Record<string, string[]> {
  const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  let plan: Record<string, string[]>;
  switch (profileId) {
    case 'kyle':
      plan = Object.fromEntries(DAYS.map(d => [d, (KYLE_BY_DAY[d] ?? []).flatMap(c => c.tasks.map(t => t.id))]));
      break;
    case 'john': {
      const ids = JOHN_CATEGORIES.flatMap(c => c.tasks.map(t => t.id));
      plan = Object.fromEntries(DAYS.map(d => [d, ids]));
      break;
    }
    case 'jude':
      plan = Object.fromEntries(DAYS.map(d => [d, (JUDE_BY_DAY[d] ?? []).flatMap(c => c.tasks.map(t => t.id))]));
      break;
    case 'rafael':
      plan = Object.fromEntries(DAYS.map(d => [d, (RAFAEL_BY_DAY[d] ?? []).flatMap(c => c.tasks.map(t => t.id))]));
      break;
    case 'yesa':
      plan = Object.fromEntries(DAYS.map(d => [d, (YESA_BY_DAY[d] ?? []).flatMap(c => c.tasks.map(t => t.id))]));
      break;
    case 'favio':
      plan = Object.fromEntries(DAYS.map(d => [d, (FAVIO_BY_DAY[d] ?? []).flatMap(c => c.tasks.map(t => t.id))]));
      break;
    case 'roi':
      plan = Object.fromEntries(DAYS.map(d => [d, (ROI_BY_DAY[d] ?? []).flatMap(c => c.tasks.map(t => t.id))]));
      break;
    case 'eunice':
      plan = Object.fromEntries(DAYS.map(d => [d, (EUNICE_BY_DAY[d] ?? []).flatMap(c => c.tasks.map(t => t.id))]));
      break;
    default:
      plan = WEEK_PLAN;
  }
  const hidden = getPermanentlyHiddenSeedTaskIds(profileId);
  if (hidden.size === 0) return plan;
  return Object.fromEntries(
    Object.entries(plan).map(([day, ids]) => [day, ids.filter(id => !hidden.has(id))]),
  );
}

// ──────────────────────────────────────────────
// Task state helpers
// ──────────────────────────────────────────────
export function getDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function getTodayKey() {
  return getDateKey(new Date());
}

export function hasActivityOnDate(profileId: string, dateKey: string): boolean {
  if (localStorage.getItem(`streak-${profileId}-${dateKey}`) === 'true') return true;
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (
      key &&
      key.startsWith(`task-${profileId}-`) &&
      key.endsWith(`-${dateKey}`) &&
      localStorage.getItem(key) === 'done'
    ) return true;
  }
  return false;
}

// Computes the live streak from localStorage for any profile.
// Pass todayHasActivity=true if the caller already knows the user touched a task today.
export function computeLiveStreak(profileId: string, todayHasActivity = false): number {
  const todayKey = getTodayKey();
  const todayDone = todayHasActivity || hasActivityOnDate(profileId, todayKey);

  if (todayDone) {
    let count = 1;
    for (let i = 1; i <= 365; i++) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      if (hasActivityOnDate(profileId, getDateKey(d))) {
        count++;
      } else {
        break;
      }
    }
    return count;
  } else {
    // Today not yet done - show yesterday's trailing streak so users see what they stand to lose
    let count = 0;
    for (let i = 1; i <= 365; i++) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      if (hasActivityOnDate(profileId, getDateKey(d))) {
        count++;
      } else {
        break;
      }
    }
    return count;
  }
}

export function getTaskStatus(profileId: string, taskId: string, date: string): TaskStatus | null {
  const stored = localStorage.getItem(`task-${profileId}-${taskId}-${date}`);
  if (stored === 'inprogress' || stored === 'done' || stored === 'skipped') return stored;
  if (localStorage.getItem(`task-del-${profileId}-${taskId}-${date}`) === 'true') return 'skipped';
  return null;
}

export function setTaskStatus(profileId: string, taskId: string, date: string, status: TaskStatus | null) {
  const key = `task-${profileId}-${taskId}-${date}`;
  const delKey = `task-del-${profileId}-${taskId}-${date}`;
  if (!status) localStorage.removeItem(key);
  else localStorage.setItem(key, status);
  localStorage.removeItem(delKey);

  if (status === 'done') {
    localStorage.setItem(`streak-${profileId}-${date}`, 'true');
  }

  // Sync to Supabase (async, non-blocking)
  import('./supabaseSync').then(({ syncTaskStatus }) => {
    syncTaskStatus(profileId, taskId, date, status);
  });
  import('./cloudBackup').then(({ scheduleSave }) => scheduleSave(profileId));

  if (status === 'done') {
    import('./emailSettings').then(({ isEmailTypeEnabled }) => {
      if (!isEmailTypeEnabled('taskCompletionEnabled')) return;
      import('./profileContact').then(({ getProfileEmail }) => {
        import('./emailNudges').then(({ requestEmailSend }) => {
          requestEmailSend({
            profileId,
            type: 'task_completion',
            taskId,
            date,
            recipient: getProfileEmail(profileId) || undefined,
          });
        });
      });
    });
  }
}

/** Skipped for a single date only (Skip Just Today). */
export function isTaskSkippedForDate(profileId: string, taskId: string, date: string): boolean {
  return getTaskStatus(profileId, taskId, date) === 'skipped';
}

/** @deprecated Use isTaskSkippedForDate for day skips or isTaskActiveForDate for inclusion checks. */
export function isTaskDeleted(profileId: string, taskId: string, date: string): boolean {
  return isTaskSkippedForDate(profileId, taskId, date);
}

/** Permanently removed via Delete Forever (seed tasks). */
export function isTaskPermanentlyRemoved(profileId: string, taskId: string): boolean {
  return getPermanentlyHiddenSeedTaskIds(profileId).has(taskId);
}

/** Single source of truth: should this task appear anywhere for this date? */
export function isTaskActiveForDate(profileId: string, taskId: string, dateKey: string): boolean {
  if (isTaskPermanentlyRemoved(profileId, taskId)) return false;
  return true;
}

/** Mark a task as skipped for one day — stays visible with dimmed Skipped state. */
export function skipTaskForToday(profileId: string, taskId: string, date: string) {
  setTaskStatus(profileId, taskId, date, 'skipped');
  try { window.dispatchEvent(new CustomEvent('arbol-tasks-updated')); } catch { /* ignore */ }
}

/** Remove per-task localStorage state after permanent deletion. */
export function purgeTaskLocalState(profileId: string, taskId: string) {
  const prefixes = [
    `task-${profileId}-${taskId}-`,
    `task-del-${profileId}-${taskId}-`,
    `task-note-${profileId}-${taskId}-`,
    `arbol-task-blocked-${profileId}-${taskId}-`,
  ];
  for (let i = localStorage.length - 1; i >= 0; i--) {
    const key = localStorage.key(i);
    if (!key) continue;
    if (prefixes.some(p => key.startsWith(p))) localStorage.removeItem(key);
  }
}

function hiddenSeedStorageKey(profileId: string) {
  return `arbol-hidden-seed-${profileId}`;
}

function filterHiddenSeedCategories(profileId: string, categories: TaskCategory[]): TaskCategory[] {
  const hidden = getPermanentlyHiddenSeedTaskIds(profileId);
  if (hidden.size === 0) return categories;
  return categories.map(cat => ({
    ...cat,
    tasks: cat.tasks.filter(t => !hidden.has(t.id)),
  }));
}

export function getPermanentlyHiddenSeedTaskIds(profileId: string): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(hiddenSeedStorageKey(profileId)) || '[]') as string[]);
  } catch {
    return new Set();
  }
}

export function isSeedTaskPermanentlyHidden(profileId: string, taskId: string): boolean {
  return getPermanentlyHiddenSeedTaskIds(profileId).has(taskId);
}

export function permanentlyHideSeedTask(profileId: string, taskId: string) {
  const hidden = getPermanentlyHiddenSeedTaskIds(profileId);
  hidden.add(taskId);
  localStorage.setItem(hiddenSeedStorageKey(profileId), JSON.stringify([...hidden]));
  purgeTaskLocalState(profileId, taskId);
  import('./cloudBackup').then(({ scheduleSave }) => scheduleSave(profileId));
  try { window.dispatchEvent(new CustomEvent('arbol-tasks-updated')); } catch { /* ignore */ }
  try { window.dispatchEvent(new CustomEvent('arbol-goals-updated')); } catch { /* ignore */ }
}

export function markTaskDeleted(profileId: string, taskId: string, date: string) {
  skipTaskForToday(profileId, taskId, date);
}

// ──────────────────────────────────────────────
// Badges
// ──────────────────────────────────────────────
export interface Badge {
  id: string;
  icon: string;
  name: string;
  desc: string;
  category: 'streak' | 'performance' | 'time' | 'special';
  check: (p: Profile) => boolean;
}

export const BADGES: Badge[] = [
  // Daily streak badges
  { id: 'first-flame',    icon: '🔥', name: 'First Flame',    desc: 'Keep your streak alive for 1 day',   category: 'streak',      check: p => p.streak >= 1 },
  { id: 'spark-3',        icon: '⚡', name: '3-Day Spark',     desc: 'Maintain a 3-day streak',            category: 'streak',      check: p => p.streak >= 3 },
  { id: 'week-warrior',   icon: '🌟', name: 'Week Warrior',    desc: '7 consecutive days of momentum',     category: 'streak',      check: p => p.streak >= 7 },
  { id: 'two-weeks',      icon: '💪', name: 'Two-Week Strong', desc: '14-day unbroken streak',             category: 'streak',      check: p => p.streak >= 14 },
  { id: 'monthly',        icon: '🏆', name: 'Monthly Master',  desc: '30 days of consistent momentum',     category: 'streak',      check: p => p.streak >= 30 },
  { id: 'best-streak',    icon: '🎖️', name: 'Personal Best',   desc: 'Beat your own best daily streak',    category: 'streak',      check: p => p.streak >= p.bestStreak },

  // Weekly streak badges (Strava-style)
  { id: 'weekly-1',       icon: '📅', name: '1-Week Habit',    desc: '1 consecutive week with activity',   category: 'streak',      check: p => p.weeklyStreak >= 1 },
  { id: 'weekly-4',       icon: '🗓️', name: 'Monthly Rhythm',  desc: '4 consecutive weeks (1 month)',      category: 'streak',      check: p => p.weeklyStreak >= 4 },
  { id: 'weekly-8',       icon: '📆', name: '2-Month Consistency', desc: '8 consecutive weeks',            category: 'streak',      check: p => p.weeklyStreak >= 8 },
  { id: 'weekly-12',      icon: '🎯', name: 'Quarter Champion', desc: '12 consecutive weeks (3 months)',    category: 'streak',      check: p => p.weeklyStreak >= 12 },

  // Monthly streak badges (Strava-style)
  { id: 'monthly-1',      icon: '🌙', name: 'First Month',     desc: '1 full month with activity',         category: 'streak',      check: p => p.monthlyStreak >= 1 },
  { id: 'monthly-3',      icon: '🌟', name: 'Quarter Streak',  desc: '3 consecutive months',               category: 'streak',      check: p => p.monthlyStreak >= 3 },
  { id: 'monthly-6',      icon: '💫', name: 'Half-Year Hero',  desc: '6 consecutive months',               category: 'streak',      check: p => p.monthlyStreak >= 6 },
  { id: 'monthly-12',     icon: '🏅', name: 'Year-Long Legend', desc: '12 consecutive months (1 year)',     category: 'streak',      check: p => p.monthlyStreak >= 12 },

  // Performance badges
  { id: 'consistent',     icon: '📊', name: 'Consistent',      desc: 'Avg completion rate above 70%',      category: 'performance', check: p => p.completionRate >= 70 },
  { id: 'high-achiever',  icon: '🚀', name: 'High Achiever',   desc: 'Avg completion rate above 85%',      category: 'performance', check: p => p.completionRate >= 85 },
  { id: 'perfectionist',  icon: '💯', name: 'Perfectionist',   desc: 'Avg completion rate above 95%',      category: 'performance', check: p => p.completionRate >= 95 },

  // Time-based badges
  { id: 'getting-started',icon: '🌱', name: 'Getting Started', desc: 'Completed your first week',          category: 'time',        check: p => p.joinedWeek >= 1 },
  { id: 'veteran',        icon: '🎗️', name: 'Veteran',         desc: '5+ weeks on the program',            category: 'time',        check: p => p.joinedWeek >= 5 },
  { id: 'legend',         icon: '👑', name: 'Legend',          desc: '8+ weeks on the program',            category: 'time',        check: p => p.joinedWeek >= 8 },

  // Special badges
  { id: 'goal-getter',    icon: '🎯', name: 'Goal Getter',     desc: 'A natural at personal goals',        category: 'special',     check: p => p.completionRate >= 75 && p.streak >= 5 },
  { id: 'all-rounder',    icon: '🌿', name: 'All-Rounder',     desc: 'Thriving across all categories',     category: 'special',     check: p => p.completionRate >= 80 && p.joinedWeek >= 4 },
];

export function getEarnedBadges(profile: Profile): Badge[] {
  return BADGES.filter(b => b.check(profile));
}

// ──────────────────────────────────────────────
// Week plan (default for Yesa / Rooty)
// ──────────────────────────────────────────────
export const WEEK_PLAN: Record<string, string[]> = {
  Mon: ['pg-1', 'mp-1', 'cf-1', 'wl-1', 'pg-4', 'mp-4', 'cf-4', 'wl-4'],
  Tue: ['pg-2', 'mp-2', 'cf-2', 'wl-2', 'pg-5', 'mp-5', 'cf-5', 'wl-5'],
  Wed: ['pg-3', 'mp-3', 'cf-3', 'wl-3', 'pg-6', 'mp-6', 'cf-6', 'wl-6'],
  Thu: ['pg-1', 'mp-1', 'cf-1', 'wl-1', 'pg-4', 'mp-4', 'cf-4', 'wl-4'],
  Fri: ['pg-2', 'mp-2', 'cf-2', 'wl-2', 'pg-5', 'mp-5', 'cf-5', 'wl-5'],
  Sat: ['pg-3', 'mp-3', 'wl-1', 'wl-3', 'pg-6', 'wl-4', 'wl-5', 'wl-6'],
  Sun: ['pg-1', 'pg-4', 'pg-5', 'pg-6', 'wl-1', 'wl-2', 'wl-4', 'wl-6'],
};

export const DEFAULT_REMINDERS = [
  { id: '1', label: 'Morning Kickoff',    time: '08:00', days: ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'], enabled: true },
  { id: '2', label: 'Midday Check-in',    time: '13:00', days: ['Mon','Wed','Fri'],                        enabled: true },
  { id: '3', label: 'Evening Wind-down',  time: '20:00', days: ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'], enabled: false },
];
