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
