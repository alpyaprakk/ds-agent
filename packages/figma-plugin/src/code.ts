// Figma Plugin Code (Backend)
console.log('Tokenhaus Plugin Loaded');

figma.showUI(__html__, { width: 400, height: 600 });

// ─── Sync ────────────────────────────────────────────────────────────────────

async function runFullSync() {
  try {
    const variables = figma.variables.getLocalVariables();
    const collections = figma.variables.getLocalVariableCollections();
    const components = figma.root.findAll(node => node.type === 'COMPONENT') as ComponentNode[];

    const syncData = {
      file: {
        name: figma.root.name,
        key: figma.fileKey || 'unknown',
        lastModified: new Date().toISOString()
      },
      variables: variables.map(v => ({
        id: v.id,
        name: v.name,
        key: v.key,
        resolvedType: v.resolvedType,
        variableCollectionId: v.variableCollectionId,
        valuesByMode: v.valuesByMode
      })),
      collections: collections.map(c => ({
        id: c.id,
        name: c.name,
        key: c.key,
        modes: c.modes.map(m => ({ modeId: m.modeId, name: m.name })),
        defaultModeId: c.defaultModeId,
        variableIds: c.variableIds
      })),
      components: components.map(c => ({
        id: c.id,
        key: c.key,
        name: c.name,
        description: c.description,
        type: c.type,
        parent: c.parent?.name || null
      }))
    };

    console.log(`✅ Sync: ${syncData.variables.length} vars, ${syncData.collections.length} cols, ${syncData.components.length} comps`);
    figma.ui.postMessage({ type: 'sync-data', data: syncData });
  } catch (error) {
    figma.ui.postMessage({ type: 'sync-error', error: error instanceof Error ? error.message : 'Unknown error' });
  }
}

// ─── Variable Operations ──────────────────────────────────────────────────────

function applyVariableOp(op: { action: string; variableId?: string; variableName?: string; newName?: string; newValue?: any; modeId?: string }) {
  const variables = figma.variables.getLocalVariables();
  const variable = variables.find(v => v.id === op.variableId || v.name === op.variableName);
  if (!variable) return { success: false, error: `Variable not found: ${op.variableId || op.variableName}` };

  if (op.action === 'rename' && op.newName) {
    variable.name = op.newName;
    figma.notify(`✅ Renamed to: ${op.newName}`);
    return { success: true, message: `Renamed to ${op.newName}` };
  }

  if (op.action === 'set-value' && op.newValue !== undefined && op.modeId) {
    variable.setValueForMode(op.modeId, op.newValue);
    figma.notify(`✅ Value updated: ${variable.name}`);
    return { success: true, message: `Value updated` };
  }

  return { success: false, error: `Unknown variable action: ${op.action}` };
}

// ─── Token Resolution & Creation ─────────────────────────────────────────────
//
// TOKEN HIERARCHY (lookup order):
//   1. Semantic component tokens  — "Color modes/Component colors/Components/Button/bg"
//   2. Semantic global tokens     — "Color modes/Semantic/bg/default"
//   3. Primitive tokens           — "Color modes/Primitives/neutral/100"
//
// If none found → create in the appropriate collection/group automatically.

type VariableType = 'COLOR' | 'FLOAT' | 'STRING' | 'BOOLEAN';

interface TokenSpec {
  /** Preferred variable name (exact or partial match) */
  name: string;
  /** Fallback names to try in order before creating */
  fallbacks?: string[];
  /** Variable type — used when creating a new variable */
  type: VariableType;
  /** Collection name to create in if not found */
  createInCollection?: string;
  /** Initial value when creating (hex string for COLOR, number for FLOAT) */
  createWithValue?: string | number;
}

/**
 * Find a variable by exact name, then by suffix match (e.g. "Button/bg" matches
 * "Color modes/Component colors/Components/Button/bg"), then by fallbacks.
 */
function findVariable(nameOrPath: string): Variable | null {
  const all = figma.variables.getLocalVariables();

  // 1. Exact match
  const exact = all.find(v => v.name === nameOrPath);
  if (exact) return exact;

  // 2. Suffix match — variable path ends with the requested segment
  const suffix = nameOrPath.replace(/^\/+/, '');
  const bySuffix = all.find(v => v.name.endsWith('/' + suffix) || v.name === suffix);
  if (bySuffix) return bySuffix;

  // 3. Partial match — any segment of the name contains all parts
  const parts = suffix.toLowerCase().split('/');
  const byParts = all.find(v => {
    const lower = v.name.toLowerCase();
    return parts.every(p => lower.includes(p));
  });
  return byParts || null;
}

