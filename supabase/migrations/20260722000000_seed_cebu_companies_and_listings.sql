-- InternConnect — Seed: Cebu company accounts + internship listings
--
-- Two independent parts. Both are re-runnable: every insert is guarded by a
-- NOT EXISTS, so running this twice does not duplicate anything.
--
--   Part A  16 real companies with operations across Cebu province, spread
--           from Bogo in the north to Carcar in the south. Each gets an
--           allowlist row, an auth user, and (via handle_new_user) a profile
--           and a companies row.
--   Part B  10 internship listings for EVERY row in public.companies — the
--           ones seeded here and any that already existed.
--
-- The companies are real and really do operate at the stated Cebu sites. The
-- contact emails, SEC/DTI identifiers, and every listing below are invented
-- demo data. Emails deliberately use the reserved .test TLD (RFC 2606) so no
-- mail can ever be routed to a real company from a demo database.
--
-- Requires pgcrypto for crypt()/gen_salt(); on Supabase it lives in the
-- `extensions` schema, which is why those calls are schema-qualified.

-- ===========================================================================
-- Part A — Cebu company accounts
-- ===========================================================================

-- A1. NLO allowlist. handle_new_user() reads this to resolve the 'company'
--     role and to name the companies row, so it has to land before the users.
insert into public.nlo_approved_companies (company_name, contact_email, identifier)
values
  ('Lexmark Research and Development Corporation', 'careers@lexmark-rnd.test',   'SEC-CEB-100001'),
  ('Accenture Inc. — Cebu Delivery Center',        'careers@accenture-cebu.test','SEC-CEB-100002'),
  ('Aboitiz Equity Ventures, Inc.',                'careers@aboitiz.test',       'SEC-CEB-100003'),
  ('Visayan Electric Company, Inc.',               'careers@veco.test',          'SEC-CEB-100004'),
  ('Cebu Air, Inc. (Cebu Pacific)',                'careers@cebupacific.test',   'SEC-CEB-100005'),
  ('Lear Corporation Philippines, Inc.',           'careers@lear-mepz.test',     'SEC-CEB-100006'),
  ('Taiyo Yuden (Philippines), Inc.',              'careers@taiyoyuden-ph.test', 'SEC-CEB-100007'),
  ('Tsuneishi Heavy Industries (Cebu), Inc.',      'careers@tsuneishi-cebu.test','SEC-CEB-100008'),
  ('Mitsumi Philippines, Inc.',                    'careers@mitsumi-danao.test', 'SEC-CEB-100009'),
  ('APO Cement Corporation',                       'careers@apocement.test',     'SEC-CEB-100010'),
  ('Carmen Copper Corporation',                    'careers@carmencopper.test',  'SEC-CEB-100011'),
  ('Metro Retail Stores Group, Inc.',              'careers@metroretail.test',   'SEC-CEB-100012'),
  ('Norkis Group of Companies',                    'careers@norkis.test',        'SEC-CEB-100013'),
  ('Cebu Landmasters, Inc.',                       'careers@cebulandmasters.test','SEC-CEB-100014'),
  ('KEPCO SPC Power Corporation',                  'careers@kepcospc.test',      'SEC-CEB-100015'),
  ('Bogo-Medellin Milling Company, Inc.',          'careers@bomedco.test',       'SEC-CEB-100016')
on conflict (contact_email) do nothing;

-- A2. Auth users. Inserting here fires handle_new_user(), which creates the
--     profile (role resolved from the allowlist above) and the companies row.
--
--     These are demo accounts sharing one throwaway password. Change it before
--     this database is ever exposed to anything but local development:
--       ChangeMe!Cebu2026
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data,
  -- Empty strings rather than NULL: some GoTrue versions scan these columns
  -- into non-nullable Go strings and error on the whole row if they are null.
  confirmation_token, recovery_token, email_change, email_change_token_new
)
select
  '00000000-0000-0000-0000-000000000000',
  gen_random_uuid(),
  'authenticated',
  'authenticated',
  c.contact_email,
  extensions.crypt('ChangeMe!Cebu2026', extensions.gen_salt('bf')),
  now(), now(), now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  jsonb_build_object('full_name', c.company_name),
  '', '', '', ''
from public.nlo_approved_companies c
where c.contact_email like '%.test'
  and not exists (
    select 1 from auth.users u where lower(u.email) = lower(c.contact_email)
  );

