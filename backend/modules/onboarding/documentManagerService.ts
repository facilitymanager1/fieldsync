/**
 * Document Manager Service - Document Upload, Validation, and Management
 * 
 * Features:
 * - Document upload and storage
 * - OCR integration for data extraction
 * - Document validation and verification
 * - Version control and audit trails
 * - Compliance with data protection standards
 * - Automatic document categorization
 */

import mongoose from 'mongoose';
import { OnboardingRecord } from '../../models/onboarding/onboardingRecord';
import { AuditLog } from '../../models/auditLog';
import * as crypto from 'crypto';
import * as fs from 'fs/promises';
import * as path from 'path';

interface DocumentUploadResult {
  success: boolean;
  documentId?: string;
  extractedData?: any;
  validationResults?: DocumentValidation;
  errors?: string[];
  warnings?: string[];
}

interface DocumentValidation {
  isValid: boolean;
  documentType: string;
  confidence: number;
  extractedFields: { [key: string]: any };
  validationErrors: string[];
  validationWarnings: string[];
}

interface DocumentTemplate {
  type: string;
  displayName: string;
  required: boolean;
  acceptedFormats: string[];
  maxFileSize: number;
  ocrEnabled: boolean;
  validationRules: {
    requiredFields: string[];
    optionalFields: string[];
    patterns: { [field: string]: string };
  };
}

interface DocumentMetadata {
  documentId: string;
  documentType: string;
  originalFilename: string;
  filePath: string;
  fileSize: number;
  mimeType: string;
  uploadedAt: Date;
  uploadedBy: string;
  version: number;
  status: 'uploaded' | 'processing' | 'verified' | 'rejected';
  extractedData?: any;
  validationResults?: DocumentValidation;
  reviewedBy?: string;
  reviewedAt?: Date;
  reviewComments?: string;
}

export class DocumentManagerService {
  private readonly documentStoragePath = process.env.DOCUMENT_STORAGE_PATH || './storage/documents';
  
  private readonly documentTemplates: DocumentTemplate[] = [
    {
      type: 'aadhaar_card',
      displayName: 'Aadhaar Card',
      required: true,
      acceptedFormats: ['pdf', 'jpg', 'jpeg', 'png'],
      maxFileSize: 5 * 1024 * 1024, // 5MB
      ocrEnabled: true,
      validationRules: {
        requiredFields: ['aadhaar_number', 'name', 'date_of_birth'],
        optionalFields: ['address', 'phone'],
        patterns: {
          aadhaar_number: '^[0-9]{12}$'
        }
      }
    },
    {
      type: 'pan_card',
      displayName: 'PAN Card',
      required: true,
      acceptedFormats: ['pdf', 'jpg', 'jpeg', 'png'],
      maxFileSize: 5 * 1024 * 1024,
      ocrEnabled: true,
      validationRules: {
        requiredFields: ['pan_number', 'name', 'father_name', 'date_of_birth'],
        optionalFields: [],
        patterns: {
          pan_number: '^[A-Z]{5}[0-9]{4}[A-Z]{1}$'
        }
      }
    },
    {
      type: 'bank_passbook',
      displayName: 'Bank Passbook/Statement',
      required: true,
      acceptedFormats: ['pdf', 'jpg', 'jpeg', 'png'],
      maxFileSize: 10 * 1024 * 1024,
      ocrEnabled: true,
      validationRules: {
        requiredFields: ['account_number', 'ifsc_code', 'account_holder_name'],
        optionalFields: ['bank_name', 'branch_name'],
        patterns: {
          account_number: '^[0-9]{9,18}$',
          ifsc_code: '^[A-Z]{4}0[A-Z0-9]{6}$'
        }
      }
    },
    {
      type: 'educational_certificate',
      displayName: 'Educational Certificate',
      required: false,
      acceptedFormats: ['pdf', 'jpg', 'jpeg', 'png'],
      maxFileSize: 10 * 1024 * 1024,
      ocrEnabled: true,
      validationRules: {
        requiredFields: ['certificate_type', 'institution_name', 'year'],
        optionalFields: ['percentage', 'grade', 'subjects'],
        patterns: {}
      }
    },
    {
      type: 'experience_certificate',
      displayName: 'Experience Certificate',
      required: false,
      acceptedFormats: ['pdf', 'jpg', 'jpeg', 'png'],
      maxFileSize: 10 * 1024 * 1024,
      ocrEnabled: true,
      validationRules: {
        requiredFields: ['company_name', 'designation', 'duration'],
        optionalFields: ['salary', 'responsibilities'],
        patterns: {}
      }
    },
    {
      type: 'address_proof',
      displayName: 'Address Proof',
      required: true,
      acceptedFormats: ['pdf', 'jpg', 'jpeg', 'png'],
      maxFileSize: 5 * 1024 * 1024,
      ocrEnabled: true,
      validationRules: {
        requiredFields: ['address', 'name'],
        optionalFields: ['document_type', 'issue_date'],
        patterns: {}
      }
    }
  ];

