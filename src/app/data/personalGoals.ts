// ──────────────────────────────────────────────
// Personal Goals Types & Data
// ──────────────────────────────────────────────

export type MilestoneLevel = 'light' | 'medium' | 'medium-high' | 'hard' | 'epic';

export interface Milestone {
  id: string;
  level: MilestoneLevel;
  title: string;
  targetValue?: number; // For numeric goals (amount saved, portfolio value)
  tasks: string[]; // Daily/Weekly task suggestions
  completed: boolean;
}

export interface PersonalGoal {
  id: string;
  profileId: string;
  title: string;
  deepWhy: string; // Inspirational reason
  targetValue: number; // Final target (e.g., 100000 for 6-digit, 20000 for ₱20k)
  currentValue: number; // Current progress
  unit: string; // '₱' or other unit
  milestones: Milestone[];
  createdAt: number;
  targetDate?: string; // Optional deadline
}

export interface GoalProgressLog {
  id: string;
  goalId: string;
  profileId: string;
  timestamp: number;
  taskCompleted: string;
  amountLogged?: number;
  notes?: string;
  milestoneHit?: string; // Milestone ID if one was completed
}

// ──────────────────────────────────────────────
// Default Personal Goals (Kyle, Rafael, Rooty)
// ──────────────────────────────────────────────

