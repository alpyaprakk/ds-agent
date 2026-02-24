import { readFileSync } from 'fs';
import { join } from 'path';

export interface DesignSystemRules {
  version: string;
  rules: {
    variables: any;
    components: any;
    best_practices: any;
  };
  validation_rules: any;
  guardrails: any;
}

export class AgentContext {
  private rules: DesignSystemRules | null = null;
  private contextPath: string;

  constructor(contextPath?: string) {
    this.contextPath = contextPath || join(process.cwd(), '.ds-agent');
  }

  loadRules(): DesignSystemRules {
    if (this.rules) return this.rules;

    const rulesPath = join(this.contextPath, 'context', 'design-system-rules.json');
    const rulesContent = readFileSync(rulesPath, 'utf-8');
    this.rules = JSON.parse(rulesContent);

    return this.rules!;
  }

  getRules(): DesignSystemRules | null {
    return this.rules;
  }

  validateComponentName(name: string): boolean {
    if (!this.rules) this.loadRules();

    // Example validation
    return name.length > 0 && /^[A-Z]/.test(name);
  }
}

export default AgentContext;
