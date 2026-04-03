
-- Table to cache search results across users
CREATE TABLE public.cached_search_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cache_key TEXT NOT NULL UNIQUE,
  search_type TEXT NOT NULL DEFAULT 'leads',
  search_config JSONB NOT NULL DEFAULT '{}',
  results JSONB NOT NULL DEFAULT '[]',
  results_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '7 days')
);

ALTER TABLE public.cached_search_results ENABLE ROW LEVEL SECURITY;

-- Authenticated users can read cache
CREATE POLICY "Authenticated users can read cache"
ON public.cached_search_results
FOR SELECT
TO authenticated
USING (true);

-- Add results column to search_logs for history viewing
ALTER TABLE public.search_logs ADD COLUMN IF NOT EXISTS results JSONB DEFAULT '[]';

-- Create index on cache_key for fast lookups
CREATE INDEX idx_cached_search_results_cache_key ON public.cached_search_results(cache_key);

-- Create index on expires_at for cleanup
CREATE INDEX idx_cached_search_results_expires ON public.cached_search_results(expires_at);

-- Create index on search_logs user_id + created_at for history queries
CREATE INDEX idx_search_logs_user_history ON public.search_logs(user_id, created_at DESC);
