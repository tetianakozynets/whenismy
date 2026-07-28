-- The cron jobs call net.http_post(...) to invoke Edge Functions, but pg_net
-- was never enabled on this project — confirmed via pg_extension on the
-- live project (only pgcrypto/pg_cron/pg_stat_statements/uuid-ossp/vault
-- were present). Every cron run has been failing with
-- "schema net does not exist", independent of and in addition to the
-- Vault auth fix in 20260728000010_cron_vault_auth.sql.

create extension if not exists pg_net;
