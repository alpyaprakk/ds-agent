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
figma.ui.onmessage = (msg) => {
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
};
