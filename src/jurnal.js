/**
 * Logika Jurnal Harian Belajar (tanpa ketergantungan DOM).
 * Semua fungsi bersifat murni kecuali yang menerima objek storage.
 */

export const STORAGE_KEY = "satudata.jurnal-harian.v1";

export const MATA_PELAJARAN = [
  "Bahasa Indonesia",
  "Matematika",
  "IPAS",
  "Pendidikan Pancasila",
  "PJOK",
  "Seni Budaya",
  "Bahasa Inggris",
  "Pendidikan Agama",
  "Muatan Lokal",
];

export const KELAS = ["1", "2", "3", "4", "5", "6"];

const NAMA_BULAN = [
  "Januari",
  "Februari",
  "Maret",
  "April",
  "Mei",
  "Juni",
  "Juli",
  "Agustus",
  "September",
  "Oktober",
  "November",
  "Desember",
];

function teks(nilai) {
  return typeof nilai === "string" ? nilai.trim() : "";
}

function bilangan(nilai) {
  const angka = Number(nilai);
  if (!Number.isFinite(angka) || angka < 0) return 0;
  return Math.floor(angka);
}

export function isTanggalValid(tanggal) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(teks(tanggal))) return false;
  const [tahun, bulan, hari] = tanggal.split("-").map(Number);
  const tanggalObjek = new Date(Date.UTC(tahun, bulan - 1, hari));
  return (
    tanggalObjek.getUTCFullYear() === tahun &&
    tanggalObjek.getUTCMonth() === bulan - 1 &&
    tanggalObjek.getUTCDate() === hari
  );
}

export function formatTanggal(tanggal) {
  if (!isTanggalValid(tanggal)) return "-";
  const [tahun, bulan, hari] = tanggal.split("-").map(Number);
  return `${hari} ${NAMA_BULAN[bulan - 1]} ${tahun}`;
}

export function validateEntry(input = {}) {
  const errors = {};
  if (!isTanggalValid(input.tanggal)) errors.tanggal = "Tanggal wajib diisi dengan format YYYY-MM-DD.";
  if (!KELAS.includes(teks(input.kelas))) errors.kelas = "Kelas wajib dipilih (1-6).";
  if (!teks(input.mapel)) errors.mapel = "Mata pelajaran wajib diisi.";
  if (!teks(input.materi)) errors.materi = "Materi pembelajaran wajib diisi.";

  const kehadiran = hitungKehadiran(input);
  if (kehadiran.total === 0) errors.kehadiran = "Jumlah siswa (hadir/sakit/izin/alfa) wajib diisi.";

  return { valid: Object.keys(errors).length === 0, errors };
}

export function hitungKehadiran(input = {}) {
  const hadir = bilangan(input.hadir);
  const sakit = bilangan(input.sakit);
  const izin = bilangan(input.izin);
  const alfa = bilangan(input.alfa);
  const total = hadir + sakit + izin + alfa;
  const persenHadir = total === 0 ? 0 : Math.round((hadir / total) * 1000) / 10;
  return { hadir, sakit, izin, alfa, total, persenHadir };
}

