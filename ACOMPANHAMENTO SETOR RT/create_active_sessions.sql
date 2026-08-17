-- ============================================================
-- TABELA: active_sessions
-- Rastreia usuários conectados em tempo real.
-- Execute este SQL no painel do Supabase:
-- Dashboard > SQL Editor > New Query
-- ============================================================

CREATE TABLE IF NOT EXISTS public.active_sessions (
  id            TEXT        PRIMARY KEY,         -- memberId_timestamp (único por aba)
  member_id     TEXT        NOT NULL,
  member_name   TEXT        NOT NULL,
  member_photo  TEXT        DEFAULT '',
  member_role   TEXT        DEFAULT '',
  access_level  TEXT        DEFAULT 'colaborador',
  login_at      TIMESTAMPTZ DEFAULT NOW(),
  last_seen     TIMESTAMPTZ DEFAULT NOW()
);

-- Índice para buscas por last_seen (filtro de "online nos últimos 3 min")
CREATE INDEX IF NOT EXISTS idx_active_sessions_last_seen
  ON public.active_sessions (last_seen DESC);

-- Row Level Security: desabilitado (dados não sensíveis, só nomes e fotos)
ALTER TABLE public.active_sessions DISABLE ROW LEVEL SECURITY;

-- Limpeza automática de sessões antigas (> 10 minutos sem heartbeat)
-- Rode esta função no Supabase Cron ou manualmente quando necessário:
-- DELETE FROM public.active_sessions WHERE last_seen < NOW() - INTERVAL '10 minutes';

-- Habilitar Realtime para a tabela (necessário para atualização automática)
-- Vá em: Database > Replication > Tables > ative active_sessions
