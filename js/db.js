/**
 * ============================================================
 * MOTOR DE BANCO DE DADOS - SUPABASE
 * ============================================================
 *
 * Versão atualizada
 *
 * PRINCIPAIS CORREÇÕES:
 *
 * 1. Transferências sempre possuem status PENDENTE.
 * 2. O registro só entra no cache como confirmado após o
 *    Supabase aceitar a gravação.
 * 3. Upsert de activity_transfers retorna o registro salvo.
 * 4. Cache é invalidado após alterações.
 * 5. Realtime para activity_transfers.
 * 6. Outro usuário NÃO precisa estar conectado no momento
 *    em que a transferência é criada.
 * 7. Ao entrar no sistema, o usuário busca as transferências
 *    pendentes diretamente do Supabase.
 * 8. Evita que uma transferência "desapareça" após atualizar.
 * 9. Tratamento especial para activity_transfers.
 * 10. Compatibilidade CamelCase / SnakeCase.
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
  SUPABASE_ANON_KEY,
  {
    auth: {
      persistSession: false
    },
    realtime: {
      params: {
        eventsPerSecond: 10
      }
    }
  }
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


// Cache curto para as tabelas normais.
// activity_transfers possui tratamento especial.
const CACHE_TTL_MS = 3000;


// ============================================================
// REALTIME
// ============================================================

let realtimeChannel = null;

let realtimeStarted = false;


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

  realtimeConnected: false,


  // ========================================================
  // INIT
  // ========================================================

  async init() {

    console.log(
      '[DB] Inicializando banco...'
    );


    try {

      const {
        data,
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

      }

      else {

        this.isCloudConnected = true;

        console.log(
          '[Supabase] Conectado.'
        );

      }

    }

    catch (error) {

      console.warn(
        '[Supabase] Servidor indisponível:',
        error
      );

      this.isCloudConnected = false;

    }


    // ------------------------------------------------------
    // REALTIME
    // ------------------------------------------------------

    this.startRealtime();


    // ------------------------------------------------------
    // SEED
    // ------------------------------------------------------

    if (this.isCloudConnected) {

      await this.seedInitialDataIfEmpty();

    }

  },


  // ========================================================
  // REALTIME
  // ========================================================

  startRealtime() {

    if (realtimeStarted) {

      return;

    }


    realtimeStarted = true;


    try {

      realtimeChannel =
        supabase
          .channel(
            'db-realtime-activity-transfers'
          )

          .on(
            'postgres_changes',
            {
              event: '*',
              schema: 'public',
              table: 'activity_transfers'
            },

            payload => {

              console.log(
                '[Realtime] Activity transfer:',
                payload
              );


              this.handleRealtimeTransfer(
                payload
              );

            }
          )

          .subscribe(
            status => {

              console.log(
                '[Realtime] Status:',
                status
              );


              if (
                status === 'SUBSCRIBED'
              ) {

                this.realtimeConnected =
                  true;

                console.log(
                  '[Realtime] Conectado.'
                );

              }

              else {

                this.realtimeConnected =
                  false;

              }

            }
          );


    }

    catch (error) {

      console.warn(
        '[Realtime] Erro ao iniciar:',
        error
      );

      this.realtimeConnected =
        false;

    }

  },


  // ========================================================
  // PROCESSA ALTERAÇÃO DA TRANSFERÊNCIA
  // ========================================================

  handleRealtimeTransfer(payload) {

    const eventType =
      payload.eventType;


    const newData =
      payload.new || null;


    const oldData =
      payload.old || null;


    // ------------------------------------------------------
    // INSERT
    // ------------------------------------------------------

    if (
      eventType === 'INSERT' &&
      newData
    ) {

      const formatted =
        this.formatActivityTransfer(
          newData
        );


      this.upsertMemoryItem(
        'activity_transfers',
        formatted
      );


      this.dispatchDatabaseEvent(
        'activity_transfer_created',
        formatted
      );


      return;

    }


    // ------------------------------------------------------
    // UPDATE
    // ------------------------------------------------------

    if (
      eventType === 'UPDATE' &&
      newData
    ) {

      const formatted =
        this.formatActivityTransfer(
          newData
        );


      this.upsertMemoryItem(
        'activity_transfers',
        formatted
      );


      this.dispatchDatabaseEvent(
        'activity_transfer_updated',
        formatted
      );


      return;

    }


    // ------------------------------------------------------
    // DELETE
    // ------------------------------------------------------

    if (
      eventType === 'DELETE' &&
      oldData
    ) {

      const id =
        oldData.id;


      memoryStore.activity_transfers =
        memoryStore.activity_transfers.filter(
          item => item.id !== id
        );


      this.dispatchDatabaseEvent(
        'activity_transfer_deleted',
        oldData
      );

    }

  },


  // ========================================================
  // EVENTO GLOBAL DO BANCO
  // ========================================================

  dispatchDatabaseEvent(
    eventName,
    detail
  ) {

    try {

      window.dispatchEvent(
        new CustomEvent(
          eventName,
          {
            detail
          }
        )
      );

    }

    catch (error) {

      console.warn(
        '[DB Event]',
        error
      );

    }

  },


  // ========================================================
  // NOME DA TABELA
  // ========================================================

  mapStoreName(storeName) {

    return (
      TABLE_MAP[storeName] ||
      storeName
    );

  },


  // ========================================================
  // CAMEL CASE -> SNAKE CASE
  // ========================================================

  toSnakeCase(obj) {

    if (
      !obj ||
      typeof obj !== 'object'
    ) {

      return obj;

    }


    const result = {};


    for (
      const key in obj
    ) {

      const snakeKey =
        key
          .replace(
            /([A-Z])/g,
            '_$1'
          )
          .toLowerCase();


      result[snakeKey] =
        obj[key];

    }


    return result;

  },


  // ========================================================
  // SNAKE CASE -> CAMEL CASE
  // ========================================================

  toCamelCase(obj) {

    if (
      !obj ||
      typeof obj !== 'object'
    ) {

      return obj;

    }


    const result = {};


    for (
      const key in obj
    ) {

      const camelKey =
        key.replace(
          /_([a-z])/g,
          function (_, letter) {

            return letter.toUpperCase();

          }
        );


      result[camelKey] =
        obj[key];

    }


    return result;

  },


  // ========================================================
  // PREPARA ACTIVITY TRANSFER
  // ========================================================

  prepareActivityTransfer(item) {

    const result = {};


    // ------------------------------------------------------
    // ID
    // ------------------------------------------------------

    if (
      item.id !== undefined &&
      item.id !== null &&
      item.id !== ''
    ) {

      result.id =
        String(item.id);

    }


    // ------------------------------------------------------
    // TASK ID
    // ------------------------------------------------------

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


    // ------------------------------------------------------
    // MEMBRO DE DESTINO
    // ------------------------------------------------------

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


    // ------------------------------------------------------
    // MEMBRO DE ORIGEM
    // ------------------------------------------------------

    const fromMemberId =
      item.fromMemberId ??
      item.from_member_id ??
      item.deIdDoMembro ??
      item.de_id_do_membro;


    if (
      fromMemberId !== undefined &&
      fromMemberId !== null &&
      fromMemberId !== ''
    ) {

      /*
       * ATENÇÃO:
       *
       * Conforme sua estrutura atual,
       * a coluna real é fromMemberId.
       */

      result.fromMemberId =
        String(fromMemberId);

    }


    // ------------------------------------------------------
    // DE_ID_DO_MEMBRO
    // ------------------------------------------------------

    if (
      item.de_id_do_membro !== undefined &&
      item.de_id_do_membro !== null &&
      item.de_id_do_membro !== ''
    ) {

      result.de_id_do_membro =
        String(
          item.de_id_do_membro
        );

    }


    // ------------------------------------------------------
    // STATUS
    // ------------------------------------------------------

    /*
     * Se não vier status,
     * a transferência nasce como PENDENTE.
     */

    result.status =
      item.status ||
      'PENDENTE';


    // ------------------------------------------------------
    // CREATED AT
    // ------------------------------------------------------

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

    else {

      result.created_at =
        new Date().toISOString();

    }


    // ------------------------------------------------------
    // REQUESTED AT
    // ------------------------------------------------------

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

    else {

      result.requested_at =
        new Date().toISOString();

    }


    // ------------------------------------------------------
    // RESPONDED AT
    // ------------------------------------------------------

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


    // ------------------------------------------------------
    // SENDER ACKNOWLEDGED
    // ------------------------------------------------------

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
        Boolean(
          senderAcknowledged
        );

    }

    else {

      result.sender_acknowledged =
        false;

    }


    return result;

  },


  // ========================================================
  // FORMATA ACTIVITY TRANSFER
  // ========================================================

  formatActivityTransfer(item) {

    if (!item) {

      return null;

    }


    const result = {};


    // ------------------------------------------------------
    // ID
    // ------------------------------------------------------

    if (
      item.id !== undefined
    ) {

      result.id =
        item.id;

    }


    // ------------------------------------------------------
    // TASK ID
    // ------------------------------------------------------

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


    // ------------------------------------------------------
    // TO MEMBER
    // ------------------------------------------------------

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


    // ------------------------------------------------------
    // FROM MEMBER
    // ------------------------------------------------------

    if (
      item.fromMemberId !== undefined
    ) {

      result.fromMemberId =
        item.fromMemberId;

    }

    else if (
      item.from_member_id !== undefined
    ) {

      result.fromMemberId =
        item.from_member_id;

    }

    else if (
      item.de_id_do_membro !== undefined
    ) {

      result.fromMemberId =
        item.de_id_do_membro;

    }


    // ------------------------------------------------------
    // STATUS
    // ------------------------------------------------------

    result.status =
      item.status ||
      'PENDENTE';


    // ------------------------------------------------------
    // DATAS
    // ------------------------------------------------------

    if (
      item.created_at !== undefined
    ) {

      result.createdAt =
        item.created_at;

    }

    else if (
      item.createdAt !== undefined
    ) {

      result.createdAt =
        item.createdAt;

    }


    if (
      item.requested_at !== undefined
    ) {

      result.requestedAt =
        item.requested_at;

    }

    else if (
      item.requestedAt !== undefined
    ) {

      result.requestedAt =
        item.requestedAt;

    }


    if (
      item.responded_at !== undefined
    ) {

      result.respondedAt =
        item.responded_at;

    }

    else if (
      item.respondedAt !== undefined
    ) {

      result.respondedAt =
        item.respondedAt;

    }


    // ------------------------------------------------------
    // CONFIRMAÇÃO
    // ------------------------------------------------------

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


  // ========================================================
  // ATUALIZA CACHE
  // ========================================================

  upsertMemoryItem(
    storeName,
    item
  ) {

    if (
      !memoryStore[storeName]
    ) {

      memoryStore[storeName] = [];

    }


    const index =
      memoryStore[storeName].findIndex(
        current =>
          current.id === item.id
      );


    if (index >= 0) {

      memoryStore[storeName][index] = {

        ...memoryStore[storeName][index],

        ...item

      };

    }

    else {

      memoryStore[storeName].push(
        item
      );

    }


    lastFetchTime[storeName] =
      Date.now();

  },


  // ========================================================
  // INVALIDA CACHE
  // ========================================================

  invalidateCache(
    storeName
  ) {

    lastFetchTime[storeName] =
      0;

  },


  // ========================================================
  // GET ALL
  // ========================================================

  async getAll(
    storeName,
    options = {}
  ) {

    const {
      forceRefresh = false
    } = options;


    const tableName =
      this.mapStoreName(
        storeName
      );


    const lastFetch =
      lastFetchTime[storeName] ||
      0;


    const cacheIsFresh =
      (
        Date.now() -
        lastFetch
      ) < CACHE_TTL_MS;


    const hasCachedData =
      memoryStore[storeName] &&
      memoryStore[storeName].length >
      0;


    /*
     * Activity transfers é importante:
     *
     * Se solicitado forceRefresh,
     * SEMPRE consulta o Supabase.
     */

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


      if (
        storeName ===
        'activity_transfers'
      ) {

        formatted =
          (
            data || []
          ).map(
            item =>
              this.formatActivityTransfer(
                item
              )
          );

      }

      else {

        formatted =
          (
            data || []
          ).map(
            item =>
              this.toCamelCase(
                item
              )
          );

      }


      memoryStore[storeName] =
        formatted;


      lastFetchTime[storeName] =
        Date.now();


      return [
        ...formatted
      ];

    }

    catch (err) {

      console.warn(
        `[Supabase Fetch Fallback] ${storeName}:`,
        err.message
      );


      return [
        ...(memoryStore[storeName] || [])
      ];

    }

  },


  // ========================================================
  // GET POR ID
  // ========================================================

  async get(
    storeName,
    key
  ) {

    const tableName =
      this.mapStoreName(
        storeName
      );


    try {

      const {
        data,
        error
      } = await supabase
        .from(tableName)
        .select('*')
        .eq(
          'id',
          key
        )
        .maybeSingle();


      if (error) {

        throw error;

      }


      if (!data) {

        return null;

      }


      if (
        storeName ===
        'activity_transfers'
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
        memoryStore[storeName] ||
        [];


      return (
        list.find(
          item =>
            String(item.id) ===
            String(key)
        ) ||
        null
      );

    }

  },


  // ========================================================
  // SAVE
  // ========================================================

  mapStoreName(storeName) {
    return storeName;
  },

  async save(storeName, item) {
    const tableName = this.mapStoreName(storeName);

    if (storeName === 'activity_transfers') {
      const dbItem = this.toSnakeCase(item);
      try {
        const { data, error } = await supabase
          .from('activity_transfers')
          .upsert(dbItem)
          .select('*')
          .single();

        if (error) {
          console.warn('[Supabase Save Error] activity_transfers:', error.message);
          return null;
        }

        const formatted = this.formatActivityTransfer(data);
        this.upsertMemoryItem('activity_transfers', formatted);
        return formatted;
      } catch (err) {
        console.warn('[Supabase Save Exception] activity_transfers:', err);
        return null;
      }
    }

    const dbItem = this.toSnakeCase(item);

    try {
      const { data, error } = await supabase
        .from(tableName)
        .upsert(dbItem)
        .select('*')
        .single();

      if (error) {
        console.warn(`[Supabase Save Fallback] ${storeName}:`, error.message);
        this.upsertMemoryItem(storeName, item);
        return item;
      }

      const formatted = this.toCamelCase(data);
      this.upsertMemoryItem(storeName, formatted);
      return formatted;
    } catch (err) {
      console.warn(`[Supabase Save Exception] ${storeName}:`, err);
      this.upsertMemoryItem(storeName, item);
      return item;
    }
  },


  // ========================================================
  // DELETE
  // ========================================================

  async delete(
    storeName,
    key
  ) {

    const tableName =
      this.mapStoreName(
        storeName
      );


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

        throw error;

      }


      if (
        memoryStore[storeName]
      ) {

        memoryStore[storeName] =
          memoryStore[storeName].filter(
            item =>
              String(item.id) !==
              String(key)
          );

      }


      this.invalidateCache(
        storeName
      );


      return true;

    }

    catch (err) {

      console.error(
        `[Supabase Delete Error] ${storeName}:`,
        err
      );


      return false;

    }

  },


  // ========================================================
  // BUSCAR TRANSFERÊNCIAS DO USUÁRIO
  // ========================================================

  async getTransfersForMember(
    memberId
  ) {

    try {

      /*
       * Busca diretamente no banco.
       *
       * Portanto, o usuário pode ter entrado agora
       * e ainda assim receber a transferência criada
       * anteriormente.
       */

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
        .order(
          'created_at',
          {
            ascending: false
          }
        );


      if (error) {

        throw error;

      }


      const transfers =
        (
          data || []
        ).map(
          item =>
            this.formatActivityTransfer(
              item
            )
        );


      /*
       * Atualiza cache.
       */

      memoryStore.activity_transfers =
        transfers;


      lastFetchTime.activity_transfers =
        Date.now();


      return transfers;

    }

    catch (error) {

      console.error(
        '[Transfers] Erro ao buscar:',
        error
      );


      return (
        memoryStore.activity_transfers ||
        []
      );

    }

  },


  // ========================================================
  // BUSCAR TRANSFERÊNCIAS PENDENTES
  // ========================================================

  async getPendingTransfers(
    memberId
  ) {

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
          'created_at',
          {
            ascending: false
          }
        );


      if (error) {

        throw error;

      }


      const transfers =
        (
          data || []
        ).map(
          item =>
            this.formatActivityTransfer(
              item
            )
        );


      /*
       * Mescla com cache em vez de substituir
       * indiscriminadamente.
       */

      for (
        const transfer of transfers
      ) {

        this.upsertMemoryItem(
          'activity_transfers',
          transfer
        );

      }


      return transfers;

    }

    catch (error) {

      console.error(
        '[Transfers Pending] Erro:',
        error
      );


      return (
        memoryStore.activity_transfers ||
        []
      ).filter(
        transfer =>
          String(
            transfer.toMemberId
          ) === String(memberId) &&
          (
            transfer.status ||
            'PENDENTE'
          ) === 'PENDENTE'
      );

    }

  },


  // ========================================================
  // ACEITAR TRANSFERÊNCIA
  // ========================================================

  async acceptTransfer(
    transferId
  ) {

    try {

      const {
        data,
        error
      } = await supabase
        .from('activity_transfers')
        .update({
          status: 'ACEITA',
          responded_at:
            new Date().toISOString()
        })
        .eq(
          'id',
          transferId
        )
        .select('*')
        .single();


      if (error) {

        throw error;

      }


      const formatted =
        this.formatActivityTransfer(
          data
        );


      this.upsertMemoryItem(
        'activity_transfers',
        formatted
      );


      this.dispatchDatabaseEvent(
        'activity_transfer_accepted',
        formatted
      );


      return formatted;

    }

    catch (error) {

      console.error(
        '[Transfer] Erro ao aceitar:',
        error
      );


      return null;

    }

  },


  // ========================================================
  // RECUSAR TRANSFERÊNCIA
  // ========================================================

  async rejectTransfer(
    transferId
  ) {

    try {

      const {
        data,
        error
      } = await supabase
        .from('activity_transfers')
        .update({
          status: 'RECUSADA',
          responded_at:
            new Date().toISOString()
        })
        .eq(
          'id',
          transferId
        )
        .select('*')
        .single();


      if (error) {

        throw error;

      }


      const formatted =
        this.formatActivityTransfer(
          data
        );


      this.upsertMemoryItem(
        'activity_transfers',
        formatted
      );


      this.dispatchDatabaseEvent(
        'activity_transfer_rejected',
        formatted
      );


      return formatted;

    }

    catch (error) {

      console.error(
        '[Transfer] Erro ao recusar:',
        error
      );


      return null;

    }

  },


  // ========================================================
  // CONFIRMAR RECEBIMENTO PELO REMETENTE
  // ========================================================

  async acknowledgeTransfer(
    transferId
  ) {

    try {

      const {
        data,
        error
      } = await supabase
        .from('activity_transfers')
        .update({
          sender_acknowledged:
            true
        })
        .eq(
          'id',
          transferId
        )
        .select('*')
        .single();


      if (error) {

        throw error;

      }


      const formatted =
        this.formatActivityTransfer(
          data
        );


      this.upsertMemoryItem(
        'activity_transfers',
        formatted
      );


      return formatted;

    }

    catch (error) {

      console.error(
        '[Transfer] Erro ao confirmar:',
        error
      );


      return null;

    }

  },


  // ========================================================
  // DADOS INICIAIS
  // ========================================================

  async seedInitialDataIfEmpty() {

    const members =
      await this.getAll(
        'members',
        {
          forceRefresh: true
        }
      );


    if (
      members &&
      members.length > 0
    ) {

      return;

    }


    // ------------------------------------------------------
    // AVATAR
    // ------------------------------------------------------

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


    // ------------------------------------------------------
    // MEMBROS
    // ------------------------------------------------------

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


    // ------------------------------------------------------
    // TAREFAS
    // ------------------------------------------------------

    const todayStr =
      new Date()
        .toISOString()
        .slice(
          0,
          10
        );


    const initialTasks = [

      {
        id: 't-dp-1',

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


    // ------------------------------------------------------
    // IMPEDIMENTO
    // ------------------------------------------------------

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


  // ========================================================
  // RESET DO BANCO
  // ========================================================

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

        const {
          error
        } = await supabase
          .from(tableName)
          .delete()
          .neq(
            'id',
            '0'
          );


        if (error) {

          console.warn(
            `[Reset] Erro em ${storeName}:`,
            error
          );

        }

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