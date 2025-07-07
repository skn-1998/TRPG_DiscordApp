c:クライアント
s:サーバー

characterCard.tsx
const handleServerAdd = () => {
if (selectedServer) {
// ここで実際のサーバー追加処理を行う
const selectedServerName = discordServers.find((server) => server.value === selectedServer)?.label
console.log(`キャラクター "${character.characterName}" をサーバー "${selectedServerName}" に追加`)
setModalOpened(false)
setSelectedServer(null)
}
}

handleServerAddの処理の流れ
c:サーバーを選択し、
　　キャラクターIDとサーバーのチャンネルIDをサーバーに送る
s:受け取ったデータをdiscordBot経由で
