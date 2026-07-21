import { GoogleGenAI } from '@google/genai';
import { initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { onRequest } from 'firebase-functions/v2/https';

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
// Pinned after the golden-set benchmark (ROADMAP phase 10.5 exit criteria).
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
