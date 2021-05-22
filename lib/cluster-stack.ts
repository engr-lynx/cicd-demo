import { Construct, Stack, StackProps } from '@aws-cdk/core';
import { Cluster } from '@aws-cdk/aws-ecs';
import { Vpc } from '@aws-cdk/aws-ec2';

export interface ClusterProps extends StackProps {
  vpc: Vpc,
}

export class ClusterStack extends Stack {

  public readonly cluster: Cluster;

  constructor(scope: Construct, id: string, clusterProps: ClusterProps) {
    super(scope, id, clusterProps);
    this.cluster = new Cluster(this, "Cluster", {
      vpc: clusterProps.vpc,
    });
  }

}
