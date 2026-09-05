ALTER TABLE public.matches ALTER COLUMN rake_bps SET DEFAULT 1000;
ALTER TABLE public.tournaments ALTER COLUMN rake_bps SET DEFAULT 1000;
UPDATE public.matches SET rake_bps = 1000 WHERE status = 'open' AND rake_bps = 500;
UPDATE public.tournaments SET rake_bps = 1000 WHERE status = 'open' AND rake_bps = 500;