export const DEFAULT_PERSONAL_GOALS: PersonalGoal[] = [
  // Kyle's Birthday Savings Goal
  {
    id: 'kyle-birthday-savings',
    profileId: 'kyle',
    title: 'Save ₱10,000 Before Birthday',
    deepWhy: 'Prove to myself I can save. First step toward financial independence.',
    targetValue: 10000,
    currentValue: 0,
    unit: '₱',
    targetDate: undefined, // User didn't specify birthday date
    createdAt: Date.now(),
    milestones: [
      {
        id: 'kyle-bs-m1',
        level: 'light',
        title: 'Start saving habit',
        targetValue: 1000,
        tasks: ['Save ₱50 today', 'Save ₱100 this week', 'Track daily expenses'],
        completed: false,
      },
      {
        id: 'kyle-bs-m2',
        level: 'medium',
        title: 'First ₱2,500 saved',
        targetValue: 2500,
        tasks: ['Save ₱500 this week', 'Avoid impulse spending for 1 week', 'Cook at home to save'],
        completed: false,
      },
      {
        id: 'kyle-bs-m3',
        level: 'medium-high',
        title: 'Halfway milestone',
        targetValue: 5000,
        tasks: ['Save ₱1,000 this week', 'Transfer to dedicated savings account', 'Review spending habits'],
        completed: false,
      },
      {
        id: 'kyle-bs-m4',
        level: 'hard',
        title: 'Almost there - ₱7,500',
        targetValue: 7500,
        tasks: ['Save ₱500 weekly', 'Skip unnecessary purchases', 'Find extra income source'],
        completed: false,
      },
      {
        id: 'kyle-bs-m5',
        level: 'epic',
        title: 'Birthday goal achieved!',
        targetValue: 10000,
        tasks: ['Celebrate with something small', 'Set new savings goal', 'Keep the momentum going'],
        completed: false,
      },
    ],
  },
  // Kyle's Emergency Fund Goal
  {
    id: 'kyle-emergency-fund',
    profileId: 'kyle',
    title: 'Build ₱30,000 Emergency Fund by 2027',
    deepWhy: 'Financial security and peace of mind. Never worry about unexpected expenses again.',
    targetValue: 30000,
    currentValue: 0,
    unit: '₱',
    targetDate: '2027-12-31',
    createdAt: Date.now(),
    milestones: [
      {
        id: 'kyle-ef-m1',
        level: 'light',
        title: 'Emergency fund started',
        targetValue: 3000,
        tasks: ['Open emergency fund account', 'Save ₱500 weekly', 'Track all expenses daily'],
        completed: false,
      },
      {
        id: 'kyle-ef-m2',
        level: 'medium',
        title: '₱10,000 safety net',
        targetValue: 10000,
        tasks: ['Save ₱1,000 weekly', 'Avoid touching emergency savings', 'Review budget monthly'],
        completed: false,
      },
      {
        id: 'kyle-ef-m3',
        level: 'medium-high',
        title: 'Halfway to security',
        targetValue: 15000,
        tasks: ['Increase weekly savings', 'Find ways to reduce expenses', 'Keep fund untouched'],
        completed: false,
      },
      {
        id: 'kyle-ef-m4',
        level: 'hard',
        title: 'Almost fully protected',
        targetValue: 25000,
        tasks: ['Save ₱2,000 weekly', 'Avoid lifestyle inflation', 'Build consistent saving habit'],
        completed: false,
      },
      {
        id: 'kyle-ef-m5',
        level: 'epic',
        title: 'Fully protected with ₱30K',
        targetValue: 30000,
        tasks: ['Maintain emergency fund', 'Start investing surplus', 'Help others build their fund'],
        completed: false,
      },
    ],
  },
  // Kyle's Graduation Goal
  {
    id: 'kyle-graduation',
    profileId: 'kyle',
    title: 'Graduate College by July 2, 2026',
    deepWhy: 'Finish what I started. Degree opens doors and proves I can commit to big goals.',
    targetValue: 100, // Representing 100% completion
    currentValue: 75, // Assuming 75% done (close to graduation)
    unit: '%',
    targetDate: '2026-07-02',
    createdAt: Date.now(),
    milestones: [
      {
        id: 'kyle-grad-m1',
        level: 'light',
        title: 'Track graduation requirements',
        targetValue: 80,
        tasks: ['List all remaining requirements', 'Create graduation checklist', 'Meet with academic advisor'],
        completed: false,
      },
      {
        id: 'kyle-grad-m2',
        level: 'medium',
        title: 'Complete pending subjects',
        targetValue: 85,
        tasks: ['Finish all assignments on time', 'Attend all classes', 'Study for final exams'],
        completed: false,
      },
      {
        id: 'kyle-grad-m3',
        level: 'medium-high',
        title: 'Finish thesis/capstone',
        targetValue: 95,
        tasks: ['Work on thesis daily', 'Get advisor feedback', 'Complete all revisions'],
        completed: false,
      },
      {
        id: 'kyle-grad-m4',
        level: 'hard',
        title: 'Submit all requirements',
        targetValue: 99,
        tasks: ['Submit clearance documents', 'Pay graduation fees', 'Confirm graduation eligibility'],
        completed: false,
      },
      {
        id: 'kyle-grad-m5',
        level: 'epic',
        title: 'College graduate! 🎓',
        targetValue: 100,
        tasks: ['Attend graduation ceremony', 'Celebrate with family', 'Start career with degree in hand'],
        completed: false,
      },
    ],
  },
  // Kyle's Career Goal
  {
    id: 'kyle-job',
    profileId: 'kyle',
    title: 'Get Stable Job This Year',
    deepWhy: 'Financial independence and career growth. Use my degree and skills to build a better future.',
    targetValue: 1, // Binary: 0 = no job, 1 = got job
    currentValue: 0,
    unit: 'job',
    targetDate: '2026-12-31',
    createdAt: Date.now(),
    milestones: [
      {
        id: 'kyle-job-m1',
        level: 'light',
        title: 'Prepare job application materials',
        tasks: ['Update resume', 'Improve LinkedIn profile', 'Create portfolio if needed'],
        completed: false,
      },
      {
        id: 'kyle-job-m2',
        level: 'medium',
        title: 'Apply to 50+ jobs',
        tasks: ['Apply to 3-5 jobs daily', 'Track all applications', 'Research companies before applying'],
        completed: false,
      },
      {
        id: 'kyle-job-m3',
        level: 'medium-high',
        title: 'Get first interviews',
        tasks: ['Practice interview questions daily', 'Research company before interview', 'Dress professionally'],
        completed: false,
      },
      {
        id: 'kyle-job-m4',
        level: 'hard',
        title: 'Receive job offers',
        tasks: ['Follow up after interviews', 'Negotiate salary if possible', 'Compare multiple offers'],
        completed: false,
      },
      {
        id: 'kyle-job-m5',
        level: 'epic',
        title: 'Start stable job! 💼',
        targetValue: 1,
        tasks: ['Accept best offer', 'Prepare for first day', 'Excel in new role'],
        completed: false,
      },
    ],
  },
  // Kyle's Life Insurance Goal
  {
    id: 'kyle-insurance',
    profileId: 'kyle',
    title: 'Invest in Life Insurance',
    deepWhy: 'Protect my future and family. Smart financial planning means securing what matters most.',
    targetValue: 1, // Binary: 0 = no insurance, 1 = got insurance
    currentValue: 0,
    unit: 'policy',
    targetDate: undefined,
    createdAt: Date.now(),
    milestones: [
      {
        id: 'kyle-ins-m1',
        level: 'light',
        title: 'Learn about life insurance',
        tasks: ['Read articles on life insurance', 'Watch educational videos', 'Understand different policy types'],
        completed: false,
      },
      {
        id: 'kyle-ins-m2',
        level: 'medium',
        title: 'Research insurance providers',
        tasks: ['Compare at least 3 providers', 'Read customer reviews', 'Check company ratings'],
        completed: false,
      },
      {
        id: 'kyle-ins-m3',
        level: 'medium-high',
        title: 'Calculate insurance needs',
        tasks: ['Determine coverage amount needed', 'Set budget for premiums', 'Consider term vs whole life'],
        completed: false,
      },
      {
        id: 'kyle-ins-m4',
        level: 'hard',
        title: 'Get quotes and consult agent',
        tasks: ['Request quotes from providers', 'Meet with insurance agent', 'Ask all important questions'],
        completed: false,
      },
      {
        id: 'kyle-ins-m5',
        level: 'epic',
        title: 'Life insurance secured! 🛡️',
        targetValue: 1,
        tasks: ['Sign insurance policy', 'Set up automatic premium payments', 'Share policy info with family'],
        completed: false,
      },
    ],
  },
  // Jude's Travel Fund Goal
  {
    id: 'jude-travel-fund',
    profileId: 'jude',
    title: 'Save for Overseas Travel',
    deepWhy: 'See the world and create unforgettable memories. Travel with family and friends to experience new cultures.',
    targetValue: 50000, // Estimated travel fund for overseas trip
    currentValue: 0,
    unit: '₱',
    targetDate: '2027-12-31',
    createdAt: Date.now(),
    milestones: [
      {
        id: 'jude-travel-m1',
        level: 'light',
        title: 'Start travel fund & get passport',
        targetValue: 5000,
        tasks: ['Save first ₱1,000 for travel fund', 'Research passport requirements', 'Open dedicated travel savings account'],
        completed: false,
      },
      {
        id: 'jude-travel-m2',
        level: 'medium',
        title: 'Build 30-day savings streak',
        targetValue: 15000,
        tasks: ['Complete 30-day savings streak', 'Research travel destinations', 'Avoid unnecessary purchases this month'],
        completed: false,
      },
      {
        id: 'jude-travel-m3',
        level: 'medium-high',
        title: 'Passport ready & halfway saved',
        targetValue: 25000,
        tasks: ['Renew or create passport', 'Research visa requirements', 'Watch travel budgeting videos'],
        completed: false,
      },
      {
        id: 'jude-travel-m4',
        level: 'hard',
        title: 'Almost ready to book',
        targetValue: 40000,
        tasks: ['Research flight prices', 'Plan detailed trip itinerary', 'Save ₱2,000 weekly consistently'],
        completed: false,
      },
      {
        id: 'jude-travel-m5',
        level: 'epic',
        title: 'Travel fund complete! ✈️',
        targetValue: 50000,
        tasks: ['Book overseas trip', 'Share travel plans with family/friends', 'Start planning next adventure'],
        completed: false,
      },
    ],
  },
  // Rafael's Emergency Fund Goal
  {
    id: 'rafael-emergency-fund',
    profileId: 'rafael',
    title: 'Save ₱20,000 Emergency Fund',
    deepWhy: 'Peace of mind knowing I have a safety net. Never have to stress about unexpected expenses again.',
    targetValue: 20000,
    currentValue: 0,
    unit: '₱',
    targetDate: '2026-12-31',
    createdAt: Date.now(),
    milestones: [
      {
        id: 'rafael-m1',
        level: 'light',
        title: 'Build daily saving habit',
        targetValue: 1000,
        tasks: ['Save ₱50 today', 'Save ₱100 today', 'Track daily expenses'],
        completed: false,
      },
      {
        id: 'rafael-m2',
        level: 'medium',
        title: 'Save weekly',
        targetValue: 5000,
        tasks: ['Save ₱500 this week', 'Save ₱1,000 this week', 'Review weekly spending'],
        completed: false,
      },
      {
        id: 'rafael-m3',
        level: 'medium-high',
        title: 'Reach ₱5,000 saved',
        targetValue: 5000,
        tasks: ['Transfer ₱500 to savings account', 'Avoid unnecessary purchases this week'],
        completed: false,
      },
      {
        id: 'rafael-m4',
        level: 'hard',
        title: 'Reach ₱10,000 (halfway)',
        targetValue: 10000,
        tasks: ['Save ₱1,500 this week', 'Find one expense to cut permanently'],
        completed: false,
      },
      {
        id: 'rafael-m5',
        level: 'epic',
        title: 'Complete ₱20,000 Emergency Fund',
        targetValue: 20000,
        tasks: ['Make final push to target', 'Celebrate completion'],
        completed: false,
      },
    ],
  },
  // Yesa's Bouldering Podium Goal
  {
    id: 'yesa-bouldering-podium',
    profileId: 'yesa',
    title: 'Reach the Bouldering Podium',
    deepWhy: 'Prove to myself I can compete at a high level. Win recognition for consistent hard work on the wall.',
    targetValue: 100,
    currentValue: 20,
    unit: '%',
    targetDate: '2026-12-31',
    createdAt: Date.now(),
    milestones: [
      {
        id: 'yesa-climb-m1',
        level: 'light',
        title: 'Build consistent training habit',
        tasks: ['Show up to 3 sessions this week', 'Work on footwork drills', 'Log your sessions'],
        completed: true,
      },
      {
        id: 'yesa-climb-m2',
        level: 'medium',
        title: 'Project a V4 problem',
        tasks: ['Attempt your project 5x this week', 'Film your beta and analyze', 'Strengthen open-hand grip'],
        completed: false,
      },
      {
        id: 'yesa-climb-m3',
        level: 'medium-high',
        title: 'Send your first V5',
        tasks: ['Attempt V5+ problems weekly', 'Work on dynamic movement', 'Focus on body tension'],
        completed: false,
      },
      {
        id: 'yesa-climb-m4',
        level: 'hard',
        title: 'Register and compete',
        tasks: ['Sign up for a local bouldering competition', 'Simulate comp conditions in training', 'Visualize your performance'],
        completed: false,
      },
      {
        id: 'yesa-climb-m5',
        level: 'epic',
        title: 'Podium finish! 🏆',
        tasks: ['Trust the training', 'Compete with full commitment', 'Celebrate every send on comp day'],
        completed: false,
      },
    ],
  },
  // Yesa's Healthy Lifestyle Goal
  {
    id: 'yesa-healthy-lifestyle',
    profileId: 'yesa',
    title: 'Maintain a Healthy Lifestyle',
    deepWhy: 'A healthy body is the foundation for climbing harder and feeling great every day.',
    targetValue: 100,
    currentValue: 45,
    unit: '%',
    targetDate: undefined,
    createdAt: Date.now(),
    milestones: [
      {
        id: 'yesa-health-m1',
        level: 'light',
        title: 'Establish morning routine',
        tasks: ['Stretch every morning', 'Drink water first thing', 'Sleep by midnight consistently'],
        completed: true,
      },
      {
        id: 'yesa-health-m2',
        level: 'medium',
        title: 'Nail nutrition for climbing',
        tasks: ['Eat protein-rich meals on training days', 'Avoid junk food 5 days/week', 'Meal prep on Sundays'],
        completed: false,
      },
      {
        id: 'yesa-health-m3',
        level: 'medium-high',
        title: 'Active recovery mastery',
        tasks: ['Yoga or mobility work on rest days', 'Foam roll after sessions', 'Track sleep quality'],
        completed: false,
      },
      {
        id: 'yesa-health-m4',
        level: 'hard',
        title: 'Peak physical condition',
        tasks: ['Maintain 3+ sessions/week for 2 months', 'Zero missed recovery sessions', 'Monthly fitness check-in'],
        completed: false,
      },
      {
        id: 'yesa-health-m5',
        level: 'epic',
        title: 'Health is a non-negotiable lifestyle',
        tasks: ['Inspire others with your habits', 'Reach personal fitness milestone', 'Celebrate 6 months of consistency'],
        completed: false,
      },
    ],
  },
  // Yesa's Stable Job Goal
  {
    id: 'yesa-stable-job',
    profileId: 'yesa',
    title: 'Land a Stable Job This Year',
    deepWhy: 'Financial independence to fund climbing, travel, and a life I love - on my own terms.',
    targetValue: 1,
    currentValue: 0,
    unit: 'job',
    targetDate: '2026-12-31',
    createdAt: Date.now(),
    milestones: [
      {
        id: 'yesa-job-m1',
        level: 'light',
        title: 'Polish application materials',
        tasks: ['Update resume with recent projects', 'Write a strong personal statement', 'Get LinkedIn ready'],
        completed: false,
      },
      {
        id: 'yesa-job-m2',
        level: 'medium',
        title: 'Apply to 30+ positions',
        tasks: ['Apply to 3-5 jobs this week', 'Track all applications', 'Reach out to 2 people in your field'],
        completed: false,
      },
      {
        id: 'yesa-job-m3',
        level: 'medium-high',
        title: 'Nail the interviews',
        tasks: ['Practice common interview questions', 'Research each company before applying', 'Do a mock interview'],
        completed: false,
      },
      {
        id: 'yesa-job-m4',
        level: 'hard',
        title: 'Receive job offers',
        tasks: ['Follow up on all applications', 'Evaluate offers thoughtfully', 'Negotiate if possible'],
        completed: false,
      },
      {
        id: 'yesa-job-m5',
        level: 'epic',
        title: 'Stable job secured! 💼',
        tasks: ['Accept the best offer', 'Prep for first day', 'Keep climbing on the side'],
        completed: false,
      },
    ],
  },
  // Rafael's Academic Performance Goal
  {
    id: 'rafael-academic',
    profileId: 'rafael',
    title: 'Excel This Semester',
    deepWhy: 'Academic performance opens doors. Staying on top of school means more options and more freedom later.',
    targetValue: 100,
    currentValue: 60,
    unit: '%',
    targetDate: '2026-08-31',
    createdAt: Date.now(),
    milestones: [
      {
        id: 'rafael-acad-m1',
        level: 'light',
        title: 'Stay on top of all deadlines',
        tasks: ['Review schedule every Monday', 'Submit all tasks on time this week', 'No missed classes'],
        completed: true,
      },
      {
        id: 'rafael-acad-m2',
        level: 'medium',
        title: 'Complete all group projects',
        tasks: ['Check in with group members weekly', 'Finish your parts 2 days early', 'Review before submission'],
        completed: false,
      },
      {
        id: 'rafael-acad-m3',
        level: 'medium-high',
        title: 'Ace midterms',
        tasks: ['Start reviewing 2 weeks before exams', 'Make summary notes for each subject', 'Do practice questions'],
        completed: false,
      },
      {
        id: 'rafael-acad-m4',
        level: 'hard',
        title: 'Strong final exam push',
        tasks: ['Intensive review in last 2 weeks', 'Sleep 7+ hours before exams', 'Stay calm and focused'],
        completed: false,
      },
      {
        id: 'rafael-acad-m5',
        level: 'epic',
        title: 'Semester completed with flying colors!',
        tasks: ['Celebrate your hard work', 'Review what worked', 'Set goals for next semester'],
        completed: false,
      },
    ],
  },
  // Rafael's Healthy Living Goal
  {
    id: 'rafael-healthy-living',
    profileId: 'rafael',
    title: 'Stay Fit & Healthy',
    deepWhy: 'A healthy body and mind makes school, work, and everything else more manageable and enjoyable.',
    targetValue: 100,
    currentValue: 35,
    unit: '%',
    targetDate: undefined,
    createdAt: Date.now(),
    milestones: [
      {
        id: 'rafael-health-m1',
        level: 'light',
        title: 'Exercise 3x per week consistently',
        tasks: ['Show up to exercise 3 times this week', 'Track your workouts', 'Drink 8 glasses of water daily'],
        completed: false,
      },
      {
        id: 'rafael-health-m2',
        level: 'medium',
        title: 'Build a sustainable routine',
        tasks: ['Maintain exercise habit for 30 days', 'Eat balanced meals daily', 'Sleep 7+ hours consistently'],
        completed: false,
      },
      {
        id: 'rafael-health-m3',
        level: 'medium-high',
        title: 'Visible fitness improvement',
        tasks: ['Complete a personal fitness challenge', 'Track strength/endurance gains', 'Reduce stress with movement'],
        completed: false,
      },
      {
        id: 'rafael-health-m4',
        level: 'hard',
        title: 'Peak energy and focus',
        tasks: ['3 months of consistent exercise', 'Notice improved study energy', 'Share your routine with others'],
        completed: false,
      },
      {
        id: 'rafael-health-m5',
        level: 'epic',
        title: 'Fitness is a permanent lifestyle',
        tasks: ['Never miss two consecutive exercise days', 'Mentor someone with their fitness', 'Celebrate 6 months'],
        completed: false,
      },
    ],
  },
  // Rooty's Emergency Fund Goal
  {
    id: 'rooty-emergency-fund',
    profileId: 'rooty',
    title: 'Save ₱20,000 Emergency Fund',
    deepWhy: 'Peace of mind knowing I have a safety net. Never have to stress about unexpected expenses again.',
    targetValue: 20000,
    currentValue: 8000, // Rooty has progress here too
    unit: '₱',
    targetDate: '2026-12-31',
    createdAt: Date.now(),
    milestones: [
      {
        id: 'rooty-ef-m1',
        level: 'light',
        title: 'Build daily saving habit',
        targetValue: 1000,
        tasks: ['Save ₱50 today', 'Save ₱100 today', 'Track daily expenses'],
        completed: true,
      },
      {
        id: 'rooty-ef-m2',
        level: 'medium',
        title: 'Save weekly',
        targetValue: 5000,
        tasks: ['Save ₱500 this week', 'Save ₱1,000 this week', 'Review weekly spending'],
        completed: true,
      },
      {
        id: 'rooty-ef-m3',
        level: 'medium-high',
        title: 'Reach ₱5,000 saved',
        targetValue: 5000,
        tasks: ['Transfer ₱500 to savings account', 'Avoid unnecessary purchases this week'],
        completed: true,
      },
      {
        id: 'rooty-ef-m4',
        level: 'hard',
        title: 'Reach ₱10,000 (halfway)',
        targetValue: 10000,
        tasks: ['Save ₱1,500 this week', 'Find one expense to cut permanently'],
        completed: false,
      },
      {
        id: 'rooty-ef-m5',
        level: 'epic',
        title: 'Complete ₱20,000 Emergency Fund',
        targetValue: 20000,
        tasks: ['Make final push to target', 'Celebrate completion'],
        completed: false,
      },
    ],
  },
  // ── Favio ──────────────────────────────────────
  {
    id: 'favio-lose-weight',
    profileId: 'favio',
    title: 'Lose 20 lbs This Summer',
    deepWhy: 'Healthy, strong & sharp for family and startup - showing up as the best version of myself.',
    targetValue: 100,
    currentValue: 0,
    unit: '%',
    targetDate: '2026-09-01',
    createdAt: Date.now(),
    milestones: [
      {
        id: 'favio-lw-m1', level: 'light',
        title: 'First 4–6 lbs Down (Month 1)',
        targetValue: 25,
        tasks: ['Hit protein target at every meal daily', 'Walk 20–30 min daily', 'Track weight every Monday morning'],
        completed: false,
      },
      {
        id: 'favio-lw-m2', level: 'medium',
        title: '8–10 lbs Total (Month 2)',
        targetValue: 50,
        tasks: ['Maintain calorie deficit 500–700 kcal/day', 'Reduce late-night eating', 'Meal prep on Sundays'],
        completed: false,
      },
      {
        id: 'favio-lw-m3', level: 'medium-high',
        title: '12–15 lbs Down (Month 3)',
        targetValue: 65,
        tasks: ['2–3 runs per week', 'Tighten nutrition on weekdays', 'Weekly body measurements'],
        completed: false,
      },
      {
        id: 'favio-lw-m4', level: 'hard',
        title: '18 lbs Down - Final Push',
        targetValue: 90,
        tasks: ['Add conditioning circuit', 'Review calorie intake if stalled', 'Stay consistent with protein'],
        completed: false,
      },
      {
        id: 'favio-lw-m5', level: 'epic',
        title: '20 lbs Lost - Summer Goal Achieved! 🎉',
        targetValue: 100,
        tasks: ['Maintain with sustainable habits', 'Transition to maintenance calories', 'Celebrate with the family'],
        completed: false,
      },
    ],
  },
  {
    id: 'favio-founder-performance',
    profileId: 'favio',
    title: 'Founder Performance & Mental Edge',
    deepWhy: 'Sleep and recovery are my competitive advantage - a rested founder makes better decisions for family and startup.',
    targetValue: 100,
    currentValue: 0,
    unit: '%',
    createdAt: Date.now(),
    milestones: [
      {
        id: 'favio-fp-m1', level: 'light',
        title: 'Sleep Routine Locked In',
        targetValue: 20,
        tasks: ['No work 1 hr before bed for 7 consecutive nights', 'Wind-down routine logged 5+ nights/week'],
        completed: false,
      },
      {
        id: 'favio-fp-m2', level: 'medium',
        title: '7+ hrs Sleep - 5 Nights/Week Streak',
        targetValue: 40,
        tasks: ['Track sleep score weekly', 'Reading instead of screens before bed'],
        completed: false,
      },
      {
        id: 'favio-fp-m3', level: 'medium-high',
        title: 'Consistent Energy & Focus Score',
        targetValue: 60,
        tasks: ['Rate daily energy 1–10', 'Protect 30-min deep work block each morning'],
        completed: false,
      },
      {
        id: 'favio-fp-m4', level: 'hard',
        title: 'Personal Project Momentum',
        targetValue: 80,
        tasks: ['30-min personal/startup block 3x/week', 'Drums or creative outlet 1–2x/week'],
        completed: false,
      },
      {
        id: 'favio-fp-m5', level: 'epic',
        title: 'Peak Founder State - Sustained for 1 Month',
        targetValue: 100,
        tasks: ['All habits consistent for 30 days', 'Share progress with accountability partner'],
        completed: false,
      },
    ],
  },
  {
    id: 'favio-longevity',
    profileId: 'favio',
    title: 'Longevity & Durability',
    deepWhy: 'Building a body that lasts - strong enough to play with my kids and compete for decades.',
    targetValue: 100,
    currentValue: 0,
    unit: '%',
    createdAt: Date.now(),
    milestones: [
      {
        id: 'favio-lon-m1', level: 'light',
        title: 'Foundation: Consistency Over Intensity',
        targetValue: 20,
        tasks: ['2 strength sessions/week for 4 weeks', 'Always warm up before lifting or running'],
        completed: false,
      },
      {
        id: 'favio-lon-m2', level: 'medium',
        title: '150+ Min Cardio/Week Habit',
        targetValue: 40,
        tasks: ['2 runs + 1 long walk weekly', '8,000–10,000 steps daily'],
        completed: false,
      },
      {
        id: 'favio-lon-m3', level: 'medium-high',
        title: 'Strength Numbers Increasing',
        targetValue: 60,
        tasks: ['Add 5–10% weight to exercises each phase', 'Progress to 3–4 sets per exercise'],
        completed: false,
      },
      {
        id: 'favio-lon-m4', level: 'hard',
        title: 'Tennis + Active Social Life',
        targetValue: 80,
        tasks: ['Tennis 1x/week consistently', 'Mix easy + slightly longer runs'],
        completed: false,
      },
      {
        id: 'favio-lon-m5', level: 'epic',
        title: 'Sustainable Performance System',
        targetValue: 100,
        tasks: ['Strength 2–3x/week maintained', 'Focus on enjoyment and flexibility', 'Ready for next level'],
        completed: false,
      },
    ],
  },
  // ── Roi ──────────────────────────────────────
  {
    id: 'roi-healthy-mind-body',
    profileId: 'roi',
    title: 'Healthy Mind & Body',
    deepWhy: 'Health is non-negotiable. With 3 jobs and a packed schedule, fitness and mobility keep me grounded, energized, and sane.',
    targetValue: 100,
    currentValue: 15,
    unit: '%',
    targetDate: undefined,
    createdAt: Date.now(),
    milestones: [
      {
        id: 'roi-hm-m1',
        level: 'light',
        title: 'Build daily mobility habit',
        targetValue: 20,
        tasks: ['Do neck & shoulder mobility daily', 'Drink 2L water today', 'Walk at least 30 min'],
        completed: true,
      },
      {
        id: 'roi-hm-m2',
        level: 'medium',
        title: 'Complete full week of workouts',
        targetValue: 40,
        tasks: ['Complete all 5 workout sessions this week', 'Add hip mobility 3x this week', 'Log all workouts'],
        completed: false,
      },
      {
        id: 'roi-hm-m3',
        level: 'medium-high',
        title: 'Consistency for 30 days',
        targetValue: 60,
        tasks: ['30 consecutive days of daily hydration', 'Maintain leg day twice a week', 'Track bodyweight workout progress'],
        completed: false,
      },
      {
        id: 'roi-hm-m4',
        level: 'hard',
        title: 'Peak fitness across all pillars',
        targetValue: 80,
        tasks: ['Complete cycling + bouldering every weekend', 'Walk 5+ days this week', 'Full mobility routine daily'],
        completed: false,
      },
      {
        id: 'roi-hm-m5',
        level: 'epic',
        title: 'Healthy lifestyle fully locked in 💪',
        targetValue: 100,
        tasks: ['Celebrate 3 months of consistent fitness', 'Share your routine', 'Set the next fitness goal'],
        completed: false,
      },
    ],
  },
  // ── Eunice ──────────────────────────────────────
  {
    id: 'eunice-artwork',
    profileId: 'eunice',
    title: 'Renew Living Room Artwork',
    deepWhy: 'I want my home to reflect who I am and what I love - painting 3 pieces for the living room is how I reclaim my creative space.',
    targetValue: 3,
    currentValue: 0,
    unit: 'paintings',
    targetDate: undefined,
    createdAt: Date.now(),
    milestones: [
      {
        id: 'eu-art-m1',
        level: 'light',
        title: 'Gather inspiration & sketch ideas',
        targetValue: 0,
        tasks: ['Browse inspiration (mood board, Pinterest)', 'Sketch 3 composition ideas', 'Choose color palette for all 3 pieces'],
        completed: false,
      },
      {
        id: 'eu-art-m2',
        level: 'medium',
        title: 'Start and finish Painting 1',
        targetValue: 1,
        tasks: ['Prep canvas for painting 1', 'Painting session - at least 30 min', 'Complete and let dry - Painting 1'],
        completed: false,
      },
      {
        id: 'eu-art-m3',
        level: 'medium-high',
        title: 'Start and finish Painting 2',
        targetValue: 2,
        tasks: ['Begin Painting 2 - first layer', 'Refine and complete Painting 2', 'Review both paintings together'],
        completed: false,
      },
      {
        id: 'eu-art-m4',
        level: 'hard',
        title: 'Complete all 3 paintings',
        targetValue: 3,
        tasks: ['Start and complete Painting 3', 'Touch up Paintings 1 & 2 if needed', 'All 3 paintings ready to hang'],
        completed: false,
      },
      {
        id: 'eu-art-m5',
        level: 'epic',
        title: 'Living room transformed! 🖼️',
        targetValue: 3,
        tasks: ['Frame and hang all 3 paintings', 'Take photos of the finished room', 'Celebrate your creative achievement'],
        completed: false,
      },
    ],
  },
  {
    id: 'eunice-strava',
    profileId: 'eunice',
    title: 'Strava 5KM Walk - Mon, Wed, Fri',
    deepWhy: 'Moving my body regularly clears my mind, gives me fresh ideas, and keeps me feeling alive. 5KM three times a week is my promise to myself.',
    targetValue: 12,
    currentValue: 0,
    unit: 'walks',
    targetDate: undefined,
    createdAt: Date.now(),
    milestones: [
      {
        id: 'eu-strava-m1',
        level: 'light',
        title: 'First week of 3 walks',
        targetValue: 3,
        tasks: ['Walk 5KM on Monday', 'Walk 5KM on Wednesday', 'Walk 5KM on Friday', 'Log all walks on Strava'],
        completed: false,
      },
      {
        id: 'eu-strava-m2',
        level: 'medium',
        title: 'One month of consistency',
        targetValue: 12,
        tasks: ['Complete Mon/Wed/Fri walks for 4 weeks', 'Log every walk on Strava', 'Celebrate 12 walks done!'],
        completed: false,
      },
      {
        id: 'eu-strava-m3',
        level: 'medium-high',
        title: 'Two months strong',
        targetValue: 24,
        tasks: ['Keep the M/W/F rhythm going', 'Try a new route for variety', 'Bring the dog on at least 1 walk'],
        completed: false,
      },
      {
        id: 'eu-strava-m4',
        level: 'hard',
        title: 'Three months - habit locked',
        targetValue: 36,
        tasks: ['36 total 5KM walks completed', 'Track personal pace improvement', 'Share milestone on Strava'],
        completed: false,
      },
      {
        id: 'eu-strava-m5',
        level: 'epic',
        title: 'Walking is a lifestyle now 🚶‍♀️',
        targetValue: 48,
        tasks: ['4 months of M/W/F walks', 'Reflect on how it changed you', 'Set a new walking or running goal'],
        completed: false,
      },
    ],
  },
  {
    id: 'eunice-restaurant',
    profileId: 'eunice',
    title: 'Weekend Restaurant Discovery',
    deepWhy: 'Life is too short for the same restaurants. Discovering 1–2 new places every month is my way of exploring the world one meal at a time.',
    targetValue: 12,
    currentValue: 0,
    unit: 'restaurants',
    targetDate: undefined,
    createdAt: Date.now(),
    milestones: [
      {
        id: 'eu-resto-m1',
        level: 'light',
        title: 'First 2 restaurants discovered',
        targetValue: 2,
        tasks: ['Research new restaurant options', 'Visit 1 new restaurant this weekend', 'Write a memory note or mini review'],
        completed: false,
      },
      {
        id: 'eu-resto-m2',
        level: 'medium',
        title: '6 new restaurants explored',
        targetValue: 6,
        tasks: ['Maintain 1–2 per month rhythm', 'Try a different cuisine each time', 'Keep a restaurant discovery list'],
        completed: false,
      },
      {
        id: 'eu-resto-m3',
        level: 'medium-high',
        title: '10 new places in the books',
        targetValue: 10,
        tasks: ['10 restaurants documented', 'Pick a favorite from the list', 'Bring a friend to your top pick'],
        completed: false,
      },
      {
        id: 'eu-resto-m4',
        level: 'hard',
        title: 'A year of dining discoveries',
        targetValue: 12,
        tasks: ['12 restaurants visited across the year', 'Create a top-5 list', 'Share recommendations with people you love'],
        completed: false,
      },
      {
        id: 'eu-resto-m5',
        level: 'epic',
        title: 'Local food explorer 🍽️',
        targetValue: 24,
        tasks: ['24+ restaurants discovered', 'Write a proper dining guide for friends', 'Celebrate with a special dinner out'],
        completed: false,
      },
    ],
  },
  {
    id: 'favio-neck-balance',
    profileId: 'favio',
    title: 'Neck Pain Reduction & Life Balance',
    deepWhy: 'Pain-free and present - eliminating neck pain so I can focus fully on family, work, and life.',
    targetValue: 100,
    currentValue: 0,
    unit: '%',
    createdAt: Date.now(),
    milestones: [
      {
        id: 'favio-nb-m1', level: 'light',
        title: 'Daily 5-Min Neck Reset Habit',
        targetValue: 20,
        tasks: ['Neck reset 5+ days/week for 4 weeks', 'Chin tucks + shoulder blade squeezes + doorway stretch'],
        completed: false,
      },
      {
        id: 'favio-nb-m2', level: 'medium',
        title: 'Neck Pain Noticeably Better (Month 1)',
        targetValue: 40,
        tasks: ['Track neck pain score (1–10) weekly', 'Always warm up neck before lifting'],
        completed: false,
      },
      {
        id: 'favio-nb-m3', level: 'medium-high',
        title: 'Quality Wife & Friend Time Protected',
        targetValue: 60,
        tasks: ['Daily touchpoint with wife', '2 deeper connection sessions/week', '1–2 friend/social blocks/week'],
        completed: false,
      },
      {
        id: 'favio-nb-m4', level: 'hard',
        title: 'Stress Resilience Routines in Place',
        targetValue: 80,
        tasks: ['Comedy / drums / friend chat weekly', 'Home tasks 2–4x/week for life order'],
        completed: false,
      },
      {
        id: 'favio-nb-m5', level: 'epic',
        title: 'Pain-Free & Fully Balanced',
        targetValue: 100,
        tasks: ['Neck pain at 1–2/10 consistently', 'Consider PT graduation if needed', 'Life balance maintained at all phases'],
        completed: false,
      },
    ],
  },
];

