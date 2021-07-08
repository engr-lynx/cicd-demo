import { Construct, Stack, StackProps } from '@aws-cdk/core';
import { Vpc, SubnetType } from '@aws-cdk/aws-ec2';
import { PrivateDnsNamespace } from '@aws-cdk/aws-servicediscovery';
import { Cluster } from '@aws-cdk/aws-ecs';
import { NetworkProps } from './context-helper';

export interface ContNetworkProps extends StackProps {
  network: NetworkProps,
}

export class ContNetworkStack extends Stack {

  public readonly vpc: Vpc;
  public readonly namespace: PrivateDnsNamespace;
  public readonly cluster: Cluster;

  constructor(scope: Construct, id: string, contNetworkProps: ContNetworkProps) {
    super(scope, id, contNetworkProps);
    const inSubnetConf = {
      name: 'In',
      subnetType: SubnetType.PUBLIC,
    };
    const appSubnetConf = {
      name: 'App',
      subnetType: SubnetType.PRIVATE,
    };
    const dbSubnetConf = {
      name: 'Db',
      subnetType: SubnetType.ISOLATED,
    };
    this.vpc = new Vpc(this, 'Vpc', {
      maxAzs: contNetworkProps.network.azCount,
      subnetConfiguration: [
        inSubnetConf,
        appSubnetConf,
        dbSubnetConf,
      ],
    });
    this.namespace = new PrivateDnsNamespace(this, 'Namespace', {
      name: contNetworkProps.network.namespace,
      vpc: this.vpc,
    });
    this.cluster = new Cluster(this, 'Cluster', {
      vpc: this.vpc,
    });
  }

}
