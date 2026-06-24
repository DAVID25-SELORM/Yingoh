-- Fix video URLs v2: use topic column as discriminator (avoids %cat% matching "communication")

-- CAT Strategy row (topic = 'Test Strategy') — previous video was private
update public.video_lessons set
  video_url     = 'https://www.youtube.com/embed/3TdnyZDG44Q',
  title         = 'CAT Strategy: How the NCLEX Adapts to You',
  description   = 'How Computer Adaptive Testing works on the Next Generation NCLEX and strategies to approach hard questions with confidence.',
  duration_mins = 20
where topic = 'Test Strategy';

-- Mental Health row — was overwritten by %cat% matching "therapeutic communication"; restore it
update public.video_lessons set
  video_url     = 'https://www.youtube.com/embed/V1WbahXiFlw',
  title         = 'Mental Health Nursing: Therapeutic Communication NCLEX Review',
  description   = 'The ultimate NCLEX review for therapeutic communication techniques, do''s and don''ts, and mental health priority nursing interventions.',
  duration_mins = 35
where topic = 'Mental Health';
