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
![load balancer](docs/healthy-backend-pool.png)
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
├── app
│   ├── Dockerfile
│   ├── entrypoint.sh
│   └── src
│       ├── daffa
│       │   ├── assets
│       │   │   └── gw-pas-masih-ganteng.jpg
│       │   └── src
│       │       └── index.html
│       ├── dzakwan
│       │   └── src
│       │       └── index.html
│       ├── erzeth
│       │   └── src
│       │       ├── index.html
│       │       ├── script.js
│       │       └── style.css
│       └── sulthan
│           └── src
│               └── index.html
├── docs
│   ├── healthy-backend-pool.png
│   ├── healthy-curl-loop-output.jpeg
│   ├── one-vm-down-backend-pool.jpeg
│   └── one-vm-down-curl-loop-output.jpeg
└── README.md
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
for i in $(seq 1 52); do     
    curl -s -H "Connection: close" http://85.211.173.152/config.js;     
    echo ""; 
done

```

### Output Result

![Curl Loop Terminal Screenshot](docs/healthy-curl-loop-output.jpeg)

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

**Screenshot Failover Evidence:**
![Failover Test Screenshot 1](docs/one-vm-down-backend-pool.jpeg)

![Failover Test Screenshot 2](docs/one-vm-down-curl-loop-output.jpeg)

Screenshot diatas menunjukkan jika salah satu vm sudah mati, tetapi vm lain masih bisa diakses melalui Load Balancer.

---

**CI/CD Evidence – Docker Hub Push**
![push portfolio-app](docs\portfolio-app.jpeg)

![build-and-push-success](docs\Build_and_push_success.png)

Screenshot diatas menunjukkan github action sudah berhasil push ke docker hub.

---