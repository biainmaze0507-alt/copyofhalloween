# 망가진 단말기 — 구글 스프레드시트 버전

[synchalloween](https://synchalloween-production.up.railway.app/)(Spring 서버 + 웹소켓)을
**서버 없이** 다시 만든 학습용 프로젝트입니다.

| 역할 | 원본 | 이 프로젝트 |
|---|---|---|
| 화면 (HTML/CSS/JS) | Spring 서버가 제공 | **GitHub Pages** (무료 정적 호스팅) |
| 서버 로직 | Spring (Java) | **Google Apps Script** (`apps-script/Code.gs`) |
| DB | 서버 DB | **구글 스프레드시트** |
| 실시간 통신 | 웹소켓 (SockJS + STOMP) | **폴링**: 2초마다 "바뀐 거 있어?" 하고 물어봄 |

```
 브라우저 (GitHub Pages)                  Google
┌──────────────────────┐   POST {action}   ┌────────────────────┐    ┌─────────────────┐
│ index / terminal ... │ ────────────────▶ │ Apps Script 웹 앱  │ ─▶ │ 스프레드시트    │
│ js/api.js            │ ◀──────────────── │ doPost → ACTIONS   │ ◀─ │ Rooms/Exchanges │
└──────────────────────┘    JSON 응답      │ CacheService(캐시) │    │ Wall/Reviews... │
                                           └────────────────────┘    └─────────────────┘
```

---

## 0. 먼저 로컬에서 실행해 보기 (구글 계정 필요 없음)

Node.js만 있으면 됩니다. `dev/gas-mock.js`가 SpreadsheetApp 같은 구글 서비스를 흉내 내서
**Code.gs를 고치지 않고 그대로** 실행합니다.

```bash
node dev/server.js          # http://localhost:8787 열기
node dev/test-api.js        # 백엔드 자동 테스트 (한 판을 끝까지 진행)
```

- 두 사람 플레이: 일반 창 + 시크릿 창(또는 다른 브라우저)으로 각각 접속
- 시트에 쌓이는 내용은 `dev/mock-db.json`에서 볼 수 있습니다 (지우면 초기화)

## 1. 구글 스프레드시트 + Apps Script 준비

1. [sheets.new](https://sheets.new)로 새 스프레드시트를 만듭니다. (이름 예: `망가진 단말기 DB`)
2. 메뉴 **확장 프로그램 → Apps Script**
3. 기본 `Code.gs` 내용을 지우고 이 저장소의 `apps-script/Code.gs`를 통째로 붙여 넣습니다.
4. (선택) 왼쪽 ⚙️ 프로젝트 설정 → "appsscript.json 표시" 체크 → `apps-script/appsscript.json` 내용으로 바꿉니다.
   (시간대가 `Asia/Seoul`이 됩니다)
5. 위쪽 함수 목록에서 **`setup`** 선택 → **실행**
   - 권한 요청 창이 뜨면 허용 (“확인되지 않은 앱” → 고급 → 안전하지 않음으로 이동 — 내가 만든 스크립트라 괜찮습니다)
   - 스프레드시트에 `Rooms`, `Exchanges`, `Avatars`, `Wall`, `Reviews` 시트가 생기면 성공

## 2. 웹 앱으로 배포

1. 오른쪽 위 **배포 → 새 배포**
2. 유형 선택(⚙️) → **웹 앱**
3. 실행 사용자: **나** / 액세스 권한: **모든 사용자**
4. 배포 → 나오는 **웹 앱 URL**(`https://script.google.com/macros/s/…/exec`)을 복사
5. 주소를 브라우저에서 열어 `{"ok":true,"data":{"message":"망가진 단말기 API가 작동 중입니다."}}`가 보이면 성공

> ⚠️ **Code.gs를 고친 뒤에는** 배포 → 배포 관리 → ✏️ 수정 → 버전: **새 버전** → 배포.
> 저장만 하면 웹 앱에는 반영되지 않습니다. (이렇게 하면 URL은 그대로 유지됩니다)

## 3. 프론트엔드에 주소 넣기

`js/config.js`의 `DEPLOYED_API_URL`에 복사한 주소를 붙여 넣습니다.

```js
const DEPLOYED_API_URL = "https://script.google.com/macros/s/AKfy..../exec";
```

## 4. GitHub Pages에 올리기

```bash
git init
git add .
git commit -m "망가진 단말기 - 스프레드시트 버전"
git branch -M main
git remote add origin https://github.com/<내아이디>/<저장소이름>.git
git push -u origin main
```

GitHub 저장소 → **Settings → Pages** → Source: `Deploy from a branch`, Branch: `main` / `/ (root)` → Save.
1~2분 뒤 `https://<내아이디>.github.io/<저장소이름>/` 에서 열립니다.

---

## 파일 구조

```
index.html / tutorial.html / status.html / terminal.html   화면 (원본과 같음, 경로만 상대경로로)
css/                     원본 스타일 그대로
js/config.js             ★ Apps Script 주소 설정
js/api.js                ★ 서버 호출 공통 함수 api(action, payload)
js/terminal.js           게임 화면 - 웹소켓 부분을 폴링으로 바꿈 (connect/poll/applyState/detectEvent)
js/lobby.js, records.js, status.js, tutorial.js   fetch 부분만 api()로 바꿈
js/sound.js              효과음 (파일을 못 불러오면 합성음으로 대체)
apps-script/Code.gs      ★ 백엔드 전부 (게임 규칙, 시트 읽기/쓰기)
dev/                     로컬 연습 서버, 가짜 구글 환경, 자동 테스트
```

## 시트 구조 (= DB 테이블)

| 시트 | 한 줄의 의미 | 주요 열 |
|---|---|---|
| `Rooms` | 방 하나 | roomCode, version, stage, turnNo, 두 사람 이름/나이/생일/토큰, place, things, pending… |
| `Exchanges` | 질문·응답 한 번 | roomCode, turnNo, question, poltergeist, action, answer |
| `Avatars` | 신분증 사진 | roomCode, life, image(base64) |
| `Wall` | 기록실 게시물 | postType(QUESTION/WHISPER), question, answer, action, isActionShared, whisper |
| `Reviews` | 후기·오류 제보 | reviewType, content |

게임 진행 단계(`stage`): `WAITING`(상대 기다림) → `INTRO`(장소 입력) → `ASK`(생자 질문) ⇄ `ANSWER`(망자 응답) ×10 → `WHISPER`(한마디) → `END`

---

## 공부 포인트

**1. 웹소켓 없이 실시간처럼 — 폴링 + 버전 번호** (`js/terminal.js`의 `poll`, `Code.gs`의 `actionSync_`)
방 상태가 바뀔 때마다 `version`을 1씩 올립니다. 브라우저는 2초마다 내 버전을 보내고,
서버는 버전이 같으면 `{changed:false}`만, 다르면 새 상태 전체를 돌려줍니다.

**2. 이벤트는 "상태 차이"로 알아내기** (`detectEvent`)
원본 서버는 `QUESTION`, `ANSWER`, `END` 같은 이벤트를 보내 줬습니다. 폴링에서는
이전 상태와 새 상태를 비교해 같은 이름의 이벤트를 직접 만들어서, 원본 화면 코드를 거의 그대로 재사용했습니다.

**3. 시트는 느리다 → 캐시** (`getEntry_`, `putEntry_`)
시트 읽기는 수백 ms가 걸립니다. 상태를 `CacheService`에 넣어 두고, 폴링은 캐시만 읽습니다.
시트에 쓸 때만 캐시를 새로 만듭니다. (캐시가 사라져도 시트에서 다시 만들 수 있으니 시트가 "진짜 DB")

**4. 동시에 누르면? → 잠금** (`withLock_`, `mutate_`)
두 사람이 거의 동시에 요청하면 같은 줄을 덮어쓸 수 있어서 `LockService`로 한 명씩 처리합니다.
`mutate_`는 "잠금 → 읽기 → 차례 확인 → 고치기 → 저장"을 한 곳에 모은 틀입니다.

**5. 스프레드시트의 함정**
- `10/21` 같은 생일이 날짜로 바뀜 → 쓰기 전에 서식을 글자(`@`)로 (`writeRow_`)
- `=`로 시작하는 입력이 수식으로 실행될 수 있음 → 앞에 `'` 붙이기 (`toCell_`)
- 한 칸에 최대 5만 자 → 사진을 더 압축 (`lobby.js`의 `handleImageUpload`)

**6. Apps Script와 CORS** (`js/api.js`)
`Content-Type: application/json`을 붙이면 브라우저가 사전 요청(OPTIONS)을 보내는데 Apps Script는 이를 처리하지 못합니다.
헤더를 생략해 `text/plain`으로 보내고 서버에서 `JSON.parse`하는 것이 정석적인 우회법입니다.

**7. 비밀은 서버에만**
플레이어 토큰은 시트와 캐시에만 있고 화면으로 보내는 상태에는 넣지 않습니다. (`buildState_`)

## 한계와 다음 단계 아이디어

- 원본보다 반응이 1~3초 느립니다 (Apps Script 응답 시간 + 폴링 간격).
- 개인 구글 계정은 동시 실행 수 등에 제한이 있어 많은 사람이 동시에 쓰는 서비스에는 맞지 않습니다. 친구들과 노는 규모로는 충분합니다.
- 오래된 방 정리: 시간 기반 트리거로 `Rooms`에서 며칠 지난 방을 지우는 함수를 만들어 보세요.
- 더 빠르게: Firebase Realtime Database 같은 실시간 DB로 바꾸면 폴링 없이 즉시 반영됩니다.

## 저작권 안내

화면 디자인, 문구, 세계관, 음원은 원작 사이트 제작자의 창작물입니다. 이 저장소는 학습용 재구성이며,
공개 저장소에 올리거나 다른 사람에게 배포할 때는 원작자의 허락을 받으세요.
효과음(`sound/*.mp3`)은 저장소에 포함되어 있습니다. 원본의 배경음악 기능은 이 버전에서 제거했습니다.
