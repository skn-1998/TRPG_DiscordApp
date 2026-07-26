export type DiscordSendMessageResult =
  { readonly success: true; readonly messageId: string } | { readonly success: false; readonly error: string }

export type DiscordCreateChannelResult =
  { readonly success: true; readonly channelId: string } | { readonly success: false; readonly error: string }