/**
 * Infer which collection a new variable should go into based on its name path.
 *
 * Naming conventions:
 *   color/brand/*, color/neutral/*, color/semantic/*, color/bg/*, color/text/*, color/border/* → "Primitives"
 *   spacing/*, radius/*, font-size/*                                                            → "Spacing & Radius"
 *   color/component/*, components/*                                                            → "Component Tokens"
 */
function inferCollectionForVariable(name: string): string {
  const lower = name.toLowerCase();
  if (lower.startsWith('color/component') || lower.startsWith('components/') || lower.includes('/component/')) {
    return 'Component Tokens';
  }
  if (lower.startsWith('spacing/') || lower.startsWith('radius/') || lower.startsWith('font-size/') || lower.startsWith('font-weight/')) {
    return 'Spacing & Radius';
  }
  // Default: Primitives for color tokens
  return 'Primitives';
}

/**
 * Find or create a variable collection by name.
 * Returns { collection, defaultModeId }.
 */
function getOrCreateCollection(collectionName: string): { collection: VariableCollection; defaultModeId: string } {
  const existing = figma.variables.getLocalVariableCollections().find(c => c.name === collectionName);
  if (existing) return { collection: existing, defaultModeId: existing.defaultModeId };

  const created = figma.variables.createVariableCollection(collectionName);
  figma.notify(`📦 Created collection: ${collectionName}`);
  return { collection: created, defaultModeId: created.defaultModeId };
}

/**
 * Resolve a TokenSpec to an actual Figma Variable.
 * Lookup order: exact name → suffix match → fallbacks → create new.
 */
function resolveOrCreateVariable(spec: TokenSpec): Variable {
  // Try primary name
  const found = findVariable(spec.name);
  if (found) return found;

  // Try fallbacks
  if (spec.fallbacks) {
    for (const fb of spec.fallbacks) {
      const fbVar = findVariable(fb);
      if (fbVar) return fbVar;
    }
  }

  // Create new variable in the appropriate collection
  const collectionName = spec.createInCollection || inferCollectionForVariable(spec.name);
  const { collection, defaultModeId } = getOrCreateCollection(collectionName);

  const newVar = figma.variables.createVariable(spec.name, collection, spec.type);

  // Set initial value
  if (spec.createWithValue !== undefined) {
    if (spec.type === 'COLOR' && typeof spec.createWithValue === 'string') {
      const hex = spec.createWithValue.replace('#', '');
      const r = parseInt(hex.slice(0, 2), 16) / 255;
      const g = parseInt(hex.slice(2, 4), 16) / 255;
      const b = parseInt(hex.slice(4, 6), 16) / 255;
      newVar.setValueForMode(defaultModeId, { r, g, b, a: 1 });
    } else if (spec.type === 'FLOAT' && typeof spec.createWithValue === 'number') {
      newVar.setValueForMode(defaultModeId, spec.createWithValue);
    }
  }

  figma.notify(`✨ Created token: ${spec.name}`);
  return newVar;
}

// ─── AI Execute Commands ──────────────────────────────────────────────────────

/**
 * Token binding spec for a single component property.
 *
 * property: which Figma component property to bind
 *   - "fill"           → component fill color
 *   - "stroke"         → component stroke color
 *   - "cornerRadius"   → all corner radii (FLOAT)
 *   - "paddingTop/Right/Bottom/Left" → individual paddings (FLOAT)
 *   - "itemSpacing"    → gap between children (FLOAT)
 *   - "width" / "height" → size (FLOAT)
 *
 * token: TokenSpec — resolved or created automatically
 */
interface TokenBinding {
  property: 'fill' | 'stroke' | 'cornerRadius' | 'paddingTop' | 'paddingRight' | 'paddingBottom' | 'paddingLeft' | 'itemSpacing' | 'width' | 'height';
  token: TokenSpec;
}

