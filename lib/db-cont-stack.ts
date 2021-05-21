import { Construct, Stack, StackProps } from '@aws-cdk/core';
import { Cluster, FargateService, FargateTaskDefinition, ContainerImage } from '@aws-cdk/aws-ecs';
import { DbProps } from './context-helper';

export interface DbContProps extends StackProps {
  dbProps: DbProps,
  cluster: Cluster,
}

export class DbContStack extends Stack {

  public readonly task: FargateTaskDefinition;

  constructor(scope: Construct, id: string, dbContProps: DbContProps) {
    super(scope, id, dbContProps);
    const taskDef = new FargateTaskDefinition(this, 'TaskDef', {
      cpu: dbContProps.dbProps.cpu,
    });
    this.task = taskDef;
    const contImage = ContainerImage.fromRegistry('mcr.microsoft.com/mssql/server');
    taskDef.addContainer('Cont', {
      image: contImage,
    })
    new FargateService(this, 'Service', {
      cluster: dbContProps.cluster,
      taskDefinition: taskDef,
    });
  }

}
