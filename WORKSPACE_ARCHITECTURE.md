# Multi-Workspace Architecture

## 🎯 Workspace Konsepti

Bir **workspace**, bir design system projesini temsil eder. Her workspace:
- Bir veya birden fazla Figma dosyası
- Kendi design system rules
- Kendi variable schema
- Kendi component library
- Kendi agent context

---

## 🏗️ Workspace Yapısı

```
.ds-agent/
├── workspaces/
│   ├── workspace-1/                    # Example: "Mobile App DS"
│   │   ├── metadata.json
│   │   ├── figma-files.json
│   │   ├── context/
│   │   │   ├── design-system-rules.json
│   │   │   ├── naming-conventions.json
│   │   │   ├── variable-schema.json
│   │   │   └── component-templates.json
│   │   ├── memory/
│   │   │   ├── session-history.json
│   │   │   └── decisions.json
│   │   └── cache/
│   │       ├── variables-snapshot.json
│   │       ├── components-snapshot.json
│   │       └── last-sync.json
│   │
│   ├── workspace-2/                    # Example: "Web Platform DS"
│   │   ├── metadata.json
│   │   ├── figma-files.json
│   │   └── ...
│   │
│   └── workspace-3/                    # Example: "Marketing Site DS"
│       ├── metadata.json
│       ├── figma-files.json
│       └── ...
│
├── global/
│   ├── settings.json
│   └── active-workspace.json           # Currently selected workspace
│
└── templates/                          # Workspace templates
    ├── default/
    ├── mobile-app/
    ├── web-app/
    └── marketing/
```

---

## 📄 Workspace Metadata Schema

### workspace-{id}/metadata.json
```json
{
  "id": "ws_abc123",
  "name": "Mobile App Design System",
  "description": "Design system for our mobile applications",
  "created_at": "2024-01-15T10:30:00Z",
  "updated_at": "2024-02-24T14:20:00Z",
  "icon": "📱",
  "color": "#3B82F6",
  "team": {
    "name": "Product Design Team",
    "members": ["user1@company.com", "user2@company.com"]
  },
  "settings": {
    "auto_sync": true,
    "sync_interval": 300000,
    "strict_mode": true,
    "validation_level": "strict"
  },
  "stats": {
    "total_components": 45,
    "total_variables": 156,
    "health_score": 92,
    "last_audit": "2024-02-20T09:15:00Z"
  }
}
```

### workspace-{id}/figma-files.json
```json
{
  "files": [
    {
      "id": "file_xyz789",
      "figma_key": "aBcDeFgHiJkLmN",
      "name": "Mobile Components",
      "url": "https://figma.com/design/aBcDeFgHiJkLmN/Mobile-Components",
      "role": "primary",
      "type": "design_system",
      "added_at": "2024-01-15T10:30:00Z",
      "last_synced": "2024-02-24T14:15:00Z",
      "sync_status": "success",
      "config": {
        "watch_pages": ["📦 Components", "🎨 Styles"],
        "ignore_pages": ["Archive", "Drafts"],
        "auto_import_variables": true,
        "auto_import_components": true
      },
      "stats": {
        "components": 28,
        "variables": 98,
        "styles": 45
      }
    },
    {
      "id": "file_abc456",
      "figma_key": "xYzAbC123456",
      "name": "Mobile Patterns",
      "url": "https://figma.com/design/xYzAbC123456/Mobile-Patterns",
      "role": "secondary",
      "type": "pattern_library",
      "added_at": "2024-01-20T11:00:00Z",
      "last_synced": "2024-02-24T14:15:00Z",
      "sync_status": "success",
      "config": {
        "watch_pages": ["Patterns"],
        "reference_only": true
      },
      "stats": {
        "components": 17,
        "variables": 0,
        "styles": 0
      }
    }
  ],
  "file_relationships": [
    {
      "from": "file_xyz789",
      "to": "file_abc456",
      "type": "references",
      "description": "Components use patterns as reference"
    }
  ]
}
```

