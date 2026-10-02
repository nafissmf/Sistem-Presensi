# PRD — Sistem Presensi Barcode Rakernas

| | |
|---|---|
| **Versi** | 1.0 (Draft) |
| **Tanggal** | 1 Oktober 2026 |
| **Sumber data** | `Kode_Presensi_Rakernas.xlsx` |
| **Status** | Menunggu review |

---

## 1. Ringkasan

Sistem web untuk mencatat kehadiran peserta Rakernas dengan **scan barcode**. Setiap peserta punya kode unik (contoh: `Rakernas-001`) yang dicetak sebagai barcode di tanda pengenal. Petugas men-scan barcode di pintu masuk setiap sesi, dan kehadiran langsung tercatat serta tampil di dashboard secara real-time.

Admin dapat **menambah kegiatan/acara secara dinamis** (misalnya Registrasi, Pembukaan, Sidang Komisi, Makan Siang, Gala Dinner). Setiap kegiatan punya daftar hadirnya sendiri. Barcode peserta yang sama dipakai di semua kegiatan.

## 2. Tujuan dan Non-Tujuan

**Tujuan**
1. Presensi cepat: target ≤ 2 detik dari scan sampai hasil tampil.
2. Satu barcode per peserta untuk semua kegiatan.
3. Admin bisa membuat dan mengatur kegiatan tanpa bantuan developer.
4. Panitia melihat siapa yang sudah dan belum hadir secara live.
5. Cetak barcode (nama, instansi, barcode) tersedia dari sidebar.
6. Tampilan modern, bersih, dan nyaman dipakai di lapangan.

**Non-tujuan (versi 1)**
- Pendaftaran mandiri dan pembayaran peserta (data sudah ada dari Excel).
- Sertifikat otomatis dan integrasi WhatsApp/email.
- Desain final kartu nama (menyusul, lihat bagian 8).

## 3. Pengguna dan Peran

| Peran | Tugas | Akses |
|---|---|---|
| **Admin** | Kelola peserta, kegiatan, pengguna, cetak barcode, laporan | Semua menu |
| **Petugas Scan** | Scan barcode di pintu kegiatan | Hanya layar Scan dan riwayat scan miliknya |
| **Viewer** (opsional) | Pantau dashboard dan laporan | Baca saja |

## 4. Data Awal dari Excel

Hasil pembacaan file yang diunggah:

- **Sheet `Daftar Peserta`**: kolom `Kode`, `Nama`, `Instansi`, berisi **103 baris peserta**.
- Format kode: `Rakernas-001` sampai `Rakernas-103`, tidak ada kode ganda.
- **64 instansi unik**. Terbesar: Dinas Kearsipan dan Perpustakaan Kab. Barito Utara (7), Pusat Sejarah Polri (5), Setjen DPR RI (5), Universitas Terbuka (5).
- Nama terpanjang 42 karakter (banyak gelar), instansi terpanjang 73 karakter. Layout cetak harus bisa memuat teks sepanjang ini (wrap dua baris atau pengecilan font otomatis).
- **Sheet `Ringkasan`**: Total Pendaftar 104; Terverifikasi 92; Menunggu Verifikasi 4; Tunda Bayar 7; Ditolak 1; diekspor 1 Oktober 2026 13.23 WIB.

> **Perlu dicek:** daftar peserta hanya berisi 103 baris, sedangkan ringkasan menyebut 104. Selisihnya mungkin peserta berstatus Ditolak yang tidak ikut diekspor. Juga tidak ada kolom status per peserta, sehingga sistem belum bisa membedakan peserta terverifikasi dan yang belum. Lihat pertanyaan terbuka (bagian 14).

### Aturan import
- Format yang diterima: `.xlsx` / `.csv` dengan kolom `Kode`, `Nama`, `Instansi` (kolom `Status` opsional).
- Validasi: kode wajib unik, nama dan instansi tidak boleh kosong, trim spasi berlebih.
- Tampilkan pratinjau sebelum disimpan (jumlah baru, diperbarui, error per baris).
- Import ulang memperbarui peserta berdasarkan `Kode` dan tidak menghapus riwayat presensi.

## 5. Fitur dan Kebutuhan Fungsional

### 5.1 Navigasi Sidebar
1. **Dashboard**
2. **Kegiatan**
3. **Scan Presensi**
4. **Peserta**
5. **Cetak Barcode**
6. **Laporan**
7. **Pengaturan** (pengguna, preferensi)

