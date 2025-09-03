/**
 * Relationship Manager for Data Model Integrity
 * Provides utilities for managing foreign key relationships and referential integrity
 */

import mongoose from 'mongoose';
import loggingService from '../services/loggingService';

export interface RelationshipDefinition {
  sourceModel: string;
  sourceField: string;
  targetModel: string;
  targetField?: string;
  onDelete: 'cascade' | 'restrict' | 'set_null' | 'no_action';
  onUpdate: 'cascade' | 'restrict' | 'set_null' | 'no_action';
}

export class RelationshipManager {
  private relationships: Map<string, RelationshipDefinition[]> = new Map();

  constructor() {
    this.initializeRelationships();
  }

  /**
   * Initialize all model relationships
   */
  private initializeRelationships(): void {
    const relationships: RelationshipDefinition[] = [
      // User relationships
      {
        sourceModel: 'User',
        sourceField: 'staffId',
        targetModel: 'Staff',
        onDelete: 'set_null',
        onUpdate: 'cascade'
      },
      {
        sourceModel: 'User',
        sourceField: 'clientId',
        targetModel: 'Client',
        onDelete: 'set_null',
        onUpdate: 'cascade'
      },
      {
        sourceModel: 'User',
        sourceField: 'managedSites',
        targetModel: 'Site',
        onDelete: 'no_action',
        onUpdate: 'cascade'
      },
      {
        sourceModel: 'User',
        sourceField: 'assignedTickets',
        targetModel: 'Ticket',
        onDelete: 'no_action',
        onUpdate: 'cascade'
      },
      {
        sourceModel: 'User',
        sourceField: 'relationships.supervisor',
        targetModel: 'User',
        onDelete: 'set_null',
        onUpdate: 'cascade'
      },

      // Ticket relationships
      {
        sourceModel: 'Ticket',
        sourceField: 'reportedBy',
        targetModel: 'User',
        onDelete: 'restrict',
        onUpdate: 'cascade'
      },
      {
        sourceModel: 'Ticket',
        sourceField: 'assignedTo',
        targetModel: 'User',
        onDelete: 'set_null',
        onUpdate: 'cascade'
      },
      {
        sourceModel: 'Ticket',
        sourceField: 'supervisorId',
        targetModel: 'User',
        onDelete: 'set_null',
        onUpdate: 'cascade'
      },
      {
        sourceModel: 'Ticket',
        sourceField: 'resolvedBy',
        targetModel: 'User',
        onDelete: 'set_null',
        onUpdate: 'cascade'
      },
      {
        sourceModel: 'Ticket',
        sourceField: 'siteId',
        targetModel: 'Site',
        onDelete: 'set_null',
        onUpdate: 'cascade'
      },
      {
        sourceModel: 'Ticket',
        sourceField: 'clientId',
        targetModel: 'Client',
        onDelete: 'restrict',
        onUpdate: 'cascade'
      },
      {
        sourceModel: 'Ticket',
        sourceField: 'parentTicket',
        targetModel: 'Ticket',
        onDelete: 'set_null',
        onUpdate: 'cascade'
      },
      {
        sourceModel: 'Ticket',
        sourceField: 'shiftId',
        targetModel: 'AdvancedShift',
        onDelete: 'set_null',
        onUpdate: 'cascade'
      },

      // Shift relationships
      {
        sourceModel: 'AdvancedShift',
        sourceField: 'userId',
        targetModel: 'User',
        onDelete: 'restrict',
        onUpdate: 'cascade'
      },
      {
        sourceModel: 'AdvancedShift',
        sourceField: 'staffId',
        targetModel: 'Staff',
        onDelete: 'restrict',
        onUpdate: 'cascade'
      },

      // Site relationships
      {
        sourceModel: 'Site',
        sourceField: 'client',
        targetModel: 'Client',
        onDelete: 'restrict',
        onUpdate: 'cascade'
      },

      // Staff relationships
      {
        sourceModel: 'Staff',
        sourceField: 'employment.reportingManager',
        targetModel: 'Staff',
        onDelete: 'set_null',
        onUpdate: 'cascade'
      },

      // Meeting Minutes relationships
      {
        sourceModel: 'MeetingMinutes',
        sourceField: 'organizer.userId',
        targetModel: 'User',
        onDelete: 'restrict',
        onUpdate: 'cascade'
      },
      {
        sourceModel: 'MeetingMinutes',
        sourceField: 'attendees.userId',
        targetModel: 'User',
        onDelete: 'no_action',
        onUpdate: 'cascade'
      },

      // SLA relationships
      {
        sourceModel: 'SlaTracker',
        sourceField: 'assignedTo',
        targetModel: 'User',
        onDelete: 'set_null',
        onUpdate: 'cascade'
      }
    ];

    // Group relationships by source model
    relationships.forEach(rel => {
      const existing = this.relationships.get(rel.sourceModel) || [];
      existing.push(rel);
      this.relationships.set(rel.sourceModel, existing);
    });
  }

