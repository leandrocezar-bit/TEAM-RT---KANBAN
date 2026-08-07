/**
 * Motor de Banco de Dados com Supabase Cloud Persistence
 */

import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

const SUPABASE_URL = 'https://lspvdunxxxebzwyypqlx.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_jf69uVHlxULskHzGN__srA_oTi2LWPJ';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Armazenamento local de fallback / cache em memória
const memoryStore = {
  members: [],
  tasks: [],
  impediments: [],
  projects: [],
  task_members: [],
  activity_transfers: [],
  cycle_templates: [],
  audit_logs: []
};

// Controle de cache: timestamp da última busca por store
const lastFetchTime = {};
const CACHE_TTL_MS = 5000; // 5 segundos — ajuste se quiser mais/menos agressivo

export const DB = {
  client: supabase,
  isCloudConnected: true,

  async init() {
    try {
      // Teste rápido de conectividade com Supabase
      const { data, error } = await supabase.from('members').select('id').limit(1);
      if (error && error.code === '42P01') {
        console.warn('Tabelas no Supabase não encontradas. Usando cache com semeio inicial.');
      }
      this.isCloudConnected = !error || error.code === '42P01';
    } catch (err) {
      console.warn('Servidor Supabase indisponível no momento, operando em modo cache offline:', err);
      this.isCloudConnected = false;
    }
    await this.seedInitialDataIfEmpty();
  },

  /**
   * Mapeamento de nomes de tabelas do JS para o Supabase
   */
  mapStoreName(storeName) {
    const map = {
      members: 'members',
      tasks: 'tasks',
      impediments: 'impediments',
      projects: 'projects',
      task_members: 'task_members',
      transfers: 'activity_transfers',
      activity_transfers: 'activity_transfers',
      cycle_templates: 'cycle_templates',
      audit_logs: 'audit_logs'
    };
    return map[storeName] || storeName;
  },

  /**
   * Mapeia objeto de campo JS (camelCase) para BD Supabase (snake_case)
   */
  toSnakeCase(obj) {
    if (!obj || typeof obj !== 'object') return obj;
    const result = {};
    for (const key in obj) {
      const snakeKey = key.replace(/([A-Z])/g, "_$1").toLowerCase();
      result[snakeKey] = obj[key];
    }
    return result;
  },

  /**
   * Mapeia objeto BD Supabase (snake_case) para JS (camelCase)
   */
  toCamelCase(obj) {
    if (!obj || typeof obj !== 'object') return obj;
    const result = {};
    for (const key in obj) {
      const camelKey = key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
      result[camelKey] = obj[key];
    }
    return result;
  },

  /**
   * Métodos CRUD Genéricos
   */
  async getAll(storeName, options = {}) {
    const { forceRefresh = false } = options;
    const tableName = this.mapStoreName(storeName);

    // Se tem cache válido e não foi pedido refresh forçado, usa o cache
    const lastFetch = lastFetchTime[storeName] || 0;
    const cacheIsFresh = (Date.now() - lastFetch) < CACHE_TTL_MS;
    const hasCachedData = memoryStore[storeName] && memoryStore[storeName].length > 0;

    if (!forceRefresh && cacheIsFresh && hasCachedData) {
      return memoryStore[storeName];
    }

    try {
      const { data, error } = await supabase.from(tableName).select('*');
      if (error) throw error;
      const formatted = (data || []).map(item => this.toCamelCase(item));
      memoryStore[storeName] = formatted;
      lastFetchTime[storeName] = Date.now();
      return formatted;
    } catch (err) {
      console.warn(`[Supabase Fetch Fallback] ${storeName}:`, err.message);
      return memoryStore[storeName] || [];
    }
  },

  async get(storeName, key) {
    const tableName = this.mapStoreName(storeName);
    try {
      const { data, error } = await supabase.from(tableName).select('*').eq('id', key).single();
      if (error) throw error;
      return this.toCamelCase(data);
    } catch (err) {
      const list = memoryStore[storeName] || [];
      return list.find(item => item.id === key) || null;
    }
  },

  async save(storeName, item) {
    const tableName = this.mapStoreName(storeName);
    const dbItem = this.toSnakeCase(item);

    // Atualiza cache em memória imediatamente (não espera o Supabase)
    if (!memoryStore[storeName]) memoryStore[storeName] = [];
    const idx = memoryStore[storeName].findIndex(i => i.id === item.id);
    if (idx >= 0) {
      memoryStore[storeName][idx] = { ...memoryStore[storeName][idx], ...item };
    } else {
      memoryStore[storeName].push(item);
    }

    try {
      const { data, error } = await supabase.from(tableName).upsert(dbItem);
      if (error) console.error(`[Supabase Save Error] ${storeName}:`, error.message);
    } catch (err) {
      console.warn(`[Supabase Save Fallback] ${storeName}:`, err);
    }

    return item;
  },

  async delete(storeName, key) {
    const tableName = this.mapStoreName(storeName);

    if (memoryStore[storeName]) {
      memoryStore[storeName] = memoryStore[storeName].filter(i => i.id !== key);
    }

    try {
      const { error } = await supabase.from(tableName).delete().eq('id', key);
      if (error) console.error(`[Supabase Delete Error] ${storeName}:`, error.message);
    } catch (err) {
      console.warn(`[Supabase Delete Fallback] ${storeName}:`, err);
    }

    return true;
  },

  /**
   * Semeia dados iniciais realistas caso a base esteja vazia
   */
  async seedInitialDataIfEmpty() {
    const members = await this.getAll('members');
    if (members && members.length > 0) return;

    const createAvatarSvg = (bgColor, initials) => {
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100"><rect width="100" height="100" fill="${bgColor}"/><text x="50%" y="55%" dominant-baseline="middle" text-anchor="middle" fill="#ffffff" font-family="sans-serif" font-size="40" font-weight="bold">${initials}</text></svg>`;
      return 'data:image/svg+xml;base64,' + btoa(svg);
    };

    const initialMembers = [
      { id: 'm-1', name: 'Ana Silva', role: 'Analista de Folha de Pagamento', email: 'ana.dp@empresa.com', photo: createAvatarSvg('#6366f1', 'AS'), contact: '(11) 98765-4321' },
      { id: 'm-2', name: 'Carlos Oliveira', role: 'Assistente de Admissão e Benefícios', email: 'carlos.dp@empresa.com', photo: createAvatarSvg('#10b981', 'CO'), contact: '(11) 97654-3210' },
      { id: 'm-3', name: 'Mariana Costa', role: 'Especialista eSocial & Encargos', email: 'mariana.dp@empresa.com', photo: createAvatarSvg('#d946ef', 'MC'), contact: '(11) 96543-2109' }
    ];

    for (const m of initialMembers) {
      await this.save('members', m);
    }

    const todayStr = new Date().toISOString().slice(0, 10);
    const initialTasks = [
      {
        id: 't-dp-1',
        title: 'Fechamento da Folha de Pagamento Mensal (S-1200 / S-1210)',
        description: 'Conferência de proventos, descontos, cálculo de INSS, IRRF e geração de contracheques.',
        memberId: 'm-1',
        category: 'Folha de Pagamento',
        priority: 'Alta',
        dueDate: todayStr,
        status: 'EM EXECUÇÃO',
        elapsedSeconds: 5400,
        isTimerRunning: true,
        lastTimerStartedAt: Date.now() - 600000,
        sortOrder: 1,
        createdAt: new Date().toISOString()
      },
      {
        id: 't-dp-2',
        title: 'Apuração e Fechamento do Espelho de Ponto Eletrônico',
        description: 'Importação de marcações de ponto, cálculo de horas extras, adicionais noturnos e faltas.',
        memberId: 'm-2',
        category: 'Gestão de Ponto & Benefícios',
        priority: 'Alta',
        dueDate: todayStr,
        status: 'EM EXECUÇÃO',
        elapsedSeconds: 3720,
        isTimerRunning: true,
        lastTimerStartedAt: Date.now() - 300000,
        sortOrder: 2,
        createdAt: new Date().toISOString()
      },
      {
        id: 't-dp-3',
        title: 'Emissão da Guia DCTFWeb (INSS / FGTS Digital)',
        description: 'Transmissão do eSocial, fechamento S-1299 e emissão do DARF previdenciário unificado.',
        memberId: 'm-3',
        category: 'eSocial & Encargos',
        priority: 'Alta',
        dueDate: todayStr,
        status: 'A FAZER',
        elapsedSeconds: 0,
        isTimerRunning: false,
        lastTimerStartedAt: null,
        sortOrder: 3,
        createdAt: new Date().toISOString()
      }
    ];

    for (const t of initialTasks) {
      await this.save('tasks', t);
    }

    const initialImpediment = {
      id: 'imp-1',
      taskId: 't-dp-1',
      description: 'Erro no lote eSocial devido a divergência no CPF/PIS de colaborador recém-admitido.',
      createdAt: new Date().toISOString(),
      evidenceImage: null
    };
    await this.save('impediments', initialImpediment);
  },

  /**
   * Reseta o banco de dados e restaura os dados padrão
   */
  async resetDatabase() {
    const stores = ['members', 'tasks', 'impediments', 'projects', 'task_members', 'activity_transfers', 'cycle_templates', 'audit_logs'];
    for (const storeName of stores) {
      memoryStore[storeName] = [];
      lastFetchTime[storeName] = 0; // força buscar de novo na próxima getAll
      const tableName = this.mapStoreName(storeName);
      try {
        await supabase.from(tableName).delete().neq('id', '0');
      } catch (e) { }
    }
    await this.seedInitialDataIfEmpty();
  }
};