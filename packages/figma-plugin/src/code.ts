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

type VariableType = 'COLOR' | 'FLOAT' | 'STRING' | 'BOOLEAN';

interface TokenSpec {
  name: string;            // component token name, e.g. "button-primary-bg"
  fallbacks?: string[];    // fallback name lookups
  type: VariableType;
  createInCollection?: string;
  createWithValue?: string | number;  // hex or number — used only if no alias can be resolved
  aliasFor?: string[];     // ordered list of semantic/primitive token names to alias to
                           // e.g. ['color/brand/primary', 'color/brand/500']
                           // Plugin will alias to the first one found; falls back to createWithValue
}

function findVariable(nameOrPath: string): Variable | null {
  const all = figma.variables.getLocalVariables();

  // 1. Exact match
  const exact = all.find(v => v.name === nameOrPath);
  if (exact) return exact;

  // 2. Suffix match
  const suffix = nameOrPath.replace(/^\/+/, '');
  const bySuffix = all.find(v => v.name.endsWith('/' + suffix) || v.name === suffix);
  if (bySuffix) return bySuffix;

  // 3. Partial match — all path segments present
  const parts = suffix.toLowerCase().split('/');
  const byParts = all.find(v => {
    const lower = v.name.toLowerCase();
    return parts.every(p => lower.includes(p));
  });
  return byParts || null;
}

// ─── Value-based color matching ──────────────────────────────────────────────

function hexToRgbRaw(hex: string): { r: number; g: number; b: number } | null {
  const h = hex.replace('#', '');
  if (h.length !== 6) return null;
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  };
}

function colorDistance(a: { r: number; g: number; b: number }, b: RGB): number {
  // b is Figma RGB (0-1), a is raw (0-255)
  const dr = a.r / 255 - b.r;
  const dg = a.g / 255 - b.g;
  const db = a.b / 255 - b.b;
  return Math.sqrt(dr * dr + dg * dg + db * db);
}

/** Find the closest existing COLOR variable to a given hex. Returns null if nothing is close enough. */
function findClosestColorVariable(hex: string, threshold = 0.08): Variable | null {
  const target = hexToRgbRaw(hex);
  if (!target) return null;

  const colorVars = figma.variables.getLocalVariables().filter(v => v.resolvedType === 'COLOR');
  if (colorVars.length === 0) return null;

  let best: Variable | null = null;
  let bestDist = Infinity;

  for (const v of colorVars) {
    const collection = figma.variables.getVariableCollectionById(v.variableCollectionId);
    if (!collection) continue;
    const val = v.valuesByMode[collection.defaultModeId];
    if (!val || typeof val !== 'object' || !('r' in val)) continue;
    const dist = colorDistance(target, val as RGB);
    if (dist < bestDist) {
      bestDist = dist;
      best = v;
    }
  }

  return bestDist <= threshold ? best : null;
}

/** Find the closest existing FLOAT variable to a given number. Returns null if nothing is close enough. */
function findClosestFloatVariable(value: number, threshold = 2): Variable | null {
  const floatVars = figma.variables.getLocalVariables().filter(v => v.resolvedType === 'FLOAT');
  if (floatVars.length === 0) return null;

  let best: Variable | null = null;
  let bestDist = Infinity;

  for (const v of floatVars) {
    const collection = figma.variables.getVariableCollectionById(v.variableCollectionId);
    if (!collection) continue;
    const val = v.valuesByMode[collection.defaultModeId];
    if (typeof val !== 'number') continue;
    const dist = Math.abs(val - value);
    if (dist < bestDist) {
      bestDist = dist;
      best = v;
    }
  }

  return bestDist <= threshold ? best : null;
}

function inferCollectionForVariable(name: string): string {
  const lower = name.toLowerCase();
  // New flat component token names like "button-primary-bg"
  const componentPrefixes = ['button-', 'input-', 'badge-', 'card-', 'modal-', 'drawer-',
    'tooltip-', 'toast-', 'alert-', 'checkbox-', 'radio-', 'toggle-', 'select-', 'tab-'];
  if (componentPrefixes.some(p => lower.startsWith(p))) return 'Components';
  // Legacy path-style component tokens
  if (lower.startsWith('color/component') || lower.includes('/component/')) return 'Components';
  if (lower.startsWith('spacing/') || lower.startsWith('radius/') || lower.startsWith('font-size/') || lower.startsWith('font-weight/')) {
    return 'Spacing & Radius';
  }
  return 'Primitives';
}

function getOrCreateCollection(collectionName: string): { collection: VariableCollection; defaultModeId: string } {
  const existing = figma.variables.getLocalVariableCollections().find(c => c.name === collectionName);
  if (existing) return { collection: existing, defaultModeId: existing.defaultModeId };
  const created = figma.variables.createVariableCollection(collectionName);
  console.log(`📦 Created collection: ${collectionName}`);
  return { collection: created, defaultModeId: created.defaultModeId };
}

