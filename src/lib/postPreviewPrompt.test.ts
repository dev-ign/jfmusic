import { beforeEach, describe, expect, it } from "vitest";

import {
  canShowPostPreviewPrompt,
  markPostPreviewPromptShown,
  recordPostPreviewDismissal,
  recordPreviewCompletion,
  resetPostPreviewPromptMemoryForTests,
  type PromptStorage,
} from "./postPreviewPrompt";

const LOCAL_KEY = "caramelo:post-preview-prompt:v1";
const SESSION_KEY = "caramelo:post-preview-prompt-shown:v1";
const DAY_MS = 24 * 60 * 60 * 1000;
const NOW = Date.UTC(2026, 5, 23, 12);

class MemoryStorage implements Storage {
  private readonly values = new Map<string, string>();

  get length(): number {
    return this.values.size;
  }

  clear(): void {
    this.values.clear();
  }

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  key(index: number): string | null {
    return [...this.values.keys()][index] ?? null;
  }

  removeItem(key: string): void {
    this.values.delete(key);
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }
}

class ThrowingStorage implements Storage {
  get length(): number {
    throw new Error("Storage is blocked");
  }

  clear(): void {
    throw new Error("Storage is blocked");
  }

  getItem(): string | null {
    throw new Error("Storage is blocked");
  }

  key(): string | null {
    throw new Error("Storage is blocked");
  }

  removeItem(): void {
    throw new Error("Storage is blocked");
  }

  setItem(): void {
    throw new Error("Storage is blocked");
  }
}

class ReadableStorageWithThrowingWrites extends MemoryStorage {
  override setItem(): void {
    throw new Error("Storage writes are blocked");
  }
}

class UnreadableStorageWithRecordedWrites extends MemoryStorage {
  readonly writes: Array<{ key: string; value: string }> = [];

  override getItem(): string | null {
    throw new Error("Storage reads are blocked");
  }

  override setItem(key: string, value: string): void {
    this.writes.push({ key, value });
    super.setItem(key, value);
  }
}

function createStorage(): PromptStorage {
  return {
    local: new MemoryStorage(),
    session: new MemoryStorage(),
  };
}

beforeEach(() => {
  resetPostPreviewPromptMemoryForTests();
});

