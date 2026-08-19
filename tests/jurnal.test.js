import { describe, expect, it, vi } from "vitest";
import {
  STORAGE_KEY,
  createEntry,
  filterEntries,
  formatTanggal,
  hitungKehadiran,
  isTanggalValid,
  loadEntries,
  removeEntry,
  saveEntries,
  sortEntries,
  summarize,
  toCSV,
  upsertEntry,
  validateEntry,
} from "../src/jurnal.js";

const validInput = {
  tanggal: "2025-02-28",
  kelas: "4",
  mapel: "Matematika",
  materi: "Pecahan",
  hadir: 20,
  sakit: 1,
  izin: 1,
  alfa: 0,
};

describe("isTanggalValid", () => {
  it("accepts a valid ISO date", () => {
    expect(isTanggalValid("2025-02-28")).toBe(true);
  });

  it("rejects invalid formats and impossible dates", () => {
    expect(isTanggalValid("28-02-2025")).toBe(false);
    expect(isTanggalValid("2025-2-28")).toBe(false);
    expect(isTanggalValid("2025-02-30")).toBe(false);
    expect(isTanggalValid(null)).toBe(false);
  });
});

describe("formatTanggal", () => {
  it("formats dates with Indonesian month names", () => {
    expect(formatTanggal("2025-08-17")).toBe("17 Agustus 2025");
  });

  it("returns a dash for invalid dates", () => {
    expect(formatTanggal("2025-02-30")).toBe("-");
  });
});

describe("validateEntry", () => {
  it("accepts a complete entry", () => {
    expect(validateEntry(validInput)).toEqual({ valid: true, errors: {} });
  });

  it("reports every missing-field error key", () => {
    expect(validateEntry()).toEqual({
      valid: false,
      errors: {
        tanggal: "Tanggal wajib diisi dengan format YYYY-MM-DD.",
        kelas: "Kelas wajib dipilih (1-6).",
        mapel: "Mata pelajaran wajib diisi.",
        materi: "Materi pembelajaran wajib diisi.",
        kehadiran: "Jumlah siswa (hadir/sakit/izin/alfa) wajib diisi.",
      },
    });
  });

  it.each([
    ["tanggal", { tanggal: "" }],
    ["kelas", { kelas: "7" }],
    ["mapel", { mapel: "   " }],
    ["materi", { materi: "" }],
  ])("rejects an invalid %s field", (field, change) => {
    expect(validateEntry({ ...validInput, ...change })).toEqual({
      valid: false,
      errors: expect.objectContaining({ [field]: expect.any(String) }),
    });
  });

  it("requires at least one attendance count", () => {
    expect(
      validateEntry({ ...validInput, hadir: 0, sakit: 0, izin: 0, alfa: 0 }),
    ).toEqual({
      valid: false,
      errors: {
        kehadiran: "Jumlah siswa (hadir/sakit/izin/alfa) wajib diisi.",
      },
    });
  });
});

describe("hitungKehadiran", () => {
  it("coerces negative and non-numeric counts to zero and floors fractions", () => {
    expect(
      hitungKehadiran({
        hadir: -2,
        sakit: "bukan angka",
        izin: 2.9,
        alfa: "3.8",
      }),
    ).toEqual({
      hadir: 0,
      sakit: 0,
      izin: 2,
      alfa: 3,
      total: 5,
      persenHadir: 0,
    });
  });

  it("rounds the attendance percentage to one decimal place", () => {
    expect(hitungKehadiran({ hadir: 1, sakit: 1, izin: 1 })).toMatchObject({
      total: 3,
      persenHadir: 33.3,
    });
  });

  it("returns zero percentage when the total is zero", () => {
    expect(hitungKehadiran()).toEqual({
      hadir: 0,
      sakit: 0,
      izin: 0,
      alfa: 0,
      total: 0,
      persenHadir: 0,
    });
  });
});

