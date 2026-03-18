import * as cdk from 'aws-cdk-lib';
import * as ecr from 'aws-cdk-lib/aws-ecr';
import { Construct } from 'constructs';

export class EcrStack extends cdk.Stack {
  public readonly repository: ecr.Repository;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    this.repository = new ecr.Repository(this, 'AppRepo', {
      repositoryName: 'app',
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      emptyOnDelete: true,
      imageScanOnPush: true,
      lifecycleRules: [
        {
          maxImageCount: 20,
          description: 'Keep only the last 20 images',
        },
      ],
    });

    new cdk.CfnOutput(this, 'RepoUri', {
      value: this.repository.repositoryUri,
      description: 'ECR repository URI for application images',
    });
  }
}
