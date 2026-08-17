/**
 * PresenceEngine - Rastreamento de Usuários Online em Tempo Real
 * TEAM RT KANBAN
 *
 * Fluxo:
 *  1. onLogin(member)  → insere/atualiza registro em `active_sessions`
 *  2. Heartbeat a cada 60s → atualiza `last_seen`
 *  3. onLogout()       → remove o registro do Supabase
 *  4. renderOnlineUsers() → lista quem está online (só para admin)
 */

(function () {
  let heartbeatTimer = null;
  let presenceChannel = null;
  let currentSessionId = null;

  // ── Helpers ────────────────────────────────────────────────────────────────

  function getSupabase() {
    return window.DB?.supabase || window.DB?.client || null;
  }

  function buildSessionId(memberId) {
    // ID único por aba: memberId + timestamp de abertura da aba
    if (!currentSessionId) {
      currentSessionId = `${memberId}_${Date.now()}`;
    }
    return currentSessionId;
  }

  // ── Login: registra sessão ─────────────────────────────────────────────────

  async function onLogin(member) {
    const sb = getSupabase();
    if (!sb || !member?.id) return;

    const sessionId = buildSessionId(member.id);

    try {
      await sb.from('active_sessions').upsert({
        id: sessionId,
        member_id: String(member.id),
        member_name: member.name || 'Desconhecido',
        member_photo: member.photo || '',
        member_role: member.role || '',
        access_level: member.accessLevel || 'colaborador',
        login_at: new Date().toISOString(),
        last_seen: new Date().toISOString(),
      }, { onConflict: 'id' });
    } catch (err) {
      console.warn('[Presence] Erro ao registrar sessão:', err);
    }

    // Inicia heartbeat
    _startHeartbeat(sessionId);
  }

  // ── Heartbeat: atualiza last_seen a cada 60s ──────────────────────────────

  function _startHeartbeat(sessionId) {
    if (heartbeatTimer) clearInterval(heartbeatTimer);

    heartbeatTimer = setInterval(async () => {
      const sb = getSupabase();
      if (!sb) return;
      try {
        await sb.from('active_sessions')
          .update({ last_seen: new Date().toISOString() })
          .eq('id', sessionId);
      } catch (err) {
        console.warn('[Presence] Heartbeat falhou:', err);
      }
    }, 60_000);
  }

  // ── Logout: remove sessão ─────────────────────────────────────────────────

  async function onLogout() {
    if (heartbeatTimer) {
      clearInterval(heartbeatTimer);
      heartbeatTimer = null;
    }

    const sb = getSupabase();
    if (!sb || !currentSessionId) return;

    try {
      await sb.from('active_sessions').delete().eq('id', currentSessionId);
    } catch (err) {
      console.warn('[Presence] Erro ao remover sessão:', err);
    }

    currentSessionId = null;
  }

  // ── Renderização no Painel Admin ──────────────────────────────────────────

  async function renderOnlineUsers() {
    const container = document.getElementById('admin-tab-online-container');
    if (!container) return;

    container.innerHTML = `
      <div style="display:flex; align-items:center; gap:8px; color:var(--text-muted); font-size:0.82rem; padding:1rem;">
        <span style="width:10px; height:10px; border-radius:50%; background:#10b981; display:inline-block; animation: pulse-green 1.5s infinite;"></span>
        Carregando sessões ativas…
      </div>`;

    const sb = getSupabase();
    if (!sb) {
      container.innerHTML = `<p style="color:#ef4444; font-size:0.85rem; padding:1rem;">Supabase indisponível.</p>`;
      return;
    }

    const _render = async () => {
      try {
        // Considera online quem foi visto nos últimos 3 minutos
        const cutoff = new Date(Date.now() - 3 * 60_000).toISOString();
        const { data: sessions, error } = await sb
          .from('active_sessions')
          .select('*')
          .gte('last_seen', cutoff)
          .order('login_at', { ascending: false });

        if (error) throw error;

        if (!sessions || sessions.length === 0) {
          container.innerHTML = `
            <div style="text-align:center; padding:2rem; color:var(--text-muted); font-size:0.85rem;">
              🔇 Nenhum usuário conectado agora.
            </div>`;
          return;
        }

        const levelBadge = (level) => {
          const map = {
            admin:       { label: 'Admin',        color: '#f59e0b' },
            gestor:      { label: 'Gestor',        color: '#818cf8' },
            colaborador: { label: 'Colaborador',   color: '#10b981' },
          };
          const b = map[level] || map.colaborador;
          return `<span style="font-size:0.68rem; font-weight:700; color:${b.color}; background:${b.color}22; border:1px solid ${b.color}44; border-radius:4px; padding:1px 6px;">${b.label}</span>`;
        };

        const formatTime = (iso) => {
          if (!iso) return '-';
          return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
        };

        const formatLastSeen = (iso) => {
          if (!iso) return '-';
          const diffMs = Date.now() - new Date(iso).getTime();
          const diffMin = Math.floor(diffMs / 60_000);
          if (diffMin < 1) return '🟢 agora';
          if (diffMin < 3) return `🟡 há ${diffMin}min`;
          return `🔴 há ${diffMin}min`;
        };

        container.innerHTML = `
          <div style="margin-bottom:0.75rem; display:flex; align-items:center; gap:8px;">
            <span style="width:10px; height:10px; border-radius:50%; background:#10b981; display:inline-block; flex-shrink:0;
              box-shadow: 0 0 0 0 rgba(16,185,129,1); animation: pulse-green 1.5s infinite;"></span>
            <span style="font-size:0.82rem; color:#10b981; font-weight:700;">${sessions.length} usuário(s) conectado(s)</span>
            <button id="btn-refresh-online" style="margin-left:auto; background:rgba(99,102,241,0.15); color:#818cf8; border:1px solid rgba(99,102,241,0.3); border-radius:6px; padding:2px 10px; font-size:0.72rem; cursor:pointer; font-weight:700;">↻ Atualizar</button>
          </div>

          <div style="display:flex; flex-direction:column; gap:0.6rem; max-height:320px; overflow-y:auto; padding-right:0.25rem;">
            ${sessions.map(s => `
              <div style="display:flex; align-items:center; gap:0.75rem; background:rgba(255,255,255,0.03); border:1px solid var(--border-color); border-radius:10px; padding:0.6rem 0.9rem;">
                <div style="position:relative; flex-shrink:0;">
                  <img src="${s.member_photo || `https://ui-avatars.com/api/?name=${encodeURIComponent(s.member_name)}&background=1f2937&color=fff`}"
                    style="width:36px; height:36px; border-radius:50%; object-fit:cover; border:2px solid #10b981;"
                    onerror="this.src='https://ui-avatars.com/api/?name=${encodeURIComponent(s.member_name)}&background=1f2937&color=fff'">
                  <span style="position:absolute; bottom:0; right:0; width:10px; height:10px; background:#10b981; border-radius:50%; border:2px solid var(--bg-card);"></span>
                </div>
                <div style="flex:1; min-width:0;">
                  <div style="font-weight:700; font-size:0.88rem; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
                    ${s.member_name}
                  </div>
                  <div style="font-size:0.73rem; color:var(--text-muted); margin-top:1px;">
                    ${s.member_role || '—'}
                  </div>
                </div>
                <div style="text-align:right; flex-shrink:0;">
                  <div style="margin-bottom:3px;">${levelBadge(s.access_level)}</div>
                  <div style="font-size:0.7rem; color:var(--text-muted);">Entrou: ${formatTime(s.login_at)}</div>
                  <div style="font-size:0.7rem; margin-top:1px;">${formatLastSeen(s.last_seen)}</div>
                </div>
              </div>
            `).join('')}
          </div>
        `;

        document.getElementById('btn-refresh-online')?.addEventListener('click', _render);

      } catch (err) {
        console.warn('[Presence] Erro ao buscar sessões:', err);
        container.innerHTML = `<p style="color:#ef4444; font-size:0.82rem; padding:1rem;">Erro ao carregar sessões ativas.</p>`;
      }
    };

    await _render();

    // Realtime: re-renderiza quando há mudança na tabela active_sessions
    if (presenceChannel) {
      try { getSupabase()?.removeChannel(presenceChannel); } catch (_) {}
    }
    presenceChannel = sb
      .channel('admin-presence-watch')
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'active_sessions' },
        () => _render()
      )
      .subscribe();
  }

  // ── API Pública ────────────────────────────────────────────────────────────

  window.PresenceEngine = {
    onLogin,
    onLogout,
    renderOnlineUsers,
  };
})();
