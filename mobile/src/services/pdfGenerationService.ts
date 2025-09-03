import { Buffer } from 'buffer';
import RNHTMLtoPDF from 'react-native-html-to-pdf';
import RNFS from 'react-native-fs';
import { Platform } from 'react-native';

// Types for PDF generation
export interface EmployeeOnboardingData {
  basicDetails: {
    tempId: string;
    firstName: string;
    lastName: string;
    fatherName: string;
    dateOfBirth: string;
    gender: string;
    maritalStatus: string;
    bloodGroup: string;
    nationality: string;
    religion: string;
    category: string;
    phoneNumber: string;
    alternatePhoneNumber?: string;
    email: string;
    alternateEmail?: string;
    currentAddress: string;
    permanentAddress: string;
    pincode: string;
    district: string;
    state: string;
    country: string;
  };
  documents: {
    aadhaarNumber: string;
    panNumber: string;
    passportNumber?: string;
    drivingLicenseNumber?: string;
    voterIdNumber?: string;
    documents: Array<{
      type: string;
      number: string;
      issuedDate: string;
      expiryDate?: string;
      issuedBy: string;
      status: string;
    }>;
  };
  emergencyContacts: Array<{
    name: string;
    relationship: string;
    phoneNumber: string;
    alternatePhone?: string;
    address: string;
    isPrimary: boolean;
  }>;
  bankDetails: {
    accountHolderName: string;
    accountNumber: string;
    bankName: string;
    branchName: string;
    ifscCode: string;
    accountType: string;
    bankAddress: string;
  };
  salaryDetails: {
    designation: string;
    department: string;
    joiningDate: string;
    basicSalary: number;
    hra: number;
    conveyanceAllowance: number;
    medicalAllowance: number;
    otherAllowances: number;
    grossSalary: number;
    pfDeduction: number;
    esiDeduction: number;
    tds: number;
    otherDeductions: number;
    netSalary: number;
  };
  education: Array<{
    level: string;
    institution: string;
    degree: string;
    specialization?: string;
    yearOfPassing: string;
    percentage: number;
    grade?: string;
    boardUniversity: string;
  }>;
  workExperience: Array<{
    companyName: string;
    designation: string;
    joiningDate: string;
    relievingDate?: string;
    salary: number;
    reasonForLeaving?: string;
    responsibilities: string;
    reportingManager: string;
    hrContact: string;
  }>;
  uniform: {
    category: string;
    items: {
      shirt: { size: string; quantity: number; customMeasurements?: any };
      pant: { size: string; quantity: number; customMeasurements?: any };
      shoes: { size: string; quantity: number };
      additionalItems: Array<{ item: string; size: string; quantity: number }>;
    };
    totalCost: number;
    status: string;
  };
}

export interface PDFGenerationOptions {
  fileName: string;
  orientation?: 'portrait' | 'landscape';
  paperSize?: 'A4' | 'Letter';
  includeSections?: string[];
  watermark?: string;
  logoUrl?: string;
}

class PDFGenerationService {
  private readonly defaultOptions: PDFGenerationOptions = {
    fileName: 'employee_onboarding',
    orientation: 'portrait',
    paperSize: 'A4',
    includeSections: ['all'],
  };

  /**
   * Generate comprehensive employee bio-data PDF
   */
  async generateBioDataPDF(
    employeeData: EmployeeOnboardingData,
    options: Partial<PDFGenerationOptions> = {}
  ): Promise<string> {
    const finalOptions = { ...this.defaultOptions, ...options };
    const htmlContent = this.generateBioDataHTML(employeeData, finalOptions);
    
    return await this.generatePDF(htmlContent, {
      ...finalOptions,
      fileName: `${employeeData.basicDetails.tempId}_biodata`,
    });
  }