-- A3. Email identities — GoTrue needs one per user or password sign-in fails.
insert into auth.identities (
  id, user_id, provider_id, identity_data, provider,
  last_sign_in_at, created_at, updated_at
)
select
  gen_random_uuid(),
  u.id,
  u.id::text,
  jsonb_build_object(
    'sub', u.id::text,
    'email', u.email,
    'email_verified', true,
    'phone_verified', false
  ),
  'email',
  now(), now(), now()
from auth.users u
where u.email like '%.test'
  and not exists (
    select 1 from auth.identities i
    where i.user_id = u.id and i.provider = 'email'
  );

-- A4. Flesh out the companies rows. handle_new_user only sets owner_id + name;
--     the industry drives which listing templates Part B picks, and the
--     location is what students see on every listing.
update public.companies c set
  industry     = v.industry,
  location     = v.location,
  website      = v.website,
  description  = v.description,
  verification = 'verified',
  updated_at   = now()
from (values
  ('careers@lexmark-rnd.test',    'Software Development',
   'Cebu IT Park, Lubi St., Apas, Cebu City',
   'https://www.lexmark.com',
   'Research and development arm of Lexmark, building imaging, printing, and enterprise software from its Cebu IT Park campus.'),
  ('careers@accenture-cebu.test', 'IT and Consulting',
   'eBloc Tower, Cebu IT Park, Apas, Cebu City',
   'https://www.accenture.com/ph-en',
   'Global professional services firm; the Cebu delivery center handles application development, testing, and operations for international clients.'),
  ('careers@aboitiz.test',        'Conglomerate',
   'Aboitiz Corporate Center, Gov. Manuel A. Cuenco Ave., Cebu City',
   'https://aboitiz.com',
   'Cebu-founded conglomerate with businesses in power, banking, food, infrastructure, and land.'),
  ('careers@veco.test',           'Power and Utilities',
   'VECO Corporate Center, Banilad, Cebu City',
   'https://www.veco.com.ph',
   'The electric distribution utility serving Cebu City, Mandaue, Talisay, Naga, and four municipalities in Metro Cebu.'),
  ('careers@cebupacific.test',    'Aviation',
   'Mactan-Cebu International Airport, Lapu-Lapu City',
   'https://www.cebupacificair.com',
   'The country''s largest carrier by passenger volume, with Mactan as its second hub for domestic and international operations.'),
  ('careers@lear-mepz.test',      'Automotive Electronics',
   'Mactan Economic Zone I, Lapu-Lapu City',
   'https://www.lear.com',
   'Automotive seating and electrical distribution systems manufacturer; the Mactan plant builds wire harnesses and electronic assemblies for export.'),
  ('careers@taiyoyuden-ph.test',  'Electronics Manufacturing',
   'Mactan Economic Zone II, Basak, Lapu-Lapu City',
   'https://www.yuden.co.jp/en',
   'Japanese electronic components maker producing ceramic capacitors and modules at its Mactan facility.'),
  ('careers@tsuneishi-cebu.test', 'Shipbuilding',
   'West Cebu Industrial Park, Buanoy, Balamban, Cebu',
   'https://www.tsuneishi.co.jp/english',
   'Shipbuilder operating one of the largest yards in the Philippines, constructing bulk carriers and container ships in Balamban.'),
  ('careers@mitsumi-danao.test',  'Electronics Manufacturing',
   'Danao City Industrial Park, Danao City, Cebu',
   'https://www.mitsumi.co.jp/en',
   'Precision electronic components and mechatronics manufacturer with a long-running plant in Danao City.'),
  ('careers@apocement.test',      'Cement Manufacturing',
   'Tina-an, Naga City, Cebu',
   'https://www.cemexholdingsphilippines.com',
   'CEMEX Philippines cement plant in Naga City, one of the largest cement producers in the Visayas.'),
  ('careers@carmencopper.test',   'Mining and Metals',
   'Don Andres Soriano, Toledo City, Cebu',
   'https://www.atlasmining.com.ph',
   'Operator of the Toledo copper mine and concentrator, the largest copper operation in the country.'),
  ('careers@metroretail.test',    'Retail',
   'Metro Mandaue, Highway Ave., Mandaue City',
   'https://www.metroretail.com.ph',
   'Cebu-based retail group running department stores, supermarkets, and hypermarkets across the Visayas.'),
  ('careers@norkis.test',         'Distribution and Manufacturing',
   'Norkis Cyberpark, Subangdaku, Mandaue City',
   'https://www.norkis.com',
   'Cebu-headquartered group in motorcycle distribution, manufacturing, and land development.'),
  ('careers@cebulandmasters.test','Real Estate',
   'Park Centrale Tower, Cebu IT Park, Cebu City',
   'https://cebulandmasters.com',
   'The largest homegrown property developer in the Visayas and Mindanao, headquartered in Cebu City.'),
  ('careers@kepcospc.test',       'Power Generation',
   'Colon, Naga City, Cebu',
   'https://www.kepcospc.com',
   'Independent power producer operating coal-fired generating units in Naga City that supply the Cebu grid.'),
  ('careers@bomedco.test',        'Agri-Industrial',
   'Dayhagon, Medellin, Cebu',
   'https://www.bomedco.com',
   'Sugar mill and agri-industrial operation serving cane growers across northern Cebu.')
) as v(contact_email, industry, location, website, description)
join public.profiles p on lower(p.email) = lower(v.contact_email)
where c.owner_id = p.id;

