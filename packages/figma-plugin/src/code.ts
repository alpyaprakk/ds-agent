// Figma Plugin Code (Backend)
console.log('DS Agent Plugin Loaded');

// Show UI
figma.showUI(__html__, { width: 400, height: 600 });

// Listen for document changes
figma.on('documentchange', (event) => {
  console.log('Document changed:', event);

  // TODO: Debounce and send to server
});

// Handle messages from UI
figma.ui.onmessage = async (msg) => {
  console.log('Received message:', msg);

  if (msg.type === 'get-variables') {
    // Get all variables
    const variables = figma.variables.getLocalVariables();

    figma.ui.postMessage({
      type: 'variables-data',
      variables: variables.map(v => ({
        id: v.id,
        name: v.name,
        resolvedType: v.resolvedType,
      }))
    });
  }

  if (msg.type === 'get-components') {
    // Get all components
    const components = figma.root.findAll(node => node.type === 'COMPONENT');

    figma.ui.postMessage({
      type: 'components-data',
      components: components.map(c => ({
        id: c.id,
        name: c.name,
      }))
    });
  }

  if (msg.type === 'full-sync') {
    console.log('🔄 Starting full sync...');

    try {
      // Get all local variables
      const variables = figma.variables.getLocalVariables();

      // Get all variable collections
      const collections = figma.variables.getLocalVariableCollections();

      // Get all components
      const components = figma.root.findAll(node => node.type === 'COMPONENT') as ComponentNode[];

      // Prepare sync data
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
          modes: c.modes.map(m => ({
            modeId: m.modeId,
            name: m.name
          })),
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

      console.log(`✅ Collected: ${syncData.variables.length} variables, ${syncData.collections.length} collections, ${syncData.components.length} components`);

      // Send to UI (which will forward to server)
      figma.ui.postMessage({
        type: 'sync-data',
        data: syncData
      });

    } catch (error) {
      console.error('❌ Sync error:', error);
      figma.ui.postMessage({
        type: 'sync-error',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  if (msg.type === 'apply-fix') {
    console.log('🔧 Applying fix:', msg.fix);

    try {
      const { conflictId, entityId, action, suggestion } = msg.fix;

      let fixed = false;

      if (action === 'auto-fix') {
        const variables = figma.variables.getLocalVariables();
        const variable = variables.find(v => v.name === entityId || v.id === entityId);

        if (variable && suggestion) {
          // Rename: "Rename to 'X'" or "rename to X" or "Rename: X"
          const renameMatch = suggestion.match(/[Rr]ename(?:\s+to)?[:\s]+["']?([^"'\n,.]+)["']?/);
          if (renameMatch) {
            const newName = renameMatch[1].trim();
            if (newName && newName !== variable.name) {
              variable.name = newName;
              fixed = true;
              figma.notify(`✅ Variable renamed to: ${newName}`);
            }
          }

          // If no specific fix matched but variable was found, mark as acknowledged
          if (!fixed) {
            fixed = true;
            figma.notify(`ℹ️ Reviewed: ${variable.name}`);
          }
        }

        // Try component
        if (!fixed) {
          const components = figma.root.findAll(node => node.type === 'COMPONENT') as ComponentNode[];
          const component = components.find(c => c.name === entityId || c.id === entityId);

          if (component && suggestion) {
            // Add description
            const descMatch = suggestion.match(/[Aa]dd description[:\s]+["']?([^"'\n]+)["']?/);
            if (descMatch) {
              component.description = descMatch[1].trim();
              fixed = true;
              figma.notify(`✅ Description added to: ${component.name}`);
            }

            // Auto-layout
            if (!fixed && suggestion.toLowerCase().includes('auto-layout') && 'layoutMode' in component) {
              component.layoutMode = 'HORIZONTAL';
              fixed = true;
              figma.notify(`✅ Auto-layout applied to: ${component.name}`);
            }

            // Rename component
            if (!fixed) {
              const renameMatch = suggestion.match(/[Rr]ename(?:\s+to)?[:\s]+["']?([^"'\n,.]+)["']?/);
              if (renameMatch) {
                const newName = renameMatch[1].trim();
                if (newName && newName !== component.name) {
                  component.name = newName;
                  fixed = true;
                  figma.notify(`✅ Component renamed to: ${newName}`);
                }
              }
            }

            // Entity found but no specific fix — acknowledge
            if (!fixed) {
              fixed = true;
              figma.notify(`ℹ️ Reviewed: ${component.name}`);
            }
          }
        }
      }

      if (fixed) {
        figma.ui.postMessage({
          type: 'fix-applied',
          conflictId
        });
      } else {
        figma.ui.postMessage({
          type: 'fix-error',
          conflictId,
          error: 'Entity not found in this Figma file. Make sure the file is synced.'
        });
      }
    } catch (error) {
      console.error('❌ Fix application error:', error);
      figma.ui.postMessage({
        type: 'fix-error',
        conflictId: msg.fix?.conflictId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
};
