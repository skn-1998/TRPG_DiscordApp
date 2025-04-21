import { registerAs } from '@nestjs/config';
import { env } from './environment';

/**
 * Discord関連の設定
 */
export const DiscordConfig = registerAs('discord', () => ({
  /**
   * DiscordボットトークンAPI
   */
  token: env.TOKEN,
  
  /**
   * DiscordアプリケーションID
   */
  applicationId: env.DISCORD_APPLICATIONID,
  
  /**
   * Discord API接続設定
   */
  guild: {
    /**
     * Discord GuildID
     */
    id: env.GUILDID,
  },
  
  /**
   * カテゴリー名設定
   */
  categories: {
    /**
     * キャラクターカテゴリー名
     */
    character: 'キャラクター',
  },
})); 