/**
 * 망가진 단말기 - Google Apps Script 백엔드
 *
 * 구글 스프레드시트를 DB로 사용합니다.
 *   Rooms     : 방 하나 = 한 줄 (진행 단계, 두 사람 신분증, 장소 등)
 *   Exchanges : 질문·응답 한 번 = 한 줄
 *   Avatars   : 신분증 사진 (용량이 커서 따로 보관)
 *   Wall      : 기록실에 남겨진 기록
 *   Reviews   : 후기·오류 제보
 *
 * 흐름: 브라우저 → fetch(POST, {action, payload}) → doPost → ACTIONS[action] → 시트 읽기/쓰기 → JSON 응답
 *
 * 처음 한 번: 편집기 위쪽에서 setup 함수를 골라 [실행] → 시트와 머리글이 만들어집니다.
 */

/* ===== 게임 규칙 (프론트의 terminal.js 상수와 같아야 함) ===== */
const MAX_TURN = 10;            // 질문 횟수
const NAME_MAX = 10;            // 이름 최대 길이
const PLACE_MAX = 30;           // 장소 최대 길이
const THING_MAX = 12;           // 물건 이름 최대 길이
const QUESTION_MAX = 100;       // 질문 최대 길이
const ACTION_MAX = 20;          // 닿지 않는 행동 최대 길이
const WHISPER_MAX = 30;         // 한마디 최대 길이
const REVIEW_MAX = 2000;        // 후기 최대 길이
const WALL_CODE = "AFTERGLOW";  // 기록실 열람 코드
const WALL_PAGE_SIZE = 20;      // 기록실 한 쪽에 보여줄 개수
const WALL_RANDOM_COUNT = 3;    // 떠도는 기록 개수 (종류별)
const CELL_MAX = 50000;         // 스프레드시트 한 칸에 넣을 수 있는 최대 글자 수

const ROOM_CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";   // 헷갈리는 0/O, 1/I 제외
const PRESENCE_ONLINE_MS = 15000;   // 마지막 요청이 이 시간 안이면 "접속 중"
const LIVE_ROOM_MS = 30 * 60 * 1000;// 현황판: 30분 안에 움직인 방을 "현재 단말기"로 셈
const CACHE_SECONDS = 21600;        // CacheService 최대 보관 시간 (6시간)
const TIME_ZONE = "Asia/Seoul";

/* 폴터가이스트 종류 → 물건이 필요한지 */
const POLTERGEIST_NEED_THING = { FLICKER: false, SHAKE: true, DROP: true, NOISE: false, SOUND: false };
const ANSWERS = ["YES", "NO", "NONE"];

/* ===== 시트 구조 (열 순서 = 시트 머리글 순서) ===== */
const SHEETS = {
    Rooms: ["roomCode", "version", "stage", "turnNo", "creator", "createdAt", "updatedAt",
        "livingName", "livingAge", "livingBirthday", "livingToken",
        "deadName", "deadAge", "deadBirthday", "deadToken",
        "place", "things",
        "pendingQuestion", "pendingIsIdeaUsed", "pendingPoltergeist", "pendingPoltergeistThing",
        "whisper", "isActionShared", "livingWallDone", "deadWallDone"],
    Exchanges: ["roomCode", "turnNo", "question", "isIdeaUsed", "poltergeist", "poltergeistThing",
        "action", "isPresetAction", "answer", "createdAt"],
    Avatars: ["roomCode", "life", "image"],
    Wall: ["createdAt", "postType", "roomCode", "turnNo", "question", "answer",
        "poltergeist", "poltergeistThing", "action", "isActionShared", "whisper"],
    Reviews: ["createdAt", "reviewType", "content", "roomCode"]
};

/* 열 종류 - 시트에는 전부 글자로 저장하고, 읽을 때 원래 타입으로 되돌림 */
const NUMBER_COLUMNS = ["version", "turnNo", "livingAge", "deadAge"];
const BOOLEAN_COLUMNS = ["pendingIsIdeaUsed", "isActionShared", "livingWallDone", "deadWallDone", "isIdeaUsed", "isPresetAction"];
const JSON_COLUMNS = ["things"];

/* ===== 진입점 ===== */

