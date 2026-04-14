import type { VendorBillRow } from '@/lib/api';

export type BillListFilterFields = {
  token: string;
  dateFrom: string;
  dateTo: string;
  subtotalMin: string;
  subtotalMax: string;
  totalMin: string;
  totalMax: string;
};

type BillsPageCache = {
  key: string;
  page: number;
  total: number;
  totalPages: number;
  limit: number;
  ids: string[];
  syncedAt: string;
};

type BillRowCache = VendorBillRow & {
  updated_at?: string;
};

const DB_NAME = 'laundroswipe_offline_v1';
const DB_VERSION = 1;
const STORE_PAGES = 'bill_pages';
const STORE_ROWS = 'bill_rows';
const STORE_META = 'sync_meta';

function hasIndexedDb(): boolean {
  return typeof window !== 'undefined' && typeof indexedDB !== 'undefined';
}

function reqToPromise<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('IndexedDB error'));
  });
}

function txToPromise(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onabort = () => reject(tx.error ?? new Error('IndexedDB transaction aborted'));
    tx.onerror = () => reject(tx.error ?? new Error('IndexedDB transaction failed'));
  });
}

async function openDb(): Promise<IDBDatabase | null> {
  if (!hasIndexedDb()) return null;
  const req = indexedDB.open(DB_NAME, DB_VERSION);
  req.onupgradeneeded = () => {
    const db = req.result;
    if (!db.objectStoreNames.contains(STORE_PAGES)) {
      db.createObjectStore(STORE_PAGES, { keyPath: 'key' });
    }
    if (!db.objectStoreNames.contains(STORE_ROWS)) {
      db.createObjectStore(STORE_ROWS, { keyPath: 'id' });
    }
    if (!db.objectStoreNames.contains(STORE_META)) {
      db.createObjectStore(STORE_META, { keyPath: 'key' });
    }
  };
  try {
    return await reqToPromise(req);
  } catch {
    return null;
  }
}

function pageKey(filter: BillListFilterFields, page: number, limit: number): string {
  return JSON.stringify({ filter, page, limit });
}

function metaKey(filter: BillListFilterFields): string {
  return `last_sync:${JSON.stringify(filter)}`;
}

export async function readCachedBillsPage(
  filter: BillListFilterFields,
  page: number,
  limit: number,
): Promise<{ bills: VendorBillRow[]; total: number; totalPages: number; syncedAt: string | null } | null> {
  const db = await openDb();
  if (!db) return null;
  const tx = db.transaction([STORE_PAGES, STORE_ROWS], 'readonly');
  const pageStore = tx.objectStore(STORE_PAGES);
  const rowsStore = tx.objectStore(STORE_ROWS);
  const pg = (await reqToPromise(pageStore.get(pageKey(filter, page, limit)))) as BillsPageCache | undefined;
  if (!pg || !Array.isArray(pg.ids) || pg.ids.length === 0) return null;
  const out: VendorBillRow[] = [];
  for (const id of pg.ids) {
    const row = (await reqToPromise(rowsStore.get(id))) as BillRowCache | undefined;
    if (row && !row.cancelled_at) out.push(row);
  }
  return { bills: out, total: pg.total, totalPages: pg.totalPages, syncedAt: pg.syncedAt ?? null };
}

export async function writeCachedBillsPage(input: {
  filter: BillListFilterFields;
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  bills: VendorBillRow[];
  syncedAt: string;
}): Promise<void> {
  const db = await openDb();
  if (!db) return;
  const tx = db.transaction([STORE_PAGES, STORE_ROWS, STORE_META], 'readwrite');
  const rowsStore = tx.objectStore(STORE_ROWS);
  const pageStore = tx.objectStore(STORE_PAGES);
  const metaStore = tx.objectStore(STORE_META);
  for (const b of input.bills) {
    rowsStore.put(b as BillRowCache);
  }
  pageStore.put({
    key: pageKey(input.filter, input.page, input.limit),
    page: input.page,
    total: input.total,
    totalPages: input.totalPages,
    limit: input.limit,
    ids: input.bills.map((b) => b.id),
    syncedAt: input.syncedAt,
  } satisfies BillsPageCache);
  metaStore.put({ key: metaKey(input.filter), value: input.syncedAt });
  await txToPromise(tx);
}

export async function getLastSyncForFilter(filter: BillListFilterFields): Promise<string | null> {
  const db = await openDb();
  if (!db) return null;
  const tx = db.transaction([STORE_META], 'readonly');
  const meta = (await reqToPromise(tx.objectStore(STORE_META).get(metaKey(filter)))) as { value?: string } | undefined;
  return typeof meta?.value === 'string' ? meta.value : null;
}

export async function patchCachedBillRow(row: VendorBillRow): Promise<void> {
  const db = await openDb();
  if (!db) return;
  const tx = db.transaction([STORE_ROWS], 'readwrite');
  tx.objectStore(STORE_ROWS).put(row as BillRowCache);
  await txToPromise(tx);
}

export async function removeCachedBillRow(billId: string): Promise<void> {
  const db = await openDb();
  if (!db) return;
  const tx = db.transaction([STORE_ROWS], 'readwrite');
  tx.objectStore(STORE_ROWS).delete(billId);
  await txToPromise(tx);
}

export async function clearBillsSyncMeta(): Promise<void> {
  const db = await openDb();
  if (!db) return;
  const tx = db.transaction([STORE_META], 'readwrite');
  tx.objectStore(STORE_META).clear();
  await txToPromise(tx);
}

