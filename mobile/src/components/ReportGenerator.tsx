import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Modal,
  Alert,
  Share,
  Platform,
} from 'react-native';
import { useAnalytics } from '../hooks/useAnalytics';
import { AnalyticsReport } from '../services/analyticsService';
import Icon from 'react-native-vector-icons/MaterialIcons';
import DateTimePicker from '@react-native-community/datetimepicker';

interface ReportGeneratorProps {
  visible: boolean;
  onClose: () => void;
  defaultReportType?: 'onboarding' | 'engagement' | 'performance';
  userId?: string;
}

interface DateRange {
  start: Date;
  end: Date;
}

const ReportGenerator: React.FC<ReportGeneratorProps> = ({
  visible,
  onClose,
  defaultReportType = 'onboarding',
  userId
}) => {
  const {
    generateOnboardingReport,
    generateEngagementReport,
    generatePerformanceReport,
    loading
  } = useAnalytics();

  const [reportType, setReportType] = useState<'onboarding' | 'engagement' | 'performance'>(defaultReportType);
  const [dateRange, setDateRange] = useState<DateRange>({
    start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 days ago
    end: new Date()
  });
  const [showStartDatePicker, setShowStartDatePicker] = useState(false);
  const [showEndDatePicker, setShowEndDatePicker] = useState(false);
  const [generatedReport, setGeneratedReport] = useState<AnalyticsReport | null>(null);
  const [generating, setGenerating] = useState(false);

  const reportTypes = [
    {
      id: 'onboarding' as const,
      title: 'Onboarding Report',
      description: 'Employee onboarding process analytics',
      icon: 'person-add',
      color: '#4CAF50'
    },
    {
      id: 'engagement' as const,
      title: 'Engagement Report',
      description: 'User interaction and engagement metrics',
      icon: 'people',
      color: '#2196F3'
    },
    {
      id: 'performance' as const,
      title: 'Performance Report',
      description: 'Application performance and optimization insights',
      icon: 'speed',
      color: '#FF9800'
    }
  ];

  const predefinedRanges = [
    {
      label: 'Last 7 days',
      start: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
      end: new Date()
    },
    {
      label: 'Last 30 days',
      start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      end: new Date()
    },
    {
      label: 'Last 90 days',
      start: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000),
      end: new Date()
    },
    {
      label: 'This month',
      start: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
      end: new Date()
    },
    {
      label: 'Last month',
      start: new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1),
      end: new Date(new Date().getFullYear(), new Date().getMonth(), 0)
    }
  ];

  const handleGenerateReport = async () => {
    try {
      setGenerating(true);
      let report: AnalyticsReport | null = null;

      switch (reportType) {
        case 'onboarding':
          report = await generateOnboardingReport(dateRange);
          break;
        case 'engagement':
          report = await generateEngagementReport(dateRange);
          break;
        case 'performance':
          report = await generatePerformanceReport(dateRange);
          break;
      }

      if (report) {
        setGeneratedReport(report);
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to generate report');
      console.error('Error generating report:', error);
    } finally {
      setGenerating(false);
    }
  };

  const handleShareReport = async () => {
    if (!generatedReport) return;

    try {
      const reportContent = generateReportText(generatedReport);
      
      await Share.share({
        message: reportContent,
        title: generatedReport.title,
        ...(Platform.OS === 'ios' && { url: 'data:text/plain;base64,' + btoa(reportContent) })
      });
    } catch (error) {
      Alert.alert('Error', 'Failed to share report');
      console.error('Error sharing report:', error);
    }
  };

  const generateReportText = (report: AnalyticsReport): string => {
    const { title, description, dateRange, data, summary } = report;
    
    let text = `${title}\n`;
    text += `${description}\n`;
    text += `Generated: ${report.generatedAt.toLocaleString()}\n`;
    text += `Period: ${dateRange.start.toLocaleDateString()} - ${dateRange.end.toLocaleDateString()}\n\n`;

    // Add summary data
    if (summary) {
      text += 'SUMMARY\n';
      text += '========\n';
      Object.entries(summary).forEach(([key, value]) => {
        text += `${key}: ${value}\n`;
      });
      text += '\n';
    }

    // Add detailed data based on report type
    if (data) {
      text += 'DETAILED METRICS\n';
      text += '================\n';
      
      switch (report.reportType) {
        case 'onboarding':
          text += `Total Started: ${data.totalStarted || 0}\n`;
          text += `Total Completed: ${data.totalCompleted || 0}\n`;
          text += `Completion Rate: ${(data.completionRate || 0).toFixed(1)}%\n`;
          text += `Average Time to Complete: ${Math.round((data.averageTimeToComplete || 0) / 60)} minutes\n`;
          break;
          
        case 'engagement':
          text += `Total Interactions: ${data.totalInteractions || 0}\n`;
          text += `Unique Users: ${data.uniqueUsers || 0}\n`;
          text += `Average Session Duration: ${Math.round((data.averageSessionDuration || 0) / 60)} minutes\n`;
          text += `User Retention: ${(data.userRetention || 0).toFixed(1)}%\n`;
          break;
          
        case 'performance':
          text += `Average Screen Load Time: ${(data.averageScreenLoadTime || 0).toFixed(1)}s\n`;
          text += `Average API Response Time: ${(data.averageApiResponseTime || 0).toFixed(0)}ms\n`;
          text += `Crash Rate: ${(data.crashRate || 0).toFixed(3)}%\n`;
          text += `Error Rate: ${(data.errorRate || 0).toFixed(2)}%\n`;
          break;
      }
    }

    return text;
  };

  const handleDateChange = (event: any, selectedDate?: Date, isStartDate = true) => {
    if (Platform.OS === 'android') {
      setShowStartDatePicker(false);
      setShowEndDatePicker(false);
    }

    if (selectedDate) {
      if (isStartDate) {
        setDateRange(prev => ({ ...prev, start: selectedDate }));
      } else {
        setDateRange(prev => ({ ...prev, end: selectedDate }));
      }
    }
  };

  const renderReportTypeSelection = () => (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Report Type</Text>
      {reportTypes.map((type) => (
        <TouchableOpacity
          key={type.id}
          style={[
            styles.reportTypeCard,
            reportType === type.id && styles.selectedReportType
          ]}
          onPress={() => setReportType(type.id)}
        >
          <View style={styles.reportTypeHeader}>
            <Icon name={type.icon} size={24} color={type.color} />
            <Text style={styles.reportTypeTitle}>{type.title}</Text>
            {reportType === type.id && (
              <Icon name="check-circle" size={20} color="#4CAF50" />
            )}
          </View>
          <Text style={styles.reportTypeDescription}>{type.description}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );

  const renderDateRangeSelection = () => (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Date Range</Text>
      
      <View style={styles.predefinedRanges}>
        {predefinedRanges.map((range, index) => (
          <TouchableOpacity
            key={index}
            style={styles.predefinedRangeButton}
            onPress={() => setDateRange({ start: range.start, end: range.end })}
          >
            <Text style={styles.predefinedRangeText}>{range.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.customDateRange}>
        <Text style={styles.customDateTitle}>Custom Range</Text>
        
        <View style={styles.dateRow}>
          <View style={styles.dateInput}>
            <Text style={styles.dateLabel}>Start Date</Text>
            <TouchableOpacity
              style={styles.dateButton}
              onPress={() => setShowStartDatePicker(true)}
            >
              <Text style={styles.dateButtonText}>
                {dateRange.start.toLocaleDateString()}
              </Text>
              <Icon name="calendar-today" size={20} color="#666" />
            </TouchableOpacity>
          </View>

          <View style={styles.dateInput}>
            <Text style={styles.dateLabel}>End Date</Text>
            <TouchableOpacity
              style={styles.dateButton}
              onPress={() => setShowEndDatePicker(true)}
            >
              <Text style={styles.dateButtonText}>
                {dateRange.end.toLocaleDateString()}
              </Text>
              <Icon name="calendar-today" size={20} color="#666" />
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </View>
  );

  const renderGeneratedReport = () => {
    if (!generatedReport) return null;

    return (
      <View style={styles.section}>
        <View style={styles.reportHeader}>
          <Text style={styles.sectionTitle}>Generated Report</Text>
          <TouchableOpacity
            style={styles.shareButton}
            onPress={handleShareReport}
          >
            <Icon name="share" size={20} color="#2196F3" />
            <Text style={styles.shareButtonText}>Share</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.reportSummary}>
          <Text style={styles.reportTitle}>{generatedReport.title}</Text>
          <Text style={styles.reportDescription}>{generatedReport.description}</Text>
          
          <View style={styles.reportMeta}>
            <Text style={styles.reportMetaText}>
              Generated: {generatedReport.generatedAt.toLocaleString()}
            </Text>
            <Text style={styles.reportMetaText}>
              Period: {generatedReport.dateRange.start.toLocaleDateString()} - {generatedReport.dateRange.end.toLocaleDateString()}
            </Text>
          </View>

          {generatedReport.summary && (
            <View style={styles.summaryData}>
              <Text style={styles.summaryTitle}>Key Metrics</Text>
              {Object.entries(generatedReport.summary).map(([key, value]) => (
                <View key={key} style={styles.summaryRow}>
                  <Text style={styles.summaryKey}>{key}:</Text>
                  <Text style={styles.summaryValue}>{value}</Text>
                </View>
              ))}
            </View>
          )}
        </View>
      </View>
    );
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Generate Report</Text>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Icon name="close" size={24} color="#666" />
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.content}>
          {renderReportTypeSelection()}
          {renderDateRangeSelection()}
          {renderGeneratedReport()}
        </ScrollView>

        <View style={styles.footer}>
          <TouchableOpacity
            style={[styles.generateButton, (generating || loading) && styles.disabledButton]}
            onPress={handleGenerateReport}
            disabled={generating || loading}
          >
            {generating ? (
              <Text style={styles.generateButtonText}>Generating...</Text>
            ) : (
              <>
                <Icon name="assessment" size={20} color="#FFFFFF" />
                <Text style={styles.generateButtonText}>Generate Report</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        {showStartDatePicker && (
          <DateTimePicker
            value={dateRange.start}
            mode="date"
            display="default"
            onChange={(event, date) => handleDateChange(event, date, true)}
            maximumDate={new Date()}
          />
        )}

        {showEndDatePicker && (
          <DateTimePicker
            value={dateRange.end}
            mode="date"
            display="default"
            onChange={(event, date) => handleDateChange(event, date, false)}
            maximumDate={new Date()}
            minimumDate={dateRange.start}
          />
        )}
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  closeButton: {
    padding: 8,
  },
  content: {
    flex: 1,
  },
  section: {
    backgroundColor: '#FFFFFF',
    margin: 16,
    borderRadius: 8,
    padding: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 16,
  },
  reportTypeCard: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
  },
  selectedReportType: {
    borderColor: '#4CAF50',
    backgroundColor: '#F1F8E9',
  },
  reportTypeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  reportTypeTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginLeft: 12,
    flex: 1,
  },
  reportTypeDescription: {
    fontSize: 14,
    color: '#666',
    marginLeft: 36,
  },
  predefinedRanges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 20,
  },
  predefinedRangeButton: {
    backgroundColor: '#E3F2FD',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    marginRight: 8,
    marginBottom: 8,
  },
  predefinedRangeText: {
    fontSize: 14,
    color: '#1976D2',
    fontWeight: '500',
  },
  customDateRange: {
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
    paddingTop: 16,
  },
  customDateTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  dateRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  dateInput: {
    flex: 1,
    marginHorizontal: 4,
  },
  dateLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  dateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    padding: 12,
  },
  dateButtonText: {
    fontSize: 14,
    color: '#333',
  },
  reportHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  shareButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E3F2FD',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  shareButtonText: {
    color: '#2196F3',
    fontSize: 14,
    fontWeight: '500',
    marginLeft: 4,
  },
  reportSummary: {
    backgroundColor: '#F8F9FA',
    borderRadius: 8,
    padding: 16,
  },
  reportTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  reportDescription: {
    fontSize: 14,
    color: '#666',
    marginBottom: 12,
  },
  reportMeta: {
    marginBottom: 16,
  },
  reportMetaText: {
    fontSize: 12,
    color: '#666',
    marginBottom: 2,
  },
  summaryData: {
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
    paddingTop: 16,
  },
  summaryTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  summaryKey: {
    fontSize: 14,
    color: '#666',
  },
  summaryValue: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
  },
  footer: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
  },
  generateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2196F3',
    paddingVertical: 14,
    borderRadius: 8,
  },
  disabledButton: {
    backgroundColor: '#CCCCCC',
  },
  generateButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
});

export default ReportGenerator;