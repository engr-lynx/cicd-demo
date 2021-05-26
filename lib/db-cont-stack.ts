import { Construct, Stack, StackProps } from '@aws-cdk/core';
import { Cluster, FargateService, FargateTaskDefinition, ContainerImage } from '@aws-cdk/aws-ecs';
import { PrivateDnsNamespace } from '@aws-cdk/aws-servicediscovery';
import { CustomDbContProps } from './context-helper';

export interface DbContProps extends StackProps {
  customDbCont: CustomDbContProps,
  namespace: PrivateDnsNamespace,
  cluster: Cluster,
}

export class DbContStack extends Stack {

  public readonly task: FargateTaskDefinition;

  constructor(scope: Construct, id: string, dbContProps: DbContProps) {
    super(scope, id, dbContProps);
    const taskDef = new FargateTaskDefinition(this, 'TaskDef', {
      cpu: dbContProps.customDbCont.spec.cpu,
      memoryLimitMiB: dbContProps.customDbCont.spec.mem,
    });
    const contImage = ContainerImage.fromRegistry('daemonza/testapi');
    taskDef.addContainer('Cont', {
      image: contImage,
    });
    this.task = taskDef;
    const cloudMapOptions = {
      cloudMapNamespace: dbContProps.namespace,
    };
    new FargateService(this, 'Service', {
      cluster: dbContProps.cluster,
      taskDefinition: taskDef,
      cloudMapOptions,
    });
  }

}
