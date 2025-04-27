import { Injectable } from '@nestjs/common'
import {
  ButtonBuilder,
  ButtonInteraction,
  ButtonStyle,
  CacheType,
  ChannelType,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder
} from 'discord.js'
import { discordButtonType } from 'src/discord/discord.type'
import { CharacterService } from 'src/domains/character/character.service'
import { isNull } from 'lodash'
import dice from 'src/discord/utils/dice'

@Injectable()
export class CharacterDiceButtonsService implements discordButtonType {
  constructor(private readonly characterService: CharacterService) {}
  
  // ButtonBuilderのインスタンスはdiscordButtonTypeのdataフィールドとして必要ですが、
  // 実際には動的に生成されるためここでは最小限のものを提供
  public data = new ButtonBuilder()
    .setCustomId('roll-1d100')
    .setLabel('1D100')
    .setStyle(ButtonStyle.Danger)
  
  /**
   * ボタンが押されたときの処理
   */
  async execute(interaction: ButtonInteraction<CacheType>): Promise<void> {
    try {
      // ボタンのカスタムIDを解析して、どのダイスロールが選択されたかを特定
      const customId = interaction.customId;
      
      // カスタムダイスロールの場合
      if (customId === 'roll-custom') {
        await this.handleCustomDiceRoll(interaction);
        return;
      }
      
      // 通常のスキルロールまたはダイスロールの処理
      const rollInfo = customId.replace('roll-', '').split('-');
      
      // diceRollのフォーマットを判断
      let diceCommand: string;
      let skillName: string | null = null;
      let skillValue: number | null = null;
      
      // スキルロールか通常のダイスロールかを判断
      if (rollInfo.length >= 2 && !rollInfo[0].startsWith('1d') && !rollInfo[0].startsWith('2d')) {
        // スキルロール
        skillName = rollInfo[0];
        skillValue = parseInt(rollInfo[1], 10);
        diceCommand = '1d100';
      } else {
        // 通常のダイスロール
        diceCommand = rollInfo[0];
      }
      
      // ダイスロールを実行
      const diceResult = await dice(diceCommand);
      if (isNull(diceResult)) {
        await interaction.reply({ content: 'ダイスロールに失敗しました', ephemeral: true });
        return;
      }
      
      // スキルロールの場合は成功/失敗判定を行う
      let resultMessage = diceResult.text || `${diceCommand}の結果: 不明`;
      
      if (skillName && skillValue !== null && diceResult.text) {
        // ダイス目を数値として抽出
        const diceResultMatch = diceResult.text.match(/\d+/);
        const rollValue = diceResultMatch ? parseInt(diceResultMatch[0], 10) : 0;
        
        if (rollValue > 0) {
          let successStatus: string;
          
          if (rollValue <= Math.floor(skillValue * 0.05)) {
            successStatus = '**クリティカル成功**！';
          } else if (rollValue <= Math.floor(skillValue * 0.2)) {
            successStatus = '**スペシャル成功**！';
          } else if (rollValue <= skillValue) {
            successStatus = '**成功**';
          } else if (rollValue >= 96 && skillValue < 50) {
            successStatus = '**致命的失敗**...';
          } else if (rollValue >= 100) {
            successStatus = '**致命的失敗**...';
          } else {
            successStatus = '**失敗**';
          }
          
          resultMessage = `🎲 **${skillName}** ロール: ${rollValue} [${successStatus}] (技能値: ${skillValue}%)`;
        }
      }
      
      // スレッドのチャンネルタイプ確認
      if (interaction.channel?.type !== ChannelType.PublicThread) {
        await interaction.reply({ content: resultMessage });
        return;
      }
      
      // 親チャンネルIDの確認
      const parentChannelId = interaction.channel.parentId;
      if (isNull(parentChannelId)) {
        await interaction.reply({ content: resultMessage });
        return;
      }
      
      // インタラクションに応答
      await interaction.reply({ content: resultMessage });
      
    } catch (error) {
      console.error('ダイスボタン処理エラー:', error);
      
      // エラーが発生した場合、通知
      await interaction.reply({ content: 'エラーが発生しました。もう一度お試しください。', ephemeral: true });
    }
  }
  
  /**
   * カスタムダイスロールのモーダルを表示
   */
  private async handleCustomDiceRoll(interaction: ButtonInteraction): Promise<void> {
    try {
      // モーダルを作成
      const modal = new ModalBuilder()
        .setCustomId('custom-dice-modal')
        .setTitle('カスタムダイスロール');
      
      // ダイスコマンド入力フィールド
      const diceCommandInput = new TextInputBuilder()
        .setCustomId('dice-command')
        .setLabel('ダイスコマンド（例: 2d6+3, 1d100）')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('1d100')
        .setRequired(true)
        .setMinLength(1)
        .setMaxLength(20);
      
      // コメント入力フィールド
      const commentInput = new TextInputBuilder()
        .setCustomId('dice-comment')
        .setLabel('コメント（任意）')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('任意のコメント')
        .setRequired(false)
        .setMaxLength(50);
      
      // アクションロウにフィールドを追加
      const firstActionRow = new ActionRowBuilder<TextInputBuilder>().addComponents(diceCommandInput);
      const secondActionRow = new ActionRowBuilder<TextInputBuilder>().addComponents(commentInput);
      
      // モーダルにアクションロウを追加
      modal.addComponents(firstActionRow, secondActionRow);
      
      // モーダルを表示
      await interaction.showModal(modal);
      
    } catch (error) {
      console.error('カスタムダイスモーダル作成エラー:', error);
      await interaction.reply({ content: 'エラーが発生しました。もう一度お試しください。', ephemeral: true });
    }
  }
} 