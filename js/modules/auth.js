/**
 * AuthEngine - Módulo de Autenticação, Criptografia, Sanitização e Sessão Segura
 * TEAM RT KANBAN
 */

(function () {
  let inactivityTimer = null;
  const INACTIVITY_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutos

  /**
   * Sanitiza entradas de texto para evitar vulnerabilidades Cross-Site Scripting (XSS)
   */
  function sanitizeHTML(str) {
    if (typeof str !== 'string') return str;
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  /**
   * Gera o Hash SHA-256 seguro de uma senha usando a API Web Crypto nativa do navegador
   */
  async function hashPassword(plainText) {
    if (!plainText) return '';
    const encoder = new TextEncoder();
    const data = encoder.encode(plainText);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  }

  /**
   * Valida a senha informada contra a senha armazenada no banco
   * Suporta migração automática transparente de senhas legadas em texto plano para SHA-256
   */
  async function verifyPassword(inputPlain, storedPassword, memberObj = null) {
    if (!inputPlain || !storedPassword) return false;

    const inputHash = await hashPassword(inputPlain);

    // 1. Caso a senha salva já esteja em Hash SHA-256 (64 caracteres hexadecimais)
    if (storedPassword === inputHash) {
      return true;
    }

    // 2. Caso legado: senha em texto simples no banco
    if (storedPassword === inputPlain) {
      // Atualiza automaticamente a senha no banco para Hash SHA-256
      if (memberObj && window.DB) {
        try {
          memberObj.password = inputHash;
          await window.DB.save('members', memberObj);
          console.log(`🔒 Senha do membro ${memberObj.name} migrada automaticamente para Hash SHA-256.`);
        } catch (e) {
          console.error('Erro ao migrar senha para hash:', e);
        }
      }
      return true;
    }

    return false;
  }

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

  function resetInactivityTimer() {
    if (inactivityTimer) clearTimeout(inactivityTimer);

    const isAuth = localStorage.getItem('app_authenticated');
    if (isAuth === 'true') {
      inactivityTimer = setTimeout(() => {
        performLogout('Sessão encerrada por inatividade (30 minutos sem uso).');
      }, INACTIVITY_TIMEOUT_MS);
    }
  }

  function initInactivityListeners() {
    ['mousemove', 'keydown', 'click', 'touchstart'].forEach((eventName) => {
      window.addEventListener(eventName, resetInactivityTimer, { passive: true });
    });
    resetInactivityTimer();
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
      resetInactivityTimer();
    } else {
      if (loginOverlay) {
        loginOverlay.classList.add('active');
        loginOverlay.style.display = 'flex';
      }
      if (btnViewAdmin) {
        btnViewAdmin.style.display = 'none';
      }
      if (inactivityTimer) clearTimeout(inactivityTimer);
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

    if (inactivityTimer) clearTimeout(inactivityTimer);

    checkAuthentication();
    if (window.showToast) {
      window.showToast(message, 'info');
    }
  }

  // Inicializa detectores de inatividade
  initInactivityListeners();

  window.AuthEngine = {
    sanitizeHTML,
    hashPassword,
    verifyPassword,
    isManager,
    isAdmin,
    getLoggedMemberId,
    getLoggedAccessLevel,
    checkAuthentication,
    setupAdminRealtimeListener,
    performLogout,
  };

  // Exposição global para retrocompatibilidade
  window.sanitizeHTML = sanitizeHTML;
  window.hashPassword = hashPassword;
  window.verifyPassword = verifyPassword;
  window.isManager = isManager;
  window.isAdmin = isAdmin;
  window.getLoggedMemberId = getLoggedMemberId;
  window.checkAuthentication = checkAuthentication;
})();
