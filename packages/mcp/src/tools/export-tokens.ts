import { apiGet } from '../client.js';
import { z } from 'zod';
import { ExportTokensInputSchema } from '../types.js';

type Input = z.infer<typeof ExportTokensInputSchema>;

interface Variable {
  name: string;
  type: string;
  value: unknown;
  is_alias: boolean;
  alias_to: string | null;
  collection_name: string | null;
}

function resolveHex(value: unknown, type: string): string | null {
  try {
    const raw = typeof value === 'string' ? JSON.parse(value) : value;
    const first = Object.values(raw as Record<string, unknown>)[0];
    if (type === 'COLOR' && typeof first === 'object' && first !== null) {
      const c = first as Record<string, number>;
      if (typeof c.r === 'number') {
        const h = (n: number) => Math.round(n * 255).toString(16).padStart(2, '0');
        return `#${h(c.r)}${h(c.g)}${h(c.b)}`;
      }
    }
    if (type === 'FLOAT' && typeof first === 'number') return String(first);
    if (typeof first === 'string') return first;
  } catch { /* ignore */ }
  return null;
}

/** Convert token name to CSS custom property: color/brand/primary → --color-brand-primary */
function toCssVar(name: string): string {
  return '--' + name.replace(/\//g, '-').replace(/\s+/g, '-').toLowerCase();
}

/** Convert token name to camelCase JS key: color/brand/primary → colorBrandPrimary */
function toCamelCase(name: string): string {
  return name
    .replace(/\//g, '-')
    .split('-')
    .map((seg, i) => i === 0 ? seg : seg.charAt(0).toUpperCase() + seg.slice(1))
    .join('');
}

/** Convert color/spacing/radius tokens to Tailwind v3 config shape */
function toTailwind(variables: Variable[]): Record<string, unknown> {
  const colors: Record<string, string> = {};
  const spacing: Record<string, string> = {};
  const borderRadius: Record<string, string> = {};
  const fontSize: Record<string, string> = {};
  const fontWeight: Record<string, string> = {};
  const lineHeight: Record<string, string> = {};

  for (const v of variables) {
    const val = resolveHex(v.value, v.type);
    if (!val) continue;

    if (v.name.startsWith('color/')) {
      // color/brand/primary → brand.primary
      const key = v.name.replace('color/', '').replace(/\//g, '.');
      setNestedKey(colors, key, val);
    } else if (v.name.startsWith('spacing/')) {
      const key = v.name.replace('spacing/', '');
      spacing[key] = `${val}px`;
    } else if (v.name.startsWith('radius/')) {
      const key = v.name.replace('radius/', '');
      borderRadius[key] = `${val}px`;
    } else if (v.name.startsWith('font-size/')) {
      const key = v.name.replace('font-size/', '');
      fontSize[key] = `${val}px`;
    } else if (v.name.startsWith('font-weight/')) {
      const key = v.name.replace('font-weight/', '');
      fontWeight[key] = val;
    } else if (v.name.startsWith('line-height/')) {
      const key = v.name.replace('line-height/', '');
      lineHeight[key] = val;
    }
  }

  return {
    theme: {
      extend: {
        colors,
        spacing,
        borderRadius,
        ...(Object.keys(fontSize).length ? { fontSize } : {}),
        ...(Object.keys(fontWeight).length ? { fontWeight } : {}),
        ...(Object.keys(lineHeight).length ? { lineHeight } : {}),
      },
    },
  };
}

function setNestedKey(obj: Record<string, unknown>, dotPath: string, value: unknown) {
  const parts = dotPath.split('.');
  let cur: Record<string, unknown> = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    if (!cur[parts[i]]) cur[parts[i]] = {};
    cur = cur[parts[i]] as Record<string, unknown>;
  }
  cur[parts[parts.length - 1]] = value;
}

export async function exportTokens(input: Input): Promise<string> {
  const { workspaceId, format, collections } = input;

  const { variables } = await apiGet<{ variables: Variable[] }>(
    `/api/workspaces/${workspaceId}/variables`
  );

  // Filter by collection if requested
  const filtered = collections && collections.length > 0
    ? variables.filter(v => v.collection_name && collections.includes(v.collection_name))
    : variables;

  // Only include non-alias variables with resolvable values (or alias ones for JSON)
  const exportable = filtered.filter(v => !v.is_alias || format === 'json');

  switch (format) {
    case 'css': {
      const lines: string[] = [':root {'];
      for (const v of exportable) {
        if (v.is_alias) continue;
        const val = resolveHex(v.value, v.type);
        if (val !== null) {
          const unit = v.type === 'FLOAT' ? 'px' : '';
          lines.push(`  ${toCssVar(v.name)}: ${val}${unit};`);
        }
      }
      lines.push('}');
      return lines.join('\n');
    }

    case 'json': {
      const output: Record<string, unknown> = {};
      for (const v of filtered) {
        const val = resolveHex(v.value, v.type);
        const entry: Record<string, unknown> = { type: v.type };
        if (v.is_alias && v.alias_to) {
          entry.value = `{${v.alias_to.replace(/\//g, '.')}}`;
        } else if (val !== null) {
          entry.value = val;
        } else {
          continue;
        }
        setNestedKey(output, v.name.replace(/\//g, '.'), entry);
      }
      return JSON.stringify(output, null, 2);
    }

    case 'tailwind': {
      const config = toTailwind(exportable);
      return [
        '// tailwind.config.js',
        '/** @type {import(\'tailwindcss\').Config} */',
        'module.exports = ' + JSON.stringify(config, null, 2) + ';',
      ].join('\n');
    }

    case 'js': {
      const tokens: Record<string, string> = {};
      for (const v of exportable) {
        if (v.is_alias) continue;
        const val = resolveHex(v.value, v.type);
        if (val !== null) tokens[toCamelCase(v.name)] = val;
      }
      return [
        '// Design tokens (auto-generated)',
        'export const tokens = ' + JSON.stringify(tokens, null, 2) + ';',
      ].join('\n');
    }

    default:
      return JSON.stringify({ error: `Unknown format: ${format}` }, null, 2);
  }
}
