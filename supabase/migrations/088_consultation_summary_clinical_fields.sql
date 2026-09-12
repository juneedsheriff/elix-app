-- Additional consultation summary clinical fields (ROS, PE, lifestyle advice, referrals).

alter table public.consultation_summaries
  add column if not exists review_of_systems text;

alter table public.consultation_summaries
  add column if not exists physical_examination text;

alter table public.consultation_summaries
  add column if not exists advise_food_lifestyle text;

alter table public.consultation_summaries
  add column if not exists refer_to text;

comment on column public.consultation_summaries.review_of_systems is
  'Doctor-entered Review of Systems (ROS) for the consultation summary.';

comment on column public.consultation_summaries.physical_examination is
  'Doctor-entered Physical Examination (PE) for the consultation summary.';

comment on column public.consultation_summaries.advise_food_lifestyle is
  'Doctor advice on food and lifestyle for the consultation summary.';

comment on column public.consultation_summaries.refer_to is
  'Referral destination recorded on the consultation summary.';
