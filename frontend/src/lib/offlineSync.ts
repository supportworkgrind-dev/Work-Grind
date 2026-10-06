import { openDB, DBSchema, IDBPDatabase } from 'idb';
import { api } from './api';
import { useSyncStore } from '@/store/useSyncStore';

export interface PendingAction {
  id: string;
  actionType: 'CREATE_TASK' | 'UPDATE_TASK' | 'UPDATE_TASK_STATUS' | 'SEND_MESSAGE';
  endpoint: string;
  method: 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  payload: any;
  tempId?: string;
  createdAt: number;
  status: 'pending' | 'syncing' | 'failed';
  retryCount: number;
  errorMessage?: string | null;
}

interface WorkGrindOfflineDB extends DBSchema {
  pendingActions: {
    key: string;
    value: PendingAction;
    indexes: {
      by_createdAt: number;
      by_status: string;
    };
  };
  cachedTasks: {
    key: string;
    value: any;
    indexes: {
      by_companyId: string;
      by_status: string;
    };
  };
  cachedMessages: {
    key: string;
    value: {
      channelOrConvId: string;
      messages: any[];
      updatedAt: number;
    };
  };
}

const DB_NAME = 'workgrind_offline_v1';
const DB_VERSION = 1;

let dbPromise: Promise<IDBPDatabase<WorkGrindOfflineDB>> | null = null;

export function getDB(): Promise<IDBPDatabase<WorkGrindOfflineDB>> {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('IndexedDB is only available in browser'));
  }

  if (!dbPromise) {
    dbPromise = openDB<WorkGrindOfflineDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        // 1. Pending actions queue store
        if (!db.objectStoreNames.contains('pendingActions')) {
          const actionStore = db.createObjectStore('pendingActions', { keyPath: 'id' });
          actionStore.createIndex('by_createdAt', 'createdAt');
          actionStore.createIndex('by_status', 'status');
        }

        // 2. Cached tasks store
        if (!db.objectStoreNames.contains('cachedTasks')) {
          const taskStore = db.createObjectStore('cachedTasks', { keyPath: '_id' });
          taskStore.createIndex('by_companyId', 'companyId');
          taskStore.createIndex('by_status', 'status');
        }

        // 3. Cached messages store
        if (!db.objectStoreNames.contains('cachedMessages')) {
          db.createObjectStore('cachedMessages', { keyPath: 'channelOrConvId' });
        }
      },
    });
  }

  return dbPromise;
}

/**
 * Add an action to the offline pending queue
 */
