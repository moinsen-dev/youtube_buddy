/**
 * Cloud golden-set benchmark (phase 10.5 exit criteria): runs summarize.v1
 * over the committed golden set through the deployed `analyze` Cloud Function
 * (Gemini, EU) for each candidate model, validates every response against the
 * zod schema and writes `.verification/phase105_cloud_benchmark.json` for the
 * manual quality comparison that pins DEFAULT_MODEL in functions/src/index.ts.
 *
 * Auth: exchanges the Firebase-CLI user's Google access token (token store of
 * the local firebase-tools login, developer@moinsen.dev) for a Firebase ID
 * token via Identity Toolkit — no service-account file needed.
 *
 * Run: npx tsx scripts/benchmark-cloud.ts [model ...]
 */
import { readFileSync, writeFileSync } from 'node:fs';

import { z } from 'zod';

import goldenSetData from '../core/ai-engine/golden-set.json';
import { summarizeV1, summarizeV1Schema } from '../core/ai-engine/prompts/summarize.v1';

const ANALYZE_URL = 'https://europe-west3-youtube-buddy-moinsen-dev.cloudfunctions.net/analyze';
const API_KEY = 'AIzaSyA6b-b-a7UZlK0MpYYZvrMbZ6zEka8jf0g'; // dev web apiKey (public client id)
const OUT = '.verification/phase105_cloud_benchmark.json';

const DEFAULT_MODELS = ['gemini-2.5-flash', 'gemini-2.5-flash-lite', 'gemini-2.5-pro'];

interface GoldenSetItem {
  videoId: string;
  title: string;
  language: string;
  chunks: { startSec: number; endSec: number; text: string }[];
}

interface ItemResult {
  videoId: string;
  ok: boolean;
  durationMs: number;
  totalTokens: number | null;
  error?: string;
}

interface ModelResult {
  model: string;
  validRate: number;
  avgDurationMs: number;
  avgTokens: number;
  items: ItemResult[];
  sample?: { videoId: string; tldr: string; keyPointCount: number; firstKeyPoint: string };
}

const FIREBASE_TOOLS_STORE = `${process.env.HOME}/.config/configstore/firebase-tools.json`;
// Public installed-app OAuth client of the Firebase CLI (ships in plain text
// in firebase-tools; same class of public client as the gcloud SDK one).
const CLI_CLIENT_ID = '563584335869-fgrhgmd47bqnekij5i8b5pr03ho849e6.apps.googleusercontent.com';
const CLI_CLIENT_SECRET = 'j9iVZfS8kkCEFUPaAeJV0sAi';

/**
 * Google access token for the benchmark. Prefer GOOGLE_ACCESS_TOKEN (a token
 * issued for the project's own OAuth web client — e.g. captured from the
 * app's web session); falls back to the firebase-tools token store (works
 * only if its audience is accepted by Identity Toolkit).
 */
async function getGoogleAccessToken(): Promise<string> {
  if (process.env.GOOGLE_ACCESS_TOKEN) return process.env.GOOGLE_ACCESS_TOKEN;
  const store = JSON.parse(readFileSync(FIREBASE_TOOLS_STORE, 'utf8')) as {
    tokens: { access_token?: string; refresh_token?: string; expires_at?: number };
  };
  const {
    access_token: accessToken,
    refresh_token: refreshToken,
    expires_at: expiresAt,
  } = store.tokens;
  if (accessToken && expiresAt && expiresAt > Date.now() + 60_000) return accessToken;
  if (!refreshToken) throw new Error('firebase-tools token store has no refresh_token');
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: CLI_CLIENT_ID,
      client_secret: CLI_CLIENT_SECRET,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  });
  const body = (await response.json()) as { access_token?: string; error?: string };
  if (!response.ok || !body.access_token) {
    throw new Error(`token refresh failed: ${body.error ?? response.status}`);
  }
  return body.access_token;
}

async function getFirebaseIdToken(): Promise<string> {
  const googleToken = await getGoogleAccessToken();
  const response = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithIdp?key=${API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        postBody: `access_token=${googleToken}&providerId=google.com`,
        requestUri: 'http://localhost',
        returnSecureToken: true,
      }),
    },
  );
  const body = (await response.json()) as { idToken?: string; error?: { message?: string } };
  if (!response.ok || !body.idToken) {
    throw new Error(`signInWithIdp failed: ${body.error?.message ?? response.status}`);
  }
  return body.idToken;
}