describe("createEntry", () => {
  it("trims text, normalizes attendance, and generates identity fields", () => {
    const entry = createEntry({
      tanggal: " 2025-08-18 ",
      kelas: " 3 ",
      mapel: " Matematika ",
      guru: " Bu Sari ",
      materi: " Pecahan ",
      tujuan: " Memahami pecahan ",
      kegiatan: " Diskusi ",
      refleksi: " Perlu latihan ",
      hadir: "12.8",
      sakit: -1,
      izin: "bukan angka",
      alfa: 2.9,
    });

    expect(entry).toMatchObject({
      tanggal: "2025-08-18",
      kelas: "3",
      mapel: "Matematika",
      guru: "Bu Sari",
      materi: "Pecahan",
      tujuan: "Memahami pecahan",
      kegiatan: "Diskusi",
      refleksi: "Perlu latihan",
      hadir: 12,
      sakit: 0,
      izin: 0,
      alfa: 2,
    });
    expect(entry.id).toMatch(/^jrn-\d+-[a-z0-9]{6}$/);
    expect(entry.createdAt).toEqual(expect.any(String));
    expect(Number.isNaN(Date.parse(entry.createdAt))).toBe(false);
  });

  it("honors injected id and createdAt values", () => {
    expect(
      createEntry(validInput, {
        id: "jrn-tetap",
        createdAt: "2025-01-01T00:00:00.000Z",
      }),
    ).toMatchObject({
      id: "jrn-tetap",
      createdAt: "2025-01-01T00:00:00.000Z",
    });
  });
});

describe("upsertEntry", () => {
  it("appends a new entry", () => {
    const existing = [{ id: "a", materi: "Lama" }];
    const added = { id: "b", materi: "Baru" };

    expect(upsertEntry(existing, added)).toEqual([...existing, added]);
    expect(existing).toEqual([{ id: "a", materi: "Lama" }]);
  });

  it("merges an entry with an existing id", () => {
    const existing = [{ id: "a", materi: "Lama", guru: "Bu Ani" }];
    expect(upsertEntry(existing, { id: "a", materi: "Baru" })).toEqual([
      { id: "a", materi: "Baru", guru: "Bu Ani" },
    ]);
  });

  it("treats non-array entries as an empty list", () => {
    expect(upsertEntry(null, { id: "a" })).toEqual([{ id: "a" }]);
  });
});

describe("removeEntry", () => {
  it("removes entries matching the id", () => {
    expect(removeEntry([{ id: "a" }, { id: "b" }, { id: "a" }], "a")).toEqual([
      { id: "b" },
    ]);
  });

  it("returns an empty list for non-array input", () => {
    expect(removeEntry(null, "a")).toEqual([]);
  });
});

