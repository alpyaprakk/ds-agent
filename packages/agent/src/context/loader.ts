import { readFileSync, existsSync } from 'fs';
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
  conflict_resolution: any;
}

export interface NamingConventions {
  version: string;
  variables: any;
  components: any;
  properties: any;
  pages: any;
  frames: any;
}

export interface VariableSchema {
  version: string;
  collections: any;
  alias_guidelines: any;
  validation: any;
}

export interface ComponentTemplates {
  version: string;
  templates: Record<string, any>;
  usage_guidelines: Record<string, string>;
}

export interface AgentConfig {
  version: string;
  agent: any;
  behavior: any;
  conflict_handling: any;
  validation: any;
  learning: any;
  sync: any;
  notifications: any;
  performance: any;
  security: any;
  experimental: any;
}

export class ContextLoader {
  private contextPath: string;
  private rules: DesignSystemRules | null = null;
  private naming: NamingConventions | null = null;
  private schema: VariableSchema | null = null;
  private templates: ComponentTemplates | null = null;
  private config: AgentConfig | null = null;

  constructor(contextPath?: string) {
    this.contextPath = contextPath || join(process.cwd(), '.ds-agent');

    if (!existsSync(this.contextPath)) {
      throw new Error(`Context path not found: ${this.contextPath}`);
    }
  }

  loadAll(): void {
    this.loadRules();
    this.loadNaming();
    this.loadSchema();
    this.loadTemplates();
    this.loadConfig();
  }

  loadRules(): DesignSystemRules {
    if (this.rules) return this.rules;

    const path = join(this.contextPath, 'context', 'design-system-rules.json');
    const content = readFileSync(path, 'utf-8');
    this.rules = JSON.parse(content);

    return this.rules!;
  }

  loadNaming(): NamingConventions {
    if (this.naming) return this.naming;

    const path = join(this.contextPath, 'context', 'naming-conventions.json');
    const content = readFileSync(path, 'utf-8');
    this.naming = JSON.parse(content);

    return this.naming!;
  }

  loadSchema(): VariableSchema {
    if (this.schema) return this.schema;

    const path = join(this.contextPath, 'context', 'variable-schema.json');
    const content = readFileSync(path, 'utf-8');
    this.schema = JSON.parse(content);

    return this.schema!;
  }

  loadTemplates(): ComponentTemplates {
    if (this.templates) return this.templates;

    const path = join(this.contextPath, 'context', 'component-templates.json');
    const content = readFileSync(path, 'utf-8');
    this.templates = JSON.parse(content);

    return this.templates!;
  }

  loadConfig(): AgentConfig {
    if (this.config) return this.config;

    const path = join(this.contextPath, 'config', 'agent-config.json');
    const content = readFileSync(path, 'utf-8');
    this.config = JSON.parse(content);

    return this.config!;
  }

  getRules(): DesignSystemRules | null {
    return this.rules;
  }

  getNaming(): NamingConventions | null {
    return this.naming;
  }

  getSchema(): VariableSchema | null {
    return this.schema;
  }

  getTemplates(): ComponentTemplates | null {
    return this.templates;
  }

  getConfig(): AgentConfig | null {
    return this.config;
  }
}
