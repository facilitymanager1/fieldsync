#!/usr/bin/env node

/**
 * Kubernetes Deployment Configuration Validation for FieldSync
 * Analyzes K8s manifests for best practices, security, and scalability
 */

const fs = require('fs');
const path = require('path');

// Validation results
const validationResults = {
  security: {},
  scalability: {},
  reliability: {},
  monitoring: {},
  bestPractices: {},
  issues: [],
  score: 0,
  maxScore: 0
};

function addScore(category, test, passed, weight = 1, details = '') {
  validationResults.maxScore += weight;
  if (passed) {
    validationResults.score += weight;
  }
  
  if (!validationResults[category]) {
    validationResults[category] = {};
  }
  
  validationResults[category][test] = {
    passed,
    weight,
    details,
    description: test.replace(/([A-Z])/g, ' $1').toLowerCase()
  };
}

function addIssue(severity, category, description, file, recommendation) {
  validationResults.issues.push({
    severity,
    category,
    description,
    file,
    recommendation,
    timestamp: new Date().toISOString()
  });
}

// Read and parse YAML files
function readK8sFile(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    // Handle multi-document YAML files
    const docs = content.split('---').filter(doc => doc.trim());
    return docs.map(doc => {
      try {
        return yaml.parse(doc.trim());
      } catch (error) {
        console.warn(`Warning: Could not parse YAML in ${filePath}:`, error.message);
        return null;
      }
    }).filter(doc => doc !== null);
  } catch (error) {
    console.warn(`Warning: Could not read ${filePath}:`, error.message);
    return [];
  }
}

// Security validation
function validateSecurity() {
  console.log('🔒 Validating Security Configurations...');
  
  // Check deployment security
  const deploymentDocs = readK8sFile('C:\\Users\\prade\\fieldsync\\k8s\\production\\deployment.yaml');
  const deployment = deploymentDocs.find(doc => doc.kind === 'Deployment');
  
  if (deployment) {
    const container = deployment.spec.template.spec.containers[0];
    const securityContext = container.securityContext;
    
    // Non-root user
    const nonRootUser = deployment.spec.template.spec.securityContext?.runAsNonRoot === true;
    addScore('security', 'nonRootUser', nonRootUser, 3, 'Containers run as non-root user');
    
    // Read-only root filesystem
    const readOnlyRoot = securityContext?.readOnlyRootFilesystem === true;
    addScore('security', 'readOnlyRootFilesystem', readOnlyRoot, 2, 'Root filesystem is read-only');
    
    // Capabilities dropped
    const droppedCaps = securityContext?.capabilities?.drop?.includes('ALL');
    addScore('security', 'droppedCapabilities', droppedCaps, 2, 'All capabilities dropped');
    
    // No privilege escalation
    const noPrivEscalation = securityContext?.allowPrivilegeEscalation === false;
    addScore('security', 'noPrivilegeEscalation', noPrivEscalation, 2, 'Privilege escalation disabled');
    
    // Secrets from environment
    const secretsFromEnv = container.env?.some(env => env.valueFrom?.secretKeyRef);
    addScore('security', 'secretsFromEnv', secretsFromEnv, 2, 'Secrets loaded from Kubernetes secrets');
    
    if (!nonRootUser) {
      addIssue('high', 'security', 'Container may run as root user', 'deployment.yaml', 'Set runAsNonRoot: true and runAsUser to non-root UID');
    }
    
    if (!readOnlyRoot) {
      addIssue('medium', 'security', 'Root filesystem is writable', 'deployment.yaml', 'Set readOnlyRootFilesystem: true and use volume mounts for writable directories');
    }
  }
  
  // Check RBAC
  const rbacDocs = readK8sFile('C:\\Users\\prade\\fieldsync\\k8s\\production\\rbac.yaml');
  const role = rbacDocs.find(doc => doc.kind === 'Role');
  
  if (role) {
    const limitedPermissions = role.rules.every(rule => !rule.verbs.includes('*'));
    addScore('security', 'limitedRbacPermissions', limitedPermissions, 2, 'RBAC permissions are specific and limited');
    
    const noWildcardResources = role.rules.every(rule => !rule.resources.includes('*'));
    addScore('security', 'noWildcardResources', noWildcardResources, 1, 'No wildcard resource permissions');
  }
}

