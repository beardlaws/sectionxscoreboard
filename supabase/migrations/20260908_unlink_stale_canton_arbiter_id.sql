-- Remove a stale Arbiter stable-ID association that now points to a different external-only contest.
-- Preserve the verified manual Canton vs Beekmantown final; only the bad source link is removed.
delete from public.arbiter_game_links
where arbiter_game_id=103526347
  and game_id='c4ffad14-f159-4196-8e6a-5b1d07f5b9b8';
