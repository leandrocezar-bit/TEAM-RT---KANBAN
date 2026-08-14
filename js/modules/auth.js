/**
 * AuthEngine - Simplified module (no advanced security)
 * TEAM RT KANBAN
 */

(function () {
  // Simple access level helpers
  function getLoggedAccessLevel() {
    return localStorage.getItem('logged_access_level') || 'colaborador';
  }

  function isManager() {
    const level = getLoggedAccessLevel();
    return level === 'gestor' || level === 'admin';
  }

  function isAdmin() {
    return getLoggedAccessLevel() === 'admin';
  }

  function getLoggedMemberId() {
    return localStorage.getItem('logged_member_id');
  }

  function checkAuthentication() {
    const isAuth = localStorage.getItem('app_authenticated');
    const loginOverlay = document.getElementById('login-overlay');
    const btnViewAdmin = document.getElementById('btn-view-admin');

    if (isAuth === 'true') {
      if (loginOverlay) {
        loginOverlay.classList.remove('active');
        loginOverlay.style.setProperty('display', 'none', 'important');
      }
      if (btnViewAdmin) {
        btnViewAdmin.style.display = isAdmin() ? 'inline-flex' : 'none';
      }
      if (window.NavigationEngine) {
        window.NavigationEngine.applyUserMenuOrder();
      }
      if (window.ChatEngine && typeof window.ChatEngine.startAutoSync === 'function') {
        window.ChatEngine.startAutoSync();
      }
      setupAdminRealtimeListener();
    } else {
      if (loginOverlay) {
        loginOverlay.classList.add('active');
        loginOverlay.style.display = 'flex';
      }
      if (btnViewAdmin) {
        btnViewAdmin.style.display = 'none';
      }
    }
  }

  function setupAdminRealtimeListener() {
    if (!window.DB || !window.DB.supabase) return;
    if (window.adminRealtimeChannel) return;

    window.adminRealtimeChannel = window.DB.supabase
      .channel('system_admin_events')
      .on('broadcast', { event: 'FORCE_LOGOUT_ALL' }, (payload) => {
        console.log('🔴 Broadcast de Deslogamento em Tempo Real recebido:', payload);
        const loggedId = getLoggedMemberId();
        const level = getLoggedAccessLevel();
        if (payload && payload.targetMemberId) {
          if (String(loggedId) === String(payload.targetMemberId)) {
            performLogout('Você foi deslogado pelo Administrador do sistema.');
          }
        } else if (payload && payload.targetRole) {
          if (level === payload.targetRole) {
            performLogout(`Todos os usuários do nível ${payload.targetRole} foram deslogados pelo Administrador.`);
          }
        } else {
          performLogout('O Administrador encerrou a sessão de todos os usuários do sistema.');
        }
      })
      .subscribe();
  }

  function performLogout(message = 'Você saiu do aplicativo.') {
    if (window.DB && window.DB.supabase && window.activeNotificationChannel) {
      window.DB.supabase.removeChannel(window.activeNotificationChannel);
      window.activeNotificationChannel = null;
    }
    localStorage.removeItem('app_authenticated');
    localStorage.removeItem('logged_member_id');
    localStorage.removeItem('logged_access_level');
    checkAuthentication();
    if (window.showToast) {
      window.showToast(message, 'info');
    }
  }

  // Export simplified API
  window.AuthEngine = {
    getLoggedAccessLevel,
    isManager,
    isAdmin,
    getLoggedMemberId,
    checkAuthentication,
    setupAdminRealtimeListener,
    performLogout,
  };
})();
