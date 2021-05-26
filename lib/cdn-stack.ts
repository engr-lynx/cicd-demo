import { Construct, Stack, StackProps, CfnOutput } from '@aws-cdk/core';
import { Bucket } from '@aws-cdk/aws-s3';
import { Distribution } from '@aws-cdk/aws-cloudfront';
import { CloudFrontToS3 } from '@aws-solutions-constructs/aws-cloudfront-s3';

export class CdnStack extends Stack {

  public readonly source: Bucket;
  public readonly distribution: Distribution;

  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);
    const cdn = new CloudFrontToS3(this, 'Cdn', {});
    this.source = cdn.s3Bucket as Bucket;
    this.distribution = cdn.cloudFrontWebDistribution;
    new CfnOutput(this, 'URL', {
      value: 'https://' + cdn.cloudFrontWebDistribution.domainName,
    });
  }

}
