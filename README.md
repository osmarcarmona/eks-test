# Deployment Guide

## Prerequisites

The following tools must be installed and available on your PATH:

- **AWS CLI** — configured with the `kube-test` profile
- **AWS CDK** — for infrastructure provisioning
- **Helm** — for Kubernetes package management
- **kubectl** — for Kubernetes cluster interaction
- **Python 3** — used to parse CDK output files

## Usage

```bash
./deploy.sh <phase> [OPTIONS]
```

If no phase is provided, all phases run sequentially.

### Phases

| Phase             | Command                          | Description                                                                                                                                                  |
| ----------------- | -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `all`             | `./deploy.sh` or `./deploy.sh all` | Runs every phase in order: infra → install-jenkins → backend → frontend.                                                                                     |
| `infra`           | `./deploy.sh infra`              | Deploys the CDK stack (EKS cluster, DynamoDB, IAM roles, etc.), extracts outputs like `ClusterName` and `BackendServiceAccountRoleArn`, and configures kubeconfig. |
| `install-jenkins` | `./deploy.sh install-jenkins`    | Creates the `jenkins` namespace, adds the Jenkins Helm repo, installs Jenkins using `helm/jenkins/values.yaml`, and applies RBAC rules from `helm/jenkins/rbac.yaml`. |
| `backend`         | `./deploy.sh backend`            | Deploys the backend Helm chart from `helm/backend/` with the IAM role ARN injected into the service account, then verifies the rollout.                       |
| `frontend`        | `./deploy.sh frontend`           | Deploys the frontend Helm chart from `helm/frontend/` and verifies the rollout.                                                                               |

### Options

| Flag              | Description                                  |
| ----------------- | -------------------------------------------- |
| `--region <region>` | AWS region for deployment (default: `us-west-2`) |
| `--help`          | Show usage information                       |

## Examples

```bash
# Full deployment (all phases)
./deploy.sh

# Deploy only infrastructure
./deploy.sh infra

# Install Jenkins in a different region
./deploy.sh install-jenkins --region eu-west-1

# Redeploy just the backend
./deploy.sh backend

# Redeploy just the frontend
./deploy.sh frontend
```

## How It Works

1. **infra** — Runs `cdk deploy` inside the `infra/` directory, producing `cdk-outputs.json`. The cluster name and backend IAM role ARN are extracted from that file, then `aws eks update-kubeconfig` is called to set up kubectl access.

2. **install-jenkins** — Reads the existing CDK outputs to configure kubeconfig, creates the `jenkins` namespace, installs the Jenkins Helm chart, and applies RBAC resources.

3. **backend** — Reads CDK outputs, configures kubeconfig, deploys the backend Helm chart with the service account role ARN, and waits for the deployment rollout to complete (120s timeout).

4. **frontend** — Reads CDK outputs, configures kubeconfig, deploys the frontend Helm chart, and waits for the deployment rollout to complete (120s timeout).

> **Note:** The `install-jenkins`, `backend`, and `frontend` phases require that `infra/cdk-outputs.json` already exists (i.e., the `infra` phase has been run at least once).

## Accessing the Jenkins UI

Jenkins is deployed with a `ClusterIP` service, so it's not exposed externally by default. Use port-forwarding to access it locally.

### 1. Get the admin password

```bash
kubectl exec -n jenkins svc/jenkins -c jenkins -- cat /run/secrets/additional/chart-admin-password 2>/dev/null || \
  kubectl get secret -n jenkins jenkins -o jsonpath="{.data.jenkins-admin-password}" | base64 --decode; echo
```

### 2. Forward the Jenkins port

```bash
kubectl port-forward svc/jenkins -n jenkins 8080:8080
```

Then open [http://localhost:8080](http://localhost:8080) in your browser and log in with:

- **Username:** `admin`
- **Password:** the value from step 1

### 3. Running deployments from Jenkins

The repository includes a `Jenkinsfile` at the project root with a pipeline that deploys the backend and frontend via Helm. To set it up in Jenkins:

1. In the Jenkins UI, create a new **Pipeline** job.
2. Under **Pipeline definition**, select **Pipeline script from SCM**.
3. Point it to your repository and set the script path to `Jenkinsfile`.
4. Save and click **Build Now**.

The pipeline runs two stages:

| Stage              | What it does                                                                 |
| ------------------ | ---------------------------------------------------------------------------- |
| **Deploy Backend** | Runs `helm upgrade --install` for the backend chart, then verifies rollout.  |
| **Deploy Frontend**| Runs `helm upgrade --install` for the frontend chart, then verifies rollout. |

Both stages use Kubernetes pod agents with `alpine/helm` and `bitnami/kubectl` containers, so no additional tooling is needed on the Jenkins controller.