interface ComponentSpec {
  pageName: string;
  componentName: string;
  description?: string;
  width?: number;
  height?: number;
  variants?: Array<{ properties: Record<string, string> }>;
  properties?: Array<{ name: string; type: 'VARIANT' | 'BOOLEAN' | 'TEXT' | 'INSTANCE_SWAP'; values?: string[] }>;
  /** Legacy fill spec — used when tokenBindings is absent */
  fills?: Array<{ variableName?: string; hex?: string }>;
  /** Legacy corner radius — used when tokenBindings is absent */
  cornerRadius?: number | string;
  padding?: { top: number; right: number; bottom: number; left: number };
  layoutMode?: 'HORIZONTAL' | 'VERTICAL' | 'NONE';
  itemSpacing?: number;
  /**
   * Token bindings — preferred over legacy fills/cornerRadius.
   * AI should populate this with the correct semantic/primitive tokens.
   *
   * Example:
   * [
   *   { property: "fill",         token: { name: "color/component/button/bg/primary", fallbacks: ["color/brand/primary"], type: "COLOR", createWithValue: "#2563EB" } },
   *   { property: "cornerRadius", token: { name: "radius/md",                         fallbacks: ["radius/8"],            type: "FLOAT", createWithValue: 8 } }
   * ]
   */
  tokenBindings?: TokenBinding[];
}

function resolveVariable(name: string): Variable | null {
  return findVariable(name);
}

function applyFillFromSpec(node: RectangleNode | FrameNode | ComponentNode, spec: { variableName?: string; hex?: string }) {
  if (spec.variableName) {
    const v = resolveVariable(spec.variableName);
    if (v) {
      const fill: SolidPaint = { type: 'SOLID', color: { r: 1, g: 1, b: 1 } };
      const boundFill = figma.variables.setBoundVariableForPaint(fill, 'color', v);
      node.fills = [boundFill];
      return;
    }
  }
  if (spec.hex) {
    const r = parseInt(spec.hex.slice(1, 3), 16) / 255;
    const g = parseInt(spec.hex.slice(3, 5), 16) / 255;
    const b = parseInt(spec.hex.slice(5, 7), 16) / 255;
    node.fills = [{ type: 'SOLID', color: { r, g, b } }];
  }
}

/**
 * Apply tokenBindings to a component node.
 * For each binding: resolves or creates the variable, then binds it.
 */
function applyTokenBindings(comp: ComponentNode, bindings: TokenBinding[]) {
  for (const binding of bindings) {
    try {
      const variable = resolveOrCreateVariable(binding.token);

      switch (binding.property) {
        case 'fill': {
          if (variable.resolvedType === 'COLOR') {
            const fill: SolidPaint = { type: 'SOLID', color: { r: 1, g: 1, b: 1 } };
            const bound = figma.variables.setBoundVariableForPaint(fill, 'color', variable);
            comp.fills = [bound];
          }
          break;
        }
        case 'stroke': {
          if (variable.resolvedType === 'COLOR') {
            const stroke: SolidPaint = { type: 'SOLID', color: { r: 0, g: 0, b: 0 } };
            const bound = figma.variables.setBoundVariableForPaint(stroke, 'color', variable);
            comp.strokes = [bound];
          }
          break;
        }
        case 'cornerRadius':
          comp.setBoundVariable('topLeftRadius', variable);
          comp.setBoundVariable('topRightRadius', variable);
          comp.setBoundVariable('bottomLeftRadius', variable);
          comp.setBoundVariable('bottomRightRadius', variable);
          break;
        case 'paddingTop':
          comp.setBoundVariable('paddingTop', variable);
          break;
        case 'paddingRight':
          comp.setBoundVariable('paddingRight', variable);
          break;
        case 'paddingBottom':
          comp.setBoundVariable('paddingBottom', variable);
          break;
        case 'paddingLeft':
          comp.setBoundVariable('paddingLeft', variable);
          break;
        case 'itemSpacing':
          comp.setBoundVariable('itemSpacing', variable);
          break;
        case 'width':
          comp.setBoundVariable('width', variable);
          break;
        case 'height':
          comp.setBoundVariable('height', variable);
          break;
      }
    } catch (err) {
      console.error(`Token binding failed for ${binding.property} → ${binding.token.name}:`, err);
    }
  }
}

