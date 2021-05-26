import { Construct, Stage, StageProps } from '@aws-cdk/core';
import { PipelineCacheStack } from './pipeline-cache-stack';
import { RepoCdnPipelineStack } from './repo-cdn-pipeline-stack';
import { CdnStack } from './cdn-stack';
import { ContNetworkStack } from './cont-network-stack';
import { SiteProps, ServicesProps } from './context-helper';
import { buildDbNPipeline } from './db-n-pipeline';
import { buildAppNPipeline } from './app-n-pipeline';

/**
 * Deployable unit of entire architecture
 */
export class ArchiDeployStage extends Stage {

  constructor(scope: Construct, id: string, props?: StageProps) {
    super(scope, id, props);
    const siteContext = this.node.tryGetContext('site');
    const siteProps = siteContext as SiteProps;
    const siteEnv = {
      region: 'us-east-1', // use us-east-1 for distribution and supporting services
    };
    const site = new CdnStack(this, 'Site', {
      env: siteEnv,
    });
    const sitePipelineCache = new PipelineCacheStack(this, 'SitePipelineCache', {
      env: siteEnv,
    });
    new RepoCdnPipelineStack(this, 'SitePipeline', {
      pipeline: siteProps.pipeline,
      cdn: site,
      cacheBucket: sitePipelineCache.bucket,
      env: siteEnv,
    });
    const servicesContext = this.node.tryGetContext('services');
    const servicesProps = servicesContext as ServicesProps;
    const serviceNetwork = new ContNetworkStack(this, 'ServiceNetwork', {
      network: servicesProps.network,
    });
    servicesProps.list.forEach(serviceProps => {
      buildDbNPipeline(this, serviceProps.id, {
        db: serviceProps.db,
        namespace: serviceNetwork.namespace,
        cluster: serviceNetwork.cluster,
      });
      buildAppNPipeline(this, serviceProps.id, {
        app: serviceProps.app,
        vpc: serviceNetwork.vpc,
        cluster: serviceNetwork.cluster,
      });
    });
  }

}

