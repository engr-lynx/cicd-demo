import { Construct, Stage, StageProps } from '@aws-cdk/core';
import { PipelineCacheStack } from './pipeline-cache-stack';
import { RepoDbContPipelineStack } from './repo-db-cont-pipeline-stack';
import { RepoSlsContPipelineStack } from './repo-sls-cont-pipeline-stack';
import { RepoCdnPipelineStack } from './repo-cdn-pipeline-stack';
import { CdnStack } from './cdn-stack';
import { NetworkStack } from './network-stack';
import { ClusterStack } from './cluster-stack';
import { SlsContStack } from './sls-cont-stack';
import { DbContStack } from './db-cont-stack';
import { Context, buildRepoProps, buildStageProps, buildNetworkProps, buildAppProps, buildDbProps } from './context-helper';

/**
 * Deployable unit of entire architecture
 */
export class ArchiDeployStage extends Stage {

  constructor(scope: Construct, id: string, props?: StageProps) {
    super(scope, id, props);
    const siteEnv = {
      region: 'us-east-1', // use us-east-1 for distribution and supporting services
    };
    const site = new CdnStack(this, 'Site', {
      env: siteEnv,
    });
    const sitePipelineCache = new PipelineCacheStack(this, 'SitePipelineCache', {
      env: siteEnv,
    });
    const sitePipelineContext = this.node.tryGetContext('SitePipeline');
    const siteRepoProps = buildRepoProps(sitePipelineContext);
    const siteStageProps = buildStageProps(sitePipelineContext);
    new RepoCdnPipelineStack(this, 'SitePipeline', {
      repoProps: siteRepoProps,
      stageProps: siteStageProps,
      distributionSource: site.sourceBucket,
      distribution: site.distribution,
      pipelineCache: sitePipelineCache.bucket,
      env: siteEnv,
    });
    const serviceNetworkContext = this.node.tryGetContext('ServiceNetwork');
    const serviceNetworkProps = buildNetworkProps(serviceNetworkContext);
    const serviceNetwork = new NetworkStack(this, 'ServiceNetwork', {
      namespace: serviceNetworkProps.namespace,
    });
    const serviceCluster = new ClusterStack(this, 'ServiceCluster', {
      vpc: serviceNetwork.vpc,
    });
    const servicesContext = this.node.tryGetContext('Services');
    Object.entries(servicesContext).forEach(serviceEntry => {
      const [serviceId, serviceContext] = serviceEntry as [string, Context];
      const serviceDbProps = buildDbProps(serviceContext.db);
      const serviceDb = new DbContStack(this, serviceId + 'Db', {
        dbProps: serviceDbProps,
        cluster: serviceCluster.cluster,
        privateNamespace: serviceNetwork.privateNamespace,
      });
      const serviceAppProps = buildAppProps(serviceContext.app);  
      const serviceApp = new SlsContStack(this, serviceId + 'App', {
        appProps: serviceAppProps,
        vpc: serviceNetwork.vpc,
      });      
      const serviceDbRepoProps = buildRepoProps(serviceContext.dbPipeline);
      const serviceDbStageProps = buildStageProps(serviceContext.dbPipeline);
      new RepoDbContPipelineStack(this, serviceId + 'DbPipeline', {
        repoProps: serviceDbRepoProps,
        stageProps: serviceDbStageProps,
        task: serviceDb.task,
      });
      const serviceAppRepoProps = buildRepoProps(serviceContext.appPipeline);
      const serviceAppStageProps = buildStageProps(serviceContext.appPipeline);
      new RepoSlsContPipelineStack(this, serviceId + 'AppPipeline', {
        repoProps: serviceAppRepoProps,
        stageProps: serviceAppStageProps,
        func: serviceApp.func,
      });
    });
  }

}

