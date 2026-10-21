import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { onAuthStateChanged } from 'firebase/auth'
import { addDoc, collection, limit, onSnapshot, orderBy, query, serverTimestamp } from 'firebase/firestore'
import { auth, db } from '../firebase/firebase'
import { archiveHighlightsUrl, finishedGames, gameHighlight, mlbGames, recentHighlightsUrl, scheduleUrl } from './sportsSchedule'
import './Sports.css'

const demoGames = [
  ['잠실', 'LG 트윈스', '두산 베어스'],
  ['대구', '삼성 라이온즈', 'KIA 타이거즈'],
  ['대전', '한화 이글스', '롯데 자이언츠'],
  ['인천', 'SSG 랜더스', '키움 히어로즈'],
  ['창원', 'NC 다이노스', 'KT 위즈'],
].map(([venue, away, home], index) => ({ id: `demo-${index + 1}`, venue, away, home, demo: true }))

function validEmbed(value) {
  try {
    const url = new URL(value)
    return url.protocol === 'https:' ? url.href : null
  } catch { return null }
}

function GameChat({ game }) {
  const [user, setUser] = useState(null)
  const [messages, setMessages] = useState([])
  const [text, setText] = useState('')
  const [error, setError] = useState('')
  const [connected, setConnected] = useState(false)
  const [sending, setSending] = useState(false)
  const end = useRef(null)

  useEffect(() => {
    if (!auth) return
    return onAuthStateChanged(auth, (nextUser) => {
      setUser(nextUser)
      setMessages([])
      setConnected(false)
      setError('')
    })
  }, [])

  useEffect(() => {
    if (!user || !auth) return
    const room = query(collection(db, 'sportsRooms', game.id, 'messages'), orderBy('createdAt', 'desc'), limit(100))
    return onSnapshot(room, (snapshot) => {
      setMessages(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })).reverse())
      setConnected(true)
      setError('')
    }, () => {
      setConnected(false)
      setError('채팅에 연결하지 못했습니다. Firebase 연결과 접근 권한을 확인해 주세요.')
    })
  }, [game.id, user])

  useEffect(() => { end.current?.scrollIntoView({ block: 'nearest' }) }, [messages])

  async function send(event) {
    event.preventDefault()
    const body = text.trim()
    if (!body || !user || !connected || sending) return
    setSending(true)
    setError('')
    try {
      await addDoc(collection(db, 'sportsRooms', game.id, 'messages'), {
        text: body, uid: user.uid, name: (user.displayName || '야구팬').slice(0, 100), createdAt: serverTimestamp(),
      })
      setText('')
    } catch { setError('전송하지 못했습니다. 잠시 후 다시 시도해 주세요.') }
    finally { setSending(false) }
  }

  return <aside className="sports-chat" aria-label="경기 채팅">
    <div className="sports-chat-heading"><h2>함께 응원해요</h2><span>{connected ? '● 실시간 연결' : '연결 대기'}</span></div>
    <p className="sports-chat-notice">같은 경기를 선택한 시청자와 나누는 실시간 채팅</p>
    <div className="sports-messages" role="log" aria-label="채팅 메시지" aria-live="polite">
      {!auth ? <p className="sports-empty">Firebase 설정 후 실시간 채팅을 이용할 수 있습니다.</p>
        : !user ? <p className="sports-empty"><Link to="/login">로그인</Link>하고 응원에 참여해 주세요.</p>
        : messages.length === 0 ? <p className="sports-empty">아직 메시지가 없어요.<br />첫 응원을 남겨 보세요! ⚾</p> : null}
      {messages.map(message => <div className={`sports-message ${message.uid === user?.uid ? 'mine' : ''}`} key={message.id}>
        <strong>{message.name}</strong><p>{message.text}</p>
        <time>{message.createdAt?.toDate?.().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }) || '전송 중'}</time>
      </div>)}
      <div ref={end} />
    </div>
    {error && <p className="sports-error" role="alert">{error}</p>}
    <form onSubmit={send} className="sports-chat-form">
      <label htmlFor="sports-message" className="sports-sr-only">응원 메시지</label>
      <input id="sports-message" value={text} onChange={event => setText(event.target.value)} maxLength={300} disabled={!connected} placeholder="응원 메시지를 남겨 주세요" autoComplete="off" />
      <button disabled={!connected || !text.trim() || sending}>{sending ? '전송 중' : '전송'}</button>
    </form>
    <p className="sports-chat-notice">서로 존중하며 응원해 주세요 · 최대 300자</p>
  </aside>
}