// ──────────────────────────────────────────────
// LocalStorage Helpers
// ──────────────────────────────────────────────

function goalKey(profileId: string, goalId: string) {
  return `arbol-personal-goal-${profileId}-${goalId}`;
}

function allGoalsKey(profileId: string) {
  return `arbol-personal-goals-${profileId}`;
}

function progressLogKey(logId: string) {
  return `arbol-goal-progress-${logId}`;
}

// Bump this version string when DEFAULT_PERSONAL_GOALS changes significantly,
// so returning users get the updated goal set on their next load.
const GOALS_DATA_VERSION = 'v5-2026-06-09';

function goalsVersionKey(profileId: string) {
  return `arbol-goals-version-${profileId}`;
}

export function getPersonalGoals(profileId: string): PersonalGoal[] {
  const storedVersion = localStorage.getItem(goalsVersionKey(profileId));
  const stored = localStorage.getItem(allGoalsKey(profileId));

  // If data version is stale, reseed from defaults (preserves progress for goals
  // that still exist by merging currentValue from old data).
  if (stored && storedVersion !== GOALS_DATA_VERSION) {
    const oldGoals: PersonalGoal[] = JSON.parse(stored);
    const defaults = DEFAULT_PERSONAL_GOALS.filter(g => g.profileId === profileId);
    if (defaults.length > 0) {
      const merged = defaults.map(def => {
        const old = oldGoals.find(o => o.id === def.id);
        return old ? { ...def, currentValue: old.currentValue, milestones: def.milestones.map((m, i) => ({ ...m, completed: old.milestones[i]?.completed ?? m.completed })) } : def;
      });
      savePersonalGoals(profileId, merged);
      localStorage.setItem(goalsVersionKey(profileId), GOALS_DATA_VERSION);
      return merged;
    }
  }

  if (stored && storedVersion === GOALS_DATA_VERSION) {
    return JSON.parse(stored);
  }

  const defaults = DEFAULT_PERSONAL_GOALS.filter(g => g.profileId === profileId);
  if (defaults.length > 0) {
    savePersonalGoals(profileId, defaults);
    localStorage.setItem(goalsVersionKey(profileId), GOALS_DATA_VERSION);
    return defaults;
  }

  return [];
}

