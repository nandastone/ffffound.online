// Shared types for D1 row shapes and Worker bindings.

export interface Env {
  DB: D1Database;
  IMAGES: R2Bucket;
  CACHE_MAX_AGE: string;
  // AdSense — both must be set for the slot to render. Empty string = no ad.
  // Pulled in via wrangler.toml [vars] or `wrangler secret put`.
  ADSENSE_PUBLISHER_ID?: string;   // "ca-pub-XXXXXXXXXXXXXXXX"
  ADSENSE_SLOT_ID?: string;        // numeric slot id from the ad unit
}

export interface UserRow {
  username: string;
  display_name: string | null;
  joined_at: number | null;
  bio: string | null;
  save_count: number;
}

export interface ImageRow {
  image_id: string;
  uploader: string;
  title: string | null;
  source_url: string | null;
  source_dead: number;
  cdn_thumbnail_url: string | null;
  r2_key: string | null;
  width: number | null;
  height: number | null;
  uploaded_at: number | null;
  save_count: number;
}
