/**
 * Verification Module Types
 * Comprehensive types for Employment, Background, and Police Verification
 */

// Common verification status enum
export enum VerificationStatus {
  PENDING = 'PENDING',
  IN_PROGRESS = 'IN_PROGRESS',
  VERIFIED = 'VERIFIED',
  REJECTED = 'REJECTED',
  REQUIRES_CLARIFICATION = 'REQUIRES_CLARIFICATION'
}

// Priority levels for verification tasks
export enum VerificationPriority {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  URGENT = 'URGENT'
}

// Base interfaces for common data structures
export interface ContactInfo {
  primaryPhone: string;
  secondaryPhone?: string;
  email: string;
  emergencyContact: {
    name: string;
    relationship: string;
    phone: string;
  };
}

export interface AddressInfo {
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state: string;
  pincode: string;
  country: string;
  landmark?: string;
  addressType: 'PERMANENT' | 'CURRENT' | 'OFFICE';
}

export interface Education {
  qualification: string;
  institution: string;
  university: string;
  yearOfPassing: number;
  percentage?: number;
  grade?: string;
  specialization?: string;
  documents: string[];
}

export interface Experience {
  company: string;
  designation: string;
  startDate: Date;
  endDate?: Date;
  isCurrentJob: boolean;
  ctc?: number;
  reasonForLeaving?: string;
  reportingManager?: {
    name: string;
    designation: string;
    contact: string;
  };
  hrContact?: {
    name: string;
    contact: string;
  };
  documents: string[];
}

export interface CompanyInfo {
  name: string;
  registrationNumber: string;
  address: AddressInfo;
  contactPerson: {
    name: string;
    designation: string;
    phone: string;
    email: string;
  };
}

export interface LanguageInfo {
  languagesKnownSpeak: string[];
  otherLanguagesSpeak?: string;
  languagesKnownWrite: string[];
  otherLanguagesWrite?: string;
  proficiency: {
    [language: string]: 'BASIC' | 'INTERMEDIATE' | 'FLUENT' | 'NATIVE';
  };
}

export interface BiometricData {
  leftThumbImpression: string; // Base64 image
  rightThumbImpression: string; // Base64 image
  capturedAt: Date;
  deviceInfo: string;
  quality: 'POOR' | 'FAIR' | 'GOOD' | 'EXCELLENT';
}

export interface DocumentVerification {
  documentType: string;
  documentNumber: string;
  issuedBy: string;
  issueDate?: Date;
  expiryDate?: Date;
  verificationStatus: 'PENDING' | 'VERIFIED' | 'INVALID';
  verifiedAt?: Date;
  verifierRemarks?: string;
}

// ===============================
// EMPLOYMENT VERIFICATION
// ===============================

export interface EmploymentVerificationData {
  id: string;
  employeeId: string;
  applicantDetails: {
    name: string;
    fatherName: string;
    dateOfBirth: Date;
    gender: 'MALE' | 'FEMALE' | 'OTHER';
    nationality: string;
    maritalStatus: 'SINGLE' | 'MARRIED' | 'DIVORCED' | 'WIDOWED';
    profilePhoto: string;
  };
  
  contactDetails: ContactInfo;
  
  educationDetails: Education[];
  
  experienceDetails: Experience[];
  
  companyDetails: CompanyInfo;
  
  verificationChecks: {
    personalDetailsVerified: boolean;
    educationVerified: boolean;
    experienceVerified: boolean;
    referencesVerified: boolean;
    backgroundCheckCompleted: boolean;
  };
  
  verifierDetails: {
    verifierId: string;
    verifierName: string;
    verificationDate: Date;
    methodOfVerification: 'PHONE' | 'EMAIL' | 'PHYSICAL_VISIT' | 'DIGITAL_VERIFICATION';
  };
  
  status: VerificationStatus;
  priority: VerificationPriority;
  remarks?: string;
  attachments: string[];
  
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
  updatedBy: string;
}

// ===============================
// BACKGROUND VERIFICATION
// ===============================

