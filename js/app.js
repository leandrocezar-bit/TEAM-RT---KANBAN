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

document.addEventListener('DOMContentLoaded', async () => {
  let activeView = 'kanban'; // 'kanban', 'manager', 'map', 'settings', 'projects'
  let currentMemberFilter = 'all';
  let reportingTaskId = null;

  // Views restritas a usuários com nível de acesso "gestor"
  // Dashboard, Fluxo RT e Configurações agora são visíveis para todos os colaboradores.
  const MANAGER_ONLY_VIEWS = [];

  // --- 1. AUTENTICAÇÃO INDIVIDUAL POR E-MAIL + SENHA ---
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
      if (loginOverlay) loginOverlay.classList.remove('active');

      // Força o filtro global do painel no ID do usuário logado
      const loggedId = getLoggedMemberId();
      if (loggedId) {
        currentMemberFilter = loggedId;
      }
    } else {
      if (loginOverlay) loginOverlay.classList.add('active');
    }
  }

  if (formLogin) {
    formLogin.addEventListener('submit', async (e) => {
      e.preventDefault();
      const inputEmail = document.getElementById('input-login-user').value.trim().toLowerCase();
      const inputPassword = document.getElementById('input-passcode').value;

      if (!inputEmail || !inputPassword) {
        showToast('Informe e-mail e senha para entrar.', 'warning');
        return;
      }

      // Busca o colaborador cadastrado pelo e-mail
      const members = await DB.getAll('members');
      const matchedMember = members.find(m => m.email && m.email.toLowerCase() === inputEmail);

      if (!matchedMember) {
        showToast('E-mail não encontrado na lista de colaboradores.', 'warning');
        return;
      }

      // NOTA DE SEGURANÇA: comparação de senha em texto puro no cliente.
      // Para produção real, o ideal é migrar para o Supabase Auth (hash de senha no servidor).
      if (!matchedMember.password || matchedMember.password !== inputPassword) {
        showToast('Senha incorreta. Tente novamente.', 'warning');
        return;
      }

      const accessLevel = matchedMember.accessLevel === 'gestor' ? 'gestor' : 'colaborador';

      localStorage.setItem('app_authenticated', 'true');
      localStorage.setItem('logged_member_id', matchedMember.id);
      localStorage.setItem('logged_access_level', accessLevel);
      currentMemberFilter = matchedMember.id;
      activeView = 'kanban';

      if (loginOverlay) loginOverlay.classList.remove('active');
      showToast(`Bem-vindo de volta, ${matchedMember.name}!`, 'success');
      refreshUI();
    });
  }

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

  checkAuthentication();

  async function updateHeaderUserProfile() {
    const loggedId = getLoggedMemberId();
    if (!loggedId) return;

    const members = await DB.getAll('members');
    const loggedMember = members.find(m => String(m.id) === String(loggedId));

    if (loggedMember) {
      const avatarEl = document.getElementById('user-avatar');
      const nameEl = document.getElementById('user-name');

      if (nameEl) nameEl.textContent = loggedMember.name;
      if (avatarEl) {
        avatarEl.src = loggedMember.photo ||
          `https://ui-avatars.com/api/?name=${encodeURIComponent(loggedMember.name)}&background=6366f1&color=fff`;
      }
    }
  }

  // Inicializa Banco de Dados Supabase (ou cache offline)
  await DB.init();

  // Elementos do DOM
  const btnNewMember = document.getElementById('btn-new-member');
  const btnNewTask = document.getElementById('btn-new-task');
  const btnViewKanban = document.getElementById('btn-view-kanban');
  const btnViewManager = document.getElementById('btn-view-manager');
  const btnViewMap = document.getElementById('btn-view-map');
  const btnViewSettings = document.getElementById('btn-view-settings');
  const btnViewProjects = document.getElementById('btn-view-projects');
  const btnResetDb = document.getElementById('btn-reset-db');

  if (btnResetDb) {
    btnResetDb.addEventListener('click', async () => {
      if (!isManager()) {
        showToast('Apenas gestores podem restaurar os dados.', 'warning');
        return;
      }
      if (confirm('Deseja realmente restaurar os dados iniciais padrão no Supabase/App?')) {
        await DB.resetDatabase();
        currentMemberFilter = 'all';
        showToast('Dados iniciais restaurados com sucesso!', 'success');
        refreshUI();
      }
    });
  }

  const sectionKanban = document.getElementById('section-kanban');
  const sectionManager = document.getElementById('section-manager');
  const sectionMap = document.getElementById('section-map');
  const sectionSettings = document.getElementById('section-settings');
  const sectionProjects = document.getElementById('section-projects');

  // Modais
  const modalMember = document.getElementById('modal-member');
  const modalEditProfile = document.getElementById('modal-edit-profile');
  const modalTask = document.getElementById('modal-task');
  const modalTaskDetails = document.getElementById('modal-task-details');
  const modalImpediment = document.getElementById('modal-impediment');
  const modalEvidence = document.getElementById('modal-evidence');
  const modalCalendarDay = document.getElementById('modal-calendar-day');
  const modalProject = document.getElementById('modal-project');
  const modalTaskGroup = document.getElementById('modal-task-group');

  // Formulários
  const formMember = document.getElementById('form-member');
  const formEditProfile = document.getElementById('form-edit-profile');
  const formTask = document.getElementById('form-task');
  const formImpediment = document.getElementById('form-impediment');
  const formProject = document.getElementById('form-project');

  /**
   * Atualiza a Interface completa
   */
  async function refreshUI() {
    const loggedId = getLoggedMemberId();
    const manager = isManager();

    // ⬇️ LINHA ADICIONADA: Atualiza a foto e o nome no topo
    await updateHeaderUserProfile();

    // Colaborador comum não pode ficar preso numa view restrita (ex: veio de sessão anterior como gestor)
    if (!manager && MANAGER_ONLY_VIEWS.includes(activeView)) {
      activeView = 'kanban';
    }

    const backupFilter = currentMemberFilter;

    // Força temporariamente a leitura global antes de rodar a barra de notificações
    currentMemberFilter = 'all';
    await renderTopNotificationBar();

    // Devolve o filtro seguro do usuário logado
    currentMemberFilter = loggedId ? loggedId : backupFilter;

    await renderMemberTabs();
    const memberTabsBar = document.getElementById('member-tabs-bar');

    // ACESSO INDIVIDUALIZADO: colaborador comum nunca vê abas/dados dos colegas, em nenhuma seção
    if (memberTabsBar) {
      if (!manager) {
        memberTabsBar.style.display = 'none';
        currentMemberFilter = loggedId;
      } else {
        memberTabsBar.style.display = 'flex';
      }
    }

    // Apenas cadastrar colaborador e restaurar dados continuam exclusivos de gestor.
    // Dashboard, Fluxo RT e Configurações agora ficam visíveis para todos.
    const managerOnlyButtons = [btnNewMember, btnResetDb];
    managerOnlyButtons.forEach(btn => {
      if (btn) btn.style.display = manager ? 'inline-block' : 'none';
    });
    const openButtons = [btnViewKanban, btnViewManager, btnViewMap, btnViewSettings, btnViewProjects, btnNewTask];
    openButtons.forEach(btn => {
      if (btn) btn.style.display = 'inline-block';
    });

    // Reset visual dos botões de navegação
    [btnViewKanban, btnViewManager, btnViewMap, btnViewSettings, btnViewProjects].forEach(btn => {
      if (btn) {
        btn.classList.remove('btn-primary');
        btn.classList.add('btn-secondary');
      }
    });

    [sectionKanban, sectionManager, sectionMap, sectionSettings, sectionProjects].forEach(sec => {
      if (sec) sec.classList.remove('active');
    });

    if (activeView === 'kanban') {
      if (sectionKanban) sectionKanban.classList.add('active');
      if (btnViewKanban) {
        btnViewKanban.classList.add('btn-primary');
        btnViewKanban.classList.remove('btn-secondary');
      }

      await KanbanEngine.renderBoard(currentMemberFilter, {
        onRefresh: refreshUI,
        onReportImpediment: openReportImpedimentModal,
        onOpenTaskDetails: openTaskDetailsModal
      });
    } else if (activeView === 'manager') {
      if (sectionManager) sectionManager.classList.add('active');
      if (btnViewManager) {
        btnViewManager.classList.add('btn-primary');
        btnViewManager.classList.remove('btn-secondary');
      }

      await ManagerEngine.renderDashboard(openEvidenceModal, handleDeleteMember, openCalendarDayModal);
    } else if (activeView === 'map') {
      if (sectionMap) sectionMap.classList.add('active');
      if (btnViewMap) {
        btnViewMap.classList.add('btn-primary');
        btnViewMap.classList.remove('btn-secondary');
      }

      await MapEngine.renderSectorMap();
    } else if (activeView === 'settings') {
      if (sectionSettings) sectionSettings.classList.add('active');
      if (btnViewSettings) {
        btnViewSettings.classList.add('btn-primary');
        btnViewSettings.classList.remove('btn-secondary');
      }

      // Colaborador comum só deve ver as próprias atividades dentro de Configurações.
      await SettingsEngine.renderSettingsSection(showToast, refreshUI, {
        isManager: manager,
        memberId: loggedId
      });
    } else if (activeView === 'projects') {
      if (sectionProjects) sectionProjects.classList.add('active');
      if (btnViewProjects) {
        btnViewProjects.classList.add('btn-primary');
        btnViewProjects.classList.remove('btn-secondary');
      }

      await ProjectsEngine.renderProjectsSection(showToast, refreshUI);
    } else {
      // Fallback de segurança: se caiu aqui sem permissão, volta pro Kanban
      activeView = 'kanban';
      if (sectionKanban) sectionKanban.classList.add('active');
      if (btnViewKanban) {
        btnViewKanban.classList.add('btn-primary');
        btnViewKanban.classList.remove('btn-secondary');
      }
      await KanbanEngine.renderBoard(currentMemberFilter, {
        onRefresh: refreshUI,
        onReportImpediment: openReportImpedimentModal,
        onOpenTaskDetails: openTaskDetailsModal
      });
    }
  }

  /**
   * Renderiza a Barra de Notificações e Pendências de Aceite no Topo da Página
   * Regra: cada notificação só aparece para quem está diretamente envolvido
   * (quem enviou a transferência ou quem deveria recebê-la).
   */
  async function renderTopNotificationBar() {
    const bar = document.getElementById('top-notification-bar');
    const container = document.getElementById('top-notification-list');
    if (!bar || !container) return;

    const loggedId = getLoggedMemberId();
    const manager = isManager();
    const transfers = await DB.getAll('activity_transfers');

    // Notificações recebidas: transferências pendentes destinadas a mim
    const pendingTransfers = transfers.filter(t =>
      t.status === 'PENDENTE' && loggedId && String(t.toMemberId) === String(loggedId)
    );

    // Notificações de retorno: transferências que eu enviei e já foram respondidas (aceitas/recusadas)
    const senderNotices = transfers.filter(t =>
      loggedId &&
      String(t.fromMemberId) === String(loggedId) &&
      (t.status === 'ACEITO' || t.status === 'REJEITADO') &&
      !t.senderAcknowledged
    );

    const tasks = await DB.getAll('tasks');
    const members = await DB.getAll('members');
    const membersMap = new Map(members.map(m => [m.id, m]));

    // Alertas de prazo de 2 dias: gestor vê de todos, colaborador só vê os seus
    const today = new Date();
    const relevantTasks = manager ? tasks : tasks.filter(t => String(t.memberId) === String(loggedId));
    const urgentTasks = relevantTasks.filter(t => {
      if (t.status === 'CONCLUÍDO' || !t.dueDate) return false;
      const due = new Date(t.dueDate);
      const diffDays = Math.ceil((due - today) / (1000 * 60 * 60 * 24));
      return diffDays >= 0 && diffDays <= 2;
    });

    if (pendingTransfers.length === 0 && senderNotices.length === 0 && urgentTasks.length === 0) {
      bar.style.display = 'none';
      return;
    }

    bar.style.display = 'block';
    let html = `<div>`;

    if (pendingTransfers.length > 0) {
      const firstTr = pendingTransfers[0];
      const task = tasks.find(t => t.id === firstTr.taskId) || { title: 'Atividade' };
      const fromMem = membersMap.get(firstTr.fromMemberId) || { name: 'Alguém' };
      const toMem = membersMap.get(firstTr.toMemberId) || { name: 'Você' };

      html += ` 
        <div style="display:flex; justify-content:space-between; align-items:center; background:#1e1b4b; border:1px solid #4338ca; padding:0.6rem 1rem; border-radius:4px; color:#c7d2fe; font-size:0.85rem; margin-bottom:0.5rem;"> 
          <span>🔄 <strong>Solicitação de Transferência:</strong> "${task.title}" enviada por ${fromMem.name} para ${toMem.name}.</span> 
          <div style="display:flex; gap:0.5rem;"> 
            <button class="btn btn-primary btn-accept-transfer" data-id="${firstTr.id}" style="padding:0.2rem 0.6rem; font-size:0.75rem; background:#10b981; border:none; color:white; font-weight:700; cursor:pointer; border-radius:4px;">Aceitar</button> 
            <button class="btn btn-secondary btn-reject-transfer" data-id="${firstTr.id}" style="padding:0.2rem 0.6rem; font-size:0.75rem; background:#ef4444; border:none; color:white; font-weight:700; cursor:pointer; border-radius:4px;">Recusar</button> 
          </div> 
        </div> 
      `;
    } else if (senderNotices.length > 0) {
      const firstNotice = senderNotices[0];
      const task = tasks.find(t => t.id === firstNotice.taskId) || { title: 'Atividade' };
      const toMem = membersMap.get(firstNotice.toMemberId) || { name: 'Colega' };
      const statusLabel = firstNotice.status === 'ACEITO' ? 'aceitou' : 'recusou';
      const statusColor = firstNotice.status === 'ACEITO' ? '#10b981' : '#ef4444';

      html += ` 
        <div style="display:flex; justify-content:space-between; align-items:center; background:#1e1b4b; border:1px solid #4338ca; padding:0.6rem 1rem; border-radius:4px; color:#c7d2fe; font-size:0.85rem; margin-bottom:0.5rem;"> 
          <span>🔄 <strong style="color:${statusColor};">${toMem.name} ${statusLabel}</strong> a transferência da atividade "${task.title}".</span> 
          <div style="display:flex; gap:0.5rem;"> 
            <button class="btn btn-secondary btn-ack-sender-notice" data-id="${firstNotice.id}" style="padding:0.2rem 0.6rem; font-size:0.75rem; background:#374151; border:none; color:white; font-weight:700; cursor:pointer; border-radius:4px;">OK</button> 
          </div> 
        </div> 
      `;
    } else if (urgentTasks.length > 0) {
      html += ` 
        <span> 
          ⚠️ <strong>Alerta de Prazos:</strong> Você tem ${urgentTasks.length} atividade(s) vencendo nos próximos 2 dias! 
        </span> 
      `;
    }

    html += `</div>`;
    container.innerHTML = html;

    const btnAccept = container.querySelector('.btn-accept-transfer');
    if (btnAccept) {
      btnAccept.addEventListener('click', async () => {
        const transferId = btnAccept.dataset.id;
        const transfer = await DB.get('activity_transfers', transferId);
        if (transfer) {
          transfer.status = 'ACEITO';
          transfer.senderAcknowledged = false;
          transfer.requested_at = new Date().toISOString();
          await DB.save('activity_transfers', transfer);
          const task = await DB.get('tasks', transfer.taskId);
          if (task) {
            task.memberId = transfer.toMemberId;
            await DB.save('tasks', task);
          }
          showToast('Transferência de atividade aceita!', 'success');
          await refreshUI();
        }
      });
    }

    const btnReject = container.querySelector('.btn-reject-transfer');
    if (btnReject) {
      btnReject.addEventListener('click', async () => {
        const transferId = btnReject.dataset.id;
        const transfer = await DB.get('activity_transfers', transferId);
        if (transfer) {
          transfer.status = 'REJEITADO';
          transfer.senderAcknowledged = false;
          transfer.requested_at = new Date().toISOString();
          await DB.save('activity_transfers', transfer);
          showToast('Solicitação de transferência recusada.', 'info');
          await refreshUI();
        }
      });
    }

    const btnAckNotice = container.querySelector('.btn-ack-sender-notice');
    if (btnAckNotice) {
      btnAckNotice.addEventListener('click', async () => {
        const transferId = btnAckNotice.dataset.id;
        const transfer = await DB.get('activity_transfers', transferId);
        if (transfer) {
          transfer.senderAcknowledged = true;
          await DB.save('activity_transfers', transfer);
          await refreshUI();
        }
      });
    }
  }

  /**
   * Renderiza a barra de abas de membros no topo (somente visível para gestores)
   */
  async function renderMemberTabs() {
    const container = document.getElementById('member-tabs-bar');
    if (!container) return;

    if (!isManager()) {
      container.innerHTML = '';
      return;
    }

    const members = await DB.getAll('members');

    let html = `
      <button class="tab-btn ${currentMemberFilter === 'all' ? 'active' : ''}" data-id="all">
        👥 Todos os Membros
      </button>
    `;

    members.forEach(m => {
      html += `
        <button class="tab-btn ${currentMemberFilter === m.id ? 'active' : ''}" data-id="${m.id}">
          <img src="${m.photo}" alt="${m.name}" class="tab-avatar">
          <span>${m.name.split(' ')[0]}</span>
        </button>
      `;
    });

    container.innerHTML = html;

    container.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        currentMemberFilter = btn.dataset.id;
        activeView = 'kanban';
        refreshUI();
      });
    });
  }

  /**
   * Remove um membro da equipe e limpa suas tarefas (somente gestor)
   */
  async function handleDeleteMember(memberId, memberName) {
    if (!isManager()) {
      showToast('Apenas gestores podem remover colaboradores.', 'warning');
      return;
    }

    const member = await DB.get('members', memberId);
    if (confirm(`Tem certeza que deseja remover o membro "${memberName}" da equipe?\nEsta ação também removerá as atividades vinculadas.`)) {
      await DB.delete('members', memberId);

      const tasks = await DB.getAll('tasks');
      const memberTasks = tasks.filter(t => t.memberId === memberId);
      for (const task of memberTasks) {
        await DB.delete('tasks', task.id);
      }

      UndoEngine.pushAction({
        type: 'MEMBER_DELETE',
        member
      });

      if (currentMemberFilter === memberId) {
        currentMemberFilter = 'all';
      }

      showToast(`Membro ${memberName} foi removido com sucesso!`, 'success');
      refreshUI();
    }
  }

  /**
   * Abre Modal de Detalhes da Atividade (Requirement 3: Clicou, entendeu o que está sendo feito)
   */
  async function openTaskDetailsModal(taskId) {
    const task = await DB.get('tasks', taskId);
    if (!task) return;

    // Acesso individualizado: colaborador comum só pode abrir detalhes das próprias atividades
    // (ou de atividades em grupo das quais participa)
    const loggedId = getLoggedMemberId();
    const manager = isManager();
    if (!manager) {
      const taskMembersAll = await DB.getAll('task_members');
      const isInGroup = taskMembersAll.some(tm => tm.taskId === task.id && String(tm.memberId) === String(loggedId));
      if (String(task.memberId) !== String(loggedId) && !isInGroup) {
        showToast('Você não tem acesso a esta atividade.', 'warning');
        return;
      }
    }

    const members = await DB.getAll('members');
    const impediments = await DB.getAll('impediments');
    const projects = await DB.getAll('projects');
    const taskMembers = await DB.getAll('task_members');

    const member = members.find(m => m.id === task.memberId) || { name: 'Não atribuído', role: '', photo: '' };
    const taskImpediments = impediments.filter(imp => imp.taskId === task.id);
    const project = projects.find(p => p.id === task.projectId);

    const groupLinks = taskMembers.filter(tm => tm.taskId === task.id);
    const groupMembers = members.filter(m => groupLinks.some(gl => gl.memberId === m.id));

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

          ${groupMembers.length > 0 ? `
            <div style="margin-top:0.75rem; border-top:1px solid var(--border-color); padding-top:0.5rem; font-size:0.8rem;">
              <strong>👥 Equipe no Grupo:</strong>
              <div style="display:flex; align-items:center; gap:0.4rem; margin-top:0.3rem;">
                ${groupMembers.map(gm => `
                  <span style="display:inline-flex; align-items:center; gap:0.3rem; background:rgba(255,255,255,0.06); padding:0.2rem 0.5rem; border-radius:var(--radius-full);">
                    <img src="${gm.photo}" style="width:18px; height:18px; border-radius:50%;">
                    <span>${gm.name}</span>
                  </span>
                `).join('')}
              </div>
            </div>
          ` : ''}
        </div>

        <h4 style="font-size:0.95rem; font-weight:700; margin-bottom:0.6rem;">⚠️ Contratempos Registrados (${taskImpediments.length})</h4>
        ${taskImpediments.length === 0 ? `
          <p style="font-size:0.8rem; color:var(--text-dim);">Nenhum contratempo relatado para esta atividade.</p>
        ` : taskImpediments.map(imp => `
          <div style="background:rgba(239,68,68,0.08); border:1px solid rgba(239,68,68,0.2); border-radius:var(--radius-sm); padding:0.6rem; margin-bottom:0.5rem; font-size:0.8rem;">
            <p style="color:#ef4444; font-weight:600;">"${imp.description}"</p>
            <span style="font-size:0.7rem; color:var(--text-dim);">Registrado em: ${new Date(imp.createdAt).toLocaleString('pt-BR')}</span>
          </div>
        `).join('')}

        <div style="display:flex; gap:0.5rem; margin-top:1.25rem; border-top:1px solid var(--border-color); padding-top:1rem;">
          <button class="btn btn-primary btn-trigger-edit-task" data-id="${task.id}" style="font-size:0.8rem;">✏️ Editar Atividade</button>
          <button class="btn btn-secondary btn-trigger-delete-task" data-id="${task.id}" style="font-size:0.8rem; background:rgba(239,68,68,0.15); color:#ef4444;">🗑️ Excluir Atividade</button>
        </div>
      `;

      bodyEl.querySelector('.btn-trigger-edit-task').addEventListener('click', async () => {
        closeModal(modalTaskDetails);
        await populateTaskMemberSelect();
        await populateTaskProjectSelect();

        document.getElementById('task-id').value = task.id;
        document.getElementById('task-title').value = task.title;
        document.getElementById('task-desc').value = task.description || '';
        document.getElementById('task-member').value = task.memberId;
        document.getElementById('task-project').value = task.projectId || '';
        document.getElementById('task-priority').value = task.priority || 'Média';
        document.getElementById('task-date').value = task.dueDate || '';

        const headerTitle = document.getElementById('modal-task-title-header');
        if (headerTitle) headerTitle.textContent = '✏️ Editar Atividade';
        openModal(modalTask);
      });

      bodyEl.querySelector('.btn-trigger-delete-task').addEventListener('click', async () => {
        if (confirm(`Tem certeza que deseja excluir a atividade "${task.title}"?`)) {
          await DB.delete('tasks', task.id);
          UndoEngine.pushAction({ type: 'TASK_DELETE', task });
          closeModal(modalTaskDetails);
          showToast(`Atividade "${task.title}" excluída.`, 'info');
          refreshUI();
        }
      });
    }

    openModal(modalTaskDetails);
  }

  /**
   * Abre Modal de Agenda do Dia no Calendário
   */
  async function openCalendarDayModal(dateStr) {
    const tasks = await DB.getAll('tasks');
    const members = await DB.getAll('members');
    const membersMap = new Map(members.map(m => [m.id, m]));

    const dayTasks = tasks.filter(t => t.dueDate === dateStr);
    const dateFormatted = dateStr.split('-').reverse().join('/');

    const titleEl = document.getElementById('calendar-day-modal-title');
    const bodyEl = document.getElementById('calendar-day-modal-body');

    if (titleEl) titleEl.textContent = `📅 Agenda do Dia ${dateFormatted}`;

    if (bodyEl) {
      if (dayTasks.length === 0) {
        bodyEl.innerHTML = `
          <div style="text-align:center; padding:2rem; color:var(--text-muted);">
            Nenhuma atividade agendada com prazo para este dia.
          </div>
        `;
      } else {
        bodyEl.innerHTML = dayTasks.map(t => {
          const m = membersMap.get(t.memberId) || { name: 'Desconhecido', photo: '' };
          return `
            <div style="background:var(--bg-input); border:1px solid var(--border-color); border-radius:var(--radius-md); padding:0.85rem; margin-bottom:0.75rem; display:flex; justify-content:space-between; align-items:center;">
              <div>
                <strong style="font-size:0.9rem;">${t.title}</strong>
                <p style="font-size:0.75rem; color:var(--text-muted);">${t.description || ''}</p>
                <div style="font-size:0.75rem; color:var(--text-dim); margin-top:0.3rem;">
                  👤 Responsável: <strong>${m.name}</strong>
                </div>
              </div>
              <span class="badge-priority priority-${(t.priority || 'média').toLowerCase()}">${t.priority || 'Média'}</span>
            </div>
          `;
        }).join('');
      }
    }

    openModal(modalCalendarDay);
  }

  /**
   * Abre Modal de Registrar Contratempo
   */
  function openReportImpedimentModal(taskId) {
    reportingTaskId = taskId;
    formImpediment.reset();
    document.getElementById('impediment-preview').classList.remove('active');
    openModal(modalImpediment);
  }

  /**
   * Abre Modal de Visualizar Evidência (Foto)
   */
  function openEvidenceModal(imgDataUrl) {
    const imgEl = document.getElementById('evidence-modal-img');
    if (imgEl) {
      imgEl.src = imgDataUrl;
      openModal(modalEvidence);
    }
  }

  // --- Gerenciamento de Modais ---

  function openModal(modal) {
    if (modal) modal.classList.add('active');
  }

  function closeModal(modal) {
    if (modal) modal.classList.remove('active');
  }

  document.querySelectorAll('.modal-close, .btn-modal-cancel').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const modal = e.target.closest('.modal-overlay');
      closeModal(modal);
    });
  });

  if (btnNewMember) {
    btnNewMember.addEventListener('click', () => {
      if (!isManager()) {
        showToast('Apenas gestores podem cadastrar colaboradores.', 'warning');
        return;
      }
      formMember.reset();
      document.getElementById('member-photo-preview').classList.remove('active');
      openModal(modalMember);
    });
  }

  if (btnNewTask) {
    btnNewTask.addEventListener('click', async () => {
      formTask.reset();
      document.getElementById('task-id').value = '';
      const headerTitle = document.getElementById('modal-task-title-header');
      if (headerTitle) headerTitle.textContent = '📌 Nova Atividade';
      await populateTaskMemberSelect();
      await populateTaskProjectSelect();
      document.getElementById('task-date').value = new Date().toISOString().slice(0, 10);
      openModal(modalTask);
    });
  }

  if (btnViewManager) btnViewManager.addEventListener('click', () => { activeView = 'manager'; refreshUI(); });
  if (btnViewKanban) btnViewKanban.addEventListener('click', () => { activeView = 'kanban'; refreshUI(); });
  if (btnViewMap) btnViewMap.addEventListener('click', () => { activeView = 'map'; refreshUI(); });
  if (btnViewSettings) btnViewSettings.addEventListener('click', () => { activeView = 'settings'; refreshUI(); });
  if (btnViewProjects) btnViewProjects.addEventListener('click', () => { activeView = 'projects'; refreshUI(); });

  // Botões do Filtro de Período do Kanban
  document.querySelectorAll('.btn-period-filter').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.btn-period-filter').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      KanbanEngine.currentPeriodFilter = btn.dataset.period;
      refreshUI();
    });
  });

  async function populateTaskMemberSelect() {
    const select = document.getElementById('task-member');
    if (!select) return;
    const manager = isManager();
    const loggedId = getLoggedMemberId();
    const members = await DB.getAll('members');
    // Colaborador comum só pode atribuir/transferir atividades entre si e colegas existentes,
    // mas a criação de atividade para si mesmo é sempre permitida.
    const options = manager ? members : members;
    select.innerHTML = options.map(m => `<option value="${m.id}" ${!manager && m.id === loggedId ? 'selected' : ''}>${m.name} (${m.role || 'Membro'})</option>`).join('');
  }

  async function populateTaskProjectSelect() {
    const select = document.getElementById('task-project');
    if (!select) return;
    const projects = await DB.getAll('projects');
    select.innerHTML = `<option value="">-- Sem Projeto --</option>` + projects.map(p => `<option value="${p.id}">${p.name}</option>`).join('');
  }

  // --- Previews de Imagem ---
  const memberPhotoInput = document.getElementById('member-photo');
  if (memberPhotoInput) {
    memberPhotoInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (evt) => {
          const preview = document.getElementById('member-photo-preview');
          preview.src = evt.target.result;
          preview.classList.add('active');
        };
        reader.readAsDataURL(file);
      }
    });
  }

  const editProfilePhotoInput = document.getElementById('edit-profile-photo');
  if (editProfilePhotoInput) {
    editProfilePhotoInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (evt) => {
          const preview = document.getElementById('edit-profile-preview');
          preview.src = evt.target.result;
          preview.classList.add('active');
        };
        reader.readAsDataURL(file);
      }
    });
  }

  const impedimentPhotoInput = document.getElementById('impediment-file');
  if (impedimentPhotoInput) {
    impedimentPhotoInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (evt) => {
          const preview = document.getElementById('impediment-preview');
          preview.src = evt.target.result;
          preview.classList.add('active');
        };
        reader.readAsDataURL(file);
      }
    });
  }

  // --- Submissão de Formulários ---

  if (formMember) {
    formMember.addEventListener('submit', async (e) => {
      e.preventDefault();

      if (!isManager()) {
        showToast('Apenas gestores podem cadastrar colaboradores.', 'warning');
        return;
      }

      const name = document.getElementById('member-name').value;
      const role = document.getElementById('member-role').value;
      const contact = document.getElementById('member-contact').value;
      // Campos novos — precisam existir no HTML do modal-member (ver instruções)
      const emailField = document.getElementById('member-email');
      const passwordField = document.getElementById('member-password');
      const accessLevelField = document.getElementById('member-access-level');

      const email = emailField ? emailField.value.trim() : contact;
      const password = passwordField ? passwordField.value : '';
      const accessLevel = accessLevelField ? accessLevelField.value : 'colaborador';

      if (!email || !password) {
        showToast('E-mail e senha de acesso são obrigatórios para o colaborador.', 'warning');
        return;
      }

      const photoPreview = document.getElementById('member-photo-preview');
      let photoData = photoPreview.src;

      if (!photoPreview.classList.contains('active') || !photoData) {
        const initials = name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
        const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100"><rect width="100" height="100" fill="#6366f1"/><text x="50%" y="55%" dominant-baseline="middle" text-anchor="middle" fill="#ffffff" font-family="sans-serif" font-size="40" font-weight="bold">${initials}</text></svg>`;
        photoData = 'data:image/svg+xml;base64,' + btoa(svg);
      }

      const newMember = {
        id: 'm-' + Date.now(),
        name,
        role,
        contact,
        email,
        password,
        accessLevel: accessLevel === 'gestor' ? 'gestor' : 'colaborador',
        photo: photoData
      };

      await DB.save('members', newMember);
      showToast(`Membro ${name} cadastrado com sucesso!`, 'success');
      closeModal(modalMember);
      refreshUI();
    });
  }

  if (formEditProfile) {
    formEditProfile.addEventListener('submit', async (e) => {
      e.preventDefault();

      const memberId = document.getElementById('edit-profile-id').value;
      const name = document.getElementById('edit-profile-name').value;
      const role = document.getElementById('edit-profile-role').value;
      const email = document.getElementById('edit-profile-email').value;
      const preview = document.getElementById('edit-profile-preview');

      // Campos novos — precisam existir no HTML do modal-edit-profile (ver instruções)
      const passwordField = document.getElementById('edit-profile-password');
      const accessLevelField = document.getElementById('edit-profile-access-level');

      const member = await DB.get('members', memberId);
      if (member) {
        member.name = name;
        member.role = role;
        member.email = email;
        member.contact = email;
        if (preview.src) member.photo = preview.src;

        // Só permite alterar senha do próprio usuário
        if (passwordField && passwordField.value) {
          member.password = passwordField.value;
        }

        // Só um gestor pode alterar o nível de acesso de alguém (inclusive o próprio, com cautela)
        if (isManager() && accessLevelField && accessLevelField.value) {
          member.accessLevel = accessLevelField.value === 'gestor' ? 'gestor' : 'colaborador';
        }

        await DB.save('members', member);

        // Se o usuário editou o próprio nível de acesso ou logou como esse membro, atualiza a sessão
        if (String(memberId) === String(getLoggedMemberId())) {
          localStorage.setItem('logged_access_level', member.accessLevel === 'gestor' ? 'gestor' : 'colaborador');
        }

        showToast('Perfil atualizado com sucesso!', 'success');
        closeModal(modalEditProfile);
        refreshUI();
      }
    });
  }

  if (formTask) {
    formTask.addEventListener('submit', async (e) => {
      e.preventDefault();

      const existingTaskId = document.getElementById('task-id').value;
      const title = document.getElementById('task-title').value;
      const description = document.getElementById('task-desc').value;
      const memberId = document.getElementById('task-member').value;
      const projectId = document.getElementById('task-project').value || null;
      const priority = document.getElementById('task-priority').value;
      const dueDate = document.getElementById('task-date').value;

      if (existingTaskId) {
        // Modo Edição de Atividade Existente
        const task = await DB.get('tasks', existingTaskId);
        if (task) {
          // Acesso individualizado: colaborador comum só edita as próprias atividades
          if (!isManager() && String(task.memberId) !== String(getLoggedMemberId())) {
            showToast('Você não tem permissão para editar esta atividade.', 'warning');
            return;
          }

          const previousState = { ...task };
          task.title = title;
          task.description = description;
          task.memberId = memberId;
          task.projectId = projectId;
          task.priority = priority;
          task.dueDate = dueDate;

          await DB.save('tasks', task);
          UndoEngine.pushAction({
            type: 'TASK_UPDATE',
            previousState
          });
          showToast(`Atividade "${title}" atualizada com sucesso!`, 'success');
        }
      } else {
        // Modo Criação de Nova Atividade
        const newTask = {
          id: 't-' + Date.now(),
          title,
          description,
          memberId,
          projectId,
          priority,
          dueDate,
          status: 'A FAZER',
          elapsedSeconds: 0,
          isTimerRunning: false,
          lastTimerStartedAt: null,
          sortOrder: Date.now(),
          createdAt: new Date().toISOString()
        };

        await DB.save('tasks', newTask);

        UndoEngine.pushAction({
          type: 'TASK_CREATE',
          taskId: newTask.id
        });

        showToast('Nova atividade criada e vinculada!', 'success');
      }

      closeModal(modalTask);
      refreshUI();
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
        createdAt: new Date().toISOString()
      };

      await DB.save('projects', newProject);
      showToast(`Projeto "${name}" criado com sucesso!`, 'success');
      closeModal(modalProject);
      refreshUI();
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
        createdAt: new Date().toISOString()
      };

      await DB.save('impediments', newImpediment);
      showToast('Contratempo registrado para a tarefa!', 'warning');
      closeModal(modalImpediment);
      refreshUI();
    });
  }

  // Salvar Integrantes do Grupo da Atividade
  const btnSaveTaskGroup = document.getElementById('task-group-save-btn');
  if (btnSaveTaskGroup) {
    btnSaveTaskGroup.addEventListener('click', async () => {
      const taskId = btnSaveTaskGroup.dataset.taskId;
      if (!taskId) return;

      const checkboxes = document.querySelectorAll('.chk-group-member');
      const existingTaskMembers = await DB.getAll('task_members');

      // Limpa os membros do grupo desta tarefa
      const currentGroupTasks = existingTaskMembers.filter(tm => tm.taskId === taskId);
      for (const tm of currentGroupTasks) {
        await DB.delete('task_members', tm.id);
      }

      // Adiciona selecionados
      for (const chk of checkboxes) {
        if (chk.checked) {
          const newTm = {
            id: 'tm-' + Date.now() + Math.floor(Math.random() * 1000),
            taskId,
            memberId: chk.dataset.memberId,
            roleInTask: 'Colaborador',
            createdAt: new Date().toISOString()
          };
          await DB.save('task_members', newTm);
        }
      }

      showToast('Integrantes do grupo atualizados com sucesso!', 'success');
      closeModal(modalTaskGroup);
      refreshUI();
    });
  }

  /**
   * Sistema de Toasts
   */
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

  // Inicialização do Drag & Drop, Cronômetro e Atalho Ctrl+Z
  KanbanEngine.initDragAndDrop(async (task, fromStatus, toStatus) => {
    showToast(`Tarefa movida para ${toStatus}`, 'info');
    refreshUI();
  });

  TimerEngine.startGlobalTicker();
  UndoEngine.initKeyboardShortcut(refreshUI, showToast);

  // Atualiza a barra de notificações periodicamente, sem precisar recarregar a página.
  // Só re-renderiza a barra (não a tela inteira) pra não atrapalhar quem está digitando em algum formulário.
  setInterval(() => {
    if (!loginOverlay || !loginOverlay.classList.contains('active')) {
      renderTopNotificationBar();
    }
  }, 20000);

  // Render inicial
  await refreshUI();
});