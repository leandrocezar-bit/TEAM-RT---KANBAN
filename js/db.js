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
// CACHE LOCAL
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

      if (error) {

        console.warn(
          '[Supabase] Erro na conexão:',
          error.message
        );

        this.isCloudConnected = false;

      } else {

        this.isCloudConnected = true;

      }

    } catch (err) {

      console.warn(
        '[Supabase] Servidor indisponível:',
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
  // CAMEL CASE → SNAKE CASE
  // ==========================================================

  toSnakeCase(obj) {

    if (!obj || typeof obj !== 'object') {
      return obj;
    }

    const result = {};

    for (const key in obj) {

      const snakeKey = key
        .replace(/([A-Z])/g, '_$1')
        .toLowerCase();

      result[snakeKey] = obj[key];
    }

    return result;
  },


  // ==========================================================
  // SNAKE CASE → CAMEL CASE
  // ==========================================================

  toCamelCase(obj) {

    if (!obj || typeof obj !== 'object') {
      return obj;
    }

    const result = {};

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
  // BUSCAR TODOS
  // ==========================================================

  async getAll(storeName, options = {}) {

    const {
      forceRefresh = false
    } = options;

    const tableName = this.mapStoreName(storeName);

    const lastFetch =
      lastFetchTime[storeName] || 0;

    const cacheIsFresh =
      (Date.now() - lastFetch) < CACHE_TTL_MS;

    const hasCachedData =
      Array.isArray(memoryStore[storeName]) &&
      memoryStore[storeName].length > 0;


    // Usa cache quando possível
    if (
      !forceRefresh &&
      cacheIsFresh &&
      hasCachedData
    ) {

      return memoryStore[storeName];
    }


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
          this.toCamelCase(item)
        );


      memoryStore[storeName] = formatted;

      lastFetchTime[storeName] =
        Date.now();


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
  // BUSCAR UM REGISTRO
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


      return this.toCamelCase(data);


    } catch (err) {

      const list =
        memoryStore[storeName] || [];


      return (
        list.find(item => item.id === key) ||
        null
      );
    }
  },


  // ==========================================================
  // PREPARA DADOS PARA ACTIVITY_TRANSFERS
  // ==========================================================

  prepareActivityTransfer(item) {

    const dbItem =
      this.toSnakeCase(item);


    /*
     * IMPORTANTE:
     *
     * O Supabase informou que a tabela
     * activity_transfers NÃO possui
     * a coluna from_member_id.
     *
     * Portanto removemos essa coluna
     * antes do envio.
     *
     * Isso impede que um erro nessa tabela
     * derrube o restante do sistema.
     */

    delete dbItem.from_member_id;


    return dbItem;
  },


  // ==========================================================
  // SALVAR
  // ==========================================================

  async save(storeName, item) {

    const tableName =
      this.mapStoreName(storeName);


    let dbItem =
      this.toSnakeCase(item);


    // --------------------------------------------------------
    // AJUSTE ESPECÍFICO DA ACTIVITY_TRANSFERS
    // --------------------------------------------------------

    if (storeName === 'activity_transfers') {

      dbItem =
        this.prepareActivityTransfer(item);
    }


    // --------------------------------------------------------
    // ATUALIZA CACHE LOCAL IMEDIATAMENTE
    // --------------------------------------------------------

    if (!memoryStore[storeName]) {

      memoryStore[storeName] = [];
    }


    const idx =
      memoryStore[storeName].findIndex(
        i => i.id === item.id
      );


    if (idx >= 0) {

      memoryStore[storeName][idx] = {
        ...memoryStore[storeName][idx],
        ...item
      };

    } else {

      memoryStore[storeName].push(item);
    }


    // --------------------------------------------------------
    // SALVA NO SUPABASE
    // --------------------------------------------------------

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

      } else {

        this.isCloudConnected = true;
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
  // EXCLUIR
  // ==========================================================

  async delete(storeName, key) {

    const tableName =
      this.mapStoreName(storeName);


    // Atualiza cache
    if (memoryStore[storeName]) {

      memoryStore[storeName] =
        memoryStore[storeName].filter(
          i => i.id !== key
        );
    }


    try {

      const { error } =
        await supabase
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
  // DADOS INICIAIS
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


    // --------------------------------------------------------
    // AVATAR
    // --------------------------------------------------------

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


    // --------------------------------------------------------
    // MEMBROS
    // --------------------------------------------------------

    const initialMembers = [

      {
        id: 'm-1',
        name: 'Ana Silva',
        role: 'Analista de Folha de Pagamento',
        email: 'ana.dp@empresa.com',
        photo: createAvatarSvg(
          '#6366f1',
          'AS'
        ),
        contact: '(11) 98765-4321'
      },

      {
        id: 'm-2',
        name: 'Carlos Oliveira',
        role: 'Assistente de Admissão e Benefícios',
        email: 'carlos.dp@empresa.com',
        photo: createAvatarSvg(
          '#10b981',
          'CO'
        ),
        contact: '(11) 97654-3210'
      },

      {
        id: 'm-3',
        name: 'Mariana Costa',
        role: 'Especialista eSocial & Encargos',
        email: 'mariana.dp@empresa.com',
        photo: createAvatarSvg(
          '#d946ef',
          'MC'
        ),
        contact: '(11) 96543-2109'
      }

    ];


    for (const member of initialMembers) {

      await this.save(
        'members',
        member
      );
    }


    // --------------------------------------------------------
    // TAREFAS
    // --------------------------------------------------------

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
        id: 't-dp-3',

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


    for (const task of initialTasks) {

      await this.save(
        'tasks',
        task
      );
    }


    // --------------------------------------------------------
    // IMPEDIMENTO
    // --------------------------------------------------------

    const initialImpediment = {

      id: 'imp-1',

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
  // RESET DO BANCO
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
          `[Reset] Erro em ${tableName}:`,
          e.message
        );
      }
    }


    await this.seedInitialDataIfEmpty();
  }

};