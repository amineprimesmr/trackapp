import type { NextRequest } from "next/server";
import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { Readable } from "node:stream";

import { resolveResourcesDir } from "@/lib/trackapp-ressources/config";
import { resolveSafeResourceFile } from "@/lib/trackapp-ressources/safe-path";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALLOWED_EXT_RE = /\.(mp4|mov|webm|m4v|zip)$/i;

function mimeFor(filename: string): string {
  if (/\.zip$/i.test(filename)) return "application/zip";
  if (/\.webm$/i.test(filename)) return "video/webm";
  if (/\.mov$/i.test(filename)) return "video/quicktime";
  if (/\.m4v$/i.test(filename)) return "video/mp4";
  return "video/mp4";
}

function asciiFallbackName(filename: string): string {
  return filename.replace(/[^\w.-]+/g, "_").slice(0, 180) || "download.zip";
}

export async function GET(req: NextRequest, ctx: { params: Promise<{ name: string }> }) {
  const { name: rawSegment } = await ctx.params;
  let filename: string;
  try {
    filename = decodeURIComponent(rawSegment);
  } catch {
    return new Response("Nom de fichier invalide.", { status: 400 });
  }

  if (
    !filename
    || filename.startsWith(".")
    || !ALLOWED_EXT_RE.test(filename)
    || filename.includes("..")
    || filename.includes("/")
    || filename.includes("\\")
  ) {
    return new Response("Non trouvé.", { status: 404 });
  }

  const baseDir = resolveResourcesDir();
  if (!baseDir) {
    return new Response("Ressources non configurées.", { status: 503 });
  }

  const abs = resolveSafeResourceFile(baseDir, filename);
  if (!abs) {
    return new Response("Accès refusé.", { status: 403 });
  }

  try {
    const fileStat = await stat(abs);
    if (!fileStat.isFile()) {
      return new Response("Non trouvé.", { status: 404 });
    }

    const size = fileStat.size;
    const isZip = /\.zip$/i.test(filename);
    const range = req.headers.get("range");

    const headersBase = new Headers({
      "Content-Type": mimeFor(filename),
      "Cache-Control": isZip ? "public, max-age=86400, immutable" : "public, max-age=3600",
    });

    if (isZip) {
      headersBase.set(
        "Content-Disposition",
        `attachment; filename="${asciiFallbackName(filename)}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
      );
      headersBase.set("Content-Length", String(size));
      const nodeStream = createReadStream(abs);
      return new Response(Readable.toWeb(nodeStream) as unknown as BodyInit, {
        status: 200,
        headers: headersBase,
      });
    }

    headersBase.set("Accept-Ranges", "bytes");

    if (range) {
      const match = /^bytes=(\d*)-(\d*)$/i.exec(range.trim());
      if (!match) {
        headersBase.set("Content-Range", `bytes */${size}`);
        return new Response("Range Not Satisfiable", { status: 416, headers: headersBase });
      }

      const start = match[1] !== "" ? Number(match[1]) : 0;
      let end = match[2] !== "" ? Number(match[2]) : size - 1;

      if (
        Number.isNaN(start)
        || Number.isNaN(end)
        || start < 0
        || end < 0
        || start >= size
        || start > end
      ) {
        headersBase.set("Content-Range", `bytes */${size}`);
        return new Response("Range Not Satisfiable", { status: 416, headers: headersBase });
      }

      end = Math.min(end, size - 1);
      headersBase.set("Content-Range", `bytes ${start}-${end}/${size}`);
      headersBase.set("Content-Length", String(end - start + 1));

      const nodeStream = createReadStream(abs, { start, end });
      return new Response(Readable.toWeb(nodeStream) as unknown as BodyInit, {
        status: 206,
        headers: headersBase,
      });
    }

    headersBase.set("Content-Length", String(size));
    const nodeStream = createReadStream(abs);
    return new Response(Readable.toWeb(nodeStream) as unknown as BodyInit, {
      status: 200,
      headers: headersBase,
    });
  } catch {
    return new Response("Non trouvé.", { status: 404 });
  }
}
