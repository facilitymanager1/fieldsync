/**
 * Model Migration Helper
 * Utilities for migrating existing models to use proper type inheritance
 */

import { Schema, model, Document, Types } from 'mongoose';
import { BaseDocument, BaseAuditableDocument, BaseEntityType, BaseAuditableEntityType } from '../types/modelTypes';
import { createBaseEntitySchema, createBaseAuditableEntitySchema } from '../models/baseModel';

/**
 * Migration helper class for updating model inheritance
 */
export class ModelMigrationHelper {
  /**
   * Convert a legacy Document interface to BaseDocument
   */
  static convertToBaseDocument<T extends Record<string, any>>(
    legacyInterface: any,
    additionalFields: T
  ): BaseEntityType<T> {
    const baseFields = {
      _id: legacyInterface._id,
      id: legacyInterface.id || legacyInterface._id?.toString(),
      createdAt: legacyInterface.createdAt || new Date(),
      updatedAt: legacyInterface.updatedAt || new Date(),
      createdBy: legacyInterface.createdBy || 'system',
      updatedBy: legacyInterface.updatedBy || 'system',
      version: legacyInterface.version || 1,
      isActive: legacyInterface.isActive !== undefined ? legacyInterface.isActive : true,
      metadata: legacyInterface.metadata || {},
      tags: legacyInterface.tags || [],
      customFields: legacyInterface.customFields || {}
    };

    return { ...baseFields, ...additionalFields } as BaseEntityType<T>;
  }

  /**
   * Convert a legacy Document interface to BaseAuditableDocument
   */
  static convertToBaseAuditableDocument<T extends Record<string, any>>(
    legacyInterface: any,
    additionalFields: T
  ): BaseAuditableEntityType<T> {
    const baseAuditableFields = {
      ...this.convertToBaseDocument(legacyInterface, {}),
      auditLog: legacyInterface.auditLog || [],
      lastAuditedAt: legacyInterface.lastAuditedAt,
      auditFrequency: legacyInterface.auditFrequency || 30
    };

    return { ...baseAuditableFields, ...additionalFields } as BaseAuditableEntityType<T>;
  }

  /**
   * Create a migration schema from legacy schema
   */
  static createMigrationSchema<T extends BaseDocument>(
    legacySchemaObj: Record<string, any>,
    isAuditable: boolean = false,
    additionalFields: Record<string, any> = {}
  ): Schema<T> {
    // Remove legacy base fields that are now handled by BaseEntity
    const {
      _id,
      id,
      createdAt,
      updatedAt,
      createdBy,
      updatedBy,
      version,
      isActive,
      metadata,
      tags,
      customFields,
      auditLog,
      lastAuditedAt,
      auditFrequency,
      __v,
      ...cleanedFields
    } = legacySchemaObj;

    // Merge with additional fields
    const schemaFields = { ...cleanedFields, ...additionalFields };

    if (isAuditable) {
      return createBaseAuditableEntitySchema<any>(schemaFields) as Schema<T>;
    } else {
      return createBaseEntitySchema<any>(schemaFields) as Schema<T>;
    }
  }

