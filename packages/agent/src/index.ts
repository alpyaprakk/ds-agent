// Import classes
import { ContextLoader } from './context/loader';
import { VariableAnalyzer } from './analyzers/variable-analyzer';
import { ComponentCreator } from './creators/component-creator';

// Export main classes
export { ContextLoader } from './context/loader';
export { VariableAnalyzer } from './analyzers/variable-analyzer';
export { ComponentCreator } from './creators/component-creator';

// Export types
export type {
  DesignSystemRules,
  NamingConventions,
  VariableSchema,
  ComponentTemplates,
  AgentConfig
} from './context/loader';

export type {
  VariableAnalysis,
  ComponentVariableRequirements
} from './analyzers/variable-analyzer';

export type {
  ComponentSpec,
  CreateComponentResult
} from './creators/component-creator';

// Main Agent class
export class DesignSystemAgent {
  private contextLoader: ContextLoader;
  private variableAnalyzer: VariableAnalyzer;
  private componentCreator: ComponentCreator;

  constructor(contextPath?: string) {
    this.contextLoader = new ContextLoader(contextPath);
    this.contextLoader.loadAll();

    this.variableAnalyzer = new VariableAnalyzer(this.contextLoader);
    this.componentCreator = new ComponentCreator(this.contextLoader);
  }

  getContextLoader() {
    return this.contextLoader;
  }

  getVariableAnalyzer() {
    return this.variableAnalyzer;
  }

  getComponentCreator() {
    return this.componentCreator;
  }

  async createComponent(spec: any, existingVariables: Record<string, any>) {
    return this.componentCreator.createComponent(spec, existingVariables);
  }

  analyzeVariables(componentType: string, existingVariables: Record<string, any>) {
    return this.variableAnalyzer.analyzeForComponent(componentType, existingVariables);
  }
}

export default DesignSystemAgent;