  /**
   * Generate individual form PDFs
   */
  async generateFormPDF(
    formType: 'basic' | 'documents' | 'emergency' | 'bank' | 'salary' | 'education' | 'experience' | 'uniform',
    formData: any,
    tempId: string,
    options: Partial<PDFGenerationOptions> = {}
  ): Promise<string> {
    const finalOptions = { ...this.defaultOptions, ...options };
    let htmlContent = '';

    switch (formType) {
      case 'basic':
        htmlContent = this.generateBasicDetailsHTML(formData, finalOptions);
        break;
      case 'documents':
        htmlContent = this.generateDocumentsHTML(formData, finalOptions);
        break;
      case 'emergency':
        htmlContent = this.generateEmergencyContactsHTML(formData, finalOptions);
        break;
      case 'bank':
        htmlContent = this.generateBankDetailsHTML(formData, finalOptions);
        break;
      case 'salary':
        htmlContent = this.generateSalaryDetailsHTML(formData, finalOptions);
        break;
      case 'education':
        htmlContent = this.generateEducationHTML(formData, finalOptions);
        break;
      case 'experience':
        htmlContent = this.generateExperienceHTML(formData, finalOptions);
        break;
      case 'uniform':
        htmlContent = this.generateUniformHTML(formData, finalOptions);
        break;
      default:
        throw new Error(`Unsupported form type: ${formType}`);
    }

    return await this.generatePDF(htmlContent, {
      ...finalOptions,
      fileName: `${tempId}_${formType}`,
    });
  }

  /**
   * Generate complete onboarding package PDF
   */
  async generateCompletePackagePDF(
    employeeData: EmployeeOnboardingData,
    options: Partial<PDFGenerationOptions> = {}
  ): Promise<string> {
    const finalOptions = { ...this.defaultOptions, ...options };
    const htmlContent = this.generateCompletePackageHTML(employeeData, finalOptions);
    
    return await this.generatePDF(htmlContent, {
      ...finalOptions,
      fileName: `${employeeData.basicDetails.tempId}_complete_package`,
    });
  }

  /**
   * Core PDF generation method
   */
  private async generatePDF(htmlContent: string, options: PDFGenerationOptions): Promise<string> {
    try {
      const pdfOptions = {
        html: htmlContent,
        fileName: options.fileName,
        directory: Platform.OS === 'ios' ? RNFS.DocumentDirectoryPath : RNFS.ExternalDirectoryPath,
        base64: false,
        width: options.paperSize === 'A4' ? 595 : 612,
        height: options.paperSize === 'A4' ? 842 : 792,
      };

      const pdf = await RNHTMLtoPDF.convert(pdfOptions);
      return pdf.filePath || '';
    } catch (error) {
      console.error('PDF Generation Error:', error);
      throw new Error(`Failed to generate PDF: ${error.message}`);
    }
  }

  /**
   * Generate bio-data HTML content
   */
  private generateBioDataHTML(data: EmployeeOnboardingData, options: PDFGenerationOptions): string {
    return `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <title>Employee Bio-Data - ${data.basicDetails.firstName} ${data.basicDetails.lastName}</title>
        <style>
            ${this.getCommonStyles()}
            .bio-header {
                text-align: center;
                margin-bottom: 30px;
                border-bottom: 3px solid #007bff;
                padding-bottom: 20px;
            }
            .employee-photo {
                width: 120px;
                height: 150px;
                border: 2px solid #ddd;
                margin: 0 auto 15px;
                display: block;
                background: #f8f9fa;
                text-align: center;
                line-height: 150px;
                color: #6c757d;
            }
            .section-grid {
                display: grid;
                grid-template-columns: 1fr 1fr;
                gap: 30px;
                margin-bottom: 25px;
            }
        </style>
    </head>
    <body>
        ${options.watermark ? `<div class="watermark">${options.watermark}</div>` : ''}
        
        <div class="bio-header">
            ${options.logoUrl ? `<img src="${options.logoUrl}" alt="Company Logo" style="height: 60px; margin-bottom: 15px;">` : ''}
            <h1>EMPLOYEE BIO-DATA</h1>
            <div class="employee-photo">Photo</div>
            <h2>${data.basicDetails.firstName} ${data.basicDetails.lastName}</h2>
            <p><strong>Employee ID:</strong> ${data.basicDetails.tempId}</p>
        </div>

        <div class="section-grid">
            <div>
                ${this.generateBasicDetailsSectionHTML(data.basicDetails)}
                ${this.generateBankDetailsSectionHTML(data.bankDetails)}
                ${this.generateEducationSectionHTML(data.education)}
            </div>
            <div>
                ${this.generateDocumentsSectionHTML(data.documents)}
                ${this.generateEmergencyContactsSectionHTML(data.emergencyContacts)}
                ${this.generateExperienceSectionHTML(data.workExperience)}
            </div>
        </div>

        ${this.generateSalaryDetailsSectionHTML(data.salaryDetails)}
        ${this.generateUniformSectionHTML(data.uniform)}

        <div class="footer">
            <p>Generated on: ${new Date().toLocaleDateString()}</p>
            <p>This document is system generated and does not require signature.</p>
        </div>
    </body>
    </html>`;
  }