describe("filterEntries", () => {
  const entries = [
    {
      id: "a",
      tanggal: "2025-01-01",
      kelas: "1",
      mapel: "Matematika",
      materi: "MATERI pecahan",
      tujuan: "Tujuan membaca",
      kegiatan: "Kegiatan kelompok",
      refleksi: "Refleksi awal",
      guru: "Bu Sari",
    },
    {
      id: "b",
      tanggal: "2025-01-02",
      kelas: "2",
      mapel: "IPAS",
      materi: "Materi tumbuhan",
      tujuan: "TUJUAN eksperimen",
      kegiatan: "Kegiatan pengamatan",
      refleksi: "Refleksi kedua",
      guru: "Pak Budi",
    },
    {
      id: "c",
      tanggal: "2025-01-03",
      kelas: "3",
      mapel: "Bahasa Indonesia",
      materi: "Materi cerita",
      tujuan: "Tujuan menulis",
      kegiatan: "KEGIATAN presentasi",
      refleksi: "Refleksi ketiga",
      guru: "Bu Citra",
    },
    {
      id: "d",
      tanggal: "2025-01-04",
      kelas: "4",
      mapel: "Seni Budaya",
      materi: "Materi warna",
      tujuan: "Tujuan berkarya",
      kegiatan: "Kegiatan menggambar",
      refleksi: "REFLEKSI akhir",
      guru: "Bu Dita",
    },
    {
      id: "e",
      tanggal: "2025-01-05",
      kelas: "5",
      mapel: "PJOK",
      materi: "Materi kebugaran",
      tujuan: "Tujuan bergerak",
      kegiatan: "Kegiatan olahraga",
      refleksi: "Refleksi sehat",
      guru: "GURU Pak Eko",
    },
    {
      id: "f",
      tanggal: "2025-01-06",
      kelas: "6",
      mapel: "Bahasa Inggris",
      materi: "Materi vocabulary",
      tujuan: "Tujuan berbicara",
      kegiatan: "Kegiatan dialog",
      refleksi: "Refleksi lancar",
      guru: "Bu Fina",
    },
  ];

  it("filters by kelas and mapel", () => {
    expect(filterEntries(entries, { kelas: "2" }).map(({ id }) => id)).toEqual(["b"]);
    expect(filterEntries(entries, { mapel: "IPAS" }).map(({ id }) => id)).toEqual(["b"]);
  });

  it("filters by inclusive dari and sampai date ranges", () => {
    expect(
      filterEntries(entries, { dari: "2025-01-02", sampai: "2025-01-04" }).map(({ id }) => id),
    ).toEqual(["b", "c", "d"]);
  });

  it("ignores invalid date filters", () => {
    expect(
      filterEntries(entries, { dari: "2025-02-30", sampai: "not-a-date" }),
    ).toEqual(entries);
  });

  it.each([
    ["materi", "pecahan", "a"],
    ["tujuan", "eksperimen", "b"],
    ["kegiatan", "presentasi", "c"],
    ["refleksi", "akhir", "d"],
    ["guru", "guru pak eko", "e"],
    ["mapel", "bahasa inggris", "f"],
  ])("searches q case-insensitively across %s", (_field, q, id) => {
    expect(filterEntries(entries, { q }).map(({ id: resultId }) => resultId)).toEqual([id]);
  });

  it("returns an empty list for non-array input", () => {
    expect(filterEntries(null, {})).toEqual([]);
  });
});

describe("sortEntries", () => {
  const entries = [
    { id: "kelas-2", tanggal: "2025-01-03", kelas: "2" },
    { id: "kelas-1", tanggal: "2025-01-03", kelas: "1" },
    { id: "lama", tanggal: "2025-01-01", kelas: "6" },
  ];

  it("sorts newest first by default and does not mutate input", () => {
    const original = [...entries];
    const result = sortEntries(entries);

    expect(result.map(({ id }) => id)).toEqual(["kelas-2", "kelas-1", "lama"]);
    expect(entries).toEqual(original);
    expect(result).not.toBe(entries);
  });

  it("sorts oldest first when requested", () => {
    expect(sortEntries(entries, "terlama").map(({ id }) => id)).toEqual([
      "lama",
      "kelas-1",
      "kelas-2",
    ]);
  });

  it("treats non-array input as empty", () => {
    expect(sortEntries(null)).toEqual([]);
  });

  it("handles a newer item compared after an older item", () => {
    expect(
      sortEntries([
        { id: "lama", tanggal: "2025-01-01", kelas: "1" },
        { id: "baru", tanggal: "2025-01-02", kelas: "1" },
      ], "terlama").map(({ id }) => id),
    ).toEqual(["lama", "baru"]);
  });
});

