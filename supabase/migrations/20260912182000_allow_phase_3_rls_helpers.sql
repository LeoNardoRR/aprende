-- As policies RLS executam estes helpers security-definer; o papel autenticado
-- precisa somente de EXECUTE para que a própria policy possa avaliá-los.
grant execute on function private.can_read_diagnostic_assessment(uuid) to authenticated;
grant execute on function private.can_manage_diagnostic_assessment(uuid) to authenticated;
