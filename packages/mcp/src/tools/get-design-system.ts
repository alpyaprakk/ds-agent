import { apiGet } from '../client.js';
import { z } from 'zod';
import { GetDesignSystemInputSchema } from '../types.js';

type Input = z.infer<typeof GetDesignSystemInputSchema>;

interface Variable {
  name: string;
  type: string;
  collection_name: string | null;
  value: unknown;
  is_alias: boolean;
  alias_to: string | null;
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

/** Convert raw Figma variable value (stored as JSON) to a human-readable primitive. */
function resolveDisplayValue(v: Variable): unknown {
  try {
    const raw = typeof v.value === 'string' ? JSON.parse(v.value) : v.value;
    // Figma stores { modeId: value } — take the first mode's value
    const first = Object.values(raw as Record<string, unknown>)[0];
    if (first === null || first === undefined) return null;

    // COLOR: { r, g, b, a } → hex string
    if (v.type === 'COLOR' && typeof first === 'object' && first !== null) {
      const c = first as Record<string, number>;
      if (typeof c.r === 'number') {
        const h = (n: number) => Math.round(n * 255).toString(16).padStart(2, '0');
        return `#${h(c.r)}${h(c.g)}${h(c.b)}`;
      }
    }

    // FLOAT / STRING / BOOLEAN — return as-is
    return first;
  } catch {
    return null;
  }
}

/** Build alias chain: varName → aliasTo → aliasTo → ... (max 5 hops) */
function buildAliasChain(name: string, aliasMap: Map<string, string>, max = 5): string[] {
  const chain: string[] = [name];
  let current = name;
  for (let i = 0; i < max; i++) {
    const next = aliasMap.get(current);
    if (!next || chain.includes(next)) break;
    chain.push(next);
    current = next;
  }
  return chain;
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

  // Build alias map for chain resolution
  const aliasMap = new Map<string, string>();
  for (const v of variables) {
    if (v.is_alias && v.alias_to) aliasMap.set(v.name, v.alias_to);
  }

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
      variables: vars.map(v => {
        const entry: Record<string, unknown> = {
          name: v.name,
          type: v.type,
          value: resolveDisplayValue(v),
        };
        if (v.is_alias && v.alias_to) {
          entry.isAlias = true;
          entry.aliasChain = buildAliasChain(v.name, aliasMap);
        }
        return entry;
      }),
    })),
    components: components.map(c => ({
      name: c.name,
      type: c.type,
      description: c.description,
    })),
  }, null, 2);
}
