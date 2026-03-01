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

  // ── Derive token usage guide from actual variables ────────────────────────
  // Group COLOR variables by semantic role so AI knows which tokens to use
  const colorVars = variables.filter(v => v.type === 'COLOR');
  const tokensByRole: Record<string, string[]> = {};
  for (const v of colorVars) {
    const parts = v.name.split('/');
    const role = parts.slice(0, 2).join('/'); // e.g. "color/bg", "color/text"
    if (!tokensByRole[role]) tokensByRole[role] = [];
    tokensByRole[role].push(v.name);
  }

  // ── Layer anatomy examples (derived from existing components + best practices) ─
  // These teach Claude how to write layers JSON using real token names from this workspace.
  const surfaceToken   = colorVars.find(v => v.name.includes('bg/default')    || v.name.includes('surface/default'))?.name ?? 'color/bg/default';
  const borderToken    = colorVars.find(v => v.name.includes('border/default'))?.name ?? 'color/border/default';
  const textPrimary    = colorVars.find(v => v.name.includes('text/primary')   || v.name.includes('text/default'))?.name ?? 'color/text/primary';
  const textSecondary  = colorVars.find(v => v.name.includes('text/secondary') || v.name.includes('text/muted'))?.name ?? 'color/text/secondary';
  const brandPrimary   = colorVars.find(v => v.name.includes('brand/primary')  || v.name.includes('interactive/primary'))?.name ?? 'color/brand/primary';
  const brandFg        = colorVars.find(v => v.name.includes('text/inverse')   || v.name.includes('brand/foreground'))?.name ?? 'color/text/inverse';
  const subtleBg       = colorVars.find(v => v.name.includes('bg/subtle')      || v.name.includes('surface/subtle'))?.name ?? 'color/bg/subtle';
  const errorToken     = colorVars.find(v => v.name.includes('semantic/error') || v.name.includes('destructive'))?.name ?? 'color/semantic/error';
  const successToken   = colorVars.find(v => v.name.includes('semantic/success'))?.name ?? 'color/semantic/success';
  const warningToken   = colorVars.find(v => v.name.includes('semantic/warning'))?.name ?? 'color/semantic/warning';

  const layerAnatomyExamples = {
    _instructions: [
      "Use EXACT token names from this workspace's variables list.",
      "fill/stroke/textColor accept either a token name (e.g. 'color/bg/default') or hex (#ffffff).",
      "Token names MUST match exactly — check the variables list above before writing layers.",
      "layout:'horizontal' or 'vertical' enables auto-layout. 'none' = free/absolute.",
      "width/height: use a number for fixed px, 'fill' to stretch in parent, 'hug' to wrap content.",
      "primaryAlign:'space-between' pushes children to opposite ends (like justify-between).",
      "variantCondition: hide/show layers per variant. Key is 'PropName=Value', value is true/false.",
      "componentRef: embed an existing Figma component by name (creates a real instance).",
    ],
    tokenReference: {
      surface: surfaceToken,
      border: borderToken,
      textPrimary,
      textSecondary,
      brandPrimary,
      brandForeground: brandFg,
      subtleBackground: subtleBg,
      error: errorToken,
      success: successToken,
      warning: warningToken,
    },
    examples: {
      Toast: {
        description: "Notification bar with icon + message + close button. 3 variants: success/warning/error.",
        layers: [
          {
            type: "frame", name: "Toast", layout: "horizontal",
            width: 360, height: "hug", paddingH: 16, paddingV: 12, itemSpacing: 12,
            fill: surfaceToken, stroke: borderToken, strokeWeight: 1, cornerRadius: 8,
            counterAlign: "min",
            children: [
              {
                type: "icon", name: "Icon", width: 20, height: 20,
                fill: successToken,
                variantCondition: { "Type=Success": true, "Type=Warning": false, "Type=Error": false },
              },
              {
                type: "frame", name: "Content", layout: "vertical",
                width: "fill", height: "hug", itemSpacing: 2,
                children: [
                  { type: "text", name: "Title", text: "Notification title", fontSize: 14, fontWeight: 600, textColor: textPrimary },
                  { type: "text", name: "Description", text: "Something happened.", fontSize: 13, fontWeight: 400, textColor: textSecondary },
                ],
              },
              { type: "icon", name: "CloseIcon", width: 16, height: 16, fill: textSecondary },
            ],
          },
        ],
      },
      Avatar: {
        description: "User avatar — circle with initials or image placeholder.",
        layers: [
          {
            type: "ellipse", name: "AvatarCircle",
            width: 40, height: 40, fill: subtleBg,
          },
        ],
      },
      ListItem: {
        description: "Row in a list. Label on left, value/badge on right.",
        layers: [
          {
            type: "frame", name: "ListItem", layout: "horizontal",
            width: "fill", height: 48, paddingH: 16, paddingV: 0,
            fill: surfaceToken, itemSpacing: 8,
            primaryAlign: "space-between", counterAlign: "center",
            children: [
              {
                type: "frame", name: "Left", layout: "horizontal",
                width: "hug", height: "fill", itemSpacing: 12, counterAlign: "center",
                children: [
                  { type: "icon", name: "LeadIcon", width: 20, height: 20, fill: textSecondary },
                  { type: "text", name: "Label", text: "List item label", fontSize: 14, fontWeight: 400, textColor: textPrimary },
                ],
              },
              { type: "text", name: "Value", text: "Detail", fontSize: 14, fontWeight: 400, textColor: textSecondary },
            ],
          },
        ],
      },
      Tag: {
        description: "Small inline label/badge with optional dot indicator.",
        layers: [
          {
            type: "frame", name: "Tag", layout: "horizontal",
            width: "hug", height: "hug",
            paddingH: 8, paddingV: 2, itemSpacing: 4,
            fill: subtleBg, cornerRadius: 9999, counterAlign: "center",
            children: [
              { type: "ellipse", name: "Dot", width: 6, height: 6, fill: brandPrimary },
              { type: "text", name: "Label", text: "Tag label", fontSize: 12, fontWeight: 500, textColor: textPrimary },
            ],
          },
        ],
      },
      Switch: {
        description: "Toggle switch. Track frame + thumb circle. Use variantCondition for on/off states.",
        layers: [
          {
            type: "frame", name: "Track", layout: "none",
            width: 44, height: 24, cornerRadius: 9999,
            fill: brandPrimary,
            variantCondition: { "State=Off": false },
            children: [
              { type: "ellipse", name: "Thumb", width: 20, height: 20, fill: "#FFFFFF" },
            ],
          },
        ],
      },
      Drawer: {
        description: "Side panel overlay. Header with title+close, scrollable body, sticky footer with actions.",
        layers: [
          {
            type: "frame", name: "DrawerPanel", layout: "vertical",
            width: 400, height: 600,
            fill: surfaceToken, stroke: borderToken, strokeWeight: 1,
            itemSpacing: 0,
            children: [
              {
                type: "frame", name: "Header", layout: "horizontal",
                width: "fill", height: 56, paddingH: 24, paddingV: 0,
                primaryAlign: "space-between", counterAlign: "center",
                stroke: borderToken, strokeWeight: 1,
                children: [
                  { type: "text", name: "Title", text: "Drawer title", fontSize: 16, fontWeight: 600, textColor: textPrimary },
                  { type: "icon", name: "CloseButton", width: 20, height: 20, fill: textSecondary },
                ],
              },
              {
                type: "frame", name: "Body", layout: "vertical",
                width: "fill", height: "fill", paddingH: 24, paddingV: 24, itemSpacing: 16,
                children: [
                  { type: "text", name: "BodyContent", text: "Content area", fontSize: 14, fontWeight: 400, textColor: textSecondary },
                ],
              },
              {
                type: "frame", name: "Footer", layout: "horizontal",
                width: "fill", height: 64, paddingH: 24, paddingV: 0,
                primaryAlign: "max", counterAlign: "center", itemSpacing: 12,
                stroke: borderToken, strokeWeight: 1,
                children: [
                  { type: "componentRef", name: "CancelButton", componentRef: { componentName: "Button", variantProps: { "Type": "Secondary", "Size": "Medium", "State": "Default" } } },
                  { type: "componentRef", name: "SaveButton",   componentRef: { componentName: "Button", variantProps: { "Type": "Primary",   "Size": "Medium", "State": "Default" } } },
                ],
              },
            ],
          },
        ],
      },
    },
  };

  return JSON.stringify({
    summary: {
      variableCount: variables.length,
      collectionCount: collections.length,
      componentCount: components.length,
    },
    tokensByRole,
    layerAnatomyExamples,
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
