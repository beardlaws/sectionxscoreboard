-- Correct the two OFA tournament league games and suppress the stale Sept. 19 Morristown rematch.
-- Both Sept. 2 H-D vs Heuvelton and Sept. 5 Morristown vs Heuvelton count in league standings.

update public.games
set league_designation='League',
    league_designation_override=true,
    league_designation_note='Admin override: OFA tournament result counts as a Section X league game.',
    league_designation_updated_at=now(),
    updated_at=now()
where id='fb54678e-f09e-4c8d-8811-28fd5029b44f';

update public.games
set league_designation='League',
    league_designation_override=true,
    league_designation_note='Admin override: OFA tournament result counts as a Section X league game.',
    league_designation_updated_at=now(),
    updated_at=now()
where id='0e909183-a87d-4ee0-8b77-6d6a584f96d8';

update public.games
set status='Canceled',
    schedule_override=true,
    schedule_override_note='Moved to Sept. 5 OFA tournament; Sept. 5 result is the league game.',
    schedule_override_updated_at=now(),
    updated_at=now()
where id='111394d8-ac36-4696-983a-4ccdbb37250f';
