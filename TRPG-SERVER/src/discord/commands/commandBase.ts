export interface discordCommandBase {
  data(): void
  execute(): void
  autocomplete?(): void
}
