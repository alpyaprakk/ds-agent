import { ContextLoader } from '../context/loader';

export interface VariableAnalysis {
  missing_variables: string[];
  variable_coverage: number;
  recommendations: string[];
  required_collections: string[];
  existing_variables: Record<string, any>;
}

export interface ComponentVariableRequirements {
  component_type: string;
  required_variables: string[];
  optional_variables: string[];
  minimum_coverage: number;
}

export class VariableAnalyzer {
  private contextLoader: ContextLoader;

  constructor(contextLoader: ContextLoader) {
    this.contextLoader = contextLoader;
  }

  analyzeForComponent(
    componentType: string,
    existingVariables: Record<string, any>
  ): VariableAnalysis {
    const schema = this.contextLoader.loadSchema();
    const templates = this.contextLoader.loadTemplates();

    // Get component template
    const template = templates.templates[componentType];
    if (!template) {
      return {
        missing_variables: [],
        variable_coverage: 0,
        recommendations: [`No template found for component type: ${componentType}`],
        required_collections: [],
        existing_variables: existingVariables
      };
    }

    // Extract required variables from template
    const requiredVars = this.extractRequiredVariables(template);
    const missingVars: string[] = [];

    // Check which variables are missing
    for (const varName of requiredVars) {
      if (!existingVariables[varName]) {
        missingVars.push(varName);
      }
    }

    const coverage = requiredVars.length > 0
      ? ((requiredVars.length - missingVars.length) / requiredVars.length) * 100
      : 100;

    const recommendations: string[] = [];

    if (missingVars.length > 0) {
      recommendations.push(
        `Missing ${missingVars.length} required variables: ${missingVars.join(', ')}`
      );
      recommendations.push('Creating missing variables with appropriate values');
    }

    if (coverage < 80) {
      recommendations.push('Variable coverage is below 80%, consider adding more variables');
    }

    return {
      missing_variables: missingVars,
      variable_coverage: coverage,
      recommendations,
      required_collections: Object.keys(schema.collections),
      existing_variables: existingVariables
    };
  }

  private extractRequiredVariables(template: any): string[] {
    const variables: string[] = [];

    // Extract from variables section
    if (template.variables) {
      for (const variant of Object.keys(template.variables)) {
        const varObj = template.variables[variant];
        for (const value of Object.values(varObj)) {
          if (typeof value === 'string' && value.startsWith('variable(')) {
            // Extract variable name from variable(name) format
            const match = value.match(/variable\(([^)]+)\)/);
            if (match) {
              variables.push(match[1]);
            }
          }
        }
      }
    }

    // Extract from structure section
    if (template.structure) {
      this.extractVariablesFromStructure(template.structure, variables);
    }

    return Array.from(new Set(variables)); // Remove duplicates
  }

  private extractVariablesFromStructure(structure: any, variables: string[]): void {
    if (!structure) return;

    // Check auto_layout
    if (structure.auto_layout) {
      const autoLayout = structure.auto_layout;

      if (autoLayout.padding) {
        if (typeof autoLayout.padding === 'string') {
          this.addVariableIfFormat(autoLayout.padding, variables);
        } else {
          Object.values(autoLayout.padding).forEach(val => {
            if (typeof val === 'string') {
              this.addVariableIfFormat(val, variables);
            }
          });
        }
      }

      if (autoLayout.gap) {
        this.addVariableIfFormat(autoLayout.gap, variables);
      }
    }

    // Check children
    if (Array.isArray(structure.children)) {
      structure.children.forEach((child: any) => {
        if (child.style) {
          this.addVariableIfFormat(child.style, variables);
        }
        if (child.size) {
          this.addVariableIfFormat(child.size, variables);
        }
      });
    }
  }

  private addVariableIfFormat(value: any, variables: string[]): void {
    if (typeof value === 'string' && value.startsWith('variable(')) {
      const match = value.match(/variable\(([^)]+)\)/);
      if (match) {
        variables.push(match[1]);
      }
    }
  }

  suggestVariableValue(variableName: string): any {
    const schema = this.contextLoader.loadSchema();

    // Parse variable name (format: category/property/variant)
    const parts = variableName.split('/');
    const category = parts[0];

    if (!schema.collections[category]) {
      return null;
    }

    // Return sensible defaults based on category
    switch (category) {
      case 'color':
        return '#3B82F6'; // Default blue
      case 'spacing':
        return 16; // Default medium spacing
      case 'typography':
        if (parts[1] === 'size') return 16;
        if (parts[1] === 'weight') return 'normal';
        if (parts[1] === 'font') return 'Inter';
        return null;
      case 'border':
        if (parts[1] === 'radius') return 8;
        if (parts[1] === 'width') return 1;
        return null;
      case 'shadow':
        return '0 4px 6px rgba(0,0,0,0.1)';
      default:
        return null;
    }
  }
}
