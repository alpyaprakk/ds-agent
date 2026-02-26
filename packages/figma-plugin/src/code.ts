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
  figma.notify(`📦 Created collection: ${collectionName}`);
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

  figma.notify(`✨ Created token: ${spec.name}`);
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

// ─── Per-variant style resolution ────────────────────────────────────────────
//
// Handles Button, Input, Badge, Card out of the box.
// Fallback covers any generic component the AI creates.

interface VariantStyle {
  bgToken?: TokenSpec;
  bgHex?: string;
  strokeToken?: TokenSpec;
  strokeHex?: string;
  strokeWeight?: number;
  textToken?: TokenSpec;
  textHex?: string;
  height?: number;
  paddingH?: number;
  paddingV?: number;
  fontSize?: number;
  fontStyle?: string;
}

function resolveVariantStyle(componentName: string, props: Record<string, string>): VariantStyle {
  const type     = props['Type'] || props['Variant'] || 'Default';
  const state    = props['State'] || 'Default';
  const size     = props['Size'] || 'Medium';

  const sizeMap: Record<string, { height: number; paddingH: number; paddingV: number; fontSize: number }> = {
    'Small':  { height: 32, paddingH: 12, paddingV: 6,  fontSize: 12 },
    'Medium': { height: 40, paddingH: 16, paddingV: 8,  fontSize: 14 },
    'Large':  { height: 48, paddingH: 20, paddingV: 12, fontSize: 16 },
  };
  const sizeStyle = sizeMap[size] || sizeMap['Medium'];

  const isDisabled = state === 'Disabled';
  const isHover    = state === 'Hover';
  const isPressed  = state === 'Pressed';
  const isFocus    = state === 'Focus';
  const isError    = state === 'Error';

  // Helper: build a component token spec with alias chain
  // name format: "{component}-{variant}-{role}" or "{component}-{variant}-{role}_{state}"
  const cn = componentName.toLowerCase();
  const stSuffix = (state !== 'Default') ? `_${state.toLowerCase()}` : '';

  function ct(role: string, aliasFor: string[], fallbackHex: string): TokenSpec {
    return {
      name: `${cn}-${role}`,
      type: 'COLOR',
      createInCollection: 'Components',
      aliasFor,
      createWithValue: fallbackHex,
    };
  }

  // ── BUTTON ────────────────────────────────────────────────────────────
  if (componentName === 'Button') {
    const base: VariantStyle = { ...sizeStyle, fontStyle: 'Medium' };

    if (type === 'Primary') {
      const bgAlias = isDisabled ? ['color/text/disabled', 'color/neutral/400']
                    : isPressed  ? ['color/brand/secondary', 'color/brand/primary']
                    : isHover    ? ['color/brand/primary']
                    :              ['color/brand/primary'];
      return {
        ...base,
        bgToken:   ct(`primary-bg${stSuffix}`,      bgAlias,                                    isDisabled ? '#94A3B8' : '#2563EB'),
        textToken: ct(`primary-text`,               ['color/text/inverse', 'color/neutral/0'],   '#FFFFFF'),
      };
    }
    if (type === 'Secondary') {
      const borderAlias = isDisabled ? ['color/border/default'] : ['color/brand/primary', 'color/border/focus'];
      const textAlias   = isDisabled ? ['color/text/disabled']  : ['color/brand/primary', 'color/text/primary'];
      return {
        ...base,
        bgToken: (isHover || isPressed)
          ? ct(`secondary-bg_hover`, ['color/bg/subtle'], '#EFF6FF')
          : undefined,
        strokeToken: ct(`secondary-border${stSuffix}`, borderAlias, isDisabled ? '#CBD5E1' : '#2563EB'),
        strokeWeight: 1.5,
        textToken:   ct(`secondary-text${stSuffix}`,   textAlias,   isDisabled ? '#94A3B8' : '#2563EB'),
      };
    }
    if (type === 'Ghost') {
      const textAlias = isDisabled ? ['color/text/disabled'] : ['color/brand/primary', 'color/text/primary'];
      return {
        ...base,
        bgToken: (isHover || isPressed)
          ? ct(`ghost-bg_hover`, ['color/bg/subtle'], '#F1F5F9')
          : undefined,
        textToken: ct(`ghost-text${stSuffix}`, textAlias, isDisabled ? '#94A3B8' : '#2563EB'),
      };
    }
    if (type === 'Destructive') {
      const bgAlias = isDisabled ? ['color/text/disabled']
                    : isPressed  ? ['color/semantic/error']
                    : isHover    ? ['color/semantic/error']
                    :              ['color/semantic/error'];
      return {
        ...base,
        bgToken:   ct(`destructive-bg${stSuffix}`, bgAlias,                                  isDisabled ? '#FCA5A5' : '#DC2626'),
        textToken: ct(`destructive-text`,           ['color/text/inverse', 'color/neutral/0'], '#FFFFFF'),
      };
    }
  }

  // ── INPUT ─────────────────────────────────────────────────────────────
  if (componentName === 'Input') {
    const base: VariantStyle = { ...sizeStyle, fontStyle: 'Regular' };
    const bgAlias     = isDisabled ? ['color/bg/subtle', 'color/neutral/100'] : ['color/bg/default', 'color/neutral/0'];
    const borderAlias = isError    ? ['color/semantic/error']
                      : isFocus    ? ['color/border/focus', 'color/brand/primary']
                      : isDisabled ? ['color/border/default']
                      :              ['color/border/default'];
    return {
      ...base,
      bgToken:     ct(`bg${stSuffix}`,     bgAlias,     isDisabled ? '#F8FAFC' : '#FFFFFF'),
      strokeToken: ct(`border${stSuffix}`, borderAlias, isError ? '#EF4444' : isFocus ? '#2563EB' : '#D1D5DB'),
      strokeWeight: isFocus ? 2 : 1,
      textToken:   ct(`placeholder`,       ['color/text/tertiary', 'color/text/secondary'], '#9CA3AF'),
    };
  }

  // ── BADGE ─────────────────────────────────────────────────────────────
  if (componentName === 'Badge') {
    const badgeMap: Record<string, { bgAlias: string[]; textAlias: string[]; bgHex: string; textHex: string }> = {
      'Default':     { bgAlias: ['color/bg/subtle'],           textAlias: ['color/text/secondary'],        bgHex: '#F1F5F9', textHex: '#475569' },
      'Primary':     { bgAlias: ['color/brand/primary'],       textAlias: ['color/text/inverse'],          bgHex: '#DBEAFE', textHex: '#1D4ED8' },
      'Success':     { bgAlias: ['color/semantic/success'],    textAlias: ['color/text/inverse'],          bgHex: '#DCFCE7', textHex: '#15803D' },
      'Warning':     { bgAlias: ['color/semantic/warning'],    textAlias: ['color/text/primary'],          bgHex: '#FEF9C3', textHex: '#A16207' },
      'Destructive': { bgAlias: ['color/semantic/error'],      textAlias: ['color/text/inverse'],          bgHex: '#FEE2E2', textHex: '#B91C1C' },
    };
    const bm = badgeMap[type] || badgeMap['Default'];
    return {
      height: 24, paddingH: 10, paddingV: 2, fontSize: 12, fontStyle: 'Medium',
      bgToken:   ct(`${type.toLowerCase()}-bg`,   bm.bgAlias,   bm.bgHex),
      textToken: ct(`${type.toLowerCase()}-text`, bm.textAlias, bm.textHex),
    };
  }

  // ── CARD ──────────────────────────────────────────────────────────────
  if (componentName === 'Card') {
    return {
      height: 200, paddingH: 24, paddingV: 24, fontSize: 14, fontStyle: 'Regular',
      bgToken:     ct(`bg`,     ['color/bg/default'],    '#FFFFFF'),
      strokeToken: ct(`border`, ['color/border/default'], '#E2E8F0'),
      strokeWeight: 1,
    };
  }

  // ── Fallback (generic component) ──────────────────────────────────────
  return {
    ...sizeStyle,
    bgToken:   ct(`bg`,   ['color/bg/default'],    '#FFFFFF'),
    textToken: ct(`text`, ['color/text/primary'],  '#18181B'),
  };
}

