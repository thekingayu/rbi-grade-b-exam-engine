/**
 * Firestore Utilities
 * Deeply sanitizes objects to prevent unsupported field value: undefined errors,
 * cleans NaN/Infinity values, and guarantees safe serialization for Firestore writes.
 */

export function sanitizeForFirestore<T>(input: T): T {
  if (input === undefined) {
    return null as any;
  }
  if (input === null) {
    return null as any;
  }
  if (typeof input === 'number') {
    if (isNaN(input) || !isFinite(input)) {
      return 0 as any;
    }
    return input;
  }
  if (typeof input === 'string' || typeof input === 'boolean') {
    return input;
  }
  if (Array.isArray(input)) {
    return input
      .map(item => sanitizeForFirestore(item))
      .filter(item => item !== undefined) as any;
  }
  if (typeof input === 'object') {
    const cleaned: Record<string, any> = {};
    for (const [key, value] of Object.entries(input as Record<string, any>)) {
      if (value !== undefined) {
        cleaned[key] = sanitizeForFirestore(value);
      }
    }
    return cleaned as T;
  }
  return input;
}

export function isProfileSyncDocument(id: string, data: any): boolean {
  if (!id && !data) return false;
  if (id.startsWith('profile_sync_') || id.startsWith('note_profile_')) return true;
  if (
    data?.isProfileSync === true ||
    data?.type === 'profile_sync' ||
    data?.fileType === 'profile'
  ) {
    return true;
  }
  return false;
}

export function isFlashcardRecordDocument(id: string, data: any): boolean {
  if (!id && !data) return false;
  if (id.startsWith('fc_deck_') || id.startsWith('fc_sess_')) return true;
  if (
    data?.recordKind === 'flashcard_deck' ||
    data?.recordKind === 'flashcard_session' ||
    data?.isFlashcardRecord === true
  ) {
    return true;
  }
  return false;
}

export function isSyncDocument(id: string, data: any): boolean {
  if (!id && !data) return true;
  return isProfileSyncDocument(id, data) || isFlashcardRecordDocument(id, data);
}

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function buildFirestoreErrorInfo(
  error: unknown,
  operationType: OperationType,
  path: string | null,
  currentUser: {
    uid?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerData?: Array<{ providerId?: string | null; email?: string | null }>;
  } | null
): FirestoreErrorInfo {
  return {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: currentUser?.uid,
      email: currentUser?.email,
      emailVerified: currentUser?.emailVerified,
      isAnonymous: currentUser?.isAnonymous,
      tenantId: currentUser?.tenantId,
      providerInfo:
        currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null,
  currentUser: Parameters<typeof buildFirestoreErrorInfo>[3]
): never {
  const errInfo = buildFirestoreErrorInfo(error, operationType, path, currentUser);
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

