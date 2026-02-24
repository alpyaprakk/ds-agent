# Final Configuration - DS Agent

## ✅ Confirmed Decisions

### 1. Architecture
- **Storage:** PostgreSQL (production) / SQLite (development)
- **Monorepo:** Turborepo
- **Tech Stack:**
  - Agent: Node.js + TypeScript
  - Server: Node.js + Express + WebSocket (Socket.io)
  - Figma Plugin: TypeScript + Figma Plugin API
  - Dashboard: React + TypeScript + Tailwind CSS + shadcn/ui

### 2. Features
- **Workspace:** Multi-workspace support
- **Files:** Multiple Figma files per workspace
- **Roles:** Primary, Secondary, Reference
- **Sync:** Real-time WebSocket + Document Listener (2-3s latency)

### 3. Conflict Resolution: **Strategy B+ (Smart Hybrid)**

#### Priority Rules
```
Designer (Figma) > Agent (Dashboard)
```
- Designer changes in Figma ALWAYS win
- Agent changes are applied only if no Figma conflict
- Reason: Figma is the source of truth, designer intentions are final

#### Severity Levels
```typescript
LOW → Auto-resolve + Toast notification
MEDIUM → Auto-resolve + Confirmation toast (10s timeout)
HIGH → Block + Review Conflicts page (manual resolution required)
```

#### Notification System
- **Toast notifications** (bottom-right, non-intrusive)
- **Review Conflicts** button in notification
- **Dedicated Conflicts page** for manual review and resolution

#### Conflict Review Center (New Feature)
```
Dashboard → Conflicts (Badge: 3)
  ├─ Active Conflicts
  ├─ Resolved History
  └─ Settings (auto-resolve rules)
```