export function createEntry(input = {}, { id, createdAt } = {}) {
  const kehadiran = hitungKehadiran(input);
  return {
    id: id || `jrn-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    createdAt: createdAt || new Date().toISOString(),
    tanggal: teks(input.tanggal),
    kelas: teks(input.kelas),
    mapel: teks(input.mapel),
    guru: teks(input.guru),
    materi: teks(input.materi),
    tujuan: teks(input.tujuan),
    kegiatan: teks(input.kegiatan),
    refleksi: teks(input.refleksi),
    hadir: kehadiran.hadir,
    sakit: kehadiran.sakit,
    izin: kehadiran.izin,
    alfa: kehadiran.alfa,
  };
}

export function upsertEntry(entries, entry) {
  const daftar = Array.isArray(entries) ? entries : [];
  const indeks = daftar.findIndex((item) => item.id === entry.id);
  if (indeks === -1) return [...daftar, entry];
  const hasil = [...daftar];
  hasil[indeks] = { ...hasil[indeks], ...entry };
  return hasil;
}

export function removeEntry(entries, id) {
  return (Array.isArray(entries) ? entries : []).filter((item) => item.id !== id);
}

export function filterEntries(entries, filter = {}) {
  const kata = teks(filter.q).toLowerCase();
  return (Array.isArray(entries) ? entries : []).filter((entry) => {
    if (teks(filter.kelas) && entry.kelas !== teks(filter.kelas)) return false;
    if (teks(filter.mapel) && entry.mapel !== teks(filter.mapel)) return false;
    if (isTanggalValid(filter.dari) && entry.tanggal < filter.dari) return false;
    if (isTanggalValid(filter.sampai) && entry.tanggal > filter.sampai) return false;
    if (kata) {
      const gabungan = [entry.materi, entry.tujuan, entry.kegiatan, entry.refleksi, entry.guru, entry.mapel]
        .join(" ")
        .toLowerCase();
      if (!gabungan.includes(kata)) return false;
    }
    return true;
  });
}

export function sortEntries(entries, urutan = "terbaru") {
  const daftar = [...(Array.isArray(entries) ? entries : [])];
  daftar.sort((a, b) => {
    if (a.tanggal === b.tanggal) return teks(a.kelas).localeCompare(teks(b.kelas));
    return a.tanggal < b.tanggal ? -1 : 1;
  });
  return urutan === "terlama" ? daftar : daftar.reverse();
}

export function summarize(entries) {
  const daftar = Array.isArray(entries) ? entries : [];
  const perKelas = {};
  const perMapel = {};
  let totalHadir = 0;
  let totalSiswa = 0;

  daftar.forEach((entry) => {
    perKelas[entry.kelas] = (perKelas[entry.kelas] || 0) + 1;
    perMapel[entry.mapel] = (perMapel[entry.mapel] || 0) + 1;
    const kehadiran = hitungKehadiran(entry);
    totalHadir += kehadiran.hadir;
    totalSiswa += kehadiran.total;
  });

  return {
    jumlahJurnal: daftar.length,
    perKelas,
    perMapel,
    rataKehadiran: totalSiswa === 0 ? 0 : Math.round((totalHadir / totalSiswa) * 1000) / 10,
    kelasTerbanyak:
      Object.keys(perKelas).sort((a, b) => perKelas[b] - perKelas[a] || a.localeCompare(b))[0] || null,
  };
}

const KOLOM_CSV = [
  ["tanggal", "Tanggal"],
  ["kelas", "Kelas"],
  ["mapel", "Mata Pelajaran"],
  ["guru", "Guru"],
  ["materi", "Materi"],
  ["tujuan", "Tujuan Pembelajaran"],
  ["kegiatan", "Kegiatan"],
  ["refleksi", "Refleksi/Catatan"],
  ["hadir", "Hadir"],
  ["sakit", "Sakit"],
  ["izin", "Izin"],
  ["alfa", "Alfa"],
];

function selCSV(nilai) {
  const isi = nilai === null || nilai === undefined ? "" : String(nilai);
  return `"${isi.replace(/"/g, '""')}"`;
}

export function toCSV(entries) {
  const baris = [KOLOM_CSV.map(([, judul]) => selCSV(judul)).join(",")];
  (Array.isArray(entries) ? entries : []).forEach((entry) => {
    baris.push(KOLOM_CSV.map(([kunci]) => selCSV(entry[kunci])).join(","));
  });
  return baris.join("\n");
}

export function loadEntries(storage) {
  if (!storage) return [];
  try {
    const mentah = storage.getItem(STORAGE_KEY);
    if (!mentah) return [];
    const data = JSON.parse(mentah);
    if (!Array.isArray(data)) return [];
    return data.filter((entry) => entry && typeof entry === "object" && typeof entry.id === "string");
  } catch (err) {
    return [];
  }
}

export function saveEntries(storage, entries) {
  if (!storage) return false;
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(Array.isArray(entries) ? entries : []));
    return true;
  } catch (err) {
    return false;
  }
}
