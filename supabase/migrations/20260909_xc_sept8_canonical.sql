-- Canonical Sept. 8, 2026 Section X XC dual outcomes from North Country Sports.
-- Incomplete teams lose to complete teams and tie other incomplete teams.

delete from public.cross_country_dual_results d
using public.cross_country_meets m
where d.meet_id=m.id and m.meet_date='2026-09-08';

with pairs(meet_id,sport_slug,a,b,sa,sb,outcome,notes) as (values
('bb8ca078-2743-4f01-b0fb-6b001627662a','boys-cross-country','canton-boys-cross-country','tupper-lake-boys-cross-country',21,40,'W',null),
('bb8ca078-2743-4f01-b0fb-6b001627662a','boys-cross-country','canton-boys-cross-country','gouverneur-boys-cross-country',15,48,'W',null),
('bb8ca078-2743-4f01-b0fb-6b001627662a','boys-cross-country','tupper-lake-boys-cross-country','gouverneur-boys-cross-country',24,31,'W',null),
('bb8ca078-2743-4f01-b0fb-6b001627662a','boys-cross-country','canton-boys-cross-country','ogdensburg-free-academy-boys-cross-country',null,null,'W','OFA incomplete'),
('bb8ca078-2743-4f01-b0fb-6b001627662a','boys-cross-country','canton-boys-cross-country','salmon-river-boys-cross-country',null,null,'W','Salmon River incomplete'),
('bb8ca078-2743-4f01-b0fb-6b001627662a','boys-cross-country','tupper-lake-boys-cross-country','ogdensburg-free-academy-boys-cross-country',null,null,'W','OFA incomplete'),
('bb8ca078-2743-4f01-b0fb-6b001627662a','boys-cross-country','tupper-lake-boys-cross-country','salmon-river-boys-cross-country',null,null,'W','Salmon River incomplete'),
('bb8ca078-2743-4f01-b0fb-6b001627662a','boys-cross-country','gouverneur-boys-cross-country','ogdensburg-free-academy-boys-cross-country',null,null,'W','OFA incomplete'),
('bb8ca078-2743-4f01-b0fb-6b001627662a','boys-cross-country','gouverneur-boys-cross-country','salmon-river-boys-cross-country',null,null,'W','Salmon River incomplete'),
('bb8ca078-2743-4f01-b0fb-6b001627662a','boys-cross-country','ogdensburg-free-academy-boys-cross-country','salmon-river-boys-cross-country',null,null,'T','Both incomplete'),

('bb8ca078-2743-4f01-b0fb-6b001627662a','girls-cross-country','gouverneur-girls-cross-country','canton-girls-cross-country',15,50,'W',null),
('bb8ca078-2743-4f01-b0fb-6b001627662a','girls-cross-country','gouverneur-girls-cross-country','ogdensburg-free-academy-girls-cross-country',15,50,'W','OFA incomplete'),
('bb8ca078-2743-4f01-b0fb-6b001627662a','girls-cross-country','gouverneur-girls-cross-country','salmon-river-girls-cross-country',15,50,'W','Salmon River incomplete'),
('bb8ca078-2743-4f01-b0fb-6b001627662a','girls-cross-country','gouverneur-girls-cross-country','tupper-lake-girls-cross-country',15,50,'W','Tupper Lake incomplete'),
('bb8ca078-2743-4f01-b0fb-6b001627662a','girls-cross-country','canton-girls-cross-country','ogdensburg-free-academy-girls-cross-country',null,null,'T','Both incomplete'),
('bb8ca078-2743-4f01-b0fb-6b001627662a','girls-cross-country','canton-girls-cross-country','salmon-river-girls-cross-country',null,null,'T','Both incomplete'),
('bb8ca078-2743-4f01-b0fb-6b001627662a','girls-cross-country','canton-girls-cross-country','tupper-lake-girls-cross-country',null,null,'T','Both incomplete'),
('bb8ca078-2743-4f01-b0fb-6b001627662a','girls-cross-country','ogdensburg-free-academy-girls-cross-country','salmon-river-girls-cross-country',null,null,'T','Both incomplete'),
('bb8ca078-2743-4f01-b0fb-6b001627662a','girls-cross-country','ogdensburg-free-academy-girls-cross-country','tupper-lake-girls-cross-country',null,null,'T','Both incomplete'),
('bb8ca078-2743-4f01-b0fb-6b001627662a','girls-cross-country','salmon-river-girls-cross-country','tupper-lake-girls-cross-country',null,null,'T','Both incomplete'),

('f389d2e9-e7b3-4ce6-8977-139a32571120','boys-cross-country','norwood-norfolk-boys-cross-country','massena-boys-cross-country',27,28,'W',null),
('f389d2e9-e7b3-4ce6-8977-139a32571120','boys-cross-country','norwood-norfolk-boys-cross-country','brushton-moira-boys-cross-country',21,38,'W',null),
('f389d2e9-e7b3-4ce6-8977-139a32571120','boys-cross-country','norwood-norfolk-boys-cross-country','potsdam-boys-cross-country',26,29,'W',null),
('f389d2e9-e7b3-4ce6-8977-139a32571120','boys-cross-country','norwood-norfolk-boys-cross-country','malone-boys-cross-country',null,null,'W','Malone incomplete'),
('f389d2e9-e7b3-4ce6-8977-139a32571120','boys-cross-country','massena-boys-cross-country','brushton-moira-boys-cross-country',21,38,'W',null),
('f389d2e9-e7b3-4ce6-8977-139a32571120','boys-cross-country','massena-boys-cross-country','potsdam-boys-cross-country',25,30,'W',null),
('f389d2e9-e7b3-4ce6-8977-139a32571120','boys-cross-country','massena-boys-cross-country','malone-boys-cross-country',null,null,'W','Malone incomplete'),
('f389d2e9-e7b3-4ce6-8977-139a32571120','boys-cross-country','potsdam-boys-cross-country','brushton-moira-boys-cross-country',23,36,'W',null),
('f389d2e9-e7b3-4ce6-8977-139a32571120','boys-cross-country','potsdam-boys-cross-country','malone-boys-cross-country',null,null,'W','Malone incomplete'),
('f389d2e9-e7b3-4ce6-8977-139a32571120','boys-cross-country','brushton-moira-boys-cross-country','malone-boys-cross-country',null,null,'W','Malone incomplete'),

('f389d2e9-e7b3-4ce6-8977-139a32571120','girls-cross-country','norwood-norfolk-girls-cross-country','massena-girls-cross-country',27,30,'W',null),
('f389d2e9-e7b3-4ce6-8977-139a32571120','girls-cross-country','norwood-norfolk-girls-cross-country','malone-girls-cross-country',40,41,'W',null),
('f389d2e9-e7b3-4ce6-8977-139a32571120','girls-cross-country','norwood-norfolk-girls-cross-country','brushton-moira-girls-cross-country',null,null,'W','Brushton-Moira incomplete'),
('f389d2e9-e7b3-4ce6-8977-139a32571120','girls-cross-country','norwood-norfolk-girls-cross-country','potsdam-girls-cross-country',null,null,'W','Potsdam incomplete'),
('f389d2e9-e7b3-4ce6-8977-139a32571120','girls-cross-country','massena-girls-cross-country','malone-girls-cross-country',18,43,'W',null),
('f389d2e9-e7b3-4ce6-8977-139a32571120','girls-cross-country','massena-girls-cross-country','brushton-moira-girls-cross-country',null,null,'W','Brushton-Moira incomplete'),
('f389d2e9-e7b3-4ce6-8977-139a32571120','girls-cross-country','massena-girls-cross-country','potsdam-girls-cross-country',null,null,'W','Potsdam incomplete'),
('f389d2e9-e7b3-4ce6-8977-139a32571120','girls-cross-country','malone-girls-cross-country','brushton-moira-girls-cross-country',null,null,'W','Brushton-Moira incomplete'),
('f389d2e9-e7b3-4ce6-8977-139a32571120','girls-cross-country','malone-girls-cross-country','potsdam-girls-cross-country',null,null,'W','Potsdam incomplete'),
('f389d2e9-e7b3-4ce6-8977-139a32571120','girls-cross-country','brushton-moira-girls-cross-country','potsdam-girls-cross-country',null,null,'T','Both incomplete')
)
insert into public.cross_country_dual_results(meet_id,sport_id,team_a_id,team_b_id,team_a_score,team_b_score,outcome_a,source,notes)
select p.meet_id::uuid,s.id,a.id,b.id,p.sa,p.sb,p.outcome,'northcountrysports',p.notes
from pairs p
join public.sports s on s.slug=p.sport_slug
join public.teams a on a.slug=p.a
join public.teams b on b.slug=p.b;
