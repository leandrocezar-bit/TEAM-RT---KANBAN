/**
 * Configurações de Atividades, Matriz de Responsabilidade & Transferência de Atividades
 */

import { DB } from './db.js';
import { UndoEngine } from './undo.js';

export const SettingsEngine = {

  selectedMemberId: 'all',
  isManager: true,
  loggedMemberId: null,

  /**
   * Renderiza a Tela de Configurações de Atividades
   */
  async renderSettingsSection(showToastCallback, onRefreshCallback, accessOptions = {}) {

    const container = document.getElementById('section-settings');

    if (!container) return;

    // ============================================================
    // CONTEXTO DO USUÁRIO LOGADO
    // ============================================================

    this.isManager =
      accessOptions.isManager !== undefined
        ? accessOptions.isManager
        : true;

    this.loggedMemberId =
      accessOptions.memberId || null;

    // Colaborador fica obrigatoriamente preso ao próprio ID
    if (!this.isManager && this.loggedMemberId) {
      this.selectedMemberId = this.loggedMemberId;
    }

    // ============================================================
    // CARREGAMENTO DOS DADOS
    // ============================================================

    const isAdminMember = (m) => {
      if (!m) return false;
      const id = String(m.id || '').toLowerCase();
      const level = String(m.accessLevel || '').toLowerCase();
      return level === 'admin' || id === 'm-admin' || id === 'admin';
    };

    const allMembers = (await DB.getAll('members')) || [];
    const rawMembers = allMembers.filter(m => !isAdminMember(m));
    const members = window.sortMembersByCustomOrder ? window.sortMembersByCustomOrder(rawMembers) : rawMembers;
    const tasks = (await DB.getAll('tasks')) || [];
    const transfers = (await DB.getAll('activity_transfers')) || [];

    // ============================================================
    // FILTRO DE SEGURANÇA
    // ============================================================

    let visibleTasks;

    if (this.isManager) {
      visibleTasks = tasks;
    } else {
      visibleTasks = tasks.filter(
        task => String(task.member_id || task.memberId) === String(this.loggedMemberId)
      );
    }

    // ============================================================
    // CABEÇALHO
    // ============================================================

    let html = `
      <div style="
        display:flex;
        justify-content:space-between;
        align-items:center;
        flex-wrap:wrap;
        gap:1rem;
        margin-bottom:1.5rem;
      ">

        <div>

          <h2 style="
            font-size:1.25rem;
            font-weight:800;
            display:flex;
            align-items:center;
            gap:0.5rem;
          ">
            ⚙️ Configurações de Atividades e Responsabilidade
          </h2>

          <p style="
            font-size:0.8rem;
            color:var(--text-muted);
          ">
            ${this.isManager
        ? 'Defina e gerencie quais atividades são de responsabilidade de cada membro da equipe.'
        : 'Gerencie a responsabilidade e solicite transferência das suas próprias atividades.'
      }
          </p>

        </div>

      </div>
    `;

    // ============================================================
    // FILTRO DE MEMBROS (SOMENTE GESTOR)
    // ============================================================

    if (this.isManager) {

      html += `
        <div style="
          display:flex;
          gap:0.5rem;
          overflow-x:auto;
          margin-bottom:1.5rem;
          padding-bottom:0.5rem;
        ">

          <button
            class="btn ${this.selectedMemberId === 'all'
          ? 'btn-primary'
          : 'btn-secondary'
        } btn-filter-settings-member"
            data-id="all"
          >
            👥 Todos os Membros (${tasks.length})
          </button>

          ${members.map(member => {

          const count = tasks.filter(
            task => String(task.member_id || task.memberId) === String(member.id)
          ).length;

          return `
              <button
                class="btn ${String(this.selectedMemberId) === String(member.id)
              ? 'btn-primary'
              : 'btn-secondary'
            } btn-filter-settings-member"
                data-id="${member.id}"
                style="
                  display:flex;
                  align-items:center;
                  gap:0.4rem;
                "
              >

                ${member.photo
              ? `
                    <img
                      src="${member.photo}"
                      alt="${member.name}"
                      style="
                        width:20px;
                        height:20px;
                        border-radius:50%;
                        object-fit:cover;
                      "
                    >
                  `
              : '👤'
            }

                <span>${member.name}</span>

                <span style="
                  background:rgba(255,255,255,0.2);
                  border-radius:10px;
                  padding:0.1rem 0.4rem;
                  font-size:0.7rem;
                ">
                  ${count}
                </span>

              </button>
            `;

        }).join('')
        }

        </div>
      `;

    }

    // ============================================================
    // MATRIZ DE RESPONSABILIDADES
    // ============================================================

    html += `
      <div class="card-panel">

        <div class="panel-header">

          <h3 class="panel-title">
            📋 Matriz de Responsabilidades de Atividades
          </h3>

          <span class="summary-pill">
            Configuração Editável
          </span>

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

              ${this.renderTableRows(
      visibleTasks,
      members,
      transfers
    )}

            </tbody>

          </table>

        </div>

      </div>
    `;

    container.innerHTML = html;

    this.attachEvents(
      showToastCallback,
      onRefreshCallback
    );
  },


  // ============================================================
  // TABELA
  // ============================================================

  renderTableRows(tasks, members, transfers) {
    const isAdminMember = (m) => {
      if (!m) return false;
      const id = String(m.id || '').toLowerCase();
      const level = String(m.accessLevel || '').toLowerCase();
      return level === 'admin' || id === 'm-admin' || id === 'admin';
    };

    members = (members || []).filter(m => !isAdminMember(m));

    const filteredTasks = this.isManager
      ? (
        this.selectedMemberId === 'all'
          ? tasks
          : tasks.filter(
            task =>
              String(task.member_id || task.memberId) ===
              String(this.selectedMemberId)
          )
      )
      : tasks;

    if (filteredTasks.length === 0) {

      return `
        <tr>

          <td
            colspan="5"
            style="
              text-align:center;
              padding:2rem;
              color:var(--text-dim);
            "
          >
            Nenhuma atividade sob responsabilidade deste colaborador.
          </td>

        </tr>
      `;
    }

    // MAPA DE MEMBROS
    const membersMap = new Map(
      members.map(member => [
        String(member.id),
        member
      ])
    );

    // TRANSFERÊNCIAS PENDENTES
    const pendingTransfersMap = new Map();

    transfers
      .filter(
        transfer =>
          String(transfer.status || '').toUpperCase() === 'PENDENTE'
      )
      .forEach(transfer => {

        const taskId =
          transfer.task_id ||
          transfer.taskId ||
          transfer.idDaTarefa;

        if (taskId) {
          pendingTransfersMap.set(
            String(taskId),
            transfer
          );
        }

      });

    // LINHAS DA TABELA
    return filteredTasks.map(task => {

      const taskOwnerId = task.member_id || task.memberId;
      const currentMember =
        membersMap.get(String(taskOwnerId)) ||
        {
          name: 'Não atribuído',
          photo: ''
        };

      const pendingTransfer =
        pendingTransfersMap.get(
          String(task.id)
        );

      const targetMemberId =
        pendingTransfer
          ? (
            pendingTransfer.to_member_id ||
            pendingTransfer.toMemberId ||
            pendingTransfer.paraIdDoMembro
          )
          : null;

      const targetMember =
        targetMemberId
          ? membersMap.get(String(targetMemberId))
          : null;

      return `
        <tr>

          <!-- ATIVIDADE -->
          <td>

            <strong>
              ${task.title || 'Atividade sem título'}
            </strong>

            <div style="
              font-size:0.75rem;
              color:var(--text-dim);
              overflow:hidden;
              text-overflow:ellipsis;
              max-width:280px;
              white-space:nowrap;
            ">
              ${task.description || 'Sem descrição'}
            </div>

          </td>

          <!-- RESPONSÁVEL -->
          <td>

            <div style="
              display:flex;
              align-items:center;
              gap:0.4rem;
            ">

              ${currentMember.photo
          ? `
                  <img
                    src="${currentMember.photo}"
                    alt="${currentMember.name}"
                    style="
                      width:24px;
                      height:24px;
                      border-radius:50%;
                      object-fit:cover;
                    "
                  >
                `
          : '👤'
        }

              <span>
                ${currentMember.name}
              </span>

            </div>

            ${pendingTransfer
          ? `
                <div style="
                  font-size:0.7rem;
                  color:#f59e0b;
                  margin-top:0.2rem;
                  display:flex;
                  align-items:center;
                  gap:0.2rem;
                ">

                  ⏳ Aguardando aceite de:

                  <strong>
                    ${targetMember
            ? targetMember.name
            : 'Outro colaborador'
          }
                  </strong>

                </div>
              `
          : ''
        }

          </td>

          <!-- PRIORIDADE -->
          <td>

            <span
              class="badge-priority priority-${String(
          task.priority || 'média'
        ).toLowerCase()}"
            >
              ${task.priority || 'Média'}
            </span>

          </td>

          <!-- STATUS -->
          <td>

            <strong>
              ${task.status || 'A FAZER'}
            </strong>

          </td>

          <!-- TRANSFERÊNCIA -->
          <td>

            <div style="
              display:flex;
              align-items:center;
              gap:0.4rem;
              flex-wrap:wrap;
            ">

              <select
                class="select-control select-transfer-member"
                data-task-id="${task.id}"
                style="
                  padding:0.25rem 0.5rem;
                  font-size:0.75rem;
                  max-width:170px;
                "
              >

                <option value="">
                  -- Alterar Responsável...
                </option>

                ${members
          .filter(
            member =>
              String(member.id) !==
              String(taskOwnerId)
          )
          .map(
            member => `
                      <option value="${member.id}">
                        ${member.name}
                      </option>
                    `
          )
          .join('')
        }

              </select>

              ${this.isManager
          ? `
                  <button
                    class="btn btn-primary btn-direct-assign"
                    data-task-id="${task.id}"
                    style="
                      padding:0.25rem 0.5rem;
                      font-size:0.725rem;
                      background:#6366f1;
                    "
                  >
                    ⚡ Atribuir Direto
                  </button>
                `
          : ''
        }

              <button
                class="btn btn-secondary btn-submit-transfer"
                data-task-id="${task.id}"
                style="
                  padding:0.25rem 0.5rem;
                  font-size:0.725rem;
                "
                ${pendingTransfer ? 'disabled' : ''}
              >
                ${pendingTransfer
          ? '⏳ Aguardando Aceite'
          : '🔄 Solicitar Aceite'
        }
              </button>

            </div>

          </td>

        </tr>
      `;

    }).join('');
  },


  // ============================================================
  // EVENTOS
  // ============================================================

  attachEvents(showToast, onRefresh) {

    // FILTRO DE MEMBROS
    document
      .querySelectorAll('.btn-filter-settings-member')
      .forEach(button => {

        button.addEventListener('click', async () => {

          if (!this.isManager) return;

          this.selectedMemberId = button.dataset.id;

          await this.renderSettingsSection(
            showToast,
            onRefresh,
            {
              isManager: this.isManager,
              memberId: this.loggedMemberId
            }
          );

        });

      });


    // ATRIBUIÇÃO DIRETA (GESTOR)
    document
      .querySelectorAll('.btn-direct-assign')
      .forEach(button => {

        button.addEventListener('click', async () => {

          if (!this.isManager) {
            if (showToast) {
              showToast('Apenas gestores podem atribuir atividades diretamente.', 'warning');
            }
            return;
          }

          const taskId = button.dataset.taskId;
          const select = document.querySelector(`.select-transfer-member[data-task-id="${taskId}"]`);
          const targetMemberId = select ? select.value : '';

          if (!targetMemberId) {
            if (showToast) showToast('Selecione o novo responsável.', 'warning');
            return;
          }

          const task = await DB.get('tasks', taskId);
          const targetMember = await DB.get('members', targetMemberId);

          if (!task || !targetMember) {
            if (showToast) showToast('Não foi possível localizar a atividade ou o colaborador.', 'warning');
            return;
          }

          const previousState = { ...task };

          // Grava em ambos os campos para garantir no Supabase
          task.member_id = targetMemberId;
          task.memberId = targetMemberId;

          await DB.save('tasks', task);

          UndoEngine.pushAction({
            type: 'TASK_UPDATE',
            previousState
          });

          if (showToast) {
            showToast(`Atividade "${task.title}" atribuída para ${targetMember.name}!`, 'success');
          }

          if (onRefresh) await onRefresh();

        });

      });


    // SOLICITAÇÃO DE TRANSFERÊNCIA
    document
      .querySelectorAll('.btn-submit-transfer')
      .forEach(button => {

        button.addEventListener('click', async () => {

          const taskId = button.dataset.taskId;

          const task = await DB.get('tasks', taskId);

          if (!task) {
            if (showToast) showToast('Atividade não encontrada.', 'warning');
            return;
          }

          const taskOwnerId = task.member_id || task.memberId;

          if (!this.isManager) {
            if (String(taskOwnerId) !== String(this.loggedMemberId)) {
              if (showToast) {
                showToast('Você só pode transferir suas próprias atividades.', 'warning');
              }
              return;
            }
          }

          const select = document.querySelector(`.select-transfer-member[data-task-id="${taskId}"]`);
          const targetMemberId = select ? select.value : '';

          if (!targetMemberId) {
            if (showToast) showToast('Selecione o novo colaborador para transferir a atividade.', 'warning');
            return;
          }

          if (String(targetMemberId) === String(taskOwnerId)) {
            if (showToast) showToast('A atividade já pertence a este colaborador.', 'warning');
            return;
          }

          const targetMember = await DB.get('members', targetMemberId);

          if (!targetMember) {
            if (showToast) showToast('Colaborador destinatário não encontrado.', 'warning');
            return;
          }

          // VERIFICA SE JÁ EXISTE SOLICITAÇÃO PENDENTE
          const transfers = (await DB.getAll('activity_transfers', { forceRefresh: true })) || [];

          const alreadyPending = transfers.some(transfer => {
            const transferTaskId = transfer.task_id || transfer.taskId || transfer.idDaTarefa;
            return (
              String(transferTaskId) === String(task.id) &&
              String(transfer.status || '').toUpperCase() === 'PENDENTE'
            );
          });

          if (alreadyPending) {
            if (showToast) showToast('Esta atividade já possui uma solicitação de transferência pendente.', 'warning');
            return;
          }

          // ====================================================
          // CRIA TRANSFERÊNCIA COM NOMES EXATOS DO SUPABASE
          // ====================================================

          const now = new Date().toISOString();

          const newTransfer = {
            id: 'tr-' + Date.now(),
            task_id: String(task.id),           // 👈 Garante a gravação da coluna no Supabase
            taskId: String(task.id),
            from_member_id: String(taskOwnerId), // 👈 Garante a gravação no Supabase
            fromMemberId: String(taskOwnerId),
            to_member_id: String(targetMemberId),// 👈 Garante a gravação no Supabase
            toMemberId: String(targetMemberId),
            status: 'PENDENTE',
            sender_acknowledged: false,
            senderAcknowledged: false,
            created_at: now,
            requested_at: now,
            responded_at: null
          };

          console.log('🔄 Gravando solicitação de transferência correta no Supabase:', newTransfer);
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