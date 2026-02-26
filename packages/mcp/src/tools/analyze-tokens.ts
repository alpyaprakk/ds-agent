import { apiGet } from '../client.js';
import { z } from 'zod';
import { AnalyzeTokensInputSchema } from '../types.js';

type Input = z.infer<typeof AnalyzeTokensInputSchema>;

interface Variable {
  name: string;
  type: string;
  value: unknown;
  collection_name: string | null;
}

function hexToLuminance(hex: string): number {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16) / 255;
  const g = parseInt(h.slice(2, 4), 16) / 255;
  const b = parseInt(h.slice(4, 6), 16) / 255;
  const lin = (c: number) => c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

function contrastRatio(hex1: string, hex2: string): number {
  const l1 = hexToLuminance(hex1);
  const l2 = hexToLuminance(hex2);
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
}

function variableValueToHex(value: unknown): string | null {
  try {
    const val = typeof value === 'string' ? JSON.parse(value) : value;
    const firstMode = Object.values(val as Record<string, unknown>)[0] as Record<string, number> | undefined;
    if (firstMode && typeof firstMode.r === 'number') {
      const h = (n: number) => Math.round(n * 255).toString(16).padStart(2, '0');
      return `#${h(firstMode.r)}${h(firstMode.g)}${h(firstMode.b)}`;
    }
  } catch { /* ignore */ }
  return null;
}

const REQUIRED_TOKENS = [
  'color/brand/primary',
  'color/bg/default', 'color/bg/subtle',
  'color/text/primary', 'color/text/secondary', 'color/text/disabled', 'color/text/inverse',
  'color/border/default', 'color/border/focus',
  'color/semantic/error', 'color/semantic/success', 'color/semantic/warning',
  'spacing/1', 'spacing/2', 'spacing/4', 'spacing/8',
  'radius/sm', 'radius/md', 'radius/lg',
];

export async function analyzeTokens(input: Input): Promise<string> {
  const { workspaceId, checks = ['completeness', 'naming', 'wcag_contrast', 'aliases'] } = input;

  const { variables } = await apiGet<{ variables: Variable[] }>(
    `/api/workspaces/${workspaceId}/variables`
  );

  const issues: Array<{ severity: 'error' | 'warning' | 'info'; category: string; message: string }> = [];
  const varNames = new Set(variables.map(v => v.name));
  const colorMap = new Map<string, string>();

  // Build hex color map
  for (const v of variables) {
    if (v.type === 'COLOR') {
      const hex = variableValueToHex(v.value);
      if (hex) colorMap.set(v.name, hex);
    }
  }

  // ── Completeness ────────────────────────────────────────────────────────────
  if (checks.includes('completeness')) {
    for (const req of REQUIRED_TOKENS) {
      if (!varNames.has(req)) {
        issues.push({ severity: 'error', category: 'completeness', message: `Missing: "${req}"` });
      }
    }
  }

  // ── Naming ──────────────────────────────────────────────────────────────────
  if (checks.includes('naming')) {
    for (const v of variables) {
      if (v.type === 'COLOR' && !v.name.startsWith('color/') && !v.name.includes('-bg') && !v.name.includes('-text') && !v.name.includes('-border')) {
        issues.push({ severity: 'warning', category: 'naming', message: `"${v.name}" (COLOR) doesn't follow color/* convention` });
      }
      if (v.type === 'FLOAT' && !v.name.startsWith('spacing/') && !v.name.startsWith('radius/') && !v.name.startsWith('font-size/') && !v.name.startsWith('font-weight/') && !v.name.startsWith('line-height/')) {
        issues.push({ severity: 'info', category: 'naming', message: `"${v.name}" (FLOAT) doesn't follow spacing/radius/font-* convention` });
      }
    }
  }

  // ── WCAG Contrast ───────────────────────────────────────────────────────────
  if (checks.includes('wcag_contrast')) {
    const pairs: Array<[string, string, string]> = [
      ['color/text/primary',   'color/bg/default',     'body text on background'],
      ['color/text/inverse',   'color/brand/primary',  'button label on brand'],
      ['color/text/secondary', 'color/bg/default',     'secondary text on background'],
    ];
    for (const [fg, bg, label] of pairs) {
      const fgHex = colorMap.get(fg);
      const bgHex = colorMap.get(bg);
      if (fgHex && bgHex) {
        const ratio = contrastRatio(fgHex, bgHex);
        const pass = ratio >= 4.5;
        if (!pass) {
          issues.push({
            severity: 'error',
            category: 'wcag_contrast',
            message: `${label} (${fg} / ${bg}): contrast ${ratio.toFixed(2)}:1 — WCAG AA requires 4.5:1`,
          });
        } else {
          issues.push({
            severity: 'info',
            category: 'wcag_contrast',
            message: `${label}: ✅ ${ratio.toFixed(2)}:1 (AA pass)`,
          });
        }
      }
    }
  }

  // ── Aliases ─────────────────────────────────────────────────────────────────
  if (checks.includes('aliases')) {
    const componentPrefixes = ['button-', 'input-', 'badge-', 'card-', 'checkbox-', 'toast-', 'alert-'];
    for (const v of variables) {
      if (componentPrefixes.some(p => v.name.startsWith(p))) {
        try {
          const val = typeof v.value === 'string' ? JSON.parse(v.value) : v.value;
          const firstMode = Object.values(val as Record<string, unknown>)[0] as Record<string, unknown> | undefined;
          if (firstMode && firstMode.type !== 'VARIABLE_ALIAS') {
            issues.push({ severity: 'warning', category: 'aliases', message: `"${v.name}" has raw value — should alias to a semantic token` });
          }
        } catch { /* skip */ }
      }
    }
  }

  const errors   = issues.filter(i => i.severity === 'error').length;
  const warnings = issues.filter(i => i.severity === 'warning').length;
  const score    = Math.max(0, 100 - errors * 10 - warnings * 3);

  return JSON.stringify({
    score: `${score}/100`,
    summary: { errors, warnings, infos: issues.filter(i => i.severity === 'info').length },
    tokenCount: variables.length,
    issues,
  }, null, 2);
}
