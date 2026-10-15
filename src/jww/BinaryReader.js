export class BinaryReader {
  constructor(data, offset = 0) {
    this.data = data instanceof Uint8Array ? data : Uint8Array.from(data || []);
    this.view = new DataView(
      this.data.buffer,
      this.data.byteOffset,
      this.data.byteLength
    );
    this.pos = offset;
    this.failed = false;
  }

  remaining() {
    return Math.max(0, this.data.length - this.pos);
  }

  readByte() {
    if (this.remaining() < 1) { this.failed = true; return 0; }
    return this.view.getUint8(this.pos++);
  }

  readWord() {
    if (this.remaining() < 2) {
      this.failed = true;
      this.pos = this.data.length;
      return 0;
    }
    const value = this.view.getUint16(this.pos, true);
    this.pos += 2;
    return value;
  }

  readDword() {
    if (this.remaining() < 4) {
      this.failed = true;
      this.pos = this.data.length;
      return 0;
    }
    const value = this.view.getUint32(this.pos, true);
    this.pos += 4;
    return value;
  }

  readDouble() {
    if (this.remaining() < 8) {
      this.failed = true;
      this.pos = this.data.length;
      return 0;
    }
    const value = this.view.getFloat64(this.pos, true);
    if (!Number.isFinite(value)) this.failed = true;
    this.pos += 8;
    return value;
  }

  readBytes(length) {
    if (!Number.isSafeInteger(length) || length < 0 || length > this.remaining()) this.failed = true;
    const safeLength = Math.max(0, Math.min(Number(length) || 0, this.remaining()));
    const start = this.pos;
    this.pos += safeLength;
    return this.data.slice(start, this.pos);
  }
}
