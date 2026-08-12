import type { CharacterSheetVisibility } from '@trpg/api-contract'

export const SHEET_VISIBILITY_NOTICE =
  '公開閲覧の提供は準備中。Web では現在自分だけが見られます。Discord hub の表示はチャンネル権限に従います。公開閲覧の開始時には、公開内容の確認をあらためて求めます'

export const SHEET_VISIBILITY_LABELS: Record<CharacterSheetVisibility, string> = {
  private: '非公開',
  public: '公開'
}
