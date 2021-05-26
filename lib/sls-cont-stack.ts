import { join } from 'path';
import { Construct, Stack, StackProps } from '@aws-cdk/core';
import { Vpc } from '@aws-cdk/aws-ec2';
import { AuthorizationType } from '@aws-cdk/aws-apigateway';
import { ApiGatewayToLambda } from '@aws-solutions-constructs/aws-apigateway-lambda';
import { DockerImageFunction, DockerImageCode } from '@aws-cdk/aws-lambda';
import { RetentionDays } from '@aws-cdk/aws-logs';
import { CustomSlsContProps } from './context-helper';

export interface SlsContProps extends StackProps {
  customSlsCont: CustomSlsContProps,
  vpc: Vpc,
}

export class SlsContStack extends Stack {

  public readonly func: DockerImageFunction;

  constructor(scope: Construct, id: string, slsContProps: SlsContProps) {
    super(scope, id, slsContProps);
    const lambdaCode = DockerImageCode.fromImageAsset(join(__dirname, 'sls-cont-dummy'));
    const lambdaObj = new DockerImageFunction(this, 'LambdaObj', {
      code: lambdaCode,
      memorySize: slsContProps.customSlsCont.spec.mem,
      vpc: slsContProps.vpc,
      logRetention: RetentionDays.ONE_DAY,
    });
    this.func = lambdaObj;
    const methodOpts = {
      // ToDo: change type to custom or Cognito once the auth mechanism is added
      authorizationType: AuthorizationType.NONE,
    };
    const apiGatewayProps = {
      defaultMethodOptions: methodOpts,
    };
    new ApiGatewayToLambda(this, 'SlsCont', {
      existingLambdaObj: lambdaObj,
      apiGatewayProps,
    });
  }

}
