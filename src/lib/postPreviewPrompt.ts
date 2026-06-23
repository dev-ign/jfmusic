const LOCAL_KEY = "caramelo:post-preview-prompt:v1";
const SESSION_KEY = "caramelo:post-preview-prompt-shown:v1";
const COOLDOWN_MS = 24 * 60 * 60 * 1000;

interface PromptRecord {
  version: 1;
  completedAt?: number;
  shownAt?: number;
  dismissedAt?: number;
}

export interface PromptStorage {
  local: Storage;
  session: Storage;
}

let memoryRecord: PromptRecord = { version: 1 };
let memoryShown = false;
let unsyncedLocalStorage: Storage | undefined;
let unreadableLocalStorage: Storage | undefined;
let unsyncedSessionStorage: Storage | undefined;

interface RecordReadResult {
  record: PromptRecord;
  canPersist: boolean;
}

function isOptionalTimestamp(value: unknown): value is number | undefined {
  return (
    value === undefined ||
    (typeof value === "number" && Number.isFinite(value))
  );
}

function parseRecord(value: string | null): PromptRecord | undefined {
  if (value === null) {
    return undefined;
  }

  try {
    const parsed: unknown = JSON.parse(value);

    if (typeof parsed !== "object" || parsed === null) {
      return undefined;
    }

    const candidate = parsed as Record<string, unknown>;
    const completedAt = candidate.completedAt;
    const shownAt = candidate.shownAt;
    const dismissedAt = candidate.dismissedAt;

    if (
      candidate.version !== 1 ||
      !isOptionalTimestamp(completedAt) ||
      !isOptionalTimestamp(shownAt) ||
      !isOptionalTimestamp(dismissedAt)
    ) {
      return undefined;
    }

    return {
      version: 1,
      ...(completedAt === undefined ? {} : { completedAt }),
      ...(shownAt === undefined ? {} : { shownAt }),
      ...(dismissedAt === undefined ? {} : { dismissedAt }),
    };
  } catch {
    return undefined;
  }
}

function resolveStorage(storage?: PromptStorage): PromptStorage | undefined {
  if (storage) {
    return storage;
  }

  if (typeof window === "undefined") {
    return undefined;
  }

  try {
    return {
      local: window.localStorage,
      session: window.sessionStorage,
    };
  } catch {
    return undefined;
  }
}

function readRecord(storage: PromptStorage | undefined): RecordReadResult {
  if (!storage) {
    return { record: memoryRecord, canPersist: false };
  }

  if (storage.local === unreadableLocalStorage) {
    return { record: memoryRecord, canPersist: false };
  }

  if (storage.local === unsyncedLocalStorage) {
    return { record: memoryRecord, canPersist: true };
  }

  try {
    const record = parseRecord(storage.local.getItem(LOCAL_KEY)) ?? {
      version: 1 as const,
    };
    memoryRecord = record;
    return { record, canPersist: true };
  } catch {
    unreadableLocalStorage = storage.local;
    return { record: memoryRecord, canPersist: false };
  }
}

function writeRecord(
  storage: PromptStorage | undefined,
  record: PromptRecord,
  canPersist: boolean,
): void {
  memoryRecord = record;

  if (!storage || !canPersist) {
    return;
  }

  try {
    storage.local.setItem(LOCAL_KEY, JSON.stringify(record));
    unsyncedLocalStorage = undefined;
  } catch {
    unsyncedLocalStorage = storage.local;
  }
}

function wasShownThisSession(storage: PromptStorage | undefined): boolean {
  if (!storage) {
    return memoryShown;
  }

  if (storage.session === unsyncedSessionStorage) {
    return memoryShown;
  }

  try {
    memoryShown = storage.session.getItem(SESSION_KEY) !== null;
    return memoryShown;
  } catch {
    return memoryShown;
  }
}

function suppressForSession(storage: PromptStorage | undefined): void {
  memoryShown = true;

  if (!storage) {
    return;
  }

  try {
    storage.session.setItem(SESSION_KEY, "1");
    unsyncedSessionStorage = undefined;
  } catch {
    unsyncedSessionStorage = storage.session;
  }
}

export function recordPreviewCompletion(
  storage?: PromptStorage,
  now = Date.now(),
): void {
  const resolvedStorage = resolveStorage(storage);
  const { record, canPersist } = readRecord(resolvedStorage);

  writeRecord(
    resolvedStorage,
    {
      ...record,
      completedAt: now,
    },
    canPersist,
  );
}

export function canShowPostPreviewPrompt(
  storage?: PromptStorage,
  now = Date.now(),
): boolean {
  const resolvedStorage = resolveStorage(storage);
  const { record } = readRecord(resolvedStorage);

  if (record.completedAt === undefined || wasShownThisSession(resolvedStorage)) {
    return false;
  }

  const cooldownAnchor = Math.max(
    record.shownAt ?? Number.NEGATIVE_INFINITY,
    record.dismissedAt ?? Number.NEGATIVE_INFINITY,
  );

  return now - cooldownAnchor >= COOLDOWN_MS;
}

export function markPostPreviewPromptShown(
  storage?: PromptStorage,
  now = Date.now(),
): void {
  const resolvedStorage = resolveStorage(storage);
  const { record, canPersist } = readRecord(resolvedStorage);

  writeRecord(
    resolvedStorage,
    {
      ...record,
      shownAt: now,
    },
    canPersist,
  );
  suppressForSession(resolvedStorage);
}

export function recordPostPreviewDismissal(
  storage?: PromptStorage,
  now = Date.now(),
): void {
  const resolvedStorage = resolveStorage(storage);
  const { record, canPersist } = readRecord(resolvedStorage);

  writeRecord(
    resolvedStorage,
    {
      ...record,
      dismissedAt: now,
    },
    canPersist,
  );
}

export function resetPostPreviewPromptMemoryForTests(): void {
  memoryRecord = { version: 1 };
  memoryShown = false;
  unsyncedLocalStorage = undefined;
  unreadableLocalStorage = undefined;
  unsyncedSessionStorage = undefined;
}
