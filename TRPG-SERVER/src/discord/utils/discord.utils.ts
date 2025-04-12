import { CommandInteraction } from 'discord.js';

export async function handleError(
  interaction: CommandInteraction,
  error: unknown
): Promise<void> {
  if (error instanceof Error) {
    console.error('エラーが発生しました:', error.message);
    await interaction.reply('An error has occurred:  ' + error.message);
  } else {
    console.error('未知のエラーが発生しました');
    await interaction.reply('An unknown error has occurred.');
  }
}