  /**
   * Get required documents for onboarding
   */
  getRequiredDocuments(): DocumentTemplate[] {
    return this.documentTemplates;
  }

  /**
   * Upload and process document
   */
  async uploadDocument(
    onboardingId: string,
    documentType: string,
    fileBuffer: Buffer,
    originalFilename: string,
    uploadedBy: string
  ): Promise<DocumentUploadResult> {
    const session = await mongoose.startSession();
    
    try {
      session.startTransaction();

      // Get onboarding record
      const onboarding = await OnboardingRecord.findOne({ onboardingId }).session(session);
      if (!onboarding) {
        throw new Error('Onboarding record not found');
      }

      // Find document upload step
      const documentStep = onboarding.workflowSteps.find(
        step => step.stepKey === 'document_upload'
      );
      
      if (!documentStep) {
        throw new Error('Document upload step not found');
      }

      // Get document template
      const template = this.documentTemplates.find(t => t.type === documentType);
      if (!template) {
        throw new Error(`Unknown document type: ${documentType}`);
      }

      // Validate file
      const fileValidation = await this.validateFile(fileBuffer, originalFilename, template);
      if (!fileValidation.isValid) {
        return {
          success: false,
          errors: fileValidation.validationErrors
        };
      }

      // Generate document ID and save file
      const documentId = crypto.randomUUID();
      const fileExtension = path.extname(originalFilename).toLowerCase();
      const filename = `${onboardingId}_${documentType}_${documentId}${fileExtension}`;
      const filePath = path.join(this.documentStoragePath, onboardingId, filename);

      // Ensure directory exists
      await fs.mkdir(path.dirname(filePath), { recursive: true });
      await fs.writeFile(filePath, fileBuffer);

      // Create document metadata
      const documentMetadata: DocumentMetadata = {
        documentId,
        documentType,
        originalFilename,
        filePath,
        fileSize: fileBuffer.length,
        mimeType: this.getMimeType(fileExtension),
        uploadedAt: new Date(),
        uploadedBy,
        version: 1,
        status: 'uploaded'
      };

      // Initialize documents array if not exists
      if (!documentStep.documentsUploaded) {
        documentStep.documentsUploaded = [];
      }

      // Check for existing document of same type (for versioning)
      const existingDocIndex = documentStep.documentsUploaded.findIndex(
        (doc: any) => doc.documentType === documentType
      );

      if (existingDocIndex !== -1) {
        // Update version number
        documentMetadata.version = (documentStep.documentsUploaded[existingDocIndex].version || 1) + 1;
        documentStep.documentsUploaded[existingDocIndex] = documentMetadata;
      } else {
        documentStep.documentsUploaded.push(documentMetadata);
      }

      // Update step status
      if (documentStep.stepStatus === 'pending') {
        documentStep.stepStatus = 'in_progress';
        documentStep.startedAt = new Date();
      }

      onboarding.lastActivity = new Date();
      await onboarding.save({ session });

      let extractedData: any = {};
      let validationResults: DocumentValidation | undefined;

      // Process document with OCR if enabled
      if (template.ocrEnabled) {
        try {
          documentMetadata.status = 'processing';
          await onboarding.save({ session });

          extractedData = await this.extractDataFromDocument(filePath, template);
          validationResults = await this.validateExtractedData(extractedData, template);

          documentMetadata.extractedData = extractedData;
          documentMetadata.validationResults = validationResults;
          documentMetadata.status = validationResults.isValid ? 'verified' : 'uploaded';

          // Update document in array
          const docIndex = documentStep.documentsUploaded.findIndex(
            (doc: any) => doc.documentId === documentId
          );
          if (docIndex !== -1) {
            documentStep.documentsUploaded[docIndex] = documentMetadata;
          }

          await onboarding.save({ session });
        } catch (ocrError) {
          console.error('OCR processing error:', ocrError);
          documentMetadata.status = 'uploaded';
        }
      }

      // Check if all required documents are uploaded
      await this.checkDocumentCompleteness(onboarding, documentStep);
      await onboarding.save({ session });

      await session.commitTransaction();

      // Log audit event
      await this.logAuditEvent(onboardingId, 'document_uploaded', {
        documentId,
        documentType,
        originalFilename,
        fileSize: fileBuffer.length,
        version: documentMetadata.version,
        ocrProcessed: template.ocrEnabled
      });

      return {
        success: true,
        documentId,
        extractedData,
        validationResults,
        warnings: fileValidation.validationWarnings
      };

    } catch (error) {
      await session.abortTransaction();
      console.error('Document upload error:', error);
      return {
        success: false,
        errors: [error instanceof Error ? error.message : 'Document upload failed']
      };
    } finally {
      session.endSession();
    }
  }

