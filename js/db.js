/**
 * Motor de Banco de Dados com Supabase Cloud Persistence
 * Versão ajustada para a estrutura atual do Supabase
 */

import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

const SUPABASE_URL =
  'https://lspvdunxxxebzwyypqlx.supabase.co';

const SUPABASE_ANON_KEY =
  'sb_publishable_jf69uVHlxULskHzGN__srA_oTi2LWPJ';

export const supabase = createClient(
  SUPABASE_URL,
  SUPABASE_ANON_KEY
);


/* =========================================================
   CACHE LOCAL
========================================================= */

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


/* =========================================================
   MAPA DAS TABELAS
========================================================= */

const TABLE_MAP = {

  members: 'members',

  tasks: 'tasks',

  impediments: 'impediments',

  projects: 'projects',

  task_members: 'task_members',

  activity_transfers: 'activity_transfers',

  transfers: 'activity_transfers',

  cycle_templates: 'cycle_templates',

  audit_logs: 'audit_logs'

};


/* =========================================================
   BANCO DE DADOS
========================================================= */

export const DB = {

  client: supabase,

  isCloudConnected: true,


  /* =======================================================
     INICIALIZAÇÃO
  ======================================================= */

  async init() {

    try {

      const { error } = await supabase
        .from('members')
        .select('id')
        .limit(1);

      if (error) {

        console.warn(
          '[Supabase] Erro ao testar conexão:',
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


  /* =======================================================
     NOME DA TABELA
  ======================================================= */

  mapStoreName(storeName) {

    return TABLE_MAP[storeName] || storeName;

  },


  /* =======================================================
     CAMEL CASE -> SNAKE CASE
     
     Usado somente nas tabelas normais.
  ======================================================= */

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


  /* =======================================================
     SNAKE CASE -> CAMEL CASE
  ======================================================= */

  toCamelCase(obj) {

    if (!obj || typeof obj !== 'object') {

      return obj;

    }

    const result = {};

    for (const key in obj) {

      const camelKey = key.replace(
        /_([a-z])/g,
        function (_, letter) {

          return letter.toUpperCase();

        }
      );

      result[camelKey] = obj[key];

    }

    return result;
  },


  /* =======================================================
     PREPARA ACTIVITY TRANSFERS
     
     IMPORTANTE:
     
     A tabela REAL do Supabase é:
     
     activity_transfers
     
     E as colunas reais são:
     
     id
     task_id
     to_member_id
     status
     created_at
     responded_at
     senderAcknowledged
     requested_at
     sender_acknowledged
     taskId
     fromMemberId
     toMemberId
     de_id_do_membro
  ======================================================= */

  prepareActivityTransfer(item) {

    const result = {};


    /* =====================================================
       ID
    ===================================================== */

    if (
      item.id !== undefined &&
      item.id !== null &&
      item.id !== ''
    ) {

      result.id = String(item.id);

    }


    /* =====================================================
       ID DA TAREFA
       
       Mantemos as duas colunas existentes:
       
       task_id
       taskId
    ===================================================== */

    const taskId =
      item.taskId ??
      item.task_id;

    if (
      taskId !== undefined &&
      taskId !== null &&
      taskId !== ''
    ) {

      result.task_id = String(taskId);

      result.taskId = String(taskId);

    }


    /* =====================================================
       MEMBRO DE DESTINO
       
       Colunas existentes:
       
       to_member_id
       toMemberId
    ===================================================== */

    const toMemberId =
      item.toMemberId ??
      item.to_member_id;

    if (
      toMemberId !== undefined &&
      toMemberId !== null &&
      toMemberId !== ''
    ) {

      result.to_member_id = String(toMemberId);

      result.toMemberId = String(toMemberId);

    }


    /* =====================================================
       MEMBRO DE ORIGEM
       
       IMPORTANTE:
       
       NÃO existe:
       
       from_member_id
       
       Existe:
       
       fromMemberId
       de_id_do_membro
    ===================================================== */

    const fromMemberId =
      item.fromMemberId ??
      item.from_member_id ??
      item.de_id_do_membro;

    if (
      fromMemberId !== undefined &&
      fromMemberId !== null &&
      fromMemberId !== ''
    ) {

      result.fromMemberId =
        String(fromMemberId);

      result.de_id_do_membro =
        String(fromMemberId);

    }


    /* =====================================================
       STATUS
    ===================================================== */

    if (
      item.status !== undefined &&
      item.status !== null
    ) {

      result.status = item.status;

    }


    /* =====================================================
       DATA DE CRIAÇÃO
       
       Coluna:
       created_at
    ===================================================== */

    const createdAt =
      item.createdAt ??
      item.created_at;

    if (
      createdAt !== undefined &&
      createdAt !== null &&
      createdAt !== ''
    ) {

      result.created_at = createdAt;

    }


    /* =====================================================
       DATA DA SOLICITAÇÃO
       
       Coluna:
       requested_at
    ===================================================== */

    const requestedAt =
      item.requestedAt ??
      item.requested_at;

    if (
      requestedAt !== undefined &&
      requestedAt !== null &&
      requestedAt !== ''
    ) {

      result.requested_at = requestedAt;

    }


    /* =====================================================
       DATA DA RESPOSTA
       
       Coluna:
       responded_at
    ===================================================== */

    const respondedAt =
      item.respondedAt ??
      item.responded_at;

    if (
      respondedAt !== undefined &&
      respondedAt !== null &&
      respondedAt !== ''
    ) {

      result.responded_at = respondedAt;

    }


    /* =====================================================
       CONFIRMAÇÃO DO REMETENTE
       
       Existem duas colunas:
       
       senderAcknowledged
       sender_acknowledged
    ===================================================== */

    const senderAcknowledged =
      item.senderAcknowledged ??
      item.sender_acknowledged;

    if (
      senderAcknowledged !== undefined &&
      senderAcknowledged !== null
    ) {

      result.senderAcknowledged =
        Boolean(senderAcknowledged);

      result.sender_acknowledged =
        Boolean(senderAcknowledged);

    }


    return result;
  },


  /* =======================================================
     GET ALL
  ======================================================= */

  async getAll(storeName, options = {}) {

    const {
      forceRefresh = false
    } = options;


    const tableName =
      this.mapStoreName(storeName);


    const lastFetch =
      lastFetchTime[storeName] || 0;


    const cacheIsFresh =
      (Date.now() - lastFetch) <
      CACHE_TTL_MS;


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


      /*
       * Para activity_transfers NÃO fazemos
       * conversão automática snake_case -> camelCase,
       * porque existem colunas camelCase reais
       * no banco.
       */

      let formatted;


      if (
        storeName === 'activity_transfers' ||
        storeName === 'transfers'
      ) {

        formatted = data || [];

      } else {

        formatted =
          (data || []).map(item =>
            this.toCamelCase(item)
          );

      }


      memoryStore[storeName] =
        formatted;


      lastFetchTime[storeName] =
        Date.now();


      return formatted;


    } catch (err) {

      console.warn(
        `[Supabase Fetch Fallback] ${storeName}:`,
        err.message
      );


      return (
        memoryStore[storeName] || []
      );
    }
  },


  /* =======================================================
     GET POR ID
  ======================================================= */

  async get(storeName, key) {

    const tableName =
      this.mapStoreName(storeName);


    try {

      let query;


      /* ---------------------------------------------------
         ACTIVITY TRANSFERS
         
         Chave primária = id
      --------------------------------------------------- */

      if (
        storeName === 'activity_transfers' ||
        storeName === 'transfers'
      ) {

        query = supabase
          .from(tableName)
          .select('*')
          .eq('id', String(key))
          .single();


      } else {

        query = supabase
          .from(tableName)
          .select('*')
          .eq('id', key)
          .single();

      }


      const {
        data,
        error
      } = await query;


      if (error) {

        throw error;

      }


      if (
        storeName === 'activity_transfers' ||
        storeName === 'transfers'
      ) {

        return data;

      }


      return this.toCamelCase(data);


    } catch (err) {

      const list =
        memoryStore[storeName] || [];


      return list.find(
        item => String(item.id) === String(key)
      ) || null;

    }
  },


  /* =======================================================
     SAVE
  ======================================================= */

  async save(storeName, item) {

    const tableName =
      this.mapStoreName(storeName);


    /* =====================================================
       ACTIVITY TRANSFERS
    ===================================================== */

    if (
      storeName === 'activity_transfers' ||
      storeName === 'transfers'
    ) {

      const dbItem =
        this.prepareActivityTransfer(item);


      /* ---------------------------------------------------
         CACHE
      --------------------------------------------------- */

      if (!memoryStore[storeName]) {

        memoryStore[storeName] = [];

      }


      const idx =
        memoryStore[storeName]
          .findIndex(
            i =>
              String(i.id) ===
              String(item.id)
          );


      if (idx >= 0) {

        memoryStore[storeName][idx] = {

          ...memoryStore[storeName][idx],

          ...item

        };

      } else {

        memoryStore[storeName]
          .push(item);

      }


      /* ---------------------------------------------------
         SUPABASE
      --------------------------------------------------- */

      try {

        const {
          data,
          error
        } = await supabase
          .from(tableName)
          .upsert(
            dbItem,
            {
              onConflict: 'id'
            }
          )
          .select();


        if (error) {

          console.error(
            '[Supabase Save Error] activity_transfers:',
            error.message
          );

        } else {

          console.log(
            '[Supabase] Transferência salva:',
            data
          );

        }


      } catch (err) {

        console.error(
          '[Supabase Save Exception] activity_transfers:',
          err
        );

      }


      return item;
    }


    /* =====================================================
       TABELAS NORMAIS
    ===================================================== */

    const dbItem =
      this.toSnakeCase(item);


    /* ---------------------------------------------------
       CACHE
    --------------------------------------------------- */

    if (!memoryStore[storeName]) {

      memoryStore[storeName] = [];

    }


    const idx =
      memoryStore[storeName]
        .findIndex(
          i =>
            String(i.id) ===
            String(item.id)
        );


    if (idx >= 0) {

      memoryStore[storeName][idx] = {

        ...memoryStore[storeName][idx],

        ...item

      };

    } else {

      memoryStore[storeName]
        .push(item);

    }


    /* ---------------------------------------------------
       SUPABASE
    --------------------------------------------------- */

    try {

      const {
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


  /* =======================================================
     DELETE
  ======================================================= */

  async delete(storeName, key) {

    const tableName =
      this.mapStoreName(storeName);


    /* ---------------------------------------------------
       CACHE
    --------------------------------------------------- */

    if (memoryStore[storeName]) {

      memoryStore[storeName] =
        memoryStore[storeName]
          .filter(
            i =>
              String(i.id) !==
              String(key)
          );

    }


    /* ---------------------------------------------------
       SUPABASE
    --------------------------------------------------- */

    try {

      const {
        error
      } = await supabase
        .from(tableName)
        .delete()
        .eq('id', String(key));


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


  /* =======================================================
     DADOS INICIAIS
  ======================================================= */

  async seedInitialDataIfEmpty() {

    const members =
      await this.getAll('members');


    if (
      members &&
      members.length > 0
    ) {

      return;

    }


    /* =====================================================
       AVATAR
    ===================================================== */

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


    /* =====================================================
       MEMBROS
    ===================================================== */

    const initialMembers = [

      {
        id: 'm-1',

        name:
          'Ana Silva',

        role:
          'Analista de Folha de Pagamento',

        email:
          'ana.dp@empresa.com',

        photo:
          createAvatarSvg(
            '#6366f1',
            'AS'
          ),

        contact:
          '(11) 98765-4321'
      },


      {
        id: 'm-2',

        name:
          'Carlos Oliveira',

        role:
          'Assistente de Admissão e Benefícios',

        email:
          'carlos.dp@empresa.com',

        photo:
          createAvatarSvg(
            '#10b981',
            'CO'
          ),

        contact:
          '(11) 97654-3210'
      },


      {
        id: 'm-3',

        name:
          'Mariana Costa',

        role:
          'Especialista eSocial & Encargos',

        email:
          'mariana.dp@empresa.com',

        photo:
          createAvatarSvg(
            '#d946ef',
            'MC'
          ),

        contact:
          '(11) 96543-2109'
      }

    ];


    for (
      const member of initialMembers
    ) {

      await this.save(
        'members',
        member
      );

    }


    /* =====================================================
       TAREFAS
    ===================================================== */

    const todayStr =
      new Date()
        .toISOString()
        .slice(0, 10);


    const initialTasks = [

      {

        id:
          't-dp-1',

        title:
          'Fechamento da Folha de Pagamento Mensal (S-1200 / S-1210)',

        description:
          'Conferência de proventos, descontos, cálculo de INSS, IRRF e geração de contracheques.',

        memberId:
          'm-1',

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

        id:
          't-dp-2',

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


    for (
      const task of initialTasks
    ) {

      await this.save(
        'tasks',
        task
      );

    }


    /* =====================================================
       IMPEDIMENTO
    ===================================================== */

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


  /* =======================================================
     RESET DO BANCO
  ======================================================= */

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


    for (
      const storeName of stores
    ) {

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
          `[Reset] Erro em ${storeName}:`,
          e
        );

      }

    }


    await this.seedInitialDataIfEmpty();

  }

};