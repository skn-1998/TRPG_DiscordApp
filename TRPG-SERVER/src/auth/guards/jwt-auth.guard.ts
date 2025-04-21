import { Injectable, ExecutionContext, UnauthorizedException, Logger } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Observable } from 'rxjs';
import { AuthService } from '../auth.service';
import { Request } from 'express';

// リクエストの拡張型を定義
interface RequestWithUser extends Request {
  user: {
    userId: string;
    username: string;
  };
}

/**
 * JWT認証ガード
 * ルートの保護とJWTトークンの検証を行う
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  private readonly logger = new Logger(JwtAuthGuard.name);

  constructor(private readonly authService: AuthService) {
    super();
  }

  /**
   * リクエストを認証する
   * @param context 実行コンテキスト
   * @returns 認証結果
   */
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const authorization = request.headers.authorization;

    if (!authorization) {
      throw new UnauthorizedException('認証ヘッダーが必要です');
    }

    try {
      const token = await this.authService.validateToken(authorization);
      // リクエストオブジェクトのuserプロパティに設定
      // 型付きのリクエストオブジェクトとして処理
      (request as RequestWithUser).user = {
        userId: token.discordUserId,
        username: token.username
      };
      return true;
    } catch (error) {
      this.logger.error(`JWT認証エラー: ${error instanceof Error ? error.message : '不明なエラー'}`);
      throw new UnauthorizedException('認証に失敗しました');
    }
  }
} 