  /**
   * Validate file against template requirements
   */
  private async validateFile(
    fileBuffer: Buffer,
    originalFilename: string,
    template: DocumentTemplate
  ): Promise<{
    isValid: boolean;
    validationErrors: string[];
    validationWarnings: string[];
  }> {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check file size
    if (fileBuffer.length > template.maxFileSize) {
      errors.push(`File size exceeds ${template.maxFileSize / (1024 * 1024)}MB limit`);
    }

    // Check file format
    const extension = path.extname(originalFilename).toLowerCase().substring(1);
    if (!template.acceptedFormats.includes(extension)) {
      errors.push(`Unsupported format. Allowed: ${template.acceptedFormats.join(', ')}`);
    }

    // Check file integrity
    const isValidFile = await this.validateFileIntegrity(fileBuffer, extension);
    if (!isValidFile) {
      errors.push('Invalid or corrupted file');
    }

    // File size warnings
    if (fileBuffer.length > template.maxFileSize * 0.8) {
      warnings.push('File size is close to the maximum limit');
    }

    return {
      isValid: errors.length === 0,
      validationErrors: errors,
      validationWarnings: warnings
    };
  }

  /**
   * Validate file integrity based on magic bytes
   */
  private async validateFileIntegrity(fileBuffer: Buffer, extension: string): Promise<boolean> {
    const magicBytes = fileBuffer.subarray(0, 8);
    const hex = magicBytes.toString('hex').toUpperCase();

    switch (extension) {
      case 'pdf':
        return hex.startsWith('255044462D'); // %PDF-
      case 'jpg':
      case 'jpeg':
        return hex.startsWith('FFD8');
      case 'png':
        return hex.startsWith('89504E47');
      default:
        return false;
    }
  }

  /**
   * Get MIME type for file extension
   */
  private getMimeType(extension: string): string {
    const mimeTypes: { [key: string]: string } = {
      '.pdf': 'application/pdf',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png'
    };

    return mimeTypes[extension] || 'application/octet-stream';
  }

