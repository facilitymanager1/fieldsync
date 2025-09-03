#!/bin/bash

# FieldSync Auto-scaling Setup Script
# This script configures comprehensive auto-scaling for the FieldSync application

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
NAMESPACE="fieldsync"
CLOUD_PROVIDER=${CLOUD_PROVIDER:-"aws"}  # aws, gcp, azure
CLUSTER_NAME=${CLUSTER_NAME:-"fieldsync-cluster"}
REGION=${REGION:-"us-east-1"}

# Functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check prerequisites
check_prerequisites() {
    log_info "Checking prerequisites for auto-scaling setup..."
    
    # Check kubectl
    if ! command -v kubectl &> /dev/null; then
        log_error "kubectl is not installed or not in PATH"
        exit 1
    fi
    
    # Check cluster connection
    if ! kubectl cluster-info &> /dev/null; then
        log_error "Cannot connect to Kubernetes cluster"
        exit 1
    fi
    
    # Check if metrics server is installed
    if ! kubectl get deployment metrics-server -n kube-system &> /dev/null; then
        log_warning "Metrics server not found. Installing..."
        install_metrics_server
    fi
    
    log_success "Prerequisites check completed"
}

# Install metrics server
install_metrics_server() {
    log_info "Installing Kubernetes metrics server..."
    
    kubectl apply -f https://github.com/kubernetes-sigs/metrics-server/releases/latest/download/components.yaml
    
    # Wait for metrics server to be ready
    kubectl wait --for=condition=available --timeout=300s deployment/metrics-server -n kube-system
    
    log_success "Metrics server installed successfully"
}

# Install VPA (Vertical Pod Autoscaler)
install_vpa() {
    log_info "Installing Vertical Pod Autoscaler..."
    
    # Clone VPA repository
    if [ ! -d "autoscaler" ]; then
        git clone https://github.com/kubernetes/autoscaler.git
    fi
    
    cd autoscaler/vertical-pod-autoscaler
    ./hack/vpa-install.sh
    cd ../..
    
    log_success "VPA installed successfully"
}

# Setup cluster autoscaler based on cloud provider
setup_cluster_autoscaler() {
    log_info "Setting up cluster autoscaler for $CLOUD_PROVIDER..."
    
    case $CLOUD_PROVIDER in
        "aws")
            setup_aws_cluster_autoscaler
            ;;
        "gcp")
            setup_gcp_cluster_autoscaler
            ;;
        "azure")
            setup_azure_cluster_autoscaler
            ;;
        *)
            log_error "Unsupported cloud provider: $CLOUD_PROVIDER"
            exit 1
            ;;
    esac
}

# AWS Cluster Autoscaler setup
setup_aws_cluster_autoscaler() {
    log_info "Setting up AWS Cluster Autoscaler..."
    
    # Create IAM policy for cluster autoscaler
    cat > cluster-autoscaler-policy.json << EOF
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Action": [
                "autoscaling:DescribeAutoScalingGroups",
                "autoscaling:DescribeAutoScalingInstances",
                "autoscaling:DescribeLaunchConfigurations",
                "autoscaling:DescribeTags",
                "autoscaling:SetDesiredCapacity",
                "autoscaling:TerminateInstanceInAutoScalingGroup",
                "ec2:DescribeLaunchTemplateVersions"
            ],
            "Resource": "*",
            "Effect": "Allow"
        }
    ]
}
EOF

    # Create IAM policy
    aws iam create-policy \
        --policy-name ClusterAutoscalerPolicy \
        --policy-document file://cluster-autoscaler-policy.json || true
    
    # Create service account with IAM role
    eksctl create iamserviceaccount \
        --cluster=$CLUSTER_NAME \
        --namespace=kube-system \
        --name=cluster-autoscaler \
        --attach-policy-arn=arn:aws:iam::$(aws sts get-caller-identity --query Account --output text):policy/ClusterAutoscalerPolicy \
        --override-existing-serviceaccounts \
        --approve
    
    # Update cluster autoscaler deployment for AWS
    sed -i "s/--cloud-provider=aws/--cloud-provider=aws/g" ../k8s/cluster-autoscaler.yaml
    sed -i "s/--node-group-auto-discovery=asg:tag=k8s.io\/cluster-autoscaler\/enabled,k8s.io\/cluster-autoscaler\/fieldsync-cluster/--node-group-auto-discovery=asg:tag=k8s.io\/cluster-autoscaler\/enabled,k8s.io\/cluster-autoscaler\/$CLUSTER_NAME/g" ../k8s/cluster-autoscaler.yaml
    
    # Apply cluster autoscaler
    kubectl apply -f ../k8s/cluster-autoscaler.yaml
    
    log_success "AWS Cluster Autoscaler configured"
}

