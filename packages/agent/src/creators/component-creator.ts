import { ContextLoader } from '../context/loader';
import { VariableAnalyzer } from '../analyzers/variable-analyzer';

export interface ComponentSpec {
  name: string;
  type: string;
  variants?: Record<string, string[]>;
  auto_layout?: boolean;
  variable_bindings?: Record<string, string>;
}

export interface CreateComponentResult {
  success: boolean;
  component?: any;
  variables_created?: string[];
  warnings?: string[];
  errors?: string[];
}

export class ComponentCreator {
  private contextLoader: ContextLoader;
  private variableAnalyzer: VariableAnalyzer;

  constructor(contextLoader: ContextLoader) {
    this.contextLoader = contextLoader;
    this.variableAnalyzer = new VariableAnalyzer(contextLoader);
  }

  async createComponent(
    spec: ComponentSpec,
    existingVariables: Record<string, any>
  ): Promise<CreateComponentResult> {
    const warnings: string[] = [];
    const errors: string[] = [];
    const variablesCreated: string[] = [];

    try {
      // 1. Validate component name
      const naming = this.contextLoader.loadNaming();
      if (!this.validateComponentName(spec.name, naming)) {
        errors.push(`Component name "${spec.name}" doesn't follow naming conventions`);
        return { success: false, errors };
      }

      // 2. Get component template
      const templates = this.contextLoader.loadTemplates();
      const template = templates.templates[spec.type];

      if (!template) {
        errors.push(`No template found for component type: ${spec.type}`);
        return { success: false, errors };
      }

      // 3. Analyze required variables
      const analysis = this.variableAnalyzer.analyzeForComponent(
        spec.type,
        existingVariables
      );

      // 4. Create missing variables
      if (analysis.missing_variables.length > 0) {
        warnings.push(
          `Creating ${analysis.missing_variables.length} missing variables`
        );

        for (const varName of analysis.missing_variables) {
          const suggestedValue = this.variableAnalyzer.suggestVariableValue(varName);

          if (suggestedValue !== null) {
            // TODO: Actually create variable in Figma via API
            variablesCreated.push(varName);
            existingVariables[varName] = suggestedValue;
          } else {
            warnings.push(`Could not suggest value for variable: ${varName}`);
          }
        }
      }

      // 5. Build component structure
      const componentStructure = this.buildComponentStructure(
        spec,
        template,
        existingVariables
      );

      // 6. Validate component
      const rules = this.contextLoader.loadRules();
      const validation = this.validateComponent(componentStructure, rules);

      if (!validation.valid) {
        errors.push(...validation.errors);
        return { success: false, errors, warnings };
      }

      // 7. Return success
      return {
        success: true,
        component: componentStructure,
        variables_created: variablesCreated,
        warnings: warnings.length > 0 ? warnings : undefined
      };
    } catch (error) {
      errors.push(error instanceof Error ? error.message : 'Unknown error');
      return { success: false, errors, warnings };
    }
  }

  private validateComponentName(name: string, naming: any): boolean {
    // Check if follows PascalCase
    if (!/^[A-Z][a-zA-Z0-9]*$/.test(name.split('/')[0])) {
      return false;
    }

    // Check forbidden patterns
    const forbidden = naming.components.forbidden_patterns || [];
    for (const pattern of forbidden) {
      const regex = new RegExp(pattern.replace('*', '.*'));
      if (regex.test(name)) {
        return false;
      }
    }

    return true;
  }

  private buildComponentStructure(
    spec: ComponentSpec,
    template: any,
    variables: Record<string, any>
  ): any {
    return {
      name: spec.name,
      type: template.type || 'COMPONENT_SET',
      properties: template.properties || {},
      structure: template.structure || {},
      variables: this.bindVariables(template, variables),
      auto_layout: spec.auto_layout !== false, // Default true
      variant_count: Object.values(spec.variants || {}).reduce(
        (acc, vals) => acc * vals.length,
        1
      )
    };
  }

  private bindVariables(template: any, variables: Record<string, any>): Record<string, any> {
    const bindings: Record<string, any> = {};

    if (template.variables) {
      for (const [variant, varObj] of Object.entries(template.variables)) {
        bindings[variant] = {};

        for (const [prop, value] of Object.entries(varObj as Record<string, any>)) {
          if (typeof value === 'string' && value.startsWith('variable(')) {
            const match = value.match(/variable\(([^)]+)\)/);
            if (match && variables[match[1]]) {
              bindings[variant][prop] = variables[match[1]];
            }
          }
        }
      }
    }

    return bindings;
  }

  private validateComponent(component: any, rules: any): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Check required fields
    const mustHave = rules.validation_rules.component_must_have || [];
    for (const field of mustHave) {
      if (!component[field] && field !== 'description') {
        errors.push(`Component is missing required field: ${field}`);
      }
    }

    // Check auto-layout
    if (rules.rules.components.auto_layout_required && !component.auto_layout) {
      errors.push('Component must have auto-layout enabled');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }
}
