import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";
import { ARCHIVE_SCHEMA_VER, toArchiveBlob, type ArchiveBlob } from "./blob";

export type CloudArchive = {
  handle: string;
  archive: ArchiveBlob;
  schemaVer: number;
  updatedAt: string;
};

export const loadArchive = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }): Promise<CloudArchive | null> => {
    const { getSql } = await import("@/lib/db");
    const sql = await getSql();
    const rows = await sql.query<{
      handle: string;
      archive: unknown;
      schema_ver: number;
      updated_at: string;
    }>(
      "select handle, archive, schema_ver, updated_at::text as updated_at from agents where user_id = $1 limit 1",
      [context.userId],
    );
    const row = rows[0];
    if (!row) return null;
    return {
      handle: row.handle,
      archive: toArchiveBlob(row.archive),
      schemaVer: Number(row.schema_ver) || ARCHIVE_SCHEMA_VER,
      updatedAt: row.updated_at,
    };
  });

export const saveArchive = createServerFn({ method: "POST" })
  .validator((data: { handle: string; archive: unknown }) => {
    const handle = typeof data?.handle === "string" ? data.handle.trim().slice(0, 24) : "";
    if (handle.length < 3) throw new Error("invalid handle");
    return { handle, archive: toArchiveBlob(data.archive) };
  })
  .middleware([authMiddleware])
  .handler(async ({ context, data }): Promise<{ ok: true; updatedAt: string }> => {
    const { getSql } = await import("@/lib/db");
    const sql = await getSql();
    const rows = await sql.query<{ updated_at: string }>(
      `insert into agents (user_id, handle, archive, schema_ver, updated_at)
       values ($1, $2, $3::jsonb, $4, now())
       on conflict (user_id) do update set
         handle = excluded.handle,
         archive = excluded.archive,
         schema_ver = excluded.schema_ver,
         updated_at = now()
       returning updated_at::text as updated_at`,
      [context.userId, data.handle, JSON.stringify(data.archive), ARCHIVE_SCHEMA_VER],
    );
    return { ok: true, updatedAt: rows[0]?.updated_at ?? new Date().toISOString() };
  });
