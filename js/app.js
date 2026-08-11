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

  const MANAGER_ONLY_VIEWS = [];

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
  // LOGIN CORRIGIDO (E-mail e Senha)
  // ============================================================

  if (formLogin) {
    formLogin.addEventListener('submit', async (e) => {
      e.preventDefault();

      const inputEmail = document
        .getElementById('input-login-user')
        .value.trim()
        .toLowerCase();

      const inputPassword = document.getElementById('input-passcode').value.trim();

      if (!inputEmail || !inputPassword) {
        showToast('Informe e-mail e senha para entrar.', 'warning');
        return;
      }

      // Busca todos os membros cadastrados no Supabase / IndexedDB
      const members = (await DB.getAll('members')) || [];

      // Procura pelo e-mail (ou pelo nome caso o usuário tenha digitado o nome)
      const matchedMember = members.find(
        (m) => (m.email && m.email.trim().toLowerCase() === inputEmail) ||
          (m.name && m.name.trim().toLowerCase() === inputEmail)
      );

      if (!matchedMember) {
        showToast('Usuário ou E-mail não encontrado.', 'warning');
        return;
      }

      // Validação da senha
      if (!matchedMember.password || String(matchedMember.password).trim() !== inputPassword) {
        showToast('Senha incorreta. Tente novamente.', 'warning');
        return;
      }

      const accessLevel = matchedMember.accessLevel === 'gestor' ? 'gestor' : 'colaborador';

      localStorage.setItem('app_authenticated', 'true');
      localStorage.setItem('logged_member_id', matchedMember.id);
      localStorage.setItem('logged_access_level', accessLevel);

      currentMemberFilter = accessLevel === 'gestor' ? 'all' : matchedMember.id;
      activeView = 'kanban';

      if (loginOverlay) {
        loginOverlay.classList.remove('active');
        loginOverlay.style.display = 'none';
      }

      showToast(`Bem-vindo de volta, ${matchedMember.name}!`, 'success');
      await refreshUI();
    });
  }

  // ============================================================
  // LOGOUT
  // ============================================================

  const btnLogout = document.getElementById('btn-logout');

  if (btnLogout) {
    btnLogout.addEventListener('click', () => {
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
  // PERFIL DO USUÁRIO LOGADO
  // ============================================================

  async function updateHeaderUserProfile() {
    const loggedId = getLoggedMemberId();
    if (!loggedId) return;

    const members = (await DB.getAll('members')) || [];
    const loggedMember = members.find(
      (m) => String(m.id) === String(loggedId)
    );

    if (loggedMember) {
      const avatarEl = document.getElementById('user-avatar');
      const nameEl = document.getElementById('user-name');

      if (nameEl) {
        nameEl.textContent = loggedMember.name;
      }

      if (avatarEl) {
        avatarEl.src =
          loggedMember.photo ||
          `https://ui-avatars.com/api/?name=${encodeURIComponent(
            loggedMember.name
          )}&background=6366f1&color=fff`;
      }
    }
  }

  // ============================================================
  // INICIALIZA BANCO
  // ============================================================

  await DB.init();
  checkAuthentication();

  // ============================================================
  // ELEMENTOS DA INTERFACE
  // ============================================================

  const btnNewMember = document.getElementById('btn-new-member');
  const btnNewTask = document.getElementById('btn-new-task');
  const btnViewKanban = document.getElementById('btn-view-kanban');
  const btnViewManager = document.getElementById('btn-view-manager');
  const btnViewMap = document.getElementById('btn-view-map');
  const btnViewSettings = document.getElementById('btn-view-settings');
  const btnViewProjects = document.getElementById('btn-view-projects');
  const btnViewChat = document.getElementById('btn-view-chat');

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
  // FUNÇÕES HELPER SUPABASE
  // ============================================================

  function getTransferFromMemberId(transfer) {
    return transfer.fromMemberId || transfer.from_member_id || null;
  }

  function getTransferToMemberId(transfer) {
    return transfer.to_member_id || transfer.toMemberId || null;
  }

  function getTransferTaskId(transfer) {
    return transfer.task_id || transfer.taskId || null;
  }

  function isTransferSenderAcknowledged(transfer) {
    return Boolean(transfer.sender_acknowledged ?? transfer.senderAcknowledged ?? false);
  }

  // ============================================================
  // REFRESH UI
  // ============================================================

  async function refreshUI() {
    const loggedId = getLoggedMemberId();
    const manager = isManager();

    await updateHeaderUserProfile();

    if (!manager && MANAGER_ONLY_VIEWS.includes(activeView)) {
      activeView = 'kanban';
    }

    // NOTIFICAÇÕES
    await renderTopNotificationBar();

    // ABAS DOS MEMBROS
    await renderMemberTabs();

    const memberTabsBar = document.getElementById('member-tabs-bar');
    if (memberTabsBar) {
      if (!manager) {
        memberTabsBar.style.display = 'none';
        currentMemberFilter = loggedId;
      } else {
        memberTabsBar.style.display = 'flex';
      }
    }

    // BOTÕES DE VISIBILIDADE
    if (btnNewMember) {
      btnNewMember.style.display = manager ? 'inline-block' : 'none';
    }

    [
      btnViewKanban,
      btnViewManager,
      btnViewMap,
      btnViewSettings,
      btnViewProjects,
      btnViewChat,
      btnNewTask,
    ].forEach((btn) => {
      if (btn) btn.style.display = 'inline-block';
    });

    // RESET NAVEGAÇÃO
    [
      btnViewKanban,
      btnViewManager,
      btnViewMap,
      btnViewSettings,
      btnViewProjects,
      btnViewChat,
    ].forEach((btn) => {
      if (btn) {
        btn.classList.remove('btn-primary');
        btn.classList.add('btn-secondary');
      }
    });

    [
      sectionKanban,
      sectionManager,
      sectionMap,
      sectionSettings,
      sectionProjects,
      sectionChat,
    ].forEach((sec) => {
      if (sec) sec.classList.remove('active');
    });

    // ROUTING
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

    } else {
      activeView = 'kanban';
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
    }
  }

  // ============================================================
  // BARRA DE NOTIFICAÇÕES
  // ============================================================

  async function renderTopNotificationBar() {
    const bar = document.getElementById('top-notification-bar');
    const container = document.getElementById('top-notification-list');

    if (!bar || !container) return;

    const loggedId = getLoggedMemberId();
    if (!loggedId) {
      bar.style.display = 'none';
      return;
    }

    const manager = isManager();

    try {
      const transfers = (await DB.getAll('activity_transfers')) || [];

      const pendingTransfers = transfers.filter((transfer) => {
        const toId = getTransferToMemberId(transfer);
        const status = String(transfer.status || '').trim().toUpperCase();
        return String(toId) === String(loggedId) && status === 'PENDENTE';
      });

      const senderNotices = transfers.filter((transfer) => {
        const fromId = getTransferFromMemberId(transfer);
        const acknowledged = isTransferSenderAcknowledged(transfer);
        const status = String(transfer.status || '').trim().toUpperCase();

        return (
          String(fromId) === String(loggedId) &&
          (status === 'ACEITO' || status === 'REJEITADO') &&
          !acknowledged
        );
      });

      const tasks = (await DB.getAll('tasks')) || [];
      const members = (await DB.getAll('members')) || [];
      const membersMap = new Map(members.map((m) => [String(m.id), m]));

      const today = new Date();
      const relevantTasks = manager
        ? tasks
        : tasks.filter((t) => String(t.member_id || t.memberId) === String(loggedId));

      const urgentTasks = relevantTasks.filter((task) => {
        if (String(task.status).toUpperCase() === 'CONCLUÍDO' || !task.dueDate) {
          return false;
        }

        const due = new Date(task.dueDate);
        const diffDays = Math.ceil((due - today) / (1000 * 60 * 60 * 24));
        return diffDays >= 0 && diffDays <= 2;
      });

      if (
        pendingTransfers.length === 0 &&
        senderNotices.length === 0 &&
        urgentTasks.length === 0
      ) {
        bar.style.display = 'none';
        container.innerHTML = '';
        return;
      }

      bar.style.display = 'block';
      let html = '<div translate="no">';

      pendingTransfers.forEach((firstTr) => {
        const taskId = getTransferTaskId(firstTr);
        const fromId = getTransferFromMemberId(firstTr);
        const toId = getTransferToMemberId(firstTr);

        const task = tasks.find((t) => String(t.id) === String(taskId)) || { title: 'Atividade' };
        const fromMem = membersMap.get(String(fromId)) || { name: 'Alguém' };
        const toMem = membersMap.get(String(toId)) || { name: 'Você' };

        html += `
          <div style="display:flex; justify-content:space-between; align-items:center; background:#1e1b4b; border:1px solid #4338ca; padding:0.6rem 1rem; border-radius:4px; color:#c7d2fe; font-size:0.85rem; margin-bottom:0.5rem;">
            <span>🔄 <strong>Solicitação de Transferência:</strong> "${task.title}" enviada por ${fromMem.name} para ${toMem.name}.</span>
            <div style="display:flex; gap:0.5rem;" translate="no">
              <button class="btn btn-accept-transfer" data-id="${firstTr.id}" style="padding:0.2rem 0.6rem; font-size:0.75rem; background:#10b981; border:none; color:white; font-weight:700; cursor:pointer; border-radius:4px;">Aceitar</button>
              <button class="btn btn-reject-transfer" data-id="${firstTr.id}" style="padding:0.2rem 0.6rem; font-size:0.75rem; background:#ef4444; border:none; color:white; font-weight:700; cursor:pointer; border-radius:4px;">Recusar</button>
            </div>
          </div>
        `;
      });

      senderNotices.forEach((firstNotice) => {
        const taskId = getTransferTaskId(firstNotice);
        const toId = getTransferToMemberId(firstNotice);

        const task = tasks.find((t) => String(t.id) === String(taskId)) || { title: 'Atividade' };
        const toMem = membersMap.get(String(toId)) || { name: 'Colega' };
        const accepted = String(firstNotice.status).toUpperCase() === 'ACEITO';

        const statusLabel = accepted ? 'aceitou' : 'recusou';
        const statusColor = accepted ? '#10b981' : '#ef4444';

        html += `
          <div style="display:flex; justify-content:space-between; align-items:center; background:#1e1b4b; border:1px solid #4338ca; padding:0.6rem 1rem; border-radius:4px; color:#c7d2fe; font-size:0.85rem; margin-bottom:0.5rem;">
            <span>🔄 <strong style="color:${statusColor};">${toMem.name} ${statusLabel}</strong> a transferência da atividade "${task.title}".</span>
            <button class="btn btn-ack-sender-notice" data-id="${firstNotice.id}" style="padding:0.2rem 0.6rem; font-size:0.75rem; background:#374151; border:none; color:white; font-weight:700; cursor:pointer; border-radius:4px;" translate="no">OK</button>
          </div>
        `;
      });

      if (
        pendingTransfers.length === 0 &&
        senderNotices.length === 0 &&
        urgentTasks.length > 0
      ) {
        html += `
          <div style="padding:0.6rem 1rem; background:#451a03; border:1px solid #92400e; border-radius:4px; color:#fed7aa; font-size:0.85rem;">
            ⚠️ <strong>Alerta de Prazos:</strong> Você tem ${urgentTasks.length} atividade(s) vencendo nos próximos 2 dias!
          </div>
        `;
      }

      html += '</div>';
      container.innerHTML = html;

      container.onclick = async (e) => {
        const target = e.target.closest('button');
        if (!target) return;

        const transferId = target.dataset.id;
        if (!transferId) return;

        bar.style.display = 'none';
        container.innerHTML = '';

        const transfer = await DB.get('activity_transfers', transferId);
        if (!transfer) return;

        const now = new Date().toISOString();

        if (target.classList.contains('btn-accept-transfer')) {
          e.preventDefault();

          try {
            transfer.status = 'ACEITO';
            transfer.sender_acknowledged = false;
            transfer.senderAcknowledged = false;
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

              const taskMembers = (await DB.getAll('task_members')) || [];
              const oldLinks = taskMembers.filter(
                (tm) => String(tm.taskId) === String(taskId) && String(tm.memberId || tm.member_id) === String(fromMemberId)
              );

              for (const link of oldLinks) {
                await DB.delete('task_members', link.id);
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

          transfer.status = 'REJEITADO';
          transfer.sender_acknowledged = false;
          transfer.senderAcknowledged = false;
          transfer.responded_at = now;

          await DB.save('activity_transfers', transfer);
          showToast('Solicitação de transferência recusada.', 'info');
          await refreshUI();
        }

        if (target.classList.contains('btn-ack-sender-notice')) {
          e.preventDefault();

          transfer.sender_acknowledged = true;
          transfer.senderAcknowledged = true;

          await DB.save('activity_transfers', transfer);
          showToast('Notificação confirmada.', 'info');
          await refreshUI();
        }
      };

    } catch (error) {
      console.error('❌ ERRO AO CARREGAR NOTIFICAÇÕES:', error);
      bar.style.display = 'none';
    }
  }

  // ============================================================
  // ABAS DOS MEMBROS
  // ============================================================

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
  // NAVEGAÇÃO
  // ============================================================

  if (btnViewManager) btnViewManager.addEventListener('click', () => { activeView = 'manager'; refreshUI(); });
  if (btnViewKanban) btnViewKanban.addEventListener('click', () => { activeView = 'kanban'; refreshUI(); });
  if (btnViewMap) btnViewMap.addEventListener('click', () => { activeView = 'map'; refreshUI(); });
  if (btnViewSettings) btnViewSettings.addEventListener('click', () => { activeView = 'settings'; refreshUI(); });
  if (btnViewProjects) btnViewProjects.addEventListener('click', () => { activeView = 'projects'; refreshUI(); });
  if (btnViewChat) btnViewChat.addEventListener('click', () => { activeView = 'chat'; refreshUI(); });

  document.querySelectorAll('.btn-period-filter').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.btn-period-filter').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      KanbanEngine.currentPeriodFilter = btn.dataset.period;
      refreshUI();
    });
  });

  // ============================================================
  // DETALHES E MODAIS
  // ============================================================

  async function openTaskDetailsModal(taskId) {
    const task = await DB.get('tasks', taskId);
    if (!task) return;

    const loggedId = getLoggedMemberId();
    const manager = isManager();
    const currentTaskMemberId = task.member_id || task.memberId;

    if (!manager) {
      const taskMembersAll = (await DB.getAll('task_members')) || [];
      const isInGroup = taskMembersAll.some(
        (tm) => tm.taskId === task.id && String(tm.memberId || tm.member_id) === String(loggedId)
      );

      if (String(currentTaskMemberId) !== String(loggedId) && !isInGroup) {
        showToast('Você não tem acesso a esta atividade.', 'warning');
        return;
      }
    }

    const members = (await DB.getAll('members')) || [];
    const impediments = (await DB.getAll('impediments')) || [];
    const projects = (await DB.getAll('projects')) || [];
    const taskMembers = (await DB.getAll('task_members')) || [];

    const member = members.find((m) => m.id === currentTaskMemberId) || { name: 'Não atribuído', role: '', photo: '' };
    const taskImpediments = impediments.filter((imp) => imp.taskId === task.id);
    const project = projects.find((p) => p.id === (task.projectId || task.project_id));
    const groupLinks = taskMembers.filter((tm) => tm.taskId === task.id);
    const groupMembers = members.filter((m) => groupLinks.some((gl) => gl.memberId === m.id || gl.member_id === m.id));

    const elapsedSecs = TimerEngine.getCurrentElapsedSeconds(task);
    const timeFormatted = TimerEngine.formatTime(elapsedSecs);

    const titleEl = document.getElementById('task-details-title');
    const bodyEl = document.getElementById('task-details-body');

    if (titleEl) titleEl.textContent = `📌 ${task.title}`;

    if (bodyEl) {
      bodyEl.innerHTML = `
        <div style="background:var(--bg-input); padding:1rem; border-radius:var(--radius-md); border:1px solid var(--border-color); margin-bottom:1rem;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.6rem;">
            <span class="badge-priority priority-${(task.priority || 'média').toLowerCase()}">${task.priority || 'Média'}</span>
            <span style="font-weight:700; color:var(--accent-primary);">Status: ${task.status}</span>
          </div>
          <p style="font-size:0.9rem; color:var(--text-main); margin-bottom:0.75rem;">${task.description || 'Sem descrição cadastrada.'}</p>
          <div style="display:grid; grid-template-columns:1fr 1fr; gap:0.75rem; font-size:0.8rem; color:var(--text-muted); border-top:1px solid var(--border-color); padding-top:0.6rem;">
            <div><strong>👤 Responsável:</strong> ${member.name} (${member.role || 'Membro'})</div>
            <div><strong>📅 Prazo:</strong> ${task.dueDate ? task.dueDate.split('-').reverse().join('/') : '-'}</div>
            <div><strong>⏱️ Tempo Trabalhado:</strong> ${timeFormatted}</div>
            <div><strong>📁 Projeto:</strong> ${project ? project.name : 'Nenhum'}</div>
          </div>
        </div>
      `;
    }

    openModal(modalTaskDetails);
  }

  function openReportImpedimentModal(taskId) {
    reportingTaskId = taskId;
    formImpediment.reset();
    const preview = document.getElementById('impediment-preview');
    if (preview) preview.classList.remove('active');
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
    const tasks = (await DB.getAll('tasks')) || [];
    const dayTasks = tasks.filter((task) => task.dueDate === dateStr);
    const dateFormatted = dateStr.split('-').reverse().join('/');

    const titleEl = document.getElementById('calendar-day-modal-title');
    const bodyEl = document.getElementById('calendar-day-modal-body');

    if (titleEl) titleEl.textContent = `📅 Agenda do Dia ${dateFormatted}`;

    if (bodyEl) {
      if (dayTasks.length === 0) {
        bodyEl.innerHTML = `<div style="text-align:center; padding:2rem; color:var(--text-muted);">Nenhuma atividade agendada com prazo para este dia.</div>`;
      } else {
        bodyEl.innerHTML = dayTasks.map(t => `
          <div style="background:var(--bg-input); border:1px solid var(--border-color); padding:0.75rem; border-radius:8px; margin-bottom:0.5rem;">
            <strong>${t.title}</strong>
          </div>
        `).join('');
      }
    }
    openModal(modalCalendarDay);
  }

  async function handleDeleteMember(memberId, memberName) {
    if (!isManager()) return;
    if (confirm(`Remover ${memberName}?`)) {
      await DB.delete('members', memberId);
      showToast('Membro removido!', 'success');
      refreshUI();
    }
  }

  function openModal(modal) { if (modal) modal.classList.add('active'); }
  function closeModal(modal) { if (modal) modal.classList.remove('active'); }

  document.querySelectorAll('.modal-close, .btn-modal-cancel').forEach((btn) => {
    btn.addEventListener('click', (e) => closeModal(e.target.closest('.modal-overlay')));
  });

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

  // ============================================================
  // DRAG AND DROP & CRONÔMETRO
  // ============================================================

  KanbanEngine.initDragAndDrop(async (task, fromStatus, toStatus) => {
    showToast(`Tarefa movida para ${toStatus}`, 'info');
    refreshUI();
  });

  TimerEngine.startGlobalTicker();
  UndoEngine.initKeyboardShortcut(refreshUI, showToast);

  await refreshUI();
});