interface FigmaVariable {
  id: string;
  name: string;
  key: string;
  variableCollectionId: string;
  resolvedType: string;
  valuesByMode: Record<string, any>;
}

interface FigmaVariableCollection {
  id: string;
  name: string;
  key: string;
  modes: Array<{ modeId: string; name: string }>;
  defaultModeId: string;
  remote: boolean;
  hiddenFromPublishing: boolean;
  variableIds: string[];
}

interface FigmaComponent {
  key: string;
  name: string;
  description: string;
  componentSetId: string | null;
  documentationLinks: any[];
}

interface FigmaFileVariablesResponse {
  status: number;
  error: boolean;
  meta: {
    variables: Record<string, FigmaVariable>;
    variableCollections: Record<string, FigmaVariableCollection>;
  };
}

interface FigmaFileComponentsResponse {
  status: number;
  error: boolean;
  meta: {
    components: FigmaComponent[];
  };
}

export class FigmaApiService {
  private accessToken: string;
  private baseUrl = 'https://api.figma.com/v1';

  constructor(accessToken?: string) {
    this.accessToken = accessToken || process.env.FIGMA_ACCESS_TOKEN || '';

    if (!this.accessToken) {
      console.warn('⚠️  FIGMA_ACCESS_TOKEN not set. Figma API calls will fail.');
    }
  }

  private async request<T>(endpoint: string): Promise<T> {
    if (!this.accessToken) {
      throw new Error('Figma access token not configured');
    }

    const url = `${this.baseUrl}${endpoint}`;
    const response = await fetch(url, {
      headers: {
        'X-Figma-Token': this.accessToken,
      },
    });

    if (!response.ok) {
      const error: any = await response.json().catch(() => ({}));
      throw new Error(error.message || `Figma API error: ${response.status}`);
    }

    return response.json() as Promise<T>;
  }

  /**
   * Get all variables and variable collections from a Figma file
   */
  async getFileVariables(fileKey: string): Promise<{
    variables: FigmaVariable[];
    collections: FigmaVariableCollection[];
  }> {
    try {
      const data = await this.request<FigmaFileVariablesResponse>(
        `/files/${fileKey}/variables/local`
      );

      const variables = Object.values(data.meta.variables || {});
      const collections = Object.values(data.meta.variableCollections || {});

      return { variables, collections };
    } catch (error: unknown) {
      console.error('Error fetching Figma variables:', error);
      throw error;
    }
  }

  /**
   * Get all components from a Figma file
   */
  async getFileComponents(fileKey: string): Promise<FigmaComponent[]> {
    try {
      const data = await this.request<FigmaFileComponentsResponse>(
        `/files/${fileKey}/components`
      );

      return data.meta.components || [];
    } catch (error: unknown) {
      console.error('Error fetching Figma components:', error);
      throw error;
    }
  }

  /**
   * Sync both variables and components from a Figma file
   */
  async syncFile(fileKey: string): Promise<{
    variables: FigmaVariable[];
    collections: FigmaVariableCollection[];
    components: FigmaComponent[];
  }> {
    const [variablesData, components] = await Promise.all([
      this.getFileVariables(fileKey),
      this.getFileComponents(fileKey),
    ]);

    return {
      variables: variablesData.variables,
      collections: variablesData.collections,
      components,
    };
  }
}

export const figmaApi = new FigmaApiService();
