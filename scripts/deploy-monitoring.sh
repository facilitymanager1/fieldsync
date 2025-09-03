#!/bin/bash

# FieldSync Monitoring Stack Deployment Script
# This script deploys the complete monitoring infrastructure including
# Prometheus, Grafana, AlertManager, and the ELK Stack

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
NAMESPACE="fieldsync"
KUBECTL_TIMEOUT="300s"

echo -e "${BLUE}🚀 Starting FieldSync Monitoring Stack Deployment${NC}"

# Function to print colored output
print_status() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

# Check prerequisites
check_prerequisites() {
    print_info "Checking prerequisites..."
    
    if ! command -v kubectl &> /dev/null; then
        print_error "kubectl is not installed or not in PATH"
        exit 1
    fi
    
    if ! command -v helm &> /dev/null; then
        print_warning "helm is not installed - some optional features may not work"
    fi
    
    # Check if we can connect to cluster
    if ! kubectl cluster-info &> /dev/null; then
        print_error "Cannot connect to Kubernetes cluster"
        exit 1
    fi
    
    print_status "Prerequisites check completed"
}

# Create namespace
create_namespace() {
    print_info "Creating namespace: $NAMESPACE"
    
    kubectl create namespace $NAMESPACE --dry-run=client -o yaml | kubectl apply -f -
    
    print_status "Namespace $NAMESPACE ready"
}

# Deploy monitoring stack
deploy_monitoring_stack() {
    print_info "Deploying Prometheus monitoring stack..."
    
    # Deploy Prometheus stack
    kubectl apply -f ../k8s/prometheus-stack.yaml -n $NAMESPACE
    
    print_status "Prometheus stack deployed"
    
    # Wait for Prometheus to be ready
    print_info "Waiting for Prometheus to be ready..."
    kubectl wait --for=condition=available --timeout=$KUBECTL_TIMEOUT deployment/prometheus -n $NAMESPACE
    
    print_status "Prometheus is ready"
    
    # Wait for Grafana to be ready
    print_info "Waiting for Grafana to be ready..."
    kubectl wait --for=condition=available --timeout=$KUBECTL_TIMEOUT deployment/grafana -n $NAMESPACE
    
    print_status "Grafana is ready"
    
    # Wait for AlertManager to be ready
    print_info "Waiting for AlertManager to be ready..."
    kubectl wait --for=condition=available --timeout=$KUBECTL_TIMEOUT deployment/alertmanager -n $NAMESPACE
    
    print_status "AlertManager is ready"
}

# Deploy logging stack
deploy_logging_stack() {
    print_info "Deploying ELK logging stack..."
    
    # Deploy ELK stack
    kubectl apply -f ../k8s/logging-stack.yaml -n $NAMESPACE
    
    print_status "ELK stack deployed"
    
    # Wait for Elasticsearch to be ready
    print_info "Waiting for Elasticsearch to be ready..."
    kubectl wait --for=condition=ready --timeout=$KUBECTL_TIMEOUT pod -l component=elasticsearch -n $NAMESPACE
    
    print_status "Elasticsearch is ready"
    
    # Wait for Logstash to be ready
    print_info "Waiting for Logstash to be ready..."
    kubectl wait --for=condition=available --timeout=$KUBECTL_TIMEOUT deployment/logstash -n $NAMESPACE
    
    print_status "Logstash is ready"
    
    # Wait for Kibana to be ready
    print_info "Waiting for Kibana to be ready..."
    kubectl wait --for=condition=available --timeout=$KUBECTL_TIMEOUT deployment/kibana -n $NAMESPACE
    
    print_status "Kibana is ready"
}

