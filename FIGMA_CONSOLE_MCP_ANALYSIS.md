# Figma Console MCP - Kapsamlı Analiz ve Karşılaştırma Raporu

**Tarih:** 2026-03-01
**Analiz Eden:** Claude Code
**Hedef:** DS-Agent (Tokenhaus) için eksik özelliklerin belirlenmesi

---

## 📋 Executive Summary

**Figma Console MCP** 56+ araç ile en kapsamlı Figma-AI entegrasyonunu sunuyor. Tokenhaus MCP'miz şu anda 11 araç ile çalışıyor ve **kritik eksiklikler** var.

### Ana Fark

| Özellik | Tokenhaus MCP | Figma Console MCP | Durum |
|---------|---------------|-------------------|-------|
| **Toplam Araç Sayısı** | 11 | 56+ | ❌ 80% eksik |
| **Design Creation** | ✅ Layered (componentRef destekli) | ✅ Power Tool (figma_execute) | ⚠️ Farklı yaklaşım |
| **Code Generation** | ❌ YOK | ✅ Dev Mode export | ❌ KRİTİK EKSİK |
| **Component Instantiation** | ❌ YOK | ✅ Var | ❌ EKSİK |
| **Node Manipulation** | ❌ YOK | ✅ 10+ araç | ❌ EKSİK |
| **Screenshot** | ❌ YOK | ✅ Var | ❌ EKSİK |
| **Console Debugging** | ❌ YOK | ✅ Var | ❌ EKSİK |
| **Design-Code Parity** | ❌ YOK | ✅ Var | ❌ KRİTİK EKSİK |
| **MCP Apps (UI)** | ❌ YOK | ✅ 2 app | ❌ EKSİK |
| **Multi-File Support** | ❌ Belirsiz | ✅ Tam destek | ⚠️ TEST EDİLMELİ |

---

## 🎯 Figma Console MCP - Tam Özellik Listesi

### 1. **Navigation & Status** (2 araç)

```typescript
1. figma_navigate         // Figma URL'lerini aç
2. figma_get_status       // Bağlantı durumunu kontrol et
```

### 2. **Console Debugging** (4 araç)

```typescript
3. figma_get_console_logs   // Console loglarını getir
4. figma_watch_console      // Real-time log streaming
5. figma_clear_console      // Log buffer'ı temizle
6. figma_reload_plugin      // Plugin'i reload et
```

### 3. **Visual Debugging** (1 araç)

```typescript
7. figma_take_screenshot    // UI screenshot'ı al
```

### 4. **Design System Extraction** (8 araç)

```typescript
8.  figma_get_variables                    // Design tokens/variables
9.  figma_get_component                    // Component data (metadata/reconstruction)
10. figma_get_component_for_development    // Component + image
11. figma_get_component_image              // Sadece image
12. figma_get_styles                       // Color, text, effect styles
13. figma_get_file_data                    // Full file structure
14. figma_get_file_for_plugin              // Optimized file data
15. figma_search_components                // Component ara
```

### 5. **Design Creation** (3 araç) ⚡ POWER TOOLS

```typescript
16. figma_execute                  // POWER TOOL: Arbitrary Figma Plugin API code çalıştır
17. figma_arrange_component_set    // Variant'ları organize et, purple dashed border ekle
18. figma_set_description          // Component/style description ekle
```

**`figma_execute` - Bu Çok Önemli!**
- Herhangi bir Figma Plugin API kodunu çalıştırabilir
- Frame, shape, text, component oluşturabilir
- Auto-layout, styles, effects uygulayabilir
- Tam UI mockup'ları programatik olarak oluşturabilir

### 6. **Variable Management** (11 araç) 🔥

```typescript
19. figma_create_variable_collection   // Yeni collection oluştur
20. figma_create_variable              // COLOR, FLOAT, STRING, BOOLEAN
21. figma_update_variable              // Variable değeri güncelle
22. figma_rename_variable              // Variable'ı yeniden adlandır
23. figma_delete_variable              // Variable sil
24. figma_delete_variable_collection   // Collection sil
25. figma_add_mode                     // Mode ekle (Dark, Mobile vb.)
26. figma_rename_mode                  // Mode yeniden adlandır
27. figma_batch_create_variables       // 100 variable'a kadar tek seferde (10-50x hızlı!)
28. figma_batch_update_variables       // 100 güncelleme tek seferde
29. figma_setup_design_tokens          // Complete token system atomically
```

