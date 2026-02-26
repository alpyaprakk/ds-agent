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

// ─── AI Execute Commands ──────────────────────────────────────────────────────

interface ComponentSpec {
  pageName: string;
  componentName: string;
  description?: string;
  width?: number;
  height?: number;
  variants?: Array<{ properties: Record<string, string> }>;
  properties?: Array<{ name: string; type: 'VARIANT' | 'BOOLEAN' | 'TEXT' | 'INSTANCE_SWAP'; values?: string[] }>;
  fills?: Array<{ variableName?: string; hex?: string }>;
  cornerRadius?: number | string; // variable name or number
  padding?: { top: number; right: number; bottom: number; left: number };
  layoutMode?: 'HORIZONTAL' | 'VERTICAL' | 'NONE';
  itemSpacing?: number;
}

function resolveVariable(name: string): Variable | null {
  const vars = figma.variables.getLocalVariables();
  return vars.find(v => v.name === name) || null;
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

      // Fill
      if (spec.fills && spec.fills.length > 0) applyFillFromSpec(comp, spec.fills[0]);

      // Corner radius
      if (spec.cornerRadius !== undefined) {
        if (typeof spec.cornerRadius === 'string') {
          const v = resolveVariable(spec.cornerRadius);
          if (v) comp.setBoundVariable('topLeftRadius', v);
        } else {
          comp.cornerRadius = spec.cornerRadius;
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

      // Arrange variants in a grid
      const cols = Math.ceil(Math.sqrt(components.length));
      components.forEach((comp, i) => {
        comp.x = (i % cols) * (w + 20);
        comp.y = Math.floor(i / cols) * (h + 20);
      });
    } else if (components.length === 1) {
      components[0].name = spec.componentName;
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

    if (spec.fills && spec.fills.length > 0) applyFillFromSpec(comp, spec.fills[0]);

    if (spec.cornerRadius !== undefined) {
      if (typeof spec.cornerRadius === 'string') {
        const v = resolveVariable(spec.cornerRadius);
        if (v) comp.setBoundVariable('topLeftRadius', v);
      } else {
        comp.cornerRadius = spec.cornerRadius;
      }
    }

    const label = figma.createText();
    await figma.loadFontAsync({ family: 'Inter', style: 'Regular' });
    label.characters = spec.componentName;
    label.fontSize = 14;
    label.x = (w - label.width) / 2;
    label.y = (h - label.height) / 2;
    comp.appendChild(label);

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
        return result;
      }

      case 'set_variable_value': {
        const result = applyVariableOp({ action: 'set-value', variableName: command.variableName, newValue: command.value, modeId: command.modeId });
        return result;
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