# Setup port forwarding for access
setup_port_forwarding() {
    print_info "Setting up port forwarding for local access..."
    
    # Create a script for easy port forwarding
    cat > monitoring-access.sh << 'EOF'
#!/bin/bash

# FieldSync Monitoring Access Script
# Run this script to access monitoring services locally

echo "Setting up port forwarding for FieldSync monitoring services..."
echo "Access URLs:"
echo "  Grafana: http://localhost:3000 (admin/admin123)"
echo "  Prometheus: http://localhost:9090"
echo "  AlertManager: http://localhost:9093"
echo "  Kibana: http://localhost:5601"
echo ""
echo "Press Ctrl+C to stop all port forwards"

# Start port forwarding in background
kubectl port-forward -n fieldsync svc/grafana 3000:3000 &
GRAFANA_PID=$!

kubectl port-forward -n fieldsync svc/prometheus 9090:9090 &
PROMETHEUS_PID=$!

kubectl port-forward -n fieldsync svc/alertmanager 9093:9093 &
ALERTMANAGER_PID=$!

kubectl port-forward -n fieldsync svc/kibana 5601:5601 &
KIBANA_PID=$!

# Function to cleanup on exit
cleanup() {
    echo ""
    echo "Cleaning up port forwards..."
    kill $GRAFANA_PID $PROMETHEUS_PID $ALERTMANAGER_PID $KIBANA_PID 2>/dev/null
    exit 0
}

# Trap Ctrl+C
trap cleanup SIGINT

# Wait for processes
wait
EOF
    
    chmod +x monitoring-access.sh
    
    print_status "Port forwarding script created: ./monitoring-access.sh"
}

# Verify deployment
verify_deployment() {
    print_info "Verifying deployment..."
    
    # Check all pods are running
    echo "Checking pod status:"
    kubectl get pods -n $NAMESPACE
    
    echo ""
    echo "Checking services:"
    kubectl get services -n $NAMESPACE
    
    echo ""
    echo "Checking persistent volumes:"
    kubectl get pvc -n $NAMESPACE
    
    # Test Prometheus metrics endpoint
    print_info "Testing Prometheus metrics..."
    if kubectl exec -n $NAMESPACE deployment/prometheus -- wget -qO- http://localhost:9090/-/ready > /dev/null; then
        print_status "Prometheus is responding"
    else
        print_warning "Prometheus may not be fully ready yet"
    fi
    
    # Test Grafana
    print_info "Testing Grafana..."
    if kubectl exec -n $NAMESPACE deployment/grafana -- wget -qO- http://localhost:3000/api/health > /dev/null; then
        print_status "Grafana is responding"
    else
        print_warning "Grafana may not be fully ready yet"
    fi
    
    print_status "Deployment verification completed"
}

