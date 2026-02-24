# DS Agent Deployment Guide

Bu döküman, DS Agent projesinin Dokploy üzerinden **ds-agent.alpy.io** domain'i ile nasıl deploy edileceğini anlatır.

## 📋 Gereksinimler

- Dokploy hesabı ve kurulu server
- Cloudflare hesabı (DNS yönetimi için)
- PostgreSQL veritabanı erişimi
- Docker ve Docker Compose kurulu server

## 🚀 Deployment Adımları

### 1. Repository Hazırlığı

Projeyi Git repository'sine push edin:

```bash
git init
git add .
git commit -m "Initial deployment setup"
git remote add origin <your-repo-url>
git push -u origin main
```

### 2. Environment Variables Ayarlama

`.env` dosyası oluşturun (`.env.example` dosyasından kopyalayın):

```bash
cp .env.example .env
```

`.env` dosyasını düzenleyin:

```env
# Database Configuration
POSTGRES_DB=dsagent
POSTGRES_USER=dsagent
POSTGRES_PASSWORD=your_strong_password_here

# Server Configuration
NODE_ENV=production
PORT=3000
CORS_ORIGIN=https://ds-agent.alpy.io

# Frontend URLs
VITE_API_URL=https://ds-agent.alpy.io/api
VITE_WS_URL=https://ds-agent.alpy.io
```

### 3. Dokploy'da Proje Oluşturma

1. Dokploy dashboard'a giriş yapın
2. **New Project** butonuna tıklayın
3. **Repository URL** girin
4. **Branch** olarak `main` seçin
5. **Build Configuration**:
  - Build Command: `npm run build`
  - Docker Compose: Enabled
  - Docker Compose File: `docker-compose.yml`

### 4. Dokploy Environment Variables

Dokploy'da aşağıdaki environment variable'ları ekleyin:


| Key                 | Value                          | Example                        |
| ------------------- | ------------------------------ | ------------------------------ |
| `POSTGRES_PASSWORD` | Database şifreniz              | `your_strong_password`         |
| `POSTGRES_DB`       | `dsagent`                      | `dsagent`                      |
| `POSTGRES_USER`     | `dsagent`                      | `dsagent`                      |
| `CORS_ORIGIN`       | `https://ds-agent.alpy.io`     | `https://ds-agent.alpy.io`     |
| `VITE_API_URL`      | `https://ds-agent.alpy.io/api` | `https://ds-agent.alpy.io/api` |
| `VITE_WS_URL`       | `https://ds-agent.alpy.io`     | `https://ds-agent.alpy.io`     |


### 5. Port Configuration

Dokploy'da port ayarlarını yapın:

- **HTTP Port**: 80 → Container Port 80 (Dashboard)
- **WebSocket Port**: 3000 → Container Port 3000 (Server)

### 6. Deploy

Dokploy'da **Deploy** butonuna tıklayın. İlk deployment 3-5 dakika sürebilir.

## 🌐 DNS Ayarları (Cloudflare)

### Cloudflare'de Yapılması Gerekenler

Cloudflare dashboard'a giriş yapın ve `alpy.io` domain'i için aşağıdaki DNS kayıtlarını ekleyin:

#### A Record (Ana Domain)


| Type | Name       | Content               | Proxy Status | TTL  |
| ---- | ---------- | --------------------- | ------------ | ---- |
| `A`  | `ds-agent` | `<DOKPLOY_SERVER_IP>` | Proxied (🟠) | Auto |


#### CNAME Record (Alternatif - Eğer Dokploy domain sağlıyorsa)


| Type    | Name       | Target                    | Proxy Status | TTL  |
| ------- | ---------- | ------------------------- | ------------ | ---- |
| `CNAME` | `ds-agent` | `your-dokploy-domain.com` | Proxied (🟠) | Auto |


### DNS Ayar Adımları

1. **Cloudflare Dashboard** → `alpy.io` domain seçin
2. **DNS** sekmesine tıklayın
3. **Add record** butonuna tıklayın
4. Yukarıdaki bilgilere göre kaydı oluşturun:
  - **Type**: `A`
  - **Name**: `ds-agent`
  - **IPv4 address**: Dokploy sunucunuzun IP adresi
  - **Proxy status**: ✅ Proxied (Orange cloud aktif)
  - **TTL**: Auto
5. **Save** butonuna tıklayın

### SSL/TLS Ayarları

1. **SSL/TLS** sekmesine gidin
2. **Encryption mode**: `Full (strict)` seçin
3. **Edge Certificates** → **Always Use HTTPS**: ✅ Enable

### Cloudflare Settings (Önerilen)

**Security:**

