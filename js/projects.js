/**
 * Gestão de Projetos & Atividades em Grupo (Multi-Colaboradores)
 */

import { DB } from './db.js';

export const ProjectsEngine = {
  activeProjectId: null,

  /**
   * Renderiza a visão principal de Projetos
   */
  async renderProjectsSection(showToastCallback, onRefreshCallback) {
    const container = document.getElementById('section-projects');
    if (!container) return;

    const projects = await DB.getAll('projects');
    const members = await DB.getAll('members');
    const tasks = await DB.getAll('tasks');
    const taskMembers = await DB.getAll('task_members');

    let html = `
      <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:1rem; margin-bottom:1.5rem;">
        <div>
          <h2 style="font-size:1.25rem; font-weight:800; display:flex; align-items:center; gap:0.5rem;">
            📁 Gestão de Projetos e Atividades em Grupo
          </h2>
          <p style="font-size:0.8rem; color:var(--text-muted);">
            Crie projetos, atribua múltiplos colaboradores e acompanhe entregáveis da equipe em tempo real.
          </p>
        </div>

        <button id="btn-create-project" class="btn btn-primary" style="box-shadow:var(--shadow-glow);">
          + Criar Novo Projeto
        </button>
      </div>
    `;

    if (projects.length === 0) {
      html += `
        <div class="card-panel" style="text-align:center; padding:3rem 1.5rem;">
          <div style="font-size:3rem; margin-bottom:1rem;">📂</div>
          <h3 style="font-size:1.1rem; font-weight:700; margin-bottom:0.5rem;">Nenhum projeto cadastrado no momento</h3>
          <p style="font-size:0.85rem; color:var(--text-muted); margin-bottom:1.5rem;">
            Clique no botão acima para abrir um novo projeto e incluir atividades em grupo com a equipe.
          </p>
        </div>
      `;
    } else {
      html += `
        <!-- Abas dos Projetos Ativos -->
        <div style="display:flex; gap:0.5rem; overflow-x:auto; margin-bottom:1.5rem; border-bottom:1px solid var(--border-color); padding-bottom:0.5rem;">
          ${projects.map(p => `
            <button class="btn ${this.activeProjectId === p.id ? 'btn-primary' : 'btn-secondary'} btn-project-tab" data-id="${p.id}">
              📂 ${p.name}
            </button>
          `).join('')}
        </div>
      `;

      const activeProject = projects.find(p => p.id === this.activeProjectId) || projects[0];
      if (activeProject) {
        this.activeProjectId = activeProject.id;
        const projectTasks = tasks.filter(t => t.projectId === activeProject.id);
        const doneTasks = projectTasks.filter(t => t.status === 'CONCLUÍDO');
        const progress = projectTasks.length > 0 ? Math.round((doneTasks.length / projectTasks.length) * 100) : 0;

        html += `
          <!-- Painel Detalhado do Projeto Selecionado -->
          <div class="card-panel" style="border-top:4px solid var(--accent-primary); margin-bottom:1.5rem;">
            <div style="display:flex; justify-content:space-between; align-items:flex-start; flex-wrap:wrap; gap:1rem; margin-bottom:1rem;">
              <div>
                <h3 style="font-size:1.3rem; font-weight:800; color:var(--text-main); margin-bottom:0.25rem;">
                  ${activeProject.name}
                </h3>
                <p style="font-size:0.85rem; color:var(--text-muted);">${activeProject.description || 'Sem descrição cadastrada.'}</p>
              </div>

              <div style="display:flex; align-items:center; gap:0.5rem;">
                <button class="btn btn-secondary btn-edit-project" data-id="${activeProject.id}" style="font-size:0.75rem;">
                  ✏️ Editar Projeto
                </button>
                <button class="btn btn-primary btn-add-project-task" data-id="${activeProject.id}" style="font-size:0.75rem;">
                  + Atividade no Projeto
                </button>
              </div>
            </div>

            <!-- Barra de Progresso do Projeto -->
            <div style="background:var(--bg-input); padding:1rem; border-radius:var(--radius-md); margin-bottom:1.5rem; border:1px solid var(--border-color);">
              <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.4rem; font-size:0.85rem;">
                <span>Progresso das Entregas</span>
                <strong>${progress}% Concluído (${doneTasks.length}/${projectTasks.length})</strong>
              </div>
              <div style="background:rgba(255,255,255,0.1); border-radius:10px; height:10px; overflow:hidden;">
                <div style="background:var(--accent-gradient); width:${progress}%; height:100%; border-radius:10px; transition:width 0.3s ease;"></div>
              </div>
            </div>

            <!-- Tabela de Tarefas e Colaboradores do Projeto -->
            <h4 style="font-size:1rem; font-weight:700; margin-bottom:0.75rem; display:flex; align-items:center; gap:0.4rem;">
              📌 Atividades em Grupo do Projeto
            </h4>

            <div class="table-responsive">
              <table class="custom-table">
                <thead>
                  <tr>
                    <th>Atividade</th>
                    <th>Responsável Principal</th>
                    <th>Equipe / Grupo Participante</th>
                    <th>Prioridade</th>
                    <th>Status</th>
                    <th>Prazo</th>
                  </tr>
                </thead>
                <tbody>
                  ${projectTasks.length === 0 ? `
                    <tr>
                      <td colspan="6" style="text-align:center; padding:1.5rem; color:var(--text-dim);">
                        Nenhuma atividade cadastrada neste projeto ainda.
                      </td>
                    </tr>
                  ` : projectTasks.map(t => {
                    const mainMember = members.find(m => m.id === t.memberId) || { name: 'Não atribuído', photo: '' };
                    const groupLinks = taskMembers.filter(tm => tm.taskId === t.id);
                    const groupMembers = members.filter(m => groupLinks.some(gl => gl.memberId === m.id));

                    return `
                      <tr>
                        <td>
                          <strong>${t.title}</strong>
                          <div style="font-size:0.75rem; color:var(--text-dim); max-width:260px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">
                            ${t.description || ''}
                          </div>
                        </td>
                        <td>
                          <div style="display:flex; align-items:center; gap:0.4rem;">
                            ${mainMember.photo ? `<img src="${mainMember.photo}" style="width:24px; height:24px; border-radius:50%;">` : '👤'}
                            <span>${mainMember.name}</span>
                          </div>
                        </td>
                        <td>
                          <div style="display:flex; align-items:center; gap:-0.3rem;">
                            ${groupMembers.length === 0 ? '<span style="font-size:0.75rem; color:var(--text-dim);">-</span>' : groupMembers.map(gm => `
                              <img src="${gm.photo}" title="${gm.name}" style="width:24px; height:24px; border-radius:50%; border:2px solid var(--bg-card); margin-right:-6px;">
                            `).join('')}
                            <button class="btn btn-secondary btn-manage-task-group" data-task-id="${t.id}" title="Editar Integrantes do Grupo" style="padding:0.15rem 0.4rem; font-size:0.65rem; border-radius:50%; margin-left:8px;">
                              +👥
                            </button>
                          </div>
                        </td>
                        <td><span class="badge-priority priority-${(t.priority || 'média').toLowerCase()}">${t.priority || 'Média'}</span></td>
                        <td><strong>${t.status}</strong></td>
                        <td>${t.dueDate ? t.dueDate.split('-').reverse().join('/') : '-'}</td>
                      </tr>
                    `;
                  }).join('')}
                </tbody>
              </table>
            </div>
          </div>
        `;
      }
    }

    container.innerHTML = html;
    this.attachEvents(showToastCallback, onRefreshCallback);
  },

  attachEvents(showToast, onRefresh) {
    // Alternar abas de projeto
    document.querySelectorAll('.btn-project-tab').forEach(btn => {
      btn.addEventListener('click', () => {
        this.activeProjectId = btn.dataset.id;
        this.renderProjectsSection(showToast, onRefresh);
      });
    });

    // Abrir Modal de Criar Projeto
    const btnCreateProject = document.getElementById('btn-create-project');
    if (btnCreateProject) {
      btnCreateProject.addEventListener('click', () => {
        const modal = document.getElementById('modal-project');
        if (modal) {
          document.getElementById('form-project').reset();
          modal.classList.add('active');
        }
      });
    }

    // Modal Gerenciar Integrantes do Grupo em Atividade
    document.querySelectorAll('.btn-manage-task-group').forEach(btn => {
      btn.addEventListener('click', async () => {
        const taskId = btn.dataset.taskId;
        const modal = document.getElementById('modal-task-group');
        if (!modal) return;

        const members = await DB.getAll('members');
        const taskMembers = await DB.getAll('task_members');
        const currentGroup = taskMembers.filter(tm => tm.taskId === taskId).map(tm => tm.memberId);

        const container = document.getElementById('task-group-members-list');
        if (container) {
          container.innerHTML = members.map(m => `
            <label style="display:flex; align-items:center; gap:0.6rem; padding:0.4rem 0.6rem; background:var(--bg-input); border-radius:var(--radius-sm); margin-bottom:0.4rem; cursor:pointer;">
              <input type="checkbox" class="chk-group-member" data-member-id="${m.id}" ${currentGroup.includes(m.id) ? 'checked' : ''}>
              <img src="${m.photo}" style="width:24px; height:24px; border-radius:50%;">
              <span style="font-size:0.85rem;">${m.name} (${m.role || 'Membro'})</span>
            </label>
          `).join('');
        }

        document.getElementById('task-group-save-btn').dataset.taskId = taskId;
        modal.classList.add('active');
      });
    });
  }
};