  /**
   * Generate basic details HTML
   */
  private generateBasicDetailsHTML(data: any, options: PDFGenerationOptions): string {
    return `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <title>Basic Details Form</title>
        <style>${this.getCommonStyles()}</style>
    </head>
    <body>
        <h1>Employee Basic Details</h1>
        ${this.generateBasicDetailsSectionHTML(data)}
        <div class="footer">
            <p>Generated on: ${new Date().toLocaleDateString()}</p>
        </div>
    </body>
    </html>`;
  }

  /**
   * Generate complete package HTML
   */
  private generateCompletePackageHTML(data: EmployeeOnboardingData, options: PDFGenerationOptions): string {
    return `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <title>Complete Onboarding Package - ${data.basicDetails.firstName} ${data.basicDetails.lastName}</title>
        <style>
            ${this.getCommonStyles()}
            .cover-page {
                text-align: center;
                padding: 100px 0;
                border-bottom: 3px solid #007bff;
                margin-bottom: 40px;
            }
            .table-of-contents {
                margin-bottom: 40px;
                page-break-after: always;
            }
            .toc-item {
                display: flex;
                justify-content: space-between;
                padding: 8px 0;
                border-bottom: 1px dotted #ccc;
            }
        </style>
    </head>
    <body>
        <!-- Cover Page -->
        <div class="cover-page">
            ${options.logoUrl ? `<img src="${options.logoUrl}" alt="Company Logo" style="height: 80px; margin-bottom: 20px;">` : ''}
            <h1>EMPLOYEE ONBOARDING PACKAGE</h1>
            <h2>${data.basicDetails.firstName} ${data.basicDetails.lastName}</h2>
            <p><strong>Employee ID:</strong> ${data.basicDetails.tempId}</p>
            <p><strong>Department:</strong> ${data.salaryDetails.department}</p>
            <p><strong>Designation:</strong> ${data.salaryDetails.designation}</p>
            <p><strong>Joining Date:</strong> ${data.salaryDetails.joiningDate}</p>
            <div style="margin-top: 50px;">
                <p><strong>Generated on:</strong> ${new Date().toLocaleDateString()}</p>
            </div>
        </div>

        <!-- Table of Contents -->
        <div class="table-of-contents">
            <h2>Table of Contents</h2>
            <div class="toc-item"><span>1. Basic Details</span><span>Page 3</span></div>
            <div class="toc-item"><span>2. Document Information</span><span>Page 4</span></div>
            <div class="toc-item"><span>3. Emergency Contacts</span><span>Page 5</span></div>
            <div class="toc-item"><span>4. Bank Details</span><span>Page 6</span></div>
            <div class="toc-item"><span>5. Salary Information</span><span>Page 7</span></div>
            <div class="toc-item"><span>6. Educational Qualifications</span><span>Page 8</span></div>
            <div class="toc-item"><span>7. Work Experience</span><span>Page 9</span></div>
            <div class="toc-item"><span>8. Uniform Details</span><span>Page 10</span></div>
        </div>

        <!-- All Sections -->
        <div style="page-break-before: always;">
            <h1>1. Basic Details</h1>
            ${this.generateBasicDetailsSectionHTML(data.basicDetails)}
        </div>

        <div style="page-break-before: always;">
            <h1>2. Document Information</h1>
            ${this.generateDocumentsSectionHTML(data.documents)}
        </div>

        <div style="page-break-before: always;">
            <h1>3. Emergency Contacts</h1>
            ${this.generateEmergencyContactsSectionHTML(data.emergencyContacts)}
        </div>

        <div style="page-break-before: always;">
            <h1>4. Bank Details</h1>
            ${this.generateBankDetailsSectionHTML(data.bankDetails)}
        </div>

        <div style="page-break-before: always;">
            <h1>5. Salary Information</h1>
            ${this.generateSalaryDetailsSectionHTML(data.salaryDetails)}
        </div>

        <div style="page-break-before: always;">
            <h1>6. Educational Qualifications</h1>
            ${this.generateEducationSectionHTML(data.education)}
        </div>

        <div style="page-break-before: always;">
            <h1>7. Work Experience</h1>
            ${this.generateExperienceSectionHTML(data.workExperience)}
        </div>

        <div style="page-break-before: always;">
            <h1>8. Uniform Details</h1>
            ${this.generateUniformSectionHTML(data.uniform)}
        </div>

        <div class="footer">
            <p>This document is system generated and confidential.</p>
            <p>Generated on: ${new Date().toLocaleDateString()} | Total Pages: 10</p>
        </div>
    </body>
    </html>`;
  }

