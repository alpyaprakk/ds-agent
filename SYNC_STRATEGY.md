# Real-Time Sync Strategy

## 🔄 Sync Architecture

### Challenge: Bidirectional Real-Time Sync

```
Dashboard ←──────────→ Server ←──────────→ Figma Plugin
(WebSocket)         (WebSocket + DB)      (Plugin API)
```

**Problem:** Figma Plugin API doesn't support webhooks!
**Solution:** Hybrid approach combining WebSocket + Smart Polling

---

## 🏗️ Architecture Components

```
┌─────────────────────────────────────────────────────────────┐
│                        DASHBOARD                             │
│                     (React + WebSocket)                      │
└────────────────────────┬────────────────────────────────────┘
                         │ WebSocket
                         ↓
┌─────────────────────────────────────────────────────────────┐
│                         SERVER                               │
│                  (Node.js + WebSocket + DB)                  │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  WebSocket Manager                                   │   │
│  │  - Broadcast to all connected clients                │   │
│  │  - Handle real-time events                           │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Sync Orchestrator                                   │   │
│  │  - Track active operations                           │   │
│  │  - Conflict detection                                │   │
│  │  - Change aggregation                                │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Database (PostgreSQL/SQLite)                        │   │
│  │  - Workspaces, Files, Variables, Components          │   │
│  │  - Change log / Audit trail                          │   │
│  │  - Conflict queue                                    │   │
│  └──────────────────────────────────────────────────────┘   │
└────────────────────────┬────────────────────────────────────┘
                         │ REST API + WebSocket
                         ↓
┌─────────────────────────────────────────────────────────────┐
│                     FIGMA PLUGIN                             │
│              (Plugin Backend + UI Thread)                    │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Change Listener (Document Events)                   │   │
│  │  - figma.on('documentchange')                        │   │
│  │  - Detect: variable changes, component changes       │   │
│  │  - Debounce & batch changes                          │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Sync Client                                         │   │
│  │  - Send changes to server                            │   │
│  │  - Poll for external changes                         │   │
│  │  - Apply incoming changes                            │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Figma API Operations                                │   │
│  │  - Create/update variables                           │   │
│  │  - Create/update components                          │   │
│  │  - Apply changes to document                         │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────────┐
│                      FIGMA FILE                              │
│                   (Design System Source)                     │
└─────────────────────────────────────────────────────────────┘
```

---

## 🔍 Sync Scenarios

### Scenario 1: Dashboard → Figma (User/Agent Changes)

**Flow:**
```
1. User/Agent: "Create Button component"
   ↓
2. Dashboard: Send to server via WebSocket
   {
     type: 'create_component',
     workspace_id: 'ws_123',
     file_id: 'file_abc',
     component_spec: {...}
   }
   ↓
3. Server:
   - Validate request
   - Check workspace permissions
   - Add to operation queue
   - Broadcast to other dashboard clients: "Operation pending"
   - Send to Figma Plugin via API
   ↓
4. Figma Plugin:
   - Receive operation request
   - Validate current document state
   - Execute: figma.createComponent(...)
   - Apply auto-layout, variables, etc.
   - Send success/failure back to server
   ↓
5. Server:
   - Update database
   - Broadcast to all clients: "Component created!"
   ↓
6. Dashboard:
   - Update UI
   - Show success notification
   - Refresh component list
```

**Timeline:** ~100-500ms (real-time feel)

---

### Scenario 2: Figma → Dashboard (Designer Changes in Figma)

**Challenge:** Figma Plugin API doesn't push events to external servers!

**Solution: Document Change Listener + Smart Sync**

