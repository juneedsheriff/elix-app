-- Allow doctors to update their own public profile fields (photo, contact, bio).

create or replace function public.update_own_doctor_profile(
  p_full_name text,
  p_gender text default null,
  p_mobile_no text default null,
  p_qualification text default null,
  p_specialization text default null,
  p_about_doctor text default null,
  p_work_experience text default null,
  p_awards_recognitions text default null,
  p_membership text default null,
  p_languages text default null,
  p_image_url text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text;
  v_mobile text;
  v_image text;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  v_name := nullif(trim(coalesce(p_full_name, '')), '');
  if v_name is null then
    raise exception 'Full name is required';
  end if;

  v_mobile := nullif(trim(coalesce(p_mobile_no, '')), '');
  v_image := nullif(trim(coalesce(p_image_url, '')), '');

  update public.doctors
  set
    full_name = v_name,
    gender = nullif(trim(coalesce(p_gender, '')), ''),
    mobile_no = v_mobile,
    phone = coalesce(v_mobile, phone),
    qualification = nullif(trim(coalesce(p_qualification, '')), ''),
    specialization = nullif(trim(coalesce(p_specialization, '')), ''),
    about_doctor = nullif(trim(coalesce(p_about_doctor, '')), ''),
    bio = nullif(trim(coalesce(p_about_doctor, '')), ''),
    work_experience = nullif(trim(coalesce(p_work_experience, '')), ''),
    awards_recognitions = nullif(trim(coalesce(p_awards_recognitions, '')), ''),
    membership = nullif(trim(coalesce(p_membership, '')), ''),
    languages = coalesce(nullif(trim(coalesce(p_languages, '')), ''), languages),
    image_url = coalesce(v_image, image_url)
  where auth_user_id = auth.uid()
    and deleted_at is null;

  if not found then
    raise exception 'Doctor profile not found for this account';
  end if;
end;
$$;

comment on function public.update_own_doctor_profile is
  'Lets the authenticated doctor update their own profile photo and soft profile fields.';

grant execute on function public.update_own_doctor_profile(
  text, text, text, text, text, text, text, text, text, text, text
) to authenticated;