describe("summarize", () => {
  it("counts classes and subjects, averages attendance, and breaks class ties alphabetically", () => {
    const entries = [
      { kelas: "2", mapel: "Matematika", hadir: 8, sakit: 1 },
      { kelas: "1", mapel: "IPAS", hadir: 7, sakit: 3 },
      { kelas: "2", mapel: "Matematika", hadir: 6, sakit: 4 },
      { kelas: "1", mapel: "Matematika", hadir: 5, sakit: 5 },
      { kelas: "3", mapel: "IPAS", hadir: 1, sakit: 9 },
    ];

    expect(summarize(entries)).toEqual({
      jumlahJurnal: 5,
      perKelas: { "1": 2, "2": 2, "3": 1 },
      perMapel: { Matematika: 3, IPAS: 2 },
      rataKehadiran: 55.1,
      kelasTerbanyak: "1",
    });
  });

  it("returns zero totals and no most-frequent class for an empty array", () => {
    expect(summarize([])).toEqual({
      jumlahJurnal: 0,
      perKelas: {},
      perMapel: {},
      rataKehadiran: 0,
      kelasTerbanyak: null,
    });
  });

  it("treats non-array input as empty", () => {
    expect(summarize(null)).toEqual({
      jumlahJurnal: 0,
      perKelas: {},
      perMapel: {},
      rataKehadiran: 0,
      kelasTerbanyak: null,
    });
  });
});

describe("toCSV", () => {
  it("writes a header and quotes fields, including embedded quotes", () => {
    const csv = toCSV([
      {
        tanggal: "2025-01-01",
        kelas: "1",
        mapel: 'Bahasa "Indonesia"',
        guru: "Bu Ani",
        materi: "Membaca, menulis",
        tujuan: null,
        kegiatan: undefined,
        refleksi: "Baik",
        hadir: 20,
        sakit: 1,
        izin: 0,
        alfa: 0,
      },
    ]);

    expect(csv).toBe(
      '"Tanggal","Kelas","Mata Pelajaran","Guru","Materi","Tujuan Pembelajaran","Kegiatan","Refleksi/Catatan","Hadir","Sakit","Izin","Alfa"\n' +
        '"2025-01-01","1","Bahasa ""Indonesia""","Bu Ani","Membaca, menulis","","","Baik","20","1","0","0"',
    );
  });

  it("returns only the header for empty or non-array entries", () => {
    const header =
      '"Tanggal","Kelas","Mata Pelajaran","Guru","Materi","Tujuan Pembelajaran","Kegiatan","Refleksi/Catatan","Hadir","Sakit","Izin","Alfa"';
    expect(toCSV([])).toBe(header);
    expect(toCSV(null)).toBe(header);
  });
});

describe("loadEntries and saveEntries", () => {
  it("round-trips entries through a fake storage object", () => {
    const storage = {
      data: null,
      getItem(key) {
        expect(key).toBe(STORAGE_KEY);
        return this.data;
      },
      setItem(key, value) {
        expect(key).toBe(STORAGE_KEY);
        this.data = value;
      },
    };
    const entries = [{ id: "a", materi: "Pecahan" }];

    expect(saveEntries(storage, entries)).toBe(true);
    expect(loadEntries(storage)).toEqual(entries);
  });

  it("returns an empty list for a missing storage key", () => {
    expect(loadEntries({ getItem: () => null })).toEqual([]);
  });

  it("returns an empty list for malformed JSON and non-array JSON", () => {
    expect(loadEntries({ getItem: () => "bukan json" })).toEqual([]);
    expect(loadEntries({ getItem: () => JSON.stringify({ id: "a" }) })).toEqual([]);
  });

  it("filters loaded entries without string ids", () => {
    const valid = { id: "a", materi: "Valid" };
    expect(
      loadEntries({
        getItem: () =>
          JSON.stringify([valid, { id: 12 }, null, {}, "teks"]),
      }),
    ).toEqual([valid]);
  });

  it("handles storage read and write errors", () => {
    expect(loadEntries({ getItem: () => { throw new Error("read"); } })).toEqual([]);
    expect(saveEntries({ setItem: () => { throw new Error("write"); } }, [])).toBe(false);
  });

  it("handles null storage and non-array save input", () => {
    expect(loadEntries(null)).toEqual([]);
    expect(saveEntries(null, [])).toBe(false);

    const storage = { setItem: vi.fn() };
    expect(saveEntries(storage, null)).toBe(true);
    expect(storage.setItem).toHaveBeenCalledWith(STORAGE_KEY, "[]");
  });
});