/* 주소를 브라우저로 열었을 때 - 작동 확인용 */
function doGet() {
    return json_({ ok: true, data: { message: "망가진 단말기 API가 작동 중입니다." } });
}

/* 모든 요청은 POST { action, payload } 하나로 받음 */
function doPost(e) {
    let request;
    try {
        request = JSON.parse(e.postData.contents);
    } catch (err) {
        return json_({ ok: false, error: "잘못된 요청입니다.", code: 400 });
    }

    const handler = ACTIONS[request.action];
    if (!handler) return json_({ ok: false, error: "알 수 없는 요청입니다: " + request.action, code: 400 });

    try {
        return json_({ ok: true, data: handler(request.payload || {}) });
    } catch (err) {
        if (err instanceof ApiError) return json_({ ok: false, error: err.message, code: err.code });
        console.error(err && err.stack ? err.stack : err);
        return json_({ ok: false, error: "서버 오류가 발생했습니다.", code: 500 });
    }
}

/* 요청 이름 → 처리 함수 */
const ACTIONS = {
    createRoom: actionCreateRoom_,
    joinRoom: actionJoinRoom_,
    snapshot: actionSnapshot_,
    sync: actionSync_,
    avatar: actionAvatar_,
    place: actionPlace_,
    question: actionQuestion_,
    poltergeist: actionPoltergeist_,
    answer: actionAnswer_,
    whisper: actionWhisper_,
    consent: actionConsent_,
    wallPost: actionWallPost_,
    wallUnlock: actionWallUnlock_,
    wallList: actionWallList_,
    wallRandom: actionWallRandom_,
    status: actionStatus_,
    review: actionReview_
};

/* 처음 한 번 실행 - 시트 만들기 */
function setup() {
    const db = getDb_();
    Object.keys(SHEETS).forEach(function (name) {
        let sheet = db.getSheetByName(name);
        if (!sheet) sheet = db.insertSheet(name);
        const headers = SHEETS[name];
        sheet.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight("bold");
        sheet.setFrozenRows(1);
    });
    const blank = db.getSheetByName("Sheet1") || db.getSheetByName("시트1");
    if (blank && db.getSheets().length > 1 && blank.getLastRow() === 0) db.deleteSheet(blank);
    console.log("시트 준비 완료: " + Object.keys(SHEETS).join(", "));
}

/* ===== 방 만들기 / 입장 ===== */

/* 방 만들기 - 고른 쪽(life) 자리에 내 신분증을 넣고 WAITING */
function actionCreateRoom_(p) {
    const agent = checkAgent_(p.agent);
    const life = p.life === "LIVING" || p.life === "DEAD" ? p.life : null;
    if (!life) throw new ApiError("남은 요원인지 떠난 요원인지 골라 주세요.");

    return withLock_(function () {
        const rooms = table_("Rooms");
        const roomCode = newRoomCode_(rooms);
        const token = Utilities.getUuid();
        const now = nowText_();
        const room = {
            roomCode: roomCode, version: 0, stage: "WAITING", turnNo: 0, creator: life,
            createdAt: now, updatedAt: now, things: [],
            isActionShared: false, livingWallDone: false, deadWallDone: false
        };
        putAgent_(room, life, agent, token);

        const row = appendRow_(rooms, room);
        saveAvatar_(roomCode, life, agent.image);
        saveRoom_(rooms, row, room);
        return { roomCode: roomCode, playerToken: token, life: life };
    });
}

/* 코드로 입장 - 비어 있는 반대쪽 자리에 들어가고 INTRO */
function actionJoinRoom_(p) {
    const agent = checkAgent_(p.agent);
    return withLock_(function () {
        const rooms = table_("Rooms");
        const found = loadRoom_(rooms, p.roomCode);
        const room = found.room;
        const life = room.creator === "LIVING" ? "DEAD" : "LIVING";
        if (room[prefix_(life) + "Token"]) throw new ApiError("이미 두 사람이 연결된 단말기입니다.");

        const token = Utilities.getUuid();
        putAgent_(room, life, agent, token);
        room.stage = "INTRO";
        saveAvatar_(room.roomCode, life, agent.image);
        saveRoom_(rooms, found.row, room);
        return { roomCode: room.roomCode, playerToken: token, life: life };
    });
}

