# PDF Generation Module - Integration Guide

## Overview

The PDF Generation module provides comprehensive functionality to generate professional PDF documents for employee onboarding data. This includes bio-data, individual forms, and complete onboarding packages.

## Features

### 1. PDF Types
- **Bio-Data PDF**: Complete employee profile with personal and professional information
- **Complete Package**: Comprehensive document with all forms, table of contents, and professional formatting
- **Individual Forms**: Specific form PDFs (basic details, documents, emergency contacts, etc.)

### 2. Professional Formatting
- Responsive HTML templates with CSS styling
- Company branding support (logo, watermarks)
- Grid layouts and organized sections
- Print-optimized styling

### 3. File Management
- Automatic directory creation and permission handling
- Metadata tracking and storage statistics
- File validation and backup capabilities
- Cleanup utilities for old files

## Architecture

### Core Components

1. **PDFGenerationService** (`services/pdfGenerationService.ts`)
   - Main service for generating PDFs using react-native-html-to-pdf
   - Handles HTML template generation and PDF conversion
   - Supports all form types and comprehensive packages

2. **PDFGenerationScreen** (`screens/onboarding/screens/PDFGenerationScreen.tsx`)
   - React Native screen component for PDF generation UI
   - Modal-based selection and generation workflow
   - Statistics display and file sharing capabilities

3. **PDFUtils** (`utils/pdfUtils.ts`)
   - Utility functions for file management and metadata handling
   - Permission management for Android/iOS
   - Storage statistics and cleanup operations

### Data Flow

```
Employee Data (AsyncStorage) 
    ↓
PDFGenerationScreen (UI)
    ↓
PDFGenerationService (HTML → PDF)
    ↓
PDFUtils (File Management)
    ↓
Generated PDF Files (Device Storage)
```

## Installation & Setup

### 1. Install Dependencies

```bash
cd mobile
npm install react-native-html-to-pdf react-native-fs buffer
```

### 2. iOS Setup

Add to `ios/Podfile`:
```ruby
pod 'RNFS', :path => '../node_modules/react-native-fs'
```

Run:
```bash
cd ios && pod install
```

### 3. Android Setup

Add to `android/app/src/main/AndroidManifest.xml`:
```xml
<uses-permission android:name="android.permission.WRITE_EXTERNAL_STORAGE" />
<uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE" />
```

### 4. Metro Configuration

Update `metro.config.js`:
```javascript
module.exports = {
  resolver: {
    alias: {
      buffer: require.resolve('buffer'),
    },
  },
};
```

## Usage

### 1. Basic Integration

```typescript
import PDFGenerationService from '../services/pdfGenerationService';
import { EmployeeOnboardingData } from '../services/pdfGenerationService';

// Generate bio-data PDF
const generateBioData = async (employeeData: EmployeeOnboardingData) => {
  try {
    const pdfPath = await PDFGenerationService.generateBioDataPDF(employeeData, {
      fileName: 'employee_biodata',
      watermark: 'Company Name',
      logoUrl: 'path/to/logo.png',
    });
    console.log('PDF generated at:', pdfPath);
  } catch (error) {
    console.error('PDF generation failed:', error);
  }
};
```

### 2. Screen Integration

```typescript
import PDFGenerationScreen from './screens/onboarding/screens/PDFGenerationScreen';

// In your navigation stack
<Stack.Screen
  name="PDFGeneration"
  component={PDFGenerationScreen}
  options={{
    title: 'Generate Documents',
    headerStyle: { backgroundColor: '#007bff' },
    headerTintColor: 'white',
  }}
/>
```

### 3. Utility Functions

```typescript
import PDFUtils, { createPDFMetadata } from '../utils/pdfUtils';

// Initialize PDF directory
await PDFUtils.initializePDFDirectory();

// Get storage statistics
const stats = await PDFUtils.getStorageStats();
console.log(`Total PDFs: ${stats.totalFiles}, Size: ${stats.formattedSize}`);

// Cleanup old files
const deletedCount = await PDFUtils.cleanupOldPDFs(30); // 30 days
console.log(`Deleted ${deletedCount} old PDF files`);
```

## Data Structure

### Employee Onboarding Data Interface

```typescript
interface EmployeeOnboardingData {
  basicDetails: {
    tempId: string;
    firstName: string;
    lastName: string;
    // ... other basic fields
  };
  documents: {
    aadhaarNumber: string;
    panNumber: string;
    documents: Array<{
      type: string;
      number: string;
      status: string;
      // ... other document fields
    }>;
  };
  emergencyContacts: Array<{
    name: string;
    relationship: string;
    phoneNumber: string;
    // ... other contact fields
  }>;
  // ... other sections
}
```

### PDF Generation Options

```typescript
interface PDFGenerationOptions {
  fileName: string;
  orientation?: 'portrait' | 'landscape';
  paperSize?: 'A4' | 'Letter';
  includeSections?: string[];
  watermark?: string;
  logoUrl?: string;
}
```