- **Security Level**: Medium
- **Bot Fight Mode**: ✅ Enable
- **Challenge Passage**: 30 minutes

**Speed:**

- **Auto Minify**: HTML, CSS, JavaScript ✅
- **Brotli**: ✅ Enable

**Caching:**

- **Caching Level**: Standard
- **Browser Cache TTL**: 4 hours

## 🔍 DNS Propagation Kontrolü

DNS değişikliklerinin yayılıp yayılmadığını kontrol edin:

```bash
# macOS/Linux
nslookup ds-agent.alpy.io

# veya
dig ds-agent.alpy.io

# Windows
nslookup ds-agent.alpy.io
```

Beklenen sonuç:

```
Name:    ds-agent.alpy.io
Address: <DOKPLOY_SERVER_IP>
```

DNS propagation genelde 1-5 dakika sürer, ancak bazı durumlarda 24 saate kadar çıkabilir.

## ✅ Deployment Verification

Deploy tamamlandıktan sonra test edin:

### 1. Web UI Test

```
https://ds-agent.alpy.io
```

Tarayıcıda açın ve dashboard'un yüklendiğini kontrol edin.

### 2. API Health Check

```bash
curl https://ds-agent.alpy.io/api/health
```

Beklenen response:

```json
{
  "status": "ok",
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

### 3. WebSocket Test

Tarayıcı console'da:

```javascript
const ws = new WebSocket('wss://ds-agent.alpy.io/socket.io/?EIO=4&transport=websocket');
ws.onopen = () => console.log('Connected!');
```

## 🔧 Troubleshooting

### Problem: "502 Bad Gateway"

**Çözüm:**

```bash
# Server container'larını kontrol edin
docker ps

# Server loglarını inceleyin
docker logs ds-agent-server

# Container'ları yeniden başlatın
docker-compose restart
```

### Problem: "Database Connection Error"

**Çözüm:**

```bash
# PostgreSQL container'ının çalıştığını kontrol edin
docker ps | grep postgres

# Database loglarını inceleyin
docker logs ds-agent-postgres

# Database şifresinin doğru olduğunu kontrol edin
echo $POSTGRES_PASSWORD
```

### Problem: "CORS Error"

**Çözüm:**
`.env` dosyasında `CORS_ORIGIN` değerini kontrol edin:

```env
CORS_ORIGIN=https://ds-agent.alpy.io
```

### Problem: "WebSocket Connection Failed"

**Çözüm:**

1. Cloudflare'de **WebSocket** support'unun aktif olduğunu kontrol edin
2. nginx.conf'da WebSocket proxy ayarlarını kontrol edin
3. Server loglarında WebSocket hatalarını inceleyin

## 📊 Monitoring

### Container Durumu

```bash
docker-compose ps
```

### Logs

```bash
# Tüm servislerin loglarını görüntüle
docker-compose logs -f

# Sadece server logs
docker-compose logs -f server

# Sadece dashboard logs
docker-compose logs -f dashboard

# Sadece database logs
docker-compose logs -f postgres
```

### Resource Usage

```bash
docker stats
```

## 🔄 Update/Redeploy

Kod değişikliklerinden sonra yeniden deploy etmek için:

```bash
# Dokploy'da
1. Repository'yi güncelleyin (git push)
2. Dokploy dashboard'da "Redeploy" butonuna tıklayın

# Manuel olarak (SSH ile server'a bağlanarak)
git pull
docker-compose down
docker-compose build --no-cache
docker-compose up -d
```

## 📝 Önemli Notlar

1. **Database Backup**: Düzenli olarak PostgreSQL backup alın
  ```bash
   docker exec ds-agent-postgres pg_dump -U dsagent dsagent > backup.sql
  ```
2. **Environment Variables**: Hassas bilgileri asla git'e commit etmeyin
3. **SSL Certificate**: Cloudflare otomatik SSL sağlar, ekstra konfigürasyon gerekmez
4. **Domain Değişikliği**: Domain değiştirirseniz şu dosyaları güncelleyin:
  - `.env` (CORS_ORIGIN, VITE_API_URL, VITE_WS_URL)
  - Cloudflare DNS records
  - Dokploy environment variables

## 🆘 Destek

Sorun yaşarsanız:

1. Dokploy logs kontrol edin
2. Container logs kontrol edin
3. DNS propagation kontrolü yapın
4. Cloudflare settings kontrol edin

---

**Domain**: [https://ds-agent.alpy.io](https://ds-agent.alpy.io)
**API**: [https://ds-agent.alpy.io/api](https://ds-agent.alpy.io/api)
**WebSocket**: wss://ds-agent.alpy.io/socket.io