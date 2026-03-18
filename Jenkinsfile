pipeline {
    agent {
        kubernetes {
            yaml '''
apiVersion: v1
kind: Pod
spec:
  serviceAccountName: jenkins
  containers:
    - name: helm
      image: alpine/helm:latest
      command: ["cat"]
      tty: true
    - name: kubectl
      image: bitnami/kubectl:latest
      command: ["cat"]
      tty: true
'''
        }
    }

    stages {
        stage('Checkout') {
            steps {
                git branch: 'main', url: 'https://github.com/osmarcarmona/eks-test.git'
            }
        }

        stage('Deploy Backend') {
            steps {
                container('helm') {
                    sh 'helm upgrade --install backend ./helm/backend -n default -f helm/backend/values.yaml'
                }
                container('kubectl') {
                    sh 'kubectl rollout status deployment/backend -n default --timeout=120s'
                }
            }
        }

        stage('Deploy Frontend') {
            steps {
                container('helm') {
                    sh 'helm upgrade --install frontend ./helm/frontend -n default -f helm/frontend/values.yaml'
                }
                container('kubectl') {
                    sh 'kubectl rollout status deployment/frontend -n default --timeout=120s'
                }
            }
        }
    }
}
