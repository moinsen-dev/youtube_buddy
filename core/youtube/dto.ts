import { z } from 'zod';

/**
 * zod DTOs for the YouTube Data API v3 resources used by M1 (ARCHITECTURE
 * §6). Schemas are lenient where the API is (optional fields), strict about
 * the fields we persist.
 */

const thumbnailSchema = z.object({
  url: z.string(),
  width: z.number().optional(),
  height: z.number().optional(),
});

const thumbnailsSchema = z
  .object({
    default: thumbnailSchema.optional(),
    medium: thumbnailSchema.optional(),
    high: thumbnailSchema.optional(),
    standard: thumbnailSchema.optional(),
    maxres: thumbnailSchema.optional(),
  })
  .partial();

const pageInfoSchema = z.object({ totalResults: z.number(), resultsPerPage: z.number() });

function listResponse<T extends z.ZodTypeAny>(item: T) {
  return z.object({
    kind: z.string().optional(),
    etag: z.string(),
    nextPageToken: z.string().optional(),
    prevPageToken: z.string().optional(),
    pageInfo: pageInfoSchema,
    items: z.array(item).default([]),
  });
}

const resourceIdSchema = z.object({
  kind: z.string().optional(),
  videoId: z.string(),
  channelId: z.string().optional(),
  playlistId: z.string().optional(),
});

// --- subscriptions.list ---

export const subscriptionItemSchema = z.object({
  kind: z.string().optional(),
  etag: z.string(),
  id: z.string(),
  snippet: z.object({
    publishedAt: z.string(),
    title: z.string(),
    description: z.string().optional(),
    resourceId: z.object({ kind: z.string(), channelId: z.string() }),
    channelId: z.string().optional(),
    thumbnails: thumbnailsSchema.optional(),
  }),
  contentDetails: z
    .object({ totalItemCount: z.number().optional(), newItemCount: z.number().optional() })
    .optional(),
});
export const subscriptionListSchema = listResponse(subscriptionItemSchema);
export type SubscriptionListResponse = z.infer<typeof subscriptionListSchema>;

// --- channels.list ---

export const channelItemSchema = z.object({
  kind: z.string().optional(),
  etag: z.string(),
  id: z.string(),
  snippet: z
    .object({
      title: z.string(),
      description: z.string().optional(),
      thumbnails: thumbnailsSchema.optional(),
    })
    .optional(),
  statistics: z
    .object({
      subscriberCount: z.string().optional(),
      videoCount: z.string().optional(),
    })
    .optional(),
  contentDetails: z
    .object({
      relatedPlaylists: z
        .object({
          likes: z.string().optional(),
          uploads: z.string().optional(),
          watchLater: z.string().optional(),
        })
        .optional(),
    })
    .optional(),
});
export const channelListSchema = listResponse(channelItemSchema);
export type ChannelListResponse = z.infer<typeof channelListSchema>;

// --- playlists.list ---

export const playlistItemSchema = z.object({
  kind: z.string().optional(),
  etag: z.string(),
  id: z.string(),
  snippet: z
    .object({
      publishedAt: z.string().optional(),
      channelId: z.string().optional(),
      title: z.string(),
      thumbnails: thumbnailsSchema.optional(),
    })
    .optional(),
  contentDetails: z.object({ itemCount: z.number() }).optional(),
});
export const playlistListSchema = listResponse(playlistItemSchema);
export type PlaylistListResponse = z.infer<typeof playlistListSchema>;

// --- playlistItems.list ---

export const playlistItemEntrySchema = z.object({
  kind: z.string().optional(),
  etag: z.string(),
  id: z.string(),
  snippet: z
    .object({
      publishedAt: z.string().optional(),
      channelId: z.string().optional(),
      title: z.string().optional(),
      position: z.number(),
      resourceId: resourceIdSchema,
      thumbnails: thumbnailsSchema.optional(),
      videoOwnerChannelId: z.string().optional(),
      videoOwnerChannelTitle: z.string().optional(),
    })
    .optional(),
  contentDetails: z
    .object({ videoId: z.string().optional(), videoPublishedAt: z.string().optional() })
    .optional(),
});
export const playlistItemListSchema = listResponse(playlistItemEntrySchema);
export type PlaylistItemListResponse = z.infer<typeof playlistItemListSchema>;

// --- videos.list ---

export const videoItemSchema = z.object({
  kind: z.string().optional(),
  etag: z.string(),
  id: z.string(),
  snippet: z
    .object({
      publishedAt: z.string(),
      channelId: z.string(),
      channelTitle: z.string().optional(),
      title: z.string(),
      description: z.string().optional(),
      thumbnails: thumbnailsSchema.optional(),
    })
    .optional(),
  contentDetails: z
    .object({
      duration: z.string().optional(),
    })
    .optional(),
});
export const videoListSchema = listResponse(videoItemSchema);
export type VideoListResponse = z.infer<typeof videoListSchema>;

// --- helpers ---

/** Picks the best available thumbnail URL (largest first). */
export function bestThumbnail(
  thumbnails: z.infer<typeof thumbnailsSchema> | undefined,
): string | null {
  if (!thumbnails) return null;
  const candidate =
    thumbnails.maxres ??
    thumbnails.standard ??
    thumbnails.high ??
    thumbnails.medium ??
    thumbnails.default;
  return candidate?.url ?? null;
}

/** Parses ISO-8601 durations (PT#H#M#S) into seconds. */
export function parseIsoDuration(duration: string | undefined): number | null {
  if (!duration) return null;
  const match = /^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/.exec(duration);
  if (!match) return null;
  const hours = Number(match[1] ?? 0);
  const minutes = Number(match[2] ?? 0);
  const seconds = Number(match[3] ?? 0);
  return hours * 3600 + minutes * 60 + seconds;
}

/** Parses an RFC-3339 timestamp into epoch milliseconds; null when invalid. */
export function parseIsoDate(value: string | undefined): number | null {
  if (!value) return null;
  const time = Date.parse(value);
  return Number.isNaN(time) ? null : time;
}
