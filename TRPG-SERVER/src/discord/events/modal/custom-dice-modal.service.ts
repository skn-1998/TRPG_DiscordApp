import { Injectable } from '@nestjs/common'
import { ModalBuilder, ModalSubmitInteraction, CacheType } from 'discord.js'
import { discordModalType } from 'src/discord/discord.type'
import dice from 'src/discord/utils/dice'

@Injectable()
export class CustomDiceModalService implements discordModalType {
  // モーダルの定義（実際にはボタンからshowModalで表示されるため、ここではダミーのインスタンスを提供）
  public data = new ModalBuilder()
    .setCustomId('custom-dice-modal')
    .setTitle('カスタムダイスロール')
  
  /**
   * モーダルが送信されたときの処理
   */
  async execute(interaction: ModalSubmitInteraction<CacheType>): Promise<void> {
    try {
      // ダイスコマンドの取得
      const diceCommand = interaction.fields.getTextInputValue('dice-command');
      // コメントの取得（任意）
      const comment = interaction.fields.getTextInputValue('dice-comment');
      
      // コマンドのバリデーション
      const validDiceCommand = this.validateDiceCommand(diceCommand);
      
      if (!validDiceCommand) {
        await interaction.reply({ 
          content: '無効なダイスコマンドです。正しい形式（例: 1d100, 2d6+3）で入力してください。',
          ephemeral: true 
        }); 
        return;
      }
      
      // ダイスロールを実行
      const diceResult = await dice(validDiceCommand);
      
      if (!diceResult || !diceResult.text) {
        await interaction.reply({ 
          content: 'ダイスロールに失敗しました。別のコマンドを試してください。',
          ephemeral: true 
        });
        return;
      }
      
      // 結果メッセージの構築
      let resultMessage = diceResult.text;
      
      // コメントが指定されている場合は追加
      if (comment && comment.trim() !== '') {
        resultMessage = `【${comment}】 ${resultMessage}`;
      }
      
      // 結果を返信
      await interaction.reply({ content: resultMessage });
      
    } catch (error) {
      console.error('カスタムダイスモーダル処理エラー:', error);
      
      // エラーが発生した場合、エラーメッセージを返信
      if (!interaction.replied) {
        await interaction.reply({ 
          content: 'エラーが発生しました。もう一度お試しください。',
          ephemeral: true 
        });
      }
    }
  }
  
  /**
   * ダイスコマンドをバリデーションして整形する
   */
  private validateDiceCommand(command: string): string | null {
    // 基本的なダイスコマンドのパターン（例: 1d100, 2d6+3）
    const dicePattern = /^\s*(\d+)[dD](\d+)([\+\-]\d+)?\s*$/;
    const match = command.match(dicePattern);
    
    if (!match) {
      return null;
    }
    
    // マッチした場合、整形された形式で返す
    const numDice = parseInt(match[1], 10);
    const diceSize = parseInt(match[2], 10);
    const modifier = match[3] || '';
    
    // 極端な値をチェック（サーバー負荷対策）
    if (numDice > 100 || diceSize > 1000) {
      return null;
    }
    
    return `${numDice}d${diceSize}${modifier}`;
  }
} 