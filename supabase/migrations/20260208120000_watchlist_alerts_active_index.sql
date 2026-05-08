-- Speed alert checks: active rows per user (matches check-alerts query pattern)
CREATE INDEX IF NOT EXISTS idx_watchlist_alerts_user_active_pending
  ON public.watchlist_alerts (user_id)
  WHERE is_active = true AND triggered_at IS NULL;