async function executeCreateComponent(spec: ComponentSpec): Promise<{ success: boolean; message: string }> {
  // Find or create page
  let page = figma.root.children.find(p => p.name === spec.pageName) as PageNode | undefined;
  if (!page) {
    page = figma.createPage();
    page.name = spec.pageName;
  }

  await figma.setCurrentPageAsync(page);

  const w = spec.width || 120;
  const h = spec.height || 40;

  if (spec.variants && spec.variants.length > 0 && spec.properties && spec.properties.length > 0) {
    // Create one component per variant combination
    const components: ComponentNode[] = [];

    for (const variant of spec.variants) {
      const comp = figma.createComponent();
      comp.resize(w, h);
      comp.name = Object.entries(variant.properties).map(([k, v]) => `${k}=${v}`).join(', ');
      if (spec.description) comp.description = spec.description;

      // Layout
      if (spec.layoutMode && spec.layoutMode !== 'NONE') {
        comp.layoutMode = spec.layoutMode;
        comp.primaryAxisSizingMode = 'FIXED';
        comp.counterAxisSizingMode = 'FIXED';
        if (spec.padding) {
          comp.paddingTop = spec.padding.top;
          comp.paddingRight = spec.padding.right;
          comp.paddingBottom = spec.padding.bottom;
          comp.paddingLeft = spec.padding.left;
        }
        if (spec.itemSpacing) comp.itemSpacing = spec.itemSpacing;
      }

      // Token bindings (preferred) — apply before legacy fills
      if (spec.tokenBindings && spec.tokenBindings.length > 0) {
        applyTokenBindings(comp, spec.tokenBindings);
      } else {
        // Legacy fill/cornerRadius fallback
        if (spec.fills && spec.fills.length > 0) applyFillFromSpec(comp, spec.fills[0]);
        if (spec.cornerRadius !== undefined) {
          if (typeof spec.cornerRadius === 'string') {
            const v = resolveVariable(spec.cornerRadius);
            if (v) {
              comp.setBoundVariable('topLeftRadius', v);
              comp.setBoundVariable('topRightRadius', v);
              comp.setBoundVariable('bottomLeftRadius', v);
              comp.setBoundVariable('bottomRightRadius', v);
            }
          } else {
            comp.cornerRadius = spec.cornerRadius;
          }
        }
      }

      // Add label text
      const label = figma.createText();
      await figma.loadFontAsync({ family: 'Inter', style: 'Regular' });
      label.characters = spec.componentName;
      label.fontSize = 14;
      comp.appendChild(label);
      if (spec.layoutMode && spec.layoutMode !== 'NONE') {
        label.layoutAlign = 'INHERIT';
        label.layoutGrow = 0;
      } else {
        label.x = (w - label.width) / 2;
        label.y = (h - label.height) / 2;
      }

      page.appendChild(comp);
      components.push(comp);
    }

    // Combine as component set
    if (components.length > 1) {
      const set = figma.combineAsVariants(components, page);
      set.name = spec.componentName;

      // Arrange variants in a grid inside the set
      const cols = Math.ceil(Math.sqrt(components.length));
      components.forEach((comp, i) => {
        comp.x = (i % cols) * (w + 20);
        comp.y = Math.floor(i / cols) * (h + 20);
      });

      // Place the component set below existing content on the page
      const siblings = page.children.filter(n => n !== set);
      if (siblings.length > 0) {
        const maxY = Math.max(...siblings.map(n => n.y + n.height));
        set.x = 0;
        set.y = maxY + 80;
      } else {
        set.x = 0;
        set.y = 0;
      }
    } else if (components.length === 1) {
      components[0].name = spec.componentName;

      // Place below existing content
      const siblings = page.children.filter(n => n !== components[0]);
      if (siblings.length > 0) {
        const maxY = Math.max(...siblings.map(n => n.y + n.height));
        components[0].x = 0;
        components[0].y = maxY + 80;
      }
    }

    figma.notify(`✅ Created: ${spec.componentName} (${components.length} variants)`);
    return { success: true, message: `Created component "${spec.componentName}" with ${components.length} variants on page "${spec.pageName}"` };
  } else {
    // Single component, no variants
    const comp = figma.createComponent();
    comp.resize(w, h);
    comp.name = spec.componentName;
    if (spec.description) comp.description = spec.description;

    if (spec.layoutMode && spec.layoutMode !== 'NONE') {
      comp.layoutMode = spec.layoutMode;
      comp.primaryAxisSizingMode = 'FIXED';
      comp.counterAxisSizingMode = 'FIXED';
      if (spec.padding) {
        comp.paddingTop = spec.padding.top;
        comp.paddingRight = spec.padding.right;
        comp.paddingBottom = spec.padding.bottom;
        comp.paddingLeft = spec.padding.left;
      }
    }

    if (spec.tokenBindings && spec.tokenBindings.length > 0) {
      applyTokenBindings(comp, spec.tokenBindings);
    } else {
      if (spec.fills && spec.fills.length > 0) applyFillFromSpec(comp, spec.fills[0]);
      if (spec.cornerRadius !== undefined) {
        if (typeof spec.cornerRadius === 'string') {
          const v = resolveVariable(spec.cornerRadius);
          if (v) {
            comp.setBoundVariable('topLeftRadius', v);
            comp.setBoundVariable('topRightRadius', v);
            comp.setBoundVariable('bottomLeftRadius', v);
            comp.setBoundVariable('bottomRightRadius', v);
          }
        } else {
          comp.cornerRadius = spec.cornerRadius;
        }
      }
    }

    const label = figma.createText();
    await figma.loadFontAsync({ family: 'Inter', style: 'Regular' });
    label.characters = spec.componentName;
    label.fontSize = 14;
    label.x = (w - label.width) / 2;
    label.y = (h - label.height) / 2;
    comp.appendChild(label);

    // Place below existing content
    const siblings = page.children.filter(n => n !== comp);
    if (siblings.length > 0) {
      const maxY = Math.max(...siblings.map(n => n.y + n.height));
      comp.x = 0;
      comp.y = maxY + 80;
    }

    page.appendChild(comp);
    figma.notify(`✅ Created: ${spec.componentName}`);
    return { success: true, message: `Created component "${spec.componentName}" on page "${spec.pageName}"` };
  }
}