  // Section HTML generators
  private generateBasicDetailsSectionHTML(data: any): string {
    return `
    <div class="section">
        <h3>Personal Information</h3>
        <div class="info-grid">
            <div class="info-item">
                <label>First Name:</label>
                <span>${data.firstName || 'N/A'}</span>
            </div>
            <div class="info-item">
                <label>Last Name:</label>
                <span>${data.lastName || 'N/A'}</span>
            </div>
            <div class="info-item">
                <label>Father's Name:</label>
                <span>${data.fatherName || 'N/A'}</span>
            </div>
            <div class="info-item">
                <label>Date of Birth:</label>
                <span>${data.dateOfBirth || 'N/A'}</span>
            </div>
            <div class="info-item">
                <label>Gender:</label>
                <span>${data.gender || 'N/A'}</span>
            </div>
            <div class="info-item">
                <label>Blood Group:</label>
                <span>${data.bloodGroup || 'N/A'}</span>
            </div>
            <div class="info-item">
                <label>Phone Number:</label>
                <span>${data.phoneNumber || 'N/A'}</span>
            </div>
            <div class="info-item">
                <label>Email:</label>
                <span>${data.email || 'N/A'}</span>
            </div>
        </div>
        <div class="address-section">
            <h4>Address Information</h4>
            <p><strong>Current Address:</strong> ${data.currentAddress || 'N/A'}</p>
            <p><strong>Permanent Address:</strong> ${data.permanentAddress || 'N/A'}</p>
            <p><strong>Pincode:</strong> ${data.pincode || 'N/A'} | <strong>District:</strong> ${data.district || 'N/A'} | <strong>State:</strong> ${data.state || 'N/A'}</p>
        </div>
    </div>`;
  }

  private generateDocumentsSectionHTML(data: any): string {
    const documentsHTML = data.documents?.map((doc: any) => `
      <tr>
        <td>${doc.type}</td>
        <td>${doc.number}</td>
        <td>${doc.issuedDate}</td>
        <td>${doc.expiryDate || 'N/A'}</td>
        <td>${doc.status}</td>
      </tr>
    `).join('') || '<tr><td colspan="5">No documents available</td></tr>';

    return `
    <div class="section">
        <h3>Document Information</h3>
        <div class="info-grid">
            <div class="info-item">
                <label>Aadhaar Number:</label>
                <span>${data.aadhaarNumber || 'N/A'}</span>
            </div>
            <div class="info-item">
                <label>PAN Number:</label>
                <span>${data.panNumber || 'N/A'}</span>
            </div>
        </div>
        <table class="details-table">
            <thead>
                <tr>
                    <th>Document Type</th>
                    <th>Number</th>
                    <th>Issued Date</th>
                    <th>Expiry Date</th>
                    <th>Status</th>
                </tr>
            </thead>
            <tbody>
                ${documentsHTML}
            </tbody>
        </table>
    </div>`;
  }

  private generateEmergencyContactsSectionHTML(data: any[]): string {
    const contactsHTML = data?.map((contact, index) => `
      <div class="contact-card">
        <h4>Contact ${index + 1} ${contact.isPrimary ? '(Primary)' : ''}</h4>
        <div class="info-grid">
            <div class="info-item">
                <label>Name:</label>
                <span>${contact.name}</span>
            </div>
            <div class="info-item">
                <label>Relationship:</label>
                <span>${contact.relationship}</span>
            </div>
            <div class="info-item">
                <label>Phone:</label>
                <span>${contact.phoneNumber}</span>
            </div>
            <div class="info-item">
                <label>Address:</label>
                <span>${contact.address}</span>
            </div>
        </div>
      </div>
    `).join('') || '<p>No emergency contacts available</p>';

    return `
    <div class="section">
        <h3>Emergency Contacts</h3>
        ${contactsHTML}
    </div>`;
  }

