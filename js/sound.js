/* 효과음 - 파일이 있는 소리는 /sound/ 파일로, 나머지는 브라우저에서 직접 합성 (파일을 못 불러오면 합성음으로 대신) */
var SND = true;             // 효과음 켜짐 여부 (다른 JS에서도 참조)
var audioContext = null;    // 오디오 컨텍스트 (첫 사용 시 생성)

const SOUND_STORAGE_KEY = "synchalloweenSound";

/* 파일 효과음 - maxDuration이 있으면 그 길이까지만 재생하고 끝을 부드럽게 줄임 */
const SFX_FILES = {
    RECEPT: { url: "sound/RECEPT.mp3", volume: 0.8 },                        // 신호 수신, 글자 깨짐
    BUTTON: { url: "sound/BUTTON.mp3", volume: 0.6 },                        // 버튼
    SUCCESS: { url: "sound/SUCCESS.mp3", volume: 0.8 },                      // 응답 확정
    FLICKER: { url: "sound/NOISE.mp3", volume: 0.7, maxDuration: 1.5 },      // 폴터가이스트 - 깜빡인다
    SHAKE: { url: "sound/SHAKE.mp3", volume: 0.9 },                          // 폴터가이스트 - 흔들린다
    DROP: { url: "sound/DROP.mp3", volume: 0.9 },                            // 폴터가이스트 - 떨어트린다
    NOISE: { url: "sound/NOISE2.mp3", volume: 0.7, maxDuration: 1.5 },       // 폴터가이스트 - 노이즈
    SOUND: { url: "sound/DEAD.mp3", volume: 0.8 }                            // 폴터가이스트 - 소리 (원본 61초 중 앞 4초, 끝 1.5초 페이드아웃)
};

const sfxBuffers = {};      // 불러온 파일 { 이름: AudioBuffer }
let isSfxLoading = false;   // 파일 불러오기를 시작했는지

/* 저장된 효과음 설정 불러오기 */
function loadSoundSetting() {
    try {
        SND = localStorage.getItem(SOUND_STORAGE_KEY) !== "off";
    } catch (e) {
        SND = true;
    }
}

/* 오디오 컨텍스트 준비 */
function getAudioContext() {
    if (!SND) return null;
    audioContext = audioContext || new (window.AudioContext || window.webkitAudioContext)();
    if (audioContext.state === "suspended") audioContext.resume();
    loadSfxFiles();
    return audioContext;
}

/* 파일 효과음 미리 불러오기 (첫 소리가 날 때 한 번) */
function loadSfxFiles() {
    if (isSfxLoading || !audioContext) return;
    isSfxLoading = true;
    Object.keys(SFX_FILES).forEach(function (name) {
        fetch(SFX_FILES[name].url)
            .then(function (res) {
                if (!res.ok) throw new Error("no file");
                return res.arrayBuffer();
            })
            .then(function (data) {
                return audioContext.decodeAudioData(data);
            })
            .then(function (buffer) {
                sfxBuffers[name] = buffer;
            })
            .catch(function () { });
    });
}

/* 파일 효과음 재생 - 아직 못 불러왔으면 합성음(fallback)으로 (delay초 뒤 재생 가능) */
function playSfxFile(name, fallback, delay) {
    const ac = getAudioContext();
    if (!ac) return;
    const buffer = sfxBuffers[name];
    if (!buffer) {
        if (fallback) fallback();
        return;
    }
    const option = SFX_FILES[name];
    const start = ac.currentTime + (delay || 0);
    const source = ac.createBufferSource();
    source.buffer = buffer;
    const gain = ac.createGain();
    gain.gain.setValueAtTime(option.volume, start);
    source.connect(gain);
    gain.connect(ac.destination);
    if (option.maxDuration && buffer.duration > option.maxDuration) {
        gain.gain.setValueAtTime(option.volume, start + option.maxDuration - 0.3);
        gain.gain.linearRampToValueAtTime(0.0001, start + option.maxDuration);
        source.start(start, 0, option.maxDuration);
    } else {
        source.start(start);
    }
}

/* 효과음 버튼 표시 갱신 */
function renderSoundButton(button) {
    if (!button) return;
    button.querySelector("i").className = SND ? "bi bi-volume-up-fill" : "bi bi-volume-mute-fill";
    button.querySelector("span").textContent = SND ? " 효과음 ON" : " 효과음 OFF";
}

/* 효과음 켜기/끄기 */
function toggleSound(button) {
    SND = !SND;
    try {
        localStorage.setItem(SOUND_STORAGE_KEY, SND ? "on" : "off");
    } catch (e) { }
    renderSoundButton(button);
}

