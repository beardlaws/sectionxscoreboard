-- Remove Cross Country practice / non-varsity wrappers accidentally imported from Arbiter.
delete from public.cross_country_meets m
where m.source='arbiter'
  and m.status<>'Final'
  and (
    m.source_payload is null
    or not exists (
      select 1
      from jsonb_array_elements(m.source_payload) e
      where lower(coalesce(e->>'sportName',''))='cross country'
        and lower(coalesce(e->>'levelName',''))='varsity'
        and lower(coalesce(e->>'gameTypeName',''))<>'practice'
    )
  );
