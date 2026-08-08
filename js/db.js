/**
 * Motor de Banco de Dados com Supabase Cloud Persistence
 * Versão compatível com a estrutura atual do Supabase
 */

import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

const SUPABASE_URL = 'https://lspvdunxxxebzwyypqlx.supabase.co';

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
   CONFIGURAÇÃO DAS TABELAS
   ========================================================= */

const TABLE_MAP = {

  members: 'members',

  tasks: 'tasks',

  impediments: 'impediments',

  projects: 'projects',

  task_members: 'task_members',

  /*
   * IMPORTANTE:
   * No seu Supabase a tabela NÃO se chama
   * activity_transfers.
   *
   * O nome real mostrado no seu print é:
   * transferências_de_atividade
   */
  activity_transfers: 'transferências_de_atividade',

  transfers: 'transferências_de_atividade',

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
     ADAPTA TRANSFERÊNCIA DE ATIVIDADE
     PARA A ESTRUTURA REAL DO SUPABASE
     ======================================================= */

  prepareActivityTransfer(item) {

    const result = {};

    /*
     * ID
     *
     * No seu banco a primeira coluna está como:
     * "eu ia"
     *
     * Como ela é a chave primária, usamos ela como ID.
     */

    if (
      item.id !== undefined &&
      item.id !== null
    ) {

      result['eu ia'] = String(item.id);

    }


    /*
     * ID DA TAREFA
     *
     * Seu banco possui:
     * id_da_tarefa
     * ID da tarefa
     *
     * Vamos preencher as duas para manter
     * compatibilidade com a estrutura atual.
     */

    const taskId =
      item.taskId ??
      item.id_da_tarefa ??
      item['ID da tarefa'];

    if (
      taskId !== undefined &&
      taskId !== null
    ) {

      result['id_da_tarefa'] = String(taskId);

      result['ID da tarefa'] = String(taskId);

    }


    /*
     * MEMBRO DE DESTINO
     */

    const toMemberId =
      item.toMemberId ??
      item.paraIdDoMembro ??
      item.para_id_do_membro ??
      item['paral do membro'];

    if (
      toMemberId !== undefined &&
      toMemberId !== null
    ) {

      result['para_id_do_membro'] =
        String(toMemberId);

      result['paral do membro'] =
        String(toMemberId);

    }


    /*
     * MEMBRO DE ORIGEM
     *
     * O seu banco NÃO possui from_member_id.
     *
     * No print aparece:
     * "do ID do membro"
     *
     * Então usamos essa coluna.
     */

    const fromMemberId =
      item.fromMemberId ??
      item.from_member_id ??
      item.deIdDoMembro ??
      item['do ID do membro'];

    if (
      fromMemberId !== undefined &&
      fromMemberId !== null
    ) {

      result['do ID do membro'] =
        String(fromMemberId);

    }


    /*
     * STATUS
     */

    if (item.status !== undefined) {

      result.status = item.status;

    }


    /*
     * DATA DE CRIAÇÃO
     */

    const createdAt =
      item.createdAt ??
      item.criadoEm ??
      item.criado_em;

    if (createdAt !== undefined) {

      result.criado_em = createdAt;

    }


    /*
     * DATA DA SOLICITAÇÃO
     */

    const requestedAt =
      item.requestedAt ??
      item.solicitadoEm ??
      item.solicitado_em;

    if (requestedAt !== undefined) {

      result.solicitado_em = requestedAt;

    }


    /*
     * DATA DA RESPOSTA
     */

    const answeredAt =
      item.answeredAt ??
      item.respondeuEm ??
      item.respondeu_em;

    if (answeredAt !== undefined) {

      result.respondeu_em = answeredAt;

    }


    /*
     * CONFIRMAÇÃO DO REMETENTE
     */

    const senderConfirmed =
      item.senderConfirmed ??
      item.remetenteConfirmado ??
      item.remetente_confirmado;

    if (senderConfirmed !== undefined) {

      result.remetenteConfirmado =
        Boolean(senderConfirmed);

      result.remetente_confirmado =
        Boolean(senderConfirmed);

    }


    /*
     * OUTROS CAMPOS QUE EXISTEM NO BANCO
     */

    if (item['de_id_do_sucesso'] !== undefined) {

      result['de_id_do_sucesso'] =
        item['de_id_do_sucesso'];

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


      const formatted =
        (data || []).map(item =>
          this.toCamelCase(item)
        );


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


      /*
       * Transferências usam "eu ia"
       * como chave primária.
       */

      if (
        storeName === 'activity_transfers' ||
        storeName === 'transfers'
      ) {

        query = supabase
          .from(tableName)
          .select('*')
          .eq('eu ia', key)
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


      return this.toCamelCase(data);


    } catch (err) {

      const list =
        memoryStore[storeName] || [];


      return list.find(
        item => item.id === key
      ) || null;
    }
  },


  /* =======================================================
     SAVE
     ======================================================= */

  async save(storeName, item) {

    const tableName =
      this.mapStoreName(storeName);


    /*
     * ================================================
     * TRANSFERÊNCIA DE ATIVIDADE
     * ================================================
     */

    if (
      storeName === 'activity_transfers' ||
      storeName === 'transfers'
    ) {

      const dbItem =
        this.prepareActivityTransfer(item);


      /*
       * Atualiza cache
       */

      if (!memoryStore[storeName]) {

        memoryStore[storeName] = [];

      }


      const idx =
        memoryStore[storeName]
          .findIndex(
            i => i.id === item.id
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


      try {

        const {
          data,
          error
        } = await supabase
          .from(tableName)
          .upsert(
            dbItem,
            {
              onConflict: 'eu ia'
            }
          );


        if (error) {

          console.error(
            '[Supabase Save Error] activity_transfers:',
            error.message
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


    /*
     * ================================================
     * TABELAS NORMAIS
     * ================================================
     */

    const dbItem =
      this.toSnakeCase(item);


    /*
     * Atualiza cache imediatamente
     */

    if (!memoryStore[storeName]) {

      memoryStore[storeName] = [];

    }


    const idx =
      memoryStore[storeName]
        .findIndex(
          i => i.id === item.id
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


    /*
     * Remove do cache
     */

    if (memoryStore[storeName]) {

      memoryStore[storeName] =
        memoryStore[storeName]
          .filter(
            i => i.id !== key
          );

    }


    try {

      let query;


      /*
       * Transferência:
       * chave = "eu ia"
       */

      if (
        storeName === 'activity_transfers' ||
        storeName === 'transfers'
      ) {

        query = supabase
          .from(tableName)
          .delete()
          .eq('eu ia', key);

      } else {

        query = supabase
          .from(tableName)
          .delete()
          .eq('id', key);

      }


      const {
        error
      } = await query;


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


    /*
     * Avatar
     */

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

        /*
         * Transferências usam "eu ia"
         */

        if (
          storeName === 'activity_transfers'
        ) {

          await supabase
            .from(tableName)
            .delete()
            .neq('eu ia', '0');

        } else {

          await supabase
            .from(tableName)
            .delete()
            .neq('id', '0');

        }

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