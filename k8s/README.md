# FieldSync Kubernetes Deployment

This directory contains all the necessary Kubernetes manifests and scripts to deploy FieldSync in a production Kubernetes environment.

## 📋 Prerequisites

### Required Tools
- `kubectl` (v1.20+)
- `kustomize` (v4.0+) or kubectl with kustomize support
- `docker` (for building images)
- Access to a Kubernetes cluster (v1.20+)

### Required Kubernetes Features
- **Storage Classes**: `fast-ssd` and `nfs` (or equivalent)
- **LoadBalancer** support (for external access)
- **PersistentVolumes** support
- **RBAC** enabled
- **NetworkPolicies** support (recommended)

### Optional (but recommended)
- **cert-manager** (for automatic SSL certificates)
- **nginx-ingress-controller** (for advanced routing)
- **Prometheus Operator** (for enhanced monitoring)

## 🏗️ Architecture Overview

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Load Balancer │    │     Ingress     │    │      Nginx      │
│   (External)    │───▶│   Controller    │───▶│   (2 replicas)  │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                                        │
                       ┌─────────────────────────────────┼─────────────────────────────────┐
                       │                                 │                                 │
                       ▼                                 ▼                                 ▼
            ┌─────────────────┐                ┌─────────────────┐                ┌─────────────────┐
            │  FieldSync App  │                │    MongoDB      │                │      Redis      │
            │  (3+ replicas)  │                │ (StatefulSet)   │                │  (1 replica)    │
            │                 │                │                 │                │                 │
            │ Web: 3000       │                │ Port: 27017     │                │ Port: 6379      │
            │ API: 5000       │                │ PVC: 20Gi       │                │ PVC: 5Gi        │
            │ Metrics: 9464   │                │                 │                │                 │
            └─────────────────┘                └─────────────────┘                └─────────────────┘
                       │                                 │                                 │
                       └─────────────────────────────────┼─────────────────────────────────┘
                                                         │
                                               ┌─────────────────┐
                                               │   Monitoring    │
                                               │                 │
                                               │ Prometheus      │
                                               │ Grafana         │
                                               │ AlertManager    │
                                               └─────────────────┘
```

## 📁 File Structure

```
k8s/
├── README.md                 # This file
├── deploy.sh                 # Automated deployment script
├── kustomization.yaml        # Kustomize configuration
├── namespace.yaml            # Namespace and resource quotas
├── configmap.yaml            # Application configuration
├── secrets.yaml              # Sensitive configuration (UPDATE BEFORE DEPLOY!)
├── mongodb.yaml              # MongoDB StatefulSet and services
├── redis.yaml                # Redis deployment and services
├── application.yaml          # Main application deployment
├── nginx.yaml                # Nginx reverse proxy and ingress
└── monitoring.yaml           # Prometheus, Grafana, and monitoring stack
```

## 🚀 Quick Start

### 1. Update Configuration

**IMPORTANT**: Before deploying, update the following files with your actual values:

#### Update `secrets.yaml`:
```bash
# Generate secure secrets
openssl rand -hex 32  # For JWT_SECRET
openssl rand -hex 32  # For JWT_REFRESH_SECRET
openssl rand -hex 32  # For ENCRYPTION_MASTER_KEY

# Encode secrets in base64
echo -n "your-secret-here" | base64
```

#### Update `nginx.yaml`:
- Replace `fieldsync.example.com` with your actual domain
- Update email addresses for SSL certificates

#### Update `kustomization.yaml`:
- Replace `your-registry/fieldsync` with your container registry

### 2. Build and Push Docker Image

```bash
# Build the application image
docker build -t your-registry/fieldsync:latest .

# Push to your registry
docker push your-registry/fieldsync:latest
```

### 3. Deploy to Kubernetes

```bash
# Make deployment script executable
chmod +x k8s/deploy.sh

# Run automated deployment
./k8s/deploy.sh --registry your-registry/fieldsync --tag latest

# Or deploy manually
kubectl apply -k k8s/
```

### 4. Verify Deployment

```bash
# Check pod status
kubectl get pods -n fieldsync

# Check services
kubectl get services -n fieldsync

# Check ingress
kubectl get ingress -n fieldsync

# View logs
kubectl logs -f deployment/fieldsync-app -n fieldsync
```

## 🔧 Configuration Options

### Environment-Specific Deployments

#### Development
```bash
# Deploy with fewer resources
./k8s/deploy.sh --namespace fieldsync-dev --tag dev
```

#### Staging
```bash
# Deploy with staging configuration
./k8s/deploy.sh --namespace fieldsync-staging --tag staging
```

#### Production
```bash
# Deploy with full resources and monitoring
./k8s/deploy.sh --namespace fieldsync --tag v1.0.0
```

### Scaling the Application

```bash
# Scale horizontally (more pods)
kubectl scale deployment fieldsync-app --replicas=5 -n fieldsync

# Scale vertically (more resources) - edit deployment yaml
kubectl edit deployment fieldsync-app -n fieldsync
```

### Storage Configuration

#### AWS EKS
```yaml
# Add to your cluster
apiVersion: storage.k8s.io/v1
kind: StorageClass
metadata:
  name: fast-ssd
provisioner: ebs.csi.aws.com
parameters:
  type: gp3
  fsType: ext4
```

#### Google GKE
```yaml
apiVersion: storage.k8s.io/v1
kind: StorageClass
metadata:
  name: fast-ssd
provisioner: kubernetes.io/gce-pd
parameters:
  type: pd-ssd
