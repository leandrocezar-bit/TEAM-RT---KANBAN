/**
 * Configurações de Atividades, Matriz de Responsabilidade & Transferência de Atividades
 */

import { DB } from './db.js';
import { UndoEngine } from './undo.js';

export const SettingsEngine = {
  selectedMemberId: 'all',

  /**
   * Renderiza a Tela de Configurações de Atividades
   */
  async renderSettingsSection(showToastCallback, onRefreshCallback) {
    const container = document.getElementById('section-settings');
    if (!container) return;

    const members = await DB.getAll('members');
    const tasks = await DB.getAll('tasks');
    const transfers = await DB.getAll('activity_transfers');

    let html = `
      <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:1rem; margin-bottom:1.5rem;">
        <div>
          <h2 style="font-size:1.25rem; font-weight:800; display:flex; align-items:center; gap:0.5rem;">
            ⚙️ Configurações de Atividades e Responsabilidade
          </h2>
          <p style="font-size:0.8rem; color:var(--text-muted);">
            Defina e gerencie quais atividades são de responsabilidade de cada membro da equipe.
          </p>
        </div>
      </div>

      <!-- Seleção de Membro para Filtrar Responsabilidades -->
      <div style="display:flex; gap:0.5rem; overflow-x:auto; margin-bottom:1.5rem; padding-bottom:0.5rem;">
        <button class="btn ${this.selectedMemberId === 'all' ? 'btn-primary' : 'btn-secondary'} btn-filter-settings-member" data-id="all">
          👥 Todos os Membros (${tasks.length})
        </button>
        ${members.map(m => {
          const count = tasks.filter(t => t.memberId === m.id).length;
          return `
            <button class="btn ${this.selectedMemberId === m.id ? 'btn-primary' : 'btn-secondary'} btn-filter-settings-member" data-id="${m.id}" style="display:flex; align-items:center; gap:0.4rem;">
              <img src="${m.photo}" style="width:20px; height:20px; border-radius:50%; object-fit:cover;">
              <span>${m.name}</span>
              <span style="background:rgba(255,255,255,0.2); border-radius:10px; padding:0.1rem 0.4rem; font-size:0.7rem;">${count}</span>
            </button>
          `;
        }).join('')}
      </div>

      <!-- Tabela Matriz de Atividades & Transferências -->
      <div class="card-panel">
        <div class="panel-header">
          <h3 class="panel-title">📋 Matriz de Responsabilidades de Atividades</h3>
          <span class="summary-pill">Configuração Editável</span>
        </div>

        <div class="table-responsive">
          <table class="custom-table">
            <thead>
              <tr>
                <th>Atividade / Requisito</th>
                <th>Responsável Atual</th>
                <th>Prioridade</th>
                <th>Status Atual</th>
                <th>Transferir Responsabilidade</th>
              </tr>
            </thead>
            <tbody>
              ${this.renderTableRows(tasks, members, transfers)}
            </tbody>
          </table>
        </div>
      </div>
    `;

    container.innerHTML = html;
    this.attachEvents(showToastCallback, onRefreshCallback);
  },

  renderTableRows(tasks, members, transfers) {
    const filteredTasks = this.selectedMemberId === 'all' 
      ? tasks 
      : tasks.filter(t => t.memberId === this.selectedMemberId);

    if (filteredTasks.length === 0) {
      return `
        <tr>
          <td colspan="5" style="text-align:center; padding:2rem; color:var(--text-dim);">
            Nenhuma atividade sob responsabilidade deste colaborador.
          </td>
        </tr>
      `;
    }

    const membersMap = new Map(members.map(m => [m.id, m]));
    const pendingTransfersMap = new Map();
    transfers.filter(t => t.status === 'PENDENTE').forEach(t => pendingTransfersMap.set(t.taskId, t));

    return filteredTasks.map(task => {
      const currentMember = membersMap.get(task.memberId) || { name: 'Não atribuído', photo: '' };
      const pendingTransfer = pendingTransfersMap.get(task.id);
      const targetMember = pendingTransfer ? membersMap.get(pendingTransfer.toMemberId) : null;

      return `
        <tr>
          <td>
            <strong>${task.title}</strong>
            <div style="font-size:0.75rem; color:var(--text-dim); overflow:hidden; text-overflow:ellipsis; max-width:280px; white-space:nowrap;">
              ${task.description || 'Sem descrição'}
            </div>
          </td>
          <td>
            <div style="display:flex; align-items:center; gap:0.4rem;">
              ${currentMember.photo ? `<img src="${currentMember.photo}" style="width:24px; height:24px; border-radius:50%; object-fit:cover;">` : '👤'}
              <span>${currentMember.name}</span>
            </div>
            ${pendingTransfer ? `
              <div style="font-size:0.7rem; color:#f59e0b; margin-top:0.2rem; display:flex; align-items:center; gap:0.2rem;">
                ⏳ Aguardando aceite de: <strong>${targetMember ? targetMember.name : 'Outro colaborador'}</strong>
              </div>
            ` : ''}
          </td>
          <td>
            <span class="badge-priority priority-${(task.priority || 'média').toLowerCase()}">${task.priority || 'Média'}</span>
          </td>
          <td><strong>${task.status}</strong></td>
          <td>
            <div style="display:flex; align-items:center; gap:0.4rem; flex-wrap:wrap;">
              <select class="select-control select-transfer-member" data-task-id="${task.id}" style="padding:0.25rem 0.5rem; font-size:0.75rem; max-width:170px;">
                <option value="">-- Alterar Responsável... --</option>
                ${members.filter(m => m.id !== task.memberId).map(m => `
                  <option value="${m.id}">${m.name}</option>
                `).join('')}
              </select>
              <button class="btn btn-primary btn-direct-assign" data-task-id="${task.id}" style="padding:0.25rem 0.5rem; font-size:0.725rem; background:#6366f1;">
                ⚡ Atribuir Direto
              </button>
              <button class="btn btn-secondary btn-submit-transfer" data-task-id="${task.id}" style="padding:0.25rem 0.5rem; font-size:0.725rem;">
                🔄 Solicitar Aceite
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join('');
  },

  attachEvents(showToast, onRefresh) {
    // Filtro por membro
    document.querySelectorAll('.btn-filter-settings-member').forEach(btn => {
      btn.addEventListener('click', () => {
        this.selectedMemberId = btn.dataset.id;
        this.renderSettingsSection(showToast, onRefresh);
      });
    });

    // Atribuição Direta de Responsabilidade
    document.querySelectorAll('.btn-direct-assign').forEach(btn => {
      btn.addEventListener('click', async () => {
        const taskId = btn.dataset.taskId;
        const select = document.querySelector(`.select-transfer-member[data-task-id="${taskId}"]`);
        const targetMemberId = select ? select.value : '';

        if (!targetMemberId) {
          alert('Por favor, selecione um novo colaborador no menu.');
          return;
        }

        const task = await DB.get('tasks', taskId);
        const targetMember = await DB.get('members', targetMemberId);

        if (!task || !targetMember) return;

        const previousMemberId = task.memberId;
        task.memberId = targetMemberId;
        await DB.save('tasks', task);

        UndoEngine.pushAction({
          type: 'TASK_UPDATE',
          previousState: { ...task, memberId: previousMemberId }
        });

        if (showToast) {
          showToast(`Atividade "${task.title}" atribuída para ${targetMember.name}!`, 'success');
        }

        if (onRefresh) await onRefresh();
      });
    });

    // Submeter Solicitação de Transferência (com aceite)
    document.querySelectorAll('.btn-submit-transfer').forEach(btn => {
      btn.addEventListener('click', async () => {
        const taskId = btn.dataset.taskId;
        const select = document.querySelector(`.select-transfer-member[data-task-id="${taskId}"]`);
        const targetMemberId = select ? select.value : '';

        if (!targetMemberId) {
          alert('Por favor, selecione um novo colaborador para transferir a atividade.');
          return;
        }

        const task = await DB.get('tasks', taskId);
        const targetMember = await DB.get('members', targetMemberId);

        if (!task || !targetMember) return;

        const newTransfer = {
          id: 'tr-' + Date.now(),
          taskId: task.id,
          fromMemberId: task.memberId,
          toMemberId: targetMemberId,
          status: 'PENDENTE',
          requestedAt: new Date().toISOString()
        };

        await DB.save('activity_transfers', newTransfer);
        
        UndoEngine.pushAction({
          type: 'TRANSFER_REQUEST',
          transferId: newTransfer.id
        });

        if (showToast) {
          showToast(`Solicitação enviada! Aguardando aceite de ${targetMember.name}.`, 'warning');
        }

        if (onRefresh) await onRefresh();
      });
    });
  }
};