/* 신분증 검사 */
function checkAgent_(agent) {
    const a = agent || {};
    const name = text_(a.name);
    if (!name) throw new ApiError("이름을 입력해 주세요.");
    if (len_(name) > NAME_MAX) throw new ApiError("이름은 " + NAME_MAX + "자까지 입력할 수 있습니다.");

    let age = null;
    if (a.age !== null && a.age !== undefined && a.age !== "") {
        age = Number(a.age);
        if (!(age >= 0 && age <= 999 && Math.floor(age) === age)) throw new ApiError("나이는 0~999 사이 숫자만 입력할 수 있습니다.");
    }

    const birthday = text_(a.birthday);
    if (len_(birthday) > 10) throw new ApiError("생일은 10자까지 입력할 수 있습니다.");

    let image = null;
    if (typeof a.image === "string" && a.image.indexOf("data:image/") === 0 && a.image.length < CELL_MAX) image = a.image;

    return { name: name, age: age, birthday: birthday || null, image: image };
}

/* 방 줄에 신분증 넣기 (livingName / deadName ...) */
function putAgent_(room, life, agent, token) {
    const k = prefix_(life);
    room[k + "Name"] = agent.name;
    room[k + "Age"] = agent.age;
    room[k + "Birthday"] = agent.birthday;
    room[k + "Token"] = token;
}

/* 겹치지 않는 4자리 방 코드 */
function newRoomCode_(rooms) {
    for (let tries = 0; tries < 30; tries++) {
        let code = "";
        for (let i = 0; i < 4; i++) {
            code += ROOM_CODE_CHARS.charAt(Math.floor(Math.random() * ROOM_CODE_CHARS.length));
        }
        if (findRows_(rooms, "roomCode", code).length === 0) return code;
    }
    throw new ApiError("빈 주파수를 찾지 못했습니다. 잠시 뒤 다시 시도해 주세요.", 503);
}

/* 신분증 사진 저장 */
function saveAvatar_(roomCode, life, image) {
    if (!image) return;
    appendRow_(table_("Avatars"), { roomCode: roomCode, life: life, image: image });
    cache_().put(avatarKey_(roomCode, life), image, CACHE_SECONDS);
}

/* ===== 상태 읽기 (폴링) ===== */

/* 처음 들어왔을 때 전체 상태 */
function actionSnapshot_(p) {
    const entry = getEntry_(p.roomCode);
    const life = auth_(entry, p.token);
    touchPresence_(entry.state.roomCode, life);
    return viewFor_(entry.state, life);
}

/* 2초마다 - 버전이 그대로면 바뀐 게 없다고만 알려줌 (시트를 읽지 않아 빠름) */
function actionSync_(p) {
    const entry = getEntry_(p.roomCode);
    const life = auth_(entry, p.token);
    touchPresence_(entry.state.roomCode, life);
    if (Number(p.version) === entry.state.version) {
        return { changed: false, isPartnerConnected: isPartnerConnected_(entry.state.roomCode, life) };
    }
    return { changed: true, state: viewFor_(entry.state, life) };
}

/* 신분증 사진 (상태에 싣기엔 커서 따로) */
function actionAvatar_(p) {
    const entry = getEntry_(p.roomCode);
    auth_(entry, p.token);
    const life = p.life === "DEAD" ? "DEAD" : "LIVING";
    const key = avatarKey_(entry.state.roomCode, life);
    let image = cache_().get(key);
    if (image === null) {
        const avatars = table_("Avatars");
        image = "";
        findRows_(avatars, "roomCode", entry.state.roomCode).forEach(function (row) {
            const item = readRow_(avatars, row);
            if (item.life === life) image = item.image || "";
        });
        cache_().put(key, image, CACHE_SECONDS);
    }
    return { image: image || null };
}

/* ===== 게임 진행 (상태를 바꾸는 요청) ===== */

