-- Fix video lesson URLs: replace placeholder (Rick Astley) with real NCLEX content

update public.video_lessons set
  video_url      = 'https://www.youtube.com/embed/si67310XO80',
  title          = 'NCLEX Pharmacology: High-Yield Drug Classes',
  description    = 'Cover the 20 most-tested drug classes. Focus on nursing considerations, antidotes, side effects, and NCLEX priority questions.',
  duration_mins  = 45
where title ilike '%pharmacology%' and video_url ilike '%dQw4w9WgXcQ%';

update public.video_lessons set
  video_url      = 'https://www.youtube.com/embed/mPDa_ypIS0o',
  title          = 'NGN Case Study Walkthrough',
  description    = 'Full-length Next Generation NCLEX case walkthrough. Demonstrates clinical judgment across bow-tie, matrix, and highlight items.',
  duration_mins  = 38
where title ilike '%ngn%' and video_url ilike '%dQw4w9WgXcQ%';

update public.video_lessons set
  video_url      = 'https://www.youtube.com/embed/PU6YDCkwJ6Y',
  title          = 'CAT Strategy: How the NCLEX Adapts to You',
  description    = 'How Computer Adaptive Testing works on the Next Generation NCLEX and strategies to approach hard questions with confidence.',
  duration_mins  = 30
where title ilike '%cat%' and video_url ilike '%dQw4w9WgXcQ%';

update public.video_lessons set
  video_url      = 'https://www.youtube.com/embed/cnE5EvJ_mdY',
  title          = 'Critical Lab Values You Must Know',
  description    = 'Master the critical lab values most likely on NCLEX. Includes sodium, potassium, glucose, CBC, ABGs, and more.',
  duration_mins  = 25
where title ilike '%lab value%' and video_url ilike '%dQw4w9WgXcQ%';

update public.video_lessons set
  video_url      = 'https://www.youtube.com/embed/n2dMcPzQdjw',
  title          = 'Mental Health Nursing: NGN Questions & Rationales',
  description    = 'Next Gen NCLEX walkthroughs for mental health. Covers therapeutic communication, psychiatric meds, and clinical judgment questions.',
  duration_mins  = 28
where title ilike '%mental health%' and video_url ilike '%dQw4w9WgXcQ%';

update public.video_lessons set
  video_url      = 'https://www.youtube.com/embed/r3W3wFR5ubM',
  title          = 'Maternal-Newborn: Priority Nursing Actions',
  description    = 'High-yield maternal and newborn content. Covers labor stages, postpartum complications, and newborn assessments for NCLEX.',
  duration_mins  = 35
where title ilike '%maternal%' and video_url ilike '%dQw4w9WgXcQ%';
