import { crc32 } from "node:zlib";

/**
 * A minimal ZIP writer for downloading photo folders. Entries are stored, not
 * compressed: JPEGs do not shrink, and storing keeps the server's work to a
 * checksum. Files are read one at a time while the zip streams out, so memory
 * stays at about one photo.
 *
 * Classic ZIP limits apply (no ZIP64): under 65,535 files and 4 GB in all,
 * which one IIIT's photos are far below.
 */

const MAX_ENTRIES = 65_535;
const MAX_OFFSET = 0xffff_ffff;

/** DOS date and time fields, in the server's local time as unzip tools expect. */
function dosDateTime(date) {
  const d = date instanceof Date && !Number.isNaN(date.getTime()) ? date : new Date();
  const year = Math.min(Math.max(d.getFullYear(), 1980), 2107);
  return {
    time: (d.getHours() << 11) | (d.getMinutes() << 5) | Math.floor(d.getSeconds() / 2),
    date: ((year - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate(),
  };
}

function localHeader(name, crc, size, stamp) {
  const header = Buffer.alloc(30);
  header.writeUInt32LE(0x04034b50, 0);
  header.writeUInt16LE(20, 4); // version needed
  header.writeUInt16LE(0x0800, 6); // names are UTF-8
  header.writeUInt16LE(0, 8); // stored
  header.writeUInt16LE(stamp.time, 10);
  header.writeUInt16LE(stamp.date, 12);
  header.writeUInt32LE(crc, 14);
  header.writeUInt32LE(size, 18);
  header.writeUInt32LE(size, 22);
  header.writeUInt16LE(name.length, 26);
  header.writeUInt16LE(0, 28);
  return Buffer.concat([header, name]);
}

function centralHeader(name, crc, size, stamp, offset) {
  const header = Buffer.alloc(46);
  header.writeUInt32LE(0x02014b50, 0);
  header.writeUInt16LE(20, 4); // made by
  header.writeUInt16LE(20, 6); // needed
  header.writeUInt16LE(0x0800, 8);
  header.writeUInt16LE(0, 10);
  header.writeUInt16LE(stamp.time, 12);
  header.writeUInt16LE(stamp.date, 14);
  header.writeUInt32LE(crc, 16);
  header.writeUInt32LE(size, 20);
  header.writeUInt32LE(size, 24);
  header.writeUInt16LE(name.length, 28);
  header.writeUInt32LE(offset, 42);
  return Buffer.concat([header, name]);
}

function endRecord(count, size, offset) {
  const record = Buffer.alloc(22);
  record.writeUInt32LE(0x06054b50, 0);
  record.writeUInt16LE(count, 8);
  record.writeUInt16LE(count, 10);
  record.writeUInt32LE(size, 12);
  record.writeUInt32LE(offset, 16);
  return record;
}

/**
 * Streams a zip of `entries`: [{ name, date, read: async () => Uint8Array }].
 * Names must be unique; an entry whose read() fails is skipped and listed in
 * a closing "missing-files.txt" so one lost file never breaks the download.
 */
export function zipStream(entries) {
  if (entries.length >= MAX_ENTRIES) throw new Error("Too many files for one zip");
  const central = [];
  const missing = [];
  let offset = 0;
  let index = 0;
  let finished = false;

  const add = (controller, nameText, bytes, date) => {
    const name = Buffer.from(nameText, "utf8");
    const data = Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const crc = crc32(data);
    const stamp = dosDateTime(date);
    const head = localHeader(name, crc, data.length, stamp);
    if (offset + head.length + data.length > MAX_OFFSET) throw new Error("Zip would exceed 4 GB");
    central.push(centralHeader(name, crc, data.length, stamp, offset));
    controller.enqueue(new Uint8Array(head));
    controller.enqueue(new Uint8Array(data));
    offset += head.length + data.length;
  };

  return new ReadableStream({
    async pull(controller) {
      if (finished) return;
      // Each pull must enqueue something, or the stream stalls: skip
      // unreadable files until one is added or the list runs out.
      while (index < entries.length) {
        const entry = entries[index];
        index += 1;
        let bytes = null;
        try {
          bytes = await entry.read();
        } catch {
          missing.push(entry.name);
        }
        if (bytes) {
          add(controller, entry.name, bytes, entry.date);
          return;
        }
      }
      if (missing.length) {
        add(controller, "missing-files.txt", Buffer.from(`These photos could not be read from storage:\n${missing.join("\n")}\n`), new Date());
      }
      const directory = Buffer.concat(central);
      controller.enqueue(new Uint8Array(directory));
      controller.enqueue(new Uint8Array(endRecord(central.length, directory.length, offset)));
      finished = true;
      controller.close();
    },
  });
}