/* 생자 - 장소와 물건 → 첫 질문 차례 */
function actionPlace_(p) {
    return mutate_(p, "LIVING", "INTRO", function (room) {
        const place = text_(p.place);
        if (!place) throw new ApiError("장소를 입력해 주세요.");
        if (len_(place) > PLACE_MAX) throw new ApiError("장소는 " + PLACE_MAX + "자까지 입력할 수 있습니다.");

        const things = (Array.isArray(p.things) ? p.things : []).map(text_).filter(Boolean);
        if (!things.length) throw new ApiError("주변의 물건을 하나 이상 입력해 주세요.");
        if (things.length > 3) throw new ApiError("물건은 3개까지 입력할 수 있습니다.");
        things.forEach(function (thing) {
            if (len_(thing) > THING_MAX) throw new ApiError("물건 이름은 " + THING_MAX + "자까지 입력할 수 있습니다.");
        });

        room.place = place;
        room.things = things;
        room.stage = "ASK";
        room.turnNo = 1;
    });
}

/* 생자 - 질문 → 망자 응답 차례 */
function actionQuestion_(p) {
    return mutate_(p, "LIVING", "ASK", function (room) {
        const question = text_(p.question);
        if (!question) throw new ApiError("질문을 입력해 주세요.");
        if (len_(question) > QUESTION_MAX) throw new ApiError("말이 너무 길어진 건 아닐까? 마음을 전하기 위해 문장을 정리할 필요가 있다.");

        room.pendingQuestion = question;
        room.pendingIsIdeaUsed = !!p.isIdeaUsed;
        room.stage = "ANSWER";
    });
}

/* 망자 - 폴터가이스트 (질문당 한 번) */
function actionPoltergeist_(p) {
    return mutate_(p, "DEAD", "ANSWER", function (room) {
        if (room.pendingPoltergeist) throw new ApiError("이번 질문에는 이미 현상을 일으켰습니다.");
        const type = String(p.type || "");
        if (!(type in POLTERGEIST_NEED_THING)) throw new ApiError("알 수 없는 현상입니다.");

        let thing = null;
        if (POLTERGEIST_NEED_THING[type]) {
            thing = text_(p.thing);
            if (room.things.indexOf(thing) < 0) throw new ApiError("주변에 없는 물건입니다.");
        }
        room.pendingPoltergeist = type;
        room.pendingPoltergeistThing = thing;
    });
}

/* 망자 - 응답 (YES / NO / NONE) → 기록 한 줄 추가, 다음 질문 또는 한마디 차례 */
function actionAnswer_(p) {
    return mutate_(p, "DEAD", "ANSWER", function (room) {
        const answer = String(p.answer || "");
        if (ANSWERS.indexOf(answer) < 0) throw new ApiError("알 수 없는 응답입니다.");
        const action = text_(p.action);
        if (len_(action) > ACTION_MAX) throw new ApiError(ACTION_MAX + "자 내외의 짧은 대사/행동만 전달할 수 있습니다.");

        appendRow_(table_("Exchanges"), {
            roomCode: room.roomCode,
            turnNo: room.turnNo,
            question: room.pendingQuestion,
            isIdeaUsed: room.pendingIsIdeaUsed,
            poltergeist: room.pendingPoltergeist,
            poltergeistThing: room.pendingPoltergeistThing,
            action: action || null,
            isPresetAction: !!p.isPresetAction,
            answer: answer,
            createdAt: nowText_()
        });

        room.pendingQuestion = null;
        room.pendingIsIdeaUsed = false;
        room.pendingPoltergeist = null;
        room.pendingPoltergeistThing = null;
        if (room.turnNo >= MAX_TURN) {
            room.stage = "WHISPER";
        } else {
            room.turnNo += 1;
            room.stage = "ASK";
        }
    });
}

/* 망자 - 마지막 한마디 (null이면 남기지 않음) → 끝 */
function actionWhisper_(p) {
    return mutate_(p, "DEAD", "WHISPER", function (room) {
        const whisper = text_(p.whisper);
        if (len_(whisper) > WHISPER_MAX) throw new ApiError(WHISPER_MAX + "자 내외의 짧은 대사만 전달할 수 있습니다.");
        room.whisper = whisper || null;
        room.stage = "END";
    });
}

/* 망자 - 행동 공개 허락 (이미 남겨진 생자 기록에도 반영) */
function actionConsent_(p) {
    return mutate_(p, "DEAD", null, function (room) {
        room.isActionShared = !!p.isActionShared;
        const wall = table_("Wall");
        findRows_(wall, "roomCode", room.roomCode).forEach(function (row) {
            const post = readRow_(wall, row);
            if (post.postType !== "QUESTION") return;
            post.isActionShared = room.isActionShared;
            writeRow_(wall, row, post);
        });
    });
}