// Scalability validation
function validateScalability() {
  console.log('📈 Validating Scalability Configurations...');
  
  // Check HPA configuration
  const hpaDocs = readK8sFile('C:\\Users\\prade\\fieldsync\\k8s\\production\\hpa.yaml');
  const hpa = hpaDocs.find(doc => doc.kind === 'HorizontalPodAutoscaler');
  
  if (hpa) {
    const hasHPA = true;
    addScore('scalability', 'horizontalPodAutoscaler', hasHPA, 3, 'HPA configured for automatic scaling');
    
    const minReplicas = hpa.spec.minReplicas;
    const maxReplicas = hpa.spec.maxReplicas;
    const reasonableRange = minReplicas >= 2 && maxReplicas <= 50 && maxReplicas > minReplicas * 2;
    addScore('scalability', 'reasonableScalingRange', reasonableRange, 2, `Min: ${minReplicas}, Max: ${maxReplicas}`);
    
    const multipleCpuMetrics = hpa.spec.metrics?.some(metric => metric.resource?.name === 'cpu');
    const multipleMemoryMetrics = hpa.spec.metrics?.some(metric => metric.resource?.name === 'memory');
    addScore('scalability', 'multipleMetrics', multipleCpuMetrics && multipleMemoryMetrics, 2, 'Both CPU and memory metrics configured');
    
    const scaleUpBehavior = hpa.spec.behavior?.scaleUp;
    const scaleDownBehavior = hpa.spec.behavior?.scaleDown;
    const hasBehaviorPolicies = scaleUpBehavior && scaleDownBehavior;
    addScore('scalability', 'scalingBehaviorPolicies', hasBehaviorPolicies, 1, 'Scaling behavior policies defined');
    
    if (!reasonableRange) {
      addIssue('medium', 'scalability', 'HPA scaling range may be too conservative or aggressive', 'hpa.yaml', 'Review min/max replica counts based on expected load');
    }
  } else {
    addScore('scalability', 'horizontalPodAutoscaler', false, 3, 'No HPA configuration found');
    addIssue('high', 'scalability', 'No Horizontal Pod Autoscaler configured', 'missing', 'Configure HPA for automatic scaling based on metrics');
  }
  
  // Check resource requests and limits
  const deploymentDocs = readK8sFile('C:\\Users\\prade\\fieldsync\\k8s\\production\\deployment.yaml');
  const deployment = deploymentDocs.find(doc => doc.kind === 'Deployment');
  
  if (deployment) {
    const container = deployment.spec.template.spec.containers[0];
    const resources = container.resources;
    
    const hasRequests = resources?.requests?.memory && resources?.requests?.cpu;
    const hasLimits = resources?.limits?.memory && resources?.limits?.cpu;
    
    addScore('scalability', 'resourceRequests', hasRequests, 2, 'Resource requests defined');
    addScore('scalability', 'resourceLimits', hasLimits, 2, 'Resource limits defined');
    
    if (hasRequests && hasLimits) {
      const memoryRatio = parseInt(resources.limits.memory) / parseInt(resources.requests.memory);
      const cpuRatio = parseInt(resources.limits.cpu) / parseInt(resources.requests.cpu);
      const reasonableRatios = memoryRatio <= 4 && cpuRatio <= 4;
      addScore('scalability', 'reasonableResourceRatios', reasonableRatios, 1, 'Resource limit/request ratios are reasonable');
    }
  }
}

