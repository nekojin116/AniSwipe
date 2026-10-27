/**
 * Minimal read-only ZIP reader built on the browser's DecompressionStream.
 *
 * Supports stored and deflated entries plus ZIP64 sizes/offsets — Tachimanga
 * writes ZIP64 records even for small archives, which most tiny zip libraries
 * reject.
 */

const EOCD_SIG = 0x06054b50;
const ZIP64_LOCATOR_SIG = 0x07064b50;
const ZIP64_EOCD_SIG = 0x06064b50;
const CENTRAL_SIG = 0x02014b50;
const LOCAL_SIG = 0x04034b50;

export interface ZipEntry {
  name: string;
  size: number;
  read: () => Promise<Uint8Array<ArrayBuffer>>;
}

async function bytesAt(blob: Blob, start: number, end: number): Promise<DataView> {
  return new DataView(await blob.slice(start, end).arrayBuffer());
}

function u64(view: DataView, offset: number): number {
  return Number(view.getBigUint64(offset, true));
}

async function inflateRaw(blob: Blob): Promise<Uint8Array<ArrayBuffer>> {
  const stream = blob.stream().pipeThrough(new DecompressionStream("deflate-raw"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

/** List the entries of a ZIP archive; contents are only inflated on `read()`. */
export async function readZip(blob: Blob): Promise<Map<string, ZipEntry>> {
  // The end-of-central-directory record sits in the last 22 bytes plus an
  // optional comment of up to 64 KiB.
  const tailStart = Math.max(0, blob.size - 22 - 0xffff);
  const tail = await bytesAt(blob, tailStart, blob.size);
  let eocd = -1;
  for (let i = tail.byteLength - 22; i >= 0; i -= 1) {
    if (tail.getUint32(i, true) === EOCD_SIG) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new Error("Not a ZIP archive.");

  let count = tail.getUint16(eocd + 10, true);
  let cdSize = tail.getUint32(eocd + 12, true);
  let cdOffset = tail.getUint32(eocd + 16, true);

  if (count === 0xffff || cdSize === 0xffffffff || cdOffset === 0xffffffff) {
    const locator = eocd - 20;
    if (locator < 0 || tail.getUint32(locator, true) !== ZIP64_LOCATOR_SIG) {
      throw new Error("Corrupt ZIP64 archive.");
    }
    const recordOffset = u64(tail, locator + 8);
    const record = await bytesAt(blob, recordOffset, recordOffset + 56);
    if (record.getUint32(0, true) !== ZIP64_EOCD_SIG) throw new Error("Corrupt ZIP64 archive.");
    count = u64(record, 32);
    cdSize = u64(record, 40);
    cdOffset = u64(record, 48);
  }

  const cd = await bytesAt(blob, cdOffset, cdOffset + cdSize);
  const decoder = new TextDecoder();
  const entries = new Map<string, ZipEntry>();
  let pos = 0;

  for (let n = 0; n < count; n += 1) {
    if (cd.getUint32(pos, true) !== CENTRAL_SIG) throw new Error("Corrupt ZIP directory.");
    const method = cd.getUint16(pos + 10, true);
    let compressedSize = cd.getUint32(pos + 20, true);
    let size = cd.getUint32(pos + 24, true);
    const nameLen = cd.getUint16(pos + 28, true);
    const extraLen = cd.getUint16(pos + 30, true);
    const commentLen = cd.getUint16(pos + 32, true);
    let localOffset = cd.getUint32(pos + 42, true);
    const name = decoder.decode(
      new Uint8Array(cd.buffer, cd.byteOffset + pos + 46, nameLen),
    );

    // ZIP64 extra field: only the values saturated in the fixed header are
    // present, always in this order.
    let extra = pos + 46 + nameLen;
    const extraEnd = extra + extraLen;
    while (extra + 4 <= extraEnd) {
      const id = cd.getUint16(extra, true);
      const len = cd.getUint16(extra + 2, true);
      if (id === 0x0001) {
        let field = extra + 4;
        if (size === 0xffffffff) {
          size = u64(cd, field);
          field += 8;
        }
        if (compressedSize === 0xffffffff) {
          compressedSize = u64(cd, field);
          field += 8;
        }
        if (localOffset === 0xffffffff) localOffset = u64(cd, field);
      }
      extra += 4 + len;
    }

    pos = extraEnd + commentLen;
    if (name.endsWith("/")) continue;

    entries.set(name, {
      name,
      size,
      read: async () => {
        const local = await bytesAt(blob, localOffset, localOffset + 30);
        if (local.getUint32(0, true) !== LOCAL_SIG) throw new Error(`Corrupt ZIP entry: ${name}`);
        const start =
          localOffset + 30 + local.getUint16(26, true) + local.getUint16(28, true);
        const data = blob.slice(start, start + compressedSize);
        if (method === 0) return new Uint8Array(await data.arrayBuffer());
        if (method === 8) return inflateRaw(data);
        throw new Error(`Unsupported ZIP compression (method ${method}).`);
      },
    });
  }

  return entries;
}
