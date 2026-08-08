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

    // Insere o HTML dinâmico no DOM
    container.innerHTML = html;

    // Associa eventos nos botões e formulários
    this.attachEvents(showToastCallback, onRefreshCallback);
    this.setupFormListeners(showToastCallback, onRefreshCallback);
  },

  attachEvents(showToast, onRefresh) {
    // Evento para fechar modais ao clicar no 'X'
    document.querySelectorAll('#modal-project .modal-close, #modal-project .btn-close-modal').forEach(btn => {
      btn.addEventListener('click', () => {
        const modal = document.getElementById('modal-project');
        if (modal) modal.classList.remove('active');
      });
    });

    // 1. Troca de abas do projeto
    document.querySelectorAll('.btn-project-tab').forEach(btn => {
      btn.addEventListener('click', () => {
        this.activeProjectId = btn.dataset.id;
        this.renderProjectsSection(showToast, onRefresh);
      });
    });

    // 2. Botão 'Criar Novo Projeto'
    const btnCreateProject = document.getElementById('btn-create-project');
    if (btnCreateProject) {
      btnCreateProject.addEventListener('click', () => {
        const modal = document.getElementById('modal-project');
        const titleHeader = document.getElementById('modal-project-title-header');
        const form = modal ? modal.querySelector('form') : null;

        if (modal) {
          if (titleHeader) titleHeader.innerHTML = '📁 Novo Projeto';
          if (form) {
            form.reset();
            delete form.dataset.editId;
          }
          modal.classList.add('active');
        }
      });
    }

    // 3. Botão 'Editar Projeto'
    document.querySelectorAll('.btn-edit-project').forEach(btn => {
      btn.addEventListener('click', async () => {
        const projectId = btn.dataset.id;
        const project = await DB.get('projects', projectId);
        if (!project) return;

        const modal = document.getElementById('modal-project');
        const titleHeader = document.getElementById('modal-project-title-header');
        const form = modal ? modal.querySelector('form') : null;

        if (modal) {
          if (titleHeader) titleHeader.innerHTML = '✏️ Editar Projeto';

          if (form) {
            // Busca campos no formulário de forma universal
            const nameInput = form.querySelector('input[type="text"], [name="name"], [name="title"], #project-name');
            const descInput = form.querySelector('textarea, [name="description"], #project-description');

            if (nameInput) nameInput.value = project.name || '';
            if (descInput) descInput.value = project.description || '';

            form.dataset.editId = project.id;
          }

          modal.classList.add('active');
        }
      });
    });

    // 4. Botão '+ Atividade no Projeto'
    document.querySelectorAll('.btn-add-project-task').forEach(btn => {
      btn.addEventListener('click', () => {
        const projectId = btn.dataset.id;
        const modalTask = document.getElementById('modal-task');
        const selectProject = document.getElementById('task-project-id') || document.querySelector('[name="projectId"]');

        if (modalTask) {
          const formTask = modalTask.querySelector('form');
          if (formTask) formTask.reset();
          if (selectProject) selectProject.value = projectId;
          modalTask.classList.add('active');
        }
      });
    });

    // 5. Botão de gerenciar integrantes da tarefa
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

        const btnSave = document.getElementById('task-group-save-btn');
        if (btnSave) btnSave.dataset.taskId = taskId;

        modal.classList.add('active');
      });
    });
  },

  setupFormListeners(showToast, onRefresh) {
    const modalProject = document.getElementById('modal-project');
    const formProject = modalProject ? modalProject.querySelector('form') : null;

    if (formProject && !formProject.dataset.listenerBound) {
      formProject.dataset.listenerBound = 'true';

      formProject.addEventListener('submit', async (e) => {
        e.preventDefault();

        const editId = formProject.dataset.editId;
        const nameInput = formProject.querySelector('input[type="text"], [name="name"], [name="title"], #project-name');
        const descInput = formProject.querySelector('textarea, [name="description"], #project-description');

        const name = nameInput ? nameInput.value.trim() : '';
        const description = descInput ? descInput.value.trim() : '';

        if (!name) {
          if (showToast) showToast('Por favor, informe o nome do projeto.', 'error');
          return;
        }

        if (editId) {
          // --- MODO EDIÇÃO ---
          const project = await DB.get('projects', editId);
          if (project) {
            project.name = name;
            project.description = description;
            project.updatedAt = new Date().toISOString();
            await DB.save('projects', project);
          }
        } else {
          // --- MODO CRIAÇÃO ---
          const newProject = {
            id: Date.now().toString(),
            name,
            description,
            createdAt: new Date().toISOString()
          };
          await DB.save('projects', newProject);
          this.activeProjectId = newProject.id;
        }

        if (modalProject) modalProject.classList.remove('active');

        formProject.reset();
        delete formProject.dataset.editId;

        if (showToast) showToast(editId ? 'Projeto atualizado!' : 'Projeto criado!');
        if (onRefresh) onRefresh();

        await this.renderProjectsSection(showToast, onRefresh);
      });
    }

    // Salvar integrantes da tarefa
    const btnSaveTaskGroup = document.getElementById('task-group-save-btn');
    if (btnSaveTaskGroup && !btnSaveTaskGroup.dataset.listenerBound) {
      btnSaveTaskGroup.dataset.listenerBound = 'true';

      btnSaveTaskGroup.addEventListener('click', async () => {
        const taskId = btnSaveTaskGroup.dataset.taskId;
        if (!taskId) return;

        const checkboxes = document.querySelectorAll('.chk-group-member');
        const allTaskMembers = await DB.getAll('task_members');

        for (const tm of allTaskMembers) {
          if (tm.taskId === taskId) {
            await DB.delete('task_members', tm.id);
          }
        }

        for (const chk of checkboxes) {
          if (chk.checked) {
            await DB.save('task_members', {
              id: `${taskId}_${chk.dataset.memberId}`,
              taskId: taskId,
              memberId: chk.dataset.memberId
            });
          }
        }

        const modal = document.getElementById('modal-task-group');
        if (modal) modal.classList.remove('active');

        if (showToast) showToast('Integrantes da equipe atualizados!');
        if (onRefresh) onRefresh();
        await this.renderProjectsSection(showToast, onRefresh);
      });
    }
  }
};