  private generateBankDetailsSectionHTML(data: any): string {
    return `
    <div class="section">
        <h3>Bank Account Details</h3>
        <div class="info-grid">
            <div class="info-item">
                <label>Account Holder Name:</label>
                <span>${data.accountHolderName || 'N/A'}</span>
            </div>
            <div class="info-item">
                <label>Account Number:</label>
                <span>${data.accountNumber || 'N/A'}</span>
            </div>
            <div class="info-item">
                <label>Bank Name:</label>
                <span>${data.bankName || 'N/A'}</span>
            </div>
            <div class="info-item">
                <label>Branch Name:</label>
                <span>${data.branchName || 'N/A'}</span>
            </div>
            <div class="info-item">
                <label>IFSC Code:</label>
                <span>${data.ifscCode || 'N/A'}</span>
            </div>
            <div class="info-item">
                <label>Account Type:</label>
                <span>${data.accountType || 'N/A'}</span>
            </div>
        </div>
        <p><strong>Bank Address:</strong> ${data.bankAddress || 'N/A'}</p>
    </div>`;
  }

  private generateSalaryDetailsSectionHTML(data: any): string {
    return `
    <div class="section">
        <h3>Salary & Compensation Details</h3>
        <div class="info-grid">
            <div class="info-item">
                <label>Designation:</label>
                <span>${data.designation || 'N/A'}</span>
            </div>
            <div class="info-item">
                <label>Department:</label>
                <span>${data.department || 'N/A'}</span>
            </div>
            <div class="info-item">
                <label>Joining Date:</label>
                <span>${data.joiningDate || 'N/A'}</span>
            </div>
            <div class="info-item">
                <label>Basic Salary:</label>
                <span>₹${data.basicSalary?.toLocaleString() || 'N/A'}</span>
            </div>
        </div>
        <div class="salary-breakdown">
            <h4>Salary Breakdown</h4>
            <table class="details-table">
                <tbody>
                    <tr><td>Basic Salary</td><td>₹${data.basicSalary?.toLocaleString() || '0'}</td></tr>
                    <tr><td>HRA</td><td>₹${data.hra?.toLocaleString() || '0'}</td></tr>
                    <tr><td>Conveyance Allowance</td><td>₹${data.conveyanceAllowance?.toLocaleString() || '0'}</td></tr>
                    <tr><td>Medical Allowance</td><td>₹${data.medicalAllowance?.toLocaleString() || '0'}</td></tr>
                    <tr><td>Other Allowances</td><td>₹${data.otherAllowances?.toLocaleString() || '0'}</td></tr>
                    <tr class="total-row"><td><strong>Gross Salary</strong></td><td><strong>₹${data.grossSalary?.toLocaleString() || '0'}</strong></td></tr>
                    <tr><td>PF Deduction</td><td>-₹${data.pfDeduction?.toLocaleString() || '0'}</td></tr>
                    <tr><td>ESI Deduction</td><td>-₹${data.esiDeduction?.toLocaleString() || '0'}</td></tr>
                    <tr><td>TDS</td><td>-₹${data.tds?.toLocaleString() || '0'}</td></tr>
                    <tr><td>Other Deductions</td><td>-₹${data.otherDeductions?.toLocaleString() || '0'}</td></tr>
                    <tr class="total-row"><td><strong>Net Salary</strong></td><td><strong>₹${data.netSalary?.toLocaleString() || '0'}</strong></td></tr>
                </tbody>
            </table>
        </div>
    </div>`;
  }

  private generateEducationSectionHTML(data: any[]): string {
    const educationHTML = data?.map((edu, index) => `
      <div class="education-card">
        <h4>${edu.level} - ${edu.institution}</h4>
        <div class="info-grid">
            <div class="info-item">
                <label>Degree:</label>
                <span>${edu.degree}</span>
            </div>
            <div class="info-item">
                <label>Year of Passing:</label>
                <span>${edu.yearOfPassing}</span>
            </div>
            <div class="info-item">
                <label>Percentage:</label>
                <span>${edu.percentage}%</span>
            </div>
            <div class="info-item">
                <label>Board/University:</label>
                <span>${edu.boardUniversity}</span>
            </div>
        </div>
      </div>
    `).join('') || '<p>No educational qualifications available</p>';

    return `
    <div class="section">
        <h3>Educational Qualifications</h3>
        ${educationHTML}
    </div>`;
  }

