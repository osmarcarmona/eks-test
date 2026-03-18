#!/usr/bin/env bash
set -euo pipefail

###############################################################################
# deploy.sh — End-to-end deployment script for the application stack.
# Deploys CDK infrastructure, installs Jenkins via Helm, and deploys
# backend/frontend application workloads.
###############################################################################

export AWS_PROFILE="kube-test"
export DOCKER_HOST="unix://${HOME}/.colima/default/docker.sock"

REGION="us-west-2"
IMAGE_TAG="latest"

# ---------------------------------------------------------------------------
# Logging helpers
# ---------------------------------------------------------------------------
log_info() {
  echo "==> $1"
}

log_error() {
  echo "ERROR: $1" >&2
}

# ---------------------------------------------------------------------------
# Prerequisite validation
# ---------------------------------------------------------------------------
check_prerequisites() {
  local tools=("aws" "cdk" "helm" "kubectl" "docker")
  for tool in "${tools[@]}"; do
    if ! command -v "$tool" &>/dev/null; then
      log_error "Required tool '$tool' is not installed or not on PATH."
      exit 1
    fi
  done
  log_info "All prerequisites verified."
}

# ---------------------------------------------------------------------------
# Usage / help
# ---------------------------------------------------------------------------
usage() {
  cat <<EOF
Usage: deploy.sh <phase> [OPTIONS]

Phases:
  all                 Run all phases (default if no phase given)
  infra               Deploy CDK infrastructure and configure kubeconfig
  build-images        Build and push Docker images to ECR
  install-jenkins     Install Jenkins via Helm
  backend             Deploy backend application
  frontend            Deploy frontend application

Options:
  --region <region>   AWS region for deployment (default: us-west-2)
  --help              Show this help message and exit
EOF
}

# ---------------------------------------------------------------------------
# Argument parsing
# ---------------------------------------------------------------------------
PHASE="all"