export async function queueOfflineAction(
  action: Omit<PendingAction, 'id' | 'createdAt' | 'status' | 'retryCount'>
): Promise<PendingAction> {
  const db = await getDB();
  const id = `action_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const fullAction: PendingAction = {
    ...action,
    id,
    createdAt: Date.now(),
    status: 'pending',
    retryCount: 0,
    errorMessage: null,
  };

  await db.put('pendingActions', fullAction);

  // Update sync store count
  const count = await getPendingCount();
  useSyncStore.getState().setPendingCount(count);

  return fullAction;
}

/**
 * Get all pending actions sorted by oldest first
 */
export async function getPendingActions(): Promise<PendingAction[]> {
  const db = await getDB();
  return db.getAllFromIndex('pendingActions', 'by_createdAt');
}

/**
 * Get count of pending actions
 */
export async function getPendingCount(): Promise<number> {
  try {
    const db = await getDB();
    return db.count('pendingActions');
  } catch {
    return 0;
  }
}

/**
 * Remove an action after successful sync
 */
export async function removePendingAction(id: string): Promise<void> {
  const db = await getDB();
  await db.delete('pendingActions', id);

  const count = await getPendingCount();
  useSyncStore.getState().setPendingCount(count);
}

/**
 * Cache tasks in IndexedDB for offline viewing
 */
export async function saveTasksToCache(tasks: any[]): Promise<void> {
  if (!Array.isArray(tasks)) return;
  try {
    const db = await getDB();
    const tx = db.transaction('cachedTasks', 'readwrite');
    for (const task of tasks) {
      if (task && task._id) {
        await tx.store.put(task);
      }
    }
    await tx.done;
  } catch (err) {
    console.warn('Failed to save tasks to offline cache:', err);
  }
}

/**
 * Read cached tasks from IndexedDB
 */
export async function getCachedTasks(): Promise<any[]> {
  try {
    const db = await getDB();
    return await db.getAll('cachedTasks');
  } catch (err) {
    console.warn('Failed to read cached tasks:', err);
    return [];
  }
}

/**
 * Cache messages for a specific channel or DM conversation
 */
export async function saveMessagesToCache(channelOrConvId: string, messages: any[]): Promise<void> {
  if (!channelOrConvId || !Array.isArray(messages)) return;
  try {
    const db = await getDB();
    await db.put('cachedMessages', {
      channelOrConvId,
      messages: messages.slice(-50), // keep latest 50 messages
      updatedAt: Date.now(),
    });
  } catch (err) {
    console.warn('Failed to save messages to cache:', err);
  }
}

/**
 * Read cached messages for a channel
 */
export async function getCachedMessages(channelOrConvId: string): Promise<any[]> {
  try {
    const db = await getDB();
    const record = await db.get('cachedMessages', channelOrConvId);
    return record ? record.messages : [];
  } catch (err) {
    console.warn('Failed to read cached messages:', err);
    return [];
  }
}

/**
 * Process and synchronize all pending actions to backend in FIFO order
 */
let isSyncInProgress = false;

export async function syncPendingActionsToServer(): Promise<{ synced: number; failed: number }> {
  if (isSyncInProgress) return { synced: 0, failed: 0 };
  if (typeof window !== 'undefined' && !navigator.onLine) {
    return { synced: 0, failed: 0 };
  }

  isSyncInProgress = true;
  useSyncStore.getState().setIsSyncing(true);

  let synced = 0;
  let failed = 0;

  try {
    const pending = await getPendingActions();
    if (pending.length === 0) {
      useSyncStore.getState().setIsSyncing(false);
      isSyncInProgress = false;
      return { synced: 0, failed: 0 };
    }

    console.log(`⚡ Starting sync of ${pending.length} pending offline actions...`);

    for (const action of pending) {
      try {
        let endpoint = action.endpoint;
        let payload = action.payload;

        // Perform network request
        const res = await api.request({
          url: endpoint,
          method: action.method,
          data: payload,
        });

        if (res.data?.success || res.status === 200 || res.status === 201) {
          // If a new task was created, update cache with server response
          if (action.actionType === 'CREATE_TASK' && res.data?.task) {
            const serverTask = res.data.task;
            const db = await getDB();
            if (action.tempId) {
              await db.delete('cachedTasks', action.tempId);
            }
            await db.put('cachedTasks', serverTask);
          }

          await removePendingAction(action.id);
          synced++;
        } else {
          failed++;
        }
      } catch (err: any) {
        console.error(`Failed to sync action ${action.id}:`, err);
        failed++;
        // If 404/400 validation error, we remove to avoid poison pill in queue
        if (err.response && (err.response.status === 400 || err.response.status === 404)) {
          await removePendingAction(action.id);
        }
      }
    }

    useSyncStore.getState().setLastSyncedAt(new Date());

    // Dispatch global event for UI refreshes
    if (typeof window !== 'undefined' && synced > 0) {
      window.dispatchEvent(
        new CustomEvent('workgrind:sync-complete', {
          detail: { synced, failed },
        })
      );
    }
  } catch (err) {
    console.error('Offline synchronization failed:', err);
  } finally {
    isSyncInProgress = false;
    useSyncStore.getState().setIsSyncing(false);
    const count = await getPendingCount();
    useSyncStore.getState().setPendingCount(count);
  }

  return { synced, failed };
}