---

## 🎨 Dashboard UI Updates

### 1. Workspace Selector (Top Bar)

```
┌─────────────────────────────────────────────────────────────┐
│  DS Agent  [📱 Mobile App DS ▼]  [+ New Workspace]         │
│                                                             │
│  Workspaces:                                               │
│  📱 Mobile App DS          ✅ Active                       │
│  🌐 Web Platform DS        Last sync: 2h ago               │
│  📢 Marketing Site DS      Last sync: 1d ago               │
│  ─────────────────────────                                │
│  + Create New Workspace                                    │
│  📥 Import from Figma                                      │
└─────────────────────────────────────────────────────────────┘
```

### 2. Workspace Overview (New Page)

```
┌─────────────────────────────────────────────────────────────┐
│  📱 Mobile App Design System                                │
│  Product Design Team • Created Jan 15, 2024                │
│                                                             │
│  Health Score: 92% ✅                                       │
│  [━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━] 92/100            │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  Figma Files (2)                                    │   │
│  │                                                      │   │
│  │  📄 Mobile Components (Primary)                     │   │
│  │     figma.com/design/aBcDeFgHiJkLmN/...            │   │
│  │     Components: 28 | Variables: 98 | Styles: 45    │   │
│  │     Last sync: 5m ago ✅                            │   │
│  │     [View] [Sync Now] [Settings] [Remove]          │   │
│  │                                                      │   │
│  │  📄 Mobile Patterns (Reference)                     │   │
│  │     figma.com/design/xYzAbC123456/...              │   │
│  │     Components: 17 (Reference only)                │   │
│  │     Last sync: 5m ago ✅                            │   │
│  │     [View] [Settings] [Remove]                      │   │
│  │                                                      │   │
│  │  [+ Add Figma File]                                 │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  Quick Stats                                        │   │
│  │  Total Components: 45                               │   │
│  │  Total Variables: 156                               │   │
│  │  Coverage: 94%                                      │   │
│  │  Issues: 3 warnings                                 │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  [Audit Workspace] [Export Config] [Delete Workspace]      │
└─────────────────────────────────────────────────────────────┘
```

### 3. Add Figma File Modal

```
┌─────────────────────────────────────────────────────────────┐
│  Add Figma File to Workspace                                │
│                                                             │
│  Figma URL *                                               │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ https://figma.com/design/...                        │   │
│  └─────────────────────────────────────────────────────┘   │
│  [Validate URL]                                            │
│                                                             │
│  File Role *                                               │
│  ● Primary (Main design system source)                     │
│  ○ Secondary (Additional components)                       │
│  ○ Reference (View only, no import)                        │
│                                                             │
│  File Type                                                 │
│  ☑ Design System                                           │
│  ☐ Pattern Library                                         │
│  ☐ Icon Library                                            │
│  ☐ Brand Assets                                            │
│                                                             │
│  Import Settings                                           │
│  ☑ Auto-import Variables                                   │
│  ☑ Auto-import Components                                  │
│  ☑ Auto-import Styles                                      │
│  ☐ Import only from specific pages:                        │
│    ┌───────────────────────────────────────────────────┐   │
│    │ 📦 Components, 🎨 Styles                          │   │
│    └───────────────────────────────────────────────────┘   │
│                                                             │
│  Sync Settings                                             │
│  ☑ Auto-sync (every 5 minutes)                             │
│  ☐ Manual sync only                                        │
│                                                             │
│  [Cancel]  [Add File]                                      │
└─────────────────────────────────────────────────────────────┘
```

---

## 🔄 Multi-File Sync Strategy

### Sync Modes