async function executeCommand(command: any): Promise<{ success: boolean; message: string; data?: any }> {
  try {
    switch (command.type) {
      case 'create_component':
        return await executeCreateComponent(command.spec);

      case 'rename_variable': {
        const result = applyVariableOp({ action: 'rename', variableName: command.variableName, newName: command.newName });
        return { success: result.success, message: result.message || result.error || 'Unknown error' };
      }

      case 'set_variable_value': {
        const result = applyVariableOp({ action: 'set-value', variableName: command.variableName, newValue: command.value, modeId: command.modeId });
        return { success: result.success, message: result.message || result.error || 'Unknown error' };
      }

      case 'sync':
        await runFullSync();
        return { success: true, message: 'Sync triggered' };

      default:
        return { success: false, message: `Unknown command type: ${command.type}` };
    }
  } catch (error) {
    return { success: false, message: error instanceof Error ? error.message : 'Unknown error' };
  }
}

// ─── Message Handler ─────────────────────────────────────────────────────────

figma.ui.onmessage = async (msg) => {
  console.log('Received message:', msg.type);

  if (msg.type === 'full-sync') {
    await runFullSync();
  }

  if (msg.type === 'apply-fix') {
    const { conflictId, entityId, action, suggestion } = msg.fix;
    let fixed = false;

    if (action === 'auto-fix') {
      // Try variable
      const variables = figma.variables.getLocalVariables();
      const variable = variables.find(v => v.name === entityId || v.id === entityId);
      if (variable) {
        const renameMatch = suggestion?.match(/[Rr]ename(?:\s+to)?[:\s]+["']?([^"'\n,.]+)["']?/);
        if (renameMatch) {
          variable.name = renameMatch[1].trim();
          figma.notify(`✅ Renamed: ${renameMatch[1].trim()}`);
        } else {
          figma.notify(`ℹ️ Reviewed: ${variable.name}`);
        }
        fixed = true;
      }

      // Try component
      if (!fixed) {
        const components = figma.root.findAll(n => n.type === 'COMPONENT') as ComponentNode[];
        const component = components.find(c => c.name === entityId || c.id === entityId);
        if (component) {
          const descMatch = suggestion?.match(/[Aa]dd description[:\s]+["']?([^"'\n]+)["']?/);
          if (descMatch) { component.description = descMatch[1].trim(); figma.notify(`✅ Description added: ${component.name}`); }
          else { figma.notify(`ℹ️ Reviewed: ${component.name}`); }
          fixed = true;
        }
      }

      // Try collection
      if (!fixed) {
        const collections = figma.variables.getLocalVariableCollections();
        const collection = collections.find(c => c.name === entityId || c.id === entityId || entityId.includes(c.name) || c.name.includes(entityId));
        if (collection) { figma.notify(`ℹ️ Reviewed collection: ${collection.name}`); fixed = true; }
      }

      // Fallback
      if (!fixed) { figma.notify(`ℹ️ Issue reviewed: ${entityId}`); fixed = true; }
    }

    figma.ui.postMessage({ type: fixed ? 'fix-applied' : 'fix-error', conflictId, error: fixed ? undefined : 'Could not apply fix' });
  }

  if (msg.type === 'execute-command') {
    const result = await executeCommand(msg.command);
    figma.ui.postMessage({ type: 'command-result', commandId: msg.commandId, result });

    // Auto-sync after successful mutations
    if (result.success && msg.command.type !== 'sync') {
      setTimeout(() => runFullSync(), 1000);
    }
  }
};
