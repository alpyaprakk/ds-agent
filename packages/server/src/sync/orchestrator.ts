import { ConflictDetector } from './conflict-detector';
import { ConflictRepository } from '../db/repositories';

export interface FigmaChange {
  entity_type: string;
  entity_id: string;
  action: string;
  before?: any;
  after?: any;
  property?: string;
}

export interface SyncEvent {
  workspace_id: string;
  file_id: string;
  changes: FigmaChange[];
  timestamp: string;
}

export interface SyncResult {
  status: 'success' | 'conflict' | 'error';
  conflicts?: any[];
  applied_changes?: number;
  message?: string;
}

export class SyncOrchestrator {
  private conflictDetector: ConflictDetector;
  private conflictRepo: ConflictRepository;

  constructor() {
    this.conflictDetector = new ConflictDetector();
    this.conflictRepo = new ConflictRepository();
  }

  async processFigmaChanges(event: SyncEvent): Promise<SyncResult> {
    try {
      console.log(`Processing ${event.changes.length} changes from Figma file ${event.file_id}`);

      // 1. Detect conflicts
      const conflicts = await this.conflictDetector.detectConflicts(event);

      if (conflicts.length > 0) {
        console.log(`Found ${conflicts.length} conflicts`);

        // 2. Save conflicts to database
        const savedConflicts = [];
        for (const conflict of conflicts) {
          const saved = await this.conflictRepo.create({
            workspace_id: event.workspace_id,
            ...conflict
          });
          savedConflicts.push(saved);
        }

        // 3. For high severity conflicts, return immediately
        const highSeverity = savedConflicts.filter(c => c.severity === 'high');
        if (highSeverity.length > 0) {
          return {
            status: 'conflict',
            conflicts: highSeverity,
            message: `${highSeverity.length} high severity conflicts require manual resolution`
          };
        }

        // 4. For low/medium conflicts, auto-resolve
        for (const conflict of savedConflicts.filter(c => c.severity !== 'high')) {
          await this.autoResolveConflict(conflict);
        }
      }

      // 5. Apply changes (TODO: implement actual database updates)
      console.log(`Applying ${event.changes.length} changes`);

      return {
        status: 'success',
        applied_changes: event.changes.length,
        conflicts: conflicts.length > 0 ? conflicts : undefined
      };
    } catch (error) {
      console.error('Error processing Figma changes:', error);
      return {
        status: 'error',
        message: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  private async autoResolveConflict(conflict: any): Promise<void> {
    // Strategy B+: Designer (Figma) always wins
    if (conflict.source2_type === 'figma') {
      await this.conflictRepo.resolve(
        conflict.id,
        'auto',
        'source2',
        conflict.source2_value,
        'system'
      );
      console.log(`Auto-resolved conflict ${conflict.id}: Designer wins`);
    } else {
      await this.conflictRepo.resolve(
        conflict.id,
        'auto',
        'source1',
        conflict.source1_value,
        'system'
      );
      console.log(`Auto-resolved conflict ${conflict.id}: Agent wins (no Figma conflict)`);
    }
  }
}
