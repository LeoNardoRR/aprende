explain (analyze, buffers, format json)
select
  fact.assessment_id,
  count(*) as attempts,
  count(distinct fact.student_id) as students,
  avg(fact.percentage) filter (where fact.percentage is not null) as mean_percentage
from private.analytics_attempt_facts fact
where fact.network_id = (
  select network.id
  from public.networks network
  where network.name = 'POC DEMO Monte Mor - dados sinteticos'
  limit 1
)
group by fact.assessment_id;