```typescript
// Inside Figma Plugin (code.ts)

let changeBuffer: ChangeEvent[] = []
let syncTimeout: number | null = null

figma.on('documentchange', (event) => {
  // Capture change events
  changeBuffer.push({
    type: event.type,
    node: event.node,
    timestamp: Date.now()
  })

  // Debounce: Wait for user to stop making changes
  if (syncTimeout) clearTimeout(syncTimeout)

  syncTimeout = setTimeout(async () => {
    // User stopped making changes for 2 seconds
    await syncChangesToServer(changeBuffer)
    changeBuffer = []
  }, 2000)  // 2-second debounce
})

async function syncChangesToServer(changes: ChangeEvent[]) {
  // Analyze changes
  const analysis = analyzeChanges(changes)

  // Examples:
  // - Variable "color/primary/500" changed from #3B82F6 to #2563EB
  // - Component "Button" variant added
  // - Auto-layout updated on "Card"

  // Send to server
  await fetch('https://your-server.com/api/sync', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${pluginToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      workspace_id: currentWorkspace.id,
      file_id: currentFile.id,
      changes: analysis,
      timestamp: Date.now()
    })
  })
}

function analyzeChanges(events: ChangeEvent[]): Change[] {
  const changes: Change[] = []

  for (const event of events) {
    if (event.type === 'PROPERTY_CHANGE') {
      // Variable changed
      if (isVariable(event.node)) {
        changes.push({
          entity_type: 'variable',
          entity_id: event.node.id,
          action: 'updated',
          before: event.oldValue,
          after: event.newValue,
          property: event.property
        })
      }

      // Component changed
      if (isComponent(event.node)) {
        changes.push({
          entity_type: 'component',
          entity_id: event.node.id,
          action: 'updated',
          changes: getComponentChanges(event)
        })
      }
    }

    if (event.type === 'CREATE') {
      // New component/variable created
      changes.push({
        entity_type: detectEntityType(event.node),
        entity_id: event.node.id,
        action: 'created',
        data: extractEntityData(event.node)
      })
    }

    if (event.type === 'DELETE') {
      // Component/variable deleted
      changes.push({
        entity_type: detectEntityType(event.node),
        entity_id: event.node.id,
        action: 'deleted'
      })
    }
  }

  return deduplicateChanges(changes)
}
```

**Server receives Figma changes:**
```typescript
// Server endpoint
app.post('/api/sync', async (req, res) => {
  const { workspace_id, file_id, changes, timestamp } = req.body

  // 1. Validate and authenticate
  const workspace = await db.workspaces.findById(workspace_id)
  const file = await db.figmaFiles.findById(file_id)

  // 2. Check for conflicts
  const conflicts = await detectConflicts(changes, workspace_id)

  if (conflicts.length > 0) {
    // Queue conflicts for resolution
    await db.conflicts.create(conflicts)

    // Notify all connected clients
    io.to(workspace_id).emit('conflict_detected', {
      file_id,
      conflicts
    })

    return res.json({ status: 'conflict', conflicts })
  }

  // 3. No conflicts - apply changes
  await db.transaction(async (trx) => {
    for (const change of changes) {
      // Update database
      await applyChangeToDB(change, trx)

      // Create audit log
      await trx.changeLogs.create({
        workspace_id,
        file_id,
        change_type: change.action,
        entity_type: change.entity_type,
        entity_id: change.entity_id,
        before: change.before,
        after: change.after,
        source: 'figma',
        timestamp
      })
    }
  })

  // 4. Broadcast to all dashboard clients
  io.to(workspace_id).emit('figma_changes', {
    file_id,
    changes,
    timestamp
  })

  res.json({ status: 'success' })
})
```

**Dashboard receives update:**
```typescript
// Dashboard (React)
useEffect(() => {
  socket.on('figma_changes', (data) => {
    const { file_id, changes, timestamp } = data

    // Show notification
    toast.info(`Design updated in Figma (${changes.length} changes)`)

    // Update local state
    dispatch({
      type: 'APPLY_FIGMA_CHANGES',
      payload: { file_id, changes }
    })

    // Refresh affected views
    if (changes.some(c => c.entity_type === 'variable')) {
      refetchVariables()
    }
    if (changes.some(c => c.entity_type === 'component')) {
      refetchComponents()
    }
  })

  return () => socket.off('figma_changes')
}, [])
```