### 7. **Node Manipulation** (10 araç)

```typescript
30. figma_resize_node              // Node'u resize et
31. figma_move_node                // Node'u hareket ettir
32. figma_set_node_fills           // Fill (colors) ayarla
33. figma_set_node_strokes         // Stroke ayarla
34. figma_set_node_opacity         // Opacity ayarla
35. figma_set_node_corner_radius   // Corner radius ayarla
36. figma_clone_node               // Node'u kopyala
37. figma_delete_node              // Node sil
38. figma_rename_node              // Node yeniden adlandır
39. figma_set_text_content         // Text içeriği değiştir
40. figma_create_child_node        // Yeni child node oluştur
```

### 8. **Component Operations** (7 araç)

```typescript
41. figma_instantiate_component         // Component instance oluştur (variant seçimi ile)
42. figma_add_component_property        // Component property ekle
43. figma_edit_component_property       // Property değiştir
44. figma_delete_component_property     // Property sil
45. figma_set_instance_properties       // Instance property'lerini güncelle
46. figma_get_local_components          // Tüm local component'leri getir
47. figma_set_node_description          // Description ekle
```

### 9. **Design-Code Parity** (2 araç) 🎯 ÇOK ÖNEMLİ

```typescript
48. figma_check_design_parity       // Figma vs Code karşılaştırma, skorlu rapor
49. figma_generate_component_doc    // Platform-agnostic markdown doc üret
```

**Bu araçlar:**
- Figma component spec'ini code implementation'a karşı karşılaştırır
- Skorlu diff rapor üretir
- Actionable fix item'ları gösterir
- Design + code-side info'yu merge ederek markdown doc üretir

### 10. **Comments API** (Belirtilmemiş, ama v1.9.0'da eklendi)

### 11. **MCP Apps** (2 interactive UI app) 🎨

```typescript
50. Token Browser              // Interactive design token explorer
51. Design System Dashboard    // Lighthouse-style health scorecard
```

**MCP Apps Özellikleri:**
- Interactive HTML UI chat'te inline render olur
- AI context tüketmeden data browsing
- Filter, search, click-to-copy
- Scoring engine ile design system audit

---

## 🔴 Tokenhaus MCP'de EKSİK Olan Kritik Özellikler

### **1. Code Generation (ÇOK KRİTİK!)**

**ÖZELLİK YOK!** Figma Console MCP'de:
- `figma_get_component_for_development` - Component + code + image
- Dev Mode export capabilities
- Design-to-code workflow

**DURUM:** Bu projenin ana hedeflerinden biri "code çıktısı almak" ama şu anda **hiç yok!**

**ÇÖZ ÜM:**
1. Backend'e code generation engine ekle
2. React/Vue/HTML/Tailwind export ekle
3. `figma_get_component_for_development` benzeri araç ekle

---

### **2. Component Instantiation (KRİTİK!)**

**ÖZELLİK YOK!** Figma Console MCP'de:
- `figma_instantiate_component` - Published library veya local component'ten instance oluştur
- Variant selection desteği
- Property override desteği
- Position/size override

**DURUM:** Tokenhaus'ta component YARATMA var ama mevcut component'leri KULLANMA yok!

**ÇÖZÜM:**
1. `packages/figma-plugin/src/code.ts`'e `INSTANTIATE_COMPONENT` handler ekle
2. MCP'ye `figma_instantiate_component` tool ekle
3. Component search + instantiate workflow'u ekle

---

### **3. Node Manipulation Tools (10 araç eksik!)**

**ÖZELLİK YOK!** Figma Console MCP'de:
- Resize, move, set fills/strokes/opacity
- Clone, delete, rename
- Text content değiştirme
- Child node oluşturma

**DURUM:** Component oluşturabiliyoruz ama edit edemiyoruz!

**ÇÖZÜM:**
1. `packages/figma-plugin/src/code.ts`'e 10 handler ekle:
   - RESIZE_NODE, MOVE_NODE, SET_NODE_FILLS, SET_NODE_STROKES,
   - SET_NODE_OPACITY, SET_NODE_CORNER_RADIUS, CLONE_NODE,
   - DELETE_NODE, RENAME_NODE, SET_TEXT_CONTENT, CREATE_CHILD_NODE

