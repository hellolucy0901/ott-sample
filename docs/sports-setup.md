# 스포츠 페이지 설정

`/sports`는 기본적으로 [MLB StatsAPI](https://statsapi.mlb.com/api/v1/schedule?sportId=1)를 사용해 실제 경기 일정·점수를 30초 간격으로 가져옵니다. 경기 영상은 이 API에 포함되지 않습니다. 비시즌이나 연결 실패로 표시할 경기가 없으면 KBO 팀으로 구성한 **가상 편성 5경기**가 나타납니다. 이 목록은 실제 일정이나 영상이 아닙니다.

## 실제 경기 영상 연결

MLB 경기 영상은 공식 중계 권한 및 임베드 허용이 있는 제공 업체에서 받아야 합니다. MLB StatsAPI는 영상 재생 URL을 주지 않으며, MLB.TV 구독 화면이나 방송사 페이지 URL을 임의로 iframe에 넣어도 재생되지 않을 수 있습니다. 비공식 스트림을 연결하지 마세요.

권한 있는 HTTPS iframe URL을 확보했다면 `VITE_SPORTS_STREAMS_URL`에 영상 목록 JSON의 공개 주소를 설정하세요. 예를 들어 `/sports-streams.json`처럼 같은 출처의 파일을 사용할 수 있습니다. JSON 객체의 키는 MLB 경기 ID이며, 값은 해당 경기의 임베드 URL입니다.

```json
{
  "mlb-849805": "https://your-authorized-provider.example/embed/game-849805"
}
```

위 URL은 형식 설명용입니다. 경기 ID는 MLB 일정 응답의 `gamePk`에 `mlb-`를 붙인 값입니다. 영상이 없는 경기는 안내 화면을 보여 줍니다. 목록을 30초마다 다시 읽으므로 경기 시작 후 URL을 제공해도 페이지를 새로고침하지 않아도 반영됩니다. 제공 업체가 요구하는 로그인, DRM, 시청 지역 제한은 해당 업체의 공식 절차를 따라야 합니다. 영상을 공개할 수 없는 키나 토큰을 JSON에 넣지 마세요. 브라우저가 JSON과 iframe 주소를 모두 볼 수 있습니다.

### 자체 경기·영상 목록

KBO처럼 별도 제공처에서 일정과 임베드 URL을 함께 받을 경우, Vite 실행 환경에 `VITE_SPORTS_SCHEDULE_URL`을 설정하고 개발 서버를 재시작하세요. URL은 브라우저에서 GET 가능한 JSON API 또는 정적 JSON 파일이어야 합니다. 다른 출처이면 CORS를 허용해야 합니다. 응답은 다음 객체를 **5개 이상**, 고유한 `id`로 포함하는 배열입니다.

```json
[
  {
    "id": "kbo-game-unique-id",
    "away": "LG 트윈스",
    "home": "두산 베어스",
    "venue": "잠실",
    "embedUrl": "https://your-authorized-provider.example/embed/game-id"
  }
]
```

위 예시는 형식 설명용이며 실제 주소가 아닙니다. 실제 경기의 권한 있는 HTTPS iframe 임베드 URL만 등록하세요. 제공 업체가 iframe 임베드를 허용해야 합니다. 일반 시청 페이지나 m3u8 주소를 직접 입력하는 방식은 지원하지 않습니다. `id`는 1~100자의 영문, 숫자, `_`, `-`를 사용하세요. 동일한 실제 경기는 같은 ID를 사용해야 채팅방이 유지됩니다. 중계 상태와 편성의 정확성은 제공 API가 책임집니다. 현재 페이지를 열 때 목록을 가져오며 목록 갱신은 새로고침으로 반영됩니다. 연결 실패·잘못된 응답 시 명시적으로 데모 목록으로 돌아갑니다. 이 설정이 있으면 기본 MLB 일정 대신 자체 목록을 사용합니다.

## 실시간 채팅

기존 Firebase 프로젝트와 Google 로그인을 사용합니다. 기존 `VITE_FIREBASE_*` 설정과 Firebase Authentication의 Google 로그인 및 허용 도메인 설정이 필요합니다. Firebase 키가 없으면 앱을 중단시키는 대신 채팅 설정 안내를 표시합니다.

경기별 메시지 경로는 `sportsRooms/{gameId}/messages/{messageId}`입니다. 최근 100개 메시지를 Firestore 구독으로 동기화합니다. 같은 경기의 다른 브라우저·기기 사용자에게도 공유됩니다. 익명 로컬 메시지나 가짜 접속자 수를 표시하지 않습니다. 로그인한 사용자만 읽고 쓸 수 있도록 다음 규칙을 기존 Firestore 규칙에 **병합**하세요. 기존 users 등 다른 컬렉션의 규칙을 대체하지 마세요. 기존의 광범위 허용 규칙이 이 경로에도 적용되면 아래 제한을 우회하므로 함께 점검해야 합니다.

```text
match /sportsRooms/{gameId}/messages/{messageId} {
  allow read: if request.auth != null;
  allow create: if request.auth != null
    && request.resource.data.keys().hasAll(['uid', 'name', 'text', 'createdAt'])
    && request.resource.data.keys().hasOnly(['uid', 'name', 'text', 'createdAt'])
    && request.resource.data.uid == request.auth.uid
    && request.resource.data.name is string
    && request.resource.data.name.size() > 0
    && request.resource.data.name.size() <= 100
    && request.resource.data.text is string
    && request.resource.data.text.size() > 0
    && request.resource.data.text.size() <= 300
    && request.resource.data.createdAt == request.time;
  allow update, delete: if false;
}
```

이 규칙은 프로젝트에 자동 배포되지 않습니다. 운영 공개 전에는 남용 방지, 신고·차단, 보관 기간 정책을 별도 적용하세요. Firebase 클라이언트 설정과 영상 URL은 브라우저에 공개되므로 서버 비밀 키를 넣지 마세요.

## 확인

1. `npm run build`로 컴파일을 확인합니다.
2. `/sports`에서 스포츠가 메뉴 마지막에 있고 MLB의 실제 경기 목록이 표시되는지 확인합니다. 비시즌에는 KBO 데모 목록이 표시됩니다.
3. 경기를 바꾸면 경기 제목과 채팅방이 함께 바뀌는지 확인합니다.
4. 권한 있는 영상 목록 URL을 설정하고 제공처가 허용한 브라우저에서 실제 영상이 재생되는지 확인합니다.
5. Firebase 설정과 규칙 적용 후 두 브라우저에서 Google 로그인하고 같은 경기에서 메시지를 주고받으세요. 다른 경기에서는 메시지가 분리되어야 합니다.
6. 로그아웃, 권한 거부, 네트워크 단절 시 전송이 제한되고 오류가 안내되는지 확인합니다.