**Timeline:**
- User makes change in Figma → 0ms
- Plugin detects change → ~10ms
- Debounce wait (user stops editing) → 2000ms
- Send to server → ~100ms
- Broadcast to dashboards → ~50ms
- **Total: ~2-3 seconds** after user stops editing

---

## ⚡ Optimization: Smart Polling Fallback

Sometimes `documentchange` events might be missed or plugin closed. Add a polling fallback:

```typescript
// Figma Plugin
setInterval(async () => {
  // Every 30 seconds, quick health check
  const currentState = await captureCurrentState()
  const lastKnownState = await getLastKnownStateFromServer()

  if (hasChanges(currentState, lastKnownState)) {
    // Something changed that we didn't catch
    const delta = computeDelta(lastKnownState, currentState)
    await syncChangesToServer(delta)
  }
}, 30000)  // 30-second safety net
```

---

## 🔄 Full Sync Flow Example

### Example: Designer changes variable in Figma

```
Timeline:
─────────────────────────────────────────────────────────────

T+0ms:
  Designer in Figma changes:
  color/primary/500: #3B82F6 → #2563EB

T+10ms:
  Plugin documentchange event fires
  Change added to buffer

T+500ms:
  Designer makes another change:
  color/primary/600: #2563EB → #1E40AF

  Change added to buffer

T+2500ms:
  Debounce timer expires (2s after last change)
  Plugin analyzes buffer:
  [
    { entity: 'variable', id: 'var_1', action: 'updated', ... },
    { entity: 'variable', id: 'var_2', action: 'updated', ... }
  ]

  Plugin → Server: POST /api/sync

T+2600ms:
  Server receives changes
  No conflicts detected
  Database updated
  WebSocket broadcast to all dashboards

T+2650ms:
  Dashboard 1 (Agent chat) receives update:
  "Heads up! color/primary/500 changed in Figma.
   Would you like me to review components using this variable?"

  Dashboard 2 (Variable Manager) receives update:
  UI refreshes, shows new values with "Updated 2s ago" badge

T+2700ms:
  Complete! All clients in sync.
```

**Total sync time: ~2.7 seconds**

---

## 🚨 Conflict Scenarios & Resolution

### Conflict Type 1: Simultaneous Edit

**Scenario:**
```
T+0s:  Agent in Dashboard: "Change color/primary/500 to #3B82F6"
T+1s:  Designer in Figma: Changes color/primary/500 to #2563EB
T+2s:  Both changes reach server
```

**Resolution Strategy B (Primary Wins + Notification):**
```
Server logic:
1. Detect conflict
2. Check source priority:
   - Figma (designer) = HIGH priority
   - Dashboard (agent) = MEDIUM priority

3. Figma wins (it's the source of truth)
4. Reject agent's change
5. Notify agent:
   "Conflict: Designer changed color/primary/500 to #2563EB
    while I was trying to set it to #3B82F6.
    Designer's change applied. Should I revert?"

6. Log conflict in database
```

**Resolution Strategy C (Interactive Modal):**
```
Server logic:
1. Detect conflict
2. Pause both changes
3. Send conflict to all clients
4. Dashboard shows modal:

   ┌───────────────────────────────────────┐
   │ ⚠️ Conflict Detected                  │
   │                                       │
   │ Variable: color/primary/500           │
   │                                       │
   │ ○ Figma (Designer, 1s ago)            │
   │   #2563EB                             │
   │                                       │
   │ ○ Dashboard (Agent, 2s ago)           │
   │   #3B82F6                             │
   │                                       │
   │ ○ Custom value                        │
   │   [__________]                        │
   │                                       │
   │ [Apply Selected] [Cancel]             │
   └───────────────────────────────────────┘

5. User selects resolution
6. Apply chosen value
7. Notify all clients
8. Log resolution in audit trail
```

---

### Conflict Type 2: Delete vs. Edit

**Scenario:**
```
T+0s: Agent: "Update Button component auto-layout"
T+1s: Designer: Deletes Button component in Figma
T+2s: Both reach server
```

