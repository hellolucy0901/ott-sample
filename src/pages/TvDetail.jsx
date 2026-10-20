import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useMovieStore } from '../store/useMovieStore';
export const TvDetail = () => {
    const { id } = useParams();
    const tvId = Number(id);
    const { tvs, tvVideo, tvDetails, seasons, episodes, onFetchTvVideo, onFetchSeason, onFetchEpisode, onFetchEpisodeVideo, onSearchYoutubeVideo } = useMovieStore();
    const [showPopup, setShowPopup] = useState(false);
    const [playVideo, setPlayVideo] = useState(null);
    const [videoLoading, setVideoLoading] = useState(null);
    const [selectedSeason, setSelectedSeason] = useState(null);
    const [error, setError] = useState('');
    const listTv = tvs.find((t) => t.id === tvId);
    const tv = tvDetails[tvId] || listTv;
    const seasonList = seasons[tvId] || [];
    const key = `${tvId}-${selectedSeason}`;
    const episodeList = episodes[key] || [];
    const video = tvVideo[tvId] || [];
    const trailer = video.find((v) => v.site === 'YouTube' && v.type === 'Trailer') || video.find((v) => v.site === 'YouTube');
    useEffect(() => {
        if (!Number.isInteger(tvId) || tvId <= 0) return;
        setError('');
        onFetchTvVideo(tvId).catch((err) => console.error('TV 영상 오류:', err));
        onFetchSeason(tvId).catch((err) => setError(err.message));
    }, [tvId, onFetchTvVideo, onFetchSeason]);
    useEffect(() => {
        setSelectedSeason(null);
        setShowPopup(false);
        setPlayVideo(null);
        setVideoLoading(null);
    }, [tvId]);
    
    useEffect(() => {
        if (selectedSeason !== null || seasonList.length === 0) return;
        const firstSeason = seasonList.find((s) => s.season_number === 1) || seasonList[0];
        setSelectedSeason(firstSeason.season_number);
    }, [seasonList, selectedSeason]);

    useEffect(() => {
        if (!Number.isInteger(tvId) || tvId <= 0 || selectedSeason === null) return;
        onFetchEpisode(tvId, selectedSeason).catch((err) => setError(err.message));
    }, [tvId, selectedSeason, onFetchEpisode]);
    const handlePopup = () => {
        if (!trailer) return alert('재생할 TV 예고편이 없습니다.');
        setPlayVideo(trailer.key);
        setShowPopup(true);
    };
    const handleEpisodePlay = async (episode) => {
        if (selectedSeason === null || videoLoading !== null) return;
        const episodeNumber = episode.episode_number;
        setVideoLoading(episodeNumber);
        try {
            let episodeVideo = null;
            try {
                const videos = await onFetchEpisodeVideo(tvId, selectedSeason, episodeNumber);
                episodeVideo = videos.find((v) => v.site === 'YouTube' && v.type === 'Trailer') || videos.find((v) => v.site === 'YouTube' && v.type === 'Clip') || videos.find((v) => v.site === 'YouTube');
            } catch (tmdbError) {
                console.warn('TMDB 영상 조회 실패, YouTube 검색으로 전환:', tmdbError);
            }
            if (!episodeVideo) {
                const youtubeResults = await onSearchYoutubeVideo(tv?.original_name || tv?.name || 'TV', selectedSeason, episodeNumber, episode.name);
                episodeVideo = youtubeResults[0];
            }
            if (!episodeVideo) return alert('검색 가능한 영상이 없습니다. 공식 영상이 등록되지 않았을 수 있습니다.');
            setPlayVideo(episodeVideo.key);
            setShowPopup(true);
        } catch (err) {
            console.error('에피소드 영상 오류:', err);
            alert(err.message || '영상을 불러오지 못했습니다.');
        } finally {
            setVideoLoading(null);
        }
    };
    const handleClose = () => {
        setShowPopup(false);
        setPlayVideo(null);
    };
    const handleSeason = (seasonNumber) => {
        setSelectedSeason(seasonNumber);
        handleClose();
    };
    const getImage = (path, size = 'w500') => path ? `https://image.tmdb.org/t/p/${size}${path}` : 'https://placehold.co/500x300?text=No+Image';
    if (!Number.isInteger(tvId) || tvId <= 0) return <p className="pt-30 text-center">잘못된 TV 주소입니다.</p>;
    return (
        <section className="sub-page pt-30">
            {/* ############ TV 상세정보 ############ */}
            <div className="inner flex gap-15">
                <div className="w-2/6">
                    <img src={getImage(tv?.poster_path)} alt={tv?.name || 'TV 포스터'} className="w-full" />
                </div>
                <div className="w-4/6">
                    <h2 className="text-5xl">{tv?.name}</h2>
                    <p className="mt-5">⭐ {tv?.vote_average?.toFixed(1) ?? '-'}</p>
                    <p className="mt-3">첫 방영일 : {tv?.first_air_date || '정보 없음'}</p>
                    <p className="my-10">{tv?.overview || '작품 설명이 없습니다.'}</p>
                    <div className="flex gap-5">
                        <button className="bg-black text-white p-4" onClick={handlePopup}>▶ 재생하기</button>
                        <button className="border p-4">♡ 찜하기</button>
                    </div>
                </div>
            </div>
            {/* ############ 시즌 및 에피소드 ############ */}
            <div className="inner mt-20 pb-20">
                <h2 className="text-3xl font-bold mb-8">시즌 및 에피소드</h2>
                {error && <p className="text-red-500 mb-5">{error}</p>}
                <div className="flex gap-3 mb-10 flex-wrap">
                    {seasonList.map((season) => (
                        <button key={season.id} onClick={() => handleSeason(season.season_number)} className={`border px-6 py-3 rounded-lg ${selectedSeason === season.season_number ? 'bg-black text-white' : 'bg-white text-black'}`}>
                            {season.name}
                        </button>
                    ))}
                </div>
                <div className="flex flex-col gap-8">
                    {episodeList.map((episode) => (
                        <div key={episode.id} className="flex gap-8 border-b pb-8">
                            <div className="w-2/6 shrink-0">
                                <img src={getImage(episode.still_path, 'w500')} alt={episode.name} className="w-full rounded-lg" />
                            </div>
                            <div className="flex-1">
                                <h3 className="text-xl font-bold mb-3">{episode.episode_number}화. {episode.name}</h3>
                                <p className="text-gray-500 mb-4">{episode.runtime ? `${episode.runtime}분` : '상영시간 미정'} · {episode.air_date || '방영일 미정'}</p>
                                <p className="text-gray-700 mb-5">{episode.overview || '에피소드 설명이 없습니다.'}</p>
                                <button className="bg-black text-white px-6 py-3 rounded-lg hover:bg-gray-700 disabled:opacity-50" onClick={() => handleEpisodePlay(episode)} disabled={videoLoading !== null}>
                                    {videoLoading === episode.episode_number ? '영상 검색 중...' : '▶ 재생하기'}
                                </button>
                            </div>
                        </div>
                    ))}
                    {selectedSeason !== null && episodes[key] && episodeList.length === 0 && <p>등록된 에피소드가 없습니다.</p>}
                </div>
            </div>
            {/* ############ 영상 팝업 ############ */}
            {showPopup && playVideo && (
                <div className="fixed inset-0 bg-black z-[10000]">
                    <button className="absolute right-5 top-5 bg-white text-black p-3 z-10" onClick={handleClose}>닫기 ✕</button>
                    <iframe key={playVideo} className="w-full h-full" src={`https://www.youtube.com/embed/${encodeURIComponent(playVideo)}?autoplay=1&mute=1`} title="영상 재생" allow="autoplay; encrypted-media; picture-in-picture" referrerPolicy="strict-origin-when-cross-origin" allowFullScreen></iframe>
                </div>
            )}
        </section>
    );
};