/*
 * 상태를 바꾸는 요청 공통 틀
 *   1) 잠금 (두 사람이 동시에 눌러도 한 명씩)  2) 방 읽기  3) 내 차례인지 확인
 *   4) change(room)으로 고치기  5) 저장 + 버전 올리기  6) 새 상태 돌려주기
 */
function mutate_(p, needLife, needStage, change) {
    return withLock_(function () {
        const rooms = table_("Rooms");
        const found = loadRoom_(rooms, p.roomCode);
        const room = found.room;
        const life = authRoom_(room, p.token);
        if (needLife && life !== needLife) throw new ApiError("지금은 상대방의 차례입니다.");
        if (needStage && room.stage !== needStage) throw new ApiError("이미 지나간 단계입니다. 화면을 새로 고쳐 주세요.", 409);

        change(room);
        const entry = saveRoom_(rooms, found.row, room);
        touchPresence_(room.roomCode, life);
        return viewFor_(entry.state, life);
    });
}

/* ===== 기록실 ===== */

/* 통신이 끝난 뒤 기록 남기기 - 생자는 질문 1개, 망자는 한마디 (한 사람당 한 번) */
function actionWallPost_(p) {
    return withLock_(function () {
        const rooms = table_("Rooms");
        const found = loadRoom_(rooms, p.roomCode);
        const room = found.room;
        const life = authRoom_(room, p.token);
        if (room.stage !== "END") throw new ApiError("통신이 끝난 뒤에 남길 수 있습니다.");
        const doneKey = prefix_(life) + "WallDone";
        if (room[doneKey]) throw new ApiError("이미 기록을 남겼습니다.");

        const post = { createdAt: nowText_(), roomCode: room.roomCode, isActionShared: room.isActionShared };
        if (life === "LIVING") {
            const turnNo = Number(p.turnNo);
            const x = loadExchanges_(room.roomCode).filter(function (item) {
                return item.turnNo === turnNo;
            })[0];
            if (!x) throw new ApiError("남길 질문을 골라 주세요.");
            post.postType = "QUESTION";
            post.turnNo = x.turnNo;
            post.question = x.question;
            post.answer = x.answer;
            post.poltergeist = x.poltergeist;
            post.poltergeistThing = x.poltergeistThing;
            post.action = x.action;
        } else {
            if (!room.whisper) throw new ApiError("남길 한마디가 없습니다.");
            post.postType = "WHISPER";
            post.whisper = room.whisper;
        }

        appendRow_(table_("Wall"), post);
        room[doneKey] = true;
        saveRoom_(rooms, found.row, room);
        cache_().remove("status");
        return { ok: true };
    });
}

/* 열람 코드 확인 */
function actionWallUnlock_(p) {
    checkWallCode_(p.password);
    return { ok: true };
}

/* 모든 기록 - 종류별 최신순, 쪽 나누기 */
function actionWallList_(p) {
    checkWallCode_(p.code);
    const type = p.type === "QUESTION" ? "QUESTION" : "WHISPER";
    const page = Math.max(0, Math.floor(Number(p.page) || 0));
    const posts = readAll_(table_("Wall")).filter(function (post) {
        return post.postType === type;
    }).reverse();
    return {
        posts: posts.slice(page * WALL_PAGE_SIZE, (page + 1) * WALL_PAGE_SIZE).map(wallView_),
        total: posts.length,
        size: WALL_PAGE_SIZE
    };
}

/* 떠도는 기록 - 종류별 무작위 몇 개 */
function actionWallRandom_(p) {
    checkWallCode_(p.code);
    const type = p.type === "QUESTION" ? "QUESTION" : "WHISPER";
    const posts = readAll_(table_("Wall")).filter(function (post) {
        return post.postType === type;
    });
    for (let i = posts.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        const temp = posts[i];
        posts[i] = posts[j];
        posts[j] = temp;
    }
    return posts.slice(0, WALL_RANDOM_COUNT).map(wallView_);
}