**Resolution Strategy B:**
```
1. Detect conflict
2. DELETE always wins (destructive action, likely intentional)
3. Reject agent's update
4. Notify agent:
   "Can't update Button component - it was deleted in Figma.
    Would you like me to recreate it?"
```

**Resolution Strategy C:**
```
1. Detect conflict
2. Show modal:

   ┌───────────────────────────────────────┐
   │ ⚠️ Critical Conflict                  │
   │                                       │
   │ Component: Button                     │
   │                                       │
   │ Designer deleted this component       │
   │ Agent tried to update it              │
   │                                       │
   │ ○ Keep deleted (designer wins)        │
   │ ○ Restore & apply update              │
   │ ○ Restore without update              │
   │                                       │
   │ [Apply] [Cancel]                      │
   └───────────────────────────────────────┘
```

---

### Conflict Type 3: Cross-File Variable Mismatch

**Scenario:**
```
Workspace has 2 files:
File A (Primary): color/primary/500 = #3B82F6
File B (Secondary): color/primary/500 = #2563EB
```

**Resolution Strategy B:**
```
1. Detect mismatch during sync
2. Primary file wins
3. Show notification:
   "Variable mismatch detected:
    File B has different value for color/primary/500
    Applied Primary file value (#3B82F6)

    [View Details] [Override Primary]"

4. Log in conflict history
```

**Resolution Strategy C:**
```
1. Detect mismatch
2. Queue for user review
3. Show in dashboard:

   ┌───────────────────────────────────────┐
   │ Variable Conflicts (1)                │
   │                                       │
   │ color/primary/500                     │
   │                                       │
   │ ● File A (Primary): #3B82F6           │
   │ ○ File B (Secondary): #2563EB         │
   │ ○ Custom: [__________]                │
   │                                       │
   │ Action:                               │
   │ ☑ Apply to all files                  │
   │ ☐ Keep different per file             │
   │                                       │
   │ [Resolve] [Skip]                      │
   └───────────────────────────────────────┘
```

---

## 📊 Comparison: Strategy B vs C

| Aspect | Strategy B: Auto + Notify | Strategy C: Interactive Modal |
|--------|---------------------------|-------------------------------|
| **User Interruption** | Minimal - notification only | High - requires user action |
| **Sync Speed** | Fast (~3s) | Slow (waits for user input) |
| **Error Possibility** | Medium - auto-resolution might be wrong | Low - user decides |
| **Workflow Disruption** | Low | High |
| **Audit Trail** | Good - logs decisions | Excellent - logs user choice |
| **Agent Autonomy** | High - agent can self-correct | Low - blocked until resolved |
| **Designer UX** | Excellent - non-disruptive | Poor - constant popups |
| **Complex Conflicts** | May need manual review later | Resolved immediately |
| **Learning Curve** | Low | Medium |
| **Production Readiness** | Requires trust in auto-resolution | Safer but slower |

---

## 🎯 Recommended Hybrid Approach: **Strategy B+**

Combine best of both:

### Smart Conflict Resolution Rules

```typescript
enum ConflictSeverity {
  LOW = 'low',       // Auto-resolve, notify
  MEDIUM = 'medium', // Auto-resolve, notify, ask for confirmation
  HIGH = 'high'      // Block, require user input
}

function determineConflictSeverity(conflict: Conflict): ConflictSeverity {
  // HIGH: Destructive operations
  if (conflict.involves_deletion) return ConflictSeverity.HIGH
  if (conflict.affects_multiple_components > 10) return ConflictSeverity.HIGH

  // MEDIUM: Significant changes
  if (conflict.source_figma && conflict.source_agent) return ConflictSeverity.MEDIUM
  if (conflict.affects_primary_file) return ConflictSeverity.MEDIUM

  // LOW: Minor changes
  return ConflictSeverity.LOW
}

async function resolveConflict(conflict: Conflict) {
  const severity = determineConflictSeverity(conflict)

  switch (severity) {
    case ConflictSeverity.LOW:
      // Auto-resolve with predefined rules
      const resolution = autoResolve(conflict)
      await applyResolution(resolution)

      // Notify (non-blocking)
      notify({
        type: 'info',
        message: `Auto-resolved: ${conflict.description}`,
        action: 'Undo',
        onAction: () => revertResolution(resolution)
      })
      break

    case ConflictSeverity.MEDIUM:
      // Auto-resolve but ask for confirmation
      const suggestion = autoResolve(conflict)
      await applyResolution(suggestion)

      // Ask for confirmation (with timeout)
      const confirmed = await askConfirmation({
        message: `Applied: ${suggestion.description}. Correct?`,
        timeout: 10000,  // 10s to respond
        onTimeout: 'keep'  // Keep if no response
      })

      if (!confirmed) {
        await revertResolution(suggestion)
        // Show interactive modal
        await showConflictModal(conflict)
      }
      break

    case ConflictSeverity.HIGH:
      // Block and require user input
      await showConflictModal(conflict)
      break
  }
}
```