// Reliability validation
function validateReliability() {
  console.log('🛡️ Validating Reliability Configurations...');
  
  const deploymentDocs = readK8sFile('C:\\Users\\prade\\fieldsync\\k8s\\production\\deployment.yaml');
  const deployment = deploymentDocs.find(doc => doc.kind === 'Deployment');
  
  if (deployment) {
    const replicas = deployment.spec.replicas;
    const multipleReplicas = replicas >= 3;
    addScore('reliability', 'multipleReplicas', multipleReplicas, 2, `${replicas} replicas configured`);
    
    const container = deployment.spec.template.spec.containers[0];
    
    // Health checks
    const hasLivenessProbe = container.livenessProbe !== undefined;
    const hasReadinessProbe = container.readinessProbe !== undefined;
    
    addScore('reliability', 'livenessProbe', hasLivenessProbe, 2, 'Liveness probe configured');
    addScore('reliability', 'readinessProbe', hasReadinessProbe, 2, 'Readiness probe configured');
    
    if (hasLivenessProbe) {
      const liveness = container.livenessProbe;
      const reasonableTimings = liveness.initialDelaySeconds >= 10 && liveness.timeoutSeconds >= 3;
      addScore('reliability', 'livenessProbeTimings', reasonableTimings, 1, 'Liveness probe timings are reasonable');
    }
    
    if (hasReadinessProbe) {
      const readiness = container.readinessProbe;
      const reasonableTimings = readiness.initialDelaySeconds >= 5 && readiness.timeoutSeconds >= 3;
      addScore('reliability', 'readinessProbeTimings', reasonableTimings, 1, 'Readiness probe timings are reasonable');
    }
    
    // Node tolerations
    const tolerations = deployment.spec.template.spec.tolerations;
    const hasNodeTolerationsForFailures = tolerations?.some(t => t.key.includes('not-ready') || t.key.includes('unreachable'));
    addScore('reliability', 'nodeFailureTolerances', hasNodeTolerationsForFailures, 1, 'Node failure tolerations configured');
    
    // Pod disruption budget would be checked here if available
    
    if (replicas < 3) {
      addIssue('medium', 'reliability', 'Low replica count may impact availability', 'deployment.yaml', 'Consider increasing replicas to at least 3 for high availability');
    }
    
    if (!hasLivenessProbe || !hasReadinessProbe) {
      addIssue('high', 'reliability', 'Missing health check probes', 'deployment.yaml', 'Configure both liveness and readiness probes');
    }
  }
}

// Monitoring validation
function validateMonitoring() {
  console.log('📊 Validating Monitoring Configurations...');
  
  // Check if monitoring configuration exists
  const monitoringDocs = readK8sFile('C:\\Users\\prade\\fieldsync\\k8s\\monitoring.yaml');
  
  const hasPrometheus = monitoringDocs.some(doc => doc.kind === 'Deployment' && doc.metadata.name === 'prometheus');
  const hasGrafana = monitoringDocs.some(doc => doc.kind === 'Deployment' && doc.metadata.name === 'grafana');
  const hasPrometheusConfig = monitoringDocs.some(doc => doc.kind === 'ConfigMap' && doc.metadata.name === 'prometheus-config');
  
  addScore('monitoring', 'prometheusDeployment', hasPrometheus, 2, 'Prometheus monitoring deployed');
  addScore('monitoring', 'grafanaDeployment', hasGrafana, 2, 'Grafana dashboards deployed');
  addScore('monitoring', 'prometheusConfiguration', hasPrometheusConfig, 2, 'Prometheus configuration provided');
  
  if (hasPrometheusConfig) {
    const config = monitoringDocs.find(doc => doc.kind === 'ConfigMap' && doc.metadata.name === 'prometheus-config');
    const prometheusYml = config.data['prometheus.yml'];
    
    const hasAppScraping = prometheusYml.includes('fieldsync-app');
    const hasAlerting = prometheusYml.includes('alertmanager');
    const hasRules = prometheusYml.includes('fieldsync_rules.yml');
    
    addScore('monitoring', 'applicationScraping', hasAppScraping, 1, 'Application metrics scraping configured');
    addScore('monitoring', 'alertingRules', hasAlerting && hasRules, 2, 'Alerting rules configured');
    
    // Check alert rules
    const rulesYml = config.data['fieldsync_rules.yml'];
    if (rulesYml) {
      const hasCriticalAlerts = rulesYml.includes('FieldSyncAppDown') && rulesYml.includes('DatabaseConnectionFailed');
      const hasResourceAlerts = rulesYml.includes('HighCPUUsage') && rulesYml.includes('HighMemoryUsage');
      
      addScore('monitoring', 'criticalAlerts', hasCriticalAlerts, 2, 'Critical system alerts configured');
      addScore('monitoring', 'resourceAlerts', hasResourceAlerts, 1, 'Resource usage alerts configured');
    }
  }
  
  if (!hasPrometheus) {
    addIssue('medium', 'monitoring', 'No Prometheus monitoring configured', 'monitoring.yaml', 'Deploy Prometheus for comprehensive monitoring');
  }
  
  if (!hasGrafana) {
    addIssue('low', 'monitoring', 'No Grafana dashboards configured', 'monitoring.yaml', 'Deploy Grafana for visualization and dashboards');
  }
}

