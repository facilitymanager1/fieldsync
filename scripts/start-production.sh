#!/bin/bash

# FieldSync Production Startup Script
# This script starts the production environment with Docker Compose

set -e

echo "🚀 Starting FieldSync Production Environment..."

# Check if required environment variables are set
check_env_vars() {
    local required_vars=(
        "JWT_SECRET"
        "JWT_REFRESH_SECRET" 
        "ENCRYPTION_MASTER_KEY"
        "MONGO_ROOT_PASSWORD"
        "REDIS_PASSWORD"
    )
    
    local missing_vars=()
    
    for var in "${required_vars[@]}"; do
        if [ -z "${!var}" ]; then
            missing_vars+=("$var")
        fi
    done
    
    if [ ${#missing_vars[@]} -ne 0 ]; then
        echo "❌ Missing required environment variables:"
        printf '   %s\n' "${missing_vars[@]}"
        echo ""
        echo "💡 Please set these variables in your .env file or environment"
        echo "   Example:"
        echo "   export JWT_SECRET=\"your-jwt-secret-here\""
        echo "   export ENCRYPTION_MASTER_KEY=\"your-encryption-key-here\""
        exit 1
    fi
}

# Generate secure secrets if not provided
generate_secrets() {
    if [ -z "$JWT_SECRET" ]; then
        export JWT_SECRET=$(openssl rand -hex 32)
        echo "📝 Generated JWT_SECRET: $JWT_SECRET"
    fi
    
    if [ -z "$JWT_REFRESH_SECRET" ]; then
        export JWT_REFRESH_SECRET=$(openssl rand -hex 32)
        echo "📝 Generated JWT_REFRESH_SECRET: $JWT_REFRESH_SECRET"
    fi
    
    if [ -z "$ENCRYPTION_MASTER_KEY" ]; then
        export ENCRYPTION_MASTER_KEY=$(openssl rand -hex 32)
        echo "📝 Generated ENCRYPTION_MASTER_KEY: $ENCRYPTION_MASTER_KEY"
    fi
    
    if [ -z "$MONGO_ROOT_PASSWORD" ]; then
        export MONGO_ROOT_PASSWORD=$(openssl rand -base64 32)
        echo "📝 Generated MONGO_ROOT_PASSWORD: $MONGO_ROOT_PASSWORD"
    fi
    
    if [ -z "$REDIS_PASSWORD" ]; then
        export REDIS_PASSWORD=$(openssl rand -base64 32)
        echo "📝 Generated REDIS_PASSWORD: $REDIS_PASSWORD"
    fi
}

# Create necessary directories
create_directories() {
    echo "📁 Creating necessary directories..."
    mkdir -p nginx/sites-available
    mkdir -p ssl
    mkdir -p monitoring
    mkdir -p logs
    mkdir -p uploads
}

# Check Docker and Docker Compose
check_docker() {
    if ! command -v docker &> /dev/null; then
        echo "❌ Docker is not installed. Please install Docker first."
        exit 1
    fi
    
    if ! command -v docker-compose &> /dev/null; then
        echo "❌ Docker Compose is not installed. Please install Docker Compose first."
        exit 1
    fi
    
    echo "✅ Docker and Docker Compose are available"
}

# Build and start services
start_services() {
    echo "🔨 Building Docker images..."
    docker-compose build --no-cache
    
    echo "🚀 Starting core services..."
    docker-compose up -d mongodb redis
    
    echo "⏳ Waiting for database to be ready..."
    sleep 30
    
    echo "🌐 Starting application services..."
    docker-compose up -d fieldsync-app nginx
    
    echo "📊 Starting monitoring services (optional)..."
    docker-compose --profile monitoring up -d || echo "⚠️ Monitoring services failed to start (this is optional)"
}

# Health check
health_check() {
    echo "🏥 Performing health checks..."
    
    local max_attempts=30
    local attempt=1
    
    while [ $attempt -le $max_attempts ]; do
        echo "   Attempt $attempt/$max_attempts..."
        
        if curl -f http://localhost/health &> /dev/null; then
            echo "✅ Application is healthy!"
            break
        fi
        
        if [ $attempt -eq $max_attempts ]; then
            echo "❌ Health check failed after $max_attempts attempts"
            echo "🔍 Checking logs..."
            docker-compose logs --tail=20 fieldsync-app
            exit 1
        fi
        
        sleep 10
        ((attempt++))
    done
}

# Display startup information
show_info() {
    echo ""
    echo "🎉 FieldSync is running successfully!"
    echo ""
    echo "📱 Application URLs:"
    echo "   Web Dashboard: http://localhost"
    echo "   API Endpoint:  http://localhost/api"
    echo "   Health Check:  http://localhost/health"
    echo ""
    echo "🔧 Management URLs:"
    echo "   Nginx Status:  http://localhost:8080/nginx_status"
    
    if docker-compose ps prometheus &> /dev/null; then
        echo "   Prometheus:    http://localhost:9090"
    fi
    
    if docker-compose ps grafana &> /dev/null; then
        echo "   Grafana:       http://localhost:3001 (admin/admin)"
    fi
    
    if docker-compose ps kibana &> /dev/null; then
        echo "   Kibana:        http://localhost:5601"
    fi
    
    echo ""
    echo "📊 Default Login:"
    echo "   Email:    admin@fieldsync.com"
    echo "   Password: admin123"
    echo ""
    echo "⚠️  IMPORTANT: Change default passwords in production!"
    echo ""
    echo "🔍 View logs with: docker-compose logs -f"
    echo "🛑 Stop services with: docker-compose down"
}

# Main execution
main() {
    echo "🏭 FieldSync Production Deployment Script"
    echo "========================================"
    
    check_docker
    
    # In production, require environment variables
    if [ "$NODE_ENV" = "production" ]; then
        check_env_vars
    else
        echo "🔧 Development mode - generating secrets automatically"
        generate_secrets
    fi
    
    create_directories
    start_services
    health_check
    show_info
}

# Handle script termination
cleanup() {
    echo "🛑 Shutting down services..."
    docker-compose down
    exit 0
}

trap cleanup SIGINT SIGTERM

# Run main function
main "$@"