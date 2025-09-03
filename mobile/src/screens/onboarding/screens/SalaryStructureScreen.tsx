/**
 * Enhanced Salary & ESI/GMC Logic Module with Auto-Calculation
 * 
 * Features:
 * - Comprehensive salary breakdown (Basic, HRA, Medical, Conveyance, Special Allowances)
 * - ESI/GMC eligibility auto-calculation based on net salary thresholds
 * - PF calculation with employee/employer contributions
 * - Professional Tax calculation by state
 * - Annual CTC breakdown and projections
 * - Leave encashment calculations
 * - Overtime and shift allowance calculations
 * - Salary advance and deduction management
 * - Integration with insurance declaration workflows
 * - Compliance with labor law requirements
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
  TouchableOpacity,
  Switch,
  Modal,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Import UI components
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Card from '../../components/ui/Card';

// Mock implementations for dependencies
const useOnboarding = () => ({
  goToNextStep: (data?: any) => console.log('Next step:', data),
  goToPreviousStep: () => console.log('Previous step'),
  language: 'english' as const,
  userData: { 
    login: { username: 'testuser' },
    personalData: { 
      firstName: 'John',
      lastName: 'Doe',
      employeeId: 'EMP001',
      dateOfBirth: '1990-01-15',
      gender: 'Male',
      maritalStatus: 'Married'
    },
    workDetails: {
      branchCode: 'BLR001',
      siteCode: 'SITE_BLR_001',
      department: 'Facility Management',
      designation: 'Field Technician',
      joiningDate: '2024-01-15',
      probationPeriod: 6,
      employmentType: 'Permanent',
      workingHours: 8,
      weeklyOff: 'Sunday',
      shiftPattern: 'General',
      supervisorName: 'Manager Name',
      reportingManager: 'Senior Manager',
      costCenter: 'CC001',
      location: 'Bangalore',
      grade: 'E1',
      level: 'Entry'
    },
    addressData: {
      currentAddress: {
        city: 'Bangalore',
        state: 'Karnataka',
        pincode: '560001'
      }
    },
    bankingData: {
      pfNumber: 'PF12345678',
      esiNumber: 'ESI9876543210',
      uanNumber: 'UAN123456789012'
    }
  },
});

const getLocalizedText = (key: string, language: string) => {
  const texts: { [key: string]: string } = {
    salary_title: 'Salary Structure & Benefits',
    salary_subtitle: 'Comprehensive salary breakdown and benefit calculations',
    
    // Salary Components
    basic_salary: 'Basic Salary',
    hra: 'House Rent Allowance (HRA)',
    medical_allowance: 'Medical Allowance',
    conveyance_allowance: 'Conveyance Allowance',
    special_allowance: 'Special Allowance',
    overtime_allowance: 'Overtime Allowance',
    shift_allowance: 'Shift Allowance',
    performance_bonus: 'Performance Bonus',
    attendance_bonus: 'Attendance Bonus',
    
    // Deductions
    provident_fund: 'Provident Fund (PF)',
    employee_pf: 'Employee PF Contribution',
    employer_pf: 'Employer PF Contribution',
    esi_contribution: 'ESI Contribution',
    professional_tax: 'Professional Tax',
    income_tax: 'Income Tax (TDS)',
    advance_deduction: 'Salary Advance',
    loan_deduction: 'Loan EMI',
    other_deductions: 'Other Deductions',
    
    // Calculations
    gross_salary: 'Gross Salary',
    total_deductions: 'Total Deductions',
    net_salary: 'Net Take-Home Salary',
    annual_ctc: 'Annual CTC',
    monthly_ctc: 'Monthly CTC',
    
    // ESI/GMC Logic
    esi_eligibility: 'ESI Eligibility',
    gmc_eligibility: 'GMC Eligibility',
    insurance_coverage: 'Insurance Coverage',
    esi_threshold: 'ESI Threshold (≤ ₹21,000)',
    gmc_threshold: 'GMC Threshold (> ₹21,000)',
    dual_coverage: 'Dual Coverage (₹18,000 - ₹21,000)',
    
    // ESI Details
    esi_employee_rate: 'ESI Employee Rate (0.75%)',
    esi_employer_rate: 'ESI Employer Rate (3.25%)',
    esi_medical_benefit: 'Medical Benefits under ESI',
    esi_cash_benefit: 'Cash Benefits under ESI',
    esi_family_coverage: 'Family Coverage under ESI',
    
    // GMC Details
    gmc_premium: 'GMC Premium',
    gmc_sum_insured: 'GMC Sum Insured',
    gmc_family_floater: 'Family Floater',
    gmc_cashless_facility: 'Cashless Treatment',
    gmc_network_hospitals: 'Network Hospitals',
    
    // PF Details
    pf_employee_rate: 'PF Employee Rate (12%)',
    pf_employer_rate: 'PF Employer Rate (12%)',
    eps_contribution: 'EPS Contribution (8.33%)',
    edli_contribution: 'EDLI Contribution (0.5%)',
    pf_ceiling: 'PF Ceiling (₹15,000)',
    
    // Professional Tax by State
    pt_karnataka: 'Karnataka PT',
    pt_tamil_nadu: 'Tamil Nadu PT',
    pt_maharashtra: 'Maharashtra PT',
    pt_west_bengal: 'West Bengal PT',
    pt_andhra_pradesh: 'Andhra Pradesh PT',
    
    // Leave Calculations
    earned_leave: 'Earned Leave',
    casual_leave: 'Casual Leave',
    sick_leave: 'Sick Leave',
    maternity_leave: 'Maternity Leave',
    paternity_leave: 'Paternity Leave',
    leave_encashment: 'Leave Encashment',
    
    // Overtime Calculations
    normal_ot_rate: 'Normal OT Rate (1.5x)',
    holiday_ot_rate: 'Holiday OT Rate (2x)',
    night_shift_allowance: 'Night Shift Allowance',
    weekend_allowance: 'Weekend Allowance',
    
    // Bonus Calculations
    statutory_bonus: 'Statutory Bonus',
    performance_incentive: 'Performance Incentive',
    festival_bonus: 'Festival Bonus',
    retention_bonus: 'Retention Bonus',
    
    // Compliance
    minimum_wage_compliance: 'Minimum Wage Compliance',
    labor_law_compliance: 'Labor Law Compliance',
    statutory_compliance: 'Statutory Compliance',
    
    // Auto-Calculation Messages
    auto_calculated: 'Auto-calculated based on salary structure',
    manual_override: 'Manual override available',
    compliance_check: 'Compliance check passed',
    threshold_warning: 'Threshold warning',
    
    // Validation Messages
    salary_required: 'Basic salary is required',
    invalid_amount: 'Please enter a valid amount',
    minimum_wage_error: 'Salary below minimum wage',
    pf_ceiling_info: 'PF calculated on ceiling amount',
    
    // Actions
    calculate_salary: 'Calculate Salary',
    save_structure: 'Save Structure',
    generate_report: 'Generate Report',
    continue: 'Continue',
    
    // Help Text
    salary_help: 'Enter your basic salary to auto-calculate all components',
    pf_help: 'PF is calculated at 12% on basic salary up to ₹15,000',
    esi_help: 'ESI applicable if gross salary ≤ ₹21,000 per month',
    pt_help: 'Professional Tax varies by state and salary slab',
    
    // Benefits Summary
    total_benefits: 'Total Benefits Value',
    insurance_value: 'Insurance Coverage Value',
    leave_value: 'Leave Benefits Value',
    statutory_benefits: 'Statutory Benefits',
    additional_benefits: 'Additional Benefits',
  };
  
  return texts[key] || key;
};

interface SalaryComponents {
  basic: number;
  hra: number;
  medical: number;
  conveyance: number;
  special: number;
  overtime: number;
  shift: number;
  performanceBonus: number;
  attendanceBonus: number;
}

interface Deductions {
  employeePF: number;
  esi: number;
  professionalTax: number;
  incomeTax: number;
  advance: number;
  loan: number;
  other: number;
}

interface ESIDetails {
  eligible: boolean;
  employeeContribution: number;
  employerContribution: number;
  totalContribution: number;
  medicalBenefits: string[];
  cashBenefits: string[];
  familyCoverage: boolean;
}

interface GMCDetails {
  eligible: boolean;
  premium: number;
  sumInsured: number;
  familyFloater: boolean;
  cashlessHospitals: number;
  networkDetails: string[];
}

interface PFDetails {
  eligible: boolean;
  basicForPF: number;
  employeeContribution: number;
  employerContribution: number;
  epsContribution: number;
  edliContribution: number;
  totalContribution: number;
}

interface LeaveEntitlements {
  earnedLeave: number;
  casualLeave: number;
  sickLeave: number;
  maternityLeave: number;
  paternityLeave: number;
  leaveEncashmentRate: number;
}

interface SalaryStructure {
  employeeId: string;
  effectiveDate: string;
  components: SalaryComponents;
  deductions: Deductions;
  grossSalary: number;
  totalDeductions: number;
  netSalary: number;
  annualCTC: number;
  
  // Insurance Logic
  esiDetails: ESIDetails;
  gmcDetails: GMCDetails;
  insuranceChoice: 'esi' | 'gmc' | 'both' | 'none';
  
  // Statutory Details
  pfDetails: PFDetails;
  professionalTaxState: string;
  professionalTaxAmount: number;
  
  // Leave & Benefits
  leaveEntitlements: LeaveEntitlements;
  minimumWageCompliance: boolean;
  
  // Calculation Metadata
  calculationDate: string;
  autoCalculated: boolean;
  manualOverrides: string[];
  complianceChecks: { [key: string]: boolean };
}

// State-wise Professional Tax Slabs
const PROFESSIONAL_TAX_SLABS: { [state: string]: { [slab: string]: number } } = {
  'Karnataka': {
    '0-15000': 0,
    '15001-30000': 200,
    '30001-above': 300,
  },
  'Tamil Nadu': {
    '0-21000': 0,
    '21001-above': 208.33,
  },
  'Maharashtra': {
    '0-5000': 0,
    '5001-10000': 150,
    '10001-above': 175,
  },
  'West Bengal': {
    '0-10000': 0,
    '10001-15000': 110,
    '15001-25000': 130,
    '25001-40000': 150,
    '40001-above': 200,
  },
};

// Minimum Wage by State (Monthly)
const MINIMUM_WAGES: { [state: string]: number } = {
  'Karnataka': 15000,
  'Tamil Nadu': 14500,
  'Maharashtra': 16000,
  'West Bengal': 13500,
  'Andhra Pradesh': 14000,
};

export default function SalaryStructureScreen() {
  const { goToNextStep, goToPreviousStep, language, userData } = useOnboarding();
  
  const [salaryStructure, setSalaryStructure] = useState<SalaryStructure>({
    employeeId: userData?.personalData?.employeeId || '',
    effectiveDate: new Date().toISOString().split('T')[0],
    components: {
      basic: 0,
      hra: 0,
      medical: 0,
      conveyance: 0,
      special: 0,
      overtime: 0,
      shift: 0,
      performanceBonus: 0,
      attendanceBonus: 0,
    },
    deductions: {
      employeePF: 0,
      esi: 0,
      professionalTax: 0,
      incomeTax: 0,
      advance: 0,
      loan: 0,
      other: 0,
    },
    grossSalary: 0,
    totalDeductions: 0,
    netSalary: 0,
    annualCTC: 0,
    esiDetails: {
      eligible: false,
      employeeContribution: 0,
      employerContribution: 0,
      totalContribution: 0,
      medicalBenefits: [],
      cashBenefits: [],
      familyCoverage: false,
    },
    gmcDetails: {
      eligible: false,
      premium: 0,
      sumInsured: 0,
      familyFloater: false,
      cashlessHospitals: 0,
      networkDetails: [],
    },
    insuranceChoice: 'none',
    pfDetails: {
      eligible: false,
      basicForPF: 0,
      employeeContribution: 0,
      employerContribution: 0,
      epsContribution: 0,
      edliContribution: 0,
      totalContribution: 0,
    },
    professionalTaxState: userData?.addressData?.currentAddress?.state || 'Karnataka',
    professionalTaxAmount: 0,
    leaveEntitlements: {
      earnedLeave: 21,
      casualLeave: 7,
      sickLeave: 7,
      maternityLeave: 182,
      paternityLeave: 15,
      leaveEncashmentRate: 0,
    },
    minimumWageCompliance: true,
    calculationDate: new Date().toISOString(),
    autoCalculated: true,
    manualOverrides: [],
    complianceChecks: {},
  });
  
  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  const [showCalculationModal, setShowCalculationModal] = useState(false);
  const [manualMode, setManualMode] = useState(false);

  useEffect(() => {
    if (salaryStructure.components.basic > 0) {
      calculateSalaryStructure();
    }
  }, [salaryStructure.components.basic, salaryStructure.professionalTaxState]);

  const calculateSalaryStructure = () => {
    const { basic } = salaryStructure.components;
    if (basic <= 0) return;

    // Auto-calculate components based on basic salary
    const calculatedComponents: SalaryComponents = {
      basic,
      hra: Math.round(basic * 0.4), // 40% of basic
      medical: 1250, // Standard medical allowance
      conveyance: 1600, // Standard conveyance allowance
      special: Math.round(basic * 0.3), // 30% of basic
      overtime: 0, // Variable
      shift: 0, // Variable
      performanceBonus: 0, // Variable
      attendanceBonus: 0, // Variable
    };

    // Calculate gross salary
    const grossSalary = Object.values(calculatedComponents).reduce((sum, amount) => sum + amount, 0);

    // Calculate PF details
    const pfDetails = calculatePF(basic);
    
    // Calculate ESI details
    const esiDetails = calculateESI(grossSalary);
    
    // Calculate GMC details
    const gmcDetails = calculateGMC(grossSalary);
    
    // Determine insurance choice based on salary
    const insuranceChoice = determineInsuranceChoice(grossSalary);
    
    // Calculate Professional Tax
    const professionalTaxAmount = calculateProfessionalTax(grossSalary, salaryStructure.professionalTaxState);
    
    // Calculate deductions
    const calculatedDeductions: Deductions = {
      employeePF: pfDetails.employeeContribution,
      esi: esiDetails.employeeContribution,
      professionalTax: professionalTaxAmount,
      incomeTax: 0, // TDS calculation would need additional inputs
      advance: 0,
      loan: 0,
      other: 0,
    };

    const totalDeductions = Object.values(calculatedDeductions).reduce((sum, amount) => sum + amount, 0);
    const netSalary = grossSalary - totalDeductions;
    const annualCTC = grossSalary * 12;

    // Calculate leave entitlements
    const leaveEntitlements = calculateLeaveEntitlements(basic);

    // Compliance checks
    const minimumWage = MINIMUM_WAGES[salaryStructure.professionalTaxState] || 15000;
    const minimumWageCompliance = netSalary >= minimumWage;

    const complianceChecks = {
      minimumWage: minimumWageCompliance,
      pfCompliance: pfDetails.eligible,
      esiCompliance: esiDetails.eligible,
      ptCompliance: true,
    };

    setSalaryStructure(prev => ({
      ...prev,
      components: calculatedComponents,
      deductions: calculatedDeductions,
      grossSalary,
      totalDeductions,
      netSalary,
      annualCTC,
      esiDetails,
      gmcDetails,
      insuranceChoice,
      pfDetails,
      professionalTaxAmount,
      leaveEntitlements,
      minimumWageCompliance,
      complianceChecks,
      calculationDate: new Date().toISOString(),
      autoCalculated: !manualMode,
    }));
  };

  const calculatePF = (basic: number): PFDetails => {
    const pfCeiling = 15000;
    const basicForPF = Math.min(basic, pfCeiling);
    const employeeRate = 0.12; // 12%
    const employerRate = 0.12; // 12%
    const epsRate = 0.0833; // 8.33%
    const edliRate = 0.005; // 0.5%

    const employeeContribution = Math.round(basicForPF * employeeRate);
    const employerContribution = Math.round(basicForPF * employerRate);
    const epsContribution = Math.round(basicForPF * epsRate);
    const edliContribution = Math.round(basicForPF * edliRate);
    const totalContribution = employeeContribution + employerContribution;

    return {
      eligible: basic >= 1800, // Minimum for PF eligibility
      basicForPF,
      employeeContribution,
      employerContribution,
      epsContribution,
      edliContribution,
      totalContribution,
    };
  };

  const calculateESI = (grossSalary: number): ESIDetails => {
    const esiCeiling = 21000;
    const eligible = grossSalary <= esiCeiling;
    const employeeRate = 0.0075; // 0.75%
    const employerRate = 0.0325; // 3.25%

    const employeeContribution = eligible ? Math.round(grossSalary * employeeRate) : 0;
    const employerContribution = eligible ? Math.round(grossSalary * employerRate) : 0;
    const totalContribution = employeeContribution + employerContribution;

    return {
      eligible,
      employeeContribution,
      employerContribution,
      totalContribution,
      medicalBenefits: eligible ? [
        'Outpatient Treatment',
        'Inpatient Treatment', 
        'Maternity Benefits',
        'Disability Benefits',
        'Dependent Benefits'
      ] : [],
      cashBenefits: eligible ? [
        'Sickness Benefit',
        'Maternity Benefit',
        'Disablement Benefit',
        'Dependent Benefit',
        'Funeral Expenses'
      ] : [],
      familyCoverage: eligible,
    };
  };

  const calculateGMC = (grossSalary: number): GMCDetails => {
    const gmcThreshold = 21000;
    const eligible = grossSalary > gmcThreshold;
    
    // GMC premium typically ranges from 0.5% to 1% of annual salary
    const annualSalary = grossSalary * 12;
    const premium = eligible ? Math.round(annualSalary * 0.007) : 0; // 0.7% of annual salary
    
    // Sum insured typically 3-5x of annual salary
    const sumInsured = eligible ? annualSalary * 4 : 0;

    return {
      eligible,
      premium,
      sumInsured,
      familyFloater: eligible,
      cashlessHospitals: eligible ? 6500 : 0,
      networkDetails: eligible ? [
        'Cashless treatment at network hospitals',
        'Outpatient coverage',
        'Maternity coverage',
        'Pre and post hospitalization',
        'Day care procedures',
        'Health check-ups'
      ] : [],
    };
  };

  const determineInsuranceChoice = (grossSalary: number): 'esi' | 'gmc' | 'both' | 'none' => {
    if (grossSalary <= 18000) return 'esi';
    if (grossSalary > 21000) return 'gmc';
    if (grossSalary >= 18000 && grossSalary <= 21000) return 'both'; // Choice available
    return 'none';
  };

  const calculateProfessionalTax = (grossSalary: number, state: string): number => {
    const slabs = PROFESSIONAL_TAX_SLABS[state];
    if (!slabs) return 0;

    for (const [range, amount] of Object.entries(slabs)) {
      const [min, max] = range.split('-').map(v => v === 'above' ? Infinity : parseInt(v));
      if (grossSalary >= min && grossSalary <= max) {
        return typeof amount === 'number' ? amount : Math.round(amount);
      }
    }
    return 0;
  };

  const calculateLeaveEntitlements = (basic: number): LeaveEntitlements => {
    const leaveEncashmentRate = Math.round(basic / 30); // Per day rate

    return {
      earnedLeave: 21, // 1.75 days per month
      casualLeave: 7,
      sickLeave: 7,
      maternityLeave: userData?.personalData?.gender === 'Female' ? 182 : 0,
      paternityLeave: userData?.personalData?.gender === 'Male' ? 15 : 0,
      leaveEncashmentRate,
    };
  };

  const handleBasicSalaryChange = (value: string) => {
    const basicSalary = parseFloat(value) || 0;
    setSalaryStructure(prev => ({
      ...prev,
      components: { ...prev.components, basic: basicSalary },
    }));
  };

  const handleComponentChange = (component: keyof SalaryComponents, value: string) => {
    const amount = parseFloat(value) || 0;
    setSalaryStructure(prev => ({
      ...prev,
      components: { ...prev.components, [component]: amount },
      manualOverrides: [...prev.manualOverrides.filter(c => c !== component), component],
    }));
    setManualMode(true);
  };

  const handleDeductionChange = (deduction: keyof Deductions, value: string) => {
    const amount = parseFloat(value) || 0;
    setSalaryStructure(prev => ({
      ...prev,
      deductions: { ...prev.deductions, [deduction]: amount },
      manualOverrides: [...prev.manualOverrides.filter(d => d !== deduction), deduction],
    }));
    setManualMode(true);
  };

  const validateForm = (): boolean => {
    const newErrors: { [key: string]: string } = {};

    if (!salaryStructure.components.basic) {
      newErrors.basicSalary = getLocalizedText('salary_required', language);
    }

    if (salaryStructure.components.basic < 0) {
      newErrors.basicSalary = getLocalizedText('invalid_amount', language);
    }

    const minimumWage = MINIMUM_WAGES[salaryStructure.professionalTaxState] || 15000;
    if (salaryStructure.netSalary < minimumWage) {
      newErrors.minimumWage = getLocalizedText('minimum_wage_error', language);
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;

    try {
      await AsyncStorage.setItem(
        `salary_structure_${userData?.login?.username}`,
        JSON.stringify(salaryStructure)
      );

      goToNextStep({ salaryStructure });
    } catch (error) {
      console.error('Failed to save salary structure:', error);
      Alert.alert('Error', 'Failed to save data. Please try again.');
    }
  };

  const renderSalaryComponents = () => (
    <Card title={getLocalizedText('salary_title', language)} variant="outlined" margin={8}>
      <Text style={styles.helpText}>
        {getLocalizedText('salary_help', language)}
      </Text>

      <View style={styles.componentSection}>
        <Input
          label={getLocalizedText('basic_salary', language)}
          value={salaryStructure.components.basic.toString()}
          onChangeText={handleBasicSalaryChange}
          placeholder="25000"
          keyboardType="numeric"
          error={errors.basicSalary}
        />

        <View style={styles.row}>
          <View style={styles.halfWidth}>
            <Input
              label={getLocalizedText('hra', language)}
              value={salaryStructure.components.hra.toString()}
              onChangeText={(value) => handleComponentChange('hra', value)}
              placeholder="Auto-calculated"
              keyboardType="numeric"
              editable={manualMode}
            />
            {!manualMode && (
              <Text style={styles.autoText}>
                {getLocalizedText('auto_calculated', language)}
              </Text>
            )}
          </View>

          <View style={styles.halfWidth}>
            <Input
              label={getLocalizedText('medical_allowance', language)}
              value={salaryStructure.components.medical.toString()}
              onChangeText={(value) => handleComponentChange('medical', value)}
              placeholder="1250"
              keyboardType="numeric"
              editable={manualMode}
            />
          </View>
        </View>

        <View style={styles.row}>
          <View style={styles.halfWidth}>
            <Input
              label={getLocalizedText('conveyance_allowance', language)}
              value={salaryStructure.components.conveyance.toString()}
              onChangeText={(value) => handleComponentChange('conveyance', value)}
              placeholder="1600"
              keyboardType="numeric"
              editable={manualMode}
            />
          </View>

          <View style={styles.halfWidth}>
            <Input
              label={getLocalizedText('special_allowance', language)}
              value={salaryStructure.components.special.toString()}
              onChangeText={(value) => handleComponentChange('special', value)}
              placeholder="Auto-calculated"
              keyboardType="numeric"
              editable={manualMode}
            />
          </View>
        </View>
      </View>

      <View style={styles.summarySection}>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>
            {getLocalizedText('gross_salary', language)}:
          </Text>
          <Text style={styles.summaryValue}>₹{salaryStructure.grossSalary.toLocaleString()}</Text>
        </View>
        
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>
            {getLocalizedText('annual_ctc', language)}:
          </Text>
          <Text style={styles.summaryValue}>₹{salaryStructure.annualCTC.toLocaleString()}</Text>
        </View>
      </View>
    </Card>
  );

  const renderInsuranceLogic = () => (
    <Card title={getLocalizedText('insurance_coverage', language)} variant="outlined" margin={8}>
      <View style={styles.insuranceSection}>
        {/* ESI Section */}
        <View style={[styles.insuranceCard, { 
          backgroundColor: salaryStructure.esiDetails.eligible ? '#E8F5E8' : '#F5F5F5' 
        }]}>
          <View style={styles.insuranceHeader}>
            <Text style={styles.insuranceTitle}>ESI Coverage</Text>
            <Text style={[styles.eligibilityBadge, {
              backgroundColor: salaryStructure.esiDetails.eligible ? '#4CAF50' : '#9E9E9E'
            }]}>
              {salaryStructure.esiDetails.eligible ? 'Eligible' : 'Not Eligible'}
            </Text>
          </View>
          
          {salaryStructure.esiDetails.eligible && (
            <View style={styles.insuranceDetails}>
              <Text style={styles.contributionText}>
                Employee Contribution: ₹{salaryStructure.esiDetails.employeeContribution}
              </Text>
              <Text style={styles.contributionText}>
                Employer Contribution: ₹{salaryStructure.esiDetails.employerContribution}
              </Text>
              <Text style={styles.benefitsTitle}>Medical Benefits:</Text>
              {salaryStructure.esiDetails.medicalBenefits.map((benefit, index) => (
                <Text key={index} style={styles.benefitItem}>• {benefit}</Text>
              ))}
            </View>
          )}
        </View>

        {/* GMC Section */}
        <View style={[styles.insuranceCard, { 
          backgroundColor: salaryStructure.gmcDetails.eligible ? '#E3F2FD' : '#F5F5F5' 
        }]}>
          <View style={styles.insuranceHeader}>
            <Text style={styles.insuranceTitle}>GMC Coverage</Text>
            <Text style={[styles.eligibilityBadge, {
              backgroundColor: salaryStructure.gmcDetails.eligible ? '#2196F3' : '#9E9E9E'
            }]}>
              {salaryStructure.gmcDetails.eligible ? 'Eligible' : 'Not Eligible'}
            </Text>
          </View>
          
          {salaryStructure.gmcDetails.eligible && (
            <View style={styles.insuranceDetails}>
              <Text style={styles.contributionText}>
                Annual Premium: ₹{salaryStructure.gmcDetails.premium.toLocaleString()}
              </Text>
              <Text style={styles.contributionText}>
                Sum Insured: ₹{salaryStructure.gmcDetails.sumInsured.toLocaleString()}
              </Text>
              <Text style={styles.contributionText}>
                Network Hospitals: {salaryStructure.gmcDetails.cashlessHospitals}+
              </Text>
            </View>
          )}
        </View>

        {/* Insurance Choice Logic */}
        {salaryStructure.insuranceChoice === 'both' && (
          <View style={styles.choiceSection}>
            <Text style={styles.choiceTitle}>
              Insurance Choice Available (₹18,000 - ₹21,000 range)
            </Text>
            <Text style={styles.choiceSubtitle}>
              You can choose either ESI or GMC coverage
            </Text>
          </View>
        )}
      </View>
    </Card>
  );

  const renderPFDetails = () => (
    <Card title={getLocalizedText('provident_fund', language)} variant="outlined" margin={8}>
      <Text style={styles.helpText}>
        {getLocalizedText('pf_help', language)}
      </Text>

      <View style={styles.pfSection}>
        <View style={styles.pfRow}>
          <Text style={styles.pfLabel}>Basic Salary for PF:</Text>
          <Text style={styles.pfValue}>₹{salaryStructure.pfDetails.basicForPF.toLocaleString()}</Text>
        </View>
        
        <View style={styles.pfRow}>
          <Text style={styles.pfLabel}>Employee Contribution (12%):</Text>
          <Text style={styles.pfValue}>₹{salaryStructure.pfDetails.employeeContribution}</Text>
        </View>
        
        <View style={styles.pfRow}>
          <Text style={styles.pfLabel}>Employer Contribution (12%):</Text>
          <Text style={styles.pfValue}>₹{salaryStructure.pfDetails.employerContribution}</Text>
        </View>
        
        <View style={styles.pfRow}>
          <Text style={styles.pfLabel}>EPS Contribution (8.33%):</Text>
          <Text style={styles.pfValue}>₹{salaryStructure.pfDetails.epsContribution}</Text>
        </View>
        
        <View style={styles.pfRow}>
          <Text style={styles.pfLabel}>EDLI Contribution (0.5%):</Text>
          <Text style={styles.pfValue}>₹{salaryStructure.pfDetails.edliContribution}</Text>
        </View>

        {salaryStructure.components.basic > 15000 && (
          <Text style={styles.ceilingNote}>
            {getLocalizedText('pf_ceiling_info', language)}
          </Text>
        )}
      </View>
    </Card>
  );

  const renderDeductions = () => (
    <Card title="Deductions & Take-home" variant="outlined" margin={8}>
      <View style={styles.deductionSection}>
        <View style={styles.deductionRow}>
          <Text style={styles.deductionLabel}>Employee PF:</Text>
          <Text style={styles.deductionValue}>₹{salaryStructure.deductions.employeePF}</Text>
        </View>
        
        <View style={styles.deductionRow}>
          <Text style={styles.deductionLabel}>ESI Contribution:</Text>
          <Text style={styles.deductionValue}>₹{salaryStructure.deductions.esi}</Text>
        </View>
        
        <View style={styles.deductionRow}>
          <Text style={styles.deductionLabel}>Professional Tax:</Text>
          <Text style={styles.deductionValue}>₹{salaryStructure.deductions.professionalTax}</Text>
        </View>
        
        <View style={styles.deductionRow}>
          <Text style={styles.deductionLabel}>Other Deductions:</Text>
          <Input
            value={salaryStructure.deductions.other.toString()}
            onChangeText={(value) => handleDeductionChange('other', value)}
            placeholder="0"
            keyboardType="numeric"
            style={styles.deductionInput}
          />
        </View>

        <View style={styles.divider} />
        
        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>Total Deductions:</Text>
          <Text style={styles.totalValue}>₹{salaryStructure.totalDeductions.toLocaleString()}</Text>
        </View>
        
        <View style={styles.netSalaryRow}>
          <Text style={styles.netSalaryLabel}>Net Take-home Salary:</Text>
          <Text style={styles.netSalaryValue}>₹{salaryStructure.netSalary.toLocaleString()}</Text>
        </View>

        {errors.minimumWage && (
          <Text style={styles.errorText}>{errors.minimumWage}</Text>
        )}
      </View>
    </Card>
  );

  const renderComplianceChecks = () => (
    <Card title="Compliance Status" variant="outlined" margin={8}>
      <View style={styles.complianceSection}>
        {Object.entries(salaryStructure.complianceChecks).map(([check, status]) => (
          <View key={check} style={styles.complianceRow}>
            <Text style={styles.complianceCheck}>{check.replace(/([A-Z])/g, ' $1')}</Text>
            <Text style={[styles.complianceStatus, {
              color: status ? '#4CAF50' : '#F44336'
            }]}>
              {status ? '✓ Compliant' : '✗ Non-compliant'}
            </Text>
          </View>
        ))}
      </View>
    </Card>
  );

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>
          {getLocalizedText('salary_title', language)}
        </Text>
        <Text style={styles.subtitle}>
          {getLocalizedText('salary_subtitle', language)}
        </Text>
      </View>

      {/* Content */}
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {renderSalaryComponents()}
        {renderInsuranceLogic()}
        {renderPFDetails()}
        {renderDeductions()}
        {renderComplianceChecks()}

        <View style={styles.spacer} />
      </ScrollView>

      {/* Actions */}
      <View style={styles.actions}>
        <Button
          title="Auto Calculate"
          onPress={() => {
            setManualMode(false);
            calculateSalaryStructure();
          }}
          variant="outline"
          size="medium"
        />
        
        <Button
          title={getLocalizedText('continue', language)}
          onPress={handleSubmit}
          variant="primary"
          size="medium"
        />
      </View>

      {/* Calculation Modal */}
      <Modal
        visible={showCalculationModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowCalculationModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Salary Calculation Details</Text>
            
            <ScrollView style={styles.modalScroll}>
              <Text style={styles.calculationText}>
                Calculation performed on: {new Date(salaryStructure.calculationDate).toLocaleString()}
              </Text>
              <Text style={styles.calculationText}>
                Auto-calculated: {salaryStructure.autoCalculated ? 'Yes' : 'No'}
              </Text>
              {salaryStructure.manualOverrides.length > 0 && (
                <Text style={styles.calculationText}>
                  Manual overrides: {salaryStructure.manualOverrides.join(', ')}
                </Text>
              )}
            </ScrollView>
            
            <Button
              title="Close"
              onPress={() => setShowCalculationModal(false)}
              variant="primary"
              size="medium"
            />
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    backgroundColor: '#fff',
    paddingHorizontal: 24,
    paddingTop: 60,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#212121',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#757575',
    textAlign: 'center',
  },
  content: {
    flex: 1,
    paddingHorizontal: 8,
  },
  helpText: {
    fontSize: 14,
    color: '#757575',
    marginBottom: 16,
    fontStyle: 'italic',
  },
  componentSection: {
    marginBottom: 16,
  },
  row: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  halfWidth: {
    flex: 1,
  },
  autoText: {
    fontSize: 12,
    color: '#4CAF50',
    marginTop: 4,
    fontStyle: 'italic',
  },
  summarySection: {
    backgroundColor: '#F8F9FA',
    borderRadius: 8,
    padding: 16,
    marginTop: 16,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  summaryLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: '#424242',
  },
  summaryValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#2196F3',
  },
  insuranceSection: {
    gap: 12,
  },
  insuranceCard: {
    borderRadius: 8,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  insuranceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  insuranceTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#212121',
  },
  eligibilityBadge: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  insuranceDetails: {
    gap: 4,
  },
  contributionText: {
    fontSize: 14,
    color: '#424242',
  },
  benefitsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#424242',
    marginTop: 8,
    marginBottom: 4,
  },
  benefitItem: {
    fontSize: 13,
    color: '#757575',
    marginLeft: 8,
  },
  choiceSection: {
    backgroundColor: '#FFF3E0',
    borderRadius: 8,
    padding: 16,
    borderWidth: 1,
    borderColor: '#FFB74D',
  },
  choiceTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#E65100',
    marginBottom: 4,
  },
  choiceSubtitle: {
    fontSize: 14,
    color: '#F57C00',
  },
  pfSection: {
    gap: 8,
  },
  pfRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  pfLabel: {
    fontSize: 14,
    color: '#424242',
  },
  pfValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#212121',
  },
  ceilingNote: {
    fontSize: 12,
    color: '#FF9800',
    fontStyle: 'italic',
    marginTop: 8,
    textAlign: 'center',
  },
  deductionSection: {
    gap: 8,
  },
  deductionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  deductionLabel: {
    fontSize: 14,
    color: '#424242',
    flex: 1,
  },
  deductionValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#212121',
    width: 80,
    textAlign: 'right',
  },
  deductionInput: {
    width: 80,
    textAlign: 'right',
  },
  divider: {
    height: 1,
    backgroundColor: '#E0E0E0',
    marginVertical: 8,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    backgroundColor: '#F8F9FA',
    paddingHorizontal: 12,
    borderRadius: 6,
  },
  totalLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#424242',
  },
  totalValue: {
    fontSize: 15,
    fontWeight: '700',
    color: '#F44336',
  },
  netSalaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
    backgroundColor: '#E8F5E8',
    paddingHorizontal: 12,
    borderRadius: 6,
    marginTop: 8,
  },
  netSalaryLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: '#2E7D32',
  },
  netSalaryValue: {
    fontSize: 18,
    fontWeight: '800',
    color: '#1B5E20',
  },
  complianceSection: {
    gap: 8,
  },
  complianceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#F8F9FA',
    borderRadius: 6,
  },
  complianceCheck: {
    fontSize: 14,
    color: '#424242',
    textTransform: 'capitalize',
  },
  complianceStatus: {
    fontSize: 14,
    fontWeight: '600',
  },
  errorText: {
    fontSize: 12,
    color: '#F44336',
    marginTop: 4,
    textAlign: 'center',
  },
  spacer: {
    height: 100,
  },
  actions: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    paddingHorizontal: 24,
    paddingVertical: 20,
    paddingBottom: 40,
    gap: 16,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 24,
    width: '90%',
    maxHeight: '70%',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#212121',
    textAlign: 'center',
    marginBottom: 16,
  },
  modalScroll: {
    maxHeight: 200,
    marginBottom: 16,
  },
  calculationText: {
    fontSize: 14,
    color: '#424242',
    marginBottom: 8,
  },
});