-- ===========================================================================
-- Part B — 10 internship listings per company
-- ===========================================================================
--
-- Runs over every row in public.companies, not a fixed list, so companies that
-- registered through the app get their ten as well.
--
-- Skill arrays use the exact lowercase vocabulary from src/lib/skillTaxonomy.ts
-- — computeMatch() scores against those terms, so a typo here silently costs a
-- listing its match percentage rather than failing loudly.
with templates(bucket, idx, title, department, setup, duration_hours, slots, skills, summary) as (values
  -- ── software / IT ────────────────────────────────────────────────────────
  ('software',  1, 'Software Engineer Intern',        'Engineering',      'hybrid', 486, 3, array['react','typescript','git','api development'],                  'Build and ship features alongside a product squad, from ticket grooming through code review and release.'),
  ('software',  2, 'Frontend Developer Intern',       'Engineering',      'hybrid', 486, 2, array['react','html','css','javascript','figma'],                     'Turn design files into accessible, responsive interfaces and help maintain the shared component library.'),
  ('software',  3, 'Backend Developer Intern',        'Engineering',      'hybrid', 486, 2, array['node js','api development','sql','databases'],                 'Work on service endpoints, database queries, and the integration tests that keep them honest.'),
  ('software',  4, 'QA Automation Intern',            'Quality',          'hybrid', 486, 2, array['python','ci/cd','git','agile'],                                'Grow the regression suite, triage failures, and keep the pipeline green for every merge.'),
  ('software',  5, 'Data Analytics Intern',           'Data',             'hybrid', 486, 2, array['sql','python','excel','data analysis','statistics'],           'Answer product and operations questions with SQL, then package the findings into dashboards people actually open.'),
  ('software',  6, 'DevOps Intern',                   'Platform',         'onsite', 486, 1, array['docker','kubernetes','linux','ci/cd','bash'],                  'Support container builds, deployment pipelines, and the observability stack behind them.'),
  ('software',  7, 'Mobile Application Developer Intern','Engineering',   'hybrid', 486, 2, array['java','javascript','git','ui/ux design'],                      'Contribute screens and bug fixes to a production mobile app used by customers daily.'),
  ('software',  8, 'UI/UX Design Intern',             'Design',           'hybrid', 486, 2, array['figma','ui/ux design','html','css'],                           'Run usability sessions, iterate on wireframes, and hand off specs the engineering team can build from.'),
  ('software',  9, 'IT Support Intern',               'IT Operations',    'onsite', 486, 3, array['linux','networking','tcp/ip','shell scripting'],               'Handle service desk tickets, endpoint setup, and first-line network troubleshooting.'),
  ('software', 10, 'Machine Learning Intern',         'Data Science',     'hybrid', 486, 1, array['python','machine learning','tensorflow lite','statistics'],    'Prepare datasets, run training experiments, and document what actually moved the metric.'),

  -- ── electronics / manufacturing ──────────────────────────────────────────
  ('electronics',  1, 'Electronics Engineering Intern',   'Engineering',   'onsite', 486, 3, array['electronics design','schematic capture','soldering'],           'Assist on board bring-up, rework, and bench characterisation of production assemblies.'),
  ('electronics',  2, 'PCB Design Intern',                'Hardware',      'onsite', 486, 2, array['pcb design','altium designer','kicad','dfm'],                   'Support schematic capture and layout work, and check designs against manufacturability rules.'),
  ('electronics',  3, 'Embedded Systems Intern',          'Engineering',   'onsite', 486, 2, array['embedded c','microcontroller','uart','i2c'],                    'Write and debug device firmware on real hardware, with a logic analyser never far away.'),
  ('electronics',  4, 'Firmware Engineering Intern',      'Engineering',   'onsite', 486, 2, array['firmware development','embedded c','rtos','arm cortex m'],      'Work on scheduling, drivers, and field-update paths for shipping embedded products.'),
  ('electronics',  5, 'Test Engineering Intern',          'Quality',       'onsite', 486, 3, array['matlab','root cause analysis','statistics','excel'],            'Build test fixtures and analyse yield data to find where the line is losing units.'),
  ('electronics',  6, 'Automation Engineering Intern',    'Manufacturing', 'onsite', 486, 2, array['plc','ladder logic','scada','hmi'],                             'Support PLC programs and operator interfaces on production equipment.'),
  ('electronics',  7, 'Robotics Engineering Intern',      'Engineering',   'onsite', 486, 1, array['robotics','ros','control systems','python'],                    'Assist with motion planning and integration work on automated handling cells.'),
  ('electronics',  8, 'Quality Assurance Intern',         'Quality',       'onsite', 486, 3, array['root cause analysis','statistics','excel','dfm'],               'Run inspections, log defects, and take part in the corrective-action reviews that follow.'),
  ('electronics',  9, 'IoT Hardware Intern',              'R&D',           'onsite', 486, 2, array['iot','esp32','mqtt','arduino'],                                 'Prototype connected sensor nodes and the telemetry paths that carry their data.'),
  ('electronics', 10, 'Computer Vision Intern',           'R&D',           'hybrid', 486, 1, array['computer vision','opencv','python','machine learning'],         'Develop inspection routines that catch defects a camera can see faster than a person can.'),

  -- ── energy / utilities / heavy industry ──────────────────────────────────
  ('energy',  1, 'Electrical Engineering Intern',      'Engineering',      'onsite', 486, 3, array['electrical schematics','control systems','matlab'],             'Support protection studies, single-line drawings, and equipment commissioning checks.'),
  ('energy',  2, 'SCADA Systems Intern',               'Operations',       'onsite', 486, 2, array['scada','hmi','plc','networking'],                               'Assist on control-room screens, tag mapping, and field device integration.'),
  ('energy',  3, 'Network Operations Intern',          'IT Operations',    'onsite', 486, 2, array['networking','ccna','tcp/ip','cisco ios'],                       'Monitor links, document topology, and help with switch and router configuration.'),
  ('energy',  4, 'Instrumentation and Control Intern', 'Engineering',      'onsite', 486, 2, array['plc','control systems','ladder logic'],                         'Calibrate field instruments and support loop checks during scheduled outages.'),
  ('energy',  5, 'Power Systems Analyst Intern',       'Planning',         'hybrid', 486, 1, array['matlab','statistics','excel','data analysis'],                  'Work load profiles and outage statistics into the studies that guide capacity planning.'),
  ('energy',  6, 'Maintenance Engineering Intern',     'Maintenance',      'onsite', 486, 3, array['root cause analysis','electrical schematics','excel'],          'Join preventive maintenance rounds and help close out failure investigations.'),
  ('energy',  7, 'Telecommunications Intern',          'Engineering',      'onsite', 486, 2, array['telecommunications','rf fundamentals','lte/5g','spectrum analysis'], 'Assist with site surveys, link budgets, and radio performance measurement.'),
  ('energy',  8, 'IT Infrastructure Intern',           'IT Operations',    'onsite', 486, 2, array['linux','infrastructure','networking','bash'],                   'Help run servers, backups, and the scripts that keep both from needing attention.'),
  ('energy',  9, 'Cybersecurity Intern',               'Information Security','hybrid',486,1, array['network security','wireshark','linux','tcp/ip'],                'Support log review, vulnerability tracking, and hardening work on operational systems.'),
  ('energy', 10, 'Data Engineering Intern',            'Data',             'hybrid', 486, 1, array['sql','python','databases','data analytics'],                    'Build the pipelines that move meter and sensor data into somewhere it can be queried.'),

  -- ── business / retail / services ─────────────────────────────────────────
  ('business',  1, 'Business Analytics Intern',        'Analytics',        'hybrid', 486, 3, array['excel','sql','data analysis','statistics'],                     'Turn transaction and operations data into the weekly numbers the business runs on.'),
  ('business',  2, 'IT Business Systems Intern',       'Information Systems','hybrid',486, 2, array['sql','databases','excel','api development'],                   'Support the internal systems finance and operations depend on, from reports to integrations.'),
  ('business',  3, 'Digital Marketing Intern',         'Marketing',        'hybrid', 486, 2, array['figma','ui/ux design','excel'],                                 'Produce campaign assets and track how each one actually performed.'),
  ('business',  4, 'Supply Chain Analytics Intern',    'Supply Chain',     'onsite', 486, 2, array['excel','sql','data analysis'],                                  'Analyse inventory movement and supplier lead times to find where stock is sitting too long.'),
  ('business',  5, 'Web Development Intern',           'Digital',          'hybrid', 486, 2, array['html','css','javascript','react'],                              'Build and maintain customer-facing web pages and internal tools.'),
  ('business',  6, 'Systems Administration Intern',    'IT Operations',    'onsite', 486, 2, array['linux','networking','bash','version control'],                  'Assist with server administration, access management, and routine automation.'),
  ('business',  7, 'Process Improvement Intern',       'Operations',       'onsite', 486, 2, array['root cause analysis','statistics','excel','agile'],             'Map current processes, measure them, and propose the change worth making first.'),
  ('business',  8, 'Application Support Intern',       'IT Operations',    'hybrid', 486, 3, array['sql','linux','api development','jira'],                         'Triage incoming issues on business applications and escalate with the detail developers need.'),
  ('business',  9, 'Data Visualization Intern',        'Analytics',        'hybrid', 486, 1, array['excel','sql','data analysis','python'],                         'Design dashboards that make a week of operations readable in under a minute.'),
  ('business', 10, 'Project Management Intern',        'PMO',              'hybrid', 486, 2, array['agile','scrum','jira','excel'],                                 'Support sprint ceremonies, delivery tracking, and stakeholder reporting.')
),
-- One bucket per company, matched on the industry text. Anything unrecognised
-- (or null, which is what the trigger leaves behind) falls to 'software' — a
-- CIT-U roster is overwhelmingly CS/IT and engineering students.
company_bucket as (
  select
    c.id,
    c.name,
    coalesce(nullif(c.location, ''), 'Cebu') as location,
    case
      when c.industry ~* 'software|consult|informat|\mit\M|bpo|outsourc|technolog' then 'software'
      -- Energy is tested before electronics on purpose: a cement plant's
      -- industry reads "Cement Manufacturing", and the electronics branch's
      -- 'manufactur' would otherwise claim it and post PCB design roles there.
      when c.industry ~* 'power|energy|utilit|mining|metal|telecom|cement|agri' then 'energy'
      when c.industry ~* 'electronic|semiconduct|manufactur|automotive|shipbuild|precision' then 'electronics'
      when c.industry ~* 'retail|real estate|aviation|bank|financ|conglomerate|distribut|logistic|service' then 'business'
      else 'software'
    end as bucket
  from public.companies c
)
insert into public.listings (
  company_id, title, description, department, location, setup,
  duration_hours, slots, deadline, status, skills
)
select
  cb.id,
  t.title,
  t.summary || ' Based at ' || cb.location || ' with ' || cb.name || '.',
  t.department,
  cb.location,
  t.setup::public.work_setup,
  t.duration_hours,
  t.slots,
  -- Staggered so the listings page does not show ten identical deadlines, and
  -- far enough out that listingStatus() still reads them as Open.
  current_date + (21 + t.idx * 7),
  'open'::public.listing_status,
  t.skills