2. MCP'ye corresponding tools ekle

---

### **4. Screenshot Capability (Önemli!)**

**ÖZELLİK YOK!** Figma Console MCP'de:
- `figma_take_screenshot` - Node screenshot'ı base64 olarak al
- Visual validation için kullanılıyor

**DURUM:** AI design oluştururken visual validation yapamıyor!

**ÇÖZÜM:**
1. `packages/figma-plugin/src/code.ts`'e `CAPTURE_SCREENSHOT` handler ekle
2. `node.exportAsync()` kullan
3. base64 encode et, MCP'ye döndür

---

### **5. Design-Code Parity (ÇOK KRİTİK!)**

**ÖZELLİK YOK!** Figma Console MCP'de:
- `figma_check_design_parity` - Figma vs code karşılaştırma
- `figma_generate_component_doc` - Markdown doc generation

**DURUM:** Design-code sync olmadan design system incomplete!

**ÇÖZÜM:**
1. Backend'e parity checker ekle
2. Figma spec vs code implementation karşılaştırma
3. Skorlu diff rapor üret
4. Markdown doc generator ekle

---

### **6. Console Debugging (Geliştirme için önemli)**

**ÖZELLİK YOK!** Figma Console MCP'de:
- `figma_get_console_logs`
- `figma_watch_console`
- `figma_clear_console`

**DURUM:** Plugin development sırasında debugging zor!

**ÇÖZÜM:**
1. `packages/figma-plugin/src/code.ts`'e console capture ekle (figma-console-mcp'deki gibi)
2. Console logs'u WebSocket üzerinden stream et
3. MCP'ye console tools ekle

---

### **7. Batch Operations (Performance kritik!)**

**ÖZELLİK YOK!** Figma Console MCP'de:
- `figma_batch_create_variables` - 100 variable tek seferde
- `figma_batch_update_variables` - 100 update tek seferde
- 10-50x performans artışı!

**DURUM:** Büyük design system'lerde çok yavaş olur!

**ÇÖZÜM:**
1. Plugin'e batch handlers ekle
2. MCP'ye batch tools ekle
3. Performance optimization

---

### **8. MCP Apps (Interactive UI) (Nice to have)**

**ÖZELLİK YOK!** Figma Console MCP'de:
- Token Browser - Interactive token explorer
- Design System Dashboard - Health scorecard

**DURUM:** User experience için harika olur ama ilk öncelik değil

**ÇÖZÜM:**
1. `@modelcontextprotocol/ext-apps` SDK kullan
2. Token browser HTML UI yaz
3. Design system scoring engine yaz

---

### **9. Component Property Management**

**ÖZELLİK YOK!** Figma Console MCP'de:
- `figma_add_component_property`
- `figma_edit_component_property`
- `figma_delete_component_property`
- `figma_set_instance_properties`

**DURUM:** Component'lere property ekleyemiyoruz!

**ÇÖZÜM:**
1. Plugin'e property management handlers ekle
2. MCP tools ekle

---

## ⚠️ Mimari Farklar

### **1. Design Creation Yaklaşımı**

**Tokenhaus (Layered Approach):**
```typescript
// Component anatomy ile deklaratif yaklaşım
{
  layers: [{
    type: "frame",
    layout: "horizontal",
    children: [
      { type: "text", text: "Button" }
    ]
  }]
}
```

**Figma Console MCP (Power Tool Approach):**
```typescript
// Arbitrary Figma Plugin API code çalıştırma
figma_execute({
  code: `
    const frame = figma.createFrame();
    const text = figma.createText();
    frame.appendChild(text);
    return frame.id;
  `
})
```

**KARŞILAŞTIRMA:**
- ✅ Tokenhaus: AI için daha kolay, structured
- ✅ Figma Console: Daha flexible, herşeyi yapabilir
- 💡 **ÖNERİ:** İkisini birlikte kullan! Layered approach + power tool fallback

---

### **2. Variable Cache Strategy**

**Tokenhaus:**
- Plugin'de variable cache var (`_variableCache`)
- `refreshVariableCache()` her command başında

**Figma Console MCP:**
- Plugin load'da variable data fetch ediliyor
- UI iframe'de `window.__figmaVariablesData` olarak tutuluyor
- WebSocket üzerinden erişiliyor