# GCP Cluster Autoscaler setup
setup_gcp_cluster_autoscaler() {
    log_info "Setting up GCP Cluster Autoscaler..."
    
    # GKE has built-in cluster autoscaler, just need to enable it
    gcloud container clusters update $CLUSTER_NAME \
        --enable-autoscaling \
        --min-nodes=3 \
        --max-nodes=10 \
        --zone=$REGION-a \
        --node-pool=default-pool
    
    log_success "GCP Cluster Autoscaler enabled"
}

# Azure Cluster Autoscaler setup
setup_azure_cluster_autoscaler() {
    log_info "Setting up Azure Cluster Autoscaler..."
    
    # Enable cluster autoscaler on AKS
    az aks update \
        --resource-group fieldsync-infrastructure \
        --name $CLUSTER_NAME \
        --enable-cluster-autoscaler \
        --min-count 3 \
        --max-count 10
    
    log_success "Azure Cluster Autoscaler enabled"
}

# Setup Horizontal Pod Autoscaler
setup_hpa() {
    log_info "Setting up Horizontal Pod Autoscaler..."
    
    # Apply HPA configuration
    kubectl apply -f ../k8s/autoscaling.yaml
    
    # Wait for HPA to be ready
    kubectl wait --for=condition=AbleToScale --timeout=300s hpa/fieldsync-app-advanced-hpa -n $NAMESPACE
    
    log_success "HPA configured successfully"
}

# Setup Pod Disruption Budgets
setup_pdb() {
    log_info "Setting up Pod Disruption Budgets..."
    
    # PDBs are included in autoscaling.yaml
    kubectl get pdb -n $NAMESPACE
    
    log_success "Pod Disruption Budgets configured"
}

# Install custom metrics adapter
install_custom_metrics() {
    log_info "Installing custom metrics adapter..."
    
    case $CLOUD_PROVIDER in
        "aws")
            # Install CloudWatch adapter
            kubectl apply -f https://github.com/aws/aws-cloudwatch-adapter-for-prometheus/releases/latest/download/cloudwatch-adapter.yaml
            ;;
        "gcp")
            # Install Stackdriver adapter
            kubectl apply -f https://raw.githubusercontent.com/GoogleCloudPlatform/k8s-stackdriver/master/custom-metrics-stackdriver-adapter/deploy/production/adapter_new_resource_model.yaml
            ;;
        "azure")
            # Install Azure Monitor adapter
            kubectl apply -f https://raw.githubusercontent.com/Azure/azure-k8s-metrics-adapter/master/deploy/adapter.yaml
            ;;
    esac
    
    log_success "Custom metrics adapter installed"
}

# Setup load balancer auto-scaling
setup_load_balancer_scaling() {
    log_info "Setting up load balancer auto-scaling..."
    
    # Apply load balancer configurations
    case $CLOUD_PROVIDER in
        "aws")
            kubectl apply -f ../k8s/load-balancer-configs/aws-alb.yaml
            ;;
        "gcp")
            kubectl apply -f ../k8s/load-balancer-configs/gcp-gclb.yaml
            ;;
        "azure")
            kubectl apply -f ../k8s/load-balancer-configs/azure-alb.yaml
            ;;
    esac
    
    log_success "Load balancer auto-scaling configured"
}