export interface AddressVerification {
  addressType: 'PERMANENT' | 'CURRENT';
  address: AddressInfo;
  ownerDetails: {
    name: string;
    relationship: string;
    contactNumber: string;
    ownershipProof: string; // Document
  };
  verificationMethod: 'PHYSICAL_VISIT' | 'TELEPHONIC' | 'DIGITAL';
  verificationDate: Date;
  verifierRemarks: string;
  isAddressValid: boolean;
  residenceDuration?: string;
  neighbors?: {
    name: string;
    contact?: string;
    feedback: string;
  }[];
}

export interface CriminalVerification {
  hasCriminalRecord: boolean;
  criminalRecords?: {
    caseNumber: string;
    courtName: string;
    caseType: string;
    caseStatus: 'PENDING' | 'RESOLVED' | 'ONGOING';
    description: string;
    documents: string[];
  }[];
  policeStationVerification: {
    stationName: string;
    officerName: string;
    officerRank: string;
    verificationDate: Date;
    clearanceCertificate?: string;
  };
}

export interface BackgroundVerificationData {
  id: string;
  employeeId: string;
  applicantDetails: {
    name: string;
    fatherName: string;
    dateOfBirth: Date;
    aadhaarNumber: string;
    panNumber: string;
    profilePhoto: string;
  };
  
  criminalVerification: CriminalVerification;
  
  languageDetails: LanguageInfo;
  
  biometricData: BiometricData;
  
  addressVerification: AddressVerification[];
  
  documentVerification: DocumentVerification[];
  
  characterReferences: {
    name: string;
    relationship: string;
    contactNumber: string;
    address: string;
    feedback?: string;
    verificationStatus: 'PENDING' | 'VERIFIED' | 'UNREACHABLE';
  }[];
  
  medicalFitness?: {
    medicalCertificate: string;
    issuedBy: string;
    issueDate: Date;
    validTill: Date;
    restrictions?: string;
  };
  
  verifierDetails: {
    verifierId: string;
    verifierName: string;
    agencyName?: string;
    verificationDate: Date;
  };
  
  status: VerificationStatus;
  priority: VerificationPriority;
  overallRiskRating: 'LOW' | 'MEDIUM' | 'HIGH';
  remarks?: string;
  
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
  updatedBy: string;
}

// ===============================
// POLICE VERIFICATION
// ===============================

export interface PoliceStationDetails {
  stationName: string;
  stationCode: string;
  address: AddressInfo;
  officerInCharge: {
    name: string;
    rank: string;
    badgeNumber: string;
    contactNumber: string;
  };
  jurisdiction: string[];
}

export interface ResidentInfo {
  name: string;
  age: number;
  gender: 'MALE' | 'FEMALE' | 'OTHER';
  relationship: string;
  occupation: string;
  aadhaarNumber?: string;
  contactNumber?: string;
}

export interface OwnerInfo {
  name: string;
  contactNumber: string;
  aadhaarNumber?: string;
  relationshipWithApplicant: string;
  ownershipType: 'OWNER' | 'TENANT' | 'FAMILY_MEMBER' | 'GUEST';
  ownershipProof: string; // Document reference
  residenceDuration: string;
}

export interface PoliceVerificationData {
  id: string;
  employeeId: string;
  applicationNumber: string;
  
  // Manual entry of applicant details for police records
  manualEntry: {
    name: string;
    fatherName: string;
    motherName?: string;
    spouseName?: string;
    dateOfBirth: Date;
    placeOfBirth: string;
    gender: 'MALE' | 'FEMALE' | 'OTHER';
    nationality: string;
    religion?: string;
    caste?: string;
    occupation: string;
    aadhaarNumber: string;
    panNumber?: string;
    voterIdNumber?: string;
    passportNumber?: string;
    profilePhoto: string;
  };
  
  ownerDetails: OwnerInfo;
  
  currentResidents: ResidentInfo[];
  
  addressDetails: {
    verificationAddress: AddressInfo;
    permanentAddress: AddressInfo;
    addressSameAsPermanent: boolean;
    residenceDuration: string;
    previousAddresses?: AddressInfo[];
  };
  
  policeStationDetails: PoliceStationDetails;
  
