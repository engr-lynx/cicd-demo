import { Construct } from '@aws-cdk/core';
import { SiteProps } from './context-helper';
import { PipelineCacheStack } from './pipeline-cache-stack';
import { CdnStack } from './cdn-stack';
import { RepoCdnPipelineStack } from './repo-cdn-pipeline-stack';

export interface SiteNPipelineProps {
  site: SiteProps,
}

export function buildSiteNPipeline (scope: Construct, siteNPipelineProps: SiteNPipelineProps) {
  const env = {
    region: 'us-east-1', // use us-east-1 for cdn and supporting services
  };
  const cdn = new CdnStack(scope, 'Site', {
    env,
  });
  const pipelineCache = new PipelineCacheStack(scope, 'SitePipelineCache', {
    env,
  });
  new RepoCdnPipelineStack(scope, 'SitePipeline', {
    pipeline: siteNPipelineProps.site.pipeline,
    cdn,
    cacheBucket: pipelineCache.bucket,
    env,
  });
  return;
}