export function savePersonalGoals(profileId: string, goals: PersonalGoal[]) {
  localStorage.setItem(allGoalsKey(profileId), JSON.stringify(goals));
  import('./cloudBackup').then(({ scheduleSave }) => scheduleSave(profileId));
}

// ── User-managed goal CRUD ──────────────────────

export function createUserGoal(profileId: string, data: { title: string; deepWhy: string; unit?: string; targetValue?: number }): PersonalGoal {
  const goals = getPersonalGoals(profileId);
  const newGoal: PersonalGoal = {
    id: `user-${profileId}-${Date.now()}`,
    profileId,
    title: data.title.trim(),
    deepWhy: data.deepWhy.trim(),
    targetValue: data.targetValue ?? 100,
    currentValue: 0,
    unit: data.unit ?? '',
    milestones: [],
    createdAt: Date.now(),
  };
  savePersonalGoals(profileId, [...goals, newGoal]);
  localStorage.setItem(goalsVersionKey(profileId), GOALS_DATA_VERSION);
  try { window.dispatchEvent(new CustomEvent('arbol-goals-updated')); } catch {}
  return newGoal;
}

export function updateUserGoal(profileId: string, goalId: string, data: { title: string; deepWhy: string; unit?: string; targetValue?: number }) {
  const goals = getPersonalGoals(profileId);
  const updated = goals.map(g =>
    g.id === goalId
      ? { ...g, title: data.title.trim(), deepWhy: data.deepWhy.trim(), unit: data.unit ?? g.unit, targetValue: data.targetValue ?? g.targetValue }
      : g
  );
  savePersonalGoals(profileId, updated);
  localStorage.setItem(goalsVersionKey(profileId), GOALS_DATA_VERSION);
  try { window.dispatchEvent(new CustomEvent('arbol-goals-updated')); } catch {}
}

