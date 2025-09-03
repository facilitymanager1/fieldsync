import RNFS from 'react-native-fs';
import { Platform, PermissionsAndroid } from 'react-native';
import { Alert } from 'react-native';

export interface PDFMetadata {
  fileName: string;
  filePath: string;
  fileSize: number;
  createdDate: Date;
  type: 'biodata' | 'complete' | 'individual';
  formType?: string;
  employeeId: string;
}

class PDFUtils {
  private static instance: PDFUtils;
  private pdfDirectory: string;

  constructor() {
    this.pdfDirectory = Platform.OS === 'ios' 
      ? `${RNFS.DocumentDirectoryPath}/pdfs`
      : `${RNFS.ExternalDirectoryPath}/FieldSync/PDFs`;
  }

  public static getInstance(): PDFUtils {
    if (!PDFUtils.instance) {
      PDFUtils.instance = new PDFUtils();
    }
    return PDFUtils.instance;
  }

  /**
   * Initialize PDF directory and request permissions
   */
  async initializePDFDirectory(): Promise<boolean> {
    try {
      // Request storage permissions for Android
      if (Platform.OS === 'android') {
        const granted = await this.requestStoragePermission();
        if (!granted) {
          Alert.alert(
            'Permission Required',
            'Storage permission is required to save PDF files.'
          );
          return false;
        }
      }

      // Create PDF directory if it doesn't exist
      const exists = await RNFS.exists(this.pdfDirectory);
      if (!exists) {
        await RNFS.mkdir(this.pdfDirectory);
      }

      return true;
    } catch (error) {
      console.error('Error initializing PDF directory:', error);
      return false;
    }
  }

