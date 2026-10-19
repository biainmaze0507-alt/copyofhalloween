/*
 * 백엔드 자동 테스트 - 두 사람이 한 판을 끝까지 진행해 봄
 *   node dev/test-api.js
 * 가짜 Apps Script 위에서 Code.gs를 실행합니다. (파일에 저장하지 않음)
 */
const assert = require("assert");
const { createGas } = require("./gas-mock");

const gas = createGas({});
function call(action, payload) {
    return JSON.parse(gas.post(JSON.stringify({ action: action, payload: payload })));
}
function ok(action, payload) {
    const res = call(action, payload);
    assert.ok(res.ok, action + " 실패: " + res.error);
    return res.data;
}
function fail(action, payload, code) {
    const res = call(action, payload);
    assert.ok(!res.ok, action + "이(가) 실패해야 하는데 성공함");
    if (code) assert.strictEqual(res.code, code, action + " 오류 코드: " + res.error);
    return res.error;
}

/* 1. 방 만들기 (생자) / 입장 (망자) */
const living = ok("createRoom", { agent: { name: "하늘", age: 27, birthday: "10/21", image: null }, life: "LIVING" });
assert.strictEqual(living.life, "LIVING");
assert.match(living.roomCode, /^[A-Z2-9]{4}$/);
const L = { roomCode: living.roomCode, token: living.playerToken };

let s = ok("snapshot", L);
assert.strictEqual(s.stage, "WAITING");
assert.strictEqual(s.living.birthday, "10/21");   // 날짜로 바뀌지 않았는지
assert.strictEqual(s.dead, null);
assert.ok(!("livingToken" in s), "토큰이 상태에 섞여 나가면 안 됨");

fail("joinRoom", { roomCode: "ZZZZ", agent: { name: "x" } }, 404);
const dead = ok("joinRoom", { roomCode: living.roomCode.toLowerCase(), agent: { name: "=별", age: null, birthday: "" } });
assert.strictEqual(dead.life, "DEAD");
const D = { roomCode: dead.roomCode, token: dead.playerToken };
fail("joinRoom", { roomCode: living.roomCode, agent: { name: "셋째" } });   // 자리 없음

s = ok("snapshot", D);
assert.strictEqual(s.stage, "INTRO");
assert.strictEqual(s.dead.name, "=별");           // 수식처럼 생긴 이름도 그대로
assert.strictEqual(s.isPartnerConnected, true);
fail("snapshot", { roomCode: L.roomCode, token: "wrong" }, 403);

/* 2. sync - 버전이 같으면 changed:false */
const v = s.version;
assert.strictEqual(ok("sync", Object.assign({ version: v }, L)).changed, false);

/* 3. 장소·물건 (생자만) */
fail("place", Object.assign({ place: "옥상", things: ["의자"] }, D));
s = ok("place", Object.assign({ place: "폐쇄된 통신실", things: ["머그컵", " ", "라디오"] }, L));
assert.strictEqual(s.stage, "ASK");
assert.deepStrictEqual(s.things, ["머그컵", "라디오"]);
assert.strictEqual(ok("sync", Object.assign({ version: v }, D)).changed, true);

/* 4. 10번 질문·응답 */
for (let turn = 1; turn <= 10; turn++) {
    s = ok("question", Object.assign({ question: "질문 " + turn + "?", isIdeaUsed: turn === 1 }, L));
    assert.strictEqual(s.stage, "ANSWER");
    assert.strictEqual(s.pendingQuestion, "질문 " + turn + "?");
    fail("question", Object.assign({ question: "또?" }, L), 409);

    if (turn === 2) {
        fail("poltergeist", Object.assign({ type: "SHAKE", thing: "냉장고" }, D));
        s = ok("poltergeist", Object.assign({ type: "SHAKE", thing: "라디오" }, D));
        assert.strictEqual(s.pendingPoltergeistThing, "라디오");
        fail("poltergeist", Object.assign({ type: "FLICKER" }, D));    // 질문당 한 번
    }
    s = ok("answer", Object.assign({ answer: turn % 3 === 0 ? "NONE" : "YES", action: turn === 2 ? "(손을 잡는다)" : null, isPresetAction: turn === 2 }, D));
}
assert.strictEqual(s.stage, "WHISPER");
assert.strictEqual(s.exchanges.length, 10);
assert.strictEqual(s.exchanges[1].poltergeist, "SHAKE");
assert.strictEqual(s.exchanges[1].action, "(손을 잡는다)");
assert.strictEqual(s.exchanges[2].answer, "NONE");

/* 5. 한마디 → END */
fail("whisper", Object.assign({ whisper: "가".repeat(31) }, D));
s = ok("whisper", Object.assign({ whisper: "잘 지내" }, D));
assert.strictEqual(s.stage, "END");

/* 6. 기록실 */
fail("wallList", { code: "nope", type: "WHISPER" }, 403);
ok("wallPost", Object.assign({ turnNo: 2 }, L));
fail("wallPost", Object.assign({ turnNo: 3 }, L));                 // 한 번만
ok("wallPost", D);
let list = ok("wallList", { code: "afterglow", type: "QUESTION", page: 0 });
assert.strictEqual(list.total, 1);
assert.strictEqual(list.posts[0].action, null);                      // 동의 전에는 행동 숨김
ok("consent", Object.assign({ isActionShared: true }, D));
list = ok("wallList", { code: "AFTERGLOW", type: "QUESTION", page: 0 });
assert.strictEqual(list.posts[0].action, "(손을 잡는다)");           // 동의 후 공개
assert.strictEqual(ok("wallRandom", { code: "AFTERGLOW", type: "WHISPER" })[0].whisper, "잘 지내");
assert.strictEqual(ok("snapshot", L).isWallDone, true);

/* 7. 현황판 / 후기 */
const status = ok("status", {});
assert.deepStrictEqual(status, { liveCount: 0, sessionCount: 1, wallWhisperCount: 1, wallQuestionCount: 1 });
ok("review", { reviewType: "BUG", content: "테스트" });
fail("review", { reviewType: "REVIEW", content: "  " });

/* 8. 캐시가 비어도(=Apps Script 캐시 만료) 시트에서 똑같이 다시 만들어지는지 */
const before = ok("snapshot", L);
gas.context.CacheService.getScriptCache().remove("state:" + L.roomCode);
const after = ok("snapshot", L);
assert.deepStrictEqual(after.exchanges, before.exchanges);
assert.strictEqual(after.version, before.version);

console.log("모든 테스트 통과 (방 " + L.roomCode + ")");