```

#### Azure AKS
```yaml
apiVersion: storage.k8s.io/v1
kind: StorageClass
metadata:
  name: fast-ssd
provisioner: kubernetes.io/azure-disk
parameters:
  skuName: Premium_LRS
  kind: Managed
```

## 🔒 Security Considerations

### 1. Secrets Management
- **Never commit real secrets to version control**
- Use external secret management (AWS Secrets Manager, Azure Key Vault, etc.)
- Rotate secrets regularly
- Use different secrets for each environment

### 2. Network Security
- Network policies are configured to restrict pod-to-pod communication
- All external communication goes through Nginx reverse proxy
- Rate limiting is enabled at multiple levels

### 3. Pod Security
- Containers run as non-root users
- Read-only root filesystems where possible
- Resource limits are enforced
- Security contexts are configured

### 4. TLS/SSL
- Automatic SSL certificate management with cert-manager
- TLS termination at the ingress level
- Internal communication can be encrypted (optional)

## 📊 Monitoring and Observability

### Access Monitoring Tools

#### Prometheus (Metrics)
```bash
# Port forward to access locally
kubectl port-forward svc/prometheus 9090:9090 -n fieldsync
# Access at http://localhost:9090
```

#### Grafana (Dashboards)
```bash
# Port forward to access locally
kubectl port-forward svc/grafana 3001:3000 -n fieldsync
# Access at http://localhost:3001
# Login: admin / [password from secrets]
```

### Built-in Alerts
- Application downtime
- High CPU/memory usage
- Database connection issues
- High error rates
- Storage space issues

### Custom Metrics
The application exposes custom metrics at `/metrics` endpoint:
- Request rates and latencies
- Database connection pool status
- Cache hit rates
- Business metrics (active users, tickets created, etc.)

## 🔄 Backup and Recovery

### Database Backup
```bash
# Manual backup
kubectl exec -it fieldsync-mongodb-0 -n fieldsync -- mongodump --out /tmp/backup

# Automated backup (add to your CI/CD)
kubectl create job --from=cronjob/mongodb-backup backup-$(date +%Y%m%d) -n fieldsync
```

### Application State Backup
```bash
# Backup persistent volumes
kubectl get pv -o yaml > pv-backup.yaml
kubectl get pvc -n fieldsync -o yaml > pvc-backup.yaml
```

## 🚨 Troubleshooting

### Common Issues

#### 1. Pods Not Starting
```bash
# Check pod status and events
kubectl describe pod <pod-name> -n fieldsync

# Check logs
kubectl logs <pod-name> -n fieldsync --previous
```

#### 2. Storage Issues
```bash
# Check storage classes
kubectl get storageclass

# Check persistent volumes
kubectl get pv
kubectl get pvc -n fieldsync
```

#### 3. Network Issues
```bash
# Test connectivity between pods
kubectl exec -it <pod-name> -n fieldsync -- nslookup fieldsync-mongodb

# Check network policies
kubectl get networkpolicy -n fieldsync
```

#### 4. Database Connection Issues
```bash
# Check MongoDB logs
kubectl logs fieldsync-mongodb-0 -n fieldsync

# Test database connection
kubectl exec -it fieldsync-mongodb-0 -n fieldsync -- mongosh
```

#### 5. Performance Issues
```bash
# Check resource usage
kubectl top pods -n fieldsync
kubectl top nodes

# Check HPA status
kubectl get hpa -n fieldsync
```

### Useful Commands

```bash
# View all resources in namespace
kubectl get all -n fieldsync

# Check resource usage
kubectl top pods -n fieldsync
kubectl top nodes

# Port forward for local access
kubectl port-forward svc/fieldsync-nginx 8080:80 -n fieldsync

# Scale deployment
kubectl scale deployment fieldsync-app --replicas=5 -n fieldsync

# Update image
kubectl set image deployment/fieldsync-app fieldsync-app=your-registry/fieldsync:v2.0.0 -n fieldsync

# Rollback deployment
kubectl rollout undo deployment/fieldsync-app -n fieldsync

# View rollout history
kubectl rollout history deployment/fieldsync-app -n fieldsync
```

## 🔧 Maintenance

### Regular Tasks
1. **Update container images** with security patches
2. **Rotate secrets** (quarterly recommended)
3. **Review and update** resource limits based on usage
4. **Monitor storage usage** and expand as needed
5. **Review logs** for errors and performance issues

### Updating the Application
```bash
# Build and push new image
docker build -t your-registry/fieldsync:v2.0.0 .
docker push your-registry/fieldsync:v2.0.0

# Update deployment
kubectl set image deployment/fieldsync-app fieldsync-app=your-registry/fieldsync:v2.0.0 -n fieldsync

# Monitor rollout
kubectl rollout status deployment/fieldsync-app -n fieldsync
```

## 🆘 Support

### Getting Help
1. **Check the logs** first: `kubectl logs -f deployment/fieldsync-app -n fieldsync`
2. **Review pod events**: `kubectl describe pod <pod-name> -n fieldsync`
3. **Check monitoring dashboards** for system health
4. **Review this documentation** for common solutions

### Useful Resources
- [Kubernetes Documentation](https://kubernetes.io/docs/)
- [Kustomize Documentation](https://kustomize.io/)
- [Prometheus Documentation](https://prometheus.io/docs/)
- [Grafana Documentation](https://grafana.com/docs/)

---

**Note**: This deployment configuration is designed for production use but should be reviewed and customized according to your specific infrastructure and security requirements.