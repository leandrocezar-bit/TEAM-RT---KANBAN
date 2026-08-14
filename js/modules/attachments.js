/**
 * AttachmentsEngine - Módulo de Anexos, Drag & Drop e Capturas (Ctrl + V)
 * TEAM RT KANBAN
 */

(function () {
  let currentTaskAttachments = [];

  function openImageViewer(imgSrc, titleStr = 'Captura de Tela') {
    const modalViewer = document.getElementById('modal-image-viewer');
    const imgEl = document.getElementById('image-viewer-img');
    const titleEl = document.getElementById('image-viewer-title');
    const downloadBtn = document.getElementById('image-viewer-download-btn');

    if (modalViewer && imgEl) {
      imgEl.src = imgSrc;
      if (titleEl) titleEl.textContent = `🔎 ${titleStr}`;
      if (downloadBtn) {
        downloadBtn.href = imgSrc;
        downloadBtn.download = titleStr || 'imagem.png';
      }
      if (window.openModal) {
        window.openModal(modalViewer);
      } else {
        modalViewer.classList.add('active');
        modalViewer.style.display = 'flex';
      }
    }
  }

  function getFileBadge(type, name) {
    const ext = name ? name.split('.').pop().toLowerCase() : '';
    if (type && type.startsWith('image/')) return '🖼️ FOTO';
    if (ext === 'pdf' || type === 'application/pdf') return '📕 PDF';
    if (ext === 'xml' || type === 'text/xml' || type === 'application/xml') return '📰 XML';
    if (ext === 'doc' || ext === 'docx') return '📘 DOC';
    if (ext === 'xls' || ext === 'xlsx' || ext === 'csv') return '📊 XLS';
    if (ext === 'zip' || ext === 'rar') return '📦 ZIP';
    return '📄 DOC';
  }

  function renderAttachmentPreviews(containerId = 'task-attachments-preview-container', isEditable = true, onUpdateCallback = null) {
    const container = document.getElementById(containerId);
    if (!container) return;

    if (!currentTaskAttachments || currentTaskAttachments.length === 0) {
      container.innerHTML = `<div style="font-size:0.775rem; color:var(--text-muted); font-style:italic;">Nenhum anexo adicionado ainda.</div>`;
      return;
    }

    container.innerHTML = currentTaskAttachments
      .map((att, idx) => {
        const isImg = att.type && att.type.startsWith('image/');
        const nameShort = att.name.length > 22 ? att.name.substring(0, 19) + '...' : att.name;
        const badge = getFileBadge(att.type, att.name);

        if (isImg) {
          return `
            <div style="position:relative; width:115px; border-radius:8px; border:1px solid var(--border-color); overflow:hidden; background:rgba(15,23,42,0.8); display:flex; flex-direction:column; align-items:center;" title="${att.name}">
              <div style="width:100%; height:85px; overflow:hidden; position:relative; background:#000;">
                <img src="${att.data}" alt="${att.name}" class="btn-zoom-att" data-idx="${idx}" style="width:100%; height:100%; object-fit:cover; cursor:pointer;" title="Clique para ampliar: ${att.name}">
                ${isEditable ? `<button type="button" class="btn-remove-att" data-idx="${idx}" style="position:absolute; top:3px; right:3px; background:rgba(239,68,68,0.9); color:#fff; border:none; border-radius:50%; width:20px; height:20px; font-size:12px; cursor:pointer; display:flex; align-items:center; justify-content:center; line-height:1; font-weight:bold; z-index:2;" title="Remover anexo">&times;</button>` : ''}
              </div>
              <div style="width:100%; padding:0.3rem 0.4rem; background:rgba(15,23,42,0.95); display:flex; justify-style:space-around; align-items:center; border-top:1px solid var(--border-color);">
                <button type="button" class="btn-zoom-att" data-idx="${idx}" style="background:transparent; border:none; color:#a5b4fc; font-size:0.7rem; font-weight:700; cursor:pointer; padding:1px 3px;" title="Visualizar em tela cheia">
                  🔍 Ver
                </button>
                <a href="${att.data}" download="${att.name}" style="color:var(--color-primary-light); font-size:0.7rem; font-weight:700; text-decoration:none; padding:1px 3px;" title="Baixar imagem no PC">
                  📥 Baixar
                </a>
              </div>
            </div>
          `;
        } else {
          return `
            <div style="position:relative; padding:0.5rem 0.75rem; border-radius:8px; border:1px solid var(--border-color); background:var(--bg-input); display:flex; align-items:center; gap:0.6rem; min-width:160px; max-width:220px;" title="${att.name}">
              <span style="font-size:0.75rem; font-weight:800; background:rgba(99,102,241,0.25); color:#a5b4fc; padding:0.25rem 0.45rem; border-radius:4px;">${badge}</span>
              <div style="flex:1; overflow:hidden;">
                <div style="font-size:0.775rem; font-weight:700; color:#fff; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${nameShort}</div>
                <a href="${att.data}" download="${att.name}" style="font-size:0.725rem; color:var(--color-primary-light); text-decoration:none; font-weight:600;">📥 Baixar</a>
              </div>
              ${isEditable ? `<button type="button" class="btn-remove-att" data-idx="${idx}" style="background:rgba(239,68,68,0.9); color:#fff; border:none; border-radius:50%; width:18px; height:18px; font-size:10px; cursor:pointer; display:flex; align-items:center; justify-content:center; line-height:1; font-weight:bold;" title="Remover">&times;</button>` : ''}
            </div>
          `;
        }
      })
      .join('');

    container.querySelectorAll('.btn-zoom-att').forEach((img) => {
      img.addEventListener('click', (e) => {
        e.stopPropagation();
        e.preventDefault();
        const idx = parseInt(e.currentTarget.dataset.idx, 10);
        if (currentTaskAttachments[idx]) {
          openImageViewer(currentTaskAttachments[idx].data, currentTaskAttachments[idx].name);
        }
      });
    });

    if (isEditable) {
      container.querySelectorAll('.btn-remove-att').forEach((btn) => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const idx = parseInt(e.currentTarget.dataset.idx, 10);
          if (!isNaN(idx)) {
            currentTaskAttachments.splice(idx, 1);
            renderAttachmentPreviews(containerId, isEditable, onUpdateCallback);
            if (onUpdateCallback) onUpdateCallback();
          }
        });
      });
    }
  }

  function setAttachments(attachmentsArray = []) {
    currentTaskAttachments = Array.isArray(attachmentsArray) ? [...attachmentsArray] : [];
  }

  function getAttachments() {
    return [...currentTaskAttachments];
  }

  function addAttachment(fileObj) {
    currentTaskAttachments.push(fileObj);
  }

  // Listener Global para Colar Print (Ctrl + V)
  document.addEventListener('paste', (e) => {
    const activeModal = document.querySelector('.modal-overlay.active');
    if (!activeModal) return;
    if (activeModal.id !== 'modal-task' && activeModal.id !== 'modal-task-details') return;

    const items = (e.clipboardData || e.originalEvent?.clipboardData)?.items;
    if (!items) return;

    for (const item of items) {
      if (item.type && item.type.indexOf('image') !== -1) {
        const file = item.getAsFile();
        if (file) {
          const reader = new FileReader();
          reader.onload = (evt) => {
            const timeStr = new Date().toLocaleTimeString('pt-BR').replace(/:/g, '');
            const newAtt = {
              id: 'att-' + Date.now() + Math.floor(Math.random() * 1000),
              name: `Print_${timeStr}.png`,
              type: file.type || 'image/png',
              data: evt.target.result,
              createdAt: new Date().toISOString(),
            };
            currentTaskAttachments.push(newAtt);

            if (activeModal.id === 'modal-task') {
              renderAttachmentPreviews('task-attachments-preview-container', true);
            } else if (activeModal.id === 'modal-task-details') {
              renderAttachmentPreviews('details-attachments-preview-container', true, async () => {
                if (window.currentDetailsTaskId && window.DB) {
                  const task = await window.DB.get('tasks', window.currentDetailsTaskId);
                  if (task) {
                    task.attachments = currentTaskAttachments;
                    await window.DB.save('tasks', task);
                  }
                }
              });

              if (window.currentDetailsTaskId && window.DB) {
                window.DB.get('tasks', window.currentDetailsTaskId).then(async (task) => {
                  if (task) {
                    task.attachments = currentTaskAttachments;
                    await window.DB.save('tasks', task);
                    if (window.refreshUI) await window.refreshUI();
                  }
                });
              }
            }

            if (window.showToast) {
              window.showToast('📸 Print/Captura de tela colado (Ctrl+V) com sucesso!', 'success');
            }
          };
          reader.readAsDataURL(file);
        }
      }
    }
  });

  window.AttachmentsEngine = {
    openImageViewer,
    getFileBadge,
    renderAttachmentPreviews,
    setAttachments,
    getAttachments,
    addAttachment,
  };

  // Exposição global para retrocompatibilidade
  window.openImageViewer = openImageViewer;
  window.renderAttachmentPreviews = renderAttachmentPreviews;
})();
