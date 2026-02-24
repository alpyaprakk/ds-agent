# Design System Agent - Proje Planı

## 🎯 Proje Hedefi
Figma Plugin API üzerinden çalışan, AI destekli (Claude), Design System yönetimi ve component oluşturma sistemi.

---

## 🏗️ Sistem Mimarisi

```
┌─────────────────────────────────────────────────────────────┐
│                     KULLANICI                                │
│                        ↓ ↑                                   │
├─────────────────────────────────────────────────────────────┤
│                  DASHBOARD UI                                │
│  • Design System Durumu                                      │
│  • Variable Yönetimi                                         │
│  • Component İzleme                                          │
│  • Sorun/Eksik Bildirimi                                     │
│  • Manuel Müdahale Arayüzü                                   │
└─────────────────────────────────────────────────────────────┘
                         ↓ ↑
┌─────────────────────────────────────────────────────────────┐
│              DESIGN SYSTEM AGENT (Claude)                    │
│                                                              │
│  ┌──────────────────────────────────────┐                   │
│  │   Context Manager                    │                   │
│  │   • Design System Rules              │                   │
│  │   • Persistent Memory                │                   │
│  │   • Conversation Context             │                   │
│  └──────────────────────────────────────┘                   │
│                                                              │
│  ┌──────────────────────────────────────┐                   │
│  │   Decision Engine                    │                   │
│  │   • Variable Analizi                 │                   │
│  │   • Component Stratejisi             │                   │
│  │   • Naming Conventions               │                   │
│  │   • Best Practices                   │                   │
│  └──────────────────────────────────────┘                   │
│                                                              │
│  ┌──────────────────────────────────────┐                   │
│  │   Action Planner                     │                   │
│  │   • Task Breakdown                   │                   │
│  │   • Step-by-step Execution           │                   │
│  │   • Validation Checks                │                   │
│  └──────────────────────────────────────┘                   │
└─────────────────────────────────────────────────────────────┘
                         ↓ ↑
┌─────────────────────────────────────────────────────────────┐
│            FIGMA PLUGIN API LAYER                            │
│                                                              │
│  ┌──────────────────────────────────────┐                   │
│  │   Variable Manager                   │                   │
│  │   • Get/Create Variables             │                   │
│  │   • Manage Collections               │                   │
│  │   • Handle Aliases                   │                   │
│  │   • Validate Links                   │                   │
│  └──────────────────────────────────────┘                   │
│                                                              │
│  ┌──────────────────────────────────────┐                   │
│  │   Component Manager                  │                   │
│  │   • Create Components                │                   │
│  │   • Manage Variants                  │                   │
│  │   • Set Properties                   │                   │
│  │   • Auto-layout Setup                │                   │
│  └──────────────────────────────────────┘                   │
│                                                              │
│  ┌──────────────────────────────────────┐                   │
│  │   Style Manager                      │                   │
│  │   • Color Styles                     │                   │
│  │   • Text Styles                      │                   │
│  │   • Effect Styles                    │                   │
│  │   • Consistency Checks               │                   │
│  └──────────────────────────────────────┘                   │
└─────────────────────────────────────────────────────────────┘
                         ↓ ↑
┌─────────────────────────────────────────────────────────────┐
│                    FIGMA FILE                                │
└─────────────────────────────────────────────────────────────┘
```

---

## 📦 Core Components

### 1. Agent Context System
**Amaç:** Her sohbette design system kurallarını yeniden anlatmaktan kurtulmak

**Yapı:**
```
.ds-agent/
├── context/
│   ├── design-system-rules.json    # Design system kuralları
│   ├── naming-conventions.json     # İsimlendirme kuralları
│   ├── variable-schema.json        # Variable yapısı
│   └── component-templates.json    # Component şablonları
├── memory/
│   ├── session-history.json        # Geçmiş konuşmalar
│   └── decisions.json              # Verilen kararlar
└── config/
    └── agent-config.json           # Agent ayarları
```

