// Figma Plugin Code (Backend)
console.log('Tokenhaus Plugin Loaded');

figma.showUI(__html__, { width: 400, height: 600 });

// ─── Sync ────────────────────────────────────────────────────────────────────

async function runFullSync() {
  try {
    const variables = await figma.variables.getLocalVariablesAsync();
    const collections = await figma.variables.getLocalVariableCollectionsAsync();
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

async function applyVariableOp(op: { action: string; variableId?: string; variableName?: string; newName?: string; newValue?: any; modeId?: string }) {
  const variables = await figma.variables.getLocalVariablesAsync();
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

// Variable lookup cache — populated before each operation that needs it.
// Avoids repeated async calls and keeps resolveColorValue/resolveFloatVariable sync.
let _variableCache: Variable[] = [];

async function refreshVariableCache(): Promise<void> {
  _variableCache = await figma.variables.getLocalVariablesAsync();
}

function findVariable(nameOrPath: string): Variable | null {
  const all = _variableCache;

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

async function getOrCreateCollection(collectionName: string): Promise<{ collection: VariableCollection; defaultModeId: string }> {
  const all = await figma.variables.getLocalVariableCollectionsAsync();
  const existing = all.find(c => c.name === collectionName);
  if (existing) return { collection: existing, defaultModeId: existing.defaultModeId };
  const created = figma.variables.createVariableCollection(collectionName);
  console.log(`📦 Created collection: ${collectionName}`);
  return { collection: created, defaultModeId: created.defaultModeId };
}

async function resolveOrCreateVariable(spec: TokenSpec): Promise<Variable> {
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
  const { collection, defaultModeId } = await getOrCreateCollection(collectionName);
  const newVar = figma.variables.createVariable(spec.name, collection.id, spec.type);

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

  // Update cache so subsequent findVariable() calls in this command see the new var
  _variableCache.push(newVar);

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

function applyRadius(node: FrameNode | ComponentNode | RectangleNode, variable: Variable) {
  node.setBoundVariable('topLeftRadius', variable);
  node.setBoundVariable('topRightRadius', variable);
  node.setBoundVariable('bottomLeftRadius', variable);
  node.setBoundVariable('bottomRightRadius', variable);
}


// ─── Layer anatomy spec ───────────────────────────────────────────────────────
// AI can describe any component's internal structure via a layer tree.
// Plugin walks this tree and creates matching Figma nodes.

// Per-variant style overrides applied on top of base styles when the variant matches.
// Key format: "PropName=Value" e.g. "Type=Primary" or "State=Hover"
// All style properties are optional — only specified ones are overridden.
interface VariantStyleOverride {
  fill?: string;
  stroke?: string;
  strokeWeight?: number;
  textColor?: string;
  fontSize?: number;
  fontWeight?: 400 | 500 | 600 | 700;
  opacity?: number;
  cornerRadius?: number | string;
  paddingH?: number;
  paddingV?: number;
  paddingLeft?: number;
  paddingRight?: number;
  paddingTop?: number;
  paddingBottom?: number;
  itemSpacing?: number;
  width?: number | 'fill' | 'hug';
  height?: number | 'fill' | 'hug';
  text?: string;
}

interface LayerSpec {
  type: 'frame' | 'text' | 'rectangle' | 'ellipse' | 'divider' | 'icon' | 'componentRef';
  name: string;
  // Layout
  layout?: 'horizontal' | 'vertical' | 'none';
  width?: number | 'fill' | 'hug';
  height?: number | 'fill' | 'hug';
  // Absolute positioning (for layout:'none' parents)
  x?: number;
  y?: number;
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
  cornerRadius?: number | string;  // number for raw px, string for token name (e.g. "radius/md")
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
  // Per-variant style overrides — applies style changes when a variant property matches.
  // Key format: "PropName=Value" e.g. { "Type=Primary": { fill: "color/brand/primary" } }
  // Multiple keys can match simultaneously (all matching overrides are applied in order).
  variantStyles?: Record<string, VariantStyleOverride>;
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
  variants?: Array<{ properties: Record<string, string> }>;
  properties?: Array<{ name: string; type: 'VARIANT' | 'BOOLEAN' | 'TEXT' | 'INSTANCE_SWAP'; values?: string[] }>;
  /** AI-supplied mapping: component token name → existing variable name.
   *  e.g. { "btn-bg": "color/brand/primary" }
   *  During layer building, fill/stroke/textColor/cornerRadius values matching a key
   *  are resolved via the mapped variable name instead of a direct lookup. */
  tokenMappings?: Record<string, string>;
  /** Layer anatomy — AI describes the full internal structure of the component.
   *  Root layer (layers[0]) properties are applied to the ComponentNode directly.
   *  Use fill/stroke/textColor/cornerRadius with either a hex (#fff) or token name. */
  layers?: LayerSpec[];
}

// ─── Layer anatomy engine ─────────────────────────────────────────────────────
// Recursively builds a Figma node tree from a LayerSpec[] description.
// Supports: frame, text, rectangle, ellipse, divider, icon.
// Fill/stroke/textColor accept either a hex string (#fff) or a token name
// (e.g. color/brand/primary) — token takes priority if found in local variables.

// ─── Variant matching helpers ─────────────────────────────────────────────────

/**
 * Check whether a single condition key ("PropName=Value") matches the current variant props.
 * Supports multi-condition keys joined by "," e.g. "Type=Primary,State=Hover"
 */
function matchesCondition(condKey: string, variantProps: Record<string, string>): boolean {
  const pairs = condKey.split(',').map(s => s.trim());
  return pairs.every(pair => {
    const eqIdx = pair.indexOf('=');
    if (eqIdx === -1) return false;
    const propName = pair.slice(0, eqIdx).trim();
    const propValue = pair.slice(eqIdx + 1).trim();
    return variantProps[propName] === propValue;
  });
}

/**
 * Resolve variantStyles for the current variant props.
 * All keys that match are collected and merged in order (later keys win).
 */
function resolveVariantStyles(
  variantStyles: Record<string, VariantStyleOverride> | undefined,
  variantProps: Record<string, string>
): VariantStyleOverride {
  if (!variantStyles) return {};
  const merged: VariantStyleOverride = {};
  for (const [condKey, overrides] of Object.entries(variantStyles)) {
    if (matchesCondition(condKey, variantProps)) {
      Object.assign(merged, overrides);
    }
  }
  return merged;
}

function resolveColorValue(value: string, tokenMappings?: Record<string, string>): Variable | null {
  // tokenMappings override: if AI mapped this token name to an existing variable, use that
  if (tokenMappings && tokenMappings[value]) {
    const mapped = findVariable(tokenMappings[value]);
    if (mapped && mapped.resolvedType === 'COLOR') return mapped;
  }
  const variable = findVariable(value);
  if (variable && variable.resolvedType === 'COLOR') return variable;
  return null;
}

function resolveFloatVariable(value: string, tokenMappings?: Record<string, string>): Variable | null {
  if (tokenMappings && tokenMappings[value]) {
    const mapped = findVariable(tokenMappings[value]);
    if (mapped && mapped.resolvedType === 'FLOAT') return mapped;
  }
  const variable = findVariable(value);
  if (variable && variable.resolvedType === 'FLOAT') return variable;
  return null;
}

function resolveFillPaint(value: string, tokenMappings?: Record<string, string>): Paint {
  const variable = resolveColorValue(value, tokenMappings);
  if (variable) return boundColorPaint(variable);
  // Fallback to treating as hex — preserve original value if already valid hex
  const hex = value.startsWith('#') ? value : `#${value}`;
  // Validate: must be #rrggbb or #rrggbbaa (6 or 8 hex chars after #)
  return solidPaint(/^#[0-9a-fA-F]{6}([0-9a-fA-F]{2})?$/.test(hex) ? hex : '#888888');
}

function buildLayerNode(
  layerSpec: LayerSpec,
  variantProps: Record<string, string>,
  tokenMappings?: Record<string, string>
): SceneNode | null {
  // ── variantCondition: decide visibility before creating anything ──────────
  if (layerSpec.variantCondition) {
    const conditions = layerSpec.variantCondition;
    // Check if any key matches current variant props (supports multi-condition keys)
    let matched = false;
    let visible = true;
    for (const [condKey, condValue] of Object.entries(conditions)) {
      if (matchesCondition(condKey, variantProps)) {
        matched = true;
        visible = condValue;
        break;
      }
    }
    // If a key matched and visibility is false, skip this node entirely
    if (matched && !visible) return null;
    // If no key matched, the layer is always shown (default visible)
  }

  // ── variantStyles: merge per-variant overrides on top of base spec ────────
  const vs = resolveVariantStyles(layerSpec.variantStyles, variantProps);
  // Merge vs into a resolved spec (vs overrides base values)
  const s: LayerSpec = { ...layerSpec, ...vs };

  switch (s.type) {
    case 'text': {
      const t = figma.createText();
      t.name = s.name;
      const fw = s.fontWeight ?? 400;
      const style = fw === 700 ? 'Bold' : fw === 600 ? 'Semi Bold' : fw === 500 ? 'Medium' : 'Regular';
      t.fontName = { family: 'Inter', style };
      t.fontSize = s.fontSize || 14;

      // Per-variant text override — variantText OR variantStyles.text (both supported)
      let overrideText: string | undefined = s.text !== layerSpec.text ? s.text : undefined;
      if (!overrideText && layerSpec.variantText) {
        for (const [condKey, text] of Object.entries(layerSpec.variantText)) {
          if (matchesCondition(condKey, variantProps)) { overrideText = text; break; }
        }
      }
      t.characters = overrideText || s.text || s.name;
      t.textAutoResize = 'WIDTH_AND_HEIGHT';

      if (s.textAlign === 'center') t.textAlignHorizontal = 'CENTER';
      else if (s.textAlign === 'right') t.textAlignHorizontal = 'RIGHT';

      // Apply width/height sizing for text inside auto-layout parents
      if (s.width === 'fill') t.layoutSizingHorizontal = 'FILL';
      if (s.height === 'fill') t.layoutSizingVertical = 'FILL';

      const textColor = s.textColor || '#18181B';
      const textVar = resolveColorValue(textColor, tokenMappings);
      if (textVar) {
        t.fills = [boundColorPaint(textVar)];
      } else {
        t.fills = [solidPaint(textColor.startsWith('#') ? textColor : '#18181B')];
      }

      if (s.opacity !== undefined) t.opacity = s.opacity;
      // Absolute position within layout:none parent
      if (s.x !== undefined) t.x = s.x;
      if (s.y !== undefined) t.y = s.y;
      return t;
    }

    case 'rectangle': {
      const r = figma.createRectangle();
      r.name = s.name;
      const rw = typeof s.width === 'number' ? s.width : 100;
      const rh = typeof s.height === 'number' ? s.height : 40;
      r.resize(rw, rh);
      if (s.fill) r.fills = [resolveFillPaint(s.fill, tokenMappings)];
      if (s.stroke) {
        const sv = resolveColorValue(s.stroke, tokenMappings);
        r.strokes = [sv ? boundColorPaint(sv) : solidPaint(s.stroke.startsWith('#') ? s.stroke : '#E4E4E7')];
        r.strokeWeight = s.strokeWeight ?? 1;
      }
      if (s.cornerRadius !== undefined) {
        const radVar = typeof s.cornerRadius === 'number' ? null : resolveFloatVariable(String(s.cornerRadius), tokenMappings);
        if (radVar) applyRadius(r, radVar);
        else r.cornerRadius = typeof s.cornerRadius === 'number' ? s.cornerRadius : 0;
      }
      if (s.opacity !== undefined) r.opacity = s.opacity;
      if (s.x !== undefined) r.x = s.x;
      if (s.y !== undefined) r.y = s.y;
      if (s.width === 'fill') r.layoutSizingHorizontal = 'FILL';
      if (s.height === 'fill') r.layoutSizingVertical = 'FILL';
      return r;
    }

    case 'ellipse': {
      const e = figma.createEllipse();
      e.name = s.name;
      const esz = typeof s.width === 'number' ? s.width : 40;
      e.resize(esz, typeof s.height === 'number' ? s.height : esz);
      if (s.fill) e.fills = [resolveFillPaint(s.fill, tokenMappings)];
      if (s.stroke) {
        const sv = resolveColorValue(s.stroke, tokenMappings);
        e.strokes = [sv ? boundColorPaint(sv) : solidPaint(s.stroke.startsWith('#') ? s.stroke : '#E4E4E7')];
        e.strokeWeight = s.strokeWeight ?? 1;
      }
      if (s.opacity !== undefined) e.opacity = s.opacity;
      if (s.x !== undefined) e.x = s.x;
      if (s.y !== undefined) e.y = s.y;
      return e;
    }

    case 'divider': {
      const d = figma.createRectangle();
      d.name = s.name || 'Divider';
      const dw = typeof s.width === 'number' ? s.width : 200;
      d.resize(dw, typeof s.height === 'number' ? s.height : 1);
      d.fills = [s.fill ? resolveFillPaint(s.fill, tokenMappings) : solidPaint('#E4E4E7')];
      d.layoutGrow = 1;
      d.layoutSizingHorizontal = 'FILL';
      return d;
    }

    case 'icon': {
      // Icon placeholder: small rounded frame acting as icon shape
      const iconFrame = figma.createFrame();
      iconFrame.name = s.name || 'Icon';
      const iconSz = typeof s.width === 'number' ? s.width : 16;
      iconFrame.resize(iconSz, typeof s.height === 'number' ? s.height : iconSz);
      iconFrame.layoutMode = 'NONE';
      // Use token or hex for fill — fall back to neutral gray
      iconFrame.fills = [s.fill ? resolveFillPaint(s.fill, tokenMappings) : solidPaint('#71717A')];
      const iconCr = s.cornerRadius;
      if (iconCr !== undefined) {
        const radVar = typeof iconCr === 'number' ? null : resolveFloatVariable(String(iconCr), tokenMappings);
        if (radVar) applyRadius(iconFrame, radVar);
        else iconFrame.cornerRadius = typeof iconCr === 'number' ? iconCr : 2;
      } else {
        iconFrame.cornerRadius = 2;
      }
      if (s.opacity !== undefined) iconFrame.opacity = s.opacity;
      if (s.x !== undefined) iconFrame.x = s.x;
      if (s.y !== undefined) iconFrame.y = s.y;
      if (s.width === 'fill') iconFrame.layoutSizingHorizontal = 'FILL';
      if (s.height === 'fill') iconFrame.layoutSizingVertical = 'FILL';
      return iconFrame;
    }

    case 'componentRef': {
      // Find an existing ComponentSet by name, pick the best matching variant, create an instance
      const ref = s.componentRef;
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
        // Find the variant whose properties best match the requested variantProps
        const candidates = compSet.children as ComponentNode[];
        let bestScore = -1;

        for (const candidate of candidates) {
          // Use componentPropertyDefinitions-based approach; variantProperties still works at runtime
          const props = (candidate as any).variantProperties as Record<string, string> || {};
          let score = 0;
          let mismatch = false;
          for (const [k, v] of Object.entries(ref.variantProps)) {
            if (props[k] === v) {
              score++;
            } else if (props[k] !== undefined) {
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
      instance.name = s.name;

      // Apply sizing
      if (typeof s.width === 'number' || typeof s.height === 'number') {
        const iw = typeof s.width === 'number' ? s.width : instance.width;
        const ih = typeof s.height === 'number' ? s.height : instance.height;
        instance.resize(iw, ih);
      }
      if (s.width === 'fill') instance.layoutSizingHorizontal = 'FILL';
      if (s.height === 'fill') instance.layoutSizingVertical = 'FILL';
      if (s.opacity !== undefined) instance.opacity = s.opacity;
      if (s.x !== undefined) instance.x = s.x;
      if (s.y !== undefined) instance.y = s.y;

      return instance;
    }

    case 'frame':
    default: {
      const f = figma.createFrame();
      f.name = s.name;

      // Layout
      const layout = (s.layout || 'horizontal').toLowerCase();
      f.layoutMode = layout === 'vertical' ? 'VERTICAL'
                   : layout === 'none'     ? 'NONE'
                   : 'HORIZONTAL';

      if (f.layoutMode !== 'NONE') {
        // Primary axis sizing
        const wSpec = s.width;
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
        const hSpec = s.height;
        if (hSpec === 'hug' || hSpec === undefined) {
          f.counterAxisSizingMode = 'AUTO';
        } else if (hSpec === 'fill') {
          f.layoutSizingVertical = 'FILL';
        } else if (typeof hSpec === 'number') {
          f.resize(f.width || 100, hSpec);
          f.counterAxisSizingMode = 'FIXED';
        }

        // Alignment
        const pa = s.primaryAlign || 'center';
        f.primaryAxisAlignItems = pa === 'min' ? 'MIN' : pa === 'max' ? 'MAX' : pa === 'space-between' ? 'SPACE_BETWEEN' : 'CENTER';
        const ca = s.counterAlign || 'center';
        f.counterAxisAlignItems = ca === 'min' ? 'MIN' : ca === 'max' ? 'MAX' : 'CENTER';

        // Padding
        f.paddingLeft   = s.paddingLeft   ?? s.paddingH ?? 0;
        f.paddingRight  = s.paddingRight  ?? s.paddingH ?? 0;
        f.paddingTop    = s.paddingTop    ?? s.paddingV ?? 0;
        f.paddingBottom = s.paddingBottom ?? s.paddingV ?? 0;
        f.itemSpacing   = s.itemSpacing ?? 0;
      } else {
        // Free layout (layout:none) — set absolute size
        if (typeof s.width === 'number' && typeof s.height === 'number') {
          f.resize(s.width, s.height);
        } else if (typeof s.width === 'number') {
          f.resize(s.width, f.height || 40);
        } else if (typeof s.height === 'number') {
          f.resize(f.width || 100, s.height);
        }
        // Absolute position within a layout:none parent
        if (s.x !== undefined) f.x = s.x;
        if (s.y !== undefined) f.y = s.y;
      }

      // Fill
      if (s.fill) {
        f.fills = [resolveFillPaint(s.fill, tokenMappings)];
      } else {
        f.fills = [];
      }

      // Stroke
      if (s.stroke) {
        const strokeVar = resolveColorValue(s.stroke, tokenMappings);
        if (strokeVar) {
          f.strokes = [boundColorPaint(strokeVar)];
        } else {
          f.strokes = [solidPaint(s.stroke.startsWith('#') ? s.stroke : '#E4E4E7')];
        }
        f.strokeWeight = s.strokeWeight ?? 1;
        f.strokeAlign = 'INSIDE';
      }

      // Corner radius
      if (s.cornerRadius !== undefined) {
        const radVar = typeof s.cornerRadius === 'number' ? null : resolveFloatVariable(String(s.cornerRadius), tokenMappings);
        if (radVar) {
          applyRadius(f, radVar);
        } else {
          f.cornerRadius = typeof s.cornerRadius === 'number' ? s.cornerRadius : 0;
        }
      }

      // Opacity
      if (s.opacity !== undefined) f.opacity = s.opacity;

      // Clip content
      if (s.clip) f.clipsContent = true;

      // Recursively build children — use original layerSpec.children (not s.children)
      // so child variantStyles are evaluated fresh against their own base spec
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
    // Merge variantStyles into rootLayer for this specific variant
    const rs: LayerSpec = { ...rootLayer, ...resolveVariantStyles(rootLayer.variantStyles, variantProps) };

    // Apply layout
    const layout = (rs.layout || 'horizontal').toLowerCase();
    comp.layoutMode = layout === 'vertical' ? 'VERTICAL'
                    : layout === 'none'     ? 'NONE'
                    : 'HORIZONTAL';

    if (comp.layoutMode !== 'NONE') {
      // Width sizing
      if (rs.width === 'fill') {
        comp.layoutGrow = 1;
        comp.layoutSizingHorizontal = 'FILL';
      } else if (rs.width === 'hug' || rs.width === undefined) {
        comp.primaryAxisSizingMode = 'AUTO';
      } else if (typeof rs.width === 'number') {
        comp.resize(rs.width, comp.height || 40);
        comp.primaryAxisSizingMode = 'FIXED';
      }

      // Height sizing
      if (rs.height === 'fill') {
        comp.layoutSizingVertical = 'FILL';
      } else if (rs.height === 'hug' || rs.height === undefined) {
        comp.counterAxisSizingMode = 'AUTO';
      } else if (typeof rs.height === 'number') {
        comp.resize(comp.width || 100, rs.height);
        comp.counterAxisSizingMode = 'FIXED';
      }

      // Alignment
      const pa = rs.primaryAlign || 'center';
      comp.primaryAxisAlignItems = pa === 'min' ? 'MIN' : pa === 'max' ? 'MAX' : pa === 'space-between' ? 'SPACE_BETWEEN' : 'CENTER';
      const ca = rs.counterAlign || 'center';
      comp.counterAxisAlignItems = ca === 'min' ? 'MIN' : ca === 'max' ? 'MAX' : 'CENTER';

      // Padding
      comp.paddingLeft   = rs.paddingLeft   ?? rs.paddingH ?? 0;
      comp.paddingRight  = rs.paddingRight  ?? rs.paddingH ?? 0;
      comp.paddingTop    = rs.paddingTop    ?? rs.paddingV ?? 0;
      comp.paddingBottom = rs.paddingBottom ?? rs.paddingV ?? 0;
      comp.itemSpacing   = rs.itemSpacing ?? 0;
    } else {
      // NONE layout — absolute size
      if (typeof rs.width === 'number' && typeof rs.height === 'number') {
        comp.resize(rs.width, rs.height);
      } else if (typeof rs.width === 'number') {
        comp.resize(rs.width, comp.height || 40);
      } else if (typeof rs.height === 'number') {
        comp.resize(comp.width || 100, rs.height);
      }
    }

    // Fill — variantStyles.fill overrides base fill per variant
    if (rs.fill) {
      comp.fills = [resolveFillPaint(rs.fill, spec.tokenMappings)];
    }

    // Stroke — variantStyles.stroke overrides base stroke per variant
    if (rs.stroke) {
      const strokeVar = resolveColorValue(rs.stroke, spec.tokenMappings);
      if (strokeVar) {
        comp.strokes = [boundColorPaint(strokeVar)];
      } else {
        comp.strokes = [solidPaint(rs.stroke.startsWith('#') ? rs.stroke : '#E4E4E7')];
      }
      comp.strokeWeight = rs.strokeWeight ?? 1;
      comp.strokeAlign = 'INSIDE';
    }

    // Corner radius
    if (rs.cornerRadius !== undefined) {
      const radVar = typeof rs.cornerRadius === 'number' ? null : resolveFloatVariable(String(rs.cornerRadius), spec.tokenMappings);
      if (radVar) {
        applyRadius(comp, radVar);
      } else {
        comp.cornerRadius = typeof rs.cornerRadius === 'number' ? rs.cornerRadius : 0;
      }
    }

    // Opacity
    if (rs.opacity !== undefined) comp.opacity = rs.opacity;

    // Clip
    if (rs.clip) comp.clipsContent = true;

    // Root layer's children → component children (use original rootLayer.children so child variantStyles evaluate fresh)
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
  await figma.loadFontAsync({ family: 'Inter', style: 'Bold' });
  return buildFromLayers(spec, variantProps);
}

async function executeCreateComponent(spec: ComponentSpec): Promise<{ success: boolean; message: string }> {
  if (!spec.layers || spec.layers.length === 0) {
    return {
      success: false,
      message: `❌ "layers" is required but was not provided for component "${spec.componentName}". ` +
        `Call get_design_system first, then include a "layers" array describing the component anatomy. ` +
        `Without layers, components render as blank rectangles.`,
    };
  }
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
    // Refresh variable cache once per command so findVariable() works correctly
    await refreshVariableCache();

    switch (command.type) {
      case 'create_component':
        return await executeCreateComponent(command.spec);

      case 'rename_variable': {
        const renameSpec = command.spec || command;
        const result = await applyVariableOp({ action: 'rename', variableName: renameSpec.oldName || command.variableName, newName: renameSpec.newName || command.newName });
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
          const variable = await resolveOrCreateVariable({
            name: variableName,
            type: inferredType,
            createWithValue: value,
          });

          // Set value in default mode
          const allCols = await figma.variables.getLocalVariableCollectionsAsync();
          const collection = allCols.find(c => c.id === variable.variableCollectionId);
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

        const allVarsForDelete = await figma.variables.getLocalVariablesAsync();
        for (const name of names) {
          const v = allVarsForDelete.find(x => x.name === name);
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
            let comp: ComponentNode;
            if (spec.layers && spec.layers.length > 0) {
              // Build full layer anatomy for new variant
              comp = await buildComponentNode(spec, variantSpec.properties);
            } else {
              // Fallback: create empty component
              comp = figma.createComponent();
              comp.resize(compSet.width / Math.max(compSet.children.length, 1), 40);
            }
            comp.name = Object.entries(variantSpec.properties)
              .map(([k, v]) => `${k}=${v}`)
              .join(', ');
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
      const variables = await figma.variables.getLocalVariablesAsync();
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
        const collections = await figma.variables.getLocalVariableCollectionsAsync();
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
