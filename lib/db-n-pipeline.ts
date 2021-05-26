import { Construct } from '@aws-cdk/core';
import { Bucket } from '@aws-cdk/aws-s3';
import { Cluster } from '@aws-cdk/aws-ecs';
import { PrivateDnsNamespace } from '@aws-cdk/aws-servicediscovery';
import { DbKind, AuroraSlsProps, CustomDbContProps, DbProps } from './context-helper';
import { DbContStack } from './db-cont-stack';
import { RepoDbContPipelineStack } from './repo-db-cont-pipeline-stack';

export interface DbNPipelineProps {
  db: DbProps,
  namespace: PrivateDnsNamespace,
  cluster?: Cluster,
  cacheBucket: Bucket,
}

export function buildDbNPipeline (scope: Construct, prefix: string, dbNPipelineProps: DbNPipelineProps) {
  switch(dbNPipelineProps.db.kind) {
    case DbKind.AuroraSls:
      const auroraSlsProps = dbNPipelineProps.db as AuroraSlsProps;
      // Todo: Use namespace & cacheBucket.
    case DbKind.CustomDbCont:
      const customDbContProps = dbNPipelineProps.db as CustomDbContProps;
      const cluster = dbNPipelineProps.cluster;
      if (!cluster) {
        throw new Error('Undefined cluster.');
      };
      const dbCont = new DbContStack(scope, prefix + 'Db', {
        customDbCont: customDbContProps,
        namespace: dbNPipelineProps.namespace,
        cluster,
      });
      new RepoDbContPipelineStack(scope, prefix + 'DbPipeline', {
        pipeline: customDbContProps.pipeline,
        dbCont,
        cacheBucket: dbNPipelineProps.cacheBucket,
      });
      return;
    default:
      throw new Error('Unsupported Type');
  };
}