```typescript
enum SyncMode {
  REAL_TIME = 'real_time',      // WebSocket connection
  POLLING = 'polling',           // Check every N minutes
  MANUAL = 'manual',             // User triggered only
  ON_DEMAND = 'on_demand'        // Agent triggered when needed
}

interface SyncConfig {
  mode: SyncMode
  interval?: number              // For polling mode (ms)
  conflict_resolution: 'primary_wins' | 'manual' | 'merge'
  batch_updates: boolean
}
```

### Conflict Resolution

**Scenario:** Aynı variable iki farklı dosyada farklı değerlerde

```json
{
  "conflict_id": "conflict_001",
  "type": "variable_mismatch",
  "detected_at": "2024-02-24T14:30:00Z",
  "files_involved": [
    {
      "file_id": "file_xyz789",
      "file_name": "Mobile Components",
      "variable": "color/primary/500",
      "value": "#3B82F6"
    },
    {
      "file_id": "file_abc456",
      "file_name": "Mobile Patterns",
      "variable": "color/primary/500",
      "value": "#2563EB"
    }
  ],
  "resolution_strategy": "primary_wins",
  "action_taken": {
    "type": "use_primary",
    "source_file": "file_xyz789",
    "value_applied": "#3B82F6",
    "notified_user": true
  }
}
```

### Merge Strategy

**Multi-file Variable Aggregation:**

```typescript
interface VariableAggregation {
  variable_name: string
  source_files: Array<{
    file_id: string
    file_name: string
    value: any
    role: 'primary' | 'secondary' | 'reference'
  }>
  resolved_value: any
  resolution_method: 'primary' | 'majority' | 'manual'
}

// Example:
{
  variable_name: "spacing/md",
  source_files: [
    { file_id: "file_1", file_name: "Components", value: 16, role: "primary" },
    { file_id: "file_2", file_name: "Patterns", value: 16, role: "secondary" },
    { file_id: "file_3", file_name: "Icons", value: 16, role: "reference" }
  ],
  resolved_value: 16,
  resolution_method: "primary"  // All agree, but primary takes precedence
}
```

---

## 🤖 Agent Multi-Workspace Intelligence

### Context Switching

```typescript
class WorkspaceContext {
  private currentWorkspace: Workspace

  async switchWorkspace(workspaceId: string) {
    // 1. Save current workspace state
    await this.saveCurrentState()

    // 2. Load new workspace
    this.currentWorkspace = await this.loadWorkspace(workspaceId)

    // 3. Load workspace-specific rules
    await this.loadDesignSystemRules(workspaceId)

    // 4. Sync with Figma files
    await this.syncAllFiles()

    // 5. Update agent memory
    this.agent.updateContext(this.currentWorkspace)
  }
}
```

### Cross-Workspace Operations

Agent'in birden fazla workspace arasında işlem yapabilmesi:

```typescript
// Example: Compare design systems
agent: "Comparing 'Mobile App DS' and 'Web Platform DS'..."

{
  comparison: {
    variables: {
      common: 89,          // Both have
      mobile_only: 23,     // Only in mobile
      web_only: 34,        // Only in web
      conflicting: 5       // Same name, different values
    },
    components: {
      common: 12,          // Similar components
      mobile_only: 16,
      web_only: 22,
      similar_names: [     // Might need alignment
        { mobile: "Button/Primary", web: "PrimaryButton" }
      ]
    },
    suggestions: [
      "Consider aligning 'Button' component naming across workspaces",
      "5 variables have conflicting values, review recommended"
    ]
  }
}

// Example: Copy component between workspaces
agent: "Copying 'Button' from Mobile DS to Web DS..."
- Analyze source component
- Check target workspace variables
- Map or create equivalent variables
- Recreate component with proper bindings
- Report differences and adaptations made
```

---

## 📊 Database Schema (Optional Advanced Feature)

Eğer veritabanı kullanmak isterseniz:

```sql
-- Workspaces
CREATE TABLE workspaces (
  id UUID PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  icon VARCHAR(10),
  color VARCHAR(7),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Figma Files
CREATE TABLE figma_files (
  id UUID PRIMARY KEY,
  workspace_id UUID REFERENCES workspaces(id),
  figma_key VARCHAR(255) NOT NULL,
  name VARCHAR(255),
  url TEXT,
  role VARCHAR(50),  -- primary, secondary, reference
  type VARCHAR(50),  -- design_system, pattern_library, etc.
  config JSONB,
  added_at TIMESTAMP DEFAULT NOW(),
  last_synced TIMESTAMP,
  sync_status VARCHAR(50)
);

-- Variables (Cached)
CREATE TABLE variables (
  id UUID PRIMARY KEY,
  workspace_id UUID REFERENCES workspaces(id),
  figma_file_id UUID REFERENCES figma_files(id),
  name VARCHAR(255) NOT NULL,
  value JSONB,
  collection VARCHAR(255),
  type VARCHAR(50),
  is_alias BOOLEAN DEFAULT FALSE,
  alias_to UUID REFERENCES variables(id),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Components (Cached)
CREATE TABLE components (
  id UUID PRIMARY KEY,
  workspace_id UUID REFERENCES workspaces(id),
  figma_file_id UUID REFERENCES figma_files(id),
  figma_node_id VARCHAR(255),
  name VARCHAR(255) NOT NULL,
  type VARCHAR(50),
  variant_count INTEGER,
  property_count INTEGER,
  variable_coverage DECIMAL(5,2),
  metadata JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Sync History
CREATE TABLE sync_history (
  id UUID PRIMARY KEY,
  workspace_id UUID REFERENCES workspaces(id),
  figma_file_id UUID REFERENCES figma_files(id),
  sync_type VARCHAR(50),  -- full, incremental, manual
  status VARCHAR(50),     -- success, failed, partial
  changes JSONB,
  errors JSONB,
  started_at TIMESTAMP,
  completed_at TIMESTAMP
);

-- Conflicts
CREATE TABLE conflicts (
  id UUID PRIMARY KEY,
  workspace_id UUID REFERENCES workspaces(id),
  conflict_type VARCHAR(50),
  entities_involved JSONB,
  detected_at TIMESTAMP,
  resolved_at TIMESTAMP,
  resolution_strategy VARCHAR(50),
  resolved_by VARCHAR(255)
);
```

---

## 🎬 User Workflows

### Workflow 1: Create New Workspace

```
1. User clicks "+ New Workspace"
2. Modal opens:
   ├─ Name: "E-commerce Design System"
   ├─ Template: "Web App" (optional)
   ├─ Team: Select team
   └─ Settings: Auto-sync, validation level
3. User clicks "Create"
4. System creates workspace structure
5. User redirected to new workspace
6. "Add your first Figma file" prompt
```

### Workflow 2: Add Figma File to Workspace

```
1. User in workspace overview
2. Clicks "+ Add Figma File"
3. Pastes Figma URL
4. System validates and fetches file info
5. User configures:
   ├─ Role (Primary/Secondary/Reference)
   ├─ Import settings
   └─ Sync settings
6. System imports initial data
7. Agent analyzes file and reports:
   "Found 23 components, 67 variables
    Design system health: 78%
    3 issues detected - would you like me to fix them?"
```

### Workflow 3: Switch Workspace

```
1. User clicks workspace dropdown
2. Selects different workspace
3. System:
   ├─ Saves current workspace state
   ├─ Loads new workspace
   ├─ Syncs with Figma files
   └─ Updates agent context
4. Dashboard updates with new workspace data
5. Agent greets:
   "Switched to E-commerce DS. Last sync: 2m ago.
    Everything looks good! How can I help?"
```

### Workflow 4: Cross-Workspace Component Migration