  private generateExperienceSectionHTML(data: any[]): string {
    const experienceHTML = data?.map((exp, index) => `
      <div class="experience-card">
        <h4>${exp.designation} - ${exp.companyName}</h4>
        <div class="info-grid">
            <div class="info-item">
                <label>Duration:</label>
                <span>${exp.joiningDate} to ${exp.relievingDate || 'Present'}</span>
            </div>
            <div class="info-item">
                <label>Salary:</label>
                <span>₹${exp.salary?.toLocaleString() || 'N/A'}</span>
            </div>
            <div class="info-item">
                <label>Reporting Manager:</label>
                <span>${exp.reportingManager}</span>
            </div>
            <div class="info-item">
                <label>Responsibilities:</label>
                <span>${exp.responsibilities}</span>
            </div>
        </div>
      </div>
    `).join('') || '<p>No work experience available</p>';

    return `
    <div class="section">
        <h3>Work Experience</h3>
        ${experienceHTML}
    </div>`;
  }

  private generateUniformSectionHTML(data: any): string {
    const additionalItemsHTML = data.items?.additionalItems?.map((item: any) => `
      <tr>
        <td>${item.item}</td>
        <td>${item.size}</td>
        <td>${item.quantity}</td>
      </tr>
    `).join('') || '';

    return `
    <div class="section">
        <h3>Uniform Allocation</h3>
        <div class="info-grid">
            <div class="info-item">
                <label>Category:</label>
                <span>${data.category}</span>
            </div>
            <div class="info-item">
                <label>Total Cost:</label>
                <span>₹${data.totalCost?.toLocaleString() || 'N/A'}</span>
            </div>
            <div class="info-item">
                <label>Status:</label>
                <span>${data.status}</span>
            </div>
        </div>
        <table class="details-table">
            <thead>
                <tr>
                    <th>Item</th>
                    <th>Size</th>
                    <th>Quantity</th>
                </tr>
            </thead>
            <tbody>
                <tr><td>Shirt</td><td>${data.items?.shirt?.size || 'N/A'}</td><td>${data.items?.shirt?.quantity || 0}</td></tr>
                <tr><td>Pant</td><td>${data.items?.pant?.size || 'N/A'}</td><td>${data.items?.pant?.quantity || 0}</td></tr>
                <tr><td>Shoes</td><td>${data.items?.shoes?.size || 'N/A'}</td><td>${data.items?.shoes?.quantity || 0}</td></tr>
                ${additionalItemsHTML}
            </tbody>
        </table>
    </div>`;
  }

  /**
   * Common CSS styles for all PDFs
   */
  private getCommonStyles(): string {
    return `
    body {
        font-family: 'Arial', sans-serif;
        font-size: 12px;
        line-height: 1.5;
        margin: 20px;
        color: #333;
        background: white;
    }
    h1 {
        color: #007bff;
        font-size: 24px;
        margin-bottom: 20px;
        text-align: center;
    }
    h2 {
        color: #495057;
        font-size: 18px;
        margin-bottom: 15px;
        border-bottom: 2px solid #e9ecef;
        padding-bottom: 5px;
    }
    h3 {
        color: #007bff;
        font-size: 16px;
        margin-bottom: 15px;
        background: #f8f9fa;
        padding: 10px;
        border-left: 4px solid #007bff;
    }
    h4 {
        color: #495057;
        font-size: 14px;
        margin-bottom: 10px;
    }
    .section {
        margin-bottom: 30px;
        padding: 15px;
        border: 1px solid #e9ecef;
        border-radius: 5px;
        background: #fdfdfe;
    }
    .info-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 15px;
        margin-bottom: 15px;
    }
    .info-item {
        display: flex;
        align-items: center;
        padding: 8px;
        border: 1px solid #e9ecef;
        border-radius: 3px;
        background: white;
    }
    .info-item label {
        font-weight: bold;
        color: #495057;
        margin-right: 10px;
        min-width: 120px;
    }
    .info-item span {
        color: #333;
        flex: 1;
    }
    .details-table {
        width: 100%;
        border-collapse: collapse;
        margin-top: 15px;
        border: 1px solid #dee2e6;
    }
    .details-table th,
    .details-table td {
        border: 1px solid #dee2e6;
        padding: 12px;
        text-align: left;
    }
    .details-table th {
        background-color: #f8f9fa;
        font-weight: bold;
        color: #495057;
    }
    .details-table tbody tr:nth-child(even) {
        background-color: #f8f9fa;
    }
    .total-row {
        background-color: #e9ecef !important;
    }
    .contact-card,
    .education-card,
    .experience-card {
        margin-bottom: 20px;
        padding: 15px;
        border: 1px solid #dee2e6;
        border-radius: 5px;
        background: white;
    }
    .address-section {
        margin-top: 15px;
        padding-top: 15px;
        border-top: 1px solid #e9ecef;
    }
    .salary-breakdown {
        margin-top: 20px;
    }
    .watermark {
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%) rotate(-45deg);
        font-size: 72px;
        color: rgba(0, 123, 255, 0.1);
        z-index: -1;
        font-weight: bold;
    }
    .footer {
        margin-top: 40px;
        padding-top: 20px;
        border-top: 2px solid #007bff;
        text-align: center;
        font-size: 11px;
        color: #6c757d;
    }
    @media print {
        body { margin: 0; }
        .section { page-break-inside: avoid; }
    }`;
  }

