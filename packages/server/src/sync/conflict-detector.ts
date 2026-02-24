import { SyncEvent, FigmaChange } from './orchestrator';

export interface ConflictCandidate {
  conflict_type: string;
  severity: 'low' | 'medium' | 'high';
  status: 'active';
  entity_type: string;
  entity_id: string;
  entity_name?: string;
  source1_type: string;
  source1_action: string;
  source1_value: any;
  source1_timestamp: Date;
  source2_type: string;
  source2_action: string;
  source2_value: any;
  source2_timestamp: Date;
  description: string;
  impact_score: number;
}

export class ConflictDetector {
  async detectConflicts(event: SyncEvent): Promise<ConflictCandidate[]> {
    const conflicts: ConflictCandidate[] = [];

    // TODO: Check against pending operations from agent/dashboard
    // For now, just detect some basic conflict scenarios

    for (const change of event.changes) {
      // Example: Detect if a component was deleted while agent was trying to update it
      if (change.action === 'deleted' && change.entity_type === 'component') {
        // Check if there are any pending updates for this component
        // This would query a pending operations table
        // For demo purposes, we'll skip actual detection
      }

      // Example: Detect variable value conflicts
      if (change.action === 'updated' && change.entity_type === 'variable') {
        // Check if agent recently tried to update the same variable
        // For demo purposes, we'll skip actual detection
      }
    }

    return conflicts;
  }

  determineSeverity(change: FigmaChange, pendingOps?: any[]): 'low' | 'medium' | 'high' {
    // HIGH: Deletion conflicts, affects > 10 components
    if (change.action === 'deleted') {
      return 'high';
    }

    // MEDIUM: Figma vs Agent simultaneous edit, affects primary file
    if (pendingOps && pendingOps.length > 0) {
      return 'medium';
    }

    // LOW: Minor changes, single variable updates
    return 'low';
  }

  createConflict(
    change: FigmaChange,
    pendingOp: any,
    event: SyncEvent
  ): ConflictCandidate {
    const severity = this.determineSeverity(change, [pendingOp]);

    return {
      conflict_type: `${change.entity_type}_${change.action}_conflict`,
      severity,
      status: 'active',
      entity_type: change.entity_type,
      entity_id: change.entity_id,
      entity_name: undefined, // TODO: Get entity name
      source1_type: 'agent',
      source1_action: pendingOp?.action || 'update',
      source1_value: pendingOp?.value,
      source1_timestamp: new Date(pendingOp?.timestamp),
      source2_type: 'figma',
      source2_action: change.action,
      source2_value: change.after,
      source2_timestamp: new Date(event.timestamp),
      description: `Conflict detected: ${change.entity_type} ${change.entity_id}`,
      impact_score: severity === 'high' ? 10 : severity === 'medium' ? 5 : 1
    };
  }
}