# Generate monitoring configuration summary
generate_summary() {
    print_info "Generating monitoring configuration summary..."
    
    cat > MONITORING_DEPLOYMENT_SUMMARY.md << EOF
# FieldSync Monitoring Stack Deployment Summary

## Deployed Components

### Prometheus Stack
- **Prometheus Server**: http://localhost:9090 (via port-forward)
  - Metrics collection and alerting
  - 30-day retention policy
  - Custom FieldSync metrics collection

- **Grafana Dashboard**: http://localhost:3000 (admin/admin123)
  - Pre-configured dashboards for FieldSync API monitoring
  - Real-time metrics visualization
  - Alert management interface

- **AlertManager**: http://localhost:9093
  - Alert routing and notification management
  - Email, Slack, and PagerDuty integration configured
  - Critical alerts for system health

### ELK Stack (Logging)
- **Elasticsearch**: Centralized log storage and indexing
- **Logstash**: Log processing and enrichment
- **Kibana**: http://localhost:5601 (via port-forward)
  - Log analysis and visualization
  - Real-time log streaming
- **Filebeat/FluentBit**: Log collection from containers

## Key Metrics Being Monitored

### Application Metrics
- HTTP request rate and response times
- Error rates and status code distribution
- Memory and CPU usage
- Database connection pool status
- Redis cache hit/miss rates

### Business Metrics
- User authentication events
- Ticket operations (create, update, close)
- Shift management operations
- Location tracking events

### Security Metrics
- Failed login attempts
- Rate limiting events
- Unauthorized access attempts
- Security policy violations

### System Metrics
- Node-level CPU, memory, disk usage
- Network I/O statistics
- Kubernetes cluster health
- Container resource utilization

## Alert Rules Configured

1. **High Error Rate**: >5% error rate for 2 minutes
2. **High Response Time**: 95th percentile >2 seconds for 5 minutes
3. **High Memory Usage**: >80% heap utilization for 5 minutes
4. **Database Issues**: Connection pool >90% utilized
5. **Security Events**: >50 failed logins in 10 minutes
6. **System Resources**: CPU >80%, Memory >90%, Disk <10% free

## Access Instructions

1. Run the port forwarding script:
   \`\`\`bash
   ./monitoring-access.sh
   \`\`\`

2. Access the services:
   - **Grafana**: http://localhost:3000 (admin/admin123)
   - **Prometheus**: http://localhost:9090
   - **Kibana**: http://localhost:5601
   - **AlertManager**: http://localhost:9093

## Configuration Files

- Prometheus: \`k8s/prometheus-stack.yaml\`
- ELK Stack: \`k8s/logging-stack.yaml\`
- Application metrics: \`backend/services/metricsService.ts\`
- Metrics middleware: \`backend/middleware/metricsMiddleware.ts\`

## Production Considerations

1. **Security**: Change default Grafana password
2. **Storage**: Configure appropriate retention policies
3. **Backup**: Set up regular backups for metrics data
4. **Scaling**: Configure horizontal scaling for high-load environments
5. **Alerting**: Configure proper notification channels (email, Slack, PagerDuty)

## Maintenance Commands

- View logs: \`kubectl logs -f deployment/prometheus -n fieldsync\`
- Check metrics: \`kubectl exec -it deployment/prometheus -n fieldsync -- promtool query instant 'up'\`
- Restart service: \`kubectl rollout restart deployment/grafana -n fieldsync\`
- Update config: \`kubectl apply -f k8s/prometheus-stack.yaml -n fieldsync\`

EOF
    
    print_status "Monitoring summary generated: MONITORING_DEPLOYMENT_SUMMARY.md"
}

# Main deployment function
main() {
    echo -e "${BLUE}============================================${NC}"
    echo -e "${BLUE}  FieldSync Monitoring Stack Deployment   ${NC}"
    echo -e "${BLUE}============================================${NC}"
    echo ""
    
    check_prerequisites
    create_namespace
    deploy_monitoring_stack
    deploy_logging_stack
    setup_port_forwarding
    verify_deployment
    generate_summary
    
    echo ""
    echo -e "${GREEN}============================================${NC}"
    echo -e "${GREEN}     Monitoring Stack Deployment Complete  ${NC}"
    echo -e "${GREEN}============================================${NC}"
    echo ""
    echo -e "${BLUE}Next Steps:${NC}"
    echo -e "1. Run ${YELLOW}./monitoring-access.sh${NC} to access services locally"
    echo -e "2. Login to Grafana at ${YELLOW}http://localhost:3000${NC} (admin/admin123)"
    echo -e "3. Configure alert notification channels in AlertManager"
    echo -e "4. Review the monitoring summary: ${YELLOW}MONITORING_DEPLOYMENT_SUMMARY.md${NC}"
    echo -e "5. Update your application to use the metrics endpoints"
    echo ""
    echo -e "${GREEN}✅ Monitoring stack is ready for production use!${NC}"
}

# Handle script arguments
case "${1:-deploy}" in
    "deploy")
        main
        ;;
    "status")
        kubectl get all -n $NAMESPACE
        ;;
    "logs")
        component=${2:-prometheus}
        kubectl logs -f deployment/$component -n $NAMESPACE
        ;;
    "cleanup")
        print_warning "This will delete the entire monitoring stack!"
        read -p "Are you sure? (y/N): " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            kubectl delete -f ../k8s/prometheus-stack.yaml -n $NAMESPACE
            kubectl delete -f ../k8s/logging-stack.yaml -n $NAMESPACE
            print_status "Monitoring stack cleaned up"
        fi
        ;;
    "help")
        echo "Usage: $0 [deploy|status|logs|cleanup|help]"
        echo ""
        echo "Commands:"
        echo "  deploy  - Deploy the complete monitoring stack (default)"
        echo "  status  - Show deployment status"
        echo "  logs    - Show logs for a component (usage: $0 logs prometheus)"
        echo "  cleanup - Remove the monitoring stack"
        echo "  help    - Show this help message"
        ;;
    *)
        print_error "Unknown command: $1"
        echo "Run '$0 help' for usage information"
        exit 1
        ;;
esac