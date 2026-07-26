import { GoogleGenAI } from '@google/genai';
import { initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { onRequest } from 'firebase-functions/v2/https';
import { randomInt } from 'node:crypto';

/**
 * Cloud analyse endpoint (ADR PRD §7.6): Gemini proxy for the Pro-Tier
 * CloudEngine. EU region (europe-west3), Firebase-Auth-gated — the app calls
 * this with the user's Firebase ID token (REST sign-in, no native Firebase
 * SDK in the app). The model key never leaves the project.
 *
 * Entitlement note: the Pro check is client-side via RevenueCat (M9.5);
 * server-side entitlement verification (RevenueCat webhook → custom claims)
 * is an open ADR detail and intentionally not faked here.
 */

const REGION = 'europe-west3';
// Pinned by the golden-set benchmark (2026-07-23, phase 10.5 exit criteria):
// 10/10 schema-valid via scripts/benchmark-cloud.ts. flash-lite/2.0-flash/
// 2.5-pro are NOT available in europe-west3 (Vertex 404) — 2.5-flash is the
// only candidate that serves the EU region.
const DEFAULT_MODEL = 'gemini-2.5-flash';

initializeApp();

interface AnalyzeBody {
  system: string;
  prompt: string;
  /** JSON schema for structured output (mirrors the app's zod schemas). */
  schema: Record<string, unknown>;
  model?: string;
}

export const analyze = onRequest(
  { region: REGION, cors: false, maxInstances: 10 },
  async (request, response) => {
    if (request.method !== 'POST') {
      response.status(405).json({ error: 'method not allowed' });
      return;
    }
    const authorization = request.headers.authorization ?? '';
    const idToken = authorization.startsWith('Bearer ') ? authorization.slice(7) : '';
    if (!idToken) {
      response.status(401).json({ error: 'missing bearer token' });
      return;
    }
    try {
      await getAuth().verifyIdToken(idToken);
    } catch {
      response.status(401).json({ error: 'invalid token' });
      return;
    }

    const body = request.body as Partial<AnalyzeBody>;
    if (
      typeof body.system !== 'string' ||
      typeof body.prompt !== 'string' ||
      typeof body.schema !== 'object' ||
      body.schema === null
    ) {
      response.status(400).json({ error: 'body must be { system, prompt, schema }' });
      return;
    }

    const started = Date.now();
    try {
      // ADC via the function's service account; project/location must be
      // explicit for @google/genai (GCLOUD_PROJECT is set by Cloud Run).
      const ai = new GoogleGenAI({
        vertexai: true,
        project: process.env.GCLOUD_PROJECT,
        location: REGION,
      });
      const result = await ai.models.generateContent({
        model: body.model ?? DEFAULT_MODEL,
        contents: body.prompt,
        config: {
          systemInstruction: body.system,
          responseMimeType: 'application/json',
          responseSchema: body.schema,
        },
      });
      const text = result.text ?? '';
      response.status(200).json({
        text,
        stats: {
          model: body.model ?? DEFAULT_MODEL,
          durationMs: Date.now() - started,
          totalTokens: result.usageMetadata?.totalTokenCount ?? null,
        },
      });
    } catch (cause) {
      response.status(502).json({
        error: `gemini call failed: ${cause instanceof Error ? cause.message : String(cause)}`,
      });
    }
  },
);

/**
 * TV pairing v2 (phase 12, QR flow): the TV shows a QR code containing its
 * pairing session id; the phone scans it, seals the master key with the TV's
 * ephemeral public key (ECIES — the function only relays ciphertext, the
 * master key never touches the server in the clear) and completes the
 * session; the TV polls and receives sealed key + Firebase custom token.
 * Sessions live 10 minutes, are single-use and carry an unguessable id.
 */

const PAIRING_TTL_MS = 10 * 60 * 1000;

function generateSessionId(): string {
  const alphabet = 'abcdef0123456789';
  let id = '';
  for (let i = 0; i < 32; i++) id += alphabet[randomInt(alphabet.length)];
  return id;
}

async function verifyRequestUid(authorization: string): Promise<string | null> {
  const idToken = authorization.startsWith('Bearer ') ? authorization.slice(7) : '';
  if (!idToken) return null;
  try {
    const decoded = await getAuth().verifyIdToken(idToken);
    return decoded.uid;
  } catch {
    return null;
  }
}

/** Ungated (TV): opens a pairing session for the TV's ephemeral public key. */
export const createTvPairingSession = onRequest(
  { region: REGION, cors: false, maxInstances: 10 },
  async (request, response) => {
    if (request.method !== 'POST') {
      response.status(405).json({ error: 'method not allowed' });
      return;
    }
    const publicKey = typeof request.body?.publicKey === 'string' ? request.body.publicKey : '';
    if (!publicKey) {
      response.status(400).json({ error: 'body must be { publicKey }' });
      return;
    }
    const sessionId = generateSessionId();
    await getFirestore()
      .doc(`tvPairingSessions/${sessionId}`)
      .set({
        publicKey,
        createdAt: Date.now(),
        expiresAt: Date.now() + PAIRING_TTL_MS,
        status: 'pending',
      });
    response.status(200).json({ sessionId, expiresAt: Date.now() + PAIRING_TTL_MS });
  },
);

/** Auth-gated (phone): seals the master key + mints the Firebase custom token. */
export const completeTvPairing = onRequest(
  { region: REGION, cors: false, maxInstances: 10 },
  async (request, response) => {
    if (request.method !== 'POST') {
      response.status(405).json({ error: 'method not allowed' });
      return;
    }
    const uid = await verifyRequestUid(request.headers.authorization ?? '');
    if (!uid) {
      response.status(401).json({ error: 'invalid token' });
      return;
    }
    const { sessionId, nonce, phonePublicKey, sealedBox } = (request.body ?? {}) as Record<
      string,
      unknown
    >;
    if (
      typeof sessionId !== 'string' ||
      typeof nonce !== 'string' ||
      typeof phonePublicKey !== 'string' ||
      typeof sealedBox !== 'string'
    ) {
      response
        .status(400)
        .json({ error: 'body must be { sessionId, nonce, phonePublicKey, sealedBox }' });
      return;
    }
    const ref = getFirestore().doc(`tvPairingSessions/${sessionId}`);
    const snap = await ref.get();
    const data = snap.data();
    if (!snap.exists || !data || data.status !== 'pending' || data.expiresAt < Date.now()) {
      response.status(404).json({ error: 'session invalid or expired' });
      return;
    }
    const customToken = await getAuth().createCustomToken(uid, { via: 'tv-pairing-qr' });
    await ref.update({
      status: 'ready',
      uid,
      nonce,
      phonePublicKey,
      sealedBox,
      customToken,
    });
    response.status(200).json({ ok: true });
  },
);

/** Ungated (TV): polls the session; single-use read once the phone completed. */
export const pollTvPairing = onRequest(
  { region: REGION, cors: false, maxInstances: 10 },
  async (request, response) => {
    if (request.method !== 'POST') {
      response.status(405).json({ error: 'method not allowed' });
      return;
    }
    const sessionId = typeof request.body?.sessionId === 'string' ? request.body.sessionId : '';
    if (!sessionId) {
      response.status(400).json({ error: 'body must be { sessionId }' });
      return;
    }
    const ref = getFirestore().doc(`tvPairingSessions/${sessionId}`);
    const snap = await ref.get();
    const data = snap.data();
    if (!snap.exists || !data || data.expiresAt < Date.now()) {
      response.status(404).json({ error: 'session invalid or expired' });
      return;
    }
    if (data.status === 'pending') {
      response.status(202).json({ status: 'pending' });
      return;
    }
    if (data.status !== 'ready') {
      response.status(410).json({ error: 'session already consumed' });
      return;
    }
    await ref.update({ status: 'consumed' });
    response.status(200).json({
      status: 'ready',
      nonce: data.nonce,
      phonePublicKey: data.phonePublicKey,
      sealedBox: data.sealedBox,
      customToken: data.customToken,
    });
  },
);
