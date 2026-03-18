import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as ecr from 'aws-cdk-lib/aws-ecr';
import * as eks from 'aws-cdk-lib/aws-eks';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import { KubectlV35Layer } from '@aws-cdk/lambda-layer-kubectl-v35';
import { Construct } from 'constructs';

export interface EksStackProps extends cdk.StackProps {
  vpc: ec2.IVpc;
  table: dynamodb.ITable;
  repository: ecr.IRepository;
}

export class EksStack extends cdk.Stack {
  public readonly cluster: eks.Cluster;

  constructor(scope: Construct, id: string, props: EksStackProps) {
    super(scope, id, props);

    this.cluster = new eks.Cluster(this, 'EksCluster', {
      vpc: props.vpc,
      version: eks.KubernetesVersion.of('1.35'),
      kubectlLayer: new KubectlV35Layer(this, 'KubectlLayer'),
      defaultCapacity: 0,
    });

    // Grant cluster admin access to the deployer IAM user
    const adminUser = iam.User.fromUserArn(this, 'AdminUser', 'arn:aws:iam::341738837637:user/cmosmar');
    this.cluster.awsAuth.addUserMapping(adminUser, {
      groups: ['system:masters'],
    });

    const nodeGroup = this.cluster.addNodegroupCapacity('ManagedNodeGroup', {
      instanceTypes: [new ec2.InstanceType('t3.small')],
      amiType: eks.NodegroupAmiType.AL2_X86_64,
      minSize: 1,
      maxSize: 1,
      desiredSize: 1,
    });

    // Override AMI type to AL2023 for Kubernetes 1.35 compatibility
    const cfnNodeGroup = nodeGroup.node.defaultChild as cdk.CfnResource;
    cfnNodeGroup.addPropertyOverride('AmiType', 'AL2023_x86_64_STANDARD');

    // Grant ECR pull permissions to the node group
    props.repository.grantPull(nodeGroup.role);

    // EBS CSI Driver for PersistentVolume support
    const ebsCsiRole = new iam.Role(this, 'EbsCsiDriverRole', {
      assumedBy: new iam.FederatedPrincipal(
        this.cluster.openIdConnectProvider.openIdConnectProviderArn,
        {
          StringEquals: new cdk.CfnJson(this, 'EbsCsiOidcCondition', {
            value: {
              [`${this.cluster.openIdConnectProvider.openIdConnectProviderIssuer}:sub`]:
                'system:serviceaccount:kube-system:ebs-csi-controller-sa',
              [`${this.cluster.openIdConnectProvider.openIdConnectProviderIssuer}:aud`]:
                'sts.amazonaws.com',
            },
          }),
        },
        'sts:AssumeRoleWithWebIdentity',
      ),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AmazonEBSCSIDriverPolicy'),
      ],
    });

    new eks.CfnAddon(this, 'EbsCsiAddon', {
      clusterName: this.cluster.clusterName,
      addonName: 'aws-ebs-csi-driver',
      serviceAccountRoleArn: ebsCsiRole.roleArn,
    });

    // IRSA: IAM Role for Backend Service Account
    const backendSa = this.cluster.addServiceAccount('BackendServiceAccount', {
      name: 'backend-sa',
      namespace: 'default',
    });

    props.table.grantReadWriteData(backendSa);

    // AWS Load Balancer Controller add-on
    eks.AlbController.create(this, {
      cluster: this.cluster,
      version: eks.AlbControllerVersion.V2_6_2,
    });

    // CloudFormation Outputs
    new cdk.CfnOutput(this, 'BackendServiceAccountRoleArn', {
      value: backendSa.role.roleArn,
      description: 'IAM Role ARN for the backend Kubernetes service account (IRSA)',
    });

    new cdk.CfnOutput(this, 'ClusterName', {
      value: this.cluster.clusterName,
      description: 'EKS Cluster Name',
    });

    new cdk.CfnOutput(this, 'KubeconfigCommand', {
      value: `aws eks update-kubeconfig --name ${this.cluster.clusterName} --region ${this.region}`,
      description: 'Command to configure kubectl',
    });
  }
}
