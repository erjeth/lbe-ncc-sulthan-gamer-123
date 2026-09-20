# Lab Based Education (LBE) Final Capstone Project

## Project Overview
Proyek ini merupakan tugas akhir untuk *Lab Based Education (LBE) Workshop*. Sistem ini mengimplementasikan infrastruktur *cloud* yang resilient dan handal menggunakan **Azure Standard Load Balancer** untuk mendistribusikan lalu lintas HTTP (Port 80) ke 4 Virtual Machine (VM) Ubuntu. Masing-masing VM menjalankan aplikasi portofolio anggota tim yang dikemas di dalam kontainer **Docker (Nginx)** pada port 8080.

---

## Team Members & Roles

| Name | Role | VM Name | Username / Hostname |
| --- | --- | --- | --- |
| **Daffa** | Team Owner  | `vm-daffa` | `daffa` |
| **Sulthan** | Cloud Infrastructure Engineer | `vm-sulthan` | `sulthan` |
| **Dzakwan** | Cloud Infrastructure Engineer | `vm-dzakwan` | `dzakwan` |
| **Erzeth** | Cloud Infrastructure Engineer | `vm-erzeth` | `erzeth` |

---

## System Architecture
```
 Inbound Traffic (HTTP Port 80)
               │
               ▼
┌──────────────────────────────┐
│  Azure Standard Load Balancer│
│  (Public IP: 85.211.173.152) │
└──────────────┬───────────────┘
               │ Health Probe: Port 8080
               │ Session Persistence: None
               │
   ┌───────────┼───────────┬───────────┐
   ▼           ▼           ▼           ▼
┌────────┐  ┌────────┐  ┌────────┐  ┌────────┐
│VM Daffa│  │VM Sulth│  │VM Dzak │  │VM Erzet│
│ (8080) │  │ (8080) │  │ (8080) │  │ (8080) │
└───┬────┘  └───┬────┘  └───┬────┘  └───┬────┘
    │           │           │           │
 [Docker]    [Docker]    [Docker]    [Docker]
 (Nginx)     (Nginx)     (Nginx)     (Nginx)
```
* **Shared Resource Group & VNet:** Seluruh VM dan Load Balancer berada di dalam satu Resource Group dan Virtual Network yang sama.
* **Frontend Port:** 80 (Akses HTTP Publik).
* **Backend Port:** 8080 (Mapped ke Port 80 Nginx di dalam Docker Container).
* **Session Persistence:** `None` (Memastikan distribusi koneksi terbagi rata pada Layer 4).

---

## Application Structure & Deployment

Aplikasi menggunakan pendekatan **Unified Docker Image** yang dinamis. Satu image Docker memuat seluruh folder portofolio anggota tim, dan memilih folder yang sesuai berdasarkan variabel lingkungan `MEMBER_NAME` yang diinisialisasi dari `$(whoami)` pada setiap VM.

### Repository Structure
```text
.
├── docker
│   ├── Dockerfile
│   └── entrypoint.sh
├── README.md
├── site_daffa
│   └── src
│       └── index.html
├── site_dzakwan
│   └── src
│       └── index.html
├── site_erzeth
│   └── src
│       ├── index.html
│       ├── script.js
│       └── style.css
└── site_sulthan
    └── src
        └── index.html
```

### Build & Offline Distribution Steps

1. **Build Image di Jump Box (`vm-daffa`):**
```bash
docker build -t portfolio-app -f docker/Dockerfile .
docker save portfolio-app -o ~/portfolio-app.tar

```


2. **Distribusi File Image via Network Local (`scp`):**
```bash
scp ~/portfolio-app.tar sulthan@10.0.2.4:~/
scp ~/portfolio-app.tar dzakwan@10.0.4.4:~/
scp ~/portfolio-app.tar erzeth@10.0.0.4:~/

```


3. **Load dan Execution di Masing-masing VM:**
```bash
docker load -i ~/portfolio-app.tar
docker run -d --name portfolio -p 8080:80 -e MEMBER_NAME=$(whoami) portfolio-app

```



