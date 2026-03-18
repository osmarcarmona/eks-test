pipeline {
    agent {
        kubernetes {
            yaml '''
apiVersion: v1
kind: Pod
spec:
  serviceAccountName: jenkins
  containers:
    - name: deploy
      image: alpine:latest
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

        stage('Install Tools') {
            steps {
                container('deploy') {
                    sh '''
                        apk add --no-cache curl bash
                        curl -fsSL https://get.helm.sh/helm-v3.14.0-linux-amd64.tar.gz | tar xz -C /usr/local/bin --strip-components=1 linux-amd64/helm
                        curl -fsSLO https://dl.k8s.io/release/v1.29.0/bin/linux/amd64/kubectl && chmod +x kubectl && mv kubectl /usr/local/bin/
                    '''
                }
            }
        }

        stage('Deploy Backend') {
            steps {
                container('deploy') {
                    sh 'helm upgrade --install backend ./helm/backend -n default -f helm/backend/values.yaml --force'
                    sh 'kubectl rollout status deployment/backend -n default --timeout=120s'
                }
            }
        }

        stage('Deploy Frontend') {
            steps {
                container('deploy') {
                    sh 'helm upgrade --install frontend ./helm/frontend -n default -f helm/frontend/values.yaml'
                    sh 'kubectl rollout status deployment/frontend -n default --timeout=120s'
                }
            }
        }
    }
}
