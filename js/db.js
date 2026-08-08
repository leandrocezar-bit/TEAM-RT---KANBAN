/**
 * Motor de Banco de Dados com Supabase Cloud Persistence
 */

import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

const SUPABASE_URL = 'https://lspvdunxxxebzwyypqlx.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_jf69uVHlxULskHzGN__srA_oTi2LWPJ';

export const supabase = createClient(
  SUPABASE_URL,
  SUPABASE_ANON_KEY
);

// ============================================================
// ARMAZENAMENTO LOCAL DE FALLBACK / CACHE
// ============================================================

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

// Controle de cache
const lastFetchTime = {};
const CACHE_TTL_MS = 5000;


// ============================================================
// BANCO DE DADOS
// ============================================================

export const DB = {

  client: supabase,

  isCloudConnected: true,


  // ==========================================================
  // INICIALIZAÇÃO
  // ==========================================================

  async init() {

    try {

      const { error } = await supabase
        .from('members')
        .select('id')
        .limit(1);

      if (error && error.code === '42P01') {

        console.warn(
          'Tabelas no Supabase não encontradas. Usando cache com semeio inicial.'
        );

      }

      this.isCloudConnected =
        !error || error.code === '42P01';

    } catch (err) {

      console.warn(
        'Servidor Supabase indisponível no momento. Operando em modo cache offline:',
        err
      );

      this.isCloudConnected = false;
    }

    await this.seedInitialDataIfEmpty();
  },


  // ==========================================================
  // MAPEAMENTO DE TABELAS
  // ==========================================================

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


  // ==========================================================
  // CONVERSÃO JS -> SUPABASE
  // ==========================================================

  toSnakeCase(obj, storeName = null) {

    if (!obj || typeof obj !== 'object') {
      return obj;
    }

    const result = {};


    // ----------------------------------------------------------
    // ACTIVITY TRANSFERS
    // ----------------------------------------------------------
    // Esta tabela possui nomes específicos no Supabase.
    //
    // JS:
    // deIdDoMembro
    // paraIdDoMembro
    // idDaTarefa
    //
    // Supabase:
    // from_member_id
    // to_member_id
    // task_id
    // ----------------------------------------------------------

    if (
      storeName === 'activity_transfers' ||
      storeName === 'transfers'
    ) {

      const transferMap = {

        id: 'id',

        idDaTarefa: 'task_id',

        deIdDoMembro: 'from_member_id',

        paraIdDoMembro: 'to_member_id',

        status: 'status',

        remetenteConfirmado: 'sender_confirmed',

        respondeuEm: 'responded_at',

        createdAt: 'created_at'

      };


      for (const key in obj) {

        const dbKey = transferMap[key];

        if (dbKey) {

          result[dbKey] = obj[key];

        } else {

          // Mantém campos desconhecidos sem alteração
          result[key] = obj[key];

        }
      }

      return result;
    }


    // ----------------------------------------------------------
    // CONVERSÃO PADRÃO
    // ----------------------------------------------------------

    for (const key in obj) {

      const snakeKey = key
        .replace(/([A-Z])/g, '_$1')
        .toLowerCase();

      result[snakeKey] = obj[key];
    }

    return result;
  },


  // ==========================================================
  // CONVERSÃO SUPABASE -> JS
  // ==========================================================

  toCamelCase(obj, storeName = null) {

    if (!obj || typeof obj !== 'object') {
      return obj;
    }

    const result = {};


    // ----------------------------------------------------------
    // ACTIVITY TRANSFERS
    // ----------------------------------------------------------

    if (
      storeName === 'activity_transfers' ||
      storeName === 'transfers'
    ) {

      const transferMap = {

        id: 'id',

        task_id: 'idDaTarefa',

        from_member_id: 'deIdDoMembro',

        to_member_id: 'paraIdDoMembro',

        status: 'status',

        sender_confirmed: 'remetenteConfirmado',

        responded_at: 'respondeuEm',

        created_at: 'createdAt'

      };


      for (const key in obj) {

        const jsKey = transferMap[key];

        if (jsKey) {

          result[jsKey] = obj[key];

        } else {

          result[key] = obj[key];

        }
      }

      return result;
    }


    // ----------------------------------------------------------
    // CONVERSÃO PADRÃO
    // ----------------------------------------------------------

    for (const key in obj) {

      const camelKey = key.replace(
        /_([a-z])/g,
        (_, letter) => letter.toUpperCase()
      );

      result[camelKey] = obj[key];
    }

    return result;
  },


  // ==========================================================
  // GET ALL
  // ==========================================================

  async getAll(storeName, options = {}) {

    const {
      forceRefresh = false
    } = options;

    const tableName = this.mapStoreName(storeName);


    // Cache

    const lastFetch =
      lastFetchTime[storeName] || 0;

    const cacheIsFresh =
      (Date.now() - lastFetch) < CACHE_TTL_MS;

    const hasCachedData =
      memoryStore[storeName] &&
      memoryStore[storeName].length > 0;


    if (
      !forceRefresh &&
      cacheIsFresh &&
      hasCachedData
    ) {

      return memoryStore[storeName];
    }


    // Supabase

    try {

      const {
        data,
        error
      } = await supabase
        .from(tableName)
        .select('*');


      if (error) {
        throw error;
      }


      const formatted =
        (data || []).map(item =>
          this.toCamelCase(item, storeName)
        );


      memoryStore[storeName] = formatted;

      lastFetchTime[storeName] = Date.now();

      return formatted;

    } catch (err) {

      console.warn(
        `[Supabase Fetch Fallback] ${storeName}:`,
        err.message
      );

      return memoryStore[storeName] || [];
    }
  },


  // ==========================================================
  // GET POR ID
  // ==========================================================

  async get(storeName, key) {

    const tableName =
      this.mapStoreName(storeName);


    try {

      const {
        data,
        error
      } = await supabase
        .from(tableName)
        .select('*')
        .eq('id', key)
        .single();


      if (error) {
        throw error;
      }


      return this.toCamelCase(
        data,
        storeName
      );

    } catch (err) {

      const list =
        memoryStore[storeName] || [];

      return (
        list.find(item =>
          String(item.id) === String(key)
        ) || null
      );
    }
  },


  // ==========================================================
  // SAVE / UPSERT
  // ==========================================================

  async save(storeName, item) {

    const tableName =
      this.mapStoreName(storeName);


    // IMPORTANTE:
    // passa o storeName para saber se é activity_transfers

    const dbItem =
      this.toSnakeCase(item, storeName);


    // ----------------------------------------------------------
    // ATUALIZA CACHE IMEDIATAMENTE
    // ----------------------------------------------------------

    if (!memoryStore[storeName]) {
      memoryStore[storeName] = [];
    }


    const idx =
      memoryStore[storeName]
        .findIndex(i =>
          String(i.id) === String(item.id)
        );


    if (idx >= 0) {

      memoryStore[storeName][idx] = {
        ...memoryStore[storeName][idx],
        ...item
      };

    } else {

      memoryStore[storeName].push(item);
    }


    // ----------------------------------------------------------
    // SALVA NO SUPABASE
    // ----------------------------------------------------------

    try {

      const {
        data,
        error
      } = await supabase
        .from(tableName)
        .upsert(dbItem);


      if (error) {

        console.error(
          `[Supabase Save Error] ${storeName}:`,
          error.message
        );

      }

    } catch (err) {

      console.warn(
        `[Supabase Save Fallback] ${storeName}:`,
        err
      );
    }


    return item;
  },


  // ==========================================================
  // DELETE
  // ==========================================================

  async delete(storeName, key) {

    const tableName =
      this.mapStoreName(storeName);


    // Remove do cache

    if (memoryStore[storeName]) {

      memoryStore[storeName] =
        memoryStore[storeName].filter(
          i => String(i.id) !== String(key)
        );
    }


    // Remove do Supabase

    try {

      const {
        error
      } = await supabase
        .from(tableName)
        .delete()
        .eq('id', key);


      if (error) {

        console.error(
          `[Supabase Delete Error] ${storeName}:`,
          error.message
        );
      }

    } catch (err) {

      console.warn(
        `[Supabase Delete Fallback] ${storeName}:`,
        err
      );
    }


    return true;
  },


  // ==========================================================
  // SEMEIA DADOS INICIAIS
  // ==========================================================

  async seedInitialDataIfEmpty() {

    const members =
      await this.getAll('members');


    if (
      members &&
      members.length > 0
    ) {
      return;
    }


    // ----------------------------------------------------------
    // AVATAR
    // ----------------------------------------------------------

    const createAvatarSvg =
      (bgColor, initials) => {

        const svg = `
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="100"
            height="100"
            viewBox="0 0 100 100"
          >
            <rect
              width="100"
              height="100"
              fill="${bgColor}"
            />

            <text
              x="50%"
              y="55%"
              dominant-baseline="middle"
              text-anchor="middle"
              fill="#ffffff"
              font-family="sans-serif"
              font-size="40"
              font-weight="bold"
            >
              ${initials}
            </text>
          </svg>
        `;

        return (
          'data:image/svg+xml;base64,' +
          btoa(svg)
        );
      };


    // ----------------------------------------------------------
    // MEMBROS
    // ----------------------------------------------------------

    const initialMembers = [

      {
        id: 'm-1',
        name: 'Ana Silva',
        role: 'Analista de Folha de Pagamento',
        email: 'ana.dp@empresa.com',
        photo: createAvatarSvg('#6366f1', 'AS'),
        contact: '(11) 98765-4321'
      },

      {
        id: 'm-2',
        name: 'Carlos Oliveira',
        role: 'Assistente de Admissão e Benefícios',
        email: 'carlos.dp@empresa.com',
        photo: createAvatarSvg('#10b981', 'CO'),
        contact: '(11) 97654-3210'
      },

      {
        id: 'm-3',
        name: 'Mariana Costa',
        role: 'Especialista eSocial & Encargos',
        email: 'mariana.dp@empresa.com',
        photo: createAvatarSvg('#d946ef', 'MC'),
        contact: '(11) 96543-2109'
      }

    ];


    for (const m of initialMembers) {

      await this.save(
        'members',
        m
      );
    }


    // ----------------------------------------------------------
    // TAREFAS
    // ----------------------------------------------------------

    const todayStr =
      new Date()
        .toISOString()
        .slice(0, 10);


    const initialTasks = [

      {
        id: 't-dp-1',

        title:
          'Fechamento da Folha de Pagamento Mensal (S-1200 / S-1210)',

        description:
          'Conferência de proventos, descontos, cálculo de INSS, IRRF e geração de contracheques.',

        memberId: 'm-1',

        category:
          'Folha de Pagamento',

        priority:
          'Alta',

        dueDate:
          todayStr,

        status:
          'EM EXECUÇÃO',

        elapsedSeconds:
          5400,

        isTimerRunning:
          true,

        lastTimerStartedAt:
          Date.now() - 600000,

        sortOrder:
          1,

        createdAt:
          new Date().toISOString()
      },


      {
        id: 't-dp-2',

        title:
          'Apuração e Fechamento do Espelho de Ponto Eletrônico',

        description:
          'Importação de marcações de ponto, cálculo de horas extras, adicionais noturnos e faltas.',

        memberId:
          'm-2',

        category:
          'Gestão de Ponto & Benefícios',

        priority:
          'Alta',

        dueDate:
          todayStr,

        status:
          'EM EXECUÇÃO',

        elapsedSeconds:
          3720,

        isTimerRunning:
          true,

        lastTimerStartedAt:
          Date.now() - 300000,

        sortOrder:
          2,

        createdAt:
          new Date().toISOString()
      },


      {
        id:
          't-dp-3',

        title:
          'Emissão da Guia DCTFWeb (INSS / FGTS Digital)',

        description:
          'Transmissão do eSocial, fechamento S-1299 e emissão do DARF previdenciário unificado.',

        memberId:
          'm-3',

        category:
          'eSocial & Encargos',

        priority:
          'Alta',

        dueDate:
          todayStr,

        status:
          'A FAZER',

        elapsedSeconds:
          0,

        isTimerRunning:
          false,

        lastTimerStartedAt:
          null,

        sortOrder:
          3,

        createdAt:
          new Date().toISOString()
      }

    ];


    for (const t of initialTasks) {

      await this.save(
        'tasks',
        t
      );
    }


    // ----------------------------------------------------------
    // IMPEDIMENTO
    // ----------------------------------------------------------

    const initialImpediment = {

      id:
        'imp-1',

      taskId:
        't-dp-1',

      description:
        'Erro no lote eSocial devido a divergência no CPF/PIS de colaborador recém-admitido.',

      createdAt:
        new Date().toISOString(),

      evidenceImage:
        null
    };


    await this.save(
      'impediments',
      initialImpediment
    );
  },


  // ==========================================================
  // RESET DATABASE
  // ==========================================================

  async resetDatabase() {

    const stores = [

      'members',

      'tasks',

      'impediments',

      'projects',

      'task_members',

      'activity_transfers',

      'cycle_templates',

      'audit_logs'

    ];


    for (const storeName of stores) {

      memoryStore[storeName] = [];

      lastFetchTime[storeName] = 0;


      const tableName =
        this.mapStoreName(storeName);


      try {

        await supabase
          .from(tableName)
          .delete()
          .neq('id', '0');

      } catch (e) {

        console.warn(
          `Não foi possível limpar ${tableName}:`,
          e
        );
      }
    }


    await this.seedInitialDataIfEmpty();
  }

};