export function deleteUserGoal(profileId: string, goalId: string) {
  const goals = getPersonalGoals(profileId);
  savePersonalGoals(profileId, goals.filter(g => g.id !== goalId));
  localStorage.setItem(goalsVersionKey(profileId), GOALS_DATA_VERSION);
  try { window.dispatchEvent(new CustomEvent('arbol-goals-updated')); } catch {}
}

export function updateGoalProgress(profileId: string, goalId: string, newValue: number) {
  const goals = getPersonalGoals(profileId);
  const goal = goals.find(g => g.id === goalId);
  if (!goal) return;

  goal.currentValue = newValue;

  // Auto-complete milestones based on current value
  goal.milestones.forEach(m => {
    if (m.targetValue && newValue >= m.targetValue) {
      m.completed = true;
    }
  });

  savePersonalGoals(profileId, goals);
}

export function resetGoalProgress(profileId: string, goalId: string) {
  const goals = getPersonalGoals(profileId);
  const goal = goals.find(g => g.id === goalId);
  if (!goal) return;

  goal.currentValue = 0;
  goal.milestones.forEach(m => {
    m.completed = false;
  });

  savePersonalGoals(profileId, goals);

  // Clear all progress logs for this goal
  for (let i = localStorage.length - 1; i >= 0; i--) {
    const key = localStorage.key(i);
    if (key?.startsWith('arbol-goal-progress-') || key?.startsWith(`goal-task-${profileId}-${goalId}-`)) {
      try {
        const item = localStorage.getItem(key);
        if (item && key.includes(goalId)) {
          localStorage.removeItem(key);
        }
      } catch {}
    }
  }
}