describe("post-preview prompt policy", () => {
  it("allows the first prompt only after preview completion", () => {
    const storage = createStorage();

    expect(canShowPostPreviewPrompt(storage, NOW)).toBe(false);

    recordPreviewCompletion(storage, NOW);

    expect(canShowPostPreviewPrompt(storage, NOW)).toBe(true);
    expect(JSON.parse(storage.local.getItem(LOCAL_KEY) ?? "")).toEqual({
      version: 1,
      completedAt: NOW,
    });
  });

  it("suppresses repeat display for the current session", () => {
    const storage = createStorage();
    recordPreviewCompletion(storage, NOW);

    markPostPreviewPromptShown(storage, NOW);

    expect(storage.session.getItem(SESSION_KEY)).not.toBeNull();
    expect(canShowPostPreviewPrompt(storage, NOW + DAY_MS + 1)).toBe(false);

    storage.session.clear();

    expect(canShowPostPreviewPrompt(storage, NOW + DAY_MS + 1)).toBe(true);
  });

  it("becomes eligible at the exact 24-hour cooldown boundary", () => {
    const storage = createStorage();
    recordPreviewCompletion(storage, NOW);
    markPostPreviewPromptShown(storage, NOW);
    storage.session.clear();

    expect(canShowPostPreviewPrompt(storage, NOW + DAY_MS - 1)).toBe(false);
    expect(canShowPostPreviewPrompt(storage, NOW + DAY_MS)).toBe(true);
  });

  it("uses a dismissal as a cooldown anchor", () => {
    const storage = createStorage();
    recordPreviewCompletion(storage, NOW);
    recordPostPreviewDismissal(storage, NOW + 1_000);

    expect(
      canShowPostPreviewPrompt(storage, NOW + 1_000 + DAY_MS - 1),
    ).toBe(false);
    expect(
      canShowPostPreviewPrompt(storage, NOW + 1_000 + DAY_MS),
    ).toBe(true);
  });

  it("uses the newest shown or dismissed timestamp as the cooldown anchor", () => {
    const storage = createStorage();
    storage.local.setItem(
      LOCAL_KEY,
      JSON.stringify({
        version: 1,
        completedAt: NOW,
        shownAt: NOW + 2_000,
        dismissedAt: NOW + 1_000,
      }),
    );

    expect(
      canShowPostPreviewPrompt(storage, NOW + 2_000 + DAY_MS - 1),
    ).toBe(false);
    expect(
      canShowPostPreviewPrompt(storage, NOW + 2_000 + DAY_MS),
    ).toBe(true);
  });

  it("uses dismissal when it is newer than the shown timestamp", () => {
    const storage = createStorage();
    storage.local.setItem(
      LOCAL_KEY,
      JSON.stringify({
        version: 1,
        completedAt: NOW,
        shownAt: NOW + 1_000,
        dismissedAt: NOW + 2_000,
      }),
    );

    expect(
      canShowPostPreviewPrompt(storage, NOW + 2_000 + DAY_MS - 1),
    ).toBe(false);
    expect(
      canShowPostPreviewPrompt(storage, NOW + 2_000 + DAY_MS),
    ).toBe(true);
  });

  it.each([
    ["malformed JSON", "not-json"],
    ["a non-object value", "null"],
    [
      "an outdated record version",
      JSON.stringify({ version: 2, completedAt: NOW }),
    ],
    [
      "an invalid timestamp",
      JSON.stringify({ version: 1, completedAt: "now" }),
    ],
  ])("ignores %s", (_label, storedValue) => {
    const storage = createStorage();
    storage.local.setItem(LOCAL_KEY, storedValue);

    expect(canShowPostPreviewPrompt(storage, NOW)).toBe(false);
  });

  it("keeps completion and shown suppression in memory when storage throws", () => {
    const blockedStorage: PromptStorage = {
      local: new ThrowingStorage(),
      session: new ThrowingStorage(),
    };

    expect(() => recordPreviewCompletion(blockedStorage, NOW)).not.toThrow();
    expect(canShowPostPreviewPrompt(blockedStorage, NOW)).toBe(true);

    expect(() => markPostPreviewPromptShown(blockedStorage, NOW)).not.toThrow();
    expect(canShowPostPreviewPrompt(blockedStorage, NOW + DAY_MS + 1)).toBe(
      false,
    );
  });

  it("keeps fallback state when reads succeed but writes throw", () => {
    const storage: PromptStorage = {
      local: new ReadableStorageWithThrowingWrites(),
      session: new ReadableStorageWithThrowingWrites(),
    };

    recordPreviewCompletion(storage, NOW);

    expect(canShowPostPreviewPrompt(storage, NOW)).toBe(true);

    markPostPreviewPromptShown(storage, NOW);

    expect(canShowPostPreviewPrompt(storage, NOW + DAY_MS + 1)).toBe(false);
  });

  it("skips completion persistence when the existing record cannot be read", () => {
    const blockedStorage: PromptStorage = {
      local: new ThrowingStorage(),
      session: new ThrowingStorage(),
    };
    const unreadableLocal = new UnreadableStorageWithRecordedWrites();
    const partialStorage: PromptStorage = {
      local: unreadableLocal,
      session: new MemoryStorage(),
    };
    recordPostPreviewDismissal(blockedStorage, NOW);

    recordPreviewCompletion(partialStorage, NOW + 1_000);

    expect(unreadableLocal.writes).toEqual([]);
    expect(
      canShowPostPreviewPrompt(partialStorage, NOW + DAY_MS - 1),
    ).toBe(false);
  });

  it("skips shown persistence when the existing record cannot be read", () => {
    const blockedStorage: PromptStorage = {
      local: new ThrowingStorage(),
      session: new ThrowingStorage(),
    };
    const unreadableLocal = new UnreadableStorageWithRecordedWrites();
    const session = new MemoryStorage();
    const partialStorage: PromptStorage = {
      local: unreadableLocal,
      session,
    };
    recordPreviewCompletion(blockedStorage, NOW);

    markPostPreviewPromptShown(partialStorage, NOW + 1_000);
    session.clear();

    expect(unreadableLocal.writes).toEqual([]);
    expect(
      canShowPostPreviewPrompt(partialStorage, NOW + 1_000 + DAY_MS - 1),
    ).toBe(false);
  });

  it("skips dismissal persistence when the existing record cannot be read", () => {
    const blockedStorage: PromptStorage = {
      local: new ThrowingStorage(),
      session: new ThrowingStorage(),
    };
    const unreadableLocal = new UnreadableStorageWithRecordedWrites();
    const partialStorage: PromptStorage = {
      local: unreadableLocal,
      session: new MemoryStorage(),
    };
    recordPreviewCompletion(blockedStorage, NOW);

    recordPostPreviewDismissal(partialStorage, NOW + 1_000);

    expect(unreadableLocal.writes).toEqual([]);
    expect(
      canShowPostPreviewPrompt(partialStorage, NOW + 1_000 + DAY_MS - 1),
    ).toBe(false);
  });

  it("keeps dismissal cooldown in memory when storage throws", () => {
    const blockedStorage: PromptStorage = {
      local: new ThrowingStorage(),
      session: new ThrowingStorage(),
    };
    recordPreviewCompletion(blockedStorage, NOW);

    expect(() =>
      recordPostPreviewDismissal(blockedStorage, NOW),
    ).not.toThrow();
    expect(canShowPostPreviewPrompt(blockedStorage, NOW + DAY_MS - 1)).toBe(
      false,
    );
    expect(canShowPostPreviewPrompt(blockedStorage, NOW + DAY_MS)).toBe(true);
  });
});
