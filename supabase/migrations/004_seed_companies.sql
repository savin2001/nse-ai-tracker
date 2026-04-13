-- Migration 004: Seed 20 NSE-listed companies

INSERT INTO nse.companies (ticker, name, sector, market_cap_b, high_52w, low_52w, listing_date) VALUES
  ('SCOM',  'Safaricom PLC',                    'Telecommunications', 1192.00, 34.50, 22.00, '2008-06-09'),
  ('EQTY',  'Equity Group Holdings PLC',        'Banking',             156.00, 47.00, 35.50, '2006-08-07'),
  ('KCB',   'KCB Group PLC',                    'Banking',             122.00, 44.00, 30.00, '1954-01-01'),
  ('EABL',  'East African Breweries Ltd',       'Beverages',           123.00, 178.00, 120.00,'1988-01-01'),
  ('COOP',  'Co-operative Bank of Kenya',       'Banking',              72.00, 15.90, 10.50, '2008-12-22'),
  ('SCBK',  'Standard Chartered Bank Kenya',   'Banking',              59.00, 162.00,118.00, '1989-01-01'),
  ('ABSA',  'ABSA Bank Kenya PLC',              'Banking',              72.00, 16.00, 10.80, '1996-01-01'),
  ('IMH',   'I&M Group PLC',                    'Banking',              34.00, 26.00, 18.00, '2012-06-12'),
  ('DTK',   'Diamond Trust Bank Kenya',        'Banking',              16.00, 62.00, 42.00, '2008-01-01'),
  ('SBIC',  'Stanbic Holdings PLC',             'Banking',              41.00, 115.00, 85.00,'2011-10-31'),
  ('BAMB',  'Bamburi Cement PLC',               'Construction',         15.00, 51.00, 28.00, '1951-01-01'),
  ('TOTL',  'TotalEnergies Marketing Kenya',   'Energy',                4.00, 24.00, 16.50, '1989-01-01'),
  ('KEGN',  'KenGen PLC',                       'Energy',               18.00,  5.50,  3.40, '2006-05-12'),
  ('KPLC',  'Kenya Power & Lighting Co.',      'Energy',                3.00,  2.90,  1.40, '1954-01-01'),
  ('NMG',   'Nation Media Group',              'Media',                  9.00, 30.00, 18.00, '1973-01-01'),
  ('KQ',    'Kenya Airways PLC',               'Aviation',               6.00,  6.50,  3.20, '1996-07-01'),
  ('BOC',   'BOC Kenya PLC',                   'Manufacturing',          3.00, 100.00, 74.00,'1969-01-01'),
  ('SASN',  'Sasini PLC',                       'Agriculture',            3.00, 24.00, 14.50, '1965-01-01'),
  ('LIMURU','Limuru Tea PLC',                   'Agriculture',            4.00, 680.00,480.00,'1948-01-01'),
  ('HFCK',  'HF Group PLC',                    'Financial Services',     3.00,  6.20,  3.80, '1992-01-01')
ON CONFLICT (ticker) DO UPDATE SET
  name         = EXCLUDED.name,
  sector       = EXCLUDED.sector,
  market_cap_b = EXCLUDED.market_cap_b,
  high_52w     = EXCLUDED.high_52w,
  low_52w      = EXCLUDED.low_52w;
