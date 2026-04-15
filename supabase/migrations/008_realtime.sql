-- Migration 008: Enable Supabase Realtime for live-updating tables
-- Clients subscribe to nse.detected_events and nse.analysis_results
-- via the Supabase Realtime channel to receive push updates without polling.

-- Add both tables to the supabase_realtime publication.
-- Idempotent: IF NOT EXISTS guards prevent errors on re-run.

DO $$
BEGIN
  -- detected_events: pushed to frontend EventsPage as events are detected
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'nse'
      AND tablename = 'detected_events'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE nse.detected_events;
  END IF;

  -- analysis_results: pushed to frontend StockDetail / AIAnalysis when signals refresh
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'nse'
      AND tablename = 'analysis_results'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE nse.analysis_results;
  END IF;
END $$;

-- Verify
SELECT schemaname, tablename
FROM   pg_publication_tables
WHERE  pubname = 'supabase_realtime'
  AND  schemaname = 'nse'
ORDER  BY tablename;
