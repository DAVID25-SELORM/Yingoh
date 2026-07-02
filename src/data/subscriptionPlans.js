export const QUESTION_ACCESS = {
  free: 25,
  basic: 500,
  pro: Infinity,
  premium: Infinity,
  admin: Infinity,
};

export const SUBSCRIPTION_PLANS = [
  {
    id: 'free',
    name: 'Free',
    price_usd: 0,
    duration_days: 36500,
    question_limit: QUESTION_ACCESS.free,
    features: ['25 NCLEX questions', 'Basic readiness dashboard', 'Limited flashcards'],
    is_active: true,
    sort_order: 1,
  },
  {
    id: 'basic',
    name: 'Starter',
    price_usd: 9.99,
    duration_days: 30,
    question_limit: QUESTION_ACCESS.basic,
    features: ['500 NCLEX questions', 'Practice and timed modes', 'High-yield notes and videos', 'Flashcards', 'Study planner'],
    is_active: true,
    sort_order: 2,
  },
  {
    id: 'pro',
    name: 'Pro',
    price_usd: 19.99,
    duration_days: 30,
    question_limit: null,
    features: ['Complete growing question bank', 'NGN clinical judgment simulator', 'CAT exams', 'AI rationale coach', 'Adaptive study plan', 'Readiness analytics'],
    is_active: true,
    sort_order: 3,
  },
  {
    id: 'premium',
    name: 'Premium',
    price_usd: 29.99,
    duration_days: 30,
    question_limit: null,
    features: ['Everything in Pro', 'Live classes', 'Mentorship and coaching', 'International nurse pathway', 'Priority WhatsApp support'],
    is_active: true,
    sort_order: 4,
  },
];

export function questionLimitFor(plan, hasAdminAccess = false) {
  if (hasAdminAccess) return QUESTION_ACCESS.admin;
  return QUESTION_ACCESS[plan] ?? QUESTION_ACCESS.free;
}