// ─── AI Execute Commands ──────────────────────────────────────────────────────

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
}

/** Override aliasFor on a TokenSpec using the AI-supplied tokenMappings. */
function applyTokenMappings(style: VariantStyle, mappings: Record<string, string>): VariantStyle {
  function override(spec: TokenSpec | undefined): TokenSpec | undefined {
    if (!spec) return undefined;
    const mapped = mappings[spec.name];
    if (mapped) return { ...spec, aliasFor: [mapped, ...(spec.aliasFor || [])] };
    return spec;
  }
  return {
    ...style,
    bgToken:     override(style.bgToken),
    strokeToken: override(style.strokeToken),
    textToken:   override(style.textToken),
  };
}

async function buildComponentNode(
  spec: ComponentSpec,
  variantProps: Record<string, string>
): Promise<ComponentNode> {
  const componentName = spec.componentName;
  let style = resolveVariantStyle(componentName, variantProps);
  if (spec.tokenMappings && Object.keys(spec.tokenMappings).length > 0) {
    style = applyTokenMappings(style, spec.tokenMappings);
  }

  const w = spec.width || 120;
  const h = style.height || spec.height || 40;

  const comp = figma.createComponent();
  comp.resize(w, h);
  comp.name = Object.keys(variantProps).length > 0
    ? Object.entries(variantProps).map(([k, v]) => `${k}=${v}`).join(', ')
    : componentName;
  if (spec.description) comp.description = spec.description;

  // Outer component: auto layout, clips content, no own fill
  comp.clipsContent = true;
  comp.fills = [];
  comp.layoutMode = 'HORIZONTAL';
  comp.primaryAxisSizingMode = 'FIXED';
  comp.counterAxisSizingMode = 'FIXED';
  comp.primaryAxisAlignItems = 'CENTER';
  comp.counterAxisAlignItems = 'CENTER';

  // Inner background frame
  const bg = figma.createFrame();
  bg.name = 'Background';
  bg.resize(w, h);
  bg.layoutMode = 'HORIZONTAL';
  bg.primaryAxisSizingMode = 'FIXED';
  bg.counterAxisSizingMode = 'FIXED';
  bg.primaryAxisAlignItems = 'CENTER';
  bg.counterAxisAlignItems = 'CENTER';
  bg.layoutGrow = 1;

  const pH = style.paddingH ?? 16;
  const pV = style.paddingV ?? 8;
  bg.paddingLeft   = pH;
  bg.paddingRight  = pH;
  bg.paddingTop    = pV;
  bg.paddingBottom = pV;
  bg.itemSpacing   = 6;

  // Fill
  if (style.bgToken) {
    const v = resolveOrCreateVariable(style.bgToken);
    bg.fills = [boundColorPaint(v)];
  } else {
    bg.fills = [];
  }

  // Stroke
  if (style.strokeToken) {
    const v = resolveOrCreateVariable(style.strokeToken);
    bg.strokes = [boundColorPaint(v)];
    bg.strokeWeight = style.strokeWeight ?? 1;
    bg.strokeAlign = 'INSIDE';
  } else {
    bg.strokes = [];
  }

  // Corner radius — always resolve radius/md
  const radiusVar = resolveOrCreateVariable({
    name: 'radius/md',
    fallbacks: ['radius/8'],
    type: 'FLOAT',
    createWithValue: 8,
    createInCollection: 'Spacing & Radius',
  });
  applyRadius(bg, radiusVar);

  // Label text
  const fontStyle = style.fontStyle || 'Medium';
  await figma.loadFontAsync({ family: 'Inter', style: fontStyle });
  const label = figma.createText();
  label.name = 'Label';
  label.fontName = { family: 'Inter', style: fontStyle };
  label.fontSize = style.fontSize || 14;
  label.characters = componentName;
  label.textAutoResize = 'WIDTH_AND_HEIGHT';

  if (style.textToken) {
    const v = resolveOrCreateVariable(style.textToken);
    label.fills = [boundColorPaint(v)];
  } else {
    label.fills = [solidPaint('#18181B')];
  }

  label.layoutAlign = 'INHERIT';
  label.layoutGrow  = 0;
  bg.appendChild(label);
  comp.appendChild(bg);

  return comp;
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

      // Position every variant inside the set with padding offset
      components.forEach((comp, i) => {
        const col = i % numCols;
        const row = Math.floor(i / numCols);
        comp.x = PAD + col * (comp.width + GAP_X);
        comp.y = PAD + row * (comp.height + GAP_Y);
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

        if (errors.length > 0) figma.notify(`⚠️ ${errors.length} errors setting variables`);
        figma.notify(`✅ Set ${count} variable(s)`);
        return { success: true, message: `Set ${count} variable(s)${errors.length > 0 ? ` (${errors.length} errors)` : ''}` };
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
};
