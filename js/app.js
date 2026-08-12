/**
 * Controladora Principal do Aplicativo Kanban de Equipe (App Core Controller)
 */

import { DB } from './db.js';
import { TimerEngine } from './timer.js';
import { KanbanEngine } from './kanban.js';
import { ManagerEngine } from './manager.js';
import { MapEngine } from './map.js';
import { SettingsEngine } from './settings.js';
import { ProjectsEngine } from './projects.js';
import { UndoEngine } from './undo.js';
import { ChatEngine } from './chat.js';

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
    return localStorage.getItem('logged_access_level') === 'gestor';
  }

  function getLoggedMemberId() {
    return localStorage.getItem('logged_member_id');
  }

  function checkAuthentication() {
    const isAuth = localStorage.getItem('app_authenticated');

    if (isAuth === 'true') {
      if (loginOverlay) {
        loginOverlay.classList.remove('active');
        loginOverlay.style.display = 'none';
      }
      const loggedId = getLoggedMemberId();
      if (loggedId && !isManager()) {
        currentMemberFilter = loggedId;
      }
    } else {
      if (loginOverlay) {
        loginOverlay.classList.add('active');
        loginOverlay.style.display = 'flex';
      }
    }
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

          // Lê exatamente a coluna to_member_id do banco Supabase
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

  if (formLogin) {
    formLogin.addEventListener('submit', async (e) => {
      e.preventDefault();

      const inputEmail = document.getElementById('input-login-user').value.trim().toLowerCase();
      const inputPassword = document.getElementById('input-passcode').value.trim();

      if (!inputEmail || !inputPassword) {
        showToast('Informe e-mail e senha para entrar.', 'warning');
        return;
      }

      const members = (await DB.getAll('members')) || [];

      const matchedMember = members.find((m) => {
        const memEmail = m.email ? String(m.email).trim().toLowerCase() : '';
        const memName = m.name ? String(m.name).trim().toLowerCase() : '';
        return memEmail === inputEmail || memName === inputEmail;
      });

      if (!matchedMember) {
        showToast('E-mail ou Usuário não encontrado.', 'warning');
        return;
      }

      const dbPassword = matchedMember.password ? String(matchedMember.password).trim() : '';

      if (dbPassword !== inputPassword) {
        showToast('Senha incorreta. Tente novamente.', 'warning');
        return;
      }

      const accessLevel = matchedMember.accessLevel === 'gestor' ? 'gestor' : 'colaborador';

      localStorage.setItem('app_authenticated', 'true');
      localStorage.setItem('logged_member_id', matchedMember.id);
      localStorage.setItem('logged_access_level', accessLevel);

      currentMemberFilter = accessLevel === 'gestor' ? 'all' : matchedMember.id;
      activeView = 'kanban';

      checkAuthentication();
      setupRealtimeNotifications();
      showToast(`Bem-vindo de volta, ${matchedMember.name}!`, 'success');
      await refreshUI();
    });
  }

  const btnLogout = document.getElementById('btn-logout');
  if (btnLogout) {
    btnLogout.addEventListener('click', () => {
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

  // Helper de Abertura/Fechamento de Modais
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

    // BOTÕES DE VISIBILIDADE
    const managerOnlyButtons = [btnNewMember, btnResetDb];
    managerOnlyButtons.forEach((btn) => {
      if (btn) {
        btn.style.display = manager ? 'inline-block' : 'none';
      }
    });

    [btnViewKanban, btnViewManager, btnViewMap, btnViewSettings, btnViewProjects, btnViewChat, btnNewTask].forEach(btn => {
      if (btn) btn.style.display = 'inline-block';
    });

    // Reset Visual de Navegação
    [btnViewKanban, btnViewManager, btnViewMap, btnViewSettings, btnViewProjects, btnViewChat].forEach(btn => {
      if (btn) {
        btn.classList.remove('btn-primary');
        btn.classList.add('btn-secondary');
      }
    });

    [sectionKanban, sectionManager, sectionMap, sectionSettings, sectionProjects, sectionChat].forEach(sec => {
      if (sec) sec.classList.remove('active');
    });

    // Abas dos Membros
    await renderMemberTabs();
    await renderTopNotificationBar();

    // Roteamento da Tela Ativa
    if (activeView === 'kanban') {
      if (sectionKanban) sectionKanban.classList.add('active');
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
      if (sectionManager) sectionManager.classList.add('active');
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
      if (sectionMap) sectionMap.classList.add('active');
      if (btnViewMap) {
        btnViewMap.classList.add('btn-primary');
        btnViewMap.classList.remove('btn-secondary');
      }
      await MapEngine.renderSectorMap(currentMemberFilter);
    } else if (activeView === 'settings') {
      if (sectionSettings) sectionSettings.classList.add('active');
      if (btnViewSettings) {
        btnViewSettings.classList.add('btn-primary');
        btnViewSettings.classList.remove('btn-secondary');
      }
      await SettingsEngine.renderSettingsSection(showToast, refreshUI, {
        isManager: manager,
        memberId: loggedId,
      });
    } else if (activeView === 'projects') {
      if (sectionProjects) sectionProjects.classList.add('active');
      if (btnViewProjects) {
        btnViewProjects.classList.add('btn-primary');
        btnViewProjects.classList.remove('btn-secondary');
      }
      await ProjectsEngine.renderProjectsSection(showToast, refreshUI);
    } else if (activeView === 'chat') {
      if (sectionChat) sectionChat.classList.add('active');
      if (btnViewChat) {
        btnViewChat.classList.add('btn-primary');
        btnViewChat.classList.remove('btn-secondary');
      }
      await ChatEngine.renderChatSection();
    }
  }

  // Navegação
  if (btnViewManager) btnViewManager.addEventListener('click', () => { activeView = 'manager'; refreshUI(); });
  if (btnViewKanban) btnViewKanban.addEventListener('click', () => { activeView = 'kanban'; refreshUI(); });
  if (btnViewMap) btnViewMap.addEventListener('click', () => { activeView = 'map'; refreshUI(); });
  if (btnViewSettings) btnViewSettings.addEventListener('click', () => { activeView = 'settings'; refreshUI(); });
  if (btnViewProjects) btnViewProjects.addEventListener('click', () => { activeView = 'projects'; refreshUI(); });
  if (btnViewChat) btnViewChat.addEventListener('click', () => { activeView = 'chat'; refreshUI(); });

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

    // EVENTOS DE ACEITE E RECUSA NA BARRA
    listEl.onclick = async (e) => {
      const target = e.target;
      const transferId = target.dataset.id;
      if (!transferId) return;

      const transfer = transfers.find((t) => String(t.id) === String(transferId));
      if (!transfer) return;

      const now = new Date().toISOString();

      // 1. ACEITAR
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
              console.log('✅ Tarefa reatribuída no Supabase com sucesso para:', toMemberId);
            } else {
              console.error('❌ Não foi possível encontrar a tarefa na tabela tasks com id:', taskId);
            }

            // Remove o antigo dono da tabela de grupos caso estivesse vinculado
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

      // 2. RECUSAR
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

      console.log('🔄 Gravando em activity_transfers:', newTransfer);
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

  async function renderTeamMembersCheckboxes(selectedMemberId, selectedTeamMemberIds = []) {
    const container = document.getElementById('task-team-members-container');
    if (!container) return;

    const members = (await DB.getAll('members')) || [];
    const otherMembers = members.filter((m) => String(m.id) !== String(selectedMemberId));

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
    });
  }

  async function populateTaskMemberSelect() {
    const select = document.getElementById('task-member');
    if (!select) return;

    const manager = isManager();
    const loggedId = getLoggedMemberId();
    const members = (await DB.getAll('members')) || [];

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
    const members = (await DB.getAll('members')) || [];

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

      openModal(modalTask);
    });
  }

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

        UndoEngine.pushAction({
          type: 'TASK_CREATE',
          taskId: newTask.id,
        });

        showToast('Nova atividade criada e vinculada!', 'success');
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

  // Auxiliares dos modais de detalhes e evidência
  async function openTaskDetailsModal(taskId) {
    const task = await DB.get('tasks', taskId);
    if (!task) return;
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

  // Inicializa Tickers e Drag-and-Drop
  KanbanEngine.initDragAndDrop(async (task, fromStatus, toStatus) => {
    showToast(`Tarefa movida para ${toStatus}`, 'info');
    await refreshUI();
  });

  TimerEngine.startGlobalTicker();
  UndoEngine.initKeyboardShortcut(refreshUI, showToast);

  await refreshUI();
});