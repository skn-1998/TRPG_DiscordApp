// src/dynamoose.config.ts
import * as dynamoose from 'dynamoose';
import 'dotenv/config'

export const configureDynamoose = () => {
  new dynamoose.aws.ddb.DynamoDB({
    region:  process.env.AWS_REGION || '',
    credentials:{
      accessKeyId: process.env.AWS_REGION || '',
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || ''
    }
  });
};