  /**
   * Request storage permission for Android
   */
  private async requestStoragePermission(): Promise<boolean> {
    try {
      if (Platform.OS !== 'android') {
        return true;
      }

      const granted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE,
        {
          title: 'Storage Permission',
          message: 'FieldSync needs access to storage to save PDF files.',
          buttonNeutral: 'Ask Me Later',
          buttonNegative: 'Cancel',
          buttonPositive: 'OK',
        }
      );

      return granted === PermissionsAndroid.RESULTS.GRANTED;
    } catch (error) {
      console.error('Error requesting storage permission:', error);
      return false;
    }
  }

  /**
   * Get PDF storage directory path
   */
  getPDFDirectory(): string {
    return this.pdfDirectory;
  }

  /**
   * Generate unique PDF file name
   */
  generatePDFFileName(
    employeeId: string,
    type: 'biodata' | 'complete' | 'individual',
    formType?: string
  ): string {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const typePrefix = formType ? `${type}_${formType}` : type;
    return `${employeeId}_${typePrefix}_${timestamp}.pdf`;
  }

  /**
   * Get full PDF file path
   */
  getPDFFilePath(fileName: string): string {
    return `${this.pdfDirectory}/${fileName}`;
  }

  /**
   * Save PDF metadata to storage
   */
  async savePDFMetadata(metadata: PDFMetadata): Promise<boolean> {
    try {
      const metadataPath = `${this.pdfDirectory}/metadata.json`;
      let existingMetadata: PDFMetadata[] = [];

      // Load existing metadata if file exists
      const metadataExists = await RNFS.exists(metadataPath);
      if (metadataExists) {
        const metadataContent = await RNFS.readFile(metadataPath, 'utf8');
        existingMetadata = JSON.parse(metadataContent);
      }

      // Add new metadata
      existingMetadata.push(metadata);

      // Save updated metadata
      await RNFS.writeFile(metadataPath, JSON.stringify(existingMetadata, null, 2), 'utf8');
      return true;
    } catch (error) {
      console.error('Error saving PDF metadata:', error);
      return false;
    }
  }

  /**
   * Load all PDF metadata
   */
  async loadPDFMetadata(): Promise<PDFMetadata[]> {
    try {
      const metadataPath = `${this.pdfDirectory}/metadata.json`;
      const metadataExists = await RNFS.exists(metadataPath);
      
      if (!metadataExists) {
        return [];
      }

      const metadataContent = await RNFS.readFile(metadataPath, 'utf8');
      return JSON.parse(metadataContent);
    } catch (error) {
      console.error('Error loading PDF metadata:', error);
      return [];
    }
  }

  /**
   * Get PDF metadata by employee ID
   */
  async getPDFMetadataByEmployee(employeeId: string): Promise<PDFMetadata[]> {
    try {
      const allMetadata = await this.loadPDFMetadata();
      return allMetadata.filter(metadata => metadata.employeeId === employeeId);
    } catch (error) {
      console.error('Error getting PDF metadata by employee:', error);
      return [];
    }
  }

  /**
   * Delete PDF file and its metadata
   */
  async deletePDF(filePath: string): Promise<boolean> {
    try {
      // Delete the PDF file
      const fileExists = await RNFS.exists(filePath);
      if (fileExists) {
        await RNFS.unlink(filePath);
      }

      // Remove metadata
      const allMetadata = await this.loadPDFMetadata();
      const updatedMetadata = allMetadata.filter(metadata => metadata.filePath !== filePath);
      
      const metadataPath = `${this.pdfDirectory}/metadata.json`;
      await RNFS.writeFile(metadataPath, JSON.stringify(updatedMetadata, null, 2), 'utf8');

      return true;
    } catch (error) {
      console.error('Error deleting PDF:', error);
      return false;
    }
  }

  /**
   * Get PDF file size
   */
  async getPDFFileSize(filePath: string): Promise<number> {
    try {
      const fileExists = await RNFS.exists(filePath);
      if (!fileExists) {
        return 0;
      }

      const stat = await RNFS.stat(filePath);
      return stat.size;
    } catch (error) {
      console.error('Error getting PDF file size:', error);
      return 0;
    }
  }

  /**
   * Format file size to human readable format
   */
  formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';

    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  /**
   * Get directory storage statistics
   */
  async getStorageStats(): Promise<{
    totalFiles: number;
    totalSize: number;
    formattedSize: string;
    directoryPath: string;
  }> {
    try {
      const directoryExists = await RNFS.exists(this.pdfDirectory);
      if (!directoryExists) {
        return {
          totalFiles: 0,
          totalSize: 0,
          formattedSize: '0 Bytes',
          directoryPath: this.pdfDirectory,
        };
      }

      const files = await RNFS.readDir(this.pdfDirectory);
      const pdfFiles = files.filter(file => file.name.endsWith('.pdf'));
      
      let totalSize = 0;
      for (const file of pdfFiles) {
        totalSize += file.size;
      }

      return {
        totalFiles: pdfFiles.length,
        totalSize,
        formattedSize: this.formatFileSize(totalSize),
        directoryPath: this.pdfDirectory,
      };
    } catch (error) {
      console.error('Error getting storage stats:', error);
      return {
        totalFiles: 0,
        totalSize: 0,
        formattedSize: '0 Bytes',
        directoryPath: this.pdfDirectory,
      };
    }
  }

  /**
   * Clean up old PDF files (older than specified days)
   */
  async cleanupOldPDFs(daysOld: number = 30): Promise<number> {
    try {
      const allMetadata = await this.loadPDFMetadata();
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysOld);

      let deletedCount = 0;
      const updatedMetadata: PDFMetadata[] = [];

      for (const metadata of allMetadata) {
        const createdDate = new Date(metadata.createdDate);
        if (createdDate < cutoffDate) {
          // Delete old PDF
          const fileExists = await RNFS.exists(metadata.filePath);
          if (fileExists) {
            await RNFS.unlink(metadata.filePath);
            deletedCount++;
          }
        } else {
          // Keep recent PDF
          updatedMetadata.push(metadata);
        }
      }

      // Update metadata file
      if (deletedCount > 0) {
        const metadataPath = `${this.pdfDirectory}/metadata.json`;
        await RNFS.writeFile(metadataPath, JSON.stringify(updatedMetadata, null, 2), 'utf8');
      }

      return deletedCount;
    } catch (error) {
      console.error('Error cleaning up old PDFs:', error);
      return 0;
    }
  }

  /**
   * Validate PDF file integrity
   */
  async validatePDFFile(filePath: string): Promise<boolean> {
    try {
      const fileExists = await RNFS.exists(filePath);
      if (!fileExists) {
        return false;
      }

      const stat = await RNFS.stat(filePath);
      // Check if file is not empty and has reasonable size (> 1KB)
      return stat.size > 1024;
    } catch (error) {
      console.error('Error validating PDF file:', error);
      return false;
    }
  }

  /**
   * Backup PDFs to a different location
   */
  async backupPDFs(backupPath?: string): Promise<boolean> {
    try {
      const defaultBackupPath = Platform.OS === 'ios' 
        ? `${RNFS.DocumentDirectoryPath}/pdf_backup`
        : `${RNFS.ExternalDirectoryPath}/FieldSync/PDF_Backup`;
      
      const finalBackupPath = backupPath || defaultBackupPath;

      // Create backup directory
      const backupExists = await RNFS.exists(finalBackupPath);
      if (!backupExists) {
        await RNFS.mkdir(finalBackupPath);
      }

      // Copy all PDFs to backup location
      const files = await RNFS.readDir(this.pdfDirectory);
      const pdfFiles = files.filter(file => file.name.endsWith('.pdf') || file.name === 'metadata.json');

      for (const file of pdfFiles) {
        const sourcePath = file.path;
        const destinationPath = `${finalBackupPath}/${file.name}`;
        await RNFS.copyFile(sourcePath, destinationPath);
      }

      return true;
    } catch (error) {
      console.error('Error backing up PDFs:', error);
      return false;
    }
  }

  /**
   * Export PDF list with metadata
   */
  async exportPDFList(): Promise<string> {
    try {
      const metadata = await this.loadPDFMetadata();
      const storageStats = await this.getStorageStats();
      
      const exportData = {
        exportDate: new Date().toISOString(),
        storageStats,
        pdfs: metadata.map(pdf => ({
          fileName: pdf.fileName,
          type: pdf.type,
          formType: pdf.formType,
          employeeId: pdf.employeeId,
          fileSize: this.formatFileSize(pdf.fileSize),
          createdDate: pdf.createdDate,
        }))
      };

      const exportPath = `${this.pdfDirectory}/pdf_export_${Date.now()}.json`;
      await RNFS.writeFile(exportPath, JSON.stringify(exportData, null, 2), 'utf8');
      
      return exportPath;
    } catch (error) {
      console.error('Error exporting PDF list:', error);
      throw error;
    }
  }
}

export default PDFUtils.getInstance();

// Helper functions for specific use cases
export const createPDFMetadata = (
  fileName: string,
  filePath: string,
  fileSize: number,
  type: 'biodata' | 'complete' | 'individual',
  employeeId: string,
  formType?: string
): PDFMetadata => ({
  fileName,
  filePath,
  fileSize,
  createdDate: new Date(),
  type,
  formType,
  employeeId,
});

export const isPDFValid = async (filePath: string): Promise<boolean> => {
  return await PDFUtils.getInstance().validatePDFFile(filePath);
};

export const getHumanReadableFileSize = (bytes: number): string => {
  return PDFUtils.getInstance().formatFileSize(bytes);
};