/* 기록 한 장 - 망자가 허락하지 않은 행동은 빼고 */
function wallView_(post) {
    return {
        postType: post.postType,
        question: post.question,
        answer: post.answer,
        poltergeist: post.poltergeist,
        poltergeistThing: post.poltergeistThing,
        action: post.isActionShared ? post.action : null,
        whisper: post.whisper
    };
}

function checkWallCode_(code) {
    if (String(code || "").trim().toUpperCase() !== WALL_CODE) throw new ApiError("열람 코드가 맞지 않습니다.", 403);
}

/* ===== 현황판 / 후기 ===== */

/* 현황판 숫자 (30초 동안 캐시) */
function actionStatus_() {
    const cached = cache_().get("status");
    if (cached) return JSON.parse(cached);

    const now = Date.now();
    let liveCount = 0;
    let sessionCount = 0;
    readAll_(table_("Rooms")).forEach(function (room) {
        if (room.stage !== "WAITING") sessionCount++;
        if (room.stage !== "END" && now - parseTime_(room.updatedAt) < LIVE_ROOM_MS) liveCount++;
    });

    let wallWhisperCount = 0;
    let wallQuestionCount = 0;
    readAll_(table_("Wall")).forEach(function (post) {
        if (post.postType === "WHISPER") wallWhisperCount++;
        if (post.postType === "QUESTION") wallQuestionCount++;
    });

    const status = {
        liveCount: liveCount, sessionCount: sessionCount,
        wallWhisperCount: wallWhisperCount, wallQuestionCount: wallQuestionCount
    };
    cache_().put("status", JSON.stringify(status), 30);
    return status;
}

/* 후기 / 오류 제보 */
function actionReview_(p) {
    const type = p.reviewType === "BUG" ? "BUG" : "REVIEW";
    const content = text_(p.content);
    if (!content) throw new ApiError("내용을 입력해 주세요.");
    if (len_(content) > REVIEW_MAX) throw new ApiError("내용은 " + REVIEW_MAX + "자까지 입력할 수 있습니다.");
    withLock_(function () {
        appendRow_(table_("Reviews"), {
            createdAt: nowText_(), reviewType: type, content: content,
            roomCode: p.roomCode ? String(p.roomCode).slice(0, 4) : null
        });
    });
    return { ok: true };
}

/* ===== 방 상태 만들기 · 캐시 ===== */

/*
 * 캐시 한 칸 = { state, tokens }
 *   state  : 두 사람에게 똑같이 보이는 방 상태 (RoomStateDTO)
 *   tokens : 누가 누구인지 확인용 (브라우저로는 절대 보내지 않음)
 * 폴링은 대부분 캐시만 읽고 끝나서 시트를 거의 건드리지 않습니다.
 */
function getEntry_(roomCode) {
    const code = normalizeCode_(roomCode);
    const cached = cache_().get(stateKey_(code));
    if (cached) return JSON.parse(cached);

    const rooms = table_("Rooms");
    const found = loadRoom_(rooms, code);
    return putEntry_(found.room);
}

/* 방 저장 - 버전 +1, 시트에 쓰고 캐시도 새로 */
function saveRoom_(rooms, row, room) {
    room.version = (room.version || 0) + 1;
    room.updatedAt = nowText_();
    writeRow_(rooms, row, room);
    return putEntry_(room);
}

function putEntry_(room) {
    const entry = {
        state: buildState_(room, loadExchanges_(room.roomCode)),
        tokens: { LIVING: room.livingToken, DEAD: room.deadToken }
    };
    cache_().put(stateKey_(room.roomCode), JSON.stringify(entry), CACHE_SECONDS);
    return entry;
}

/* 방 줄 + 질문 기록 → 화면에 보낼 상태 */
function buildState_(room, exchanges) {
    return {
        roomCode: room.roomCode,
        version: room.version,
        stage: room.stage,
        turnNo: room.turnNo || 0,
        place: room.place,
        things: room.things || [],
        living: agentOf_(room, "LIVING"),
        dead: agentOf_(room, "DEAD"),
        pendingQuestion: room.pendingQuestion,
        pendingPoltergeist: room.pendingPoltergeist,
        pendingPoltergeistThing: room.pendingPoltergeistThing,
        exchanges: exchanges.map(function (x) {
            return {
                turnNo: x.turnNo, question: x.question, answer: x.answer,
                poltergeist: x.poltergeist, poltergeistThing: x.poltergeistThing, action: x.action
            };
        }),
        whisper: room.whisper,
        isActionShared: room.isActionShared,
        livingWallDone: room.livingWallDone,
        deadWallDone: room.deadWallDone
    };
}