from company_bucket cb
join templates t on t.bucket = cb.bucket
where not exists (
  select 1 from public.listings l
  where l.company_id = cb.id and l.title = t.title
);

-- ===========================================================================
-- Part C — collision top-up
-- ===========================================================================
--
-- The NOT EXISTS above is what makes Part B re-runnable, but it also means a
-- company that ALREADY had a listing under a template title gets nine instead
-- of ten. That happened to exactly two companies on the live database:
-- Mactan Semiconductor Corp. already had 'Quality Assurance Intern', and Queen
-- City Circuits already had 'PCB Design Intern'. These two rows bring both back
-- to ten. Companies matched by name, so this is a no-op on any database that
-- does not have them.
insert into public.listings (
  company_id, title, description, department, location, setup,
  duration_hours, slots, deadline, status, skills
)
select
  c.id, v.title,
  v.summary || ' Based at ' || c.location || ' with ' || c.name || '.',
  v.department, c.location, 'onsite'::public.work_setup,
  486, 2, current_date + 105, 'open'::public.listing_status, v.skills
from public.companies c
join (values
  ('Mactan Semiconductor Corp.', 'Wafer Test Engineering Intern', 'Quality',
   array['matlab','root cause analysis','statistics','excel'],
   'Support wafer-level test programs and analyse the data they produce for drift.'),
  ('Queen City Circuits', 'Analog Circuit Design Intern', 'Hardware',
   array['electronics design','schematic capture','pcb design'],
   'Assist on analog front-end design, simulation, and bench validation.')
) as v(company, title, department, skills, summary) on v.company = c.name
where not exists (
  select 1 from public.listings l where l.company_id = c.id and l.title = v.title
);
