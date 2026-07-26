/**
 * Firebase Auth over the plain REST Identity Toolkit (ADR PRD §7.6 whitelist:
 * identitytoolkit/securetoken.googleapis.com). No native Firebase SDK in the
 * app — the existing Google sign-in (nativ ID token / web access token) is
 * exchanged for a Firebase identity. Fetch is injectable for tests.
 */

const IDT_BASE = 'https://identitytoolkit.googleapis.com/v1';
const SECURE_TOKEN_BASE = 'https://securetoken.googleapis.com/v1';

export interface FirebaseIdentity {
  /** Firebase Auth ID token (JWT) — bearer for Firestore/Functions calls. */
  idToken: string;
  refreshToken: string;
  uid: string;
  expiresAt: number;
}

export interface GoogleCredential {
  idToken?: string | null;
  accessToken?: string | null;
}

type FetchFn = typeof fetch;

/**
 * Exchanges the Google credential for a Firebase identity via
 * accounts:signInWithIdp (google.com provider accepts either an ID token or
 * an OAuth access token).
 */
export async function signInWithGoogle(
  apiKey: string,
  credential: GoogleCredential,
  fetchFn: FetchFn = fetch,
): Promise<FirebaseIdentity> {
  const postBody = credential.idToken
    ? `id_token=${encodeURIComponent(credential.idToken)}&providerId=google.com`
    : credential.accessToken
      ? `access_token=${encodeURIComponent(credential.accessToken)}&providerId=google.com`
      : null;
  if (!postBody) {
    throw new Error('signInWithGoogle: neither idToken nor accessToken given');
  }
  const response = await fetchFn(`${IDT_BASE}/accounts:signInWithIdp?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ postBody, requestUri: 'https://localhost', returnSecureToken: true }),
  });
  if (!response.ok) {
    throw new Error(`Firebase sign-in failed (${response.status}): ${await response.text()}`);
  }
  const data = (await response.json()) as {
    idToken: string;
    refreshToken: string;
    localId: string;
    expiresIn: string;
  };
  return {
    idToken: data.idToken,
    refreshToken: data.refreshToken,
    uid: data.localId,
    expiresAt: Date.now() + Number(data.expiresIn) * 1000,
  };
}

/** Refreshes a Firebase ID token (they live ~1 h). */
export async function refreshFirebaseIdentity(
  apiKey: string,
  refreshToken: string,
  fetchFn: FetchFn = fetch,
): Promise<FirebaseIdentity> {
  const response = await fetchFn(`${SECURE_TOKEN_BASE}/token?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=refresh_token&refresh_token=${encodeURIComponent(refreshToken)}`,
  });
  if (!response.ok) {
    throw new Error(`Firebase token refresh failed (${response.status})`);
  }
  const data = (await response.json()) as {
    id_token: string;
    refresh_token: string;
    user_id: string;
    expires_in: string;
  };
  return {
    idToken: data.id_token,
    refreshToken: data.refresh_token,
    uid: data.user_id,
    expiresAt: Date.now() + Number(data.expires_in) * 1000,
  };
}

/**
 * Signs in with a Firebase custom token (phase 12, TV pairing): the
 * redeemTvPairingCode function mints it for the phone's uid; the TV exchanges
 * it here for a regular identity (incl. refresh token — afterwards the
 * session behaves exactly like a Google sign-in).
 */
export async function signInWithCustomToken(
  apiKey: string,
  customToken: string,
  fetchFn: FetchFn = fetch,
): Promise<FirebaseIdentity> {
  const response = await fetchFn(`${IDT_BASE}/accounts:signInWithCustomToken?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token: customToken, returnSecureToken: true }),
  });
  if (!response.ok) {
    throw new Error(
      `Firebase custom-token sign-in failed (${response.status}): ${await response.text()}`,
    );
  }
  const data = (await response.json()) as {
    idToken: string;
    refreshToken: string;
    expiresIn: string;
  };
  const claims = JSON.parse(atob(data.idToken.split('.')[1])) as { user_id: string };
  return {
    idToken: data.idToken,
    refreshToken: data.refreshToken,
    uid: claims.user_id,
    expiresAt: Date.now() + Number(data.expiresIn) * 1000,
  };
}
