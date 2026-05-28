export class BinaryReader {
  constructor(data, offset = 0) {
    this.data = data instanceof Uint8Array ? data : Uint8Array.from(data || []);
    this.view = new DataView(
      this.data.buffer,
      this.data.byteOffset,
      this.data.byteLength
    );
    this.pos = offset;
  }

  remaining() {
    return Math.max(0, this.data.length - this.pos);
  }

  readByte() {
    if (this.remaining() < 1) return 0;
    return this.view.getUint8(this.pos++);
  }

  readWord() {
    if (this.remaining() < 2) {
      this.pos = this.data.length;
      return 0;
    }
    const value = this.view.getUint16(this.pos, true);
    this.pos += 2;
    return value;
  }

  readDword() {
    if (this.remaining() < 4) {
      this.pos = this.data.length;
      return 0;
    }
    const value = this.view.getUint32(this.pos, true);
    this.pos += 4;
    return value;
  }

  readDouble() {
    if (this.remaining() < 8) {
      this.pos = this.data.length;
      return 0;
    }
    const value = this.view.getFloat64(this.pos, true);
    this.pos += 8;
    return value;
  }

  readBytes(length) {
    const safeLength = Math.max(0, Math.min(Number(length) || 0, this.remaining()));
    const start = this.pos;
    this.pos += safeLength;
    return this.data.slice(start, this.pos);
  }
}
