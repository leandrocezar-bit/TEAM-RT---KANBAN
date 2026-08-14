/**
 * NavigationEngine - Módulo de Navegação e Ordem do Menu por Usuário
 * TEAM RT KANBAN
 */

(function () {
  const DEFAULT_MENU_ORDER = [
    'btn-view-kanban',
    'btn-view-manager',
    'btn-view-map',
    'btn-new-task',
    'btn-view-settings',
    'btn-view-projects',
    'btn-view-chat',
    'btn-view-ai',
    'btn-view-admin',
  ];

  const MENU_LABELS = {
    'btn-view-kanban': 'Quadro Kanban',
    'btn-view-manager': 'Dashboard',
    'btn-view-map': 'Portfólio do Setor',
    'btn-new-task': 'Nova Atividade',
    'btn-view-settings': 'Transferir Atividades',
    'btn-view-projects': 'Projetos',
    'btn-view-chat': 'Chat Geral',
    'btn-view-ai': 'Assistente IA',
    'btn-view-admin': 'Painel Admin',
  };

  function getUserMenuOrder() {
    const loggedId = window.getLoggedMemberId ? window.getLoggedMemberId() : 'default';
    try {
      const saved = localStorage.getItem(`user_menu_order_${loggedId}`);
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    return [...DEFAULT_MENU_ORDER];
  }

  function applyUserMenuOrder() {
    const navContainer = document.querySelector('.nav-actions');
    if (!navContainer) return;

    const currentOrder = getUserMenuOrder();

    currentOrder.forEach((btnId) => {
      const btn = document.getElementById(btnId);
      if (btn) {
        navContainer.appendChild(btn);
      }
    });

    DEFAULT_MENU_ORDER.forEach((btnId) => {
      const btn = document.getElementById(btnId);
      if (btn && !navContainer.contains(btn)) {
        navContainer.appendChild(btn);
      }
    });

    const btnViewAdmin = document.getElementById('btn-view-admin');
    if (btnViewAdmin && window.isAdmin) {
      btnViewAdmin.style.display = window.isAdmin() ? 'inline-flex' : 'none';
    }
  }

  function saveUserMenuOrder(orderArray) {
    const loggedId = window.getLoggedMemberId ? window.getLoggedMemberId() : 'default';
    localStorage.setItem(`user_menu_order_${loggedId}`, JSON.stringify(orderArray));
    applyUserMenuOrder();
  }

  function resetUserMenuOrder() {
    const loggedId = window.getLoggedMemberId ? window.getLoggedMemberId() : 'default';
    localStorage.removeItem(`user_menu_order_${loggedId}`);
    applyUserMenuOrder();
  }

  window.NavigationEngine = {
    DEFAULT_MENU_ORDER,
    MENU_LABELS,
    getUserMenuOrder,
    applyUserMenuOrder,
    saveUserMenuOrder,
    resetUserMenuOrder,
  };

  // Exposição global para retrocompatibilidade
  window.DEFAULT_MENU_ORDER = DEFAULT_MENU_ORDER;
  window.MENU_LABELS = MENU_LABELS;
  window.getUserMenuOrder = getUserMenuOrder;
  window.applyUserMenuOrder = applyUserMenuOrder;
})();
