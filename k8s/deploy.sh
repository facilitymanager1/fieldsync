#!/bin/bash

# FieldSync Kubernetes Deployment Script
# This script deploys FieldSync to a Kubernetes cluster

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
NAMESPACE="fieldsync"
KUBE_CONFIG=${KUBE_CONFIG:-~/.kube/config}
REGISTRY=${CONTAINER_REGISTRY:-"your-registry.com/fieldsync"}
IMAGE_TAG=${IMAGE_TAG:-"latest"}
ENVIRONMENT=${ENVIRONMENT:-"production"}

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
    log_info "Checking prerequisites..."
    
    # Check kubectl
    if ! command -v kubectl &> /dev/null; then
        log_error "kubectl is not installed or not in PATH"
        exit 1
    fi
    
    # Check kustomize
    if ! command -v kustomize &> /dev/null; then
        log_warning "kustomize not found, using kubectl apply -k"
    fi
    
    # Check cluster connection
    if ! kubectl cluster-info &> /dev/null; then
        log_error "Cannot connect to Kubernetes cluster"
        log_info "Please check your kubeconfig file: $KUBE_CONFIG"
        exit 1
    fi
    
    # Check Docker (for building images)
    if ! command -v docker &> /dev/null; then
        log_warning "Docker not found. Assuming images are already built and pushed."
    fi
    
    log_success "Prerequisites check completed"
}

# Build and push Docker image
build_and_push_image() {
    if command -v docker &> /dev/null; then
        log_info "Building Docker image..."
        
        cd "$(dirname "$0")/.."
        
        # Build the image
        docker build -t "${REGISTRY}:${IMAGE_TAG}" .
        
        log_info "Pushing image to registry..."
        docker push "${REGISTRY}:${IMAGE_TAG}"
        
        log_success "Image built and pushed: ${REGISTRY}:${IMAGE_TAG}"
    else
        log_warning "Skipping image build (Docker not available)"
    fi
}

# Create namespace if it doesn't exist
create_namespace() {
    log_info "Creating namespace if it doesn't exist..."
    
    if ! kubectl get namespace $NAMESPACE &> /dev/null; then
        kubectl create namespace $NAMESPACE
        log_success "Namespace '$NAMESPACE' created"
    else
        log_info "Namespace '$NAMESPACE' already exists"
    fi
}

# Apply secrets with validation
apply_secrets() {
    log_info "Applying secrets..."
    
    # Check if required secrets are properly configured
    log_warning "Please ensure you have updated the secrets.yaml file with your actual values!"
    log_warning "The default values are for demonstration only and should NOT be used in production."
    
    read -p "Have you updated the secrets with your actual values? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        log_error "Please update secrets.yaml before proceeding"
        exit 1
    fi
    
    kubectl apply -f k8s/secrets.yaml
    log_success "Secrets applied"
}

# Deploy storage classes (if needed)
deploy_storage() {
    log_info "Checking storage classes..."
    
    # Check if required storage classes exist
    if ! kubectl get storageclass fast-ssd &> /dev/null; then
        log_warning "Storage class 'fast-ssd' not found. You may need to create it."
        log_info "Example for GKE: kubectl apply -f - <<EOF
apiVersion: storage.k8s.io/v1
kind: StorageClass
metadata:
  name: fast-ssd
provisioner: kubernetes.io/gce-pd
parameters:
  type: pd-ssd
  replication-type: none
EOF"
    fi
    
    if ! kubectl get storageclass nfs &> /dev/null; then
        log_warning "Storage class 'nfs' not found. You may need to create it for ReadWriteMany volumes."
    fi
}

# Deploy the application
deploy_application() {
    log_info "Deploying FieldSync application..."
    
    cd "$(dirname "$0")"
    
    # Update image tag in kustomization
    if command -v kustomize &> /dev/null; then
        kustomize edit set image fieldsync="${REGISTRY}:${IMAGE_TAG}"
        kustomize build . | kubectl apply -f -
    else
        # Use kubectl apply -k (requires kubectl 1.14+)
        kubectl apply -k .
    fi
    
    log_success "Application deployed"
}

# Wait for deployments to be ready
wait_for_deployments() {
    log_info "Waiting for deployments to be ready..."
    
    # List of deployments to wait for
    deployments=(
        "fieldsync-mongodb"
        "fieldsync-redis"
        "fieldsync-app"
        "fieldsync-nginx"
    )
    
    for deployment in "${deployments[@]}"; do
        log_info "Waiting for $deployment..."
        kubectl wait --for=condition=available --timeout=600s deployment/$deployment -n $NAMESPACE || {
            log_error "Deployment $deployment failed to become ready"
            log_info "Checking pods status:"
            kubectl get pods -n $NAMESPACE -l app.kubernetes.io/name=$deployment
            log_info "Checking logs:"
            kubectl logs -n $NAMESPACE -l app.kubernetes.io/name=$deployment --tail=20
            exit 1
        }
    done
    
    log_success "All deployments are ready"
}

