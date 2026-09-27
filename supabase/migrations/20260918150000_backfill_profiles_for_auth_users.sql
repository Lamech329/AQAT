-- Ensure Auth users created before the profile trigger was installed can sign in.
insert into public.profiles (id)
select id
from auth.users
on conflict (id) do nothing;
