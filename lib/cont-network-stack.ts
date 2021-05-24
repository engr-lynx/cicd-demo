import { Construct, Stack, StackProps } from '@aws-cdk/core';
import { Vpc } from '@aws-cdk/aws-ec2';
import { PrivateDnsNamespace } from '@aws-cdk/aws-servicediscovery';
import { Cluster } from '@aws-cdk/aws-ecs';
import { NetworkProps } from './context-helper';

export interface ContNetworkProps extends StackProps {
  networkProps: NetworkProps,
}

export class ContNetworkStack extends Stack {

  public readonly vpc: Vpc;
  public readonly namespace: PrivateDnsNamespace;
  public readonly cluster: Cluster;

  constructor(scope: Construct, id: string, contNetworkProps: ContNetworkProps) {
    super(scope, id, contNetworkProps);
    this.vpc = new Vpc(this, 'Vpc');
    this.namespace = new PrivateDnsNamespace(this, 'Namespace', {
      name: contNetworkProps.networkProps.namespace,
      vpc: this.vpc,
    });
    this.cluster = new Cluster(this, "Cluster", {
      vpc: this.vpc,
    });
  }

}
