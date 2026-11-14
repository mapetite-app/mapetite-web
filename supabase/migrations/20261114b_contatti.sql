-- "Trova amici dalla rubrica" (Lorenzo, 14/11), solo Android (Contact Picker del browser).
-- Il telefono manda le impronte SHA-256 delle email dei contatti scelti dalla persona (mai le email
-- in chiaro); qui si confrontano con le email degli account e si restituiscono solo i profili con
-- "Fatti trovare" acceso (vista profili_pubblici). Niente viene salvato: né le impronte né i contatti.
-- I numeri di telefono non si usano: gli account non ne hanno.

create or replace function public.trova_da_contatti(p_hash text[])
returns table (id uuid, handle text, display_name text, city text)
language sql
stable
security definer
set search_path = public
as $$
  select p.id, p.handle, p.display_name, p.city
  from profili_pubblici p
  join auth.users u on u.id = p.id
  where auth.uid() is not null
    and p.id <> auth.uid()
    and coalesce(array_length(p_hash, 1), 0) between 1 and 1000
    and encode(sha256(convert_to(lower(trim(u.email)), 'UTF8')), 'hex') = any (p_hash)
  limit 50;
$$;

revoke all on function public.trova_da_contatti(text[]) from public;
revoke all on function public.trova_da_contatti(text[]) from anon;
grant execute on function public.trova_da_contatti(text[]) to authenticated;
