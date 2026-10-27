/**
 * Schema-less protobuf decoding — just enough to walk a Tachiyomi/Mihon
 * backup without bundling a protobuf runtime and its .proto definitions.
 */

export type ProtoValue = bigint | Uint8Array | number;

/** Field number -> every value seen for it, in order (repeated fields). */
export type ProtoMessage = Map<number, ProtoValue[]>;

export function decodeMessage(bytes: Uint8Array): ProtoMessage {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const fields: ProtoMessage = new Map();
  let pos = 0;

  const varint = (): bigint => {
    let result = 0n;
    let shift = 0n;
    for (;;) {
      if (pos >= bytes.length) throw new Error("Truncated protobuf varint.");
      const byte = bytes[pos++];
      result |= BigInt(byte & 0x7f) << shift;
      if ((byte & 0x80) === 0) return result;
      shift += 7n;
    }
  };

  while (pos < bytes.length) {
    const key = Number(varint());
    const field = key >>> 3;
    const wire = key & 7;
    let value: ProtoValue;
    switch (wire) {
      case 0:
        value = varint();
        break;
      case 1:
        value = view.getFloat64(pos, true);
        pos += 8;
        break;
      case 2: {
        const len = Number(varint());
        if (pos + len > bytes.length) throw new Error("Truncated protobuf field.");
        value = bytes.subarray(pos, pos + len);
        pos += len;
        break;
      }
      case 5:
        value = view.getFloat32(pos, true);
        pos += 4;
        break;
      default:
        throw new Error(`Unsupported protobuf wire type ${wire}.`);
    }
    const list = fields.get(field);
    if (list) list.push(value);
    else fields.set(field, [value]);
  }
  return fields;
}

const utf8 = new TextDecoder();

export function protoString(msg: ProtoMessage, field: number): string | null {
  const value = msg.get(field)?.[0];
  return value instanceof Uint8Array ? utf8.decode(value) : null;
}

/** Varint or fixed-width number (floats come through as fixed32). */
export function protoNumber(msg: ProtoMessage, field: number): number | null {
  const value = msg.get(field)?.[0];
  if (typeof value === "bigint") return Number(BigInt.asIntN(64, value));
  return typeof value === "number" ? value : null;
}

/** Full-precision 64-bit id as a string (source ids overflow JS numbers). */
export function protoId(msg: ProtoMessage, field: number): string | null {
  const value = msg.get(field)?.[0];
  return typeof value === "bigint" ? BigInt.asIntN(64, value).toString() : null;
}

export function protoMessages(msg: ProtoMessage, field: number): ProtoMessage[] {
  return (msg.get(field) ?? [])
    .filter((value): value is Uint8Array => value instanceof Uint8Array)
    .map(decodeMessage);
}
