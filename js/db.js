/**
 * ============================================================
 * MOTOR DE BANCO DE DADOS - SUPABASE
 * ============================================================
 *
 * Compatível com a estrutura atual do Supabase.
 *
 * CORREÇÕES:
 *
 * 1. activity_transfers possui tratamento próprio.
 * 2. Transferência só entra no cache após confirmação do Supabase.
 * 3. Erros de gravação não são mais ignorados.
 * 4. activity_transfers sempre busca dados atualizados.
 * 5. Criado método getPendingTransfers().
 * 6. Mantido suporte aos nomes camelCase e snake_case.
 * 7. Evita transferência "sumir" após atualizar a página.
 *
 * ============================================================
 */

import {
  createClient
} from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';


// ============================================================
// SUPABASE
// ============================================================

const SUPABASE_URL =
  'https://lspvdunxxxebzwyypqlx.supabase.co';

const SUPABASE_ANON_KEY =
  'sb_publishable_jf69uVHlxULskHzGN__srA_oTi2LWPJ';


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
// MAPA DAS TABELAS
// ============================================================

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


// ============================================================
// BANCO
// ============================================================

export const DB = {

  client: supabase,

  isCloudConnected: true,


  // ==========================================================
  // INIT
  // ==========================================================

  async init() {

    try {

      const {
        error
      } = await supabase
        .from('members')
        .select('id')
        .limit(1);


      if (error) {

        console.warn(
          '[Supabase] Erro de conexão:',
          error.message
        );

        this.isCloudConnected = false;

      } else {

        this.isCloudConnected = true;

      }

    }

    catch (error) {

      console.warn(
        '[Supabase] Servidor indisponível:',
        error
      );

      this.isCloudConnected = false;

    }


    await this.seedInitialDataIfEmpty();

  },


  // ==========================================================
  // NOME DA TABELA
  // ==========================================================

  mapStoreName(storeName) {

    return TABLE_MAP[storeName] || storeName;

  },


  // ==========================================================
  // CAMEL CASE -> SNAKE CASE
  // ==========================================================

  toSnakeCase(obj) {

    if (
      !obj ||
      typeof obj !== 'object'
    ) {

      return obj;

    }


    const result = {};


    for (const key in obj) {

      const snakeKey = key
        .replace(
          /([A-Z])/g,
          '_$1'
        )
        .toLowerCase();


      result[snakeKey] = obj[key];

    }


    return result;

  },


  // ==========================================================
  // SNAKE CASE -> CAMEL CASE
  // ==========================================================

  toCamelCase(obj) {

    if (
      !obj ||
      typeof obj !== 'object'
    ) {

      return obj;

    }


    const result = {};


    for (const key in obj) {

      const camelKey =
        key.replace(
          /_([a-z])/g,
          function (_, letter) {

            return letter.toUpperCase();

          }
        );


      result[camelKey] = obj[key];

    }


    return result;

  },


  // ==========================================================
  // PREPARA ACTIVITY TRANSFER
  //
  // A tabela activity_transfers possui estrutura própria.
  // ==========================================================

  prepareActivityTransfer(item) {

    const result = {};


    // --------------------------------------------------------
    // ID
    // --------------------------------------------------------

    if (
      item.id !== undefined &&
      item.id !== null &&
      item.id !== ''
    ) {

      result.id =
        String(item.id);

    }


    // --------------------------------------------------------
    // TASK ID
    // --------------------------------------------------------

    const taskId =
      item.taskId ??
      item.task_id ??
      item['ID da tarefa'];


    if (
      taskId !== undefined &&
      taskId !== null &&
      taskId !== ''
    ) {

      result.task_id =
        String(taskId);

    }


    // --------------------------------------------------------
    // MEMBRO DE DESTINO
    // --------------------------------------------------------

    const toMemberId =
      item.toMemberId ??
      item.to_member_id ??
      item.paraIdDoMembro ??
      item.para_id_do_membro;


    if (
      toMemberId !== undefined &&
      toMemberId !== null &&
      toMemberId !== ''
    ) {

      result.to_member_id =
        String(toMemberId);

    }


    // --------------------------------------------------------
    // MEMBRO DE ORIGEM
    //
    // IMPORTANTE:
    //
    // A estrutura informada possui:
    //
    // fromMemberId
    //
    // Portanto NÃO converter automaticamente para
    // from_member_id.
    // --------------------------------------------------------

    const fromMemberId =
      item.fromMemberId ??
      item.deIdDoMembro ??
      item.de_id_do_membro;


    if (
      fromMemberId !== undefined &&
      fromMemberId !== null &&
      fromMemberId !== ''
    ) {

      result.fromMemberId =
        String(fromMemberId);

    }


    // --------------------------------------------------------
    // COMPATIBILIDADE
    //
    // Caso o objeto possua explicitamente
    // de_id_do_membro, mantém.
    // --------------------------------------------------------

    if (
      item.de_id_do_membro !== undefined &&
      item.de_id_do_membro !== null &&
      item.de_id_do_membro !== ''
    ) {

      result.de_id_do_membro =
        String(item.de_id_do_membro);

    }


    // --------------------------------------------------------
    // STATUS
    // --------------------------------------------------------

    if (
      item.status !== undefined &&
      item.status !== null
    ) {

      result.status =
        item.status;

    }


    // --------------------------------------------------------
    // CREATED AT
    // --------------------------------------------------------

    const createdAt =
      item.createdAt ??
      item.created_at;


    if (
      createdAt !== undefined &&
      createdAt !== null
    ) {

      result.created_at =
        createdAt;

    }


    // --------------------------------------------------------
    // REQUESTED AT
    // --------------------------------------------------------

    const requestedAt =
      item.requestedAt ??
      item.requested_at;


    if (
      requestedAt !== undefined &&
      requestedAt !== null
    ) {

      result.requested_at =
        requestedAt;

    }


    // --------------------------------------------------------
    // RESPONDED AT
    // --------------------------------------------------------

    const respondedAt =
      item.respondedAt ??
      item.responded_at ??
      item.answeredAt;


    if (
      respondedAt !== undefined &&
      respondedAt !== null
    ) {

      result.responded_at =
        respondedAt;

    }


    // --------------------------------------------------------
    // SENDER ACKNOWLEDGED
    // --------------------------------------------------------

    const senderAcknowledged =
      item.senderAcknowledged ??
      item.sender_acknowledged ??
      item.remetenteConfirmado ??
      item.remetente_confirmado;


    if (
      senderAcknowledged !== undefined &&
      senderAcknowledged !== null
    ) {

      result.sender_acknowledged =
        Boolean(senderAcknowledged);

    }


    return result;

  },


  // ==========================================================
  // CONVERTE ACTIVITY TRANSFER
  // DO SUPABASE PARA O SISTEMA
  // ==========================================================

  formatActivityTransfer(item) {

    if (!item) {

      return null;

    }


    const result = {};


    // --------------------------------------------------------
    // ID
    // --------------------------------------------------------

    if (
      item.id !== undefined
    ) {

      result.id =
        item.id;

    }


    // --------------------------------------------------------
    // TASK ID
    // --------------------------------------------------------

    if (
      item.task_id !== undefined
    ) {

      result.taskId =
        item.task_id;

    }

    else if (
      item.taskId !== undefined
    ) {

      result.taskId =
        item.taskId;

    }


    // --------------------------------------------------------
    // TO MEMBER
    // --------------------------------------------------------

    if (
      item.to_member_id !== undefined
    ) {

      result.toMemberId =
        item.to_member_id;

    }

    else if (
      item.toMemberId !== undefined
    ) {

      result.toMemberId =
        item.toMemberId;

    }


    // --------------------------------------------------------
    // FROM MEMBER
    // --------------------------------------------------------

    if (
      item.fromMemberId !== undefined
    ) {

      result.fromMemberId =
        item.fromMemberId;

    }

    else if (
      item.de_id_do_membro !== undefined
    ) {

      result.fromMemberId =
        item.de_id_do_membro;

    }


    // --------------------------------------------------------
    // STATUS
    // --------------------------------------------------------

    if (
      item.status !== undefined
    ) {

      result.status =
        item.status;

    }


    // --------------------------------------------------------
    // DATAS
    // --------------------------------------------------------

    if (
      item.created_at !== undefined
    ) {

      result.createdAt =
        item.created_at;

    }


    if (
      item.requested_at !== undefined
    ) {

      result.requestedAt =
        item.requested_at;

    }


    if (
      item.responded_at !== undefined
    ) {

      result.respondedAt =
        item.responded_at;

    }


    // --------------------------------------------------------
    // CONFIRMAÇÃO
    // --------------------------------------------------------

    if (
      item.sender_acknowledged !== undefined
    ) {

      result.senderAcknowledged =
        item.sender_acknowledged;

    }

    else if (
      item.senderAcknowledged !== undefined
    ) {

      result.senderAcknowledged =
        item.senderAcknowledged;

    }


    return result;

  },


  // ==========================================================
  // GET ALL
  // ==========================================================

  async getAll(
    storeName,
    options = {}
  ) {

    let {
      forceRefresh = false
    } = options;


    // --------------------------------------------------------
    // TRANSFERÊNCIAS NÃO DEVEM FICAR PRESAS NO CACHE
    // --------------------------------------------------------

    if (
      storeName === 'activity_transfers' ||
      storeName === 'transfers'
    ) {

      forceRefresh = true;

    }


    const tableName =
      this.mapStoreName(storeName);


    const lastFetch =
      lastFetchTime[storeName] || 0;


    const cacheIsFresh =
      (
        Date.now() -
        lastFetch
      ) < CACHE_TTL_MS;


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


      let formatted;


      // ------------------------------------------------------
      // ACTIVITY TRANSFERS
      // ------------------------------------------------------

      if (
        storeName === 'activity_transfers' ||
        storeName === 'transfers'
      ) {

        formatted =
          (data || [])
            .map(item =>
              this.formatActivityTransfer(item)
            )
            .filter(Boolean);

      }


      // ------------------------------------------------------
      // OUTRAS TABELAS
      // ------------------------------------------------------

      else {

        formatted =
          (data || [])
            .map(item =>
              this.toCamelCase(item)
            );

      }


      memoryStore[storeName] =
        formatted;


      lastFetchTime[storeName] =
        Date.now();


      return formatted;

    }

    catch (err) {

      console.warn(
        `[Supabase Fetch Fallback] ${storeName}:`,
        err.message
      );


      return (
        memoryStore[storeName] || []
      );

    }

  },


  // ==========================================================
  // GET POR ID
  // ==========================================================

  async get(
    storeName,
    key
  ) {

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


      if (
        storeName === 'activity_transfers' ||
        storeName === 'transfers'
      ) {

        return this.formatActivityTransfer(
          data
        );

      }


      return this.toCamelCase(
        data
      );

    }

    catch (err) {

      const list =
        memoryStore[storeName] || [];


      return (
        list.find(
          item =>
            String(item.id) === String(key)
        ) || null
      );

    }

  },


  // ==========================================================
  // BUSCAR TRANSFERÊNCIAS PENDENTES
  //
  // IMPORTANTE:
  //
  // O usuário pode estar entrando depois.
  // Por isso a consulta é feita diretamente no Supabase.
  // ==========================================================

  async getPendingTransfers(
    memberId
  ) {

    if (
      memberId === undefined ||
      memberId === null ||
      memberId === ''
    ) {

      return [];

    }


    try {

      const {
        data,
        error
      } = await supabase
        .from('activity_transfers')
        .select('*')
        .eq(
          'to_member_id',
          String(memberId)
        )
        .eq(
          'status',
          'PENDENTE'
        )
        .order(
          'requested_at',
          {
            ascending: false
          }
        );


      if (error) {

        console.error(
          '[Transfers] Erro ao buscar pendentes:',
          error
        );

        throw error;

      }


      const transfers =
        (data || [])
          .map(item =>
            this.formatActivityTransfer(item)
          )
          .filter(Boolean);


      return transfers;

    }

    catch (error) {

      console.error(
        '[Transfers] Falha ao buscar pendentes:',
        error
      );


      return [];

    }

  },


  // ==========================================================
  // BUSCAR TRANSFERÊNCIAS DO USUÁRIO
  // ==========================================================

  async getTransfersForMember(
    memberId
  ) {

    if (
      memberId === undefined ||
      memberId === null ||
      memberId === ''
    ) {

      return [];

    }


    try {

      const {
        data,
        error
      } = await supabase
        .from('activity_transfers')
        .select('*')
        .or(
          `to_member_id.eq.${memberId},fromMemberId.eq.${memberId}`
        )
        .order(
          'requested_at',
          {
            ascending: false
          }
        );


      if (error) {

        throw error;

      }


      return (
        data || []
      )
        .map(item =>
          this.formatActivityTransfer(item)
        )
        .filter(Boolean);

    }

    catch (error) {

      console.error(
        '[Transfers] Erro ao buscar transferências:',
        error
      );


      return [];

    }

  },


  // ==========================================================
  // SALVAR
  // ==========================================================

  async save(
    storeName,
    item
  ) {

    const tableName =
      this.mapStoreName(storeName);


    // ========================================================
    // ACTIVITY TRANSFERS
    // ========================================================

    if (
      storeName === 'activity_transfers'
    ) {

      const dbItem =
        this.prepareActivityTransfer(item);


      console.log(
        '[TRANSFER] Enviando para Supabase:',
        dbItem
      );


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
          .select()
          .single();


        // ----------------------------------------------------
        // ERRO REAL
        // ----------------------------------------------------

        if (error) {

          console.error(
            '[Supabase Save Error] activity_transfers:',
            error
          );

          throw error;

        }


        // ----------------------------------------------------
        // SUPABASE CONFIRMOU
        // ----------------------------------------------------

        const savedItem =
          this.formatActivityTransfer(
            data
          );


        // ----------------------------------------------------
        // ATUALIZA CACHE SOMENTE AGORA
        // ----------------------------------------------------

        if (
          !memoryStore[storeName]
        ) {

          memoryStore[storeName] =
            [];

        }


        const idx =
          memoryStore[storeName]
            .findIndex(
              i =>
                String(i.id) ===
                String(savedItem.id)
            );


        if (idx >= 0) {

          memoryStore[storeName][idx] = {

            ...memoryStore[storeName][idx],

            ...savedItem

          };

        }

        else {

          memoryStore[storeName]
            .push(
              savedItem
            );

        }


        // ----------------------------------------------------
        // INVALIDA CACHE
        // ----------------------------------------------------

        lastFetchTime[storeName] =
          0;


        console.log(
          '[TRANSFER] Salva com sucesso:',
          savedItem
        );


        return savedItem;

      }

      catch (err) {

        console.error(
          '[TRANSFER] ERRO REAL AO SALVAR:',
          err
        );


        // ----------------------------------------------------
        // NÃO MANTER FALSO POSITIVO NO CACHE
        // ----------------------------------------------------

        if (
          memoryStore[storeName]
        ) {

          memoryStore[storeName] =
            memoryStore[storeName]
              .filter(
                i =>
                  String(i.id) !==
                  String(item.id)
              );

        }


        throw err;

      }

    }


    // ========================================================
    // OUTRAS TABELAS
    // ========================================================

    const dbItem =
      this.toSnakeCase(item);


    // --------------------------------------------------------
    // CACHE
    // --------------------------------------------------------

    if (
      !memoryStore[storeName]
    ) {

      memoryStore[storeName] =
        [];

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

    }

    else {

      memoryStore[storeName]
        .push(item);

    }


    // --------------------------------------------------------
    // SUPABASE
    // --------------------------------------------------------

    try {

      const {
        data,
        error
      } = await supabase
        .from(tableName)
        .upsert(
          dbItem
        )
        .select()
        .single();


      if (error) {

        console.error(
          `[Supabase Save Error] ${storeName}:`,
          error.message
        );

      }


      return (
        data
          ? this.toCamelCase(data)
          : item
      );

    }

    catch (err) {

      console.warn(
        `[Supabase Save Fallback] ${storeName}:`,
        err
      );


      return item;

    }

  },


  // ==========================================================
  // DELETE
  // ==========================================================

  async delete(
    storeName,
    key
  ) {

    const tableName =
      this.mapStoreName(storeName);


    // --------------------------------------------------------
    // CACHE
    // --------------------------------------------------------

    if (
      memoryStore[storeName]
    ) {

      memoryStore[storeName] =
        memoryStore[storeName]
          .filter(
            i =>
              String(i.id) !==
              String(key)
          );

    }


    // --------------------------------------------------------
    // SUPABASE
    // --------------------------------------------------------

    try {

      const {
        error
      } = await supabase
        .from(tableName)
        .delete()
        .eq(
          'id',
          key
        );


      if (error) {

        console.error(
          `[Supabase Delete Error] ${storeName}:`,
          error.message
        );

      }


    }

    catch (err) {

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
      await this.getAll(
        'members'
      );


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
      (
        bgColor,
        initials
      ) => {

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


    // --------------------------------------------------------
    // TAREFAS
    // --------------------------------------------------------

    const todayStr =
      new Date()
        .toISOString()
        .slice(
          0,
          10
        );


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


    // --------------------------------------------------------
    // IMPEDIMENTO
    // --------------------------------------------------------

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


    for (
      const storeName of stores
    ) {

      memoryStore[storeName] =
        [];

      lastFetchTime[storeName] =
        0;


      const tableName =
        this.mapStoreName(
          storeName
        );


      try {

        await supabase
          .from(tableName)
          .delete()
          .neq(
            'id',
            '0'
          );

      }

      catch (error) {

        console.warn(
          `[Reset] Erro em ${storeName}:`,
          error
        );

      }

    }


    await this.seedInitialDataIfEmpty();

  }

};