**KARŞILAŞTIRMA:**
- ✅ Figma Console: Daha performanslı (UI iframe cache)
- ⚠️ Tokenhaus: Her seferinde async call (daha yavaş)
- 💡 **ÖNERİ:** Figma Console yaklaşımını kopyala

---

### **3. WebSocket Server Architecture**

**Tokenhaus:**
- Single WebSocket server
- Port 9223 - 9232 range (multi-instance destekli)
- File key tracking var mı? → **TEST EDİLMELİ**

**Figma Console MCP:**
- Multi-instance support (dynamic port fallback)
- Multi-file tracking (file key based)
- Real-time selection/document change tracking
- Instance discovery system

**KARŞILAŞTIRMA:**
- ⚠️ Tokenhaus: Multi-file support belirsiz
- ✅ Figma Console: Production-ready multi-file
- 💡 **ÖNERİ:** Multi-file support'u test et ve gerekirse kopyala

---

## 🎯 ÖNCELİKLENDİRME - Ne Yapılmalı?

### **🔴 P0 - Kritik (Hemen yapılmalı)**

1. **Code Generation**
   - `figma_export_code` tool ekle
   - React/HTML/Tailwind export
   - Backend code generation engine

2. **Component Instantiation**
   - `figma_instantiate_component` tool ekle
   - Plugin'e INSTANTIATE_COMPONENT handler ekle
   - Component library'den instance oluşturma

3. **Screenshot**
   - `figma_take_screenshot` tool ekle
   - Visual validation için kritik

4. **Design-Code Parity**
   - `figma_check_design_parity` tool ekle
   - `figma_generate_component_doc` tool ekle
   - Backend parity checker

---

### **🟡 P1 - Yüksek öncelik (İlk release'den sonra)**

5. **Node Manipulation Tools**
   - 10 araç ekle (resize, move, fill, stroke, vb.)
   - Design editing workflow

6. **Batch Operations**
   - `figma_batch_create_variables`
   - `figma_batch_update_variables`
   - Performance optimization

7. **Component Property Management**
   - 4 araç ekle (add/edit/delete/set properties)

---

### **🟢 P2 - Nice to have (Gelecek)**

8. **Console Debugging**
   - Console logs capture
   - Real-time log streaming

9. **MCP Apps**
   - Token Browser
   - Design System Dashboard

10. **Multi-File Support Validation**
    - Test et ve gerekirse fix et

---

## 💡 Figma Console MCP'den Öğrenilebilecekler

### **1. Variable Cache Optimization**

**Kopyala:**
```javascript
// code.js - Plugin load'da fetch et
(async () => {
  const variables = await figma.variables.getLocalVariablesAsync();
  const collections = await figma.variables.getLocalVariableCollectionsAsync();

  const variablesData = { variables, collections };

  // UI iframe'e gönder
  figma.ui.postMessage({
    type: 'VARIABLES_DATA',
    data: variablesData
  });
})();
```

```javascript
// ui.html - Window object'te cache
window.__figmaVariablesData = null;

window.addEventListener('message', (event) => {
  if (event.data.type === 'VARIABLES_DATA') {
    window.__figmaVariablesData = event.data.data;
  }
});
```

**Avantaj:** Async call yerine instant access!

---

### **2. Hex to Figma RGB Conversion**

**Kopyala:**
```javascript
function hexToFigmaRGB(hex) {
  hex = hex.replace(/^#/, '');

  // Validate
  if (!/^[0-9A-Fa-f]+$/.test(hex)) {
    throw new Error('Invalid hex color');
  }

  let r, g, b, a = 1;

  if (hex.length === 3) {
    r = parseInt(hex[0] + hex[0], 16) / 255;
    g = parseInt(hex[1] + hex[1], 16) / 255;
    b = parseInt(hex[2] + hex[2], 16) / 255;
  } else if (hex.length === 6) {
    r = parseInt(hex.substring(0, 2), 16) / 255;
    g = parseInt(hex.substring(2, 4), 16) / 255;
    b = parseInt(hex.substring(4, 6), 16) / 255;
  } else if (hex.length === 8) {
    r = parseInt(hex.substring(0, 2), 16) / 255;
    g = parseInt(hex.substring(2, 4), 16) / 255;
    b = parseInt(hex.substring(4, 6), 16) / 255;
    a = parseInt(hex.substring(6, 8), 16) / 255;
  }

  return { r, g, b, a };
}
```

