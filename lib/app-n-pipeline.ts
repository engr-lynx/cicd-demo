import { Construct } from '@aws-cdk/core';
import { Bucket } from '@aws-cdk/aws-s3';
import { Cluster } from '@aws-cdk/aws-ecs';
import { Vpc } from '@aws-cdk/aws-ec2';
import { AppKind, CustomSlsContProps, CustomAppContProps, AppProps } from './context-helper';
import { SlsContStack } from './sls-cont-stack';
import { RepoSlsContPipelineStack } from './repo-sls-cont-pipeline-stack';

export interface AppNPipelineProps {
  app: AppProps,
  vpc: Vpc,
  cluster?: Cluster,
  cacheBucket: Bucket,
}

export function buildAppNPipeline (scope: Construct, prefix: string, appNPipelineProps: AppNPipelineProps) {
  switch(appNPipelineProps.app.kind) {
    case AppKind.CustomSlsCont:
      const customSlsContProps = appNPipelineProps.app as CustomSlsContProps;
      const slsCont = new SlsContStack(scope, prefix + 'App', {
        customSlsCont: customSlsContProps,
        vpc: appNPipelineProps.vpc,
      });      
      new RepoSlsContPipelineStack(scope, prefix + 'AppPipeline', {
        pipeline: customSlsContProps.pipeline,
        slsCont,
        cacheBucket: appNPipelineProps.cacheBucket,
      });
      return;
    case AppKind.CustomAppCont:
      const customAppContProps = appNPipelineProps.app as CustomAppContProps;
      const cluster = appNPipelineProps.cluster;
      if (!cluster) {
        throw new Error('Undefined cluster.');
      };
      // Todo: Use cacheBucket.
    default:
      throw new Error('Unsupported Type');
  };
}
