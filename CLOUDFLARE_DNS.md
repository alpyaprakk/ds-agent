# Cloudflare DNS Ayarları - ds-agent.alpy.io

## 🌐 Cloudflare'de Girmeniz Gereken DNS Bilgileri

### A Record Ekle

Cloudflare Dashboard → `alpy.io` domain → DNS sekmesi → Add record

| Alan | Değer |
|------|-------|
| **Type** | `A` |
| **Name** | `ds-agent` |
| **IPv4 address** | `[DOKPLOY_SERVER_IP_ADRESI]` |
| **Proxy status** | ✅ Proxied (Orange cloud) |
| **TTL** | `Auto` |

### Görsel Talimat:

```
┌─────────────────────────────────────────────┐
│ Add DNS Record                              │
├─────────────────────────────────────────────┤
│ Type:     [A ▼]                            │
│                                             │
│ Name:     ds-agent                         │
│           (@)                               │
│                                             │
│ IPv4:     [Dokploy server IP buraya]      │
│                                             │
│ Proxy:    🟠 Proxied   ⚫ DNS only         │
│           ^            ^                    │
│         BUNU SEÇİN   (bunu değil)          │
│                                             │
│ TTL:      Auto ▼                           │
│                                             │
│           [Save] [Cancel]                  │
└─────────────────────────────────────────────┘
```

## 📋 Adım Adım

### 1. Cloudflare'e Giriş
- https://dash.cloudflare.com adresine gidin
- Giriş yapın

### 2. Domain Seçimi
- `alpy.io` domain'ine tıklayın

### 3. DNS Sekmesi
- Sol menüden **DNS** → **Records** seçin

### 4. Record Ekleme
- Sağ üstteki **Add record** butonuna tıklayın

### 5. Bilgileri Girin
- **Type**: `A` seçin (dropdown'dan)
- **Name**: `ds-agent` yazın
- **IPv4 address**: Dokploy sunucunuzun IP adresini yazın
- **Proxy status**: 🟠 **Proxied** seçin (Orange cloud aktif olsun)
- **TTL**: `Auto` bırakın

### 6. Kaydet
- **Save** butonuna tıklayın

## 🔍 Dokploy Server IP Adresini Bulma

Dokploy sunucu IP adresinizi bulmak için:

1. **Dokploy Dashboard**'a giriş yapın
2. **Settings** veya **Server Info** bölümüne gidin
3. **Public IP** adresini kopyalayın

Veya SSH ile bağlanıp:
```bash
curl ifconfig.me
```

## ✅ Doğrulama

DNS kaydı ekledikten sonra (1-5 dakika bekleyin), doğrulayın:

```bash
# Terminal'de (macOS/Linux)
nslookup ds-agent.alpy.io

# Veya
dig ds-agent.alpy.io
```

Beklenen çıktı:
```
Name:    ds-agent.alpy.io
Address: [DOKPLOY_SERVER_IP]
```

## 🎯 Sonuç

DNS kaydı başarıyla eklendikten ve propagation tamamlandıktan sonra:

- ✅ **ds-agent.alpy.io** → Dashboard (Frontend)
- ✅ **ds-agent.alpy.io/api** → API (Backend)
- ✅ **ds-agent.alpy.io/socket.io** → WebSocket

---

**Not**: Proxy (🟠) aktif olduğu için:
- Cloudflare SSL/TLS otomatik çalışır
- DDoS koruması aktif olur
- CDN üzerinden hızlı erişim sağlanır