```
User: "Copy the Button component from Mobile DS to Web DS"

Agent:
1. Switches to Mobile DS context
2. Analyzes Button component:
   - 3 variants (Default, Primary, Secondary)
   - 4 sizes (XS, SM, MD, LG)
   - Uses: color/primary/*, spacing/*, border/radius/*
3. Switches to Web DS context
4. Checks Web DS variables:
   ✅ color/primary/* exists
   ✅ spacing/* exists
   ⚠️  border/radius/* missing
5. Creates missing variables in Web DS
6. Recreates Button component
7. Reports:
   "Button component copied successfully!
    Created 3 new border/radius variables.
    Component available in Web DS."
```

---

## 🔐 Permissions & Access Control (Future)

```json
{
  "workspace_permissions": {
    "owner": ["read", "write", "delete", "manage_files", "manage_members"],
    "admin": ["read", "write", "manage_files", "manage_members"],
    "editor": ["read", "write"],
    "viewer": ["read"]
  },
  "file_permissions": {
    "can_add_files": ["owner", "admin"],
    "can_remove_files": ["owner", "admin"],
    "can_sync": ["owner", "admin", "editor"],
    "can_view": ["owner", "admin", "editor", "viewer"]
  }
}
```

---

## 📈 Analytics & Insights (Future Enhancement)

```
Workspace Analytics Dashboard:

┌─────────────────────────────────────────────────────────────┐
│  📊 Workspace Insights - Last 30 Days                       │
│                                                             │
│  Component Usage                                           │
│  Button         ████████████ 245 instances                 │
│  Input          ██████████   189 instances                 │
│  Card           ████████     156 instances                 │
│                                                             │
│  Variable Usage                                            │
│  color/primary  ████████████ 312 references                │
│  spacing/md     ██████████   267 references                │
│                                                             │
│  File Activity                                             │
│  Mobile Components: 45 changes                             │
│  Mobile Patterns: 12 changes                               │
│                                                             │
│  Health Trend                                              │
│  Feb 1:  ████████████ 85%                                  │
│  Feb 15: █████████████ 89%                                 │
│  Feb 24: ██████████████ 92% ↗                              │
└─────────────────────────────────────────────────────────────┘
```

---

## 🚀 Implementation Priority

### Phase 1: Basic Multi-Workspace (Week 3-4)
- [ ] Workspace CRUD operations
- [ ] Single Figma file per workspace
- [ ] Workspace switcher UI
- [ ] Basic metadata tracking

### Phase 2: Multi-File Support (Week 5-6)
- [ ] Multiple Figma files per workspace
- [ ] File role system (primary/secondary/reference)
- [ ] Basic conflict detection
- [ ] Manual conflict resolution UI

### Phase 3: Advanced Sync (Week 7-8)
- [ ] Auto-sync with polling
- [ ] Intelligent merge strategies
- [ ] Conflict resolution automation
- [ ] Sync history tracking

### Phase 4: Cross-Workspace Features (Week 9-10)
- [ ] Workspace comparison
- [ ] Component migration between workspaces
- [ ] Shared component libraries
- [ ] Export/import workspace configs

---

## 💡 UI/UX Considerations

### Workspace Switcher Performance
- Lazy load workspace data
- Cache current workspace in memory
- Show loading states during switch
- Preload frequently used workspaces

### Visual Indicators
- Color coding for workspace types
- Status badges (synced, syncing, error)
- Health score indicators
- Last activity timestamps

### User Guidance
- Empty states with clear CTAs
- Onboarding flow for first workspace
- Tooltips for complex features
- In-app documentation links

---

## 🎯 Next Steps

1. **Approve multi-workspace architecture**
2. **Decide on storage:**
   - JSON files (simpler, good for MVP)
   - Database (scalable, better for production)
   - Hybrid (JSON + cache layer)

3. **Update project structure** to include workspace system
4. **Start implementation** with basic single-workspace, then expand

**Questions:**
- JSON-based yeterli mi yoksa database kullanmak ister misiniz?
- Cross-workspace operations ne kadar kritik?
- Workspace templates önceden tanımlı olsun mu?