**Tokenhaus'ta zaten var ama bu daha robust!**

---

### **3. Console Capture Pattern**

**Kopyala:**
```javascript
// code.js - Console intercept
(function() {
  const levels = ['log', 'info', 'warn', 'error', 'debug'];
  const originals = {};

  for (const level of levels) {
    originals[level] = console[level];

    console[level] = function(...args) {
      originals[level].apply(console, args);

      figma.ui.postMessage({
        type: 'CONSOLE_CAPTURE',
        level,
        message: args.join(' '),
        args,
        timestamp: Date.now()
      });
    };
  }
})();
```

---

### **4. Component Instantiation with Variant Matching**

**Kopyala:**
```javascript
// INSTANTIATE_COMPONENT handler'dan
async function instantiateComponent(msg) {
  let component = null;

  // Try published library first
  if (msg.componentKey) {
    try {
      component = await figma.importComponentByKeyAsync(msg.componentKey);
    } catch (e) {
      console.log('Not published, trying local...');
    }
  }

  // Fall back to local
  if (!component && msg.nodeId) {
    const node = await figma.getNodeByIdAsync(msg.nodeId);

    if (node.type === 'COMPONENT_SET' && msg.variant) {
      // Find matching variant
      const variantParts = [];
      for (const [prop, value] of Object.entries(msg.variant)) {
        variantParts.push(`${prop}=${value}`);
      }
      const targetName = variantParts.join(', ');

      component = node.children.find(c => c.name === targetName);

      // Fallback to first variant
      if (!component) component = node.children[0];
    } else if (node.type === 'COMPONENT') {
      component = node;
    }
  }

  // Create instance
  const instance = component.createInstance();

  // Apply overrides
  if (msg.variant) {
    instance.setProperties(msg.variant);
  }

  return instance;
}
```

---

### **5. Adaptive Response Size Management**

**Kopyala:**
```typescript
// figma-tools.ts'den
function adaptiveResponse(responseData: any, options: {
  toolName: string;
  compressionCallback?: (level: string) => any;
  suggestedActions?: string[];
}) {
  const sizeKB = calculateSizeKB(responseData);

  if (sizeKB <= 100) {
    return { content: [{ type: 'text', text: JSON.stringify(responseData) }] };
  }

  // Auto-compress based on size
  if (sizeKB > 1000) {
    // Emergency compression
    const compressed = options.compressionCallback?.('inventory');
    return {
      content: [
        { type: 'text', text: `⚠️ RESPONSE AUTO-COMPRESSED: ${sizeKB}KB → inventory mode` },
        { type: 'text', text: JSON.stringify(compressed) }
      ]
    };
  }

  // ... other thresholds
}
```

---

## 📊 Özellik Matris - Detaylı Karşılaştırma

| Kategori | Özellik | Tokenhaus | Figma Console | Öncelik |
|----------|---------|-----------|---------------|---------|
| **Design Creation** | Layer-based component creation | ✅ | ❌ | - |
| | Arbitrary code execution | ❌ | ✅ | P1 |
| | Component set organization | ❌ | ✅ | P2 |
| **Code Export** | React export | ❌ | ✅ | P0 |
| | HTML export | ❌ | ✅ | P0 |
| | Tailwind export | ❌ | ✅ | P0 |
| **Variables** | Create/Update/Delete | ✅ | ✅ | ✅ |
| | Batch operations | ❌ | ✅ | P1 |
| | Mode management | ✅ | ✅ | ✅ |
| **Components** | Create from scratch | ✅ | ✅ | ✅ |
| | Instantiate existing | ❌ | ✅ | P0 |
| | Property management | ❌ | ✅ | P1 |
| | Component search | ❌ | ✅ | P0 |
| **Node Manipulation** | Resize/Move | ❌ | ✅ | P1 |
| | Fill/Stroke/Opacity | ❌ | ✅ | P1 |
| | Clone/Delete/Rename | ❌ | ✅ | P1 |
| | Text editing | ❌ | ✅ | P1 |
| **Visual** | Screenshot | ❌ | ✅ | P0 |
| **Design-Code** | Parity check | ❌ | ✅ | P0 |
| | Doc generation | ❌ | ✅ | P0 |
| **Debug** | Console logs | ❌ | ✅ | P2 |
| | Error tracking | ❌ | ✅ | P2 |
| **UI** | MCP Apps | ❌ | ✅ | P2 |

