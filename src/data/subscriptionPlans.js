export const QUESTION_ACCESS = {
  free: 150,
  basic: 2000,
  pro: Infinity,
  master: Infinity,
  faculty: Infinity,
  admin: Infinity,
};

export const PLAN_LEVELS = { none: 0, free: 0, basic: 1, pro: 2, master: 3, faculty: 4 };

const UNLIMITED = Infinity;

export const PLAN_ENTITLEMENTS = {
  free: {
    questionLimit: 150, flashcardLimit: 20, catAttempts: 1, readinessAttempts: 0,
    coachDailyLimit: 10, plannerDays: 7, premiumVideos: false, customExams: false,
    weakAreaAnalysis: false, detailedAnalytics: false, certificates: false, assignments: false,
    professionalResources: false, liveClasses: false, prioritySupport: false,
    facultyBadge: false, earlyAccess: false,
  },
  basic: {
    questionLimit: 2000, flashcardLimit: UNLIMITED, catAttempts: 5, readinessAttempts: 2,
    coachDailyLimit: UNLIMITED, plannerDays: 30, premiumVideos: true, customExams: false,
    weakAreaAnalysis: true, detailedAnalytics: false, certificates: false, assignments: false,
    professionalResources: false, liveClasses: false, prioritySupport: false,
    facultyBadge: false, earlyAccess: false,
  },
  pro: {
    questionLimit: UNLIMITED, flashcardLimit: UNLIMITED, catAttempts: UNLIMITED, readinessAttempts: UNLIMITED,
    coachDailyLimit: UNLIMITED, plannerDays: 90, premiumVideos: true, customExams: true,
    weakAreaAnalysis: true, detailedAnalytics: true, certificates: true, assignments: false,
    professionalResources: false, liveClasses: false, prioritySupport: false,
    facultyBadge: false, earlyAccess: false,
  },
  master: {
    questionLimit: UNLIMITED, flashcardLimit: UNLIMITED, catAttempts: UNLIMITED, readinessAttempts: UNLIMITED,
    coachDailyLimit: UNLIMITED, plannerDays: 180, premiumVideos: true, customExams: true,
    weakAreaAnalysis: true, detailedAnalytics: true, certificates: true, assignments: true,
    professionalResources: true, liveClasses: true, prioritySupport: false,
    facultyBadge: false, earlyAccess: false,
  },
  faculty: {
    questionLimit: UNLIMITED, flashcardLimit: UNLIMITED, catAttempts: UNLIMITED, readinessAttempts: UNLIMITED,
    coachDailyLimit: UNLIMITED, plannerDays: 365, premiumVideos: true, customExams: true,
    weakAreaAnalysis: true, detailedAnalytics: true, certificates: true, assignments: true,
    professionalResources: true, liveClasses: true, prioritySupport: true,
    facultyBadge: true, earlyAccess: true,
  },
};

export const SUBSCRIPTION_PLANS = [
  {
    id: 'free',
    name: 'Explorer Pass',
    price_usd: 0,
    duration_days: 36500,
    question_limit: 150,
    features: ['150 NCLEX-RN questions', '20 flashcards', '1 CAT exam', '5 NGN case studies', '7-day study planner', 'Basic performance dashboard', 'Study Coach: 10 questions/day', 'Practice and timed exams up to 50 questions', 'Progress tracking', 'Personal notebook'],
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
    features: ['Everything in the 90-Day Success Plan', 'Live virtual classes and Q&A', 'Class recordings when available', 'Instructor assignments and feedback', 'Professional U.S. RN pathway', 'Visa and career preparation center', 'CPD activity tracker', 'Clinical skills review', '180-day adaptive study planner', 'Instructor-led strategy sessions'],
    is_active: true,
    sort_order: 4,
  },
  {
    id: 'faculty_365',
    name: '365-Day Faculty Pass',
    price_usd: 129,
    duration_days: 365,
    question_limit: null,
    features: ['Everything in the 180-Day Master Plan', 'Full-year unlimited access', '365-day adaptive study planner', 'All question-bank updates during membership', 'New NGN questions and video courses', 'New Study Coach features during membership', 'New study resources during membership', 'Faculty Member badge', 'Faculty webinars in Live Classes', 'Annual NCLEX content updates'],
    is_active: true,
    sort_order: 5,
  },
];

export function questionLimitFor(plan, hasAdminAccess = false) {
  if (hasAdminAccess) return QUESTION_ACCESS.admin;
  return QUESTION_ACCESS[plan] ?? QUESTION_ACCESS.free;
}

export function entitlementsFor(plan, hasAdminAccess = false) {
  if (hasAdminAccess) {
    return {
      ...Object.fromEntries(Object.keys(PLAN_ENTITLEMENTS.faculty).map((key) => [
      key,
      typeof PLAN_ENTITLEMENTS.faculty[key] === 'number' ? UNLIMITED : true,
      ])),
      plannerDays: 36500,
    };
  }
  return PLAN_ENTITLEMENTS[plan] ?? PLAN_ENTITLEMENTS.free;
}
