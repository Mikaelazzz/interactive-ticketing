# 🎫 Interactive Ticketing (Sistem Antrian Interaktif Rumah Sakit)

Proyek ini adalah implementasi sistem antrian rumah sakit modern, dirancang untuk memfasilitasi pendaftaran pasien, manajemen antrian oleh staf, dan tampilan monitor real-time, menggunakan arsitektur *microservice-like* dengan backend Go dan frontend Next.js/React.

-----

## 🌟 Fitur Utama

Sistem ini dirancang untuk empat peran utama (Patient, Staff, Doctor, Monitor), masing-masing dengan fungsionalitas real-time melalui WebSocket.

### 1\. Portal Pasien (`/patient`)

  * **Pendaftaran Antrian:** Pasien mengisi formulir pendaftaran untuk mendapatkan nomor antrian.
  * **Penomoran Otomatis:** Nomor antrian dibuat secara otomatis dengan prefix berdasarkan poli/spesialisasi (`A-xxx` untuk Poli Umum, `B-xxx` untuk Poli Gigi, dst.).
  * **Penugasan Loket:** Loket (`1` hingga `4`) secara otomatis ditetapkan berdasarkan poli yang dipilih.
  * **Monitoring Real-time:** Setelah mendaftar, pasien dapat memantau status antrian mereka (*Menunggu*, *Dipanggil*, *Selesai*) secara real-time menggunakan **WebSocket**.
  * **Pengecekan Antrian Aktif:** Mencegah pasien membuat antrian baru jika mereka sudah memiliki antrian yang masih *Menunggu* atau *Dipanggil*.
  * **Data Otomatis:** Backend Go akan secara otomatis mengisi data pelengkap pasien seperti Email, Tanggal Lahir, dan Alamat Indonesia acak jika tidak disediakan saat pendaftaran.

### 2\. Portal Staff (`/staff/loket/[id]`)

  * **Manajemen Loket:** Staf memilih loket spesifik (misalnya Loket 1) untuk dikelola.
  * **Pembaruan Real-time:** Mendapatkan daftar antrian loket secara real-time menggunakan **WebSocket**.
  * **Aksi Antrian Cepat:** Staf dapat melakukan tiga aksi utama:
      * **Panggil Berikutnya:** Menyelesaikan antrian yang sedang dipanggil (jika ada) dan memanggil pasien yang berada di urutan *Menunggu* berikutnya. Status pasien berubah menjadi `called`.
      * **Selesai:** Menandai antrian yang sedang dipanggil sebagai `completed`.
      * **Ulangi (Recall):** Memicu ulang pengumuman suara (TTS) untuk antrian yang sedang dipanggil tanpa mengubah status.
  * **Statistik Loket:** Melihat ringkasan antrian saat ini (Selesai, Menunggu, Dipanggil).

### 3\. Monitor Utama (`/monitor`)

  * **Tampilan Publik:** Layar monitor utama untuk menampilkan nomor antrian yang sedang dipanggil di setiap loket.
  * **Pengumuman Suara (TTS):** Menggunakan fitur **Text-to-Speech (TTS)** browser dengan bahasa Indonesia (`id-ID`) untuk mengumumkan nomor antrian yang dipanggil.
  * **Real-time:** Tampilan antrian diperbarui secara instan melalui **WebSocket** ketika staf memanggil antrian baru atau mengulang panggilan.

-----

## 🛠️ Tumpukan Teknologi

Proyek ini terbagi menjadi dua bagian utama: Backend dan Frontend.

### Backend (Go)

| Teknologi | Keterangan |
| :--- | :--- |
| **Bahasa** | Go (Golang) |
| **Web Framework** | Gorilla Mux untuk routing HTTP |
| **Real-time** | Gorilla WebSocket untuk komunikasi real-time |
| **Data Storage** | Menyimpan data pasien ke file `patients.json` secara lokal |
| **Data Structure** | Menggunakan `sync.RWMutex` dan `sync.Mutex` untuk manajemen konkurensi data antrian |

### Frontend (Next.js)

| Teknologi | Keterangan |
| :--- | :--- |
| **Framework** | Next.js (version 16.0.1) |
| **Library** | React (version 19.2.0) |
| **Bahasa** | TypeScript |
| **Styling** | Tailwind CSS |

-----

## ⚙️ Instalasi dan Setup

Proyek ini memerlukan dua terminal terpisah untuk menjalankan backend Go dan frontend Next.js.

### Persyaratan

  * Go (Golang)
  * Node.js (termasuk npm/yarn)

### Langkah-langkah

1.  **Clone Repositori:**

    ```bash
    git clone <URL_REPO>
    cd interactive-ticketing
    ```

2.  **Setup Backend (API Server):**

    ```bash
    cd Back-End
    go mod tidy
    go run main.go
    ```

    *Server akan berjalan di `http://localhost:8080`.*

3.  **Setup Frontend (Web Client):**
    Buka terminal baru.

    ```bash
    cd Front-End
    npm install
    npm run dev
    ```

    *Aplikasi frontend akan berjalan di `http://localhost:3000` (atau port default Next.js Anda).*

-----

## 🌐 API Endpoints

Berikut adalah beberapa *endpoints* utama yang diekspos oleh backend Go:

| Metode | Jalur | Deskripsi |
| :--- | :--- | :--- |
| `GET` | `/api/patients` | Mendapatkan semua data pasien. |
| `POST` | `/api/patients` | Membuat antrian pasien baru. |
| `PUT` | `/api/patients/{id}` | Memperbarui detail atau status pasien. |
| `POST` | `/api/patients/{id}/recall` | Memicu pengumuman ulang nomor antrian. |
| `GET` | `/api/patients/check/{name}` | Memeriksa apakah pasien memiliki antrian aktif. |
| `GET` | `/api/stats` | Mendapatkan statistik total antrian. |
| `POST` | `/api/reset` | **Mengatur ulang** semua data antrian. |
| `WS` | `/ws/loket/{loket}` | Koneksi WebSocket untuk pembaruan real-time loket. |
