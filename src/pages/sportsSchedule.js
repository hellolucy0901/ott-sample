export function scheduleUrl(now = new Date()) {
  const start = new Date(now)
  const end = new Date(now)
  start.setUTCDate(start.getUTCDate() - 1)
  end.setUTCDate(end.getUTCDate() + 30)
  const day = date => date.toISOString().slice(0, 10)
  return `https://statsapi.mlb.com/api/v1/schedule?sportId=1&startDate=${day(start)}&endDate=${day(end)}&hydrate=linescore`
}

export function mlbGames(data) {
  return (data.dates || []).flatMap(date => date.games || []).filter(game => game.gamePk && game.teams?.away?.team && game.teams?.home?.team).map(game => {
    const state = game.status?.abstractGameState
    return {
      id: `mlb-${game.gamePk}`,
      league: 'MLB',
      away: game.teams.away.team.name,
      home: game.teams.home.team.name,
      awayScore: game.teams.away.score,
      homeScore: game.teams.home.score,
      venue: game.venue?.name || '',
      gameDate: game.gameDate,
      status: state === 'Live' ? 'LIVE' : state === 'Final' ? '종료' : state === 'Preview' ? '예정' : (game.status?.detailedState || '일정 확인'),
      inning: state === 'Live' && game.linescore?.currentInningOrdinal
        ? `${game.linescore.isTopInning ? '초' : '말'} ${game.linescore.currentInningOrdinal}` : '',
      demo: false,
    }
  })
}

export function recentHighlightsUrl(now = new Date()) {
  const start = new Date(now)
  start.setUTCDate(start.getUTCDate() - 45)
  const day = date => date.toISOString().slice(0, 10)
  return `https://statsapi.mlb.com/api/v1/schedule?sportId=1&startDate=${day(start)}&endDate=${day(now)}`
}

export function archiveHighlightsUrl(now = new Date()) {
  const year = now.getUTCFullYear() - 1
  return `https://statsapi.mlb.com/api/v1/schedule?sportId=1&startDate=${year}-09-01&endDate=${year}-11-10`
}

export function finishedGames(data) {
  return (data.dates || []).flatMap(date => date.games || [])
    .filter(game => game.status?.abstractGameState === 'Final')
    .sort((a, b) => new Date(b.gameDate) - new Date(a.gameDate))
    .slice(0, 18)
}

export function gameHighlight(game, content) {
  const items = content.highlights?.highlights?.items || []
  const preferred = items.find(item => /(?:game.*highlights|highlights.*game)/i.test(item.title || '') &&
    item.playbacks?.some(playback => playback.name === 'mp4Avc')) ||
    items.find(item => /condensed game/i.test(item.title || '') && item.playbacks?.some(playback => playback.name === 'mp4Avc'))
  if (!preferred) return null
  const url = preferred.playbacks.find(playback => playback.name === 'mp4Avc')?.url
  if (!url?.startsWith('https://mlb-cuts-diamond.mlb.com/')) return null
  const poster = preferred.image?.cuts?.find(cut => cut.width === 640 || cut.width === 480)?.src ||
    preferred.image?.cuts?.find(cut => cut.aspectRatio === '16:9')?.src
  return { id: `highlight-${game.gamePk}`, title: preferred.title, url, poster, game: mlbGames({ dates: [{ games: [game] }] })[0] }
}
