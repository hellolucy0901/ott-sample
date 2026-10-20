import { create } from "zustand";
const TMDB_KEY = import.meta.env.VITE_TMDB_API_KEY;
const YOUTUBE_KEY = import.meta.env.VITE_YOUTUBE_API_KEY;
export const useMovieStore = create((set, get) => ({
    // ############ 인기 영화
    popMovies: [],
    onFetchPopular: async () => {
        const res = await fetch(`https://api.themoviedb.org/3/movie/popular?api_key=${TMDB_KEY}&language=ko-KR&page=1`);
        if (!res.ok) throw new Error("인기 영화를 불러오지 못했습니다.");
        const data = await res.json();
        console.log("영화",data.results)
        set({ popMovies: data.results ?? [] });
    },
    popVideo: {},
    onFetchVideo: async (id) => {
        if (get().popVideo[id]) return get().popVideo[id];
        const res = await fetch(`https://api.themoviedb.org/3/movie/${id}/videos?api_key=${TMDB_KEY}&language=ko-KR`);
        if (!res.ok) throw new Error("영화 영상을 불러오지 못했습니다.");
        const data = await res.json();
        const videos = data.results ?? [];
        set((state) => ({ popVideo: { ...state.popVideo, [id]: videos } }));
        return videos;
    },
    // ############ 인기 TV
    tvs: [],
    tvVideo: {},
    onFetchTv: async () => {
        const res = await fetch(`https://api.themoviedb.org/3/tv/popular?api_key=${TMDB_KEY}&language=ko-KR&page=1`);
        if (!res.ok) throw new Error("TV 목록을 불러오지 못했습니다.");
        const data = await res.json();
        console.log("tv",data.results)
        set({ tvs: data.results ?? [] });
    },
    onFetchTvVideo: async (id) => {
        if (get().tvVideo[id]) return get().tvVideo[id];
        const res = await fetch(`https://api.themoviedb.org/3/tv/${id}/videos?api_key=${TMDB_KEY}&language=en-US`);
        if (!res.ok) throw new Error("TV 영상을 불러오지 못했습니다.");
        const data = await res.json();
        const videos = data.results ?? [];
        set((state) => ({ tvVideo: { ...state.tvVideo, [id]: videos } }));
        return videos;
    },
    // ############ 시즌 및 상세정보
    tvDetails: {},
    seasons: {},
    onFetchSeason: async (id) => {
        if (get().seasons[id]) return get().seasons[id];
        const res = await fetch(`https://api.themoviedb.org/3/tv/${id}?api_key=${TMDB_KEY}&language=ko-KR`);
        if (!res.ok) throw new Error("시즌 정보를 불러오지 못했습니다.");
        const data = await res.json();
        const seasonList = data.seasons ?? [];
        set((state) => ({ tvDetails: { ...state.tvDetails, [id]: data }, seasons: { ...state.seasons, [id]: seasonList } }));
        return seasonList;
    },
    // ############ 에피소드 목록
    episodes: {},
    onFetchEpisode: async (id, season) => {
        const key = `${id}-${season}`;
        if (get().episodes[key]) return get().episodes[key];
        const res = await fetch(`https://api.themoviedb.org/3/tv/${id}/season/${season}?api_key=${TMDB_KEY}&language=ko-KR`);
        if (!res.ok) throw new Error("에피소드를 불러오지 못했습니다.");
        const data = await res.json();
        const episodeList = data.episodes ?? [];
        set((state) => ({ episodes: { ...state.episodes, [key]: episodeList } }));
        return episodeList;
    },
    // ############ TMDB 에피소드 영상
    episodeVideos: {},
    onFetchEpisodeVideo: async (id, season, episode) => {
        const key = `${id}-${season}-${episode}`;
        if (get().episodeVideos[key]) return get().episodeVideos[key];
        const res = await fetch(`https://api.themoviedb.org/3/tv/${id}/season/${season}/episode/${episode}/videos?api_key=${TMDB_KEY}&language=en-US`);
        if (!res.ok) throw new Error("TMDB 에피소드 영상 불러오기 실패");
        const data = await res.json();
        const videos = data.results ?? [];
        set((state) => ({ episodeVideos: { ...state.episodeVideos, [key]: videos } }));
        return videos;
    },
    // ############ YouTube 검색 (TMDB 영상이 없을 때 사용)
    youtubeVideos: {},
    onSearchYoutubeVideo: async (tvName, season, episode, episodeName = "") => {
        const key = `${tvName}-${season}-${episode}`;
        if (get().youtubeVideos[key]) return get().youtubeVideos[key];
        if (!YOUTUBE_KEY) throw new Error(".env에 VITE_YOUTUBE_API_KEY를 설정하세요.");
        const query = [tvName, `season ${season}`, `episode ${episode}`, episodeName, "official"].filter(Boolean).join(" ");
        const params = new URLSearchParams({ part: "snippet", q: query, type: "video", videoEmbeddable: "true", maxResults: "5", key: YOUTUBE_KEY });
        const res = await fetch(`https://www.googleapis.com/youtube/v3/search?${params.toString()}`);
        if (!res.ok) throw new Error(`YouTube 검색 실패 (${res.status}). API 키 및 할당량을 확인하세요.`);
        const data = await res.json();
        const videos = (data.items ?? []).filter((item) => item.id?.videoId).map((item) => ({ key: item.id.videoId, name: item.snippet?.title ?? "YouTube 영상", site: "YouTube", type: "YouTubeSearch" }));
        set((state) => ({ youtubeVideos: { ...state.youtubeVideos, [key]: videos } }));
        return videos;
    }
}));