async function runItem(
  idToken: string,
  model: string,
  item: GoldenSetItem,
): Promise<ItemResult & { parsed?: z.infer<typeof summarizeV1Schema> }> {
  const started = Date.now();
  try {
    const response = await fetch(ANALYZE_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${idToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        system: summarizeV1.system,
        prompt: summarizeV1.render({
          title: item.title,
          language: 'de',
          chunks: item.chunks,
        }),
        schema: z.toJSONSchema(summarizeV1Schema),
        model,
      }),
    });
    const body = (await response.json()) as {
      text?: string;
      stats?: { durationMs?: number; totalTokens?: number | null };
      error?: string;
    };
    if (!response.ok || !body.text) {
      return {
        videoId: item.videoId,
        ok: false,
        durationMs: Date.now() - started,
        totalTokens: null,
        error: `${response.status}: ${body.error ?? 'no text'}`,
      };
    }
    const parsed = summarizeV1Schema.safeParse(JSON.parse(body.text));
    if (!parsed.success) {
      return {
        videoId: item.videoId,
        ok: false,
        durationMs: Date.now() - started,
        totalTokens: body.stats?.totalTokens ?? null,
        error: `schema: ${parsed.error.issues[0]?.message ?? 'invalid'}`,
      };
    }
    return {
      videoId: item.videoId,
      ok: true,
      durationMs: body.stats?.durationMs ?? Date.now() - started,
      totalTokens: body.stats?.totalTokens ?? null,
      parsed: parsed.data,
    };
  } catch (error) {
    return {
      videoId: item.videoId,
      ok: false,
      durationMs: Date.now() - started,
      totalTokens: null,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

async function main(): Promise<void> {
  const models = process.argv.slice(2).length > 0 ? process.argv.slice(2) : DEFAULT_MODELS;
  const items = (goldenSetData as { items: GoldenSetItem[] }).items;
  console.log(`golden set: ${items.length} items, models: ${models.join(', ')}`);

  const idToken = await getFirebaseIdToken();
  console.log('firebase id token acquired (gcloud access token exchange)');

  const results: ModelResult[] = [];
  for (const model of models) {
    const itemResults: ItemResult[] = [];
    let sample: ModelResult['sample'];
    for (const [index, item] of items.entries()) {
      const result = await runItem(idToken, model, item);
      itemResults.push({
        videoId: result.videoId,
        ok: result.ok,
        durationMs: result.durationMs,
        totalTokens: result.totalTokens,
        ...(result.error ? { error: result.error } : {}),
      });
      if (result.ok && result.parsed && !sample) {
        sample = {
          videoId: item.videoId,
          tldr: result.parsed.tldr,
          keyPointCount: result.parsed.keyPoints.length,
          firstKeyPoint: result.parsed.keyPoints[0]?.text ?? '',
        };
      }
      console.log(
        `  [${model}] ${index + 1}/${items.length} ${item.videoId}: ${result.ok ? `ok ${result.durationMs}ms` : `FAIL ${result.error}`}`,
      );
    }
    const ok = itemResults.filter((r) => r.ok);
    results.push({
      model,
      validRate: itemResults.length > 0 ? ok.length / itemResults.length : 0,
      avgDurationMs:
        ok.length > 0 ? Math.round(ok.reduce((s, r) => s + r.durationMs, 0) / ok.length) : 0,
      avgTokens:
        ok.length > 0
          ? Math.round(ok.reduce((s, r) => s + (r.totalTokens ?? 0), 0) / ok.length)
          : 0,
      items: itemResults,
      ...(sample ? { sample } : {}),
    });
  }

  writeFileSync(OUT, JSON.stringify({ ranAt: new Date().toISOString(), results }, null, 2));
  console.log(`\nwrote ${OUT}`);
  for (const r of results) {
    console.log(
      `${r.model}: valid ${(r.validRate * 100).toFixed(0)}%, Ø ${r.avgDurationMs} ms, Ø ${r.avgTokens} tokens`,
    );
    if (r.sample) console.log(`  sample (${r.sample.videoId}): ${r.sample.tldr.slice(0, 120)}…`);
  }
}

void main();
