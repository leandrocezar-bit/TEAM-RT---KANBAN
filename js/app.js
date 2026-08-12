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

    // Cancela assinaturas anteriores para evitar escutas duplicadas
    if (window.activeNotificationChannel) {
      DB.supabase.removeChannel(window.activeNotificationChannel);
    }

    // Escuta novas inserções na tabela activity_transfers filtrando pelo usuário de destino
    window.activeNotificationChannel = DB.supabase
      .channel('realtime-activity-transfers')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'activity_transfers',
          filter: `to_member_id=eq.${loggedMemberId}`
        },
        async (payload) => {
          console.log('🔔 Nova solicitação de transferência recebida:', payload.new);

          // Dispara o toast informando a transferência
          showToast('⚡ Você recebeu uma nova solicitação de transferência!', 'warning');

          // Atualiza o Kanban para exibir a nova pendência imediatamente
          await refreshUI();
        }
      )
      .subscribe((status) => {
        console.log('📡 Status da assinatura Realtime:', status);
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
      setupRealtimeNotifications(); // <-- Inicializa a escuta Realtime após o login
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
  // INICIALIZA BANCO, REALTIME E VERIFICA ACESSO
  // ============================================================

  await DB.init();
  checkAuthentication();
  setupRealtimeNotifications(); // <-- Inicializa a escuta no carregamento da aplicação

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
  // POPULAR SELECTS E CHECKBOXES DE ATIVIDADE
  // ============================================================

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

  // ============================================================
  // EVENTOS DE ABERTURA DE MODAIS (+ Colaborador e + Nova Atividade)
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

      const selectedMemberSelect = document.getElementById('task-member');
      const selectedMemberId = selectedMemberSelect ? selectedMemberSelect.value : null;
      await renderTeamMembersCheckboxes(selectedMemberId, []);

      const taskDateInput = document.getElementById('task-date');
      if (taskDateInput) {
        taskDateInput.value = new Date().toISOString().slice(0, 10);
      }

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

    // Controle de Exibição de Botões
    if (btnNewMember) btnNewMember.style.display = manager ? 'inline-block' : 'none';

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

  async function openCalendarDayModal(dateStr) {
    openModal(modalCalendarDay);
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