/* 사람마다 다른 값(기록 남겼는지, 상대 접속 여부)을 더해서 */
function viewFor_(state, life) {
    const view = JSON.parse(JSON.stringify(state));
    view.isWallDone = life === "LIVING" ? state.livingWallDone : state.deadWallDone;
    view.isPartnerConnected = isPartnerConnected_(state.roomCode, life);
    return view;
}

function agentOf_(room, life) {
    const k = prefix_(life);
    if (!room[k + "Name"]) return null;
    return { name: room[k + "Name"], age: room[k + "Age"], birthday: room[k + "Birthday"] };
}

/* 이 방의 질문 기록 (차례 순서) */
function loadExchanges_(roomCode) {
    const t = table_("Exchanges");
    return findRows_(t, "roomCode", roomCode).map(function (row) {
        return readRow_(t, row);
    }).sort(function (a, b) {
        return a.turnNo - b.turnNo;
    });
}

/* 방 찾기 (없으면 "연결할 수 없는 단말기") */
function loadRoom_(rooms, roomCode) {
    const code = normalizeCode_(roomCode);
    const found = findRows_(rooms, "roomCode", code);
    if (!found.length) throw new ApiError("연결할 수 없는 단말기입니다.", 404);
    return { row: found[0], room: readRow_(rooms, found[0]) };
}

function normalizeCode_(roomCode) {
    const code = String(roomCode || "").trim().toUpperCase();
    if (!/^[A-Z0-9]{4}$/.test(code)) throw new ApiError("연결할 수 없는 단말기입니다.", 404);
    return code;
}

/* 토큰 → LIVING / DEAD */
function auth_(entry, token) {
    if (token && token === entry.tokens.LIVING) return "LIVING";
    if (token && token === entry.tokens.DEAD) return "DEAD";
    throw new ApiError("단말기의 주인이 아닙니다", 403);
}

function authRoom_(room, token) {
    return auth_({ tokens: { LIVING: room.livingToken, DEAD: room.deadToken } }, token);
}

/* ===== 접속 상태 (CacheService에만 기록, 시트는 안 씀) ===== */

function touchPresence_(roomCode, life) {
    cache_().put(presenceKey_(roomCode, life), String(Date.now()), 120);
}

function isPartnerConnected_(roomCode, life) {
    const seen = Number(cache_().get(presenceKey_(roomCode, life === "LIVING" ? "DEAD" : "LIVING")));
    return !!seen && Date.now() - seen < PRESENCE_ONLINE_MS;
}

/* ===== 스프레드시트를 표(table)처럼 쓰는 작은 도구들 ===== */

/* 연결된 스프레드시트 (스크립트 속성 SPREADSHEET_ID가 있으면 그 파일) */
function getDb_() {
    const id = PropertiesService.getScriptProperties().getProperty("SPREADSHEET_ID");
    return id ? SpreadsheetApp.openById(id) : SpreadsheetApp.getActiveSpreadsheet();
}

function table_(name) {
    const sheet = getDb_().getSheetByName(name);
    if (!sheet) throw new ApiError("'" + name + "' 시트가 없습니다. Apps Script에서 setup()을 먼저 실행해 주세요.", 500);
    return { sheet: sheet, headers: SHEETS[name] };
}

/* key 열의 값이 value인 줄 번호들 (TextFinder - 시트 전체를 읽지 않고 찾음) */
function findRows_(t, key, value) {
    const last = t.sheet.getLastRow();
    if (last < 2) return [];
    const col = t.headers.indexOf(key) + 1;
    return t.sheet.getRange(2, col, last - 1, 1)
        .createTextFinder(String(value))
        .matchEntireCell(true)
        .matchCase(true)
        .findAll()
        .map(function (range) {
            return range.getRow();
        });
}