### 5.2 Dashboard (live)
- Kartu statistik: total peserta, hadir hari ini, hadir di kegiatan aktif, persentase kehadiran.
- Daftar kegiatan hari ini dengan progress bar kehadiran.
- Feed "Baru saja hadir" yang bergerak real-time (nama, instansi, jam, kegiatan).
- Grafik kehadiran per jam, dan kehadiran per instansi.
- Tombol cepat: **Mulai Scan**, **Tambah Kegiatan**.

### 5.3 Manajemen Kegiatan (dinamis)
Admin dapat menambah, mengubah, menduplikasi, mengarsipkan, dan menghapus kegiatan.

| Field | Keterangan |
|---|---|
| Nama kegiatan | Wajib. Contoh: "Sidang Pleno 1" |
| Tanggal, jam mulai, jam selesai | Wajib |
| Lokasi / ruangan | Opsional |
| Peserta wajib | Semua peserta, atau pilih subset (per instansi / manual) |
| Jendela scan | Opsional: scan dibuka N menit sebelum mulai, ditutup N menit setelah selesai |
| Status | Draft, Aktif, Selesai, Diarsipkan |
| Izinkan scan ganda | Default: tidak. Scan kedua hanya menampilkan "Sudah hadir pukul …" |
| Warna/ikon | Untuk identitas visual di dashboard |

Aturan: kegiatan yang sudah punya data presensi tidak bisa dihapus permanen, hanya diarsipkan.

### 5.4 Scan Presensi (fitur inti)
**Mode input:**
1. **Scanner USB/Bluetooth (utama).** Scanner genggam bekerja seperti keyboard: mengirim isi barcode lalu Enter. Kolom input harus selalu terfokus otomatis.
2. **Kamera HP/laptop (cadangan).** Scan lewat browser untuk situasi tanpa alat.
3. **Input manual.** Ketik kode atau cari nama bila barcode rusak.

**Alur:**
1. Petugas memilih kegiatan (atau sistem otomatis memilih kegiatan yang sedang berlangsung).
2. Scan barcode → sistem mencari peserta berdasarkan kode.
3. Sistem menampilkan hasil besar dan jelas:

| Hasil | Tampilan | Suara |
|---|---|---|
| Berhasil | Hijau, nama dan instansi besar, jam hadir | Bunyi pendek naik |
| Sudah hadir | Kuning, "Sudah hadir pukul 09.14" | Bunyi ganda |
| Kode tidak dikenal | Merah, "Kode tidak ditemukan" | Bunyi rendah |
| Bukan peserta kegiatan ini | Oranye, dengan opsi "Tetap catat" (hak admin) | Bunyi ganda |
| Kegiatan belum dibuka / sudah ditutup | Abu-abu dengan penjelasan | Bunyi rendah |

4. Hasil hilang otomatis setelah 2–3 detik dan siap untuk scan berikutnya.
5. Panel samping menampilkan 10 scan terakhir dan penghitung "Hadir X / Y".

**Aturan tambahan:** debounce (scan yang sama dalam 3 detik diabaikan), mode layar penuh (kiosk), tombol **Batalkan scan terakhir** (undo), pilihan mute suara.

### 5.5 Manajemen Peserta
- Tabel dengan pencarian (nama/instansi/kode), filter instansi dan status kehadiran, pagination.
- Tambah, ubah, hapus peserta manual; import Excel.
- Halaman detail peserta: barcode, riwayat kehadiran di semua kegiatan.

### 5.6 Cetak Barcode (menu sidebar)
Isi minimum tiap kartu: **Nama, Instansi, Barcode** (dengan teks kode di bawahnya).

Fitur fungsional (desain visual menyusul):
- Pilih peserta: semua, per instansi, atau centang manual; cetak satu peserta dari halaman detail.
- Pratinjau sebelum cetak.
- Pilihan ukuran: kartu nama/ID card (misalnya 85×55 mm dan 100×70 mm) dan kertas label.
- Output ke **PDF** (A4 berisi beberapa kartu per halaman) dan langsung print browser.
- Pilihan jenis barcode: Code 128 (default) atau QR.
- Penanganan teks panjang (wrap dua baris, auto-shrink).
- Indikator "sudah dicetak" per peserta, untuk cetak ulang bila ada yang hilang.

### 5.7 Laporan dan Ekspor
- Rekap per kegiatan: daftar hadir, tidak hadir, jam hadir.
- Rekap per peserta: hadir di kegiatan apa saja.
- Rekap per instansi.
- Ekspor **Excel/CSV** dan **PDF**.

### 5.8 Pengguna dan Keamanan
- Login email/username dan password; peran Admin, Petugas Scan, Viewer.
- Admin dapat membuat akun petugas dan menonaktifkannya.
- Setiap scan mencatat siapa petugasnya, waktu, dan perangkat (audit log).

