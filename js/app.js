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

  // --- 1. AUTENTICAÇÃO POR SENHA COM FILTRO DE USUÁRIO ---
  const MASTER_PASSCODE = 'RTESHOW';
  const loginOverlay = document.getElementById('login-overlay');
  const formLogin = document.getElementById('form-login');

  function checkAuthentication() {
    const isAuth = localStorage.getItem('app_passcode_authenticated');
    if (isAuth === 'true') {
      if (loginOverlay) loginOverlay.classList.remove('active');

      // Força o filtro global do painel no ID do usuário logado
      const loggedId = localStorage.getItem('logged_member_id');
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
      const inputUser = document.getElementById('input-login-user').value.trim().toLowerCase();
      const inputPasscode = document.getElementById('input-passcode').value;

      if (inputPasscode !== MASTER_PASSCODE) {
        showToast('Senha da equipe incorreta. Tente novamente.', 'warning');
        return;
      }

      // Busca os colaboradores cadastrados para encontrar o correspondente
      const members = await DB.getAll('members');
      const matchedMember = members.find(m =>
        (m.name && m.name.toLowerCase() === inputUser) ||
        (m.email && m.email.toLowerCase() === inputUser)
      );

      if (matchedMember) {
        localStorage.setItem('app_passcode_authenticated', 'true');
        localStorage.setItem('logged_member_id', matchedMember.id);
        currentMemberFilter = matchedMember.id;

        loginOverlay.classList.remove('active');
        showToast(`Bem-vindo de volta, ${matchedMember.name}!`, 'success');
        refreshUI();
      } else {
        showToast('Nome ou E-mail não encontrado na lista de colaboradores.', 'warning');
      }
    });
  }

  const btnLogout = document.getElementById('btn-logout');
  if (btnLogout) {
    btnLogout.addEventListener('click', () => {
      localStorage.removeItem('app_passcode_authenticated');
      localStorage.removeItem('logged_member_id');
      currentMemberFilter = 'all'; // Reseta o filtro ao deslogar
      checkAuthentication();
      showToast('Você saiu do aplicativo.', 'info');
    });
  }

  checkAuthentication();

  // Inicializa Banco de Dados Supabase (ou cache offline)
  await DB.init();

  /**
   * Atualiza a Interface completa
   */
  async function refreshUI() {
    // 1. Primeiro reseta temporariamente o filtro para garantir que as notificações globais carreguem
    const loggedId = localStorage.getItem('logged_member_id');
    const backupFilter = currentMemberFilter;

    // Força a leitura temporária apenas para renderizar os aceites direcionados
    currentMemberFilter = 'all';
    await renderTopNotificationBar();

    // Restaura o filtro correto do usuário logado
    currentMemberFilter = loggedId ? loggedId : backupFilter;

    // 2. Renderiza as abas de membros normalmente
    await renderMemberTabs();

    const memberTabsBar = document.getElementById('member-tabs-bar');

    // Se o usuário estiver logado e na tela do Kanban, esconde as abas dos colegas
    if (memberTabsBar) {
      if (loggedId && activeView === 'kanban') {
        memberTabsBar.style.display = 'none';
        currentMemberFilter = loggedId; // Trava o filtro no próprio usuário para o Kanban
      } else {
        memberTabsBar.style.display = 'flex'; // Mostra as abas normalmente nas outras seções
      }
    }

    // Exibe TODOS os botões das outras abas normalmente para o usuário navegar
    const adminButtons = [btnViewManager, btnViewMap, btnViewSettings, btnViewProjects, btnNewMember, btnResetDb];
    adminButtons.forEach(btn => {
      if (btn) btn.style.display = 'inline-block';
    });

    // Reset dos botões de navegação
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
      sectionKanban.classList.add('active');
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
      sectionManager.classList.add('active');
      if (btnViewManager) {
        btnViewManager.classList.add('btn-primary');
        btnViewManager.classList.remove('btn-secondary');
      }

      await ManagerEngine.renderDashboard(openEvidenceModal, handleDeleteMember, openCalendarDayModal);
    } else if (activeView === 'map') {
      sectionMap.classList.add('active');
      if (btnViewMap) {
        btnViewMap.classList.add('btn-primary');
        btnViewMap.classList.remove('btn-secondary');
      }

      await MapEngine.renderSectorMap();
    } else if (activeView === 'settings') {
      sectionSettings.classList.add('active');
      if (btnViewSettings) {
        btnViewSettings.classList.add('btn-primary');
        btnViewSettings.classList.remove('btn-secondary');
      }

      await SettingsEngine.renderSettingsSection(showToast, refreshUI);
    } else if (activeView === 'projects') {
      sectionProjects.classList.add('active');
      if (btnViewProjects) {
        btnViewProjects.classList.add('btn-primary');
        btnViewProjects.classList.remove('btn-secondary');
      }

      await ProjectsEngine.renderProjectsSection(showToast, refreshUI);
    }
  }

  /**
   * Renderiza a Barra de Notificações e Pendências de Aceite no Topo da Página
   */
  async function renderTopNotificationBar() {
    const bar = document.getElementById('top-notification-bar');
    const container = document.getElementById('top-notification-list');
    if (!bar || !container) return;

    // Pega o ID do usuário que está logado no momento
    const loggedId = localStorage.getItem('logged_member_id');

    const transfers = await DB.getAll('activity_transfers');

    // FILTRO DE SEGURANÇA: Só mostra a transferência se for destinada ao usuário logado (ex: Camila)
    const pendingTransfers = transfers.filter(t =>
      t.status === 'PENDENTE' && (!loggedId || t.toMemberId === loggedId)
    );

    const tasks = await DB.getAll('tasks');
    const members = await DB.getAll('members');
    const membersMap = new Map(members.map(m => [m.id, m]));

    // Tarefas com vencimento em 2 dias
    const today = new Date();
    const urgentTasks = tasks.filter(t => {
      if (t.status === 'CONCLUÍDO' || !t.dueDate) return false;
      const due = new Date(t.dueDate);
      const diffDays = Math.ceil((due - today) / (1000 * 60 * 60 * 24));
      return diffDays >= 0 && diffDays <= 2;
    });

    if (pendingTransfers.length === 0 && urgentTasks.length === 0) {
      bar.style.display = 'none';
      return;
    }

    bar.style.display = 'block';
    let html = `<div>`;

    if (pendingTransfers.length > 0) {
      const firstTr = pendingTransfers[0];
      const task = tasks.find(t => t.id === firstTr.taskId) || { title: 'Atividade' };
      const fromMem = membersMap.get(firstTr.fromMemberId) || { name: 'Colaborador' };

      html += `
        <div style="display:flex; justify-content:space-between; align-items:center; background:#1e1b4b; border:1px solid #4338ca; padding:0.6rem 1rem; border-radius:4px; color:#c7d2fe; font-size:0.85rem; margin-bottom:0.5rem;">
          <span>🔄 <strong>${fromMem.name}</strong> quer te transferir a atividade: <strong>"${task.title}"</strong></span>
          <div style="display:flex; gap:0.5rem;">
            <button class="btn btn-primary btn-accept-transfer" data-transfer-id="${firstTr.id}" style="padding:0.2rem 0.5rem; font-size:0.75rem; background:#10b981;">Aceitar</button>
            <button class="btn btn-secondary btn-reject-transfer" data-transfer-id="${firstTr.id}" style="padding:0.2rem 0.5rem; font-size:0.75rem; background:#ef4444;">Recusar</button>
          </div>
        </div>
      `;
    }

    if (urgentTasks.length > 0 && !loggedId) { // Alertas de urgência globais apenas se não estiver restrito
      urgentTasks.slice(0, 2).forEach(t => {
        const mem = membersMap.get(t.memberId) || { name: 'Sem responsável' };
        html += `
          <div style="display:flex; justify-content:space-between; align-items:center; background:#7c2d12; border:1px solid #9a3412; padding:0.4rem 1rem; border-radius:4px; color:#ffedd5; font-size:0.8rem; margin-bottom:0.3rem;">
            <span>⚠️ Atividade urgente vencendo em breve: <strong>"${t.title}"</strong> (${mem.name})</span>
          </div>
        `;
      });
    }

    html += `</div>`;
    container.innerHTML = html;

    // Vincula eventos para os botões de aceitar/recusar dentro da barra
    document.querySelectorAll('.btn-accept-transfer').forEach(btn => {
      btn.addEventListener('click', async () => {
        // Vincula eventos para os botões de aceitar/recusar dentro da barra
        document.querySelectorAll('.btn-accept-transfer').forEach(btn => {
          btn.addEventListener('click', async () => {
            const trId = btn.dataset.transferId;
            const transfer = await DB.get('activity_transfers', trId);
            if (!transfer) return;

            transfer.status = 'ACEITO';
            await DB.save('activity_transfers', transfer);

            const task = await DB.get('tasks', transfer.taskId);
            if (task) {
              task.memberId = transfer.toMemberId;
              await DB.save('tasks', task);
            }

            showToast('Transferência aceita com sucesso!', 'success');
            await refreshUI();
          });
        });

        document.querySelectorAll('.btn-reject-transfer').forEach(btn => {
          btn.addEventListener('click', async () => {
            const trId = btn.dataset.transferId;
            const transfer = await DB.get('activity_transfers', trId);
            if (!transfer) return;

            transfer.status = 'RECUSADO';
            await DB.save('activity_transfers', transfer);

            showToast('Transferência recusada.', 'info');
            await refreshUI();
          });
        });
      }