  /**
   * Validate foreign key relationships for a document
   */
  async validateRelationships(modelName: string, document: any): Promise<string[]> {
    const errors: string[] = [];
    const modelRelationships = this.relationships.get(modelName) || [];

    for (const rel of modelRelationships) {
      const value = this.getNestedValue(document, rel.sourceField);
      
      if (!value) continue; // Skip null/undefined values

      try {
        if (Array.isArray(value)) {
          // Handle array relationships
          for (const id of value) {
            const exists = await this.checkDocumentExists(rel.targetModel, id);
            if (!exists) {
              errors.push(`Referenced document ${id} not found in ${rel.targetModel} for field ${rel.sourceField}`);
            }
          }
        } else {
          // Handle single relationships
          const exists = await this.checkDocumentExists(rel.targetModel, value);
          if (!exists) {
            errors.push(`Referenced document ${value} not found in ${rel.targetModel} for field ${rel.sourceField}`);
          }
        }
      } catch (error) {
        loggingService.error('Error validating relationship', error, {
          modelName,
          relationship: rel
        });
        errors.push(`Error validating relationship ${rel.sourceField}: ${error}`);
      }
    }

    return errors;
  }

  /**
   * Handle cascading operations when a document is deleted
   */
  async handleCascadeDelete(modelName: string, documentId: mongoose.Types.ObjectId): Promise<void> {
    try {
      // Find all relationships where this model is the target
      const allRelationships: RelationshipDefinition[] = [];
      this.relationships.forEach(rels => {
        allRelationships.push(...rels.filter(rel => rel.targetModel === modelName));
      });

      for (const rel of allRelationships) {
        switch (rel.onDelete) {
          case 'cascade':
            await this.cascadeDelete(rel.sourceModel, rel.sourceField, documentId);
            break;
          case 'set_null':
            await this.setFieldToNull(rel.sourceModel, rel.sourceField, documentId);
            break;
          case 'restrict':
            await this.checkRestriction(rel.sourceModel, rel.sourceField, documentId);
            break;
          case 'no_action':
            // Do nothing
            break;
        }
      }
    } catch (error) {
      loggingService.error('Error handling cascade delete', error, {
        modelName,
        documentId
      });
      throw error;
    }
  }

  /**
   * Check if a document exists in the database
   */
  private async checkDocumentExists(modelName: string, id: mongoose.Types.ObjectId): Promise<boolean> {
    try {
      const Model = mongoose.model(modelName);
      const doc = await Model.findById(id).select('_id').lean();
      return !!doc;
    } catch (error) {
      // Model might not exist or other error
      return false;
    }
  }

