import { apiGet } from '../client.js';
import { z } from 'zod';
import { GetDesignSystemInputSchema } from '../types.js';

type Input = z.infer<typeof GetDesignSystemInputSchema>;

interface Variable {
  name: string;
  type: string;
  collection_name: string | null;
  value: unknown;
}

interface Collection {
  name: string;
  modes: unknown;
}

interface Component {
  name: string;
  type: string;
  description: string | null;
}

export async function getDesignSystem(input: Input): Promise<string> {
  const { workspaceId, include = ['variables', 'components', 'collections'] } = input;

  const [varsData, colsData, compsData] = await Promise.all([
    include.includes('variables')
      ? apiGet<{ variables: Variable[] }>(`/api/workspaces/${workspaceId}/variables`)
      : Promise.resolve({ variables: [] as Variable[] }),
    include.includes('collections')
      ? apiGet<{ collections: Collection[] }>(`/api/workspaces/${workspaceId}/collections`)
      : Promise.resolve({ collections: [] as Collection[] }),
    include.includes('components')
      ? apiGet<{ components: Component[] }>(`/api/workspaces/${workspaceId}/components`)
      : Promise.resolve({ components: [] as Component[] }),
  ]);

  const { variables } = varsData;
  const { collections } = colsData;
  const { components } = compsData;

  // Group variables by collection
  const byCollection: Record<string, Variable[]> = {};
  for (const v of variables) {
    const col = v.collection_name ?? '(uncategorized)';
    if (!byCollection[col]) byCollection[col] = [];
    byCollection[col].push(v);
  }

  return JSON.stringify({
    summary: {
      variableCount: variables.length,
      collectionCount: collections.length,
      componentCount: components.length,
    },
    collections: Object.entries(byCollection).map(([name, vars]) => ({
      name,
      variableCount: vars.length,
      variables: vars.map(v => ({ name: v.name, type: v.type })),
    })),
    components: components.map(c => ({
      name: c.name,
      type: c.type,
      description: c.description,
    })),
  }, null, 2);
}