### Example Flow with Strategy B+

```
Scenario: Agent updates color, Designer updates same color

1. Conflict detected: MEDIUM severity
2. Auto-resolve: Designer's change wins (Figma source priority)
3. Apply designer's change
4. Show notification:

   ┌─────────────────────────────────────────────┐
   │ ℹ️ Conflict Auto-Resolved                   │
   │                                             │
   │ color/primary/500                           │
   │ Designer's change (#2563EB) applied         │
   │                                             │
   │ [Undo] [Details]           [Dismiss]        │
   └─────────────────────────────────────────────┘

   Auto-dismiss in 10 seconds if no action

5. User clicks "Undo" → Revert, show modal for manual resolution
6. User clicks "Dismiss" → Accepted, continue
7. No action in 10s → Accepted, continue
```

---

## 🚀 Implementation Recommendation

### Phase 1 (MVP): Strategy B (Auto + Notify)
```
✅ Fast development
✅ Non-disruptive UX
✅ Good for single-user workflows
⚠️ May need refinement based on real usage
```

### Phase 2 (Production): Strategy B+ (Smart Hybrid)
```
✅ Handles most conflicts automatically
✅ Escalates complex conflicts to user
✅ Maintains workflow speed
✅ Safe for team collaboration
```

### Future (Advanced): ML-Based Resolution
```
🔮 Learn from past resolutions
🔮 Predict user preferences
🔮 Suggest optimal resolution
🔮 Team-specific resolution patterns
```

---

## 💡 My Recommendation

**Start with Strategy B+** because:

1. **Best UX:** Non-disruptive for designers, keeps agent flowing
2. **Safe:** Critical conflicts still get human review
3. **Scalable:** Can adjust severity thresholds based on usage
4. **Auditable:** Every decision logged, can review later
5. **Flexible:** Easy to add new conflict types and rules

**Implementation Priority:**
```
Week 5-6:
├─ Document change listener in plugin
├─ Basic sync server endpoints
├─ WebSocket broadcasting
└─ Simple auto-resolution (always primary wins)

Week 7-8:
├─ Conflict detection engine
├─ Severity classification
├─ Strategy B+ smart resolution
└─ Notification system

Week 9-10:
├─ Interactive conflict modal (for HIGH severity)
├─ Undo/revert system
├─ Audit trail UI
└─ Conflict analytics
```

---

## ❓ Questions for You

1. **Conflict severity**: Do these severity rules make sense? Any additions?

2. **Figma priority**: Should designer changes in Figma ALWAYS win? Or context-dependent?

3. **Notification style**:
   - Toast (bottom-right, auto-dismiss)
   - Banner (top, persistent)
   - Sidebar (non-intrusive, can review later)

4. **Undo window**: How long should users have to undo auto-resolutions?
   - 10 seconds?
   - 1 minute?
   - Until next conflict?

5. **Team workflows**: Multiple designers in same file?
   - Lock system?
   - Per-user conflict resolution?
   - Real-time presence indicators?

Ne düşünüyorsunuz? Strategy B+ ile gidelim mi?
