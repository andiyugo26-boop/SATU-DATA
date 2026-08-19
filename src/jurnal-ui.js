import {
  KELAS,
  MATA_PELAJARAN,
  createEntry,
  filterEntries,
  formatTanggal,
  hitungKehadiran,
  loadEntries,
  removeEntry,
  saveEntries,
  sortEntries,
  summarize,
  toCSV,
  upsertEntry,
  validateEntry,
} from "./jurnal.js";

const el = (id) => document.getElementById(id);
const form = el("form-jurnal");
const isiTabel = el("isi-tabel");
const pesanKosong = el("pesan-kosong");
const notif = el("notif");

let entries = loadEntries(window.localStorage);

function isiPilihan(select, nilai, label = (v) => v) {
  nilai.forEach((v) => {
    const opsi = document.createElement("option");
    opsi.value = v;
    opsi.textContent = label(v);
    select.appendChild(opsi);
  });
}

isiPilihan(el("kelas"), KELAS, (v) => `Kelas ${v}`);
isiPilihan(el("filter-kelas"), KELAS, (v) => `Kelas ${v}`);
isiPilihan(el("mapel"), MATA_PELAJARAN);
isiPilihan(el("filter-mapel"), MATA_PELAJARAN);

el("tanggal").value = new Date().toISOString().slice(0, 10);

function tampilkanNotif(pesan) {
  notif.textContent = pesan;
  notif.style.display = "block";
  window.setTimeout(() => {
    notif.style.display = "none";
  }, 3000);
}

function bacaForm() {
  const data = Object.fromEntries(new FormData(form).entries());
  data.id = el("id").value;
  return data;
}

function bersihkanGalat() {
  document.querySelectorAll("[data-galat]").forEach((node) => {
    node.textContent = "";
  });
  form.querySelectorAll(".salah").forEach((node) => node.classList.remove("salah"));
}

function tampilkanGalat(errors) {
  bersihkanGalat();
  Object.entries(errors).forEach(([field, pesan]) => {
    const kotak = document.querySelector(`[data-galat="${field}"]`);
    if (kotak) kotak.textContent = pesan;
    const input = el(field);
    if (input) input.classList.add("salah");
  });
}

function bacaFilter() {
  return {
    kelas: el("filter-kelas").value,
    mapel: el("filter-mapel").value,
    dari: el("filter-dari").value,
    sampai: el("filter-sampai").value,
    q: el("filter-q").value,
  };
}

function entriTampil() {
  return sortEntries(filterEntries(entries, bacaFilter()), el("filter-urutan").value);
}

function render() {
  const tampil = entriTampil();
  const rekap = summarize(entries);

  el("rekap-jumlah").textContent = rekap.jumlahJurnal;
  el("rekap-kehadiran").textContent = `${rekap.rataKehadiran}%`;
  el("rekap-kelas").textContent = rekap.kelasTerbanyak ? `Kelas ${rekap.kelasTerbanyak}` : "-";
  el("rekap-tampil").textContent = tampil.length;

  isiTabel.textContent = "";
  tampil.forEach((entry) => {
    const kehadiran = hitungKehadiran(entry);
    const tr = document.createElement("tr");
    [
      formatTanggal(entry.tanggal),
      `Kelas ${entry.kelas}`,
      entry.mapel,
      entry.guru,
      entry.materi,
      entry.tujuan,
      entry.kegiatan,
      entry.refleksi,
      `H${kehadiran.hadir} S${kehadiran.sakit} I${kehadiran.izin} A${kehadiran.alfa} (${kehadiran.persenHadir}%)`,
    ].forEach((isi) => {
      const td = document.createElement("td");
      td.textContent = isi || "-";
      tr.appendChild(td);
    });

    const tdAksi = document.createElement("td");
    const wadah = document.createElement("div");
    wadah.className = "baris-aksi";

    const tombolEdit = document.createElement("button");
    tombolEdit.type = "button";
    tombolEdit.className = "sekunder";
    tombolEdit.textContent = "Edit";
    tombolEdit.addEventListener("click", () => muatKeForm(entry));

    const tombolHapus = document.createElement("button");
    tombolHapus.type = "button";
    tombolHapus.className = "bahaya";
    tombolHapus.textContent = "Hapus";
    tombolHapus.addEventListener("click", () => {
      if (!window.confirm("Hapus jurnal ini?")) return;
      entries = removeEntry(entries, entry.id);
      simpanDanRender("Jurnal dihapus.");
    });

    wadah.append(tombolEdit, tombolHapus);
    tdAksi.appendChild(wadah);
    tr.appendChild(tdAksi);
    isiTabel.appendChild(tr);
  });

  pesanKosong.style.display = tampil.length ? "none" : "block";
  pesanKosong.textContent = entries.length
    ? "Tidak ada jurnal yang sesuai filter."
    : "Belum ada jurnal. Isi formulir di atas untuk menambahkan.";
}