/* 한 줄 → 객체 */
function readRow_(t, row) {
    const values = t.sheet.getRange(row, 1, 1, t.headers.length).getValues()[0];
    return toObject_(t.headers, values);
}

/* 머리글 아래 전부 → 객체 배열 */
function readAll_(t) {
    const last = t.sheet.getLastRow();
    if (last < 2) return [];
    return t.sheet.getRange(2, 1, last - 1, t.headers.length).getValues().map(function (values) {
        return toObject_(t.headers, values);
    });
}

/* 객체 → 한 줄 (글자 서식 "@"으로 먼저 바꿔서 "10/21"이 날짜로 바뀌지 않게) */
function writeRow_(t, row, obj) {
    const values = t.headers.map(function (key) {
        return toCell_(key, obj[key]);
    });
    t.sheet.getRange(row, 1, 1, values.length).setNumberFormat("@").setValues([values]);
}

/* 맨 아래에 한 줄 추가 (잠금 안에서 불러야 줄이 겹치지 않음) */
function appendRow_(t, obj) {
    const row = t.sheet.getLastRow() + 1;
    if (row > t.sheet.getMaxRows()) t.sheet.insertRowsAfter(t.sheet.getMaxRows(), 100);
    writeRow_(t, row, obj);
    return row;
}

function toObject_(headers, values) {
    const obj = {};
    headers.forEach(function (key, i) {
        obj[key] = fromCell_(key, values[i]);
    });
    return obj;
}

/* 저장할 때: 전부 글자로. =, +, -, @로 시작하면 수식으로 읽히지 않게 ' 를 붙임 */
function toCell_(key, value) {
    if (value === null || value === undefined) return "";
    if (JSON_COLUMNS.indexOf(key) >= 0) return JSON.stringify(value);
    if (typeof value === "boolean") return value ? "TRUE" : "FALSE";
    const s = String(value);
    return /^[=+\-@]/.test(s) ? "'" + s : s;
}

/* 읽을 때: 열 종류에 맞게 되돌림 */
function fromCell_(key, raw) {
    let s = raw === null || raw === undefined ? "" : String(raw);
    if (/^'[=+\-@]/.test(s)) s = s.slice(1);
    if (NUMBER_COLUMNS.indexOf(key) >= 0) return s === "" ? null : Number(s);
    if (BOOLEAN_COLUMNS.indexOf(key) >= 0) return s.toUpperCase() === "TRUE";
    if (JSON_COLUMNS.indexOf(key) >= 0) return s ? JSON.parse(s) : [];
    return s === "" ? null : s;
}

/* ===== 기타 도구 ===== */

/* 요청 처리 중 사용자에게 보여줄 오류 */
class ApiError extends Error {
    constructor(message, code) {
        super(message);
        this.code = code || 400;
    }
}

/* 동시에 들어온 요청을 한 줄로 세움 (최대 10초 대기) */
function withLock_(fn) {
    const lock = LockService.getScriptLock();
    if (!lock.tryLock(10000)) throw new ApiError("신호가 혼잡합니다. 잠시 뒤 다시 시도해 주세요.", 503);
    try {
        return fn();
    } finally {
        lock.releaseLock();
    }
}

function json_(obj) {
    return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function cache_() {
    return CacheService.getScriptCache();
}

function stateKey_(roomCode) {
    return "state:" + roomCode;
}

function avatarKey_(roomCode, life) {
    return "avatar:" + roomCode + ":" + life;
}

function presenceKey_(roomCode, life) {
    return "pres:" + roomCode + ":" + life;
}

function prefix_(life) {
    return life === "LIVING" ? "living" : "dead";
}

/* 앞뒤 공백 없앤 글자 (글자가 아니면 "") */
function text_(value) {
    return typeof value === "string" ? value.trim() : "";
}

/* 글자 수 (이모지·한글 1자로) */
function len_(text) {
    return Array.from(text || "").length;
}

/* 지금 시각 "2026-10-19 21:30:00" (한국 시간) */
function nowText_() {
    return Utilities.formatDate(new Date(), TIME_ZONE, "yyyy-MM-dd HH:mm:ss");
}

function parseTime_(text) {
    if (!text) return 0;
    const ms = new Date(String(text).replace(" ", "T") + "+09:00").getTime();
    return isNaN(ms) ? 0 : ms;
}