## Customization

### 1. HTML Templates

Templates are generated dynamically in `PDFGenerationService`. To customize:

```typescript
// Override section HTML generation
private generateCustomSectionHTML(data: any): string {
  return `
    <div class="custom-section">
      <h3>Custom Section</h3>
      <!-- Your custom HTML -->
    </div>
  `;
}
```

### 2. CSS Styling

Modify the `getCommonStyles()` method in `PDFGenerationService`:

```typescript
private getCommonStyles(): string {
  return `
    /* Your custom CSS styles */
    .custom-section {
      background-color: #f0f0f0;
      padding: 20px;
      border-radius: 8px;
    }
  `;
}
```

### 3. Company Branding

Add logo and watermark support:

```typescript
const options = {
  logoUrl: 'https://company.com/logo.png',
  watermark: 'CONFIDENTIAL',
};
```

## File Structure

```
mobile/src/
├── services/
│   └── pdfGenerationService.ts     # Main PDF generation service
├── screens/onboarding/screens/
│   └── PDFGenerationScreen.tsx     # UI screen component
├── utils/
│   └── pdfUtils.ts                 # File management utilities
└── README_PDF_GENERATION.md       # This documentation
```

## Storage Structure

```
Device Storage/
└── FieldSync/
    └── PDFs/
        ├── TEMP001_biodata_2025-01-15.pdf
        ├── TEMP001_complete_2025-01-15.pdf
        ├── TEMP001_basic_2025-01-15.pdf
        └── metadata.json               # PDF metadata
```

## Error Handling

### Common Issues

1. **Storage Permission Denied**
   ```typescript
   // Handle permission errors
   const initialized = await PDFUtils.initializePDFDirectory();
   if (!initialized) {
     Alert.alert('Error', 'Storage permission required');
   }
   ```

2. **Invalid Employee Data**
   ```typescript
   // Validate data before generation
   if (!employeeData.basicDetails.tempId) {
     throw new Error('Employee ID is required');
   }
   ```

3. **PDF Generation Failed**
   ```typescript
   try {
     const pdfPath = await PDFGenerationService.generateBioDataPDF(data);
   } catch (error) {
     console.error('PDF Error:', error.message);
     Alert.alert('Error', `PDF generation failed: ${error.message}`);
   }
   ```

## Performance Considerations

### Memory Management
- Large PDFs with many images may cause memory issues
- Use pagination for very long documents
- Clear AsyncStorage data after PDF generation if needed

### File Size Optimization
- Optimize images before including in PDFs
- Use compressed CSS and minimal HTML structure
- Implement file size limits

```typescript
const MAX_PDF_SIZE = 10 * 1024 * 1024; // 10MB limit

const fileSize = await PDFUtils.getPDFFileSize(pdfPath);
if (fileSize > MAX_PDF_SIZE) {
  Alert.alert('Warning', 'PDF file is very large');
}
```

## Testing

### Unit Tests
```typescript
// Example test
describe('PDFGenerationService', () => {
  test('should generate bio-data PDF', async () => {
    const mockData = { /* mock employee data */ };
    const pdfPath = await PDFGenerationService.generateBioDataPDF(mockData);
    expect(pdfPath).toBeTruthy();
    expect(await PDFUtils.validatePDFFile(pdfPath)).toBe(true);
  });
});
```

### Integration Tests
- Test PDF generation with real employee data
- Validate PDF file integrity
- Test sharing functionality
- Verify permission handling

## Deployment Notes

### Production Considerations
1. **File Storage**: Consider cloud storage for large-scale deployments
2. **Performance**: Monitor PDF generation performance on older devices
3. **Security**: Ensure sensitive data is handled securely in PDFs
4. **Compliance**: Follow data protection regulations for PDF content

### Monitoring
- Track PDF generation success/failure rates
- Monitor storage usage and cleanup
- Log performance metrics

## Troubleshooting

### Common Problems
1. **PDFs not generated**: Check storage permissions and available space
2. **Poor formatting**: Verify HTML template syntax and CSS styles
3. **Large file sizes**: Optimize images and reduce content complexity
4. **iOS/Android differences**: Test platform-specific behavior

### Debug Mode
Enable debug logging in development:
```typescript
const DEBUG_PDF = __DEV__;
if (DEBUG_PDF) {
  console.log('PDF generation started for:', employeeData.basicDetails.tempId);
}
```

## Future Enhancements

1. **Template Editor**: Visual template customization
2. **Batch Generation**: Generate multiple employee PDFs
3. **Cloud Integration**: Direct upload to cloud storage
4. **Digital Signatures**: Add signature support to PDFs
5. **Advanced Analytics**: PDF generation analytics and reporting

## Support

For issues or questions regarding the PDF Generation module:
1. Check this documentation first
2. Review error logs and console output
3. Test with minimal data to isolate issues
4. Verify all dependencies are installed correctly