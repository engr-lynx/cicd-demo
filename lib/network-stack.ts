import { Construct, Stack, StackProps } from '@aws-cdk/core';
import { Vpc } from '@aws-cdk/aws-ec2';
import { PrivateDnsNamespace } from '@aws-cdk/aws-servicediscovery';

export interface NetworkProps extends StackProps {
  namespace: string,
}

export class NetworkStack extends Stack {

  public readonly vpc: Vpc;
  public readonly privateNamespace: PrivateDnsNamespace;

  constructor(scope: Construct, id: string, networkProps: NetworkProps) {
    super(scope, id, networkProps);
    this.vpc = new Vpc(this, 'Vpc');
    this.privateNamespace = new PrivateDnsNamespace(this, 'PrivateNamespace', {
      name: networkProps.namespace,
      vpc: this.vpc,
    })
  }

}
