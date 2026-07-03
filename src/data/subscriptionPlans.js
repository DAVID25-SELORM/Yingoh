export const QUESTION_ACCESS = {
  free: 150,
  basic: 2000,
  pro: Infinity,
  premium: Infinity,
  admin: Infinity,
};

export const SUBSCRIPTION_PLANS = [
  {
    id: 'free',
    name: 'Explorer Pass',
    price_usd: 0,
    duration_days: 36500,
    question_limit: 150,
    features: ['150 NCLEX-RN questions', '20 flashcards', '1 CAT exam', '5 NGN case studies', '7-day study planner', 'Basic performance dashboard', 'Study Coach: 10 questions/day', 'Daily Question of the Day', 'Progress tracking', 'Limited notes library'],
    is_active: true,
    sort_order: 1,
  },
  {
    id: 'thirty_day',
    name: '30-Day Pass',
    price_usd: 19,
    duration_days: 30,
    question_limit: 2000,
    features: ['2,000+ questions', '50+ NGN case studies', 'Unlimited practice and timed modes', '5 CAT exams', '2 readiness assessments', 'All video lessons', 'High-yield notes and flashcards', 'Study Coach and rationale support', 'Weak-area analysis', 'Study planner and daily goals'],
    is_active: true,
    sort_order: 2,
  },
  {
    id: 'ninety_day',
    name: '90-Day Success Plan',
    price_usd: 49,
    duration_days: 90,
    question_limit: null,
    features: ['Everything in the 30-Day Pass', 'Complete 7,000+ question bank', '200+ NGN case studies', 'Unlimited CAT and readiness exams', 'Custom exams and review mode', 'Personalized Study Coach', 'Adaptive study plan and revision schedule', 'All courses, notes and drug guide', 'Detailed analytics and pass probability', 'Achievement badges'],
    is_active: true,
    sort_order: 3,
  },
  {
    id: 'master_180',
    name: '180-Day Master Plan',
    price_usd: 79,
    duration_days: 180,
    question_limit: null,
    features: ['Everything in the 90-Day Success Plan', 'Weekly live classes and Q&A', 'Monthly masterclasses', 'NCLEX strategy sessions', 'Mentor support', 'WhatsApp study community', 'Accountability program', 'Personalized study review', 'Mock oral questions and clinical tutoring', 'U.S. nursing career resources'],
    is_active: true,
    sort_order: 4,
  },
  {
    id: 'faculty_365',
    name: '365-Day Faculty Pass',
    price_usd: 129,
    duration_days: 365,
    question_limit: null,
    features: ['Everything in the 180-Day Master Plan', 'Full-year unlimited access', 'All future question updates', 'New NGN questions and video courses', 'Future Study Coach features', 'New study notes', 'Priority customer support', 'Early access to new features', 'Faculty Member badge', 'Exclusive webinars and annual NCLEX updates'],
    is_active: true,
    sort_order: 5,
  },
];

export function questionLimitFor(plan, hasAdminAccess = false) {
  if (hasAdminAccess) return QUESTION_ACCESS.admin;
  return QUESTION_ACCESS[plan] ?? QUESTION_ACCESS.free;
}