export function Sports() {
  const [games, setGames] = useState(demoGames)
  const [selectedId, setSelectedId] = useState(null)
  const [sourceError, setSourceError] = useState('')
  const [videoError, setVideoError] = useState('')
  const [highlights, setHighlights] = useState([])
  const [highlightError, setHighlightError] = useState('')
  const [selectedHighlight, setSelectedHighlight] = useState(null)
  const watchRef = useRef(null)
  const source = import.meta.env.VITE_SPORTS_SCHEDULE_URL
  const streamSource = import.meta.env.VITE_SPORTS_STREAMS_URL
  useEffect(() => {
    const controller = new AbortController()
    async function refresh() {
      try {
        const response = await fetch(source || scheduleUrl(), { signal: controller.signal })
        if (!response.ok) throw new Error('schedule')
        const data = await response.json()
        let next
        if (source) {
          if (!Array.isArray(data) || data.length < 5 || data.some(game =>
            !/^[a-zA-Z0-9_-]{1,100}$/.test(game.id) || typeof game.home !== 'string' || typeof game.away !== 'string' ||
            (game.embedUrl && !validEmbed(game.embedUrl))) || new Set(data.map(game => game.id)).size !== data.length) throw new Error('format')
          next = data.map(game => ({ ...game, demo: false }))
        } else {
          next = mlbGames(data)
          if (streamSource) {
            try {
              const streamResponse = await fetch(streamSource, { signal: controller.signal })
              if (!streamResponse.ok) throw new Error('streams')
              const streams = await streamResponse.json()
              if (!streams || typeof streams !== 'object' || Array.isArray(streams)) throw new Error('stream format')
              next = next.map(game => ({ ...game, embedUrl: validEmbed(streams[game.id]) || undefined }))
              setVideoError('')
            } catch (error) {
              if (error.name === 'AbortError') return
              setVideoError('영상 목록을 불러오지 못했습니다. 중계 설정을 확인해 주세요.')
            }
          }
        }
        if (next.length === 0) {
          setGames(demoGames)
          setSourceError('표시할 실제 경기가 없어 KBO 데모 목록을 표시합니다.')
        } else {
          setGames(next)
          setSourceError('')
        }
      } catch (error) {
        if (error.name !== 'AbortError') setSourceError('실제 경기 정보를 불러오지 못해 KBO 데모 목록을 표시합니다.')
      }
    }
    refresh()
    const timer = setInterval(refresh, 30000)
    const onFocus = () => refresh()
    window.addEventListener('focus', onFocus)
    return () => { clearInterval(timer); window.removeEventListener('focus', onFocus); controller.abort() }
  }, [source, streamSource])
  useEffect(() => {
    const controller = new AbortController()
    async function loadHighlights() {
      try {
        async function schedule(url) {
          const response = await fetch(url, { signal: controller.signal })
          if (!response.ok) throw new Error('highlight schedule')
          return finishedGames(await response.json())
        }
        let finished = await schedule(recentHighlightsUrl())
        if (finished.length < 5) finished = await schedule(archiveHighlightsUrl())
        const videos = await Promise.all(finished.map(async game => {
          try {
            const response = await fetch(`https://statsapi.mlb.com/api/v1/game/${game.gamePk}/content`, { signal: controller.signal })
            return response.ok ? gameHighlight(game, await response.json()) : null
          } catch { return null }
        }))
        if (controller.signal.aborted) return
        const playable = videos.filter(Boolean).slice(0, 12)
        setHighlights(playable)
        setHighlightError(playable.length ? '' : '지금 재생할 수 있는 공식 하이라이트를 찾지 못했습니다.')
      } catch (error) {
        if (error.name !== 'AbortError') setHighlightError('하이라이트 목록을 불러오지 못했습니다.')
      }
    }
    loadHighlights()
    return () => controller.abort()
  }, [])
  useEffect(() => {
    if (selectedHighlight) watchRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [selectedHighlight])
  const selected = games.find(game => game.id === selectedId) || games.find(game => game.status === 'LIVE') || games[0]
  const activeGame = selectedHighlight?.game || selected
  const embed = selectedHighlight ? null : validEmbed(selected.embedUrl)
  const gameTime = game => game.gameDate ? new Date(game.gameDate).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : ''
  return <main className="sports-page">
    <div className="sports-container">
      <div className="sports-title"><div><p className="sports-eyebrow">PLAY TOGETHER</p><h1>스포츠 <span>⚾</span></h1><p>좋아하는 팀의 경기, 함께 보면 더 즐거우니까.</p></div><span className="sports-league">BASEBALL · 야구</span></div>
      {sourceError && <p role="alert" className="sports-error">{sourceError}</p>}
      {videoError && <p role="alert" className="sports-error">{videoError}</p>}
      {selected.demo && <p className="sports-demo">KBO 데모 편성표 · 실제 경기 일정이나 생중계가 아닙니다. 중계 제공 업체 연결 후 실시간 영상을 시청할 수 있습니다.</p>}
      {!selected.demo && !source && <p className="sports-demo">MLB 실제 경기 일정·점수 · 30초마다 갱신합니다. 영상 중계는 별도 제공 업체 연결이 필요합니다.</p>}
      <section className="sports-game-list" aria-label="야구 경기 목록">
        {games.map(game => <button key={game.id} onClick={() => { setSelectedId(game.id); setSelectedHighlight(null) }} aria-pressed={!selectedHighlight && game.id === selected.id} className={`sports-game ${!selectedHighlight && game.id === selected.id ? 'selected' : ''}`}>
          <span className="sports-game-meta"><span className={game.status === 'LIVE' ? 'sports-live' : ''}>{game.demo ? 'KBO DEMO' : `${game.league || 'BASEBALL'} · ${game.status || '일정'}`}</span><span>{gameTime(game) || game.venue || '야구 경기장'}</span></span>
          <strong>{game.away}{game.awayScore != null ? ` ${game.awayScore}` : ''}</strong><span className="sports-vs">{game.inning || 'VS'}</span><strong>{game.home}{game.homeScore != null ? ` ${game.homeScore}` : ''}</strong><span className="sports-game-action">{game.id === selected.id ? '선택한 경기' : validEmbed(game.embedUrl) ? '중계 보기 →' : '경기 정보 보기 →'}</span>
        </button>)}
      </section>
      <section className="sports-playlist" aria-label="경기 하이라이트 재생 목록">
        <div className="sports-playlist-heading"><div><span className="sports-eyebrow">REPLAY THE MOMENT</span><h2>경기 하이라이트</h2></div><span>MLB 공식 영상 · 종료된 경기</span></div>
        {highlightError && <p className="sports-error" role="status">{highlightError}</p>}
        {!highlightError && highlights.length === 0 && <p className="sports-playlist-loading">재생할 경기를 찾는 중...</p>}
        <div className="sports-playlist-list">{highlights.map(video => <button key={video.id} className={`sports-playlist-item ${selectedHighlight?.id === video.id ? 'selected' : ''}`} onClick={() => { setSelectedHighlight(video); setSelectedId(null) }} aria-pressed={selectedHighlight?.id === video.id}>
          {video.poster && <img src={video.poster} alt="" loading="lazy" />}
          <span className="sports-playlist-copy"><strong>{video.title}</strong><small>{gameTime(video.game)} · {video.game.away} vs {video.game.home}</small><em>▶ 영상 재생</em></span>
        </button>)}</div>
      </section>
      <div className="sports-watch-layout" ref={watchRef}>
        <section className="sports-broadcast" aria-label="선택한 경기 중계">
          <div className="sports-video">{selectedHighlight ? <video key={selectedHighlight.id} controls playsInline preload="metadata" poster={selectedHighlight.poster} src={selectedHighlight.url} aria-label={selectedHighlight.title}>브라우저에서 영상을 재생할 수 없습니다.</video>
            : embed ? <iframe key={selected.id} src={embed} title={`${selected.away} 대 ${selected.home} 중계`} allow="autoplay; encrypted-media; fullscreen; picture-in-picture" allowFullScreen referrerPolicy="strict-origin-when-cross-origin" />
            : <div className="sports-video-empty"><span>⚾</span><h2>경기의 설렘을, 함께</h2><p>아직 연결된 실시간 중계가 없습니다.</p><small>공식 중계 영상이 연결되면 이곳에서 시청할 수 있어요.</small></div>}</div>
          <div className="sports-broadcast-info"><span className="sports-eyebrow">{selectedHighlight ? 'MLB HIGHLIGHTS · REPLAY' : activeGame.demo ? 'KBO DEMO MATCH' : `${activeGame.league || 'BASEBALL'} · ${activeGame.status || '경기'}`}</span><h2>{selectedHighlight?.title || <>{activeGame.away}{activeGame.awayScore != null ? ` ${activeGame.awayScore}` : ''} <span>vs</span> {activeGame.home}{activeGame.homeScore != null ? ` ${activeGame.homeScore}` : ''}</>}</h2><p>{gameTime(activeGame)} {activeGame.venue} · 경기별 채팅방에서 함께 응원하세요</p>{activeGame.league === 'MLB' && <a className="sports-official-link" href={`https://www.mlb.com/gameday/${activeGame.id.slice(4)}`} target="_blank" rel="noopener noreferrer">MLB 공식 경기 페이지 보기 ↗</a>}</div>
        </section>
        <GameChat key={activeGame.id} game={activeGame} />
      </div>
    </div>
  </main>
}