  // Additional utility methods
  generateDocumentsHTML(data: any, options: PDFGenerationOptions): string {
    return `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <title>Document Information</title>
        <style>${this.getCommonStyles()}</style>
    </head>
    <body>
        <h1>Document Information</h1>
        ${this.generateDocumentsSectionHTML(data)}
        <div class="footer">
            <p>Generated on: ${new Date().toLocaleDateString()}</p>
        </div>
    </body>
    </html>`;
  }

  generateEmergencyContactsHTML(data: any[], options: PDFGenerationOptions): string {
    return `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <title>Emergency Contacts</title>
        <style>${this.getCommonStyles()}</style>
    </head>
    <body>
        <h1>Emergency Contacts</h1>
        ${this.generateEmergencyContactsSectionHTML(data)}
        <div class="footer">
            <p>Generated on: ${new Date().toLocaleDateString()}</p>
        </div>
    </body>
    </html>`;
  }

  generateBankDetailsHTML(data: any, options: PDFGenerationOptions): string {
    return `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <title>Bank Account Details</title>
        <style>${this.getCommonStyles()}</style>
    </head>
    <body>
        <h1>Bank Account Details</h1>
        ${this.generateBankDetailsSectionHTML(data)}
        <div class="footer">
            <p>Generated on: ${new Date().toLocaleDateString()}</p>
        </div>
    </body>
    </html>`;
  }

  generateSalaryDetailsHTML(data: any, options: PDFGenerationOptions): string {
    return `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <title>Salary Details</title>
        <style>${this.getCommonStyles()}</style>
    </head>
    <body>
        <h1>Salary & Compensation Details</h1>
        ${this.generateSalaryDetailsSectionHTML(data)}
        <div class="footer">
            <p>Generated on: ${new Date().toLocaleDateString()}</p>
        </div>
    </body>
    </html>`;
  }

  generateEducationHTML(data: any[], options: PDFGenerationOptions): string {
    return `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <title>Educational Qualifications</title>
        <style>${this.getCommonStyles()}</style>
    </head>
    <body>
        <h1>Educational Qualifications</h1>
        ${this.generateEducationSectionHTML(data)}
        <div class="footer">
            <p>Generated on: ${new Date().toLocaleDateString()}</p>
        </div>
    </body>
    </html>`;
  }

  generateExperienceHTML(data: any[], options: PDFGenerationOptions): string {
    return `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <title>Work Experience</title>
        <style>${this.getCommonStyles()}</style>
    </head>
    <body>
        <h1>Work Experience</h1>
        ${this.generateExperienceSectionHTML(data)}
        <div class="footer">
            <p>Generated on: ${new Date().toLocaleDateString()}</p>
        </div>
    </body>
    </html>`;
  }

  generateUniformHTML(data: any, options: PDFGenerationOptions): string {
    return `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <title>Uniform Allocation Details</title>
        <style>${this.getCommonStyles()}</style>
    </head>
    <body>
        <h1>Uniform Allocation Details</h1>
        ${this.generateUniformSectionHTML(data)}
        <div class="footer">
            <p>Generated on: ${new Date().toLocaleDateString()}</p>
        </div>
    </body>
    </html>`;
  }
}

export default new PDFGenerationService();