/* 단음 재생 (freq → slideTo로 미끄러짐) */
function playTone(freq, duration, type, volume, delay, slideTo) {
    const ac = getAudioContext();
    if (!ac) return;
    const start = ac.currentTime + (delay || 0);
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.type = type || "sine";
    osc.frequency.setValueAtTime(freq, start);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, start + duration);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(volume, start + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    osc.connect(gain);
    gain.connect(ac.destination);
    osc.start(start);
    osc.stop(start + duration + 0.05);
}

/* 잡음 재생 (필터로 색을 입힘) */
function playNoise(duration, volume, filterType, frequency, q, delay) {
    const ac = getAudioContext();
    if (!ac) return;
    const start = ac.currentTime + (delay || 0);
    const buffer = ac.createBuffer(1, Math.floor(ac.sampleRate * duration), ac.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) {
        data[i] = Math.random() * 2 - 1;
    }
    const source = ac.createBufferSource();
    source.buffer = buffer;
    const filter = ac.createBiquadFilter();
    filter.type = filterType || "bandpass";
    filter.frequency.value = frequency || 1200;
    filter.Q.value = q || 1;
    const gain = ac.createGain();
    gain.gain.setValueAtTime(volume, start);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    source.connect(filter);
    filter.connect(gain);
    gain.connect(ac.destination);
    source.start(start);
}

/* 버튼 */
function sfxClick() {
    playSfxFile("BUTTON", function () {
        playNoise(0.03, 0.15, "highpass", 3000, 0.7);
    });
}

/* 신분증 스캔 - 위로 훑는 소리 */
function sfxScan() {
    playTone(300, 1.1, "sawtooth", 0.04, 0, 1400);
    playNoise(1.1, 0.03, "bandpass", 2500, 4);
}

/* 확인 완료 - 두 음 */
function sfxOk() {
    playTone(660, 0.12, "square", 0.05);
    playTone(990, 0.18, "square", 0.05, 0.12);
}

/* 신호 수신 - 삐삐 두 번 */
function sfxSignal() {
    playSfxFile("RECEPT", function () {
        playTone(1800, 0.08, "square", 0.05);
        playTone(1800, 0.08, "square", 0.05, 0.14);
    });
}

/* 단말기 글자 깨짐 - 신호 수신(RECEPT)을 길이만큼 이어서 재생 (반응없음 1번, YES·NO 2번) */
function sfxStatic(duration) {
    const length = duration || 0.6;
    const buffer = sfxBuffers.RECEPT;
    if (buffer) {
        const count = Math.max(1, Math.round(length / buffer.duration));
        for (let i = 0; i < count; i++) {
            playSfxFile("RECEPT", null, i * buffer.duration);
        }
        return;
    }
    getAudioContext();
    for (let t = 0; t < length; t += 0.07) {
        playNoise(0.05, 0.06 + Math.random() * 0.05, "bandpass", 800 + Math.random() * 3000, 2, t);
    }
}

/* 응답 확정 - 낮은 삑 */
function sfxLock() {
    playSfxFile("SUCCESS", function () {
        playTone(520, 0.25, "triangle", 0.08);
    });
}

/* 폴터가이스트 - 깜빡임 (전기 웅웅) */
function sfxFlicker() {
    playSfxFile("FLICKER", function () {
        for (let i = 0; i < 4; i++) {
            playTone(60, 0.08, "sawtooth", 0.08, i * 0.13 + Math.random() * 0.05);
        }
    });
}

/* 폴터가이스트 - 흔들림 (낮은 울림) */
function sfxRumble() {
    playSfxFile("SHAKE", function () {
        playNoise(1.2, 0.25, "lowpass", 120, 1);
        playTone(45, 1.2, "sine", 0.15);
    });
}

/* 폴터가이스트 - 떨어짐 (쿵) */
function sfxThud() {
    playSfxFile("DROP", function () {
        playTone(110, 0.35, "sine", 0.3, 0, 40);
        playNoise(0.15, 0.2, "lowpass", 400, 1);
    });
}

/* 폴터가이스트 - 노이즈 (거친 잡음) */
function sfxNoise() {
    playSfxFile("NOISE", function () {
        playNoise(0.9, 0.12, "highpass", 1500, 0.5);
    });
}

/* 폴터가이스트 - 소리 (어긋난 음이 내려앉음) */
function sfxEerie() {
    playSfxFile("SOUND", function () {
        playTone(440, 1.6, "sine", 0.06, 0, 300);
        playTone(447, 1.6, "sine", 0.06, 0.05, 296);
        playTone(220, 1.8, "triangle", 0.04, 0.2, 150);
    });
}

/* 연결 끊김 - 내려가는 삑 */
function sfxDisconnect() {
    playTone(880, 0.6, "square", 0.05, 0, 110);
}

loadSoundSetting();
