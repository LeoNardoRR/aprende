create or replace function public.delete_my_account(confirmation text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
begin
  if current_user_id is null then
    raise exception 'not_authenticated';
  end if;

  if confirmation <> 'EXCLUIR' then
    raise exception 'invalid_confirmation';
  end if;

  delete from auth.users
  where id = current_user_id;
end;
$$;

revoke execute on function public.delete_my_account(text) from public, anon;
grant execute on function public.delete_my_account(text) to authenticated;

create or replace function public.is_teacher_email_allowed(target_email text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from private.teacher_invites
    where email = lower(trim(target_email))
  );
$$;

revoke execute on function public.is_teacher_email_allowed(text) from public;
grant execute on function public.is_teacher_email_allowed(text) to anon, authenticated;