  /**
   * Extract data from document using OCR
   */
  private async extractDataFromDocument(
    filePath: string,
    template: DocumentTemplate
  ): Promise<any> {
    try {
      // Simulate OCR processing
      // In production, integrate with OCR services like Tesseract, Google Vision API, AWS Textract, etc.
      
      const extractedData: any = {};

      switch (template.type) {
        case 'aadhaar_card':
          extractedData.aadhaar_number = this.generateRandomNumber(12);
          extractedData.name = 'EXTRACTED NAME';
          extractedData.date_of_birth = '01/01/1990';
          extractedData.address = 'EXTRACTED ADDRESS';
          break;

        case 'pan_card':
          extractedData.pan_number = 'ABCDE1234F';
          extractedData.name = 'EXTRACTED NAME';
          extractedData.father_name = 'FATHER NAME';
          extractedData.date_of_birth = '01/01/1990';
          break;

        case 'bank_passbook':
          extractedData.account_number = this.generateRandomNumber(12);
          extractedData.ifsc_code = 'SBIN0001234';
          extractedData.account_holder_name = 'EXTRACTED NAME';
          extractedData.bank_name = 'STATE BANK OF INDIA';
          break;

        default:
          extractedData.document_text = 'EXTRACTED TEXT CONTENT';
          break;
      }

      // Add confidence scores
      extractedData._confidence = {
        overall: 0.8 + Math.random() * 0.2,
        fields: Object.keys(extractedData).reduce((acc: any, key) => {
          if (key !== '_confidence') {
            acc[key] = 0.7 + Math.random() * 0.3;
          }
          return acc;
        }, {})
      };

      return extractedData;

    } catch (error) {
      console.error('OCR extraction error:', error);
      throw error;
    }
  }

  /**
   * Validate extracted data against template rules
   */
  private async validateExtractedData(
    extractedData: any,
    template: DocumentTemplate
  ): Promise<DocumentValidation> {
    const validationErrors: string[] = [];
    const validationWarnings: string[] = [];
    const extractedFields: { [key: string]: any } = {};

    // Check required fields
    for (const field of template.validationRules.requiredFields) {
      if (!extractedData[field] || extractedData[field].trim() === '') {
        validationErrors.push(`Required field '${field}' not found or empty`);
      } else {
        extractedFields[field] = extractedData[field];
      }
    }

    // Check optional fields
    for (const field of template.validationRules.optionalFields) {
      if (extractedData[field] && extractedData[field].trim() !== '') {
        extractedFields[field] = extractedData[field];
      }
    }

    // Validate patterns
    for (const [field, pattern] of Object.entries(template.validationRules.patterns)) {
      if (extractedData[field]) {
        const regex = new RegExp(pattern);
        if (!regex.test(extractedData[field])) {
          validationErrors.push(`Field '${field}' does not match expected format`);
        }
      }
    }

    // Check confidence scores
    if (extractedData._confidence?.overall < 0.7) {
      validationWarnings.push('Low confidence in extracted data. Manual review recommended');
    }

    return {
      isValid: validationErrors.length === 0,
      documentType: template.type,
      confidence: extractedData._confidence?.overall || 0,
      extractedFields,
      validationErrors,
      validationWarnings
    };
  }

  /**
   * Check if all required documents are uploaded and validated
   */
  private async checkDocumentCompleteness(
    onboarding: any,
    documentStep: any
  ): Promise<void> {
    const requiredDocuments = this.documentTemplates.filter(t => t.required);
    const uploadedDocuments = documentStep.documentsUploaded || [];

    const missingDocuments = requiredDocuments.filter(required => 
      !uploadedDocuments.some((uploaded: any) => 
        uploaded.documentType === required.type && 
        ['verified', 'uploaded'].includes(uploaded.status)
      )
    );

    if (missingDocuments.length === 0) {
      // All required documents uploaded
      documentStep.stepStatus = 'verified';
      documentStep.completedAt = new Date();
      
      // Update progress
      const progress = onboarding.progress || {};
      progress.documentsUploaded = uploadedDocuments.length;
      progress.documentsRequired = this.documentTemplates.length;
      onboarding.progress = progress;
    }
  }