export function logGoalProgress(log: Omit<GoalProgressLog, 'id'>): GoalProgressLog {
  const id = `log-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  const fullLog: GoalProgressLog = { ...log, id };

  localStorage.setItem(progressLogKey(id), JSON.stringify(fullLog));

  // Update goal current value if amount was logged
  if (log.amountLogged) {
    const goals = getPersonalGoals(log.profileId);
    const goal = goals.find(g => g.id === log.goalId);
    if (goal) {
      goal.currentValue += log.amountLogged;

      // Check for milestone completion
      goal.milestones.forEach(m => {
        if (m.targetValue && goal.currentValue >= m.targetValue && !m.completed) {
          m.completed = true;
          fullLog.milestoneHit = m.id;
        }
      });

      savePersonalGoals(log.profileId, goals);
    }
  }

  // Notify listeners (Dashboard, etc.) that goals changed
  try { window.dispatchEvent(new CustomEvent('arbol-goals-updated')); } catch {}

  // Sync to Supabase (async, non-blocking)
  import('./supabaseSync').then(({ syncGoalProgress }) => {
    syncGoalProgress({
      goalId: fullLog.goalId,
      profileId: fullLog.profileId,
      timestamp: fullLog.timestamp,
      taskCompleted: fullLog.taskCompleted,
      amountLogged: fullLog.amountLogged,
      notes: fullLog.notes,
      milestoneHit: fullLog.milestoneHit,
    });
  });

  return fullLog;
}

export function getAllProgressLogs(): GoalProgressLog[] {
  const logs: GoalProgressLog[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key?.startsWith('arbol-goal-progress-')) {
      try {
        logs.push(JSON.parse(localStorage.getItem(key)!));
      } catch {}
    }
  }
  return logs.sort((a, b) => b.timestamp - a.timestamp);
}

export function getProgressLogsForProfile(profileId: string): GoalProgressLog[] {
  return getAllProgressLogs().filter(log => log.profileId === profileId);
}

export function getProgressLogsForGoal(goalId: string): GoalProgressLog[] {
  return getAllProgressLogs().filter(log => log.goalId === goalId);
}

// ──────────────────────────────────────────────
// Suggested Daily/Weekly Tasks
// ──────────────────────────────────────────────

export function getCurrentMilestone(goal: PersonalGoal): Milestone | null {
  return goal.milestones.find(m => !m.completed) || null;
}

export function getNextMilestone(goal: PersonalGoal): Milestone | null {
  const current = getCurrentMilestone(goal);
  if (!current) return null;
  const idx = goal.milestones.indexOf(current);
  return goal.milestones[idx + 1] || null;
}

export function getSuggestedTasksForToday(profileId: string): Array<{goal: PersonalGoal; task: string; milestone: Milestone}> {
  const goals = getPersonalGoals(profileId);
  const suggestions: Array<{goal: PersonalGoal; task: string; milestone: Milestone}> = [];

  goals.forEach(goal => {
    const currentMilestone = getCurrentMilestone(goal);
    if (currentMilestone && currentMilestone.tasks.length > 0) {
      // Suggest 1-2 tasks from current milestone
      const tasksToSuggest = currentMilestone.tasks.slice(0, 2);
      tasksToSuggest.forEach(task => {
        suggestions.push({ goal, task, milestone: currentMilestone });
      });
    }
  });

  return suggestions;
}

// ──────────────────────────────────────────────
// Checklist Logic (PRD: equal-weight for non-monetary goals)
// ──────────────────────────────────────────────

export function isMonetaryGoal(goal: PersonalGoal): boolean {
  return ['₱', '$', '€', '£'].includes(goal.unit);
}

function gtaskKey(profileId: string, goalId: string, milestoneId: string, taskIdx: number): string {
  return `arbol-gtask-${profileId}-${goalId}-${milestoneId}-${taskIdx}`;
}

export function isGoalTaskChecked(profileId: string, goalId: string, milestoneId: string, taskIdx: number): boolean {
  return localStorage.getItem(gtaskKey(profileId, goalId, milestoneId, taskIdx)) === 'true';
}

export function toggleGoalTask(profileId: string, goal: PersonalGoal, milestoneId: string, taskIdx: number): void {
  const key = gtaskKey(profileId, goal.id, milestoneId, taskIdx);
  const wasChecked = localStorage.getItem(key) === 'true';
  if (wasChecked) {
    localStorage.removeItem(key);
  } else {
    localStorage.setItem(key, 'true');
  }

  // Auto-complete milestones when all their tasks are checked
  const goals = getPersonalGoals(profileId);
  const g = goals.find(g => g.id === goal.id);
  if (g) {
    g.milestones.forEach(m => {
      const allChecked = m.tasks.length > 0 && m.tasks.every((_, idx) =>
        localStorage.getItem(gtaskKey(profileId, goal.id, m.id, idx)) === 'true'
      );
      m.completed = allChecked;
    });
    savePersonalGoals(profileId, goals);
  }

  try { window.dispatchEvent(new CustomEvent('arbol-goals-updated')); } catch {}
}

export function getChecklistProgress(profileId: string, goal: PersonalGoal): { checked: number; total: number; pct: number } {
  let checked = 0, total = 0;
  goal.milestones.forEach(m => {
    m.tasks.forEach((_, idx) => {
      total++;
      if (isGoalTaskChecked(profileId, goal.id, m.id, idx)) checked++;
    });
  });
  const pct = total > 0 ? Math.round((checked / total) * 100) : 0;
  return { checked, total, pct };
}

// ──────────────────────────────────────────────
// Milestone Level Colors & Icons
// ──────────────────────────────────────────────

export const MILESTONE_CONFIG: Record<MilestoneLevel, { color: string; icon: string; label: string }> = {
  light: { color: '#90b4ce', icon: '🌱', label: 'Light' },
  medium: { color: '#3da9fc', icon: '⚡', label: 'Medium' },
  'medium-high': { color: '#094067', icon: '🎯', label: 'Medium-High' },
  hard: { color: '#ef4565', icon: '💪', label: 'Hard' },
  epic: { color: '#f5d020', icon: '🏆', label: 'Epic' },
};