# Configure monitoring for auto-scaling
setup_autoscaling_monitoring() {
    log_info "Setting up auto-scaling monitoring..."
    
    # Create ServiceMonitor for autoscaling metrics
    cat > autoscaling-servicemonitor.yaml << EOF
apiVersion: monitoring.coreos.com/v1
kind: ServiceMonitor
metadata:
  name: autoscaling-metrics
  namespace: $NAMESPACE
  labels:
    app: fieldsync
    component: autoscaling-monitoring
spec:
  selector:
    matchLabels:
      app: fieldsync
  endpoints:
  - port: metrics
    interval: 30s
    path: /metrics
EOF

    kubectl apply -f autoscaling-servicemonitor.yaml
    
    # Create Grafana dashboard for auto-scaling
    cat > autoscaling-dashboard.json << EOF
{
  "dashboard": {
    "title": "FieldSync Auto-scaling Dashboard",
    "panels": [
      {
        "title": "Pod Replicas",
        "type": "graph",
        "targets": [
          {
            "expr": "kube_deployment_status_replicas{deployment=\"fieldsync-app\",namespace=\"$NAMESPACE\"}"
          }
        ]
      },
      {
        "title": "CPU Utilization",
        "type": "graph",
        "targets": [
          {
            "expr": "rate(container_cpu_usage_seconds_total{namespace=\"$NAMESPACE\"}[5m]) * 100"
          }
        ]
      },
      {
        "title": "Memory Utilization",
        "type": "graph",
        "targets": [
          {
            "expr": "container_memory_usage_bytes{namespace=\"$NAMESPACE\"} / container_spec_memory_limit_bytes{namespace=\"$NAMESPACE\"} * 100"
          }
        ]
      },
      {
        "title": "HPA Recommendations",
        "type": "graph",
        "targets": [
          {
            "expr": "kube_horizontalpodautoscaler_status_desired_replicas{namespace=\"$NAMESPACE\"}"
          }
        ]
      }
    ]
  }
}
EOF

    log_success "Auto-scaling monitoring configured"
}

# Test auto-scaling
test_autoscaling() {
    log_info "Testing auto-scaling configuration..."
    
    # Check HPA status
    log_info "Current HPA status:"
    kubectl get hpa -n $NAMESPACE
    
    # Check current pod count
    log_info "Current pod count:"
    kubectl get pods -n $NAMESPACE -l app=fieldsync,component=application --no-headers | wc -l
    
    # Create a load testing job
    cat > load-test.yaml << EOF
apiVersion: batch/v1
kind: Job
metadata:
  name: fieldsync-load-test
  namespace: $NAMESPACE
spec:
  template:
    spec:
      containers:
      - name: load-test
        image: busybox
        command:
        - /bin/sh
        - -c
        - |
          echo "Starting load test..."
          for i in \$(seq 1 100); do
            wget -q -O- http://fieldsync-nginx/health &
          done
          wait
          echo "Load test completed"
      restartPolicy: Never
  backoffLimit: 1
EOF

    kubectl apply -f load-test.yaml
    
    # Wait for load test to complete
    kubectl wait --for=condition=complete --timeout=300s job/fieldsync-load-test -n $NAMESPACE
    
    # Check if scaling occurred
    sleep 60
    log_info "Pod count after load test:"
    kubectl get pods -n $NAMESPACE -l app=fieldsync,component=application --no-headers | wc -l
    
    # Cleanup load test
    kubectl delete job fieldsync-load-test -n $NAMESPACE
    
    log_success "Auto-scaling test completed"
}

# Cleanup temporary files
cleanup() {
    log_info "Cleaning up temporary files..."
    rm -f cluster-autoscaler-policy.json
    rm -f autoscaling-servicemonitor.yaml
    rm -f autoscaling-dashboard.json
    rm -f load-test.yaml
    rm -rf autoscaler
}