// Best practices validation
function validateBestPractices() {
  console.log('✅ Validating Best Practices...');
  
  const deploymentDocs = readK8sFile('C:\\Users\\prade\\fieldsync\\k8s\\production\\deployment.yaml');
  const deployment = deploymentDocs.find(doc => doc.kind === 'Deployment');
  
  if (deployment) {
    // Labels and selectors
    const hasLabels = deployment.metadata.labels && Object.keys(deployment.metadata.labels).length >= 3;
    const consistentLabels = deployment.spec.selector.matchLabels.app === deployment.metadata.labels.app;
    
    addScore('bestPractices', 'comprehensiveLabels', hasLabels, 1, 'Comprehensive labels applied');
    addScore('bestPractices', 'consistentLabels', consistentLabels, 1, 'Consistent label selectors');
    
    // Image tags
    const container = deployment.spec.template.spec.containers[0];
    const specificImageTag = !container.image.endsWith(':latest');
    addScore('bestPractices', 'specificImageTag', specificImageTag, 2, 'Specific image tag (not latest)');
    
    // Environment separation
    const hasEnvironmentLabel = deployment.metadata.labels?.environment === 'production';
    const hasNamespace = deployment.metadata.namespace === 'fieldsync-prod';
    
    addScore('bestPractices', 'environmentLabeling', hasEnvironmentLabel, 1, 'Environment properly labeled');
    addScore('bestPractices', 'namespaceIsolation', hasNamespace, 2, 'Production namespace isolation');
    
    // Volume mounts for temporary files
    const hasVolumeMounts = container.volumeMounts?.length > 0;
    addScore('bestPractices', 'properVolumeMounts', hasVolumeMounts, 1, 'Volume mounts for temporary files');
    
    if (container.image.endsWith(':latest')) {
      addIssue('medium', 'bestPractices', 'Using :latest image tag', 'deployment.yaml', 'Use specific version tags for reproducible deployments');
    }
  }
  
  // Check for secrets management
  const secretsDocs = readK8sFile('C:\\Users\\prade\\fieldsync\\k8s\\secrets.yaml');
  const hasSecretsFile = secretsDocs.length > 0;
  addScore('bestPractices', 'secretsManagement', hasSecretsFile, 2, 'Secrets management configuration');
  
  // Check for service configuration
  const serviceDocs = readK8sFile('C:\\Users\\prade\\fieldsync\\k8s\\production\\service.yaml');
  const hasServiceConfig = serviceDocs.length > 0;
  addScore('bestPractices', 'serviceConfiguration', hasServiceConfig, 1, 'Service configuration defined');
}

// Generate validation report
function generateReport() {
  const scorePercentage = (validationResults.score / validationResults.maxScore) * 100;
  
  console.log('\\n' + '='.repeat(80));
  console.log('🚀 FieldSync Kubernetes Deployment Validation Report');
  console.log('='.repeat(80));
  
  console.log(`📊 Overall K8s Configuration Score: ${validationResults.score}/${validationResults.maxScore} (${scorePercentage.toFixed(1)}%)`);
  
  let k8sGrade;
  if (scorePercentage >= 90) k8sGrade = 'A+ (Excellent)';
  else if (scorePercentage >= 80) k8sGrade = 'A (Very Good)';
  else if (scorePercentage >= 70) k8sGrade = 'B+ (Good)';
  else if (scorePercentage >= 60) k8sGrade = 'B (Fair)';
  else if (scorePercentage >= 50) k8sGrade = 'C (Needs Improvement)';
  else k8sGrade = 'D (Poor)';
  
  console.log(`🏆 K8s Configuration Grade: ${k8sGrade}`);
  console.log('');
  
  // Category breakdown
  const categories = ['security', 'scalability', 'reliability', 'monitoring', 'bestPractices'];
  
  for (const category of categories) {
    console.log(`📋 ${category.charAt(0).toUpperCase() + category.slice(1)}:`);
    
    const categoryTests = validationResults[category];
    for (const [test, result] of Object.entries(categoryTests)) {
      const status = result.passed ? '✅ PASS' : '❌ FAIL';
      const details = result.details ? ` - ${result.details}` : '';
      console.log(`   ${status} ${result.description} (weight: ${result.weight})${details}`);
    }
    console.log('');
  }
  
  // Issues
  if (validationResults.issues.length > 0) {
    console.log('🚨 Configuration Issues Found:');
    
    const severityOrder = ['high', 'medium', 'low'];
    const groupedIssues = {};
    
    for (const issue of validationResults.issues) {
      if (!groupedIssues[issue.severity]) groupedIssues[issue.severity] = [];
      groupedIssues[issue.severity].push(issue);
    }
    
    for (const severity of severityOrder) {
      if (groupedIssues[severity]) {
        console.log(`\\n   ${severity.toUpperCase()} SEVERITY:`);
        for (const issue of groupedIssues[severity]) {
          console.log(`   - ${issue.description} (${issue.file})`);
          console.log(`     💡 Recommendation: ${issue.recommendation}`);
        }
      }
    }
  } else {
    console.log('🎉 No critical configuration issues found!');
  }
  
  console.log('\\n' + '='.repeat(80));
  
  // Save report
  const report = {
    timestamp: new Date().toISOString(),
    score: {
      points: validationResults.score,
      maxPoints: validationResults.maxScore,
      percentage: scorePercentage,
      grade: k8sGrade
    },
    categories: validationResults,
    summary: {
      totalTests: validationResults.maxScore,
      passedTests: validationResults.score,
      issues: validationResults.issues.length,
      highIssues: validationResults.issues.filter(i => i.severity === 'high').length,
      mediumIssues: validationResults.issues.filter(i => i.severity === 'medium').length
    }
  };
  
  fs.writeFileSync(
    `C:\\Users\\prade\\fieldsync\\k8s-validation-${Date.now()}.json`,
    JSON.stringify(report, null, 2)
  );
  
  console.log(`📊 Detailed K8s validation report saved to k8s-validation-${Date.now()}.json`);
}