  /**
   * Validate that a document follows the new inheritance pattern
   */
  static validateDocumentStructure(document: any): {
    isValid: boolean;
    errors: string[];
    warnings: string[];
  } {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check required base fields
    const requiredFields = ['createdAt', 'updatedAt', 'createdBy', 'updatedBy', 'version', 'isActive'];
    for (const field of requiredFields) {
      if (!document[field] && document[field] !== false) {
        errors.push(`Missing required base field: ${field}`);
      }
    }

    // Check field types
    if (document.version && !Number.isInteger(document.version)) {
      errors.push('Version must be an integer');
    }

    if (document.isActive !== undefined && typeof document.isActive !== 'boolean') {
      errors.push('isActive must be a boolean');
    }

    if (document.metadata && typeof document.metadata !== 'object') {
      errors.push('metadata must be an object');
    }

    if (document.tags && !Array.isArray(document.tags)) {
      errors.push('tags must be an array');
    }

    if (document.customFields && typeof document.customFields !== 'object') {
      errors.push('customFields must be an object');
    }

    // Check audit fields if present
    if (document.auditLog) {
      if (!Array.isArray(document.auditLog)) {
        errors.push('auditLog must be an array');
      } else if (document.auditLog.length > 1000) {
        warnings.push('auditLog exceeds recommended size of 1000 entries');
      }
    }

    if (document.auditFrequency && (!Number.isInteger(document.auditFrequency) || 
        document.auditFrequency < 1 || document.auditFrequency > 365)) {
      errors.push('auditFrequency must be an integer between 1 and 365');
    }

    // Check for legacy fields that should be removed
    const legacyFields = ['__v'];
    for (const field of legacyFields) {
      if (document[field] !== undefined) {
        warnings.push(`Legacy field detected: ${field} should be removed`);
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Generate migration report for a collection
   */
  static async generateMigrationReport(
    modelName: string,
    sampleSize: number = 100
  ): Promise<{
    modelName: string;
    totalDocuments: number;
    sampleSize: number;
    validDocuments: number;
    invalidDocuments: number;
    commonErrors: Record<string, number>;
    commonWarnings: Record<string, number>;
    migrationRecommendations: string[];
  }> {
    try {
      const Model = model(modelName);
      const totalDocuments = await Model.countDocuments();
      const documents = await Model.find().limit(sampleSize).lean();

      let validDocuments = 0;
      let invalidDocuments = 0;
      const errorCounts: Record<string, number> = {};
      const warningCounts: Record<string, number> = {};

      for (const doc of documents) {
        const validation = this.validateDocumentStructure(doc);
        
        if (validation.isValid) {
          validDocuments++;
        } else {
          invalidDocuments++;
        }

        // Count errors
        for (const error of validation.errors) {
          errorCounts[error] = (errorCounts[error] || 0) + 1;
        }

        // Count warnings
        for (const warning of validation.warnings) {
          warningCounts[warning] = (warningCounts[warning] || 0) + 1;
        }
      }

      // Generate recommendations
      const recommendations: string[] = [];
      
      if (invalidDocuments > 0) {
        recommendations.push(`${invalidDocuments} documents need field migration`);
      }

      if (errorCounts['Missing required base field: createdBy']) {
        recommendations.push('Add default createdBy values for existing documents');
      }

      if (errorCounts['Missing required base field: updatedBy']) {
        recommendations.push('Add default updatedBy values for existing documents');
      }

      if (errorCounts['Version must be an integer']) {
        recommendations.push('Convert version fields to integers');
      }

      if (warningCounts['Legacy field detected: __v should be removed']) {
        recommendations.push('Remove __v fields from schema and documents');
      }

      return {
        modelName,
        totalDocuments,
        sampleSize: documents.length,
        validDocuments,
        invalidDocuments,
        commonErrors: errorCounts,
        commonWarnings: warningCounts,
        migrationRecommendations: recommendations
      };
    } catch (error) {
      throw new Error(`Failed to generate migration report for ${modelName}: ${error}`);
    }
  }

  /**
   * Execute data migration for a model
   */
  static async migrateModelData(
    modelName: string,
    batchSize: number = 1000,
    dryRun: boolean = true
  ): Promise<{
    processed: number;
    migrated: number;
    skipped: number;
    errors: Array<{ documentId: string; error: string }>;
  }> {
    try {
      const Model = model(modelName);
      let processed = 0;
      let migrated = 0;
      let skipped = 0;
      const errors: Array<{ documentId: string; error: string }> = [];

      let hasMore = true;
      let lastId: Types.ObjectId | null = null;

      while (hasMore) {
        const query = lastId ? { _id: { $gt: lastId } } : {};
        const documents = await Model.find(query).limit(batchSize).sort({ _id: 1 });

        if (documents.length === 0) {
          hasMore = false;
          break;
        }

        for (const doc of documents) {
          try {
            processed++;
            lastId = doc._id;

            const validation = this.validateDocumentStructure(doc);
            
            if (validation.isValid) {
              skipped++;
              continue;
            }

            // Prepare migration data
            const migrationData: any = {};
            
            if (!doc.createdBy) migrationData.createdBy = 'migration';
            if (!doc.updatedBy) migrationData.updatedBy = 'migration';
            if (!doc.version) migrationData.version = 1;
            if (doc.isActive === undefined) migrationData.isActive = true;
            if (!doc.metadata) migrationData.metadata = {};
            if (!doc.tags) migrationData.tags = [];
            if (!doc.customFields) migrationData.customFields = {};

            // Only update if there are changes to make
            if (Object.keys(migrationData).length > 0) {
              if (!dryRun) {
                await Model.updateOne(
                  { _id: doc._id },
                  { 
                    $set: migrationData,
                    $unset: { __v: 1 } // Remove legacy version key
                  }
                );
              }
              migrated++;
            } else {
              skipped++;
            }
          } catch (error) {
            errors.push({
              documentId: doc._id.toString(),
              error: error instanceof Error ? error.message : String(error)
            });
          }
        }
      }

      return {
        processed,
        migrated,
        skipped,
        errors
      };
    } catch (error) {
      throw new Error(`Failed to migrate model data for ${modelName}: ${error}`);
    }
  }

  /**
   * Create indexes for migrated models
   */
  static async createMigrationIndexes(modelName: string): Promise<void> {
    try {
      const Model = model(modelName);
      
      // Create standard base entity indexes
      await Model.createIndexes([
        { createdAt: 1 },
        { updatedAt: 1 },
        { createdBy: 1 },
        { updatedBy: 1 },
        { isActive: 1 },
        { tags: 1 },
        { version: 1 },
        // Compound indexes for common queries
        { isActive: 1, createdAt: -1 },
        { createdBy: 1, createdAt: -1 },
        { updatedBy: 1, updatedAt: -1 }
      ]);

      console.log(`Created migration indexes for ${modelName}`);
    } catch (error) {
      throw new Error(`Failed to create indexes for ${modelName}: ${error}`);
    }
  }

  /**
   * Generate TypeScript interface migration code
   */
  static generateInterfaceMigration(
    interfaceName: string,
    legacyFields: Record<string, string>,
    isAuditable: boolean = false
  ): string {
    const baseType = isAuditable ? 'BaseAuditableDocument' : 'BaseDocument';
    
    let interfaceCode = `export interface ${interfaceName}Document extends ${baseType} {\n`;
    
    for (const [fieldName, fieldType] of Object.entries(legacyFields)) {
      // Skip base fields that are now inherited
      if ([
        '_id', 'id', 'createdAt', 'updatedAt', 'createdBy', 'updatedBy', 
        'version', 'isActive', 'metadata', 'tags', 'customFields',
        'auditLog', 'lastAuditedAt', 'auditFrequency'
      ].includes(fieldName)) {
        continue;
      }
      
      interfaceCode += `  ${fieldName}: ${fieldType};\n`;
    }
    
    interfaceCode += '}\n';
    
    return interfaceCode;
  }

  /**
   * Validate migration completeness
   */
  static async validateMigration(modelName: string): Promise<{
    isComplete: boolean;
    issues: string[];
    statistics: {
      totalDocuments: number;
      validDocuments: number;
      invalidDocuments: number;
      completionPercentage: number;
    };
  }> {
    try {
      const report = await this.generateMigrationReport(modelName, 1000);
      const issues: string[] = [];
      
      // Check for common migration issues
      if (report.invalidDocuments > 0) {
        issues.push(`${report.invalidDocuments} documents still have validation errors`);
      }
      
      if (report.commonErrors['Missing required base field: createdBy']) {
        issues.push('Some documents missing createdBy field');
      }
      
      if (report.commonErrors['Missing required base field: updatedBy']) {
        issues.push('Some documents missing updatedBy field');
      }
      
      const completionPercentage = (report.validDocuments / (report.validDocuments + report.invalidDocuments)) * 100;
      
      return {
        isComplete: issues.length === 0,
        issues,
        statistics: {
          totalDocuments: report.totalDocuments,
          validDocuments: report.validDocuments,
          invalidDocuments: report.invalidDocuments,
          completionPercentage
        }
      };
    } catch (error) {
      throw new Error(`Failed to validate migration for ${modelName}: ${error}`);
    }
  }
}

export default ModelMigrationHelper;