# Display auto-scaling information
show_autoscaling_info() {
    log_success "Auto-scaling setup completed!"
    echo
    echo "==================================="
    echo "   AUTO-SCALING CONFIGURATION"
    echo "==================================="
    echo
    echo "Cloud Provider: $CLOUD_PROVIDER"
    echo "Cluster: $CLUSTER_NAME"
    echo "Region: $REGION"
    echo
    echo "Horizontal Pod Autoscaler:"
    kubectl get hpa -n $NAMESPACE -o wide
    echo
    echo "Vertical Pod Autoscaler:"
    kubectl get vpa -n $NAMESPACE -o wide 2>/dev/null || echo "VPA not configured"
    echo
    echo "Pod Disruption Budgets:"
    kubectl get pdb -n $NAMESPACE -o wide
    echo
    echo "Current Pod Status:"
    kubectl get pods -n $NAMESPACE -o wide
    echo
    echo "==================================="
    echo "   USEFUL COMMANDS"
    echo "==================================="
    echo
    echo "View HPA details:"
    echo "  kubectl describe hpa fieldsync-app-advanced-hpa -n $NAMESPACE"
    echo
    echo "Monitor scaling events:"
    echo "  kubectl get events -n $NAMESPACE --sort-by=.metadata.creationTimestamp"
    echo
    echo "Scale manually (for testing):"
    echo "  kubectl scale deployment fieldsync-app --replicas=5 -n $NAMESPACE"
    echo
    echo "Check resource usage:"
    echo "  kubectl top pods -n $NAMESPACE"
    echo "  kubectl top nodes"
    echo
    echo "View autoscaling logs:"
    echo "  kubectl logs -f deployment/cluster-autoscaler -n kube-system"
}

# Main execution
main() {
    echo "🚀 FieldSync Auto-scaling Setup"
    echo "==============================="
    echo
    
    # Parse command line arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            --cloud-provider)
                CLOUD_PROVIDER="$2"
                shift 2
                ;;
            --cluster-name)
                CLUSTER_NAME="$2"
                shift 2
                ;;
            --region)
                REGION="$2"
                shift 2
                ;;
            --skip-cluster-autoscaler)
                SKIP_CLUSTER_AUTOSCALER=true
                shift
                ;;
            --skip-vpa)
                SKIP_VPA=true
                shift
                ;;
            --skip-load-balancer)
                SKIP_LOAD_BALANCER=true
                shift
                ;;
            --skip-test)
                SKIP_TEST=true
                shift
                ;;
            --help)
                echo "Usage: $0 [options]"
                echo "Options:"
                echo "  --cloud-provider PROVIDER    Cloud provider (aws, gcp, azure)"
                echo "  --cluster-name NAME           Kubernetes cluster name"
                echo "  --region REGION               Cloud provider region"
                echo "  --skip-cluster-autoscaler     Skip cluster autoscaler setup"
                echo "  --skip-vpa                    Skip VPA installation"
                echo "  --skip-load-balancer          Skip load balancer setup"
                echo "  --skip-test                   Skip auto-scaling test"
                echo "  --help                        Show this help message"
                exit 0
                ;;
            *)
                log_error "Unknown option: $1"
                exit 1
                ;;
        esac
    done
    
    # Execute setup steps
    check_prerequisites
    
    if [ "$SKIP_VPA" != "true" ]; then
        install_vpa
    fi
    
    if [ "$SKIP_CLUSTER_AUTOSCALER" != "true" ]; then
        setup_cluster_autoscaler
    fi
    
    setup_hpa
    setup_pdb
    install_custom_metrics
    
    if [ "$SKIP_LOAD_BALANCER" != "true" ]; then
        setup_load_balancer_scaling
    fi
    
    setup_autoscaling_monitoring
    
    if [ "$SKIP_TEST" != "true" ]; then
        test_autoscaling
    fi
    
    cleanup
    show_autoscaling_info
}

# Handle script termination
trap cleanup EXIT

# Run main function
main "$@"