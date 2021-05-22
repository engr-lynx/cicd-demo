import { Construct, Stack, StackProps } from '@aws-cdk/core';
import { Cluster, FargateService, FargateTaskDefinition, ContainerImage } from '@aws-cdk/aws-ecs';
import { PrivateDnsNamespace } from '@aws-cdk/aws-servicediscovery';
import { DbProps } from './context-helper';

export interface DbContProps extends StackProps {
  dbProps: DbProps,
  cluster: Cluster,
  privateNamespace: PrivateDnsNamespace,
}

export class DbContStack extends Stack {

  public readonly task: FargateTaskDefinition;

  constructor(scope: Construct, id: string, dbContProps: DbContProps) {
    super(scope, id, dbContProps);
    const taskDef = new FargateTaskDefinition(this, 'TaskDef', {
      cpu: dbContProps.dbProps.cpu,
    });
    const contImage = ContainerImage.fromRegistry('mcr.microsoft.com/mssql/server');
    taskDef.addContainer('Cont', {
      image: contImage,
    });
    this.task = taskDef;
    const cloudMapOptions = {
      cloudMapNamespace: dbContProps.privateNamespace,
    };
    new FargateService(this, 'Service', {
      cluster: dbContProps.cluster,
      taskDefinition: taskDef,
      cloudMapOptions,
    });
  }

}
