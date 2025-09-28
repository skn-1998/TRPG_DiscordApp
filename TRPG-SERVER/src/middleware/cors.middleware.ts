import { Injectable, NestMiddleware } from '@nestjs/common'
import { Request, Response, NextFunction } from 'express'
import 'dotenv/config'

@Injectable()
export class CorsMiddleware implements NestMiddleware {
  use(_req: Request, _res: Response, next: NextFunction) {
    // res.header('Access-Control-Allow-Origin', process.env.CLIENT_URL_DEVELOP);
    // res.header('Access-Control-Allow-Credentials')
    // res.header(
    //   'Access-Control-Allow-Headers',
    //   'Origin, X-Requested-With, Content-Type, Accept',
    // );
    next()
  }
}
