import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';

export interface DesignSystemData {
  file: {
    name: string;
    key: string;
  };
  variables: Array<{
    id: string;
    name: string;
    key: string;
    resolvedType: string;
    variableCollectionId: string;
    valuesByMode: Record<string, any>;
  }>;
  collections: Array<{
    id: string;
    name: string;
    key: string;
    modes: Array<{ modeId: string; name: string }>;
    defaultModeId: string;
  }>;
  components: Array<{
    id: string;
    key: string;
    name: string;
    description?: string;
    type: string;
    parent?: string | null;
  }>;
}

export interface AnalysisIssue {
  severity: 'low' | 'medium' | 'high';
  category: 'naming' | 'structure' | 'token' | 'component' | 'consistency';
  title: string;
  description: string;
  entityType: 'variable' | 'component' | 'collection';
  entityId: string;
  entityName: string;
  suggestion?: string;
  autoFixable: boolean;
}

export interface AnalysisReport {
  summary: {
    totalIssues: number;
    highSeverity: number;
    mediumSeverity: number;
    lowSeverity: number;
    autoFixableCount: number;
  };
  issues: AnalysisIssue[];
  recommendations: string[];
  score: number; // 0-100
}

export class AIAnalyzer {
  private anthropic: Anthropic | null = null;
  private openai: OpenAI | null = null;
  private provider: 'anthropic' | 'openai' = 'anthropic';

  constructor(config: {
    provider: 'anthropic' | 'openai';
    anthropicApiKey?: string;
    openaiApiKey?: string;
  }) {
    this.provider = config.provider;

    if (config.provider === 'anthropic' && config.anthropicApiKey) {
      this.anthropic = new Anthropic({
        apiKey: config.anthropicApiKey
      });
    } else if (config.provider === 'openai' && config.openaiApiKey) {
      this.openai = new OpenAI({
        apiKey: config.openaiApiKey
      });
    }
  }

  async analyzeDesignSystem(data: DesignSystemData): Promise<AnalysisReport> {
    const prompt = this.buildAnalysisPrompt(data);

    let response: string;

    if (this.provider === 'anthropic' && this.anthropic) {
      response = await this.callAnthropic(prompt);
    } else if (this.provider === 'openai' && this.openai) {
      response = await this.callOpenAI(prompt);
    } else {
      throw new Error('AI provider not configured');
    }

    return this.parseAnalysisResponse(response, data);
  }

  private buildAnalysisPrompt(data: DesignSystemData): string {
    return `You are a design system expert. Analyze this Figma design system and identify issues, conflicts, and improvements.

**File:** ${data.file.name}

**Variables:** ${data.variables.length} total
${data.variables.slice(0, 10).map(v => `- ${v.name} (${v.resolvedType})`).join('\n')}
${data.variables.length > 10 ? `... and ${data.variables.length - 10} more` : ''}

**Collections:** ${data.collections.length} total
${data.collections.map(c => `- ${c.name} (${c.modes.length} modes)`).join('\n')}

**Components:** ${data.components.length} total
${data.components.slice(0, 10).map(c => `- ${c.name}${c.parent ? ` (in ${c.parent})` : ''}`).join('\n')}
${data.components.length > 10 ? `... and ${data.components.length - 10} more` : ''}

**Analyze for:**

1. **Naming Conventions**
   - Inconsistent naming patterns (camelCase, kebab-case, snake_case)
   - Missing prefixes/namespaces
   - Unclear or ambiguous names
   - Example: "color-primary" vs "primaryColor" vs "primary_color"

2. **Token Structure**
   - Variables not following semantic naming (e.g., "blue" instead of "primary")
   - Missing token hierarchy (primitive → semantic → component)
   - Duplicate or redundant variables
   - Variables with similar values but different names

3. **Component Issues**
   - Components without descriptions
   - Components not using variables (hardcoded values)
   - Inconsistent component organization
   - Missing auto-layout on containers

4. **Collection Organization**
   - Poorly organized collections
   - Missing mode variations (light/dark, mobile/desktop)
   - Variables in wrong collections

5. **Consistency**
   - Conflicting values across similar variables
   - Inconsistent spacing/sizing scales
   - Color palette gaps or inconsistencies

**Output Format (JSON):**
{
  "issues": [
    {
      "severity": "high" | "medium" | "low",
      "category": "naming" | "structure" | "token" | "component" | "consistency",
      "title": "Short issue title",
      "description": "Detailed explanation",
      "entityType": "variable" | "component" | "collection",
      "entityId": "figma_id",
      "entityName": "Display name",
      "suggestion": "How to fix it",
      "autoFixable": true | false
    }
  ],
  "recommendations": [
    "High-level recommendations for improving the design system"
  ],
  "score": 75
}

Return ONLY the JSON object, no markdown, no explanation.`;
  }