### 4. Team Workflow
- **No lock system** (Figma's native behavior)
- Multiple designers can work simultaneously
- Conflicts detected and resolved per Strategy B+
- Optional: Real-time presence indicators (future enhancement)

### 5. Undo Window
- **10 seconds** for auto-resolved conflicts
- User can undo within 10s
- After 10s, decision is finalized
- Can still review in Conflict History

---

## 🎨 UI Components

### Toast Notification Examples

#### LOW Severity - Auto-Resolved
```
┌────────────────────────────────────────┐
│ ✅ Conflict Auto-Resolved              │
│                                        │
│ color/primary/500                      │
│ Designer's change (#2563EB) applied    │
│                                        │
│ [Review] [Dismiss]            10s      │
└────────────────────────────────────────┘
```

#### MEDIUM Severity - Needs Confirmation
```
┌────────────────────────────────────────┐
│ ⚠️ Conflict Resolved - Confirm?        │
│                                        │
│ Button component updated               │
│ Designer's changes applied             │
│                                        │
│ [Undo] [Review] [OK]          10s      │
└────────────────────────────────────────┘
```

#### HIGH Severity - Manual Required
```
┌────────────────────────────────────────┐
│ 🚨 Critical Conflict - Action Required │
│                                        │
│ Button component                       │
│ Designer deleted, Agent tried to edit  │
│                                        │
│ [Review Conflicts] →                   │
└────────────────────────────────────────┘
```

### Review Conflicts Page

```
┌─────────────────────────────────────────────────────────────┐
│  DS Agent > Conflicts                                       │
│  [Active (3)] [History (12)] [Settings]                     │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│  🚨 HIGH PRIORITY (1)                                       │
│                                                             │
│  #1 • Button Component Deletion                            │
│  Detected: 2m ago                                          │
│                                                             │
│  ┌───────────────────────────────────────────────────┐     │
│  │ Designer Action (Figma)                           │     │
│  │ Deleted "Button" component                        │     │
│  │ Time: 2024-02-24 14:30:15                         │     │
│  └───────────────────────────────────────────────────┘     │
│                                                             │
│  ┌───────────────────────────────────────────────────┐     │
│  │ Agent Action (Dashboard)                          │     │
│  │ Attempted to update auto-layout                   │     │
│  │ Time: 2024-02-24 14:30:18                         │     │
│  └───────────────────────────────────────────────────┘     │
│                                                             │
│  Resolution Options:                                       │
│  ○ Keep Deleted (Designer wins)                            │
│  ○ Restore Component (Undo deletion)                       │
│  ○ Restore + Apply Agent Update                            │
│                                                             │
│  [Apply] [Skip] [Ask Agent for Advice]                     │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│  ⚠️ MEDIUM PRIORITY (2)                                     │
│                                                             │
│  #2 • Variable Value Conflict                              │
│  Auto-resolved: Designer's value applied                   │
│  [View Details] [Undo] [Keep]                              │
│                                                             │
│  #3 • Component Property Update                            │
│  Auto-resolved: Designer's changes kept                    │
│  [View Details] [Undo] [Keep]                              │
└─────────────────────────────────────────────────────────────┘
```

---

## 🔄 Complete Sync & Conflict Flow

### Scenario: Designer vs Agent Same-Time Edit

```
Timeline:
──────────────────────────────────────────────────────────────

T+0s: Agent (Dashboard)
  "Change color/primary/500 to #3B82F6"
  → Server queues operation

T+1s: Designer (Figma)
  Changes color/primary/500 to #2563EB
  → Plugin detects via documentchange

T+2s: Designer stops editing
  → Plugin debounce timer starts

T+4s: Debounce expires (2s)
  → Plugin sends to server: "color/primary/500 = #2563EB"

T+4.1s: Server receives both:
  1. Agent: #3B82F6 (queued at T+0s)
  2. Designer: #2563EB (received at T+4s)

  Conflict Detection Engine:
  ├─ Entity: Variable "color/primary/500"
  ├─ Source 1: Agent (Dashboard, T+0s)
  ├─ Source 2: Designer (Figma, T+4s)
  ├─ Priority: Designer > Agent
  ├─ Severity: MEDIUM (Figma vs Agent)
  └─ Resolution: Apply Designer's value (#2563EB)

T+4.2s: Server actions:
  1. Apply #2563EB to database
  2. Reject Agent's #3B82F6 request
  3. Log conflict in conflicts table
  4. Broadcast to all dashboards via WebSocket

T+4.3s: Dashboard receives update:
  1. Show toast notification:
     "⚠️ Conflict Resolved - Designer's change applied"
  2. Update variable manager UI
  3. Start 10-second undo timer
  4. Increment conflict badge: Conflicts (1)

T+4.5s: Agent (in chat) notifies user:
  "Heads up! I tried to change color/primary/500 to #3B82F6,
   but the designer just changed it to #2563EB.
   Designer's change was applied. Want me to try again?"

User Options:
  A) [Undo] within 10s → Revert to #3B82F6, ask designer
  B) [Review] → Go to Conflicts page for detailed view
  C) [Dismiss] or wait 10s → Accept designer's change
  D) [OK] → Explicitly accept

T+14.5s: No action taken (10s timeout)
  → Auto-accept designer's change
  → Move conflict to History
  → Conflicts badge cleared
```

---

## 📊 Database Schema Updates

### New Tables for Conflicts

```sql
-- Conflicts Table
CREATE TABLE conflicts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
  conflict_type VARCHAR(50) NOT NULL,
  severity VARCHAR(20) NOT NULL, -- low, medium, high
  status VARCHAR(20) NOT NULL, -- active, resolved, dismissed

  -- Conflict entities
  entity_type VARCHAR(50) NOT NULL, -- variable, component, style
  entity_id VARCHAR(255) NOT NULL,
  entity_name VARCHAR(255),

  -- Source 1 (usually Agent)
  source1_type VARCHAR(50), -- agent, dashboard, api
  source1_action VARCHAR(50), -- create, update, delete
  source1_value JSONB,
  source1_timestamp TIMESTAMP,

  -- Source 2 (usually Designer/Figma)
  source2_type VARCHAR(50), -- figma, designer
  source2_action VARCHAR(50),
  source2_value JSONB,
  source2_timestamp TIMESTAMP,

  -- Resolution
  resolution_method VARCHAR(50), -- auto, manual, timeout
  resolution_chosen VARCHAR(50), -- source1, source2, custom
  resolution_value JSONB,
  resolved_by VARCHAR(255), -- user_id or 'system'
  resolved_at TIMESTAMP,

  -- Metadata
  description TEXT,
  impact_score INTEGER, -- How many entities affected
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_conflicts_workspace ON conflicts(workspace_id);
CREATE INDEX idx_conflicts_status ON conflicts(status);
CREATE INDEX idx_conflicts_severity ON conflicts(severity);

-- Conflict History (for audit)
CREATE TABLE conflict_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conflict_id UUID REFERENCES conflicts(id) ON DELETE CASCADE,
  action VARCHAR(50), -- created, resolved, undone, dismissed
  actor VARCHAR(255), -- user_id or 'system'
  details JSONB,
  timestamp TIMESTAMP DEFAULT NOW()
);

-- Change Log (Enhanced)
ALTER TABLE change_logs ADD COLUMN conflict_id UUID REFERENCES conflicts(id);
ALTER TABLE change_logs ADD COLUMN was_reverted BOOLEAN DEFAULT FALSE;
```

---

## 🎯 Agent Intelligence Enhancements

### Context-Aware Conflict Handling

```typescript
// Agent learns from past conflicts
class ConflictAwareAgent {
  async handleConflictNotification(conflict: Conflict) {
    // Analyze conflict
    const analysis = this.analyzeConflict(conflict)

    // Check if similar conflict happened before
    const pastConflicts = await this.findSimilarConflicts(conflict)

    // Generate smart response
    if (pastConflicts.length > 0) {
      const pattern = this.detectPattern(pastConflicts)

      return this.generateResponse({
        conflict,
        pattern,
        suggestion: this.suggestAction(pattern)
      })
    }

    return this.generateDefaultResponse(conflict)
  }

  generateResponse({ conflict, pattern, suggestion }) {
    // Example outputs:

    // Pattern: Designer always overrides color values
    if (pattern.type === 'color_override') {
      return `I noticed the designer changed ${conflict.entity_name}.
              This is the 3rd time they've overridden color values.
              Should I avoid changing colors without asking first?`
    }

    // Pattern: Agent's component updates get reverted
    if (pattern.type === 'component_revert') {
      return `The designer reverted my changes to ${conflict.entity_name}.
              Would you like me to discuss this with the designer first
              next time I want to update a component?`
    }

    // No pattern - default
    return `Conflict detected: Designer changed ${conflict.entity_name}.
            What would you like me to do?`
  }
}
```

### Proactive Conflict Prevention

```typescript
// Before making a change, check for potential conflicts
async function agentCreateComponent(spec: ComponentSpec) {
  // 1. Check recent Figma activity
  const recentChanges = await getRecentFigmaChanges(workspace, 60000) // Last 1 min

  // 2. Check if designer is currently working on similar items
  const potentialConflict = recentChanges.find(change =>
    change.entity_name === spec.name ||
    change.entity_type === 'component'
  )

  if (potentialConflict) {
    // 3. Warn user
    await askUser({
      message: `I noticed the designer just worked on components in Figma.
                Should I wait before creating ${spec.name}?`,
      options: ['Wait 5 minutes', 'Proceed anyway', 'Ask designer']
    })
  }

  // 4. Proceed with creation
  return createComponent(spec)
}
```

---

## 🚀 Implementation Roadmap (Updated)

### Week 1-2: Foundation
- [x] Project planning ✅
- [x] Architecture design ✅
- [x] Conflict strategy ✅
- [ ] Setup monorepo
- [ ] Database schema
- [ ] Basic server (Express + WebSocket)

### Week 3-4: Agent Core
- [ ] Agent context system
- [ ] Design system rules engine
- [ ] Variable analyzer
- [ ] Component creation logic
- [ ] Conflict-aware agent logic

### Week 5-6: Figma Plugin
- [ ] Plugin scaffold
- [ ] Document change listener
- [ ] Debounce & batching
- [ ] Sync client (to server)
- [ ] Variable/Component operations

### Week 7-8: Dashboard
- [ ] Dashboard UI (React)
- [ ] WebSocket integration
- [ ] Variable Manager page
- [ ] Component Explorer page
- [ ] **Conflicts page** ← NEW
- [ ] Toast notification system

### Week 9-10: Sync & Conflicts
- [ ] Conflict detection engine
- [ ] Severity classification
- [ ] Auto-resolution logic
- [ ] Undo/revert system
- [ ] Conflict history & audit

### Week 11-12: Polish
- [ ] Agent intelligence (pattern learning)
- [ ] Proactive conflict prevention
- [ ] UI/UX refinements
- [ ] Testing & bug fixes
- [ ] Documentation

---

## 📋 Next Immediate Steps

1. **Setup project structure** (NOW)
   ```
   ds-agent/
   ├── packages/
   │   ├── agent/
   │   ├── server/
   │   ├── figma-plugin/
   │   └── dashboard/
   ├── .ds-agent/
   └── database/
   ```

2. **Initialize database**
   - Create schema.sql
   - Setup migrations
   - Seed initial data

3. **Server skeleton**
   - Express + WebSocket
   - Database connection
   - Basic API endpoints

4. **Agent context**
   - Load design-system-rules.json
   - Context manager
   - First agent test

**Ready to start coding?** 🚀

---

## ✅ Final Checklist

- [x] Storage: PostgreSQL ✅
- [x] Features: Multi-workspace + Multi-file ✅
- [x] Sync: WebSocket + Document listener ✅
- [x] Conflict: Strategy B+ ✅
- [x] Priority: Designer > Agent ✅
- [x] Notifications: Toast + Review page ✅
- [x] Undo: 10 seconds ✅
- [x] Team: No locks ✅

**All decisions finalized! Let's build! 🎉**
