-- A exclusão direta anterior podia apagar evidências acadêmicas e vínculos.
-- Toda solicitação passa agora pela fila de privacidade, sem apagar dados.
create or replace function public.delete_my_account(confirmation text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  raise exception 'Direct deletion is disabled; request governed deletion';
end $$;

create function public.request_my_account_deletion(confirmation text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  actor uuid := (select auth.uid());
  target_network uuid;
  request_id uuid;
begin
  if actor is null then raise exception 'Not authenticated'; end if;
  if confirmation <> 'EXCLUIR' then raise exception 'Invalid confirmation'; end if;

  select network_id into target_network
  from public.institutional_memberships
  where user_id = actor and status = 'active'
  order by created_at desc limit 1;
  if target_network is null then
    select network_id into target_network
    from public.student_enrollments
    where student_id = actor
    order by created_at desc limit 1;
  end if;
  if target_network is null then
    select network_id into target_network
    from public.classrooms
    where owner_id = actor and network_id is not null
    order by created_at desc limit 1;
  end if;

  select id into request_id from public.privacy_requests
  where requester_id = actor and request_type = 'deletion'
    and status not in ('rejected', 'cancelled', 'completed')
  order by created_at desc limit 1;
  if request_id is not null then return request_id; end if;

  insert into public.privacy_requests(requester_id, network_id, request_type, details)
  values (actor, target_network, 'deletion', 'Solicitação de exclusão da conta com confirmação e reautenticação.')
  returning id into request_id;
  return request_id;
end $$;

revoke all on function public.delete_my_account(text) from public, anon, authenticated;
revoke all on function public.request_my_account_deletion(text) from public, anon;
grant execute on function public.request_my_account_deletion(text) to authenticated;