  /**
   * Get nested value from object using dot notation
   */
  private getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => {
      return current && current[key] !== undefined ? current[key] : undefined;
    }, obj);
  }

  /**
   * Cascade delete related documents
   */
  private async cascadeDelete(sourceModel: string, sourceField: string, targetId: mongoose.Types.ObjectId): Promise<void> {
    try {
      const Model = mongoose.model(sourceModel);
      const query = this.buildQuery(sourceField, targetId);
      
      // Find documents to delete
      const docsToDelete = await Model.find(query).select('_id').lean();
      
      // Delete documents and handle their cascades
      for (const doc of docsToDelete) {
        await this.handleCascadeDelete(sourceModel, doc._id);
        await Model.findByIdAndDelete(doc._id);
      }
    } catch (error) {
      loggingService.error('Error in cascade delete', error, {
        sourceModel,
        sourceField,
        targetId
      });
    }
  }

  /**
   * Set field to null for referencing documents
   */
  private async setFieldToNull(sourceModel: string, sourceField: string, targetId: mongoose.Types.ObjectId): Promise<void> {
    try {
      const Model = mongoose.model(sourceModel);
      const query = this.buildQuery(sourceField, targetId);
      
      if (sourceField.includes('.')) {
        // Handle nested field updates
        const updateObj = this.buildNestedUpdate(sourceField, null);
        await Model.updateMany(query, { $set: updateObj });
      } else {
        // Handle array fields by pulling the value
        if (Array.isArray(await this.getFieldType(sourceModel, sourceField))) {
          await Model.updateMany(query, { $pull: { [sourceField]: targetId } });
        } else {
          await Model.updateMany(query, { $set: { [sourceField]: null } });
        }
      }
    } catch (error) {
      loggingService.error('Error setting field to null', error, {
        sourceModel,
        sourceField,
        targetId
      });
    }
  }

  /**
   * Check restriction - throw error if referenced documents exist
   */
  private async checkRestriction(sourceModel: string, sourceField: string, targetId: mongoose.Types.ObjectId): Promise<void> {
    try {
      const Model = mongoose.model(sourceModel);
      const query = this.buildQuery(sourceField, targetId);
      
      const count = await Model.countDocuments(query);
      if (count > 0) {
        throw new Error(`Cannot delete document: ${count} ${sourceModel} documents reference it via ${sourceField}`);
      }
    } catch (error) {
      loggingService.error('Error checking restriction', error, {
        sourceModel,
        sourceField,
        targetId
      });
      throw error;
    }
  }

  /**
   * Build MongoDB query for relationship field
   */
  private buildQuery(field: string, value: mongoose.Types.ObjectId): any {
    if (field.includes('.')) {
      // Nested field
      return { [field]: value };
    } else {
      // Could be single value or array
      return {
        $or: [
          { [field]: value },
          { [field]: { $in: [value] } }
        ]
      };
    }
  }

  /**
   * Build nested update object
   */
  private buildNestedUpdate(field: string, value: any): any {
    return { [field]: value };
  }

  /**
   * Get field type to determine if it's an array
   */
  private async getFieldType(modelName: string, field: string): Promise<any> {
    try {
      const Model = mongoose.model(modelName);
      const schema = Model.schema;
      const fieldPath = schema.path(field);
      return fieldPath ? fieldPath.instance : 'Mixed';
    } catch (error) {
      return 'Mixed';
    }
  }

  /**
   * Add relationship hook to a model
   */
  addRelationshipHooks(modelName: string, schema: mongoose.Schema): void {
    // Pre-save validation hook
    schema.pre('save', async function(next) {
      const errors = await relationshipManager.validateRelationships(modelName, this);
      if (errors.length > 0) {
        const error = new Error(`Relationship validation failed: ${errors.join(', ')}`);
        return next(error);
      }
      next();
    });

    // Pre-remove hook for cascade delete
    schema.pre(['deleteOne', 'findOneAndDelete'], async function(next) {
      try {
        const doc = await this.model.findOne(this.getQuery());
        if (doc) {
          await relationshipManager.handleCascadeDelete(modelName, doc._id);
        }
        next();
      } catch (error) {
        next(error);
      }
    });
  }

  /**
   * Validate all relationships in the database (maintenance utility)
   */
  async validateAllRelationships(): Promise<{ model: string; errors: string[] }[]> {
    const results: { model: string; errors: string[] }[] = [];

    for (const [modelName] of this.relationships) {
      try {
        const Model = mongoose.model(modelName);
        const documents = await Model.find({}).lean();
        
        for (const doc of documents) {
          const errors = await this.validateRelationships(modelName, doc);
          if (errors.length > 0) {
            results.push({
              model: `${modelName}:${doc._id}`,
              errors
            });
          }
        }
      } catch (error) {
        results.push({
          model: modelName,
          errors: [`Error validating model: ${error}`]
        });
      }
    }

    return results;
  }

  /**
   * Repair broken relationships (maintenance utility)
   */
  async repairBrokenRelationships(): Promise<number> {
    let repairedCount = 0;
    const brokenRefs = await this.validateAllRelationships();

    for (const broken of brokenRefs) {
      try {
        const [modelName, docId] = broken.model.split(':');
        if (!docId) continue;

        const Model = mongoose.model(modelName);
        const relationships = this.relationships.get(modelName) || [];

        for (const rel of relationships) {
          if (rel.onDelete === 'set_null') {
            await this.setFieldToNull(rel.sourceModel, rel.sourceField, new mongoose.Types.ObjectId(docId));
            repairedCount++;
          }
        }
      } catch (error) {
        loggingService.error('Error repairing relationship', error, { broken });
      }
    }

    return repairedCount;
  }
}

// Export singleton instance
export const relationshipManager = new RelationshipManager();

// Export utility functions
export async function validateDocumentRelationships(modelName: string, document: any): Promise<string[]> {
  return relationshipManager.validateRelationships(modelName, document);
}

export async function handleDocumentDeletion(modelName: string, documentId: mongoose.Types.ObjectId): Promise<void> {
  return relationshipManager.handleCascadeDelete(modelName, documentId);
}

export function addRelationshipHooks(modelName: string, schema: mongoose.Schema): void {
  relationshipManager.addRelationshipHooks(modelName, schema);
}

export default relationshipManager;