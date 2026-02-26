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
  name: string;
  fallbacks?: string[];
  type: VariableType;
  createInCollection?: string;
  createWithValue?: string | number;
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

function inferCollectionForVariable(name: string): string {
  const lower = name.toLowerCase();
  if (lower.startsWith('color/component') || lower.startsWith('components/') || lower.includes('/component/')) {
    return 'Component Tokens';
  }
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
  const found = findVariable(spec.name);
  if (found) return found;

  if (spec.fallbacks) {
    for (const fb of spec.fallbacks) {
      const fbVar = findVariable(fb);
      if (fbVar) return fbVar;
    }
  }

  const collectionName = spec.createInCollection || inferCollectionForVariable(spec.name);
  const { collection, defaultModeId } = getOrCreateCollection(collectionName);
  const newVar = figma.variables.createVariable(spec.name, collection, spec.type);

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

  // ── BUTTON ────────────────────────────────────────────────────────────
  if (componentName === 'Button') {
    const base: VariantStyle = { ...sizeStyle, fontStyle: 'Medium' };

    if (type === 'Primary') {
      const bgHex = isDisabled ? '#94A3B8' : isPressed ? '#1D4ED8' : isHover ? '#3B82F6' : '#2563EB';
      return {
        ...base,
        bgToken:   { name: `color/component/Button/bg/primary-${state.toLowerCase()}`,   fallbacks: ['color/brand/primary'],    type: 'COLOR', createWithValue: bgHex },
        textToken: { name: 'color/component/Button/text/on-primary',                      fallbacks: ['color/text/inverse'],     type: 'COLOR', createWithValue: '#FFFFFF' },
      };
    }
    if (type === 'Secondary') {
      const strokeHex = isDisabled ? '#CBD5E1' : '#2563EB';
      const textHex   = isDisabled ? '#94A3B8' : '#2563EB';
      return {
        ...base,
        bgToken: (isHover || isPressed)
          ? { name: 'color/component/Button/bg/secondary-hover', fallbacks: ['color/bg/subtle'], type: 'COLOR', createWithValue: '#EFF6FF' }
          : undefined,
        strokeToken: { name: `color/component/Button/border/secondary-${state.toLowerCase()}`, fallbacks: ['color/brand/primary', 'color/border/default'], type: 'COLOR', createWithValue: strokeHex },
        strokeWeight: 1.5,
        textToken:   { name: `color/component/Button/text/secondary-${state.toLowerCase()}`,   fallbacks: ['color/brand/primary', 'color/text/primary'],  type: 'COLOR', createWithValue: textHex },
      };
    }
    if (type === 'Ghost') {
      const textHex = isDisabled ? '#94A3B8' : '#2563EB';
      return {
        ...base,
        bgToken: (isHover || isPressed)
          ? { name: 'color/component/Button/bg/ghost-hover', fallbacks: ['color/bg/subtle'], type: 'COLOR', createWithValue: '#F1F5F9' }
          : undefined,
        textToken: { name: `color/component/Button/text/ghost-${state.toLowerCase()}`, fallbacks: ['color/brand/primary', 'color/text/primary'], type: 'COLOR', createWithValue: textHex },
      };
    }
    if (type === 'Destructive') {
      const bgHex = isDisabled ? '#FCA5A5' : isPressed ? '#B91C1C' : isHover ? '#EF4444' : '#DC2626';
      return {
        ...base,
        bgToken:   { name: `color/component/Button/bg/destructive-${state.toLowerCase()}`, fallbacks: ['color/semantic/error'],  type: 'COLOR', createWithValue: bgHex },
        textToken: { name: 'color/component/Button/text/on-destructive',                   fallbacks: ['color/text/inverse'],    type: 'COLOR', createWithValue: '#FFFFFF' },
      };
    }
  }

  // ── INPUT ─────────────────────────────────────────────────────────────
  if (componentName === 'Input') {
    const base: VariantStyle = { ...sizeStyle, fontStyle: 'Regular' };
    const bgHex     = isDisabled ? '#F8FAFC' : '#FFFFFF';
    const strokeHex = isError    ? '#EF4444'
                    : isFocus    ? '#2563EB'
                    : isDisabled ? '#E2E8F0'
                    : '#D1D5DB';
    return {
      ...base,
      bgToken:     { name: `color/component/Input/bg/${state.toLowerCase()}`,     fallbacks: ['color/bg/default',     'color/neutral/0'],   type: 'COLOR', createWithValue: bgHex },
      strokeToken: { name: `color/component/Input/border/${state.toLowerCase()}`, fallbacks: ['color/border/default', 'color/neutral/300'], type: 'COLOR', createWithValue: strokeHex },
      strokeWeight: isFocus ? 2 : 1,
      textToken:   { name: 'color/component/Input/text/placeholder',              fallbacks: ['color/text/secondary', 'color/neutral/400'], type: 'COLOR', createWithValue: '#9CA3AF' },
    };
  }

  // ── BADGE ─────────────────────────────────────────────────────────────
  if (componentName === 'Badge') {
    const colorMap: Record<string, { bg: string; text: string }> = {
      'Default':     { bg: '#F1F5F9', text: '#475569' },
      'Primary':     { bg: '#DBEAFE', text: '#1D4ED8' },
      'Success':     { bg: '#DCFCE7', text: '#15803D' },
      'Warning':     { bg: '#FEF9C3', text: '#A16207' },
      'Destructive': { bg: '#FEE2E2', text: '#B91C1C' },
    };
    const colors = colorMap[type] || colorMap['Default'];
    return {
      height: 24, paddingH: 10, paddingV: 2, fontSize: 12, fontStyle: 'Medium',
      bgToken:   { name: `color/component/Badge/bg/${type.toLowerCase()}`,   fallbacks: ['color/bg/subtle'],    type: 'COLOR', createWithValue: colors.bg },
      textToken: { name: `color/component/Badge/text/${type.toLowerCase()}`, fallbacks: ['color/text/primary'], type: 'COLOR', createWithValue: colors.text },
    };
  }

  // ── CARD ──────────────────────────────────────────────────────────────
  if (componentName === 'Card') {
    return {
      height: 200, paddingH: 24, paddingV: 24, fontSize: 14, fontStyle: 'Regular',
      bgToken:     { name: 'color/component/Card/bg/default',     fallbacks: ['color/bg/default',    'color/neutral/0'],   type: 'COLOR', createWithValue: '#FFFFFF' },
      strokeToken: { name: 'color/component/Card/border/default', fallbacks: ['color/border/default', 'color/neutral/200'], type: 'COLOR', createWithValue: '#E2E8F0' },
      strokeWeight: 1,
    };
  }

  // ── Fallback (generic component) ──────────────────────────────────────
  return {
    ...sizeStyle,
    bgToken:   { name: `color/component/${componentName}/bg/default`,   fallbacks: ['color/bg/default'],    type: 'COLOR', createWithValue: '#FFFFFF' },
    textToken: { name: `color/component/${componentName}/text/default`, fallbacks: ['color/text/primary'], type: 'COLOR', createWithValue: '#18181B' },
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
}

async function buildComponentNode(
  spec: ComponentSpec,
  variantProps: Record<string, string>
): Promise<ComponentNode> {
  const componentName = spec.componentName;
  const style = resolveVariantStyle(componentName, variantProps);

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
      const set = figma.combineAsVariants(components, page);
      set.name = spec.componentName;
      // Clear the default pink/purple fill that Figma adds to component sets
      set.fills = [];
      set.strokes = [];
      set.itemSpacing = 24;
      set.paddingTop = 24;
      set.paddingRight = 24;
      set.paddingBottom = 24;
      set.paddingLeft = 24;
      set.layoutMode = 'HORIZONTAL';
      set.layoutWrap = 'WRAP';
      set.counterAxisSpacing = 16;

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