function simpanDanRender(pesan) {
  if (!saveEntries(window.localStorage, entries)) {
    tampilkanNotif("Gagal menyimpan ke penyimpanan lokal.");
  } else if (pesan) {
    tampilkanNotif(pesan);
  }
  render();
}

function muatKeForm(entry) {
  el("id").value = entry.id;
  ["tanggal", "kelas", "mapel", "guru", "materi", "tujuan", "kegiatan", "refleksi", "hadir", "sakit", "izin", "alfa"]
    .forEach((field) => {
      el(field).value = entry[field] ?? "";
    });
  el("judul-form").textContent = "Edit Jurnal Harian";
  el("tombol-simpan").textContent = "Perbarui Jurnal";
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function resetForm() {
  // kelas & nama guru dipertahankan agar guru tidak mengisi ulang tiap jurnal
  const kelasTerakhir = el("kelas").value;
  const guruTerakhir = el("guru").value;
  form.reset();
  el("id").value = "";
  el("kelas").value = kelasTerakhir;
  el("guru").value = guruTerakhir;
  el("mapel").value = "";
  el("tanggal").value = new Date().toISOString().slice(0, 10);
  ["hadir", "sakit", "izin", "alfa"].forEach((field) => {
    el(field).value = "0";
  });
  el("judul-form").textContent = "Tambah Jurnal Harian";
  el("tombol-simpan").textContent = "Simpan Jurnal";
  bersihkanGalat();
}

form.addEventListener("submit", (event) => {
  event.preventDefault();
  const data = bacaForm();
  const { valid, errors } = validateEntry(data);
  if (!valid) {
    tampilkanGalat(errors);
    return;
  }
  const lama = entries.find((item) => item.id === data.id);
  const entry = createEntry(data, lama ? { id: lama.id, createdAt: lama.createdAt } : {});
  entries = upsertEntry(entries, entry);
  resetForm();
  simpanDanRender(lama ? "Jurnal diperbarui." : "Jurnal tersimpan.");
});

el("tombol-batal").addEventListener("click", resetForm);

["filter-kelas", "filter-mapel", "filter-dari", "filter-sampai", "filter-q", "filter-urutan"].forEach((id) => {
  el(id).addEventListener("input", render);
});

el("tombol-reset-filter").addEventListener("click", () => {
  ["filter-kelas", "filter-mapel", "filter-dari", "filter-sampai", "filter-q"].forEach((id) => {
    el(id).value = "";
  });
  el("filter-urutan").value = "terbaru";
  render();
});

el("tombol-csv").addEventListener("click", () => {
  const tampil = entriTampil();
  if (!tampil.length) {
    tampilkanNotif("Tidak ada data untuk diexport.");
    return;
  }
  const blob = new Blob([`\uFEFF${toCSV(tampil)}`], { type: "text/csv;charset=utf-8;" });
  const tautan = document.createElement("a");
  tautan.href = URL.createObjectURL(blob);
  tautan.download = `jurnal-harian-${new Date().toISOString().slice(0, 10)}.csv`;
  tautan.click();
  URL.revokeObjectURL(tautan.href);
});

el("tombol-cetak").addEventListener("click", () => window.print());

el("tombol-hapus-semua").addEventListener("click", () => {
  if (!entries.length) return;
  if (!window.confirm("Hapus SEMUA jurnal yang tersimpan?")) return;
  entries = [];
  simpanDanRender("Semua jurnal dihapus.");
});

render();