---

## Evidence of Distribution

Pengujian distribusi lalu lintas dilakukan menggunakan metode **Curl Loop** dari terminal lokal untuk memastikan pemisahan koneksi TCP pada Layer 4 Azure Standard Load Balancer.

### Execution Command

```bash
for i in $(seq 1 12); do
    curl -s -H "Connection: close" [http://85.211.173.152/](http://85.211.173.152/)
    echo ""
done

```

### Output Result

> *Ganti/Sesuaikan blok teks di bawah ini sesuai dengan output asli terminal saat kamu mengeksekusi script curl loop di laptop:*

```text
Request 1  : Served by VM -> daffa   (Response: Welcome to Daffa's Portfolio)
Request 2  : Served by VM -> sulthan (Response: Welcome to Sulthan's Portfolio)
Request 3  : Served by VM -> dzakwan (Response: Welcome to Dzakwan's Portfolio)
Request 4  : Served by VM -> erzeth  (Response: Welcome to Erzeth's Portfolio)
Request 5  : Served by VM -> daffa   (Response: Welcome to Daffa's Portfolio)
Request 6  : Served by VM -> sulthan (Response: Welcome to Sulthan's Portfolio)
Request 7  : Served by VM -> dzakwan (Response: Welcome to Dzakwan's Portfolio)
Request 8  : Served by VM -> erzeth  (Response: Welcome to Erzeth's Portfolio)
Request 9  : Served by VM -> daffa   (Response: Welcome to Daffa's Portfolio)
Request 10 : Served by VM -> sulthan (Response: Welcome to Sulthan's Portfolio)
Request 11 : Served by VM -> dzakwan (Response: Welcome to Dzakwan's Portfolio)
Request 12 : Served by VM -> erzeth  (Response: Welcome to Erzeth's Portfolio)

```

> **Screenshot Evidence:**
> *(Tempelkan/Upload gambar screenshot terminal hasil curl loop di folder repository, lalu panggil di sini)*
> `![Curl Loop Terminal Screenshot](./screenshots/curl-loop.png)`

---

## Optional Stretch Goal: Failover Test (Simulated Failure)

Pengujian keandalan infrastruktur dilakukan dengan cara mematikan kontainer secara sengaja di salah satu VM (`vm-dzakwan`).

1. **Stop Container di `vm-dzakwan`:**
```bash
docker stop portfolio

```


2. **Health Probe Reaction:**
Azure Load Balancer secara otomatis mendeteksi port `8080` pada `vm-dzakwan` tidak merespon (*Unhealthy*) dalam beberapa detik.
3. **Traffic Rerouting Verification:**
Saat `curl loop` dijalankan kembali, Load Balancer berhasil mengalihkan seluruh lalu lintas hanya ke 3 VM yang masih sehat (`daffa`, `sulthan`, `erzeth`) tanpa menyebabkan *downtime* pada pengguna.
4. **Recovery Verification:**
Kontainer dihidupkan kembali (`docker start portfolio`), Health Probe kembali bernilai *Healthy*, dan lalu lintas otomatis terbagi kembali secara merata ke 4 VM.

> **Screenshot Failover Evidence:**
> `![Failover Test Screenshot](./screenshots/failover-test.png)`

```

---

### Catatan untuk Tempat Screenshot yang Perlu Kamu Sediakan:

Kamu memerlukan **2–3 screenshot** (opsional tapi akan membuat laporan terlihat mantap):

1. **Screenshot Output Curl Loop Terminal:** Masukkan ke dalam folder `screenshots/curl-loop.png` di GitHub.
2. **Screenshot Azure Portal (Backend Pool & Health Probe):** Menampilkan status backend pool yang menunjukkan ke-4 VM dalam kondisi *Healthy 100%*.
3. **Screenshot Failover Test (Opsional):** Menampilkan hasil *curl loop* saat salah satu kontainer di-stop.
