-- Remove delisted / unavailable tickers from all nse tables.
-- ON DELETE CASCADE propagates to stock_prices, detected_events,
-- analysis_results, news_articles, financials, and watchlist entries.

DELETE FROM nse.companies
WHERE ticker IN ('BAMB', 'LIMURU');