---

## 🚀 Aksiyon Planı

### **Sprint 1 (Hemen) - Code Generation + Component Instantiation**

**Hedef:** Kullanıcı design oluşturabilsin VE code export alabilsin

1. `figma_export_code` tool ekle
   - Backend'e code generator engine ekle
   - React/HTML/Tailwind export
   - MCP tool registration

2. `figma_instantiate_component` tool ekle
   - Plugin'e INSTANTIATE_COMPONENT handler ekle
   - Component search + instance workflow
   - MCP tool registration

3. `figma_take_screenshot` tool ekle
   - Plugin'e CAPTURE_SCREENSHOT handler ekle
   - Base64 encoding
   - MCP tool registration

**Süre:** 5-7 gün

---

### **Sprint 2 - Design-Code Parity**

**Hedef:** Design-code sync tamamlansın

1. `figma_check_design_parity` tool ekle
   - Backend parity checker
   - Figma spec parser
   - Code analysis
   - Diff report generator

2. `figma_generate_component_doc` tool ekle
   - Markdown template engine
   - Design + code merge
   - Storybook link support

**Süre:** 5-7 gün

---

### **Sprint 3 - Node Manipulation**

**Hedef:** Design editing workflow

1. 10 node manipulation tool ekle:
   - figma_resize_node
   - figma_move_node
   - figma_set_fills
   - figma_set_strokes
   - figma_set_opacity
   - figma_set_corner_radius
   - figma_clone_node
   - figma_delete_node
   - figma_rename_node
   - figma_set_text_content

**Süre:** 3-5 gün

---

### **Sprint 4 - Performance & Polish**

**Hedef:** Production-ready

1. Batch operations ekle
2. Variable cache optimization (UI iframe approach)
3. Multi-file support test ve fix
4. Error handling improvement
5. Documentation

**Süre:** 5-7 gün

---

## 🎯 Sonuç ve Öneri

### **Ana Bulgular:**

1. **Tokenhaus MCP şu anda %20 feature coverage'a sahip** (11/56 araç)
2. **Code generation YOK** - Bu projede belirtilen ana hedeflerden biri!
3. **Component instantiation YOK** - Design system kullanımı için kritik!
4. **Design-code parity YOK** - Sync olmadan incomplete!
5. **Node manipulation YOK** - Edit edemezsen yarım kalmış!

### **Öncelikler:**

**🔴 P0 (Hemen):**
- Code generation
- Component instantiation
- Screenshot
- Design-code parity

**🟡 P1 (İlk release sonrası):**
- Node manipulation (10 araç)
- Batch operations
- Component property management

**🟢 P2 (Gelecek):**
- Console debugging
- MCP Apps
- Advanced features

### **Tavsiye Edilen Yaklaşım:**

1. **Hibrit Design Creation:**
   - Tokenhaus'un layered approach'unu koru (AI için kolay)
   - Figma Console'un `figma_execute` power tool'unu ekle (flexibility için)
   - İkisini birlikte kullan!

2. **Code Generation Priority:**
   - Bu projede "code çıktısı almak" hedefi var
   - Figma Console MCP'nin yaklaşımını kopyala
   - React/Vue/HTML/Tailwind export ekle

3. **Performance Optimization:**
   - Variable cache'i UI iframe'de tut (Figma Console gibi)
   - Batch operations ekle
   - Multi-file support test et

4. **User Experience:**
   - Screenshot ekle (visual validation için)
   - Design-code parity ekle (sync için)
   - Component instantiation ekle (kullanım için)

---

## 📚 Ek Kaynaklar

- **Figma Console MCP Repo:** https://github.com/southleft/figma-console-mcp
- **Figma Console MCP Docs:** https://docs.figma-console-mcp.southleft.com
- **Figma Plugin API:** https://www.figma.com/plugin-docs/
- **MCP Protocol:** https://modelcontextprotocol.io/

---

**Bu rapor DS-Agent/Tokenhaus MCP için yol haritası oluşturur. Tüm eksiklikler belirtilmiş, öncelikler verilmiş ve aksiyon planı hazırlanmıştır.**