# Run health checks
health_check() {
    log_info "Running health checks..."
    
    # Check if all pods are running
    if ! kubectl get pods -n $NAMESPACE | grep -v Running | grep -v Completed | grep -v "NAME"; then
        log_success "All pods are running"
    else
        log_warning "Some pods are not running:"
        kubectl get pods -n $NAMESPACE
    fi
    
    # Check services
    log_info "Services status:"
    kubectl get services -n $NAMESPACE
    
    # Check ingress
    log_info "Ingress status:"
    kubectl get ingress -n $NAMESPACE || log_info "No ingress found"
    
    # Test application health endpoint
    log_info "Testing application health..."
    if kubectl get service fieldsync-nginx -n $NAMESPACE &> /dev/null; then
        # Port forward to test health endpoint
        kubectl port-forward svc/fieldsync-nginx 8080:80 -n $NAMESPACE &
        local port_forward_pid=$!
        sleep 5
        
        if curl -f http://localhost:8080/health &> /dev/null; then
            log_success "Application health check passed"
        else
            log_warning "Application health check failed"
        fi
        
        kill $port_forward_pid 2>/dev/null || true
    fi
}

# Display deployment information
show_deployment_info() {
    log_success "FieldSync deployment completed!"
    echo
    echo "==================================="
    echo "   DEPLOYMENT INFORMATION"
    echo "==================================="
    echo
    echo "Namespace: $NAMESPACE"
    echo "Image: ${REGISTRY}:${IMAGE_TAG}"
    echo
    echo "Services:"
    kubectl get services -n $NAMESPACE -o wide
    echo
    echo "Ingress:"
    kubectl get ingress -n $NAMESPACE -o wide || echo "No ingress configured"
    echo
    echo "Pods:"
    kubectl get pods -n $NAMESPACE -o wide
    echo
    echo "==================================="
    echo "   ACCESS INFORMATION"
    echo "==================================="
    echo
    
    # Get LoadBalancer IP or NodePort
    local external_ip=$(kubectl get service fieldsync-nginx -n $NAMESPACE -o jsonpath='{.status.loadBalancer.ingress[0].ip}' 2>/dev/null)
    if [ -n "$external_ip" ]; then
        echo "External IP: $external_ip"
        echo "Application URL: http://$external_ip"
        echo "API URL: http://$external_ip/api"
    else
        echo "Service type: $(kubectl get service fieldsync-nginx -n $NAMESPACE -o jsonpath='{.spec.type}')"
        echo "To access the application, use port forwarding:"
        echo "kubectl port-forward svc/fieldsync-nginx 8080:80 -n $NAMESPACE"
    fi
    
    echo
    echo "Default login credentials:"
    echo "Email: admin@fieldsync.com"
    echo "Password: admin123"
    echo
    echo "⚠️  IMPORTANT: Change default passwords in production!"
    echo
    echo "Useful commands:"
    echo "  View logs: kubectl logs -f deployment/fieldsync-app -n $NAMESPACE"
    echo "  Scale app: kubectl scale deployment fieldsync-app --replicas=5 -n $NAMESPACE"
    echo "  Delete deployment: kubectl delete namespace $NAMESPACE"
}

# Main execution
main() {
    echo "🚀 FieldSync Kubernetes Deployment"
    echo "=================================="
    echo
    
    # Parse command line arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            --skip-build)
                SKIP_BUILD=true
                shift
                ;;
            --skip-health-check)
                SKIP_HEALTH_CHECK=true
                shift
                ;;
            --registry)
                REGISTRY="$2"
                shift 2
                ;;
            --tag)
                IMAGE_TAG="$2"
                shift 2
                ;;
            --namespace)
                NAMESPACE="$2"
                shift 2
                ;;
            --help)
                echo "Usage: $0 [options]"
                echo "Options:"
                echo "  --skip-build          Skip building and pushing Docker image"
                echo "  --skip-health-check   Skip health checks after deployment"
                echo "  --registry REGISTRY   Container registry to use"
                echo "  --tag TAG             Image tag to use"
                echo "  --namespace NS        Kubernetes namespace to deploy to"
                echo "  --help                Show this help message"
                exit 0
                ;;
            *)
                log_error "Unknown option: $1"
                exit 1
                ;;
        esac
    done
    
    # Execute deployment steps
    check_prerequisites
    
    if [ "$SKIP_BUILD" != "true" ]; then
        build_and_push_image
    fi
    
    create_namespace
    deploy_storage
    apply_secrets
    deploy_application
    wait_for_deployments
    
    if [ "$SKIP_HEALTH_CHECK" != "true" ]; then
        health_check
    fi
    
    show_deployment_info
}

# Handle script termination
cleanup() {
    log_info "Cleaning up..."
    # Kill any background processes
    jobs -p | xargs -r kill 2>/dev/null || true
}

trap cleanup EXIT

# Run main function
main "$@"