## 6. Barcode: Rekomendasi Teknis

- **Isi barcode = kolom `Kode`** (contoh `Rakernas-001`), bukan data pribadi.
- **Code 128** dipilih sebagai default karena mendukung huruf, angka, dan tanda hubung, serta terbaca baik oleh scanner genggam murah.
- **QR Code** sebagai alternatif untuk scan lewat kamera HP.
- Ukuran minimum agar terbaca: tinggi barcode ≥ 10 mm, lebar bar tipis ≥ 0,25 mm, dengan *quiet zone* di kiri dan kanan.
- Cetak kontras tinggi (hitam di atas putih). Hindari lamination mengilap yang menimbulkan pantulan.
- Lakukan **uji baca** pada alat scan yang akan dipakai sebelum cetak massal.

## 7. Model Data

```
participants        (id, code UNIQUE, name, organization, status, printed_at, created_at)
events              (id, name, date, start_time, end_time, location, status,
                     scan_open_before_min, scan_close_after_min,
                     allow_duplicate, color, created_at)
event_participants  (event_id, participant_id)          -- bila kegiatan hanya untuk subset
attendances         (id, event_id, participant_id, scanned_at, scanned_by, device, method)
                     UNIQUE (event_id, participant_id)   -- mencegah dobel
users               (id, name, email, password_hash, role, active)
audit_logs          (id, user_id, action, entity, entity_id, detail, created_at)
```

Kunci unik `(event_id, participant_id)` di tingkat database menjamin tidak ada presensi ganda, meski dua petugas men-scan bersamaan.

## 8. Arah Desain: Supaya Terlihat Keren dan Menarik

### 8.1 Karakter visual
Modern, bersih, "dashboard event" yang terasa profesional tetapi hangat. Banyak ruang kosong, kartu dengan sudut membulat, bayangan halus, tipografi tegas.

### 8.2 Palet warna (usulan)

| Peran | Warna | Hex |
|---|---|---|
| Primer | Indigo | `#4F46E5` |
| Aksen | Cyan/teal | `#06B6D4` |
| Sukses (hadir) | Emerald | `#10B981` |
| Peringatan (sudah hadir) | Amber | `#F59E0B` |
| Error | Rose | `#F43F5E` |
| Latar terang | Slate 50 | `#F8FAFC` |
| Latar gelap | Slate 950 | `#020617` |

Gunakan gradasi lembut indigo → cyan untuk header, tombol utama, dan kartu statistik. Dukung **mode terang dan gelap** (mode gelap enak dipakai di aula yang redup).

### 8.3 Tipografi
- **Plus Jakarta Sans** atau **Inter** untuk antarmuka.
- Angka statistik besar dan tebal (tabular numbers agar tidak "loncat" saat berubah).
- **JetBrains Mono** untuk menampilkan kode peserta.

### 8.4 Layar kunci

**Dashboard**
- Kartu statistik dengan angka yang beranimasi naik (count-up) dan ikon berwarna.
- Donut atau progress ring kehadiran per kegiatan.
- Feed "Baru saja hadir" dengan avatar inisial berwarna, muncul dengan animasi geser lembut.

**Layar Scan (paling penting, harus paling mengesankan)**
- Mode layar penuh dengan latar gelap, fokus ke satu hal.
- Saat scan berhasil: seluruh layar berubah hijau lembut, **nama peserta tampil sangat besar**, lingkaran centang beranimasi, disertai bunyi. Gagal: merah dengan getar halus.
- Penghitung besar "87 / 103 hadir" dengan progress bar di bagian atas.
- Daftar scan terakhir di sisi kanan.
- Indikator status "Scanner siap" (titik hijau berdenyut) agar petugas yakin alat terhubung.

**Manajemen Kegiatan**
- Kartu kegiatan berwarna dengan badge status (Akan datang, Berlangsung dengan titik berkedip, Selesai).
- Form tambah kegiatan berbentuk panel samping (drawer), jadi admin tidak pindah halaman.

**Cetak Barcode**
- Pratinjau kartu langsung di sebelah daftar pilihan peserta.

### 8.5 Detail yang bikin terasa premium
- Sidebar yang bisa diciutkan, dengan ikon konsisten (Lucide) dan penanda menu aktif.
- Skeleton loading, bukan spinner kosong.
- Transisi 150–250 ms, tidak berlebihan.
- Empty state yang ramah dengan ilustrasi dan tombol aksi, misalnya "Belum ada kegiatan, buat yang pertama".
- Toast notifikasi non-intrusif untuk aksi admin.
- Pencarian global dengan pintasan `Ctrl/⌘ + K`.
- Responsif: layar Scan dan Dashboard nyaman di tablet dan HP.
- Aksesibilitas: kontras warna cukup, status tidak hanya dibedakan lewat warna (ada ikon dan teks), fokus keyboard terlihat.