parse_arguments() {
  # First positional arg is the phase
  if [[ $# -gt 0 && "$1" != --* ]]; then
    PHASE="$1"
    shift
  fi

  while [[ $# -gt 0 ]]; do
    case "$1" in
      --help)
        usage
        exit 0
        ;;
      --region)
        if [[ $# -lt 2 || "$2" == --* ]]; then
          log_error "Flag --region requires a value."
          exit 1
        fi
        REGION="$2"
        shift 2
        ;;
      --*)
        log_error "Unrecognized flag: $1"
        exit 1
        ;;
      *)
        log_error "Unexpected argument: $1"
        exit 1
        ;;
    esac
  done
}


# ---------------------------------------------------------------------------
# Phase 1: CDK Deploy
# ---------------------------------------------------------------------------
bootstrap_cdk() {
  log_info "Starting: CDK Bootstrap"
  local account_id
  account_id=$(aws sts get-caller-identity --query Account --output text --profile kube-test) || {
    log_error "Failed to retrieve AWS account ID."
    exit 1
  }
  if ! (cd infra && cdk bootstrap "aws://${account_id}/${REGION}" --profile kube-test); then
    log_error "CDK Bootstrap failed."
    exit 1
  fi
  log_info "Completed: CDK Bootstrap"
}

deploy_cdk() {
  log_info "Starting: CDK Deploy"
  if ! (cd infra && cdk deploy --all --require-approval never --profile kube-test --outputs-file cdk-outputs.json); then
    log_error "CDK Deploy failed."
    exit 1
  fi
  log_info "Completed: CDK Deploy"
}

extract_cdk_outputs() {
  local outputs_file="infra/cdk-outputs.json"
  if [[ ! -f "$outputs_file" ]]; then
    log_error "CDK outputs file not found at $outputs_file"
    exit 1
  fi

  CLUSTER_NAME=$(python3 -c "import json; print(json.load(open('$outputs_file'))['EksStack']['ClusterName'])" 2>/dev/null) || {
    log_error "Failed to extract ClusterName from CDK outputs."
    exit 1
  }

  ROLE_ARN=$(python3 -c "import json; print(json.load(open('$outputs_file'))['EksStack']['BackendServiceAccountRoleArn'])" 2>/dev/null) || {
    log_error "Failed to extract BackendServiceAccountRoleArn from CDK outputs."
    exit 1
  }

  REPO_URI=$(python3 -c "import json; print(json.load(open('$outputs_file'))['EcrStack']['RepoUri'])" 2>/dev/null) || {
    log_error "Failed to extract RepoUri from CDK outputs."
    exit 1
  }

  TABLE_NAME=$(python3 -c "import json; print(json.load(open('$outputs_file'))['DynamoDbStack']['TableName'])" 2>/dev/null) || {
    log_error "Failed to extract TableName from CDK outputs."
    exit 1
  }

  # Derive the ECR registry host from the repo URI
  ECR_REGISTRY="${REPO_URI%%/*}"

  log_info "Extracted ClusterName=$CLUSTER_NAME"
  log_info "Extracted RoleArn=$ROLE_ARN"
  log_info "Extracted RepoUri=$REPO_URI"
  log_info "Extracted TableName=$TABLE_NAME"
}

configure_kubeconfig() {
  log_info "Starting: Configure kubeconfig"
  if ! aws eks update-kubeconfig --name "$CLUSTER_NAME" --region "$REGION" --profile kube-test; then
    log_error "Failed to configure kubeconfig for cluster '$CLUSTER_NAME'."
    exit 1
  fi
  log_info "Completed: Configure kubeconfig"
}


# ---------------------------------------------------------------------------
# Docker Image Build & Push
# ---------------------------------------------------------------------------
ecr_login() {
  log_info "Starting: ECR Login"
  DOCKER_CONFIG=$(mktemp -d)
  export DOCKER_CONFIG
  if ! aws ecr get-login-password --region "$REGION" --profile kube-test | docker login --username AWS --password-stdin "$ECR_REGISTRY"; then
    log_error "ECR login failed."
    exit 1
  fi
  log_info "Completed: ECR Login"
}

build_and_push_image() {
  local name="$1"
  local context="$2"
  local repo_uri="$3"
  local full_image="${repo_uri}:${name}-${IMAGE_TAG}"

  log_info "Starting: Build image $full_image"
  if ! docker build --platform linux/amd64 -t "$full_image" "$context"; then
    log_error "Docker build failed for $name."
    exit 1
  fi

  log_info "Starting: Push image $full_image"
  if ! docker push "$full_image"; then
    log_error "Docker push failed for $name."
    exit 1
  fi
  log_info "Completed: Push image $full_image"
}

build_and_push_images() {
  extract_cdk_outputs
  ecr_login
  build_and_push_image "backend" "./backend" "$REPO_URI"
  build_and_push_image "frontend" "./frontend" "$REPO_URI"
}

# ---------------------------------------------------------------------------
# Phase 2: Jenkins Installation
# ---------------------------------------------------------------------------
install_jenkins() {
  log_info "Starting: Jenkins Install"

  if ! kubectl create namespace jenkins --dry-run=client -o yaml | kubectl apply -f -; then
    log_error "Failed to create jenkins namespace."
    exit 1
  fi

  if ! helm repo add jenkins https://charts.jenkins.io; then
    log_error "Failed to add Jenkins Helm repository."
    exit 1
  fi

  if ! helm repo update; then
    log_error "Failed to update Helm repositories."
    exit 1
  fi

  if ! helm upgrade --install jenkins jenkins/jenkins -n jenkins -f helm/jenkins/values.yaml; then
    log_error "Jenkins Helm installation failed."
    exit 1
  fi

  if ! kubectl apply -f helm/jenkins/rbac.yaml; then
    log_error "Failed to apply Jenkins RBAC configuration."
    exit 1
  fi

  log_info "Completed: Jenkins Install"
}


# ---------------------------------------------------------------------------
# Phase 3 & 4: Application Deployment (Backend + Frontend)
# ---------------------------------------------------------------------------
deploy_backend() {
  log_info "Starting: Backend Deploy"
  if ! helm upgrade --install backend ./helm/backend -n default -f helm/backend/values.yaml --set serviceAccount.roleArn="$ROLE_ARN" --set env.dynamodbTableName="$TABLE_NAME"; then
    log_error "Backend Helm deployment failed."
    exit 1
  fi
  log_info "Completed: Backend Deploy"
}

deploy_frontend() {
  log_info "Starting: Frontend Deploy"
  if ! helm upgrade --install frontend ./helm/frontend -n default -f helm/frontend/values.yaml; then
    log_error "Frontend Helm deployment failed."
    exit 1
  fi
  log_info "Completed: Frontend Deploy"
}

verify_rollout() {
  local name="$1"
  log_info "Starting: Verify rollout for $name"
  if ! kubectl rollout status "deployment/$name" -n default --timeout=120s; then
    log_error "Rollout verification failed for deployment/$name."
    exit 1
  fi
  log_info "Completed: Verify rollout for $name"
}


# ---------------------------------------------------------------------------
# Main execution flow
# ---------------------------------------------------------------------------
run_infra() {
  bootstrap_cdk
  deploy_cdk
  extract_cdk_outputs
  configure_kubeconfig
}

run_install_jenkins() {
  extract_cdk_outputs
  configure_kubeconfig
  install_jenkins
}

run_backend() {
  extract_cdk_outputs
  configure_kubeconfig
  deploy_backend
  verify_rollout backend
}

run_frontend() {
  extract_cdk_outputs
  configure_kubeconfig
  deploy_frontend
  verify_rollout frontend
}

run_all() {
  run_infra
  build_and_push_images
  install_jenkins
  deploy_backend
  verify_rollout backend
  deploy_frontend
  verify_rollout frontend
}

main() {
  parse_arguments "$@"

  check_prerequisites

  case "$PHASE" in
    all)              run_all ;;
    infra)            run_infra ;;
    build-images)     build_and_push_images ;;
    install-jenkins)  run_install_jenkins ;;
    backend)          run_backend ;;
    frontend)         run_frontend ;;
    *)
      log_error "Unknown phase: $PHASE"
      usage
      exit 1
      ;;
  esac

  log_info "Phase '$PHASE' completed successfully."
}

main "$@"
