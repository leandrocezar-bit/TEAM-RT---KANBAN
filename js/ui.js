/**
 * Interface do Usuário e Renderização do DOM (UI Engine)
 */

import { CalcEngine } from './calc.js';

export const UIEngine = {
  /**
   * Renderiza os cards de métricas do Dashboard
   */
  renderMetrics(entries, settings) {
    let totalMinutes = 0;
    let totalValue = 0;
    let approvedMinutes = 0;
    let bankMinutes = 0;

    entries.forEach(e => {
      const fin = CalcEngine.calculateEntryFinancials(e, settings);
      totalMinutes += fin.durationMinutes;
      
      if (e.status === 'banco') {
        bankMinutes += fin.durationMinutes;
      } else {
        totalValue += fin.totalValue;
        if (e.status === 'aprovado' || e.status === 'pago') {
          approvedMinutes += fin.durationMinutes;
        }
      }
    });

    // Atualiza o DOM dos cards
    const totalHoursEl = document.getElementById('metric-total-hours');
    const totalValueEl = document.getElementById('metric-total-value');
    const bankHoursEl = document.getElementById('metric-bank-hours');
    const rateValueEl = document.getElementById('metric-rate-value');

    if (totalHoursEl) totalHoursEl.textContent = CalcEngine.minutesToFormattedHours(totalMinutes);
    if (totalValueEl) totalValueEl.textContent = CalcEngine.formatCurrency(totalValue);
    if (bankHoursEl) bankHoursEl.textContent = CalcEngine.minutesToFormattedHours(bankMinutes);

    const baseRate = CalcEngine.calculateBaseHourlyRate(settings.salarioBase, settings.cargaHorariaMensal);
    if (rateValueEl) rateValueEl.textContent = CalcEngine.formatCurrency(baseRate) + '/h';
  },

  /**
   * Renderiza a tabela de lançamentos com filtros aplicados
   */
  renderTable(entries, settings, onEdit, onDelete, onStatusChange) {
    const tbody = document.getElementById('entries-table-body');
    if (!tbody) return;

    if (entries.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="8">
            <div class="empty-state">
              <div class="empty-icon">⏱️</div>
              <p>Nenhum lançamento de hora extra encontrado.</p>
              <span style="font-size:0.8rem; color:var(--text-dim);">Clique em "+ Novo Lançamento" para registrar.</span>
            </div>
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = entries.map(item => {
      const fin = CalcEngine.calculateEntryFinancials(item, settings);
      
      // Mapeamento de Badges de Status
      const statusMap = {
        pendente: '<span class="badge badge-pending">Pendente</span>',
        aprovado: '<span class="badge badge-approved">Aprovado</span>',
        pago: '<span class="badge badge-paid">Pago</span>',
        banco: '<span class="badge badge-bank">Banco de Horas</span>'
      };

      const dateFormatted = item.date ? item.date.split('-').reverse().join('/') : '-';

      return `
        <tr data-id="${item.id}">
          <td>
            <strong>${dateFormatted}</strong>
            ${item.isNightShift ? '<span title="Adicional Noturno" style="margin-left:4px;">🌙</span>' : ''}
          </td>
          <td>
            <div style="font-weight:600;">${item.startTime} - ${item.endTime}</div>
            <div style="font-size:0.75rem; color:var(--text-dim);">Pausa: ${item.breakMinutes || 0}m</div>
          </td>
          <td>
            <span class="badge badge-rate">+${item.ratePercent}%</span>
          </td>
          <td>
            <strong>${CalcEngine.minutesToFormattedHours(fin.durationMinutes)}</strong>
            <div style="font-size:0.75rem; color:var(--text-dim);">${fin.decimalHours}h dec.</div>
          </td>
          <td>
            <strong style="color:var(--text-main);">${CalcEngine.formatCurrency(fin.totalValue)}</strong>
          </td>
          <td>
            <div style="max-width:200px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
              <span style="font-weight:600; color:var(--accent-primary);">${item.project || 'Geral'}</span>
              <p style="font-size:0.775rem; color:var(--text-muted); text-overflow:ellipsis; overflow:hidden;">${item.description || ''}</p>
            </div>
          </td>
          <td>
            <select class="select-control status-select" data-id="${item.id}" style="padding:0.25rem 0.5rem; font-size:0.75rem;">
              <option value="pendente" ${item.status === 'pendente' ? 'selected' : ''}>Pendente</option>
              <option value="aprovado" ${item.status === 'aprovado' ? 'selected' : ''}>Aprovado</option>
              <option value="pago" ${item.status === 'pago' ? 'selected' : ''}>Pago</option>
              <option value="banco" ${item.status === 'banco' ? 'selected' : ''}>Banco de Horas</option>
            </select>
          </td>
          <td>
            <div class="table-actions">
              <button class="btn-action btn-edit" data-id="${item.id}" title="Editar">✏️</button>
              <button class="btn-action delete btn-delete" data-id="${item.id}" title="Excluir">🗑️</button>
            </div>
          </td>
        </tr>
      `;
    }).join('');

    // Attach Event Listeners aos botões da tabela
    tbody.querySelectorAll('.btn-edit').forEach(btn => {
      btn.addEventListener('click', () => onEdit(btn.dataset.id));
    });

    tbody.querySelectorAll('.btn-delete').forEach(btn => {
      btn.addEventListener('click', () => onDelete(btn.dataset.id));
    });

    tbody.querySelectorAll('.status-select').forEach(select => {
      select.addEventListener('change', (e) => onStatusChange(select.dataset.id, e.target.value));
    });
  },

  /**
   * Exibe mensagens Toast
   */
  showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    
    const icon = type === 'success' ? '✅' : type === 'error' ? '❌' : 'ℹ️';
    toast.innerHTML = `<span>${icon}</span> <span>${message}</span>`;
    
    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(100%)';
      setTimeout(() => toast.remove(), 300);
    }, 3500);
  }
};