### 8.6 Kartu barcode
Desain visual kartu **menyusul**. Dokumen ini hanya menetapkan komponennya (nama, instansi, barcode, kode) dan batasan teknisnya (bagian 5.6 dan 6). Template cetak dibuat sebagai komponen terpisah agar desain baru bisa dipasang tanpa mengubah logika.

## 9. Kebutuhan Non-Fungsional

| Aspek | Target |
|---|---|
| Kecepatan scan → hasil | ≤ 2 detik (target ≤ 500 ms di jaringan lokal) |
| Kapasitas | Minimal 1.000 peserta dan 10 scanner/petugas paralel |
| Ketersediaan | Stabil selama jam acara |
| Offline | Disarankan: scan tetap diterima saat internet putus, disimpan lokal, lalu disinkronkan otomatis |
| Keamanan | HTTPS, password ter-hash, pembatasan akses per peran |
| Privasi | Data peserta hanya nama dan instansi; patuhi UU PDP; hapus/anonimkan data setelah acara sesuai kebijakan panitia |
| Browser | Chrome, Edge, Safari versi terbaru |
| Cadangan data | Backup otomatis harian dan ekspor manual |

## 10. Teknologi dan Infrastruktur

Aplikasi memakai template **React (Vite) + FastAPI** di repo ini. Infrastruktur bersama mengikuti project **Zero-Waste**: tidak ada database, Redis, atau MinIO sendiri. Semua layanan join jaringan Docker eksternal `app-bridge`.

| Lapisan | Pilihan |
|---|---|
| Frontend | React + Vite + Tailwind (template ini) |
| Backend | FastAPI |
| Database | MySQL di container bersama `mysql-container:3306`. Database aplikasi terpisah (misalnya `rakernas`). Dari dalam Docker `DB_HOST=mysql-container`; dari host `127.0.0.1` |
| Redis | Container bersama `shared-redis` port `6378`, dengan password dan prefix kunci khusus aplikasi ini (cache, sesi, antrian, pub/sub dashboard) |
| Object storage | MinIO bersama. Container `sharedminio-minio`, DNS `minio:9000`. Bucket dan user aplikasi didaftarkan di `sharedminio` (least privilege), bukan MinIO baru di compose project ini |
| Real-time | WebSocket lewat Nginx (upgrade), didorong Redis pub/sub |
| Barcode | `bwip-js` atau `JsBarcode` (Code 128), `qrcode` (QR) |
| Scan kamera | `html5-qrcode` atau `@zxing/browser` |
| Import/Export | `xlsx` (SheetJS), PDF via `pdf-lib` atau cetak CSS |
| Grafik | Recharts |
| Gateway | Nginx dengan pola Zero-Waste |

### 10.1 MySQL
- Service compose project ini **tidak** menjalankan MySQL.
- Adminer (jika dipakai) mengarah ke `mysql-container`, sama seperti template.
- Migrasi (Alembic) membuat tabel di database milik aplikasi ini saja.

### 10.2 Redis
- Dev dan prod memakai `shared-redis`, bukan container Redis lokal.
- Contoh: `REDIS_HOST=shared-redis`, `REDIS_PORT=6378`, plus password dan prefix agar kunci tidak bentrok dengan Zero-Waste atau project lain.

### 10.3 MinIO bersama
Mengikuti `D:\Portofolio\DPUPK\sharedminio` dan pemakaian di Zero-Waste:

- Endpoint aplikasi: `http://minio:9000` (path-style).
- Dua bucket, misalnya `rakernas-documents` (privat) dan `rakernas-public-documents` (baca publik).
- User aplikasi sendiri (access key / secret), policy read-write hanya pada kedua bucket itu. Root MinIO tidak dipakai di kode aplikasi.
- Pendaftaran bucket, policy, dan user ditambahkan di skrip init `sharedminio` (idempotent), lalu kredensial disalin ke `.env` aplikasi.
- File publik (misalnya aset kartu) dilayani Nginx lewat path `/storage/` → `http://minio:9000/<bucket-publik>/`, dengan `Host: minio`.

### 10.4 Nginx
Pola sama dengan Zero-Waste (`deploy/nginx/`):

