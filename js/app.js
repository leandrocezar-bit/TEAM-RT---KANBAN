/**
 * Controladora Principal do Aplicativo Kanban de Equipe (App Core Controller)
 */

import { DB } from './db.js?v=32';
import { TimerEngine } from './timer.js?v=32';
import { KanbanEngine } from './kanban.js?v=32';
import { ManagerEngine } from './manager.js?v=32';
import { MapEngine } from './map.js?v=32';
import { SettingsEngine } from './settings.js?v=32';
import { ProjectsEngine } from './projects.js?v=32';
import { UndoEngine } from './undo.js?v=32';
import { ChatEngine } from './chat.js?v=32';
import { AIEngine } from './ai.js?v=32';

document.addEventListener('DOMContentLoaded', async () => {

  let activeView = 'kanban';
  let currentMemberFilter = 'all';
  let reportingTaskId = null;

  // ============================================================
  // AUTENTICAÇÃO E SESSÃO
  // ============================================================

  const loginOverlay = document.getElementById('login-overlay');
  const formLogin = document.getElementById('form-login');

  function isManager() {
    const level = localStorage.getItem('logged_access_level');
    return level === 'gestor' || level === 'admin';
  }

  function isAdmin() {
    return localStorage.getItem('logged_access_level') === 'admin';
  }

  function getLoggedMemberId() {
    return localStorage.getItem('logged_member_id');
  }

  function checkAuthentication() {
    const isAuth = localStorage.getItem('app_authenticated');
    const btnViewAdmin = document.getElementById('btn-view-admin');

    if (isAuth === 'true') {
      if (loginOverlay) {
        loginOverlay.classList.remove('active');
        loginOverlay.style.setProperty('display', 'none', 'important');
      }
      const loggedId = getLoggedMemberId();
      if (loggedId && !isManager()) {
        currentMemberFilter = loggedId;
      }

      if (btnViewAdmin) {
        btnViewAdmin.style.display = isAdmin() ? 'inline-flex' : 'none';
      }

      // Inicia a escuta de chat em segundo plano e escuta de eventos admin
      ChatEngine.startAutoSync();
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
    if (!DB.supabase) return;
    if (window.adminRealtimeChannel) return;

    window.adminRealtimeChannel = DB.supabase
      .channel('system_admin_events')
      .on('broadcast', { event: 'FORCE_LOGOUT_ALL' }, (payload) => {
        console.log('🔴 Broadcast de Deslogamento em Tempo Real recebido:', payload);
        const loggedId = getLoggedMemberId();
        const level = localStorage.getItem('logged_access_level');

        if (level !== 'admin' && String(payload.payload?.adminId) !== String(loggedId)) {
          localStorage.removeItem('app_authenticated');
          localStorage.removeItem('logged_member_id');
          localStorage.removeItem('logged_access_level');

          checkAuthentication();
          showToast(`⚠️ Sua sessão foi encerrada pelo Administrador (${payload.payload?.adminName || 'Admin'}).`, 'warning');
        }
      })
      .subscribe();
  }

  // ============================================================
  // ESCUTA DE NOTIFICAÇÕES EM TEMPO REAL (SUPABASE REALTIME)
  // ============================================================

  function setupRealtimeNotifications() {
    const loggedMemberId = getLoggedMemberId();
    if (!loggedMemberId || !DB.supabase) return;

    if (window.activeNotificationChannel) {
      DB.supabase.removeChannel(window.activeNotificationChannel);
    }

    window.activeNotificationChannel = DB.supabase
      .channel('realtime-activity-transfers')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'activity_transfers'
        },
        async (payload) => {
          console.log('📦 Transferência capturada no Realtime:', payload.new);

          const targetMemberId = payload.new?.to_member_id;

          if (targetMemberId && String(targetMemberId).trim() === String(loggedMemberId).trim()) {
            showToast('⚡ Você recebeu uma nova solicitação de transferência!', 'warning');
            await refreshUI();
          }
        }
      )
      .subscribe((status) => {
        console.log('📡 Status da Conexão Realtime:', status);
      });
  }

  // ============================================================
  // GERENCIADOR DE TEMAS (ESCURO / CLARO NA TELA DE LOGIN)
  // ============================================================
  function applyAppTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    document.body.setAttribute('data-theme', theme);
    localStorage.setItem('app_theme', theme);

    const isLight = theme === 'light';

    // Atualiza botão da tela de login
    const themeIconLogin = document.getElementById('theme-toggle-icon');
    const themeLabelLogin = document.getElementById('theme-toggle-label');
    if (themeIconLogin) themeIconLogin.textContent = isLight ? '☀️' : '🌙';
    if (themeLabelLogin) themeLabelLogin.textContent = isLight ? 'Modo Claro' : 'Modo Escuro';

    // Atualiza visual da tela de login se ela existir
    const loginOverlay = document.getElementById('login-overlay');
    if (loginOverlay) {
      loginOverlay.style.background = isLight
        ? 'linear-gradient(180deg, #f8fafc 0%, #cbd5e1 100%)'
        : 'linear-gradient(180deg, #1a1a1a 0%, #0d0d0d 100%)';
    }
  }

  function toggleCurrentTheme() {
    const currentTheme = document.documentElement.getAttribute('data-theme') || 'dark';
    const nextTheme = currentTheme === 'dark' ? 'light' : 'dark';
    applyAppTheme(nextTheme);
  }

  // Inicializa tema salvo
  const savedTheme = localStorage.getItem('app_theme') || 'dark';
  applyAppTheme(savedTheme);

  const btnThemeLogin = document.getElementById('btn-toggle-theme-login');
  if (btnThemeLogin) btnThemeLogin.addEventListener('click', toggleCurrentTheme);

  const btnTogglePass = document.getElementById('btn-toggle-passcode');
  const inputPasscode = document.getElementById('input-passcode');
  if (btnTogglePass && inputPasscode) {
    btnTogglePass.addEventListener('click', () => {
      const isPass = inputPasscode.type === 'password';
      inputPasscode.type = isPass ? 'text' : 'password';
    });
  }

  if (formLogin) {
    formLogin.addEventListener('submit', async (e) => {
      e.preventDefault();

      const inputUser = document.getElementById('input-login-user').value.trim().toLowerCase();
      const inputPassword = document.getElementById('input-passcode').value.trim();

      if (!inputUser || !inputPassword) {
        showToast('Informe usuário/e-mail e senha para entrar.', 'warning');
        return;
      }

      // Busca a lista atualizada de colaboradores na tabela 'members' do Supabase
      const members = (await DB.getAll('members', { forceRefresh: true })) || [];

      // Procura o colaborador por e-mail, nome completo ou primeiro nome
      let matchedMember = members.find((m) => {
        const memEmail = m.email ? String(m.email).trim().toLowerCase() : '';
        const memName = m.name ? String(m.name).trim().toLowerCase() : '';
        const firstName = memName.split(' ')[0].toLowerCase();
        return (
          memEmail === inputUser ||
          memName === inputUser ||
          firstName === inputUser ||
          (memEmail && inputUser.includes(memEmail))
        );
      });

      // 1. REGRA DE SEGURANÇA: Só entra quem está cadastrado na tabela 'members'
      if (!matchedMember) {
        showToast('❌ Acesso negado: Usuário não cadastrado na tabela de colaboradores.', 'warning');
        return;
      }

      // 2. REGRA DE SEGURANÇA DE SENHA: A senha DEVE coincidir exatamente com a da tabela
      const registeredPassword = matchedMember.password ? String(matchedMember.password).trim() : null;

      if (registeredPassword) {
        if (registeredPassword !== inputPassword) {
          showToast('❌ Senha incorreta! Verifique sua senha de acesso.', 'warning');
          return;
        }
      } else {
        // Se o colaborador não possuía senha gravada na tabela, vincula a senha informada
        matchedMember.password = inputPassword;
        try {
          await DB.save('members', matchedMember);
        } catch (err) {
          console.warn('Erro ao registrar senha do colaborador:', err);
        }
      }

      let accessLevel = 'colaborador';
      if (matchedMember.accessLevel === 'admin' || (matchedMember.role && matchedMember.role.toLowerCase().includes('admin')) || matchedMember.name.toLowerCase().includes('admin')) {
        accessLevel = 'admin';
      } else if (matchedMember.accessLevel === 'gestor' || (matchedMember.role && matchedMember.role.toLowerCase().includes('gestor'))) {
        accessLevel = 'gestor';
      }

      localStorage.setItem('app_authenticated', 'true');
      localStorage.setItem('logged_member_id', matchedMember.id);
      localStorage.setItem('logged_access_level', accessLevel);
      localStorage.setItem('logged_member_name', matchedMember.name);

      currentMemberFilter = (accessLevel === 'gestor' || accessLevel === 'admin') ? 'all' : matchedMember.id;
      activeView = 'kanban';

      checkAuthentication();
      setupRealtimeNotifications();
      showToast(`Bem-vindo(a), ${matchedMember.name}!`, 'success');
      await refreshUI();
    });
  }

  const btnProfileMenu = document.getElementById('btn-user-profile-menu');
  const userProfileDropdown = document.getElementById('user-profile-dropdown');

  if (btnProfileMenu && userProfileDropdown) {
    btnProfileMenu.addEventListener('click', (e) => {
      e.stopPropagation();
      const isVisible = userProfileDropdown.style.display === 'block';
      userProfileDropdown.style.display = isVisible ? 'none' : 'block';
    });

    document.addEventListener('click', (e) => {
      if (!userProfileDropdown.contains(e.target) && !btnProfileMenu.contains(e.target)) {
        userProfileDropdown.style.display = 'none';
      }
    });
  }

  const btnLogout = document.getElementById('btn-logout');
  if (btnLogout) {
    btnLogout.addEventListener('click', () => {
      if (userProfileDropdown) userProfileDropdown.style.display = 'none';

      if (window.activeNotificationChannel && DB.supabase) {
        DB.supabase.removeChannel(window.activeNotificationChannel);
      }

      localStorage.removeItem('app_authenticated');
      localStorage.removeItem('logged_member_id');
      localStorage.removeItem('logged_access_level');

      currentMemberFilter = 'all';
      activeView = 'kanban';

      checkAuthentication();
      showToast('Você saiu do aplicativo.', 'info');
    });
  }

  // ============================================================
  // INICIALIZA BANCO E VERIFICA ACESSO
  // ============================================================

  await DB.init();
  checkAuthentication();
  setupRealtimeNotifications();

  // ============================================================
  // ELEMENTOS DE INTERFACE E SEÇÕES
  // ============================================================

  const btnNewMember = document.getElementById('btn-new-member');
  const btnNewTask = document.getElementById('btn-new-task');

  const btnViewKanban = document.getElementById('btn-view-kanban');
  const btnViewManager = document.getElementById('btn-view-manager');
  const btnViewMap = document.getElementById('btn-view-map');
  const btnViewSettings = document.getElementById('btn-view-settings');
  const btnViewProjects = document.getElementById('btn-view-projects');
  const btnViewChat = document.getElementById('btn-view-chat');
  const btnViewAI = document.getElementById('btn-view-ai');
  const btnResetDb = document.getElementById('btn-reset-db');

  // ============================================================
  // RESET DATABASE
  // ============================================================

  if (btnResetDb) {
    btnResetDb.addEventListener('click', async () => {
      if (!isManager()) {
        showToast('Apenas gestores podem restaurar os dados.', 'warning');
        return;
      }

      if (
        confirm(
          'Deseja realmente restaurar os dados iniciais padrão no Supabase/App?'
        )
      ) {
        await DB.resetDatabase();
        currentMemberFilter = 'all';
        showToast('Dados iniciais restaurados com sucesso!', 'success');
        await refreshUI();
      }
    });
  }

  // ============================================================
  // SEÇÕES E MODAIS
  // ============================================================

  const sectionKanban = document.getElementById('section-kanban');
  const sectionManager = document.getElementById('section-manager');
  const sectionMap = document.getElementById('section-map');
  const sectionSettings = document.getElementById('section-settings');
  const sectionProjects = document.getElementById('section-projects');
  const sectionChat = document.getElementById('section-chat');
  const sectionAI = document.getElementById('section-ai');

  const modalMember = document.getElementById('modal-member');
  const modalEditProfile = document.getElementById('modal-edit-profile');
  const modalTask = document.getElementById('modal-task');
  const modalTaskDetails = document.getElementById('modal-task-details');
  const modalImpediment = document.getElementById('modal-impediment');
  const modalEvidence = document.getElementById('modal-evidence');
  const modalCalendarDay = document.getElementById('modal-calendar-day');
  const modalProject = document.getElementById('modal-project');
  const modalTaskGroup = document.getElementById('modal-task-group');

  const formMember = document.getElementById('form-member');
  const formEditProfile = document.getElementById('form-edit-profile');
  const formTask = document.getElementById('form-task');
  const formImpediment = document.getElementById('form-impediment');
  const formProject = document.getElementById('form-project');

  // ============================================================
  // FUNÇÕES HELPER PARA COLUNAS DO SUPABASE
  // ============================================================

  function getTransferFromMemberId(transfer) {
    return transfer.from_member_id || transfer.fromMemberId;
  }

  function getTransferToMemberId(transfer) {
    return transfer.to_member_id || transfer.toMemberId;
  }

  function getTransferTaskId(transfer) {
    return transfer.task_id || transfer.taskId;
  }

  function openModal(modal) {
    if (modal) {
      modal.classList.add('active');
      modal.style.display = 'flex';
    }
  }

  function closeModal(modal) {
    if (modal) {
      modal.classList.remove('active');
      modal.style.display = 'none';
    }
  }

  document.querySelectorAll('.modal-close, .btn-modal-cancel').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      const modal = e.target.closest('.modal-overlay');
      closeModal(modal);
    });
  });

  // ============================================================
  // REFRESH UI E ROTEAMENTO DE TELAS
  // ============================================================

  async function updateHeaderUserProfile() {
    const loggedId = getLoggedMemberId();
    if (!loggedId) return;

    const members = (await DB.getAll('members')) || [];
    const loggedMember = members.find((m) => String(m.id) === String(loggedId));

    if (loggedMember) {
      const avatarEl = document.getElementById('user-avatar');
      const nameEl = document.getElementById('user-name');

      if (nameEl) nameEl.textContent = loggedMember.name;
      if (avatarEl) {
        avatarEl.src =
          loggedMember.photo ||
          `https://ui-avatars.com/api/?name=${encodeURIComponent(loggedMember.name)}&background=6366f1&color=fff`;
      }
    }
  }

  async function refreshUI() {
    const loggedId = getLoggedMemberId();
    const manager = isManager();

    await updateHeaderUserProfile();

    const managerOnlyButtons = [btnNewMember, btnResetDb];
    managerOnlyButtons.forEach((btn) => {
      if (btn) {
        btn.style.display = manager ? 'inline-block' : 'none';
      }
    });

    [btnViewKanban, btnViewManager, btnViewMap, btnViewSettings, btnViewProjects, btnViewChat, btnViewAI, btnNewTask].forEach(btn => {
      if (btn) btn.style.display = 'inline-block';
    });

    [btnViewKanban, btnViewManager, btnViewMap, btnViewSettings, btnViewProjects, btnViewChat, btnViewAI].forEach(btn => {
      if (btn) {
        btn.classList.remove('btn-primary');
        btn.classList.add('btn-secondary');
      }
    });

    [sectionKanban, sectionManager, sectionMap, sectionSettings, sectionProjects, sectionChat, sectionAI].forEach(sec => {
      if (sec) {
        sec.classList.remove('active');
        sec.style.display = 'none';
      }
    });

    await renderMemberTabs();
    await renderTopNotificationBar();

    if (activeView === 'kanban') {
      if (sectionKanban) { sectionKanban.classList.add('active'); sectionKanban.style.display = 'block'; }
      if (btnViewKanban) {
        btnViewKanban.classList.add('btn-primary');
        btnViewKanban.classList.remove('btn-secondary');
      }
      await KanbanEngine.renderBoard(currentMemberFilter, {
        onRefresh: refreshUI,
        onReportImpediment: openReportImpedimentModal,
        onOpenTaskDetails: openTaskDetailsModal,
      });
    } else if (activeView === 'manager') {
      if (sectionManager) { sectionManager.classList.add('active'); sectionManager.style.display = 'block'; }
      if (btnViewManager) {
        btnViewManager.classList.add('btn-primary');
        btnViewManager.classList.remove('btn-secondary');
      }
      await ManagerEngine.renderDashboard(
        openEvidenceModal,
        handleDeleteMember,
        openCalendarDayModal
      );
    } else if (activeView === 'map') {
      if (sectionMap) { sectionMap.classList.add('active'); sectionMap.style.display = 'block'; }
      if (btnViewMap) {
        btnViewMap.classList.add('btn-primary');
        btnViewMap.classList.remove('btn-secondary');
      }
      await MapEngine.renderSectorMap(currentMemberFilter);
    } else if (activeView === 'settings') {
      if (sectionSettings) { sectionSettings.classList.add('active'); sectionSettings.style.display = 'block'; }
      if (btnViewSettings) {
        btnViewSettings.classList.add('btn-primary');
        btnViewSettings.classList.remove('btn-secondary');
      }
      await SettingsEngine.renderSettingsSection(showToast, refreshUI, {
        isManager: manager,
        memberId: loggedId,
      });
    } else if (activeView === 'projects') {
      if (sectionProjects) { sectionProjects.classList.add('active'); sectionProjects.style.display = 'block'; }
      if (btnViewProjects) {
        btnViewProjects.classList.add('btn-primary');
        btnViewProjects.classList.remove('btn-secondary');
      }
      await ProjectsEngine.renderProjectsSection(showToast, refreshUI);
    } else if (activeView === 'chat') {
      if (sectionChat) { sectionChat.classList.add('active'); sectionChat.style.display = 'block'; }
      if (btnViewChat) {
        btnViewChat.classList.add('btn-primary');
        btnViewChat.classList.remove('btn-secondary');
      }
      await ChatEngine.renderChatSection();
    } else if (activeView === 'ai') {
      if (sectionAI) { sectionAI.classList.add('active'); sectionAI.style.display = 'block'; }
      if (btnViewAI) {
        btnViewAI.classList.add('btn-primary');
        btnViewAI.classList.remove('btn-secondary');
      }
      AIEngine.renderAISection();
    }
  }

  // Navegação
  if (btnViewManager) btnViewManager.addEventListener('click', () => { activeView = 'manager'; refreshUI(); });
  if (btnViewKanban) btnViewKanban.addEventListener('click', () => { activeView = 'kanban'; refreshUI(); });
  if (btnViewMap) btnViewMap.addEventListener('click', () => { activeView = 'map'; refreshUI(); });
  if (btnViewSettings) btnViewSettings.addEventListener('click', () => { activeView = 'settings'; refreshUI(); });
  if (btnViewProjects) btnViewProjects.addEventListener('click', () => { activeView = 'projects'; refreshUI(); });
  if (btnViewChat) btnViewChat.addEventListener('click', () => { activeView = 'chat'; refreshUI(); });
  if (btnViewAI) btnViewAI.addEventListener('click', () => { activeView = 'ai'; refreshUI(); });

  // ============================================================
  // BARRA DE NOTIFICAÇÕES (RECEBER/ACEITAR/RECUSAR TRANSFERÊNCIAS)
  // ============================================================

  async function renderTopNotificationBar() {
    const container = document.getElementById('top-notification-bar');
    const listEl = document.getElementById('top-notification-list');
    if (!container || !listEl) return;

    const loggedId = getLoggedMemberId();
    if (!loggedId) {
      container.style.display = 'none';
      return;
    }

    const transfers = (await DB.getAll('activity_transfers')) || [];
    const members = (await DB.getAll('members')) || [];
    const tasks = (await DB.getAll('tasks')) || [];

    const pendingTransfers = transfers.filter((t) => {
      const toId = getTransferToMemberId(t);
      return String(toId) === String(loggedId) && t.status === 'PENDENTE';
    });

    if (pendingTransfers.length === 0) {
      container.style.display = 'none';
      listEl.innerHTML = '';
      return;
    }

    container.style.display = 'block';

    listEl.innerHTML = pendingTransfers
      .map((t) => {
        const fromId = getTransferFromMemberId(t);
        const taskId = getTransferTaskId(t);

        const sender = members.find((m) => String(m.id) === String(fromId));
        const task = tasks.find((tk) => String(tk.id) === String(taskId));

        const senderName = sender ? sender.name : 'Um colega';
        const taskTitle = task ? task.title : 'Atividade';

        return `
          <div class="notification-item" style="display:flex; align-items:center; justify-content:space-between; gap:1rem; padding:0.5rem 0; border-bottom:1px solid rgba(255,255,255,0.1);">
            <span>⚡ <strong>${senderName}</strong> solicitou a transferência da atividade <strong>"${taskTitle}"</strong> para você.</span>
            <div style="display:flex; gap:0.5rem;">
              <button class="btn btn-primary btn-sm btn-accept-transfer" data-id="${t.id}">Aceitar</button>
              <button class="btn btn-secondary btn-sm btn-reject-transfer" data-id="${t.id}">Recusar</button>
            </div>
          </div>
        `;
      })
      .join('');

    listEl.onclick = async (e) => {
      const target = e.target;
      const transferId = target.dataset.id;
      if (!transferId) return;

      const transfer = transfers.find((t) => String(t.id) === String(transferId));
      if (!transfer) return;

      const now = new Date().toISOString();

      if (target.classList.contains('btn-accept-transfer')) {
        e.preventDefault();

        try {
          transfer.status = 'ACEITO';
          transfer.responded_at = now;
          await DB.save('activity_transfers', transfer);

          const taskId = getTransferTaskId(transfer);
          const toMemberId = getTransferToMemberId(transfer);
          const fromMemberId = getTransferFromMemberId(transfer);

          if (taskId && toMemberId) {
            const task = await DB.get('tasks', taskId);
            if (task) {
              task.member_id = toMemberId;
              task.memberId = toMemberId;
              await DB.save('tasks', task);
            }

            const groupMembers = (await DB.getAll('task_members')) || [];
            const oldBinding = groupMembers.find(
              (tm) => String(tm.taskId) === String(taskId) && String(tm.memberId) === String(fromMemberId)
            );

            if (oldBinding) {
              await DB.delete('task_members', oldBinding.id);
            }
          }

          showToast('Transferência de atividade aceita!', 'success');
        } catch (err) {
          console.error('❌ Erro ao aceitar:', err);
        }

        await refreshUI();
      }

      if (target.classList.contains('btn-reject-transfer')) {
        e.preventDefault();

        try {
          transfer.status = 'RECUSADO';
          transfer.responded_at = now;
          await DB.save('activity_transfers', transfer);

          showToast('Solicitação de transferência recusada.', 'info');
        } catch (err) {
          console.error('❌ Erro ao recusar:', err);
        }

        await refreshUI();
      }
    };
  }

  // ============================================================
  // SOLICITAR TRANSFERÊNCIA
  // ============================================================

  window.requestTaskTransfer = async function (taskId, toMemberId) {
    try {
      const fromMemberId = getLoggedMemberId();
      const cleanTaskId = String(taskId || '').trim();

      if (!cleanTaskId || cleanTaskId === 'null' || cleanTaskId === 'undefined') {
        showToast('Erro: ID da tarefa inválido para transferência.', 'warning');
        return;
      }

      const newTransfer = {
        id: 'tr-' + Date.now(),
        task_id: cleanTaskId,
        taskId: cleanTaskId,
        fromMemberId: fromMemberId,
        from_member_id: fromMemberId,
        toMemberId: toMemberId,
        to_member_id: toMemberId,
        status: 'PENDENTE',
        requested_at: new Date().toISOString(),
        responded_at: null
      };

      await DB.save('activity_transfers', newTransfer);
      showToast('Solicitação de transferência enviada com sucesso!', 'success');
      await refreshUI();
    } catch (err) {
      console.error('❌ Erro ao solicitar transferência:', err);
      showToast('Falha ao enviar solicitação de transferência.', 'warning');
    }
  };

  // ============================================================
  // SELECTS E RENDERIZAÇÃO DE EQUIPE/GRUPO DE MEMBROS
  // ============================================================

  function isAdminMember(m) {
    if (!m) return false;
    const id = String(m.id || '').toLowerCase();
    const name = String(m.name || '').toLowerCase();
    const email = String(m.email || '').toLowerCase();
    const role = String(m.role || '').toLowerCase();
    const level = String(m.accessLevel || '').toLowerCase();
    return level === 'admin' || id === 'm-admin' || id === 'admin' || name.includes('admin') || email.includes('admin') || role.includes('administrador');
  }

  async function renderTeamMembersCheckboxes(selectedMemberId, selectedTeamMemberIds = []) {
    const container = document.getElementById('task-team-members-container');
    if (!container) return;

    const allMembers = (await DB.getAll('members')) || [];
    const otherMembers = allMembers.filter((m) => String(m.id) !== String(selectedMemberId) && !isAdminMember(m));

    if (otherMembers.length === 0) {
      container.innerHTML = `<span style="font-size: 0.75rem; color: var(--text-dim);">Nenhum outro integrante disponível.</span>`;
      return;
    }

    container.innerHTML = otherMembers
      .map((m) => {
        const isChecked = selectedTeamMemberIds.map(String).includes(String(m.id));
        return `
          <label style="display: flex; align-items: center; gap: 0.5rem; font-size: 0.8rem; color: var(--text-main); cursor: pointer;">
            <input type="checkbox" class="chk-task-team-member" value="${m.id}" ${isChecked ? 'checked' : ''}>
            <span>${m.name} <small style="color: var(--text-dim);">(${m.role || 'Membro'})</small></span>
          </label>
        `;
      })
      .join('');
  }

  const selectTaskMember = document.getElementById('task-member');
  if (selectTaskMember) {
    selectTaskMember.addEventListener('change', (e) => {
      renderTeamMembersCheckboxes(e.target.value, []);
      checkTaskMemberAbsenceWarning();
    });
  }

  async function checkTaskMemberAbsenceWarning() {
    const memberId = document.getElementById('task-member')?.value;
    const dateStr = document.getElementById('task-date')?.value;
    const warningBanner = document.getElementById('absence-warning-banner');

    if (!memberId || !dateStr || !warningBanner) return;

    const absences = window.cachedAbsences || (await DB.getAll('member_absences')) || [];
    const members = (await DB.getAll('members')) || [];

    const activeAbsence = absences.find(
      (a) =>
        String(a.memberId || a.member_id) === String(memberId) &&
        a.startDate <= dateStr &&
        a.endDate >= dateStr
    );

    if (activeAbsence) {
      const member = members.find((m) => String(m.id) === String(memberId));
      const typeLabels = {
        home_office: '🏡 Home Office',
        ferias: '🏝️ Férias',
        atestado: '📄 Atestado Médico',
        folga: '🏖️ Folga / DSR',
        presencial: '🏢 Presencial',
      };
      const typeLabel = typeLabels[activeAbsence.type] || 'Ausência Ativa';
      const startFmt = activeAbsence.startDate ? activeAbsence.startDate.split('-').reverse().join('/') : '';
      const endFmt = activeAbsence.endDate ? activeAbsence.endDate.split('-').reverse().join('/') : '';

      warningBanner.style.display = 'block';
      warningBanner.innerHTML = `⚠️ <strong>Aviso:</strong> ${
        member ? member.name : 'Este colaborador'
      } estará de <strong>${typeLabel}</strong> neste período (${startFmt} a ${endFmt})!`;
    } else {
      warningBanner.style.display = 'none';
      warningBanner.innerHTML = '';
    }
  }

  const taskDateEl = document.getElementById('task-date');
  if (taskDateEl) {
    taskDateEl.addEventListener('change', checkTaskMemberAbsenceWarning);
  }

  async function populateTaskMemberSelect() {
    const select = document.getElementById('task-member');
    if (!select) return;

    const manager = isManager();
    const loggedId = getLoggedMemberId();
    const allMembers = (await DB.getAll('members')) || [];
    const members = window.sortMembersByCustomOrder(allMembers.filter(m => !isAdminMember(m)));

    select.innerHTML = members
      .map(
        (m) => `
          <option value="${m.id}" ${!manager && String(m.id) === String(loggedId) ? 'selected' : ''}>
            ${m.name} (${m.role || 'Membro'})
          </option>
        `
      )
      .join('');
  }

  async function populateTaskProjectSelect() {
    const select = document.getElementById('task-project');
    if (!select) return;

    const projects = (await DB.getAll('projects')) || [];

    select.innerHTML =
      `<option value="">-- Sem Projeto --</option>` +
      projects.map((p) => `<option value="${p.id}">${p.name}</option>`).join('');
  }

  async function renderMemberTabs() {
    const container = document.getElementById('member-tabs-bar');
    if (!container) return;

    if (!isManager()) {
      container.innerHTML = '';
      container.style.display = 'none';
      return;
    }

    container.style.display = 'flex';
    const allMembers = (await DB.getAll('members')) || [];
    const members = window.sortMembersByCustomOrder(allMembers.filter(m => !isAdminMember(m)));

    let html = `
      <button class="tab-btn ${currentMemberFilter === 'all' ? 'active' : ''}" data-id="all">
        👥 Todos os Membros
      </button>
    `;

    members.forEach((member) => {
      const isActive = String(currentMemberFilter) === String(member.id);
      html += `
        <button class="tab-btn ${isActive ? 'active' : ''}" data-id="${member.id}">
          <img src="${member.photo || 'https://ui-avatars.com/api/?name=' + encodeURIComponent(member.name)}" alt="${member.name}" class="tab-avatar">
          <span>${member.name.split(' ')[0]}</span>
        </button>
      `;
    });

    container.innerHTML = html;

    container.querySelectorAll('.tab-btn').forEach((btn) => {
      btn.addEventListener('click', async () => {
        container.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        currentMemberFilter = btn.dataset.id;

        if (activeView === 'map') {
          await MapEngine.renderSectorMap(currentMemberFilter);
        } else if (activeView === 'kanban') {
          await KanbanEngine.renderBoard(currentMemberFilter, {
            onRefresh: refreshUI,
            onReportImpediment: openReportImpedimentModal,
            onOpenTaskDetails: openTaskDetailsModal,
          });
        }
      });
    });
  }

  // ============================================================
  // EVENTOS DE ABERTURA DE MODAIS
  // ============================================================

  if (btnNewMember) {
    btnNewMember.addEventListener('click', () => {
      if (!isManager()) {
        showToast('Apenas gestores podem cadastrar colaboradores.', 'warning');
        return;
      }

      if (formMember) formMember.reset();
      const preview = document.getElementById('member-photo-preview');
      if (preview) {
        preview.src = '';
        preview.classList.remove('active');
      }

      openModal(modalMember);
    });
  }

  if (btnNewTask) {
    btnNewTask.addEventListener('click', async () => {
      if (formTask) formTask.reset();

      const taskIdInput = document.getElementById('task-id');
      if (taskIdInput) taskIdInput.value = '';

      const headerTitle = document.getElementById('modal-task-title-header');
      if (headerTitle) headerTitle.textContent = '📌 Nova Atividade';

      await populateTaskMemberSelect();
      await populateTaskProjectSelect();

      const selectedMemberId = document.getElementById('task-member').value;
      await renderTeamMembersCheckboxes(selectedMemberId, []);

      document.getElementById('task-date').value = new Date().toISOString().slice(0, 10);

      const selectReplicate = document.getElementById('task-replicate');
      if (selectReplicate) selectReplicate.value = 'nao';
      const repPanel = document.getElementById('replicate-options-panel');
      if (repPanel) repPanel.style.display = 'none';
      const dynList = document.getElementById('dynamic-dates-list');
      if (dynList) {
        dynList.innerHTML = `
          <div class="dynamic-date-row" style="display: flex; align-items: center; gap: 0.5rem;">
            <input type="date" class="input-control input-dynamic-date" style="max-width: 200px; font-size: 0.825rem;">
            <span style="font-size: 0.75rem; color: var(--text-dim);">Data 1</span>
          </div>
        `;
        bindDynamicDateInputs();
      }

      openModal(modalTask);
    });
  }

  // ============================================================
  // REPLICAÇÃO DE ATIVIDADES - CONTROLE DE UI DINÂMICA
  // ============================================================
  const selectTaskReplicate = document.getElementById('task-replicate');
  const replicateOptionsPanel = document.getElementById('replicate-options-panel');
  const replicateTypeRadios = document.querySelectorAll('input[name="replicate-type"]');
  const replicateMensalContainer = document.getElementById('replicate-type-mensal-container');
  const replicateDatasContainer = document.getElementById('replicate-type-datas-container');
  const dynamicDatesList = document.getElementById('dynamic-dates-list');

  if (selectTaskReplicate && replicateOptionsPanel) {
    selectTaskReplicate.addEventListener('change', () => {
      if (selectTaskReplicate.value === 'sim') {
        replicateOptionsPanel.style.display = 'block';
      } else {
        replicateOptionsPanel.style.display = 'none';
      }
    });
  }

  if (replicateTypeRadios) {
    replicateTypeRadios.forEach(radio => {
      radio.addEventListener('change', () => {
        if (radio.value === 'mensal') {
          if (replicateMensalContainer) replicateMensalContainer.style.display = 'block';
          if (replicateDatasContainer) replicateDatasContainer.style.display = 'none';
        } else {
          if (replicateMensalContainer) replicateMensalContainer.style.display = 'none';
          if (replicateDatasContainer) replicateDatasContainer.style.display = 'block';
        }
      });
    });
  }

  function bindDynamicDateInputs() {
    if (!dynamicDatesList) return;
    const inputs = dynamicDatesList.querySelectorAll('.input-dynamic-date');
    inputs.forEach((input, index) => {
      if (input.dataset.bound) return;
      input.dataset.bound = 'true';

      input.addEventListener('change', () => {
        const currentInputs = dynamicDatesList.querySelectorAll('.input-dynamic-date');
        if (input.value && index === currentInputs.length - 1) {
          const nextCount = currentInputs.length + 1;
          const newRow = document.createElement('div');
          newRow.className = 'dynamic-date-row';
          newRow.style.cssText = 'display: flex; align-items: center; gap: 0.5rem;';
          newRow.innerHTML = `
            <input type="date" class="input-control input-dynamic-date" style="max-width: 200px; font-size: 0.825rem;">
            <span style="font-size: 0.75rem; color: var(--text-dim);">Data ${nextCount}</span>
          `;
          dynamicDatesList.appendChild(newRow);
          bindDynamicDateInputs();
        }
      });
    });
  }

  bindDynamicDateInputs();

  // ============================================================
  // UPLOADS E SUBMITS DE FORMULÁRIOS
  // ============================================================

  const memberPhotoInput = document.getElementById('member-photo');
  if (memberPhotoInput) {
    memberPhotoInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (evt) => {
          const preview = document.getElementById('member-photo-preview');
          if (preview) {
            preview.src = evt.target.result;
            preview.classList.add('active');
          }
        };
        reader.readAsDataURL(file);
      }
    });
  }

  if (formMember) {
    formMember.addEventListener('submit', async (e) => {
      e.preventDefault();

      if (!isManager()) {
        showToast('Apenas gestores podem cadastrar colaboradores.', 'warning');
        return;
      }

      const name = document.getElementById('member-name').value.trim();
      const role = document.getElementById('member-role').value.trim();
      const contact = document.getElementById('member-contact').value.trim();
      const emailField = document.getElementById('member-email');
      const passwordField = document.getElementById('member-password');
      const accessLevelField = document.getElementById('member-access-level');

      const email = emailField ? emailField.value.trim() : contact;
      const password = passwordField ? passwordField.value.trim() : '';
      const accessLevel = accessLevelField ? accessLevelField.value : 'colaborador';

      if (!email || !password) {
        showToast('E-mail e senha de acesso são obrigatórios.', 'warning');
        return;
      }

      const photoPreview = document.getElementById('member-photo-preview');
      let photoData = photoPreview ? photoPreview.src : '';

      if (!photoPreview || !photoPreview.classList.contains('active') || !photoData) {
        photoData = `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=6366f1&color=fff`;
      }

      const newMember = {
        id: 'm-' + Date.now(),
        name,
        role,
        contact,
        email,
        password,
        accessLevel: accessLevel === 'gestor' ? 'gestor' : 'colaborador',
        photo: photoData,
      };

      await DB.save('members', newMember);
      showToast(`Membro ${name} cadastrado com sucesso!`, 'success');
      closeModal(modalMember);
      await refreshUI();
    });
  }

  if (formTask) {
    formTask.addEventListener('submit', async (e) => {
      e.preventDefault();

      const existingTaskId = document.getElementById('task-id').value;
      const title = document.getElementById('task-title').value.trim();
      const description = document.getElementById('task-desc').value.trim();
      const memberId = document.getElementById('task-member').value;
      const projectId = document.getElementById('task-project').value || null;
      const priority = document.getElementById('task-priority').value;
      const dueDate = document.getElementById('task-date').value;

      const teamMemberIds = Array.from(
        document.querySelectorAll('.chk-task-team-member:checked')
      ).map((cb) => cb.value);

      if (existingTaskId) {
        const task = await DB.get('tasks', existingTaskId);

        if (task) {
          const currentTaskMemberId = task.member_id || task.memberId;
          if (!isManager() && String(currentTaskMemberId) !== String(getLoggedMemberId())) {
            showToast('Você não tem permissão para editar esta atividade.', 'warning');
            return;
          }

          const previousState = { ...task };

          task.title = title;
          task.description = description;
          task.member_id = memberId;
          task.memberId = memberId;
          task.projectId = projectId;
          task.priority = priority;
          task.dueDate = dueDate;

          await DB.save('tasks', task);

          const existingTaskMembers = (await DB.getAll('task_members')) || [];
          const currentGroupTasks = existingTaskMembers.filter(
            (tm) => String(tm.taskId) === String(task.id)
          );

          for (const tm of currentGroupTasks) {
            await DB.delete('task_members', tm.id);
          }

          for (const tMemberId of teamMemberIds) {
            const newTm = {
              id: 'tm-' + Date.now() + Math.floor(Math.random() * 1000),
              taskId: task.id,
              memberId: tMemberId,
              member_id: tMemberId,
              roleInTask: 'Colaborador',
              createdAt: new Date().toISOString(),
            };
            await DB.save('task_members', newTm);
          }

          UndoEngine.pushAction({
            type: 'TASK_UPDATE',
            previousState,
          });

          showToast(`Atividade "${title}" atualizada com sucesso!`, 'success');
        }
      } else {
        const newTask = {
          id: 't-' + Date.now(),
          title,
          description,
          member_id: memberId,
          memberId: memberId,
          projectId,
          priority,
          dueDate,
          status: 'A FAZER',
          elapsedSeconds: 0,
          isTimerRunning: false,
          lastTimerStartedAt: null,
          sortOrder: Date.now(),
          createdAt: new Date().toISOString(),
        };

        await DB.save('tasks', newTask);

        for (const tMemberId of teamMemberIds) {
          const newTm = {
            id: 'tm-' + Date.now() + Math.floor(Math.random() * 1000),
            taskId: newTask.id,
            memberId: tMemberId,
            member_id: tMemberId,
            roleInTask: 'Colaborador',
            createdAt: new Date().toISOString(),
          };
          await DB.save('task_members', newTm);
        }

        // LÓGICA DE REPLICAÇÃO
        const isReplicate = selectTaskReplicate && selectTaskReplicate.value === 'sim';
        let replicatedCount = 0;

        if (isReplicate) {
          const selectedType = document.querySelector('input[name="replicate-type"]:checked')?.value || 'mensal';

          if (selectedType === 'mensal') {
            const monthsCount = parseInt(document.getElementById('replicate-months-count')?.value || '3', 10);
            const baseDate = new Date(dueDate + 'T12:00:00');

            for (let m = 1; m <= monthsCount; m++) {
              const nextDate = new Date(baseDate);
              nextDate.setMonth(nextDate.getMonth() + m);
              const nextDateStr = nextDate.toISOString().split('T')[0];

              const replicaTask = {
                ...newTask,
                id: 't-' + Date.now() + '-m' + m + '-' + Math.floor(Math.random() * 1000),
                dueDate: nextDateStr,
                createdAt: new Date().toISOString()
              };

              await DB.save('tasks', replicaTask);
              replicatedCount++;

              for (const tMemberId of teamMemberIds) {
                const newTm = {
                  id: 'tm-' + Date.now() + '-m' + m + '-' + Math.floor(Math.random() * 1000),
                  taskId: replicaTask.id,
                  memberId: tMemberId,
                  member_id: tMemberId,
                  roleInTask: 'Colaborador',
                  createdAt: new Date().toISOString(),
                };
                await DB.save('task_members', newTm);
              }
            }
          } else if (selectedType === 'datas') {
            const customDates = Array.from(document.querySelectorAll('.input-dynamic-date'))
              .map(i => i.value)
              .filter(v => v && v !== dueDate);

            let dIndex = 1;
            for (const cDate of customDates) {
              const replicaTask = {
                ...newTask,
                id: 't-' + Date.now() + '-d' + dIndex + '-' + Math.floor(Math.random() * 1000),
                dueDate: cDate,
                createdAt: new Date().toISOString()
              };

              await DB.save('tasks', replicaTask);
              replicatedCount++;
              dIndex++;

              for (const tMemberId of teamMemberIds) {
                const newTm = {
                  id: 'tm-' + Date.now() + '-d' + dIndex + '-' + Math.floor(Math.random() * 1000),
                  taskId: replicaTask.id,
                  memberId: tMemberId,
                  member_id: tMemberId,
                  roleInTask: 'Colaborador',
                  createdAt: new Date().toISOString(),
                };
                await DB.save('task_members', newTm);
              }
            }
          }
        }

        UndoEngine.pushAction({
          type: 'TASK_CREATE',
          taskId: newTask.id,
        });

        if (replicatedCount > 0) {
          showToast(`Atividade criada e replicada +${replicatedCount} vezes com sucesso!`, 'success');
        } else {
          showToast('Nova atividade criada com sucesso!', 'success');
        }
      }

      closeModal(modalTask);
      await refreshUI();
    });
  }

  if (formProject) {
    formProject.addEventListener('submit', async (e) => {
      e.preventDefault();

      const name = document.getElementById('project-name').value;
      const description = document.getElementById('project-desc').value;

      const newProject = {
        id: 'proj-' + Date.now(),
        name,
        description,
        status: 'EM ANDAMENTO',
        createdAt: new Date().toISOString(),
      };

      await DB.save('projects', newProject);
      showToast(`Projeto "${name}" criado com sucesso!`, 'success');
      closeModal(modalProject);
      await refreshUI();
    });
  }

  // ============================================================
  // REGISTRO DE ESCALA E AUSÊNCIAS (HOME OFFICE, FÉRIAS, ATESTADOS, FOLGAS)
  // ============================================================

  const modalAbsence = document.getElementById('modal-absence');
  const formAbsence = document.getElementById('form-absence');
  const btnOpenModalAbsence = document.getElementById('btn-open-modal-absence');

  if (btnOpenModalAbsence && modalAbsence) {
    btnOpenModalAbsence.addEventListener('click', async () => {
      const selectMember = document.getElementById('absence-member');
      if (selectMember) {
        const members = (await DB.getAll('members')) || [];
        selectMember.innerHTML = members
          .map((m) => `<option value="${m.id}">${m.name} (${m.role || 'Membro'})</option>`)
          .join('');
      }

      const todayStr = new Date().toISOString().slice(0, 10);
      const startDateInput = document.getElementById('absence-start-date');
      const endDateInput = document.getElementById('absence-end-date');

      if (startDateInput) startDateInput.value = todayStr;
      if (endDateInput) endDateInput.value = todayStr;

      openModal(modalAbsence);
    });
  }

  if (formAbsence) {
    formAbsence.addEventListener('submit', async (e) => {
      e.preventDefault();

      const memberId = document.getElementById('absence-member').value;
      const type = document.getElementById('absence-type').value;
      const startDate = document.getElementById('absence-start-date').value;
      const endDate = document.getElementById('absence-end-date').value;
      const notes = document.getElementById('absence-notes').value.trim();

      if (!memberId || !startDate || !endDate) {
        showToast('Preencha os campos obrigatórios para o registro de escala.', 'warning');
        return;
      }

      if (startDate > endDate) {
        showToast('A data de início não pode ser posterior à data de término.', 'warning');
        return;
      }

      const newAbsence = {
        id: 'abs-' + Date.now(),
        memberId,
        type,
        startDate,
        endDate,
        notes,
        createdAt: new Date().toISOString(),
      };

      await DB.save('member_absences', newAbsence);
      showToast('Registro de escala/ausência salvo com sucesso!', 'success');
      closeModal(modalAbsence);
      await refreshUI();
    });
  }

  if (formImpediment) {
    formImpediment.addEventListener('submit', async (e) => {
      e.preventDefault();

      const desc = document.getElementById('impediment-desc').value;
      const preview = document.getElementById('impediment-preview');
      const evidenceImg = preview.classList.contains('active') ? preview.src : null;

      const newImpediment = {
        id: 'imp-' + Date.now(),
        taskId: reportingTaskId,
        description: desc,
        evidenceImage: evidenceImg,
        createdAt: new Date().toISOString(),
      };

      await DB.save('impediments', newImpediment);
      showToast('Contratempo registrado para a tarefa!', 'warning');
      closeModal(modalImpediment);
      await refreshUI();
    });
  }

  // ============================================================
  // GRUPO DA ATIVIDADE
  // ============================================================

  const btnSaveTaskGroup = document.getElementById('task-group-save-btn');
  if (btnSaveTaskGroup) {
    btnSaveTaskGroup.addEventListener('click', async () => {
      const taskId = btnSaveTaskGroup.dataset.taskId;
      if (!taskId) return;

      const checkboxes = document.querySelectorAll('.chk-group-member');
      const existingTaskMembers = (await DB.getAll('task_members')) || [];
      const currentGroupTasks = existingTaskMembers.filter(
        (tm) => String(tm.taskId) === String(taskId)
      );

      for (const tm of currentGroupTasks) {
        await DB.delete('task_members', tm.id);
      }

      for (const chk of checkboxes) {
        if (chk.checked) {
          const newTm = {
            id: 'tm-' + Date.now() + Math.floor(Math.random() * 1000),
            taskId,
            memberId: chk.value,
            member_id: chk.value,
            roleInTask: 'Colaborador',
            createdAt: new Date().toISOString(),
          };
          await DB.save('task_members', newTm);
        }
      }

      showToast('Integrantes do grupo atualizados com sucesso!', 'success');
      closeModal(modalTaskGroup);
      await refreshUI();
    });
  }

  // ============================================================
  // MODAL DE DETALHES DA ATIVIDADE (RENDERIZA INFORMAÇÕES, EDITAR E EXCLUIR)
  // ============================================================

  async function openTaskDetailsModal(taskId) {
    const task = await DB.get('tasks', taskId);
    if (!task) return;

    const container = document.getElementById('task-details-body');
    if (!container) return;

    const members = (await DB.getAll('members')) || [];
    const taskOwnerId = task.member_id || task.memberId;
    const ownerMember = members.find((m) => String(m.id) === String(taskOwnerId));
    const ownerName = ownerMember ? ownerMember.name : 'Não atribuído';

    const formattedDueDate = task.dueDate
      ? String(task.dueDate).split('T')[0].split('-').reverse().join('/')
      : 'Sem prazo';

    const allImpediments = (await DB.getAll('impediments')) || [];
    const taskImpediments = allImpediments.filter((imp) => String(imp.taskId) === String(task.id));

    let impedimentsHtml = '';
    if (taskImpediments.length > 0) {
      impedimentsHtml = `
        <div style="margin-top:0.75rem; background:rgba(245, 158, 11, 0.1); border:1px solid rgba(245, 158, 11, 0.3); border-radius:8px; padding:0.85rem;">
          <h5 style="margin:0 0 0.5rem 0; font-size:0.875rem; color:#f59e0b; font-weight:700; display:flex; align-items:center; gap:0.4rem;">
            ⚠️ Contratempos / Impedimentos Relatados (${taskImpediments.length})
          </h5>
          <div style="display:flex; flex-direction:column; gap:0.6rem; max-height:180px !important; overflow-y:auto !important; padding-right:0.35rem;">
            ${taskImpediments.map(imp => {
              const impDate = imp.createdAt ? String(imp.createdAt).split('T')[0].split('-').reverse().join('/') : '';
              return `
                <div style="background:rgba(0,0,0,0.25); padding:0.6rem 0.75rem; border-radius:6px; font-size:0.825rem; color:#e5e7eb; display:flex; justify-content:space-between; align-items:center; gap:0.5rem; flex-wrap:wrap;">
                  <div style="flex:1;">
                    <div><strong>Motivo:</strong> ${imp.description || 'Sem descrição'}</div>
                    ${impDate ? `<div style="font-size:0.75rem; color:var(--text-dim, #9ca3af); margin-top:0.2rem;">📅 Relatado em: ${impDate}</div>` : ''}
                  </div>
                  <button class="btn btn-delete-impediment" data-imp-id="${imp.id}" style="padding:0.25rem 0.55rem; font-size:0.75rem; background:rgba(239, 68, 68, 0.2); color:#ef4444; border:1px solid rgba(239, 68, 68, 0.4); border-radius:4px; cursor:pointer;" title="Excluir este contratempo">
                    🗑️ Excluir Contratempo
                  </button>
                </div>
              `;
            }).join('')}
          </div>
        </div>
      `;
    }

    // Monta o corpo dinâmico do modal
    container.innerHTML = `
      <div style="display:flex; flex-direction:column; gap:0.85rem;">
        <h4 style="font-size:1.15rem; color:#fff; margin:0; font-weight:700;">${task.title}</h4>
        <p style="font-size:0.9rem; color:var(--text-muted, #9ca3af); margin:0; line-height:1.5;">
          ${task.description || 'Sem descrição cadastrada.'}
        </p>
        
        <div style="display:flex; gap:1rem; flex-wrap:wrap; font-size:0.825rem; color:#e5e7eb; background:rgba(255,255,255,0.05); padding:0.75rem; border-radius:6px; margin-top:0.25rem;">
          <span><strong>👤 Responsável:</strong> ${ownerName}</span>
          <span><strong>📍 Status:</strong> ${task.status}</span>
          <span><strong>⚡ Prioridade:</strong> ${task.priority || 'Média'}</span>
          <span><strong>📅 Prazo:</strong> ${formattedDueDate}</span>
        </div>

        ${impedimentsHtml}

        <div style="display:flex; justify-content:flex-end; gap:0.5rem; margin-top:1.25rem; border-top:1px solid var(--border-color, #374151); padding-top:1rem;">
          <button id="btn-edit-task-action" class="btn btn-secondary" style="font-size:0.825rem; padding:0.5rem 1rem;">
            ✏️ Editar Atividade
          </button>
          <button id="btn-delete-task-action" class="btn btn-danger" style="background:#ef4444; color:#fff; font-size:0.825rem; padding:0.5rem 1rem; border:none; border-radius:6px; cursor:pointer;">
            🗑️ Excluir Atividade
          </button>
        </div>
      </div>
    `;

    // Listener para Excluir Contratempo
    container.querySelectorAll('.btn-delete-impediment').forEach((btnImp) => {
      btnImp.addEventListener('click', async (e) => {
        e.stopPropagation();
        const impId = btnImp.dataset.impId;
        if (!impId) return;

        if (confirm('Deseja realmente excluir este contratempo?')) {
          await DB.delete('impediments', impId);
          showToast('Contratempo excluído com sucesso!', 'success');
          closeModal(modalTaskDetails);
          await refreshUI();
        }
      });
    });

    // Ação: EDITAR ATIVIDADE
    const btnEdit = container.querySelector('#btn-edit-task-action');
    if (btnEdit) {
      btnEdit.addEventListener('click', async () => {
        const loggedId = getLoggedMemberId();
        if (!isManager() && String(taskOwnerId) !== String(loggedId)) {
          showToast('Você só pode editar atividades das quais é responsável.', 'warning');
          return;
        }

        closeModal(modalTaskDetails);

        document.getElementById('task-id').value = task.id;
        document.getElementById('task-title').value = task.title;
        document.getElementById('task-desc').value = task.description || '';
        document.getElementById('task-priority').value = task.priority || 'Média';
        if (task.dueDate) {
          document.getElementById('task-date').value = String(task.dueDate).split('T')[0];
        }

        await populateTaskMemberSelect();
        await populateTaskProjectSelect();

        const selectMember = document.getElementById('task-member');
        if (selectMember) selectMember.value = taskOwnerId;

        const selectProject = document.getElementById('task-project');
        if (selectProject) selectProject.value = task.projectId || '';

        const existingTaskMembers = (await DB.getAll('task_members')) || [];
        const groupMembers = existingTaskMembers
          .filter((tm) => String(tm.taskId) === String(task.id))
          .map((tm) => tm.memberId || tm.member_id);

        await renderTeamMembersCheckboxes(taskOwnerId, groupMembers);

        const headerTitle = document.getElementById('modal-task-title-header');
        if (headerTitle) headerTitle.textContent = '✏️ Editar Atividade';

        openModal(modalTask);
      });
    }

    // Ação: EXCLUIR ATIVIDADE
    const btnDelete = container.querySelector('#btn-delete-task-action');
    if (btnDelete) {
      btnDelete.addEventListener('click', async () => {
        const loggedId = getLoggedMemberId();
        if (!isManager() && String(taskOwnerId) !== String(loggedId)) {
          showToast('Você só pode excluir atividades das quais é responsável.', 'warning');
          return;
        }

        if (confirm(`Tem certeza que deseja excluir a atividade "${task.title}"?`)) {
          await DB.delete('tasks', task.id);

          const existingTaskMembers = (await DB.getAll('task_members')) || [];
          const groupTasks = existingTaskMembers.filter((tm) => String(tm.taskId) === String(task.id));
          for (const tm of groupTasks) {
            await DB.delete('task_members', tm.id);
          }

          closeModal(modalTaskDetails);
          showToast('Atividade excluída com sucesso!', 'success');
          await refreshUI();
        }
      });
    }

    openModal(modalTaskDetails);
  }

  function openReportImpedimentModal(taskId) {
    reportingTaskId = taskId;
    if (formImpediment) formImpediment.reset();
    openModal(modalImpediment);
  }

  function openEvidenceModal(imgDataUrl) {
    const imgEl = document.getElementById('evidence-modal-img');
    if (imgEl) {
      imgEl.src = imgDataUrl;
      openModal(modalEvidence);
    }
  }

  // ============================================================
  // MODAL AGENDA DO DIA (BUSCA TAREFAS DA DATA SELECIONADA)
  // ============================================================

  async function openCalendarDayModal(dateStr) {
    const titleEl = document.getElementById('calendar-day-modal-title');
    const bodyEl = document.getElementById('calendar-day-modal-body');

    if (!bodyEl) return;

    const formattedDate = dateStr ? dateStr.split('-').reverse().join('/') : '';
    if (titleEl) {
      titleEl.textContent = `📅 Agenda do Dia ${formattedDate}`;
    }

    bodyEl.innerHTML = `<div style="text-align:center; padding:1.5rem; color:var(--text-dim);">Carregando atividades do dia...</div>`;
    openModal(modalCalendarDay);

    try {
      const tasks = (await DB.getAll('tasks')) || [];
      const members = (await DB.getAll('members')) || [];

      const dayTasks = tasks.filter((t) => {
        const tDate = t.dueDate || t.due_date;
        return tDate && String(tDate).slice(0, 10) === String(dateStr).slice(0, 10);
      });

      if (dayTasks.length === 0) {
        bodyEl.innerHTML = `
          <div style="text-align:center; padding:2rem 1rem; color:var(--text-dim);">
            <span>☕</span>
            <p style="margin-top:0.5rem; font-size:0.9rem;">Nenhuma atividade com prazo marcado para este dia.</p>
          </div>
        `;
        return;
      }

      bodyEl.innerHTML = `
        <div style="display:flex; flex-direction:column; gap:0.75rem; max-height:350px; overflow-y:auto; padding-right:0.25rem;">
          ${dayTasks
          .map((task) => {
            const memberId = task.member_id || task.memberId;
            const member = members.find((m) => String(m.id) === String(memberId));
            const memberName = member ? member.name : 'Não atribuído';

            const priorityColor =
              task.priority === 'Alta'
                ? '#ef4444'
                : task.priority === 'Média'
                  ? '#f59e0b'
                  : '#10b981';

            return `
                <div style="background:var(--bg-input, #1f2937); border:1px solid var(--border-color, #374151); padding:0.85rem; border-radius:8px; display:flex; justify-content:space-between; align-items:center;">
                  <div>
                    <h4 style="margin:0 0 0.35rem 0; font-size:0.95rem; color:#fff;">${task.title}</h4>
                    <span style="font-size:0.775rem; color:var(--text-muted, #9ca3af);">
                      👤 Responsável: <strong>${memberName}</strong>
                    </span>
                  </div>
                  <div style="text-align:right; display:flex; flex-direction:column; align-items:flex-end; gap:0.3rem;">
                    <span style="font-size:0.7rem; font-weight:700; padding:0.2rem 0.5rem; border-radius:4px; background:${priorityColor}20; color:${priorityColor}; border:1px solid ${priorityColor}40;">
                      ${task.priority || 'Média'}
                    </span>
                    <span style="font-size:0.75rem; color:var(--text-dim, #6b7280);">
                      ${task.status || 'A FAZER'}
                    </span>
                  </div>
                </div>
              `;
          })
          .join('')}
        </div>
      `;
    } catch (err) {
      console.error('❌ Erro ao carregar agenda do dia:', err);
      bodyEl.innerHTML = `<div style="text-align:center; padding:1.5rem; color:#ef4444;">Falha ao carregar as atividades.</div>`;
    }
  }

  async function handleDeleteMember(memberId, memberName) {
    if (!isManager()) return;
    if (confirm(`Remover ${memberName}?`)) {
      await DB.delete('members', memberId);
      showToast('Membro removido!', 'success');
      await refreshUI();
    }
  }

  function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    const icon = type === 'success' ? '✅' : type === 'warning' ? '⚠️' : 'ℹ️';

    toast.innerHTML = `<span>${icon}</span> <span>${message}</span>`;
    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(100%)';
      setTimeout(() => toast.remove(), 300);
    }, 3500);
  }

  // Inicializa Tickers, Filtros de Período e Drag-and-Drop
  KanbanEngine.initPeriodFilterButtons({
    onRefresh: refreshUI,
    onReportImpediment: openReportImpedimentModal,
    onOpenTaskDetails: openTaskDetailsModal,
  });

  KanbanEngine.initDragAndDrop(async (task, fromStatus, toStatus) => {
    showToast(`Tarefa movida para ${toStatus}`, 'info');
    await refreshUI();
  });

  TimerEngine.startGlobalTicker();
  UndoEngine.initKeyboardShortcut(refreshUI, showToast);

  window.openTaskDetailsModal = openTaskDetailsModal;

  // ============================================================
  // PAINEL DE CONTROLE ADMINISTRATIVO (ADMIN ENGINE)
  // ============================================================
  const btnViewAdmin = document.getElementById('btn-view-admin');
  const modalAdminControl = document.getElementById('modal-admin-control');
  const btnCloseAdminModal = document.getElementById('btn-close-admin-modal');
  const btnAdminModalCloseFoot = document.getElementById('btn-admin-modal-close-foot');
  const btnAdminForceLogoutAll = document.getElementById('btn-admin-force-logout-all');
  const chkAdminMaintenanceMode = document.getElementById('chk-admin-maintenance-mode');
  const btnAdminPurgeOldTasks = document.getElementById('btn-admin-purge-old-tasks');
  const adminMembersTableContainer = document.getElementById('admin-members-table-container');
  const adminAuditLogsContainer = document.getElementById('admin-audit-logs-container');

  let adminAuditLogs = JSON.parse(localStorage.getItem('admin_audit_logs') || '[]');

  function addAuditLog(action, details) {
    const logEntry = {
      timestamp: new Date().toLocaleString('pt-BR'),
      admin: localStorage.getItem('logged_member_name') || 'Admin',
      action,
      details
    };
    adminAuditLogs.unshift(logEntry);
    if (adminAuditLogs.length > 100) adminAuditLogs.pop();
    localStorage.setItem('admin_audit_logs', JSON.stringify(adminAuditLogs));
  }

  function renderAuditLogs() {
    if (!adminAuditLogsContainer) return;
    if (adminAuditLogs.length === 0) {
      adminAuditLogsContainer.innerHTML = '<div style="color:var(--text-muted); padding:0.5rem;">Nenhum log registrado ainda.</div>';
      return;
    }
    adminAuditLogsContainer.innerHTML = adminAuditLogs.map(log => `
      <div style="padding: 4px 0; border-bottom: 1px solid rgba(255,255,255,0.05);">
        <span style="color:#6366f1;">[${log.timestamp}]</span>
        <strong style="color:#f59e0b;"> ${log.admin}:</strong>
        <span style="color:#10b981;"> ${log.action}</span> -
        <span style="color:#94a3b8;">${log.details}</span>
      </div>
    `).join('');
  }

  window.getMemberOrderMap = function() {
    try {
      return JSON.parse(localStorage.getItem('team_members_order_map') || '{}');
    } catch (e) {
      return {};
    }
  };

  window.saveMemberOrderMap = function(orderMap) {
    try {
      localStorage.setItem('team_members_order_map', JSON.stringify(orderMap));
    } catch (e) {}
  };

  window.sortMembersByCustomOrder = function(membersList) {
    const orderMap = window.getMemberOrderMap();
    return (membersList || []).sort((a, b) => {
      const orderA = orderMap[String(a.id)] !== undefined ? orderMap[String(a.id)] : (a.order ?? 999);
      const orderB = orderMap[String(b.id)] !== undefined ? orderMap[String(b.id)] : (b.order ?? 999);
      return Number(orderA) - Number(orderB);
    });
  };

  async function renderAdminMembersTable() {
    if (!adminMembersTableContainer) return;
    adminMembersTableContainer.innerHTML = '<div style="padding:1rem; text-align:center;">Carregando colaboradores...</div>';

    const rawMembers = (await DB.getAll('members', { forceRefresh: true })) || [];

    if (rawMembers.length === 0) {
      adminMembersTableContainer.innerHTML = '<div style="padding:1rem; text-align:center;">Nenhum colaborador encontrado.</div>';
      return;
    }

    // Ordena os membros pela ordem salva no mapa customizado
    const members = window.sortMembersByCustomOrder(rawMembers);

    let html = `
      <table style="width:100%; border-collapse:collapse; font-size:0.825rem; text-align:left;">
        <thead>
          <tr style="background:rgba(15,23,42,0.9); border-bottom:1px solid var(--border-color); color:var(--text-muted);">
            <th style="padding:0.6rem 0.75rem; text-align:center; width:90px;">Ordem</th>
            <th style="padding:0.6rem 0.75rem;">Nome</th>
            <th style="padding:0.6rem 0.75rem;">Função</th>
            <th style="padding:0.6rem 0.75rem;">Permissão</th>
            <th style="padding:0.6rem 0.75rem;">Nova Senha</th>
            <th style="padding:0.6rem 0.75rem; text-align:right;">Ações</th>
          </tr>
        </thead>
        <tbody>
    `;

    members.forEach((m, idx) => {
      const currentLevel = m.accessLevel || (m.role && m.role.toLowerCase().includes('gestor') ? 'gestor' : 'colaborador');
      const isFirst = idx === 0;
      const isLast = idx === members.length - 1;

      html += `
        <tr style="border-bottom:1px solid var(--border-color);" data-id="${m.id}" data-index="${idx}">
          <td style="padding:0.6rem 0.75rem; text-align:center; white-space:nowrap;">
            <button type="button" class="btn btn-secondary btn-sm admin-move-up" data-id="${m.id}" data-index="${idx}" ${isFirst ? 'disabled style="opacity:0.3; cursor:not-allowed; padding:2px 6px;"' : 'style="padding:2px 6px; cursor:pointer;"'} title="Mover para cima na lista do gestor">
              ▲
            </button>
            <button type="button" class="btn btn-secondary btn-sm admin-move-down" data-id="${m.id}" data-index="${idx}" ${isLast ? 'disabled style="opacity:0.3; cursor:not-allowed; padding:2px 6px;"' : 'style="padding:2px 6px; cursor:pointer;"'} title="Mover para baixo na lista do gestor">
              ▼
            </button>
          </td>
          <td style="padding:0.6rem 0.75rem; font-weight:700;">${m.name}</td>
          <td style="padding:0.6rem 0.75rem; color:var(--text-muted);">${m.role || 'Colaborador'}</td>
          <td style="padding:0.6rem 0.75rem;">
            <select class="admin-change-level" data-id="${m.id}" style="background:rgba(15,23,42,0.8); color:var(--text-main); border:1px solid var(--border-color); border-radius:6px; padding:2px 6px; font-size:0.8rem;">
              <option value="colaborador" ${currentLevel === 'colaborador' ? 'selected' : ''}>Colaborador</option>
              <option value="gestor" ${currentLevel === 'gestor' ? 'selected' : ''}>Gestor</option>
              <option value="admin" ${currentLevel === 'admin' ? 'selected' : ''}>Administrador</option>
            </select>
          </td>
          <td style="padding:0.6rem 0.75rem;">
            <input type="text" class="admin-new-pass-input" data-id="${m.id}" placeholder="Definir senha..." value="${m.password || ''}" style="width:120px; background:rgba(15,23,42,0.8); color:var(--text-main); border:1px solid var(--border-color); border-radius:6px; padding:2px 6px; font-size:0.8rem;">
          </td>
          <td style="padding:0.6rem 0.75rem; text-align:right;">
            <button type="button" class="btn btn-sm btn-primary admin-save-member-btn" data-id="${m.id}" style="padding:3px 8px; font-size:0.75rem;">
              💾 Salvar
            </button>
          </td>
        </tr>
      `;
    });

    html += `</tbody></table>`;
    adminMembersTableContainer.innerHTML = html;

    // Listener para Mover Para Cima (▲)
    adminMembersTableContainer.querySelectorAll('.admin-move-up').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const idx = parseInt(e.currentTarget.getAttribute('data-index'), 10);
        if (isNaN(idx) || idx <= 0) return;

        const temp = members[idx];
        members[idx] = members[idx - 1];
        members[idx - 1] = temp;

        const orderMap = window.getMemberOrderMap();
        for (let i = 0; i < members.length; i++) {
          members[i].order = i + 1;
          orderMap[String(members[i].id)] = i + 1;
          DB.save('members', members[i]).catch(() => {});
        }
        window.saveMemberOrderMap(orderMap);

        addAuditLog('Reordenação da Equipe', `Membro ${temp.name} movido para a posição ${idx}`);
        showToast(`📍 Nova ordem dos membros salva!`, 'success');

        await renderAdminMembersTable();
        await refreshUI();
      });
    });

    // Listener para Mover Para Baixo (▼)
    adminMembersTableContainer.querySelectorAll('.admin-move-down').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const idx = parseInt(e.currentTarget.getAttribute('data-index'), 10);
        if (isNaN(idx) || idx >= members.length - 1) return;

        const temp = members[idx];
        members[idx] = members[idx + 1];
        members[idx + 1] = temp;

        const orderMap = window.getMemberOrderMap();
        for (let i = 0; i < members.length; i++) {
          members[i].order = i + 1;
          orderMap[String(members[i].id)] = i + 1;
          DB.save('members', members[i]).catch(() => {});
        }
        window.saveMemberOrderMap(orderMap);

        addAuditLog('Reordenação da Equipe', `Membro ${temp.name} movido para a posição ${idx + 2}`);
        showToast(`📍 Nova ordem dos membros salva!`, 'success');

        await renderAdminMembersTable();
        await refreshUI();
      });
    });

    adminMembersTableContainer.querySelectorAll('.admin-save-member-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const memberId = e.currentTarget.getAttribute('data-id');
        const row = e.currentTarget.closest('tr');
        const newPass = row.querySelector('.admin-new-pass-input').value.trim();
        const newLevel = row.querySelector('.admin-change-level').value;

        const targetMember = members.find(m => String(m.id) === String(memberId));
        if (targetMember) {
          targetMember.password = newPass;
          targetMember.accessLevel = newLevel;

          await DB.save('members', targetMember);
          addAuditLog('Alteração de Colaborador', `Atualizada senha/permissão de ${targetMember.name} (Nível: ${newLevel})`);
          showToast(`✅ Permissões de ${targetMember.name} atualizadas com sucesso!`, 'success');
          await refreshUI();
        }
      });
    });
  }

  document.querySelectorAll('.admin-tab-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      document.querySelectorAll('.admin-tab-btn').forEach(b => {
        b.classList.remove('active', 'btn-primary');
        b.classList.add('btn-secondary');
      });
      document.querySelectorAll('.admin-tab-content').forEach(c => c.style.display = 'none');

      const targetTab = e.currentTarget.getAttribute('data-tab');
      e.currentTarget.classList.add('active', 'btn-primary');
      e.currentTarget.classList.remove('btn-secondary');

      const activeContent = document.getElementById(targetTab);
      if (activeContent) activeContent.style.display = 'block';

      if (targetTab === 'admin-tab-members') renderAdminMembersTable();
      if (targetTab === 'admin-tab-logs') renderAuditLogs();
    });
  });

  if (btnAdminForceLogoutAll) {
    btnAdminForceLogoutAll.addEventListener('click', async () => {
      if (!confirm('🚨 ATENÇÃO: Deseja realmente DESLOGAR TODOS os colaboradores conectados no sistema agora?')) {
        return;
      }

      if (DB.supabase) {
        const channel = DB.supabase.channel('system_admin_events');
        await channel.subscribe();
        await channel.send({
          type: 'broadcast',
          event: 'FORCE_LOGOUT_ALL',
          payload: {
            adminId: getLoggedMemberId(),
            adminName: localStorage.getItem('logged_member_name') || 'Administrador',
            timestamp: Date.now()
          }
        });
      }

      addAuditLog('Deslogamento Global', 'Disparado encerramento forçado de todas as sessões ativas no sistema.');
      showToast('🔴 Sinal de deslogamento global enviado a todas as conexões!', 'warning');
    });
  }

  if (chkAdminMaintenanceMode) {
    const isMaintenance = localStorage.getItem('admin_maintenance_mode') === 'true';
    chkAdminMaintenanceMode.checked = isMaintenance;

    chkAdminMaintenanceMode.addEventListener('change', async (e) => {
      const active = e.target.checked;
      localStorage.setItem('admin_maintenance_mode', active ? 'true' : 'false');
      addAuditLog('Modo Manutenção', active ? 'Ativado Modo Manutenção (Read-Only)' : 'Desativado Modo Manutenção');
      showToast(active ? '🚧 Modo Manutenção Ativado!' : '✅ Modo Manutenção Desativado!', active ? 'warning' : 'success');
    });
  }

  if (btnAdminPurgeOldTasks) {
    btnAdminPurgeOldTasks.addEventListener('click', async () => {
      if (!confirm('Deseja remover da coluna "Concluído" todas as tarefas finalizadas há mais de 30 dias?')) {
        return;
      }

      const tasks = (await DB.getAll('tasks')) || [];
      const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
      let count = 0;

      for (const t of tasks) {
        if (t.status === 'done') {
          const finishedTime = t.updatedAt ? new Date(t.updatedAt).getTime() : 0;
          if (finishedTime > 0 && finishedTime < thirtyDaysAgo) {
            await DB.delete('tasks', t.id);
            count++;
          }
        }
      }

      addAuditLog('Limpeza em Massa', `Removidas ${count} tarefas antigas concluídas.`);
      showToast(`🧹 Limpeza concluída: ${count} tarefas removidas!`, 'success');
      await refreshUI();
    });
  }

  if (btnViewAdmin) {
    btnViewAdmin.addEventListener('click', () => {
      openModal(modalAdminControl);
    });
  }

  if (btnCloseAdminModal) btnCloseAdminModal.addEventListener('click', () => closeModal(modalAdminControl));
  if (btnAdminModalCloseFoot) btnAdminModalCloseFoot.addEventListener('click', () => closeModal(modalAdminControl));

  await refreshUI();
});