function resolveOrCreateVariable(spec: TokenSpec): Variable {
  // 1. Name-based lookup (exact → suffix → partial)
  const found = findVariable(spec.name);
  if (found) return found;

  // 2. Name-based fallback lookup
  if (spec.fallbacks) {
    for (const fb of spec.fallbacks) {
      const fbVar = findVariable(fb);
      if (fbVar) return fbVar;
    }
  }

  // 3. Nothing found by name — create a new token
  //    (value-based reuse is intentionally NOT done here: component tokens must have
  //     their own identity so they can be individually aliased to the right semantic token.
  //     Reusing e.g. color/semantic/error for input-bg would give wrong color.)
  const collectionName = spec.createInCollection || inferCollectionForVariable(spec.name);
  const { collection, defaultModeId } = getOrCreateCollection(collectionName);
  const newVar = figma.variables.createVariable(spec.name, collection, spec.type);

  // Try to alias to a semantic/primitive token first (preferred over raw hex)
  let aliased = false;
  if (spec.aliasFor && spec.aliasFor.length > 0) {
    for (const aliasName of spec.aliasFor) {
      const aliasTarget = findVariable(aliasName);
      if (aliasTarget) {
        newVar.setValueForMode(defaultModeId, figma.variables.createVariableAlias(aliasTarget));
        console.log(`🔗 Aliased "${spec.name}" → "${aliasTarget.name}"`);
        aliased = true;
        break;
      }
    }
  }

  // If no alias found: set raw value (safer than guessing a wrong alias)
  if (!aliased && spec.createWithValue !== undefined) {
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

  console.log(`✨ Created token: ${spec.name}`);
  return newVar;
}

// ─── Color helpers ────────────────────────────────────────────────────────────

function hexToRgb(hex: string): RGB {
  const h = hex.replace('#', '');
  return {
    r: parseInt(h.slice(0, 2), 16) / 255,
    g: parseInt(h.slice(2, 4), 16) / 255,
    b: parseInt(h.slice(4, 6), 16) / 255,
  };
}

function solidPaint(hex: string): SolidPaint {
  return { type: 'SOLID', color: hexToRgb(hex) };
}

function boundColorPaint(variable: Variable): SolidPaint {
  const base: SolidPaint = { type: 'SOLID', color: { r: 1, g: 1, b: 1 } };
  return figma.variables.setBoundVariableForPaint(base, 'color', variable) as SolidPaint;
}

function applyRadius(node: FrameNode | ComponentNode, variable: Variable) {
  node.setBoundVariable('topLeftRadius', variable);
  node.setBoundVariable('topRightRadius', variable);
  node.setBoundVariable('bottomLeftRadius', variable);
  node.setBoundVariable('bottomRightRadius', variable);
}


// ─── AI Execute Commands ──────────────────────────────────────────────────────

interface TokenBinding {
  property: 'fill' | 'stroke' | 'cornerRadius' | 'paddingTop' | 'paddingRight' | 'paddingBottom' | 'paddingLeft' | 'itemSpacing' | 'width' | 'height';
  token: TokenSpec;
}

// ─── Layer anatomy spec ───────────────────────────────────────────────────────
// AI can describe any component's internal structure via a layer tree.
// Plugin walks this tree and creates matching Figma nodes.

interface LayerSpec {
  type: 'frame' | 'text' | 'rectangle' | 'ellipse' | 'divider' | 'icon' | 'componentRef';
  name: string;
  // Layout
  layout?: 'horizontal' | 'vertical' | 'none';
  width?: number | 'fill' | 'hug';
  height?: number | 'fill' | 'hug';
  // Alignment
  primaryAlign?: 'min' | 'center' | 'max' | 'space-between';
  counterAlign?: 'min' | 'center' | 'max';
  // Spacing
  paddingH?: number;         // left + right
  paddingV?: number;         // top + bottom
  paddingLeft?: number;
  paddingRight?: number;
  paddingTop?: number;
  paddingBottom?: number;
  itemSpacing?: number;
  // Styling — accepts hex (#fff) or token name (color/brand/primary)
  fill?: string;
  stroke?: string;
  strokeWeight?: number;
  cornerRadius?: number;
  opacity?: number;
  // Text specific
  text?: string;
  fontSize?: number;
  fontWeight?: 400 | 500 | 600 | 700;
  textColor?: string;        // hex or token name
  textAlign?: 'left' | 'center' | 'right';
  // Clipping
  clip?: boolean;
  // Nesting
  children?: LayerSpec[];
  // Per-variant text override — key is "PropName=Value", value is replacement text
  // e.g. variantText: { "State=Error": "Error message" }
  variantText?: Record<string, string>;
  // Per-variant visibility — key is "PropName=Value", value is whether this layer is visible
  // e.g. variantCondition: { "State=Error": true, "State=Default": false }
  // If NO key in the map matches the current variant, the layer is always shown.
  variantCondition?: Record<string, boolean>;
  // Component instance embedding — inserts a real Figma component instance
  // type must be 'componentRef' to use this
  componentRef?: {
    componentName: string;                   // Exact Figma ComponentSet name e.g. "Button"
    variantProps?: Record<string, string>;   // e.g. { "Type": "Primary", "Size": "Medium" }
  };
}

interface ComponentSpec {
  pageName: string;
  componentName: string;
  description?: string;
  width?: number;
  height?: number;
  variants?: Array<{ properties: Record<string, string> }>;
  properties?: Array<{ name: string; type: 'VARIANT' | 'BOOLEAN' | 'TEXT' | 'INSTANCE_SWAP'; values?: string[] }>;
  fills?: Array<{ variableName?: string; hex?: string }>;
  cornerRadius?: number | string;
  padding?: { top: number; right: number; bottom: number; left: number };
  layoutMode?: 'HORIZONTAL' | 'VERTICAL' | 'NONE';
  itemSpacing?: number;
  tokenBindings?: TokenBinding[];
  /** AI-supplied mapping: component token name → existing variable name to alias to.
   *  e.g. { "button-primary-bg": "color/brand/primary" }
   *  Overrides the plugin's built-in aliasFor lists for matched token names. */
  tokenMappings?: Record<string, string>;
  /** Layer anatomy — AI describes the full internal structure of the component.
   *  When present, buildFromLayers() is used instead of the generic fallback.
   *  Supports any component: Toast, Avatar, Tag, Switch, Tooltip, List Item, etc. */
  layers?: LayerSpec[];
}

// ─── Layer anatomy engine ─────────────────────────────────────────────────────
// Recursively builds a Figma node tree from a LayerSpec[] description.
// Supports: frame, text, rectangle, ellipse, divider, icon.
// Fill/stroke/textColor accept either a hex string (#fff) or a token name
// (e.g. color/brand/primary) — token takes priority if found in local variables.

function resolveFillPaint(value: string): Paint {
  // Try to find a matching variable first
  const variable = findVariable(value);
  if (variable && variable.resolvedType === 'COLOR') {
    return boundColorPaint(variable);
  }
  // Fallback to treating as hex
  const hex = value.startsWith('#') ? value : `#${value}`;
  return solidPaint(hex.length >= 7 ? hex : '#888888');
}

function applyLayerSizing(
  node: FrameNode | RectangleNode,
  spec: LayerSpec,
  parent?: FrameNode | ComponentNode
) {
  if (node.type !== 'FRAME' && node.type !== 'RECTANGLE') return;

  const w = spec.width;
  const h = spec.height;

  // Width
  if (w === 'fill') {
    node.layoutGrow = 1;
    node.layoutSizingHorizontal = 'FILL';
  } else if (w === 'hug') {
    (node as FrameNode).primaryAxisSizingMode = 'AUTO';
    node.layoutSizingHorizontal = 'HUG';
  } else if (typeof w === 'number') {
    node.resize(w, node.height || 40);
    node.layoutSizingHorizontal = 'FIXED';
  }

  // Height
  if (h === 'fill') {
    node.layoutSizingVertical = 'FILL';
  } else if (h === 'hug') {
    (node as FrameNode).counterAxisSizingMode = 'AUTO';
    node.layoutSizingVertical = 'HUG';
  } else if (typeof h === 'number') {
    node.resize(node.width || 100, h);
    node.layoutSizingVertical = 'FIXED';
  }
}

function buildLayerNode(
  layerSpec: LayerSpec,
  variantProps: Record<string, string>,
  tokenMappings?: Record<string, string>
): SceneNode | null {
  // ── variantCondition: decide visibility before creating anything ──────────
  if (layerSpec.variantCondition) {
    const conditions = layerSpec.variantCondition;
    // Check if any key matches current variant props
    let matched = false;
    let visible = true;
    for (const [condKey, condValue] of Object.entries(conditions)) {
      // condKey format: "PropName=Value"
      const [propName, propValue] = condKey.split('=');
      if (variantProps[propName] === propValue) {
        matched = true;
        visible = condValue;
        break;
      }
    }
    // If a key matched and visibility is false, skip this node entirely
    if (matched && !visible) return null;
    // If no key matched, the layer is always shown (default visible)
  }

  const variantKey = Object.entries(variantProps).map(([k, v]) => `${k}=${v}`).join(',');

  switch (layerSpec.type) {
    case 'text': {
      const t = figma.createText();
      t.name = layerSpec.name;
      const style = layerSpec.fontWeight === 700 ? 'Bold'
                  : layerSpec.fontWeight === 600 ? 'Semi Bold'
                  : layerSpec.fontWeight === 500 ? 'Medium'
                  : 'Regular';
      t.fontName = { family: 'Inter', style };
      t.fontSize = layerSpec.fontSize || 14;

      // Check per-variant text override
      const overrideText = layerSpec.variantText?.[variantKey];
      t.characters = overrideText || layerSpec.text || layerSpec.name;
      t.textAutoResize = 'WIDTH_AND_HEIGHT';

      if (layerSpec.textAlign === 'center') t.textAlignHorizontal = 'CENTER';
      else if (layerSpec.textAlign === 'right') t.textAlignHorizontal = 'RIGHT';

      const textColor = layerSpec.textColor || '#18181B';
      const textVar = findVariable(textColor);
      if (textVar && textVar.resolvedType === 'COLOR') {
        t.fills = [boundColorPaint(textVar)];
      } else {
        t.fills = [solidPaint(textColor.startsWith('#') ? textColor : '#18181B')];
      }

      if (layerSpec.opacity !== undefined) t.opacity = layerSpec.opacity;
      return t;
    }

    case 'rectangle': {
      const r = figma.createRectangle();
      r.name = layerSpec.name;
      if (typeof layerSpec.width === 'number' && typeof layerSpec.height === 'number') {
        r.resize(layerSpec.width, layerSpec.height);
      } else {
        r.resize(layerSpec.width as number || 100, layerSpec.height as number || 40);
      }
      if (layerSpec.fill) r.fills = [resolveFillPaint(layerSpec.fill)];
      if (layerSpec.cornerRadius) r.cornerRadius = layerSpec.cornerRadius;
      if (layerSpec.opacity !== undefined) r.opacity = layerSpec.opacity;
      return r;
    }

    case 'ellipse': {
      const e = figma.createEllipse();
      e.name = layerSpec.name;
      const sz = typeof layerSpec.width === 'number' ? layerSpec.width : 40;
      e.resize(sz, typeof layerSpec.height === 'number' ? layerSpec.height : sz);
      if (layerSpec.fill) e.fills = [resolveFillPaint(layerSpec.fill)];
      if (layerSpec.opacity !== undefined) e.opacity = layerSpec.opacity;
      return e;
    }

    case 'divider': {
      const d = figma.createRectangle();
      d.name = layerSpec.name || 'Divider';
      const dw = typeof layerSpec.width === 'number' ? layerSpec.width : 200;
      d.resize(dw, layerSpec.height as number || 1);
      d.fills = [layerSpec.fill ? resolveFillPaint(layerSpec.fill) : solidPaint('#E4E4E7')];
      d.layoutGrow = 1;
      d.layoutSizingHorizontal = 'FILL';
      return d;
    }

    case 'icon': {
      // Icon placeholder: a small rounded rectangle with an "icon" label
      const iconFrame = figma.createFrame();
      iconFrame.name = layerSpec.name || 'Icon';
      const iconSz = typeof layerSpec.width === 'number' ? layerSpec.width : 16;
      iconFrame.resize(iconSz, typeof layerSpec.height === 'number' ? layerSpec.height : iconSz);
      iconFrame.layoutMode = 'NONE';
      iconFrame.fills = [layerSpec.fill ? resolveFillPaint(layerSpec.fill) : solidPaint('#71717A')];
      if (layerSpec.cornerRadius) iconFrame.cornerRadius = layerSpec.cornerRadius;
      else iconFrame.cornerRadius = 2;
      if (layerSpec.opacity !== undefined) iconFrame.opacity = layerSpec.opacity;
      return iconFrame;
    }

    case 'componentRef': {
      // Find an existing ComponentSet by name, pick the best matching variant, create an instance
      const ref = layerSpec.componentRef;
      if (!ref) return null;

      const allSets = figma.root.findAll(
        n => n.type === 'COMPONENT_SET' && n.name === ref.componentName
      ) as ComponentSetNode[];

      if (allSets.length === 0) {
        // Component not yet created — create a placeholder frame
        const placeholder = figma.createFrame();
        placeholder.name = `[ref: ${ref.componentName}]`;
        placeholder.resize(100, 36);
        placeholder.fills = [solidPaint('#F4F4F5')];
        placeholder.cornerRadius = 4;
        return placeholder;
      }

      const compSet = allSets[0];
      let targetComp: ComponentNode | null = null;

      if (ref.variantProps && Object.keys(ref.variantProps).length > 0) {
        // Find the variant whose properties are a superset of the requested variantProps
        const candidates = compSet.children as ComponentNode[];
        let bestScore = -1;

        for (const candidate of candidates) {
          const props = candidate.variantProperties || {};
          let score = 0;
          let mismatch = false;
          for (const [k, v] of Object.entries(ref.variantProps)) {
            if (props[k] === v) {
              score++;
            } else if (props[k] !== undefined) {
              // Key exists but value differs — penalise
              mismatch = true;
              break;
            }
          }
          if (!mismatch && score > bestScore) {
            bestScore = score;
            targetComp = candidate;
          }
        }
      }

      // Fallback: first child
      if (!targetComp) targetComp = compSet.children[0] as ComponentNode;

      const instance = targetComp.createInstance();
      instance.name = layerSpec.name;

      // Apply sizing if specified
      if (typeof layerSpec.width === 'number' || typeof layerSpec.height === 'number') {
        const iw = typeof layerSpec.width === 'number' ? layerSpec.width : instance.width;
        const ih = typeof layerSpec.height === 'number' ? layerSpec.height : instance.height;
        instance.resize(iw, ih);
      }
      if (layerSpec.width === 'fill') {
        instance.layoutSizingHorizontal = 'FILL';
      }
      if (layerSpec.height === 'fill') {
        instance.layoutSizingVertical = 'FILL';
      }
      if (layerSpec.opacity !== undefined) instance.opacity = layerSpec.opacity;

      return instance;
    }

    case 'frame':
    default: {
      const f = figma.createFrame();
      f.name = layerSpec.name;

      // Layout
      const layout = (layerSpec.layout || 'horizontal').toLowerCase();
      f.layoutMode = layout === 'vertical' ? 'VERTICAL'
                   : layout === 'none'     ? 'NONE'
                   : 'HORIZONTAL';

      if (f.layoutMode !== 'NONE') {
        // Primary axis sizing
        const wSpec = layerSpec.width;
        if (wSpec === 'hug' || wSpec === undefined) {
          f.primaryAxisSizingMode = 'AUTO';
        } else if (wSpec === 'fill') {
          f.layoutGrow = 1;
          f.layoutSizingHorizontal = 'FILL';
        } else if (typeof wSpec === 'number') {
          f.resize(wSpec, f.height || 40);
          f.primaryAxisSizingMode = 'FIXED';
        }

        // Counter axis sizing
        const hSpec = layerSpec.height;
        if (hSpec === 'hug' || hSpec === undefined) {
          f.counterAxisSizingMode = 'AUTO';
        } else if (hSpec === 'fill') {
          f.layoutSizingVertical = 'FILL';
        } else if (typeof hSpec === 'number') {
          f.resize(f.width || 100, hSpec);
          f.counterAxisSizingMode = 'FIXED';
        }

        // Alignment
        const pa = layerSpec.primaryAlign || 'center';
        f.primaryAxisAlignItems = pa === 'min' ? 'MIN' : pa === 'max' ? 'MAX' : pa === 'space-between' ? 'SPACE_BETWEEN' : 'CENTER';
        const ca = layerSpec.counterAlign || 'center';
        f.counterAxisAlignItems = ca === 'min' ? 'MIN' : ca === 'max' ? 'MAX' : 'CENTER';

        // Padding
        f.paddingLeft   = layerSpec.paddingLeft   ?? layerSpec.paddingH ?? 0;
        f.paddingRight  = layerSpec.paddingRight  ?? layerSpec.paddingH ?? 0;
        f.paddingTop    = layerSpec.paddingTop    ?? layerSpec.paddingV ?? 0;
        f.paddingBottom = layerSpec.paddingBottom ?? layerSpec.paddingV ?? 0;
        f.itemSpacing   = layerSpec.itemSpacing ?? 0;
      } else {
        // Free layout — set absolute size if given
        if (typeof layerSpec.width === 'number' && typeof layerSpec.height === 'number') {
          f.resize(layerSpec.width, layerSpec.height);
        }
      }

      // Fill
      if (layerSpec.fill) {
        f.fills = [resolveFillPaint(layerSpec.fill)];
      } else {
        f.fills = [];
      }

      // Stroke
      if (layerSpec.stroke) {
        const strokeVar = findVariable(layerSpec.stroke);
        if (strokeVar && strokeVar.resolvedType === 'COLOR') {
          f.strokes = [boundColorPaint(strokeVar)];
        } else {
          f.strokes = [solidPaint(layerSpec.stroke.startsWith('#') ? layerSpec.stroke : '#E4E4E7')];
        }
        f.strokeWeight = layerSpec.strokeWeight ?? 1;
        f.strokeAlign = 'INSIDE';
      }

      // Corner radius
      if (layerSpec.cornerRadius !== undefined) {
        // Check if it's a token name
        const radVar = typeof layerSpec.cornerRadius === 'number' ? null : findVariable(String(layerSpec.cornerRadius));
        if (radVar) {
          applyRadius(f, radVar);
        } else {
          f.cornerRadius = layerSpec.cornerRadius;
        }
      }

      // Opacity
      if (layerSpec.opacity !== undefined) f.opacity = layerSpec.opacity;

      // Clip content
      if (layerSpec.clip) f.clipsContent = true;

      // Recursively build children
      if (layerSpec.children) {
        for (const childSpec of layerSpec.children) {
          const child = buildLayerNode(childSpec, variantProps, tokenMappings);
          if (child) f.appendChild(child);
        }
      }

      return f;
    }
  }
}

async function buildFromLayers(
  spec: ComponentSpec,
  variantProps: Record<string, string>
): Promise<ComponentNode> {
  const comp = figma.createComponent();
  comp.name = Object.keys(variantProps).length > 0
    ? Object.entries(variantProps).map(([k, v]) => `${k}=${v}`).join(', ')
    : spec.componentName;
  if (spec.description) comp.description = spec.description;

  comp.fills = [];

  // The first layer in spec.layers is treated as the root/wrapper layer.
  // Its layout, padding, fill, stroke, size, and cornerRadius are applied
  // directly to the ComponentNode — its children become the component's children.
  // Any additional top-level layers are appended as siblings.
  const layers = spec.layers ?? [];
  const [rootLayer, ...extraLayers] = layers;

  if (rootLayer) {
    // Apply layout
    const layout = (rootLayer.layout || 'horizontal').toLowerCase();
    comp.layoutMode = layout === 'vertical' ? 'VERTICAL'
                    : layout === 'none'     ? 'NONE'
                    : 'HORIZONTAL';

    if (comp.layoutMode !== 'NONE') {
      // Sizing
      comp.primaryAxisSizingMode = rootLayer.width  === undefined || rootLayer.width  === 'hug' ? 'AUTO' : 'FIXED';
      comp.counterAxisSizingMode = rootLayer.height === undefined || rootLayer.height === 'hug' ? 'AUTO' : 'FIXED';

      if (typeof rootLayer.width  === 'number') comp.resize(rootLayer.width, comp.height || 40);
      if (typeof rootLayer.height === 'number') comp.resize(comp.width || 100, rootLayer.height);

      // Alignment
      const pa = rootLayer.primaryAlign || 'center';
      comp.primaryAxisAlignItems = pa === 'min' ? 'MIN' : pa === 'max' ? 'MAX' : pa === 'space-between' ? 'SPACE_BETWEEN' : 'CENTER';
      const ca = rootLayer.counterAlign || 'center';
      comp.counterAxisAlignItems = ca === 'min' ? 'MIN' : ca === 'max' ? 'MAX' : 'CENTER';

      // Padding
      comp.paddingLeft   = rootLayer.paddingLeft   ?? rootLayer.paddingH ?? 0;
      comp.paddingRight  = rootLayer.paddingRight  ?? rootLayer.paddingH ?? 0;
      comp.paddingTop    = rootLayer.paddingTop    ?? rootLayer.paddingV ?? 0;
      comp.paddingBottom = rootLayer.paddingBottom ?? rootLayer.paddingV ?? 0;
      comp.itemSpacing   = rootLayer.itemSpacing ?? 0;
    } else {
      // NONE layout — absolute size
      if (typeof rootLayer.width === 'number' && typeof rootLayer.height === 'number') {
        comp.resize(rootLayer.width, rootLayer.height);
      }
    }

    // Fill
    if (rootLayer.fill) {
      comp.fills = [resolveFillPaint(rootLayer.fill)];
    }

    // Stroke
    if (rootLayer.stroke) {
      const strokeVar = findVariable(rootLayer.stroke);
      if (strokeVar && strokeVar.resolvedType === 'COLOR') {
        comp.strokes = [boundColorPaint(strokeVar)];
      } else {
        comp.strokes = [solidPaint(rootLayer.stroke.startsWith('#') ? rootLayer.stroke : '#E4E4E7')];
      }
      comp.strokeWeight = rootLayer.strokeWeight ?? 1;
      comp.strokeAlign = 'INSIDE';
    }

    // Corner radius
    if (rootLayer.cornerRadius !== undefined) {
      const radVar = typeof rootLayer.cornerRadius === 'number' ? null : findVariable(String(rootLayer.cornerRadius));
      if (radVar) {
        applyRadius(comp, radVar);
      } else {
        comp.cornerRadius = rootLayer.cornerRadius as number;
      }
    }

    // Opacity
    if (rootLayer.opacity !== undefined) comp.opacity = rootLayer.opacity;

    // Clip
    if (rootLayer.clip) comp.clipsContent = true;

    // Root layer's children → component children
    if (rootLayer.children) {
      for (const childSpec of rootLayer.children) {
        const node = buildLayerNode(childSpec, variantProps, spec.tokenMappings);
        if (node) comp.appendChild(node);
      }
    }
  }

  // Any extra top-level layers are appended as additional children
  for (const layerSpec of extraLayers) {
    const node = buildLayerNode(layerSpec, variantProps, spec.tokenMappings);
    if (node) comp.appendChild(node);
  }

  return comp;
}

async function buildComponentNode(
  spec: ComponentSpec,
  variantProps: Record<string, string>
): Promise<ComponentNode> {
  await figma.loadFontAsync({ family: 'Inter', style: 'Regular' });
  await figma.loadFontAsync({ family: 'Inter', style: 'Medium' });
  await figma.loadFontAsync({ family: 'Inter', style: 'Semi Bold' });
  return buildFromLayers(spec, variantProps);
}

async function executeCreateComponent(spec: ComponentSpec): Promise<{ success: boolean; message: string }> {
  let page = figma.root.children.find(p => p.name === spec.pageName) as PageNode | undefined;
  if (!page) {
    page = figma.createPage();
    page.name = spec.pageName;
  }
  await figma.setCurrentPageAsync(page);

  if (spec.variants && spec.variants.length > 0 && spec.properties && spec.properties.length > 0) {
    const components: ComponentNode[] = [];

    for (const variant of spec.variants) {
      const comp = await buildComponentNode(spec, variant.properties);
      page.appendChild(comp);
      components.push(comp);
    }

    if (components.length > 1) {
      // Capture existing content bounds BEFORE combining (combineAsVariants moves nodes)
      const existingNodes = page.children.filter(n => !components.includes(n as ComponentNode));
      const placeY = existingNodes.length > 0
        ? Math.max(...existingNodes.map(n => n.y + n.height)) + 80
        : 0;

      const set = figma.combineAsVariants(components, page);
      set.name = spec.componentName;
      set.fills = [];
      set.strokes = [];

      // Free-form grid: last property = columns, earlier properties = rows
      const PAD = 40;
      const GAP_X = 24;
      const GAP_Y = 16;
      const props = spec.properties || [];
      const colProp = props[props.length - 1];
      const numCols = colProp?.values?.length || 1;
      const numRows = Math.ceil(components.length / numCols);

      // Compute per-column max width and per-row max height for aligned grid
      const colWidths = Array.from({ length: numCols }, (_, col) =>
        Math.max(...components.filter((_, i) => i % numCols === col).map(c => c.width))
      );
      const rowHeights = Array.from({ length: numRows }, (_, row) =>
        Math.max(...components.filter((_, i) => Math.floor(i / numCols) === row).map(c => c.height))
      );

      // Compute column X offsets from cumulative widths
      const colX = colWidths.reduce<number[]>((acc, _w, i) => {
        acc.push(i === 0 ? PAD : acc[i - 1] + colWidths[i - 1] + GAP_X);
        return acc;
      }, []);
      const rowY = rowHeights.reduce<number[]>((acc, _h, i) => {
        acc.push(i === 0 ? PAD : acc[i - 1] + rowHeights[i - 1] + GAP_Y);
        return acc;
      }, []);

      // Position every variant inside the set with padding offset
      components.forEach((comp, i) => {
        const col = i % numCols;
        const row = Math.floor(i / numCols);
        comp.x = colX[col];
        comp.y = rowY[row];
      });

      // Resize the set to exactly hug all variants + padding
      const maxX = Math.max(...components.map(c => c.x + c.width));
      const maxY2 = Math.max(...components.map(c => c.y + c.height));
      set.resizeWithoutConstraints(maxX + PAD, maxY2 + PAD);

      // Place below existing content
      set.x = 0;
      set.y = placeY;
    } else if (components.length === 1) {
      components[0].name = spec.componentName;
      const siblings = page.children.filter(n => n !== components[0]);
      if (siblings.length > 0) {
        const maxY = Math.max(...siblings.map(n => n.y + n.height));
        components[0].x = 0;
        components[0].y = maxY + 80;
      }
    }

    figma.notify(`✅ Created: ${spec.componentName} (${components.length} variants)`);
    return { success: true, message: `Created "${spec.componentName}" with ${components.length} variants on page "${spec.pageName}"` };

  } else {
    const comp = await buildComponentNode(spec, {});
    comp.name = spec.componentName;

    const siblings = page.children.filter(n => n !== comp);
    if (siblings.length > 0) {
      const maxY = Math.max(...siblings.map(n => n.y + n.height));
      comp.x = 0;
      comp.y = maxY + 80;
    }
    page.appendChild(comp);

    figma.notify(`✅ Created: ${spec.componentName}`);
    return { success: true, message: `Created "${spec.componentName}" on page "${spec.pageName}"` };
  }
}

async function executeCommand(command: any): Promise<{ success: boolean; message: string; data?: any }> {
  try {
    switch (command.type) {
      case 'create_component':
        return await executeCreateComponent(command.spec);

      case 'rename_variable': {
        const renameSpec = command.spec || command;
        const result = applyVariableOp({ action: 'rename', variableName: renameSpec.oldName || command.variableName, newName: renameSpec.newName || command.newName });
        return { success: result.success, message: result.message || result.error || 'Unknown error' };
      }

      case 'set_variable_value': {
        // Support both single spec and array spec
        const rawSpec = command.spec ?? { variableName: command.variableName, value: command.value };
        const entries: Array<{ variableName: string; value: any }> = Array.isArray(rawSpec) ? rawSpec : [rawSpec];

        let count = 0;
        const errors: string[] = [];

        for (const entry of entries) {
          const { variableName, value } = entry;
          if (!variableName) continue;

          // Determine type from value
          const inferredType: VariableType = typeof value === 'string' ? 'COLOR' : 'FLOAT';

          // Resolve or create the variable
          const variable = resolveOrCreateVariable({
            name: variableName,
            type: inferredType,
            createWithValue: value,
          });

          // Set value in default mode
          const collection = figma.variables.getVariableCollectionById(variable.variableCollectionId);
          const modeId = command.modeId || collection?.defaultModeId;
          if (!modeId) { errors.push(`No modeId for ${variableName}`); continue; }

          if (inferredType === 'COLOR' && typeof value === 'string') {
            const hex = value.replace('#', '');
            const r = parseInt(hex.slice(0, 2), 16) / 255;
            const g = parseInt(hex.slice(2, 4), 16) / 255;
            const b = parseInt(hex.slice(4, 6), 16) / 255;
            variable.setValueForMode(modeId, { r, g, b, a: 1 });
          } else {
            variable.setValueForMode(modeId, value);
          }
          count++;
        }

        console.log(`✅ Set ${count} variable(s)`);
        return { success: true, message: `Set ${count} variable(s)${errors.length > 0 ? ` (${errors.length} errors)` : ''}` };
      }

      case 'sync':
        await runFullSync();
        return { success: true, message: 'Sync triggered' };

      case 'delete_variables': {
        const names: string[] = Array.isArray(command.spec?.variableNames)
          ? command.spec.variableNames
          : [];
        const deleted: string[] = [];
        const notFound: string[] = [];

        for (const name of names) {
          const v = figma.variables.getLocalVariables().find(x => x.name === name);
          if (v) {
            v.remove();
            deleted.push(name);
          } else {
            notFound.push(name);
          }
        }

        const msg = `Deleted ${deleted.length} variable(s)${notFound.length > 0 ? `, ${notFound.length} not found` : ''}`;
        console.log(`✅ ${msg}`);
        return { success: true, message: msg };
      }

      case 'list_pages': {
        const pages = figma.root.children.map(p => ({
          id: p.id,
          name: p.name,
          nodeCount: p.children.length,
        }));
        return {
          success: true,
          message: `Found ${pages.length} page(s)`,
          data: { pages },
        };
      }

      case 'create_page': {
        const pageName = command.spec?.pageName;
        if (!pageName) return { success: false, message: 'pageName is required' };

        // Check if already exists
        const existing = figma.root.children.find(p => p.name === pageName);
        if (existing) {
          return { success: true, message: `Page "${pageName}" already exists`, data: { id: existing.id, name: existing.name } };
        }

        const newPage = figma.createPage();
        newPage.name = pageName;
        return { success: true, message: `Created page "${pageName}"`, data: { id: newPage.id, name: newPage.name } };
      }

      case 'update_component': {
        const spec = command.spec;
        if (!spec?.componentName) return { success: false, message: 'componentName is required' };

        // Find the component set by name
        const allNodes = figma.root.findAll(n =>
          n.type === 'COMPONENT_SET' && n.name === spec.componentName
        ) as ComponentSetNode[];

        if (allNodes.length === 0) {
          return { success: false, message: `Component set "${spec.componentName}" not found` };
        }

        const compSet = allNodes[0];
        let changes = 0;

        // Update description
        if (spec.description !== undefined) {
          compSet.description = spec.description;
          changes++;
        }

        // Update token bindings on all children
        if (spec.tokenMappings && typeof spec.tokenMappings === 'object') {
          const children = compSet.children as ComponentNode[];
          for (const child of children) {
            for (const [tokenName, varName] of Object.entries(spec.tokenMappings as Record<string, string>)) {
              const variable = findVariable(varName) || findVariable(tokenName);
              if (!variable) continue;

              // Apply radius/padding bindings that are bindable via setBoundVariable
              if (tokenName.includes('radius')) {
                try {
                  child.setBoundVariable('topLeftRadius', variable);
                  child.setBoundVariable('topRightRadius', variable);
                  child.setBoundVariable('bottomLeftRadius', variable);
                  child.setBoundVariable('bottomRightRadius', variable);
                  changes++;
                } catch { /* ignore */ }
              } else if (tokenName.includes('padding') || tokenName.includes('spacing')) {
                try {
                  child.setBoundVariable('paddingLeft', variable);
                  child.setBoundVariable('paddingRight', variable);
                  child.setBoundVariable('paddingTop', variable);
                  child.setBoundVariable('paddingBottom', variable);
                  changes++;
                } catch { /* ignore */ }
              }
            }
          }
        }

        // Add new variants if requested
        if (Array.isArray(spec.addVariants) && spec.addVariants.length > 0) {
          const newComponents: ComponentNode[] = [];
          for (const variantSpec of spec.addVariants) {
            const comp = figma.createComponent();
            comp.name = Object.entries(variantSpec.properties)
              .map(([k, v]) => `${k}=${v}`)
              .join(', ');
            comp.resize(compSet.width / Math.max(compSet.children.length, 1), 40);
            newComponents.push(comp);
          }

          if (newComponents.length > 0) {
            for (const comp of newComponents) {
              compSet.appendChild(comp);
            }
            changes += newComponents.length;
          }
        }

        return { success: true, message: `Updated "${spec.componentName}" (${changes} change(s))` };
      }

      default:
        return { success: false, message: `Unknown command type: ${command.type}` };
    }
  } catch (error) {
    return { success: false, message: error instanceof Error ? error.message : 'Unknown error' };
  }
}

// ─── Message Handler ─────────────────────────────────────────────────────────

figma.ui.onmessage = async (msg) => {
  // Resize plugin window
  if (msg.type === 'resize') {
    figma.ui.resize(msg.width ?? 300, msg.height ?? 420);
    return;
  }

  console.log('Received message:', msg.type);

  if (msg.type === 'full-sync') {
    await runFullSync();
  }

  if (msg.type === 'apply-fix') {
    const { conflictId, entityId, action, suggestion } = msg.fix;
    let fixed = false;

    if (action === 'auto-fix') {
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

      if (!fixed) {
        const collections = figma.variables.getLocalVariableCollections();
        const collection = collections.find(c =>
          c.name === entityId || c.id === entityId ||
          entityId.includes(c.name) || c.name.includes(entityId)
        );
        if (collection) { figma.notify(`ℹ️ Reviewed collection: ${collection.name}`); fixed = true; }
      }

      if (!fixed) { figma.notify(`ℹ️ Issue reviewed: ${entityId}`); fixed = true; }
    }

    figma.ui.postMessage({ type: fixed ? 'fix-applied' : 'fix-error', conflictId, error: fixed ? undefined : 'Could not apply fix' });
  }

  if (msg.type === 'execute-command') {
    const result = await executeCommand(msg.command);
    figma.ui.postMessage({ type: 'command-result', commandId: msg.commandId, result });

    if (result.success && msg.command.type !== 'sync') {
      setTimeout(() => runFullSync(), 1500);
    }
  }

  // ─── Auth persistence via clientStorage ──────────────────────────────────
  if (msg.type === 'get-auth') {
    const stored = await figma.clientStorage.getAsync('auth');
    figma.ui.postMessage({ type: 'auth-restored', auth: stored || null });
  }

  if (msg.type === 'save-auth') {
    await figma.clientStorage.setAsync('auth', msg.auth);
  }

  if (msg.type === 'clear-auth') {
    await figma.clientStorage.deleteAsync('auth');
  }

  if (msg.type === 'open-external') {
    figma.openExternal(msg.url);
  }
};