**Örnek design-system-rules.json:**
```json
{
  "version": "1.0.0",
  "rules": {
    "variables": {
      "naming": {
        "pattern": "category/property/variant",
        "examples": ["color/primary/500", "spacing/medium"]
      },
      "required_collections": [
        "colors",
        "spacing",
        "typography",
        "borders"
      ],
      "alias_strategy": "semantic-over-primitive"
    },
    "components": {
      "auto_layout_required": true,
      "variant_naming": "kebab-case",
      "property_naming": "PascalCase",
      "must_use_variables": true,
      "organization": {
        "use_pages": true,
        "page_naming": "📦 Components",
        "grouping": "by-category"
      }
    },
    "best_practices": {
      "check_existing_before_create": true,
      "validate_variable_coverage": true,
      "ensure_responsive_layouts": true,
      "document_component_usage": true
    }
  },
  "validation_rules": {
    "component_must_have": [
      "description",
      "variants",
      "auto_layout",
      "proper_naming"
    ],
    "variable_must_have": [
      "collection",
      "proper_alias",
      "documentation"
    ]
  }
}
```

### 2. Figma Plugin API Integration

**API Wrapper Fonksiyonları:**

```typescript
// Variable Operations
interface VariableOperations {
  getVariables(): Promise<Variable[]>
  getVariableCollections(): Promise<VariableCollection[]>
  createVariable(name: string, collection: string, value: any): Promise<Variable>
  createAlias(variable: Variable, aliasTo: Variable): Promise<void>
  validateVariableStructure(): Promise<ValidationReport>
  findMissingVariables(component: ComponentNode): Promise<Variable[]>
}

// Component Operations
interface ComponentOperations {
  createComponent(spec: ComponentSpec): Promise<ComponentNode>
  addVariant(component: ComponentNode, variantProps: VariantProps): Promise<void>
  setupAutoLayout(node: FrameNode, config: AutoLayoutConfig): Promise<void>
  organizeComponents(strategy: OrganizationStrategy): Promise<void>
  validateComponentStructure(component: ComponentNode): Promise<ValidationReport>
}

// Style Operations
interface StyleOperations {
  applyVariableToStyle(style: BaseStyle, variable: Variable): Promise<void>
  createStyleFromVariable(variable: Variable): Promise<BaseStyle>
  syncVariablesWithStyles(): Promise<SyncReport>
}
```

### 3. Dashboard UI

**Teknoloji Stack Önerisi:**
- **Frontend:** React + TypeScript + Tailwind CSS
- **State Management:** Zustand veya Jotai
- **API Communication:** Figma Plugin API bridge
- **UI Components:** shadcn/ui veya custom design system

**Dashboard Sayfaları:**

#### 3.1 Design System Overview
```
┌─────────────────────────────────────────┐
│  Design System Health: ⚠️ 85%           │
│                                         │
│  Variables: ✅ 142 | ⚠️ 12 | ❌ 3      │
│  Components: ✅ 28 | ⚠️ 5 | ❌ 2       │
│  Styles: ✅ 89 | ⚠️ 8 | ❌ 0           │
│                                         │
│  [View Details] [Run Audit]             │
└─────────────────────────────────────────┘
```

#### 3.2 Variable Manager
```
┌─────────────────────────────────────────────────┐
│ Variable Collections                            │
│                                                 │
│ 📦 Colors (45)                                  │
│   ├─ color/primary/50    #F0F9FF  [linked]    │
│   ├─ color/primary/100   #E0F2FE  [linked]    │
│   └─ color/primary/500   #0EA5E9  [base]      │
│                                                 │
│ 📦 Spacing (12)                                 │
│   ├─ spacing/xs    4px   [base]                │
│   ├─ spacing/sm    8px   [base]                │
│   └─ spacing/md    16px  [base]                │
│                                                 │
│ ⚠️ Missing Variables:                          │
│   • border/radius/lg                           │
│   • shadow/elevation/high                      │
│   [Create Missing] [Edit Structure]            │
└─────────────────────────────────────────────────┘
```