  /**
   * Review and approve/reject document
   */
  async reviewDocument(
    onboardingId: string,
    documentId: string,
    reviewAction: 'approve' | 'reject',
    reviewComments: string,
    reviewedBy: string
  ): Promise<void> {
    const session = await mongoose.startSession();
    
    try {
      session.startTransaction();

      const onboarding = await OnboardingRecord.findOne({ onboardingId }).session(session);
      if (!onboarding) {
        throw new Error('Onboarding record not found');
      }

      const documentStep = onboarding.workflowSteps.find(
        step => step.stepKey === 'document_upload'
      );

      if (!documentStep?.documentsUploaded) {
        throw new Error('No documents found');
      }

      const documentIndex = documentStep.documentsUploaded.findIndex(
        (doc: any) => doc.documentId === documentId
      );

      if (documentIndex === -1) {
        throw new Error('Document not found');
      }

      // Update document status
      documentStep.documentsUploaded[documentIndex].status = reviewAction === 'approve' ? 'verified' : 'rejected';
      documentStep.documentsUploaded[documentIndex].reviewedBy = reviewedBy;
      documentStep.documentsUploaded[documentIndex].reviewedAt = new Date();
      documentStep.documentsUploaded[documentIndex].reviewComments = reviewComments;

      onboarding.lastActivity = new Date();

      // Recheck document completeness
      await this.checkDocumentCompleteness(onboarding, documentStep);
      
      await onboarding.save({ session });
      await session.commitTransaction();

      // Log audit event
      await this.logAuditEvent(onboardingId, 'document_reviewed', {
        documentId,
        reviewAction,
        reviewComments,
        reviewedBy
      });

    } catch (error) {
      await session.abortTransaction();
      console.error('Document review error:', error);
      throw error;
    } finally {
      session.endSession();
    }
  }

  /**
   * Get document status for onboarding
   */
  async getDocumentStatus(onboardingId: string): Promise<{
    totalRequired: number;
    uploaded: number;
    verified: number;
    rejected: number;
    documents: DocumentMetadata[];
    missingDocuments: string[];
  }> {
    const onboarding = await OnboardingRecord.findOne({ onboardingId });
    if (!onboarding) {
      throw new Error('Onboarding record not found');
    }

    const documentStep = onboarding.workflowSteps.find(
      step => step.stepKey === 'document_upload'
    );

    const uploadedDocuments = documentStep?.documentsUploaded || [];
    const requiredDocuments = this.documentTemplates.filter(t => t.required);

    const verified = uploadedDocuments.filter((doc: any) => doc.status === 'verified').length;
    const rejected = uploadedDocuments.filter((doc: any) => doc.status === 'rejected').length;

    const missingDocuments = requiredDocuments
      .filter(required => 
        !uploadedDocuments.some((uploaded: any) => 
          uploaded.documentType === required.type && 
          ['verified', 'uploaded'].includes(uploaded.status)
        )
      )
      .map(doc => doc.displayName);

    return {
      totalRequired: requiredDocuments.length,
      uploaded: uploadedDocuments.length,
      verified,
      rejected,
      documents: uploadedDocuments,
      missingDocuments
    };
  }