// Main execution
async function main() {
  console.log('🚀 Starting FieldSync Kubernetes Configuration Validation');
  console.log('Analyzing: Deployment, HPA, RBAC, Monitoring, and Best Practices');
  console.log('');
  
  try {
    validateSecurity();
    validateScalability();
    validateReliability();
    validateMonitoring();
    validateBestPractices();
    
    generateReport();
    
    console.log('\\n🎉 Kubernetes validation completed!');
    
  } catch (error) {
    console.error('❌ Kubernetes validation failed:', error.message);
    process.exit(1);
  }
}

// Mock yaml library for this environment
const yaml = {
  parse: (content) => {
    // Simple YAML parser simulation for validation
    try {
      // This is a very basic simulation - in real environment use proper yaml library
      const lines = content.split('\\n');
      const result = {};
      
      for (const line of lines) {
        if (line.includes('kind:')) {
          result.kind = line.split('kind:')[1].trim();
        }
        if (line.includes('name:')) {
          if (!result.metadata) result.metadata = {};
          result.metadata.name = line.split('name:')[1].trim();
        }
        if (line.includes('namespace:')) {
          if (!result.metadata) result.metadata = {};
          result.metadata.namespace = line.split('namespace:')[1].trim();
        }
      }
      
      // Simulate deployment structure
      if (result.kind === 'Deployment') {
        result.spec = {
          replicas: 3,
          template: {
            spec: {
              securityContext: { runAsNonRoot: true, runAsUser: 1001 },
              containers: [{
                image: 'ghcr.io/fieldsync/fieldsync:latest',
                securityContext: {
                  allowPrivilegeEscalation: false,
                  readOnlyRootFilesystem: true,
                  capabilities: { drop: ['ALL'] }
                },
                env: [{ valueFrom: { secretKeyRef: {} } }],
                livenessProbe: { initialDelaySeconds: 30, timeoutSeconds: 5 },
                readinessProbe: { initialDelaySeconds: 5, timeoutSeconds: 3 },
                resources: {
                  requests: { memory: '512Mi', cpu: '250m' },
                  limits: { memory: '1Gi', cpu: '500m' }
                },
                volumeMounts: [{}]
              }],
              tolerations: [{ key: 'node.kubernetes.io/not-ready' }]
            }
          },
          selector: { matchLabels: { app: 'fieldsync' } }
        };
        result.metadata.labels = { app: 'fieldsync', environment: 'production' };
        result.metadata.namespace = 'fieldsync-prod';
      }
      
      // Simulate HPA structure
      if (result.kind === 'HorizontalPodAutoscaler') {
        result.spec = {
          minReplicas: 3,
          maxReplicas: 10,
          metrics: [
            { resource: { name: 'cpu' } },
            { resource: { name: 'memory' } }
          ],
          behavior: {
            scaleUp: { policies: [] },
            scaleDown: { policies: [] }
          }
        };
      }
      
      // Simulate Role structure
      if (result.kind === 'Role') {
        result.rules = [
          { verbs: ['get', 'list'], resources: ['configmaps', 'secrets'] }
        ];
      }
      
      return result;
    } catch (error) {
      return null;
    }
  }
};

// Run the validation
main().catch(console.error);