import { Construct, Stage, StageProps } from '@aws-cdk/core';
import { ContNetworkStack } from './cont-network-stack';
import { PipelineCacheStack } from './pipeline-cache-stack';
import { SiteProps, ServicesProps } from './context-helper';
import { buildSiteNPipeline } from './site-n-pipeline';
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
    buildSiteNPipeline(this, {
      site: siteProps,
    });
    const servicesContext = this.node.tryGetContext('services');
    const servicesProps = servicesContext as ServicesProps;
    const serviceNetwork = new ContNetworkStack(this, 'ServiceNetwork', {
      network: servicesProps.network,
    });
    const servicePipelinesCache = new PipelineCacheStack(this, 'ServicePipelinesCache');
    servicesProps.list.forEach(serviceProps => {
      buildDbNPipeline(this, serviceProps.id, {
        db: serviceProps.db,
        namespace: serviceNetwork.namespace,
        cluster: serviceNetwork.cluster,
        cacheBucket: servicePipelinesCache.bucket,
      });
      buildAppNPipeline(this, serviceProps.id, {
        app: serviceProps.app,
        vpc: serviceNetwork.vpc,
        cluster: serviceNetwork.cluster,
        cacheBucket: servicePipelinesCache.bucket,
      });
    });
  }

}

