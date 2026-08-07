/**
 * Gerenciamento de Estado e Persistência no LocalStorage (Store Engine)
 */

const SETTINGS_KEY = 'horas_extras_settings_v1';
const ENTRIES_KEY = 'horas_extras_entries_v1';

const defaultSettings = {
  employeeName: 'Leandro Cezar',
  salarioBase: 3800.00,
  cargaHorariaMensal: 220,
  theme: 'dark'
};

const defaultSampleEntries = [
  {
    id: 'sample-1',
    date: '2026-07-28',
    startTime: '18:00',
    endTime: '20:30',
    breakMinutes: 0,
    ratePercent: 50,
    isNightShift: false,
    status: 'aprovado',
    description: 'Suporte emergencial para implantação de atualização de servidor.',
    project: 'Infraestrutura IT'
  },
  {
    id: 'sample-2',
    date: '2026-07-26',
    startTime: '09:00',
    endTime: '15:00',
    breakMinutes: 60,
    ratePercent: 100,
    isNightShift: false,
    status: 'pago',
    description: 'Manutenção preventiva de final de semana.',
    project: 'Operações'
  },
  {
    id: 'sample-3',
    date: '2026-07-23',
    startTime: '21:30',
    endTime: '01:30',
    breakMinutes: 15,
    ratePercent: 50,
    isNightShift: true,
    status: 'pendente',
    description: 'Migração de banco de dados no horário noturno.',
    project: 'Sistemas Core'
  },
  {
    id: 'sample-4',
    date: '2026-07-15',
    startTime: '18:00',
    endTime: '20:00',
    breakMinutes: 0,
    ratePercent: 50,
    isNightShift: false,
    status: 'banco',
    description: 'Finalização de relatório mensal diretoria.',
    project: 'Gestão'
  }
];

export const Store = {
  getSettings() {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) {
      this.saveSettings(defaultSettings);
      return defaultSettings;
    }
    try {
      return { ...defaultSettings, ...JSON.parse(raw) };
    } catch (e) {
      return defaultSettings;
    }
  },

  saveSettings(settings) {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  },

  getEntries() {
    const raw = localStorage.getItem(ENTRIES_KEY);
    if (!raw) {
      this.saveEntries(defaultSampleEntries);
      return defaultSampleEntries;
    }
    try {
      return JSON.parse(raw);
    } catch (e) {
      return [];
    }
  },

  saveEntries(entries) {
    localStorage.setItem(ENTRIES_KEY, JSON.stringify(entries));
  },

  addEntry(newEntry) {
    const entries = this.getEntries();
    const entryWithId = {
      id: 'HE-' + Date.now(),
      createdAt: new Date().toISOString(),
      ...newEntry
    };
    entries.unshift(entryWithId);
    this.saveEntries(entries);
    return entryWithId;
  },

  updateEntry(id, updatedData) {
    const entries = this.getEntries();
    const index = entries.findIndex(e => e.id === id);
    if (index !== -1) {
      entries[index] = { ...entries[index], ...updatedData };
      this.saveEntries(entries);
      return entries[index];
    }
    return null;
  },

  deleteEntry(id) {
    const entries = this.getEntries();
    const filtered = entries.filter(e => e.id !== id);
    this.saveEntries(filtered);
  },

  exportCSV(entries, calcEngine) {
    const settings = this.getSettings();
    let csvContent = 'data:text/csv;charset=utf-8,\uFEFF';
    csvContent += 'Data,Horário Início,Horário Fim,Pausa (min),Adicional %,Noturno,Duração (min),Decimais (h),Valor (R$),Status,Projeto,Descrição\n';

    entries.forEach(item => {
      const fin = calcEngine.calculateEntryFinancials(item, settings);
      const row = [
        item.date,
        item.startTime,
        item.endTime,
        item.breakMinutes || 0,
        `${item.ratePercent}%`,
        item.isNightShift ? 'Sim' : 'Não',
        fin.durationMinutes,
        fin.decimalHours,
        fin.totalValue.toFixed(2),
        item.status.toUpperCase(),
        `"${(item.project || '').replace(/"/g, '""')}"`,
        `"${(item.description || '').replace(/"/g, '""')}"`
      ].join(',');
      csvContent += row + '\n';
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Horas_Extras_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
};
