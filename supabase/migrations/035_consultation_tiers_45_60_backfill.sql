-- Backfill 45 min and 1 hour tiers for doctors that only have 15/30 from migration 034.

update public.doctors
set consultation_tiers = consultation_tiers
  || jsonb_build_array(
    jsonb_build_object(
      'duration_minutes', 45,
      'fee_usd', greatest(
        0,
        round(coalesce(consultation_fee, fee_usd, 0) * 1.5)::integer
      )
    ),
    jsonb_build_object(
      'duration_minutes', 60,
      'fee_usd', greatest(
        0,
        coalesce(consultation_fee, fee_usd, 0)::integer * 2
      )
    )
  )
where jsonb_array_length(consultation_tiers) < 4
  and coalesce(consultation_fee, fee_usd, 0) > 0;

update public.doctors
set consultation_tiers = jsonb_build_array(
  jsonb_build_object('duration_minutes', 15, 'fee_usd', 50),
  jsonb_build_object('duration_minutes', 30, 'fee_usd', 100),
  jsonb_build_object('duration_minutes', 45, 'fee_usd', 150),
  jsonb_build_object('duration_minutes', 60, 'fee_usd', 200)
)
where jsonb_array_length(consultation_tiers) < 4;