- **Dev:** container Nginx project ini, port host sendiri (bukan 80 milik gateway global, dan bukan 8081 milik Zero-Waste). Mem-proxy frontend Vite, API FastAPI, WebSocket, dan `/storage/`.
- **Prod:** aplikasi tidak membuka 80/443. Vhost disalin ke `global_nginx_proxy` (`server_name` domain project ini saja). `proxy_pass` ke nama container di `app-bridge`. `X-Forwarded-Proto` mengikuti header dari TLS/Cloudflare, tidak ditimpa `$scheme` dari listen 80.

Bila jaringan di lokasi tidak stabil, stack yang sama (termasuk container bersama) bisa dijalankan di laptop panitia dan diakses petugas lewat Wi-Fi sendiri.

## 11. Alur Penggunaan Utama

1. Admin import Excel → 103 peserta masuk.
2. Admin membuat kegiatan: Registrasi, Pembukaan, Sidang, dan seterusnya.
3. Admin membuka **Cetak Barcode**, memilih semua peserta, lalu mencetak.
4. Hari H: petugas login di perangkat, memilih kegiatan, lalu mulai scan.
5. Panitia memantau dashboard; saat acara selesai, admin mengekspor laporan.

## 12. Kriteria Penerimaan (MVP)

- [ ] Import Excel contoh berhasil: 103 peserta, 64 instansi, tanpa error.
- [ ] Admin bisa menambah, mengubah, dan mengarsipkan kegiatan.
- [ ] Scan barcode dengan scanner USB mencatat kehadiran dan menampilkan hasil dalam ≤ 2 detik.
- [ ] Scan kedua pada kegiatan yang sama tidak membuat data ganda.
- [ ] Scan di kegiatan berbeda tercatat terpisah untuk peserta yang sama.
- [ ] Dashboard ter-update otomatis tanpa refresh.
- [ ] Menu Cetak Barcode menghasilkan PDF berisi nama, instansi, dan barcode yang terbaca scanner.
- [ ] Nama 42 karakter dan instansi 73 karakter tampil utuh di kartu.
- [ ] Ekspor laporan kehadiran per kegiatan ke Excel.
- [ ] Petugas Scan tidak dapat membuka menu Admin.

## 13. Rencana Tahapan

| Fase | Isi | Perkiraan |
|---|---|---|
| 1 | Setup, login, peran, import peserta, tabel peserta | 3–4 hari |
| 2 | Kegiatan dinamis (CRUD) dan model presensi | 3 hari |
| 3 | Layar Scan (scanner USB, kamera, manual, feedback suara dan visual) | 4–5 hari |
| 4 | Dashboard live, laporan, ekspor | 3–4 hari |
| 5 | Cetak Barcode (struktur dan pratinjau; desain menyusul) | 2–3 hari |
| 6 | Polesan UI, mode offline, uji coba lapangan | 3–4 hari |

## 14. Pertanyaan Terbuka

1. **Selisih 103 vs 104 peserta.** Apakah satu peserta (mungkin yang berstatus Ditolak) memang tidak diekspor?
2. **Status verifikasi.** Peserta berstatus Menunggu Verifikasi, Tunda Bayar, atau Ditolak: boleh scan, ditolak, atau diberi peringatan? Jika perlu dibedakan, tambahkan kolom `Status` di Excel.
3. Berapa jumlah **kegiatan** dan **pintu scan** yang diperkirakan, dan berapa **alat scanner** yang tersedia (USB, Bluetooth, atau hanya kamera HP)?
4. Apakah **jaringan di lokasi acara stabil**, atau perlu mode offline/server lokal?
5. Apakah kegiatan tertentu hanya untuk **sebagian peserta** (misalnya sidang komisi per kelompok)?
6. **Ukuran kartu dan kertas** yang akan dipakai untuk cetak, dan apakah memakai printer label?
7. Apakah ada **peserta on-site** yang belum terdaftar, sehingga perlu fitur tambah peserta cepat dan cetak langsung di lokasi?
8. Perlu **kuota/pembatasan** per kegiatan (misalnya makan siang hanya sekali)?

## 15. Risiko dan Mitigasi

| Risiko | Mitigasi |
|---|---|
| Barcode tidak terbaca (cetak buram, terlalu kecil) | Uji baca sebelum cetak massal, ukuran minimum dan quiet zone, siapkan input manual |
| Internet putus saat acara | Mode offline dengan sinkronisasi, atau server lokal |
| Antrean menumpuk di pintu | Beberapa pintu scan paralel, hasil scan cepat, debounce |
| Data ganda | Unique constraint di database |
| Nama/instansi terlalu panjang di kartu | Wrap dan auto-shrink, uji dengan data terpanjang |
| Data pribadi bocor | Akses berbasis peran, HTTPS, minimalkan data |