#### 3.3 Component Explorer
```
┌─────────────────────────────────────────────────┐
│ Components (28)                                 │
│                                                 │
│ Button ✅                                       │
│   Variants: 12                                  │
│   Properties: Size, Variant, State             │
│   Variable Coverage: 100%                       │
│   [View] [Edit]                                 │
│                                                 │
│ Input ⚠️                                        │
│   Variants: 8                                   │
│   Properties: Size, State                      │
│   Variable Coverage: 85%                        │
│   Issues: Missing focus state variable         │
│   [View] [Fix]                                  │
│                                                 │
│ Card ❌                                         │
│   Issues:                                       │
│   • No auto-layout                             │
│   • Hard-coded colors                          │
│   • Missing variants                           │
│   [Recreate] [Fix Issues]                      │
└─────────────────────────────────────────────────┘
```

#### 3.4 AI Agent Chat
```
┌─────────────────────────────────────────────────┐
│ Design System Agent                             │
│                                                 │
│ 🤖 Agent: Merhaba! Size nasıl yardımcı         │
│          olabilirim?                            │
│                                                 │
│ 👤 You: Button componenti oluştur              │
│                                                 │
│ 🤖 Agent:                                       │
│   ✓ Mevcut variable yapısı kontrol edildi      │
│   ✓ color/primary/* serisini buldum            │
│   ⚠️ border/radius/md eksik, oluşturuyorum     │
│   ✓ Button componenti oluşturuldu              │
│     - Variants: Default, Primary, Secondary    │
│     - Sizes: Small, Medium, Large              │
│     - States: Default, Hover, Active, Disabled │
│   ✓ Tüm değerler variable'lardan alındı       │
│                                                 │
│   [View Component] [Modify]                    │
│                                                 │
│ [Type your message...]                         │
└─────────────────────────────────────────────────┘
```

---

## 🔄 AI Agent İş Akışı

### Senaryo: "Button componenti oluştur"

```
1. CONTEXT LOADING
   ├─ Design system rules yükle
   ├─ Mevcut Figma dosyası analiz et
   └─ Variable yapısını oku

2. REQUIREMENT ANALYSIS
   ├─ Button için gerekli variable'ları belirle
   │  ├─ Colors: primary, secondary, text
   │  ├─ Spacing: padding (horizontal/vertical)
   │  ├─ Border: radius
   │  └─ Typography: font family, size, weight
   └─ Variant yapısını planla
      ├─ Property: Variant (default, primary, secondary)
      ├─ Property: Size (sm, md, lg)
      └─ Property: State (default, hover, active, disabled)

3. VARIABLE VALIDATION
   ├─ Check existing variables
   │  ✅ color/primary/* → mevcut
   │  ✅ spacing/padding/* → mevcut
   │  ❌ border/radius/md → eksik
   │  ✅ typography/button/* → mevcut
   └─ Create missing variables
      └─ border/radius/md: 8px oluşturuluyor

4. COMPONENT CREATION
   ├─ Ana component frame oluştur
   ├─ Auto-layout setup
   │  ├─ Direction: horizontal
   │  ├─ Padding: variable(spacing/padding/button)
   │  ├─ Gap: variable(spacing/gap/sm)
   │  └─ Corner radius: variable(border/radius/md)
   ├─ Variant oluştur (3 x 3 x 4 = 36 varyasyon)
   └─ Her varyant için properties set et

5. VARIABLE BINDING
   ├─ Background → variable(color/{variant}/500)
   ├─ Text color → variable(color/text/on-{variant})
   ├─ Border radius → variable(border/radius/md)
   └─ State variations → opacity/color değişimleri

6. VALIDATION & ORGANIZATION
   ├─ Auto-layout kontrolü ✅
   ├─ Variable coverage kontrolü ✅
   ├─ Naming convention kontrolü ✅
   ├─ Component organize et (doğru page/section)
   └─ Description ekle

7. REPORT
   └─ Dashboard'a sonuç raporla
      ├─ Created: Button component
      ├─ Variants: 36
      ├─ Variables used: 12
      ├─ Variables created: 1
      └─ Status: ✅ Success
```

---

## 🚫 YAPILMAMASI GEREKENLER (Agent Guardrails)

