-- Give every account a display name.
--
-- handle_new_user copied display_name out of raw_user_meta_data, but the signup
-- form only ever sends an email and password, so the column was null for every
-- account and the forum showed "Anonymous" against all six users. That reads as
-- broken rather than private.
--
-- The default is deliberately not derived from the email address. Profiles are
-- publicly readable now, and turning yishayharel2005@gmail.com into the public
-- handle "yishayharel2005" would publish most of someone's address without them
-- choosing to. A neutral label leaks nothing and is meant to be changed.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (user_id, display_name)
  values (
    new.id,
    coalesce(
      nullif(trim(new.raw_user_meta_data->>'display_name'), ''),
      -- Short, stable, and derived from the user id rather than the email.
      'Investor ' || upper(substr(replace(new.id::text, '-', ''), 1, 4))
    )
  );
  return new;
end;
$$;

-- Backfill the accounts created before this.
update public.profiles
   set display_name = 'Investor ' || upper(substr(replace(user_id::text, '-', ''), 1, 4)),
       updated_at = now()
 where display_name is null or trim(display_name) = '';