  verificationProcess: {
    physicalVerification: {
      verificationDate: Date;
      officerName: string;
      officerRank: string;
      badgeNumber: string;
      verificationTime: string;
      neighborsInterviewed: {
        name: string;
        contactNumber?: string;
        feedback: string;
        knownSince: string;
      }[];
    };
    
    recordsCheck: {
      criminalRecords: boolean;
      pendingCases: boolean;
      previousPoliceVerifications: boolean;
      recordsDetails?: string;
    };
    
    characterCertificate: {
      moralCharacter: 'EXCELLENT' | 'GOOD' | 'AVERAGE' | 'POOR';
      localReputation: 'EXCELLENT' | 'GOOD' | 'AVERAGE' | 'POOR';
      anyComplaintsReceived: boolean;
      complaintDetails?: string;
    };
  };
  
  biometricData: BiometricData;
  
  applicantSignature: string; // Base64 image
  
  verificationOutcome: {
    recommendation: 'RECOMMENDED' | 'NOT_RECOMMENDED' | 'CONDITIONAL_RECOMMENDATION';
    reasons: string[];
    conditions?: string[];
    riskAssessment: 'LOW' | 'MEDIUM' | 'HIGH';
  };
  
  officerRemarks: string;
  
  // PDF generation configuration
  pdfGeneration: {
    generatePDF: boolean;
    pdfPath?: string;
    generatedAt?: Date;
    templateVersion: string;
  };
  
  status: VerificationStatus;
  priority: VerificationPriority;
  
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
  updatedBy: string;
  
  // Approval workflow
  approvalHistory: {
    approvedBy: string;
    approvalDate: Date;
    approvalLevel: 'STATION_OFFICER' | 'INSPECTOR' | 'SUPERINTENDENT';
    comments: string;
  }[];
}

// ===============================
// VERIFICATION DASHBOARD TYPES
// ===============================

export interface VerificationSummary {
  employeeId: string;
  employeeName: string;
  profilePhoto?: string;
  
  employmentVerification?: {
    status: VerificationStatus;
    completedAt?: Date;
    priority: VerificationPriority;
  };
  
  backgroundVerification?: {
    status: VerificationStatus;
    completedAt?: Date;
    priority: VerificationPriority;
    riskRating?: 'LOW' | 'MEDIUM' | 'HIGH';
  };
  
  policeVerification?: {
    status: VerificationStatus;
    completedAt?: Date;
    priority: VerificationPriority;
    applicationNumber?: string;
  };
  
  overallStatus: VerificationStatus;
  completionPercentage: number;
  
  createdAt: Date;
  updatedAt: Date;
}

export interface VerificationFilters {
  status?: VerificationStatus[];
  priority?: VerificationPriority[];
  verificationType?: ('EMPLOYMENT' | 'BACKGROUND' | 'POLICE')[];
  dateRange?: {
    from: Date;
    to: Date;
  };
  assignedTo?: string;
  riskRating?: ('LOW' | 'MEDIUM' | 'HIGH')[];
  searchQuery?: string;
}

export interface VerificationStats {
  total: number;
  pending: number;
  inProgress: number;
  completed: number;
  rejected: number;
  
  byType: {
    employment: {
      total: number;
      pending: number;
      completed: number;
    };
    background: {
      total: number;
      pending: number;
      completed: number;
    };
    police: {
      total: number;
      pending: number;
      completed: number;
    };
  };
  
  averageCompletionTime: {
    employment: number; // in days
    background: number;
    police: number;
  };
  
  riskDistribution: {
    low: number;
    medium: number;
    high: number;
  };
}

// ===============================
// API REQUEST/RESPONSE TYPES
// ===============================

export interface CreateVerificationRequest {
  employeeId: string;
  verificationType: 'EMPLOYMENT' | 'BACKGROUND' | 'POLICE';
  priority: VerificationPriority;
  assignedTo?: string;
  dueDate?: Date;
}

export interface UpdateVerificationRequest {
  status?: VerificationStatus;
  priority?: VerificationPriority;
  remarks?: string;
  data?: Partial<EmploymentVerificationData | BackgroundVerificationData | PoliceVerificationData>;
}

export interface VerificationResponse {
  verification: EmploymentVerificationData | BackgroundVerificationData | PoliceVerificationData;
  related: {
    employee: {
      id: string;
      name: string;
      profilePhoto?: string;
    };
    onboarding: {
      id: string;
      status: string;
    };
  };
}

export interface VerificationListResponse {
  verifications: VerificationSummary[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
  stats: VerificationStats;
}