### Kritik Kurallar:

```json
{
  "never_do": [
    {
      "rule": "Hard-coded değerler kullanma",
      "reason": "Tüm değerler variable'lardan gelmeli",
      "exception": "Variable oluşturulamıyorsa kullanıcıya sor"
    },
    {
      "rule": "Mevcut component'i silip yeniden oluşturma",
      "reason": "Varolan bağlantılar kopabilir",
      "alternative": "Update et veya kullanıcıya sor"
    },
    {
      "rule": "Auto-layout olmadan component oluşturma",
      "reason": "Responsive olmayan componentler teknik borç",
      "exception": "Icon gibi fixed-size elementler"
    },
    {
      "rule": "Naming convention'a uymayan isimler",
      "reason": "Tutarsızlık yaratır",
      "action": "Always follow design-system-rules.json patterns"
    },
    {
      "rule": "Variable alias zinciri 3'ten fazla",
      "reason": "Karmaşıklık ve performans",
      "action": "Warn user and suggest restructuring"
    },
    {
      "rule": "Dokümantasyon olmadan component oluşturma",
      "reason": "Kullanılabilirlik azalır",
      "action": "Always add description with usage examples"
    }
  ],
  "always_do": [
    {
      "rule": "Mevcut yapıyı kontrol et",
      "action": "Check before create/update"
    },
    {
      "rule": "Variable coverage 100% olmaya çalış",
      "action": "Create missing variables with user approval"
    },
    {
      "rule": "Validation yap",
      "action": "Her işlemden sonra yapıyı kontrol et"
    },
    {
      "rule": "Report yap",
      "action": "Kullanıcıya ne yapıldığını açıkla"
    },
    {
      "rule": "Consistent naming",
      "action": "Always follow naming conventions"
    }
  ],
  "ask_user_when": [
    "Büyük değişiklik yaparken",
    "Mevcut component'i değiştirirken",
    "Naming convention belirsizse",
    "Multiple approach varsa",
    "Kritik variable silinecekse"
  ]
}
```

---

## 📂 Proje Klasör Yapısı

```
ds-agent/
├── docs/
│   ├── README.md
│   ├── ARCHITECTURE.md
│   ├── API_REFERENCE.md
│   ├── USER_GUIDE.md
│   └── EXAMPLES.md
│
├── packages/
│   ├── agent/                      # Claude AI agent
│   │   ├── src/
│   │   │   ├── context/
│   │   │   │   ├── loader.ts
│   │   │   │   └── manager.ts
│   │   │   ├── engine/
│   │   │   │   ├── analyzer.ts
│   │   │   │   ├── planner.ts
│   │   │   │   └── executor.ts
│   │   │   ├── rules/
│   │   │   │   ├── validator.ts
│   │   │   │   └── guardrails.ts
│   │   │   └── index.ts
│   │   └── package.json
│   │
│   ├── figma-plugin/               # Figma plugin
│   │   ├── src/
│   │   │   ├── api/
│   │   │   │   ├── variables.ts
│   │   │   │   ├── components.ts
│   │   │   │   └── styles.ts
│   │   │   ├── ui/
│   │   │   │   ├── App.tsx
│   │   │   │   └── components/
│   │   │   ├── bridge/
│   │   │   │   └── message-handler.ts
│   │   │   ├── code.ts            # Plugin backend
│   │   │   └── ui.html            # Plugin UI
│   │   ├── manifest.json
│   │   └── package.json
│   │
│   └── dashboard/                  # Web dashboard
│       ├── src/
│       │   ├── components/
│       │   │   ├── VariableManager/
│       │   │   ├── ComponentExplorer/
│       │   │   ├── AgentChat/
│       │   │   └── Overview/
│       │   ├── hooks/
│       │   ├── api/
│       │   │   └── figma-bridge.ts
│       │   ├── store/
│       │   │   └── design-system-store.ts
│       │   ├── App.tsx
│       │   └── main.tsx
│       └── package.json
│
├── .ds-agent/                      # Agent context & memory
│   ├── context/
│   │   ├── design-system-rules.json
│   │   ├── naming-conventions.json
│   │   ├── variable-schema.json
│   │   └── component-templates.json
│   ├── memory/
│   │   ├── session-history.json
│   │   └── decisions.json
│   └── config/
│       └── agent-config.json
│
├── examples/                       # Example workflows
│   ├── create-button.md
│   ├── setup-variables.md
│   └── organize-components.md
│
├── scripts/                        # Utility scripts
│   ├── init-agent.js
│   ├── sync-context.js
│   └── validate-design-system.js
│
├── package.json
├── turbo.json                      # Monorepo setup
└── tsconfig.json
```