  private async callAnthropic(prompt: string): Promise<string> {
    if (!this.anthropic) {
      throw new Error('Anthropic client not initialized');
    }

    const message = await this.anthropic.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 4096,
      temperature: 0.3,
      messages: [{
        role: 'user',
        content: prompt
      }]
    });

    const textContent = message.content.find(block => block.type === 'text');
    if (!textContent || textContent.type !== 'text') {
      throw new Error('No text response from Claude');
    }

    return textContent.text;
  }

  private async callOpenAI(prompt: string): Promise<string> {
    if (!this.openai) {
      throw new Error('OpenAI client not initialized');
    }

    const completion = await this.openai.chat.completions.create({
      model: 'gpt-4-turbo-preview',
      messages: [{
        role: 'user',
        content: prompt
      }],
      temperature: 0.3,
      response_format: { type: 'json_object' }
    });

    return completion.choices[0]?.message?.content || '{}';
  }

  private parseAnalysisResponse(response: string, data: DesignSystemData): AnalysisReport {
    try {
      // Remove markdown code blocks if present
      let cleanResponse = response.trim();
      if (cleanResponse.startsWith('```json')) {
        cleanResponse = cleanResponse.replace(/```json\n?/g, '').replace(/```\n?/g, '');
      } else if (cleanResponse.startsWith('```')) {
        cleanResponse = cleanResponse.replace(/```\n?/g, '');
      }

      const parsed = JSON.parse(cleanResponse);

      const issues: AnalysisIssue[] = parsed.issues || [];

      // Calculate summary
      const summary = {
        totalIssues: issues.length,
        highSeverity: issues.filter(i => i.severity === 'high').length,
        mediumSeverity: issues.filter(i => i.severity === 'medium').length,
        lowSeverity: issues.filter(i => i.severity === 'low').length,
        autoFixableCount: issues.filter(i => i.autoFixable).length
      };

      return {
        summary,
        issues,
        recommendations: parsed.recommendations || [],
        score: parsed.score || this.calculateHealthScore(summary, data)
      };
    } catch (error) {
      console.error('Failed to parse AI response:', error);
      console.error('Response:', response);

      // Return fallback analysis
      return {
        summary: {
          totalIssues: 0,
          highSeverity: 0,
          mediumSeverity: 0,
          lowSeverity: 0,
          autoFixableCount: 0
        },
        issues: [],
        recommendations: ['Unable to parse AI analysis. Please try again.'],
        score: 0
      };
    }
  }

  private calculateHealthScore(summary: any, data: DesignSystemData): number {
    // Simple scoring algorithm
    let score = 100;

    // Deduct points for issues
    score -= summary.highSeverity * 10;
    score -= summary.mediumSeverity * 5;
    score -= summary.lowSeverity * 2;

    // Bonus for having variables and components
    if (data.variables.length > 0) score += 5;
    if (data.components.length > 0) score += 5;
    if (data.collections.length > 0) score += 5;

    return Math.max(0, Math.min(100, score));
  }
}
