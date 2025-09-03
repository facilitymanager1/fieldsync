import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  ScrollView,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import {
  FormValidationResults,
  ValidationSummary as ValidationSummaryType,
  ValidationSeverity,
  FieldValidationResult,
} from '../types/validation';

interface ValidationSummaryProps {
  validationResults: FormValidationResults;
  showDetails?: boolean;
  onToggleDetails?: () => void;
  onFieldPress?: (fieldName: string) => void;
  style?: any;
  collapsible?: boolean;
  showProgressBar?: boolean;
  showFieldList?: boolean;
}

const ValidationSummary: React.FC<ValidationSummaryProps> = ({
  validationResults,
  showDetails = false,
  onToggleDetails,
  onFieldPress,
  style,
  collapsible = true,
  showProgressBar = true,
  showFieldList = true,
}) => {
  const { summary, fieldResults, crossFieldErrors, businessRuleResults } = validationResults;

  const getStatusColor = () => {
    if (summary.totalErrors > 0) return '#F44336';
    if (summary.totalWarnings > 0) return '#FF9800';
    if (summary.completionPercentage === 100) return '#4CAF50';
    return '#2196F3';
  };

  const getStatusIcon = () => {
    if (summary.totalErrors > 0) return 'error';
    if (summary.totalWarnings > 0) return 'warning';
    if (summary.completionPercentage === 100) return 'check-circle';
    return 'info';
  };

  const getStatusText = () => {
    if (summary.totalErrors > 0) {
      return `${summary.totalErrors} error${summary.totalErrors > 1 ? 's' : ''} found`;
    }
    if (summary.totalWarnings > 0) {
      return `${summary.totalWarnings} warning${summary.totalWarnings > 1 ? 's' : ''} found`;
    }
    if (summary.completionPercentage === 100) {
      return 'All validations passed';
    }
    return `${Math.round(summary.completionPercentage)}% complete`;
  };

  const renderProgressBar = () => {
    if (!showProgressBar) return null;

    const progressWidth = `${summary.completionPercentage}%`;
    const progressColor = getStatusColor();

    return (
      <View style={styles.progressContainer}>
        <View style={styles.progressBackground}>
          <Animated.View
            style={[
              styles.progressBar,
              {
                width: progressWidth,
                backgroundColor: progressColor,
              },
            ]}
          />
        </View>
        <Text style={styles.progressText}>
          {Math.round(summary.completionPercentage)}%
        </Text>
      </View>
    );
  };

  const renderSummaryStats = () => {
    return (
      <View style={styles.statsContainer}>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{summary.totalFields}</Text>
          <Text style={styles.statLabel}>Total Fields</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={[styles.statValue, { color: '#4CAF50' }]}>
            {summary.validFields}
          </Text>
          <Text style={styles.statLabel}>Valid</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={[styles.statValue, { color: '#F44336' }]}>
            {summary.fieldsWithErrors}
          </Text>
          <Text style={styles.statLabel}>Errors</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={[styles.statValue, { color: '#FF9800' }]}>
            {summary.fieldsWithWarnings}
          </Text>
          <Text style={styles.statLabel}>Warnings</Text>
        </View>
      </View>
    );
  };

  const renderFieldList = () => {
    if (!showFieldList || !showDetails) return null;

    const fieldsWithIssues = Object.entries(fieldResults).filter(
      ([, result]) => result.errors.length > 0 || result.warnings.length > 0
    );

    if (fieldsWithIssues.length === 0) {
      return (
        <View style={styles.noIssuesContainer}>
          <Icon name="check-circle" size={24} color="#4CAF50" />
          <Text style={styles.noIssuesText}>No validation issues found</Text>
        </View>
      );
    }

    return (
      <View style={styles.fieldListContainer}>
        <Text style={styles.fieldListTitle}>Fields with Issues</Text>
        {fieldsWithIssues.map(([fieldName, result]) => (
          <TouchableOpacity
            key={fieldName}
            style={styles.fieldItem}
            onPress={() => onFieldPress?.(fieldName)}
          >
            <View style={styles.fieldHeader}>
              <Icon
                name={result.errors.length > 0 ? 'error' : 'warning'}
                size={20}
                color={result.errors.length > 0 ? '#F44336' : '#FF9800'}
              />
              <Text style={styles.fieldName}>{fieldName}</Text>
              <Icon name="chevron-right" size={16} color="#666" />
            </View>
            
            {result.errors.map((error, index) => (
              <Text key={`error-${index}`} style={styles.errorMessage}>
                • {error.message}
              </Text>
            ))}
            
            {result.warnings.map((warning, index) => (
              <Text key={`warning-${index}`} style={styles.warningMessage}>
                • {warning.message}
              </Text>
            ))}
          </TouchableOpacity>
        ))}
      </View>
    );
  };

  const renderCrossFieldErrors = () => {
    if (!showDetails || crossFieldErrors.length === 0) return null;

    return (
      <View style={styles.crossFieldContainer}>
        <Text style={styles.crossFieldTitle}>Form-level Issues</Text>
        {crossFieldErrors.map((error, index) => (
          <View key={index} style={styles.crossFieldItem}>
            <Icon
              name={error.severity === ValidationSeverity.WARNING ? 'warning' : 'error'}
              size={20}
              color={error.severity === ValidationSeverity.WARNING ? '#FF9800' : '#F44336'}
            />
            <Text
              style={[
                styles.crossFieldMessage,
                error.severity === ValidationSeverity.WARNING
                  ? styles.warningMessage
                  : styles.errorMessage,
              ]}
            >
              {error.message}
            </Text>
          </View>
        ))}
      </View>
    );
  };

  const renderBusinessRules = () => {
    if (!showDetails || !businessRuleResults.length) return null;

    const triggeredRules = businessRuleResults.filter(rule => rule.triggered);
    if (triggeredRules.length === 0) return null;

    return (
      <View style={styles.businessRulesContainer}>
        <Text style={styles.businessRulesTitle}>Business Rules Applied</Text>
        {triggeredRules.map((rule, index) => (
          <View key={index} style={styles.businessRuleItem}>
            <Icon name="rule" size={20} color="#2196F3" />
            <View style={styles.businessRuleContent}>
              <Text style={styles.businessRuleName}>{rule.ruleName}</Text>
              <Text style={styles.businessRuleAction}>
                Action: {rule.action.replace('_', ' ').toLowerCase()}
              </Text>
              {rule.message && (
                <Text style={styles.businessRuleMessage}>{rule.message}</Text>
              )}
            </View>
          </View>
        ))}
      </View>
    );
  };

  return (
    <View style={[styles.container, style]}>
      {/* Summary Header */}
      <TouchableOpacity
        style={styles.summaryHeader}
        onPress={collapsible ? onToggleDetails : undefined}
        disabled={!collapsible}
      >
        <View style={styles.statusIndicator}>
          <Icon
            name={getStatusIcon()}
            size={24}
            color={getStatusColor()}
          />
          <Text style={[styles.statusText, { color: getStatusColor() }]}>
            {getStatusText()}
          </Text>
        </View>
        
        {collapsible && (
          <Icon
            name={showDetails ? 'expand-less' : 'expand-more'}
            size={24}
            color="#666"
          />
        )}
      </TouchableOpacity>

      {/* Progress Bar */}
      {renderProgressBar()}

      {/* Summary Statistics */}
      {renderSummaryStats()}

      {/* Detailed View */}
      {showDetails && (
        <ScrollView style={styles.detailsContainer} nestedScrollEnabled>
          {renderFieldList()}
          {renderCrossFieldErrors()}
          {renderBusinessRules()}
        </ScrollView>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginVertical: 8,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  summaryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  statusIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  statusText: {
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  progressBackground: {
    flex: 1,
    height: 8,
    backgroundColor: '#e0e0e0',
    borderRadius: 4,
    marginRight: 12,
  },
  progressBar: {
    height: '100%',
    borderRadius: 4,
  },
  progressText: {
    fontSize: 12,
    color: '#666',
    minWidth: 32,
    textAlign: 'right',
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  detailsContainer: {
    maxHeight: 300,
    marginTop: 12,
  },
  noIssuesContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 24,
  },
  noIssuesText: {
    fontSize: 16,
    color: '#4CAF50',
    marginLeft: 8,
    fontWeight: '500',
  },
  fieldListContainer: {
    marginBottom: 16,
  },
  fieldListTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  fieldItem: {
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  },
  fieldHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  fieldName: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
    flex: 1,
    marginLeft: 8,
  },
  errorMessage: {
    fontSize: 12,
    color: '#F44336',
    lineHeight: 16,
    marginLeft: 28,
  },
  warningMessage: {
    fontSize: 12,
    color: '#FF9800',
    lineHeight: 16,
    marginLeft: 28,
  },
  crossFieldContainer: {
    marginBottom: 16,
  },
  crossFieldTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  crossFieldItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#fff3cd',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  },
  crossFieldMessage: {
    fontSize: 12,
    lineHeight: 16,
    marginLeft: 8,
    flex: 1,
  },
  businessRulesContainer: {
    marginBottom: 16,
  },
  businessRulesTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  businessRuleItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#e3f2fd',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  },
  businessRuleContent: {
    flex: 1,
    marginLeft: 8,
  },
  businessRuleName: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
  },
  businessRuleAction: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  businessRuleMessage: {
    fontSize: 12,
    color: '#2196F3',
    marginTop: 4,
  },
});

export default ValidationSummary;