---

## 🎬 Implementation Phases

### Phase 1: Foundation (Week 1-2)
- [ ] Proje yapısı oluştur
- [ ] Design system rules şeması belirle
- [ ] Agent context system tasarla
- [ ] Figma Plugin API wrapper'ları yaz
- [ ] Temel dokümentasyon

### Phase 2: Core Agent (Week 3-4)
- [ ] Context loader/manager
- [ ] Decision engine
- [ ] Variable analyzer
- [ ] Component creation logic
- [ ] Validation system

### Phase 3: Figma Plugin (Week 5-6)
- [ ] Plugin UI skeleton
- [ ] API integrations
- [ ] Variable operations
- [ ] Component operations
- [ ] Style operations

### Phase 4: Dashboard (Week 7-8)
- [ ] Dashboard UI components
- [ ] Variable manager page
- [ ] Component explorer page
- [ ] Agent chat interface
- [ ] Real-time sync

### Phase 5: Integration & Testing (Week 9-10)
- [ ] End-to-end integration
- [ ] Testing scenarios
- [ ] Bug fixes
- [ ] Performance optimization
- [ ] Documentation completion

### Phase 6: Polish & Launch (Week 11-12)
- [ ] UI/UX refinements
- [ ] Examples & tutorials
- [ ] Beta testing
- [ ] Launch preparation

---

## 🔑 Kritik Özellikler

### 1. Context Persistence
**Problem:** Her sohbette tekrar anlatma
**Çözüm:** `.ds-agent/` klasöründe JSON bazlı context storage

### 2. Smart Variable Management
**Problem:** Variable kaos, eksikler, yanlış kullanım
**Çözüm:**
- Otomatik variable detection
- Missing variable creation
- Alias validation
- Coverage reporting

### 3. Intelligent Component Creation
**Problem:** Manuel, hatalı, tutarsız componentler
**Çözüm:**
- AI-driven creation
- Auto-layout enforcement
- Variable binding
- Validation checks

### 4. Dashboard Visibility
**Problem:** Design system durumu görünmez
**Çözüm:**
- Real-time health monitoring
- Visual variable tree
- Component status
- Interactive fixes

### 5. Guardrails
**Problem:** Yanlış işlemler, kırılma
**Çözüm:**
- Strict validation rules
- User confirmations
- Rollback capability
- Safety checks

---

## 🚀 Next Steps

1. **Onay al:** Bu yapı size uygun mu? Değişiklikler?
2. **Tech stack seç:** Dashboard için React + TypeScript onay?
3. **İlk kod:** Hangi component'ten başlayalım?
   - Agent context system?
   - Figma plugin API wrapper?
   - Dashboard skeleton?

4. **Doküman yapısı:** Docs nasıl organize olsun?
5. **Naming:** Proje ismi "ds-agent" uygun mu?

---

## 💡 Ekstra Fikirler

### Future Enhancements:
- **Version Control:** Design system değişiklik geçmişi
- **Team Collaboration:** Multi-user support
- **Export/Import:** Design system migration
- **Templates:** Industry-standard design system templates
- **Analytics:** Usage statistics, popular components
- **AI Suggestions:** "Bu component için X variant ekleyelim mi?"
- **Code Generation:** Design system'den kod export (React, Vue, etc.)
- **Figma Dev Mode Integration:** Developer handoff

---

**Soru:** Bu plan size nasıl geliyor? Hangi alanları daha detaylandırayım veya değiştirelim?
