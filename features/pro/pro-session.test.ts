import { ProSession, type FirebaseEnvConfig, type SecretStorage } from './pro-session';

const config: FirebaseEnvConfig = {
  projectId: 'proj-dev',
  apiKey: 'api-key',
  appId: 'app-id',
  analyzeUrl: 'https://example.com/analyze',
};

function createMemoryStorage(): SecretStorage & { entries: Map<string, string> } {
  const entries = new Map<string, string>();
  return {
    entries,
    getItem: async (key) => entries.get(key) ?? null,
    setItem: async (key, value) => {
      entries.set(key, value);
    },
    deleteItem: async (key) => {
      entries.delete(key);
    },
  };
}

function authFetch(expiresIn = 3600): typeof fetch {
  return async (url) => {
    const u = String(url);
    if (u.includes('signInWithIdp')) {
      return new Response(
        JSON.stringify({
          idToken: 'firebase-id-token',
          refreshToken: 'refresh-1',
          localId: 'uid-42',
          expiresIn: String(expiresIn),
        }),
      );
    }
    if (u.includes('securetoken')) {
      return new Response(
        JSON.stringify({
          id_token: 'firebase-id-token-2',
          refresh_token: 'refresh-2',
          user_id: 'uid-42',
          expires_in: '3600',
        }),
      );
    }
    return new Response('not found', { status: 404 });
  };
}

describe('ProSession', () => {
  it('signs in with a Google credential and persists refresh token + uid', async () => {
    const storage = createMemoryStorage();
    const session = new ProSession(config, storage, authFetch());
    const uid = await session.signInWithGoogleCredential({ idToken: 'google-id-token' });
    expect(uid).toBe('uid-42');
    expect(storage.entries.get('firebase.refresh_token')).toBe('refresh-1');
    expect(storage.entries.get('firebase.uid')).toBe('uid-42');
    expect(await session.getIdToken()).toBe('firebase-id-token');
  });

  it('restores a persisted session via refresh', async () => {
    const storage = createMemoryStorage();
    storage.entries.set('firebase.refresh_token', 'refresh-1');
    const session = new ProSession(config, storage, authFetch());
    expect(await session.restore()).toBe('uid-42');
    expect(await session.getIdToken()).toBe('firebase-id-token-2');
    expect(storage.entries.get('firebase.refresh_token')).toBe('refresh-2');
  });

  it('returns null on restore without a stored session', async () => {
    const session = new ProSession(config, createMemoryStorage(), authFetch());
    expect(await session.restore()).toBeNull();
  });

  it('enableSync stores the master key locally and yields a working recovery code', async () => {
    const storage = createMemoryStorage();
    const session = new ProSession(config, storage, authFetch());
    let uploaded: string | null = null;
    const recoveryCode = await session.enableSync(async (wrapped) => {
      uploaded = wrapped;
    });
    expect(recoveryCode).toHaveLength(24);
    const masterKey = await session.getMasterKey();
    expect(masterKey).not.toBeNull();

    // second device joins with the code and gets the SAME master key
    const other = new ProSession(config, createMemoryStorage(), authFetch());
    await other.joinSync(recoveryCode, async () => uploaded);
    expect(Array.from((await other.getMasterKey())!)).toEqual(Array.from(masterKey!));
  });

  it('joinSync rejects a wrong recovery code', async () => {
    const session = new ProSession(config, createMemoryStorage(), authFetch());
    let uploaded: string | null = null;
    await session.enableSync(async (wrapped) => {
      uploaded = wrapped;
    });
    const other = new ProSession(config, createMemoryStorage(), authFetch());
    await expect(
      other.joinSync('AAAA-BBBB-CCCC-DDDD-EEEE-FFFF', async () => uploaded),
    ).rejects.toThrow();
  });
});