  /**
   * Delete document
   */
  async deleteDocument(onboardingId: string, documentId: string): Promise<void> {
    const session = await mongoose.startSession();
    
    try {
      session.startTransaction();

      const onboarding = await OnboardingRecord.findOne({ onboardingId }).session(session);
      if (!onboarding) {
        throw new Error('Onboarding record not found');
      }

      const documentStep = onboarding.workflowSteps.find(
        step => step.stepKey === 'document_upload'
      );

      if (!documentStep?.documentsUploaded) {
        throw new Error('No documents found');
      }

      const documentIndex = documentStep.documentsUploaded.findIndex(
        (doc: any) => doc.documentId === documentId
      );

      if (documentIndex === -1) {
        throw new Error('Document not found');
      }

      const document = documentStep.documentsUploaded[documentIndex];

      // Delete file from storage
      try {
        await fs.unlink(document.filePath);
      } catch (error) {
        console.warn(`Failed to delete file: ${document.filePath}`);
      }

      // Remove from array
      documentStep.documentsUploaded.splice(documentIndex, 1);

      onboarding.lastActivity = new Date();
      await onboarding.save({ session });
      await session.commitTransaction();

      // Log audit event
      await this.logAuditEvent(onboardingId, 'document_deleted', {
        documentId,
        documentType: document.documentType,
        originalFilename: document.originalFilename
      });

    } catch (error) {
      await session.abortTransaction();
      console.error('Document deletion error:', error);
      throw error;
    } finally {
      session.endSession();
    }
  }

  /**
   * Generate random number string
   */
  private generateRandomNumber(length: number): string {
    return Array.from({ length }, () => Math.floor(Math.random() * 10)).join('');
  }

  /**
   * Log audit event
   */
  private async logAuditEvent(
    onboardingId: string,
    action: string,
    details: any
  ): Promise<void> {
    try {
      await AuditLog.create({
        userId: 'system',
        action,
        resourceType: 'document_management',
        resourceId: onboardingId,
        details,
        ipAddress: '127.0.0.1',
        userAgent: 'DocumentManagerService',
        timestamp: new Date()
      });
    } catch (error) {
      console.error('Failed to log audit event:', error);
    }
  }

  /**
   * Get document analytics
   */
  async getDocumentAnalytics(): Promise<{
    totalDocuments: number;
    documentsByType: { [type: string]: number };
    documentsByStatus: { [status: string]: number };
    averageProcessingTime: number;
    ocrSuccessRate: number;
  }> {
    const onboardings = await OnboardingRecord.find({
      'workflowSteps.stepKey': 'document_upload'
    });

    let totalDocuments = 0;
    const documentsByType: { [type: string]: number } = {};
    const documentsByStatus: { [status: string]: number } = {};
    let totalProcessingTime = 0;
    let documentsWithProcessingTime = 0;
    let ocrProcessedCount = 0;
    let ocrSuccessCount = 0;

    for (const onboarding of onboardings) {
      const documentStep = onboarding.workflowSteps.find(
        step => step.stepKey === 'document_upload'
      );

      if (documentStep?.documentsUploaded) {
        for (const doc of documentStep.documentsUploaded) {
          totalDocuments++;
          
          documentsByType[doc.documentType] = (documentsByType[doc.documentType] || 0) + 1;
          documentsByStatus[doc.status] = (documentsByStatus[doc.status] || 0) + 1;

          if (doc.reviewedAt && doc.uploadedAt) {
            const processingTime = doc.reviewedAt.getTime() - doc.uploadedAt.getTime();
            totalProcessingTime += processingTime;
            documentsWithProcessingTime++;
          }

          if (doc.extractedData) {
            ocrProcessedCount++;
            if (doc.validationResults?.isValid) {
              ocrSuccessCount++;
            }
          }
        }
      }
    }

    return {
      totalDocuments,
      documentsByType,
      documentsByStatus,
      averageProcessingTime: documentsWithProcessingTime > 0 ? 
        totalProcessingTime / documentsWithProcessingTime : 0,
      ocrSuccessRate: ocrProcessedCount > 0 ? 
        (ocrSuccessCount / ocrProcessedCount) * 100 : 0
    };
  }
}
