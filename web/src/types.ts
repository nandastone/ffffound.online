// Shared types for D1 row shapes and Worker bindings.

export interface Env {
  DB: D1Database;
  IMAGES: R2Bucket;
  CACHE_MAX_AGE: string;
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
