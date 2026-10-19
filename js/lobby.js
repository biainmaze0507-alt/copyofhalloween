/* 로비 - 신분증, 방 만들기, 코드 입장 */
const AGENT_STORAGE_KEY = "synchalloweenAgent";    // 신분증 정보 저장 키
const ENTRY_STORAGE_KEY = "synchalloweenEntry";    // 입장한 방 정보 저장 키 (단말기 화면에서 읽음)

let selectedLife = null;    // 방 만들기에서 고른 요원 (LIVING / DEAD)
const CONNECT_WAIT_MS = 3000;   // "단말기가 연결되었습니다." 표시 후 이동까지

/* 무전기 문구 (파트너를 떠나보냈다 = 남은 요원 / 떠났다 = 떠난 요원) */
const RADIO_TEXT = {
    LIVING: { prompt: "그리운 사람의 이름을 불러보세요.", button: "그의 이름을 부른다", icon: "bi-mic" },
    DEAD: { prompt: "당신을 부르던 목소리의 주인을 떠올려 보세요.", button: "목소리에 귀를 기울인다", icon: "bi-soundwave" }
};

/* 저장된 신분증 복원 */
function restoreFromStorage() {
    let saved = null;
    try {
        saved = localStorage.getItem(AGENT_STORAGE_KEY);
    } catch (e) {
        return;
    }
    if (!saved) return;

    try {
        const data = JSON.parse(saved);
        if (data.name) document.getElementById("myName").value = data.name;
        if (data.age !== undefined && data.age !== null) document.getElementById("myAge").value = data.age;
        if (data.birthday) document.getElementById("myBirthday").value = data.birthday;
        if (data.image) setPhoto(data.image);
        document.getElementById("restoreBanner").classList.remove("hidden");
    } catch (e) {
        localStorage.removeItem(AGENT_STORAGE_KEY);
    }
}

/* 신분증 저장 */
function saveToStorage() {
    const photoImg = document.getElementById("idPhoto").querySelector("img");
    try {
        localStorage.setItem(AGENT_STORAGE_KEY, JSON.stringify({
            name: document.getElementById("myName").value.trim(),
            age: document.getElementById("myAge").value,
            birthday: document.getElementById("myBirthday").value.trim(),
            image: photoImg ? photoImg.src : null
        }));
    } catch (e) { }
}

/* 입력 변경 시 저장 + 바코드 + 버튼 상태 갱신 */
function onFieldChange() {
    saveToStorage();
    updateBarcode();
    updateButtons();
}

/* 신분증 사진 표시 */
function setPhoto(src) {
    const photo = document.getElementById("idPhoto");
    document.getElementById("photoPlaceholder").classList.add("hidden");
    let img = photo.querySelector("img");
    if (!img) {
        img = document.createElement("img");
        photo.appendChild(img);
    }
    img.src = src;
}

/* 나이 칸 - 숫자만 남김 (0~999, 최대 3자리) */
function onAgeInput() {
    const input = document.getElementById("myAge");
    input.value = input.value.replace(/[^0-9]/g, "").slice(0, 3);
    onFieldChange();
}

/* 이름 → 5자리 식별코드 */
function generateAgentCode(name) {
    if (!name) return "00000";
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
        hash = ((hash << 5) - hash + name.charCodeAt(i)) | 0;
    }
    hash = Math.abs(hash);
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let result = "";
    for (let j = 0; j < 5; j++) {
        result += chars[hash % chars.length];
        hash = Math.floor(hash / chars.length) + (hash % 7) + j;
    }
    return result;
}

/* 바코드 갱신 */
function updateBarcode() {
    const agentCode = generateAgentCode(document.getElementById("myName").value.trim());

    const barcodeEl = document.getElementById("barcode");
    barcodeEl.innerHTML = "";

    const seed = "SYNC" + agentCode;
    for (let i = 0; i < seed.length; i++) {
        const code = seed.charCodeAt(i);
        appendBar(barcodeEl, code % 3 === 0 ? " thick" : code % 3 === 1 ? "" : " thin");
        appendBar(barcodeEl, " space");
        appendBar(barcodeEl, code % 2 === 0 ? " thin" : "");
        if (i < seed.length - 1) appendBar(barcodeEl, " space");
    }

    document.getElementById("barcodeText").textContent = "SYNC-" + agentCode;
}

/* 바코드 막대 하나 추가 */
function appendBar(parent, modifier) {
    const bar = document.createElement("span");
    bar.className = "barcode-bar" + modifier;
    parent.appendChild(bar);
}

/* 이미지 업로드 (256x256 가운데 자르기, JPEG 0.7 압축 - 시트 한 칸(5만 자)에 들어가도록 넘치면 화질을 더 낮춤) */
function handleImageUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
        showError("파일 크기는 5MB 이하여야 합니다.");
        return;
    }

    const reader = new FileReader();
    reader.onload = function (e) {
        const img = new Image();
        img.onload = function () {
            const canvas = document.createElement("canvas");
            canvas.width = 256;
            canvas.height = 256;
            const ctx = canvas.getContext("2d");
            const size = Math.min(img.width, img.height);
            const sx = (img.width - size) / 2;
            const sy = (img.height - size) / 2;
            ctx.drawImage(img, sx, sy, size, size, 0, 0, 256, 256);

            let quality = 0.7;
            let dataUrl = canvas.toDataURL("image/jpeg", quality);
            while (dataUrl.length > 45000 && quality > 0.2) {
                quality -= 0.1;
                dataUrl = canvas.toDataURL("image/jpeg", quality);
            }
            setPhoto(dataUrl);
            saveToStorage();
        };
        img.src = e.target.result;
    };
    reader.readAsDataURL(file);
}

/* 신분증이 다 채워졌는지 */
function isAgentReady() {
    return document.getElementById("myName").value.trim() !== "";
}

/* 4칸 코드 읽기 */
function getCodeFromBoxes() {
    let code = "";
    document.querySelectorAll(".code-box").forEach(function (box) {
        code += box.value;
    });
    return code.toUpperCase();
}

/* 방 만들기·입장 버튼 활성화 */
function updateButtons() {
    const agentReady = isAgentReady();
    const hasName = document.getElementById("partnerName").value.trim() !== "";
    document.getElementById("createBtn").disabled = !(agentReady && selectedLife && hasName);
    document.getElementById("joinBtn").disabled = !(agentReady && getCodeFromBoxes().length === 4);
}

/* 요원 선택 (남은 요원 / 떠난 요원) */
function selectLife(life) {
    selectedLife = life;
    document.querySelectorAll(".life-btn").forEach(function (btn) {
        btn.classList.toggle("selected", btn.dataset.life === life);
    });
    document.getElementById("idCard").classList.toggle("worn", life === "DEAD");

    document.getElementById("callBox").classList.remove("hidden");
    document.getElementById("callPrompt").textContent = RADIO_TEXT[life].prompt;
    document.getElementById("createBtn").classList.remove("hidden");
    document.getElementById("createBtnText").textContent = RADIO_TEXT[life].button;
    document.getElementById("createBtnIcon").className = "bi " + RADIO_TEXT[life].icon;
    updateButtons();
}

/* 이름 → 주파수 (140.00 ~ 159.99 MHz, 같은 이름이면 같은 주파수) */
function frequencyOf(name) {
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
        hash = ((hash << 5) - hash + name.charCodeAt(i)) | 0;
    }
    const value = 14000 + Math.abs(hash) % 2000;
    return (value / 100).toFixed(2);
}

/* 무전기 액정을 처음 상태로 ("응답 없음") */
function resetLcd(radio) {
    setLcd(radio, "CH ---.-- MHz", "응답 없음");
}

/* 로딩 아이콘 */
function setSpin(radio, isOn) {
    document.getElementById(radio + "Spin").classList.toggle("hidden", !isOn);
}

/* 무전기 LCD 표시 (sub가 null이면 윗줄은 그대로) */
function setLcd(radio, sub, main, isCode) {
    if (sub !== null) document.getElementById(radio + "LcdSub").textContent = sub;
    const mainEl = document.getElementById(radio + "LcdMain");
    mainEl.textContent = main;
    mainEl.classList.toggle("code", !!isCode);
}

/* 무전기 표시등 (off / blink / on) */
function setLed(radio, state) {
    const led = document.getElementById(radio + "Led");
    led.classList.toggle("blink", state === "blink");
    led.classList.toggle("on", state === "on");
}

/* LCD 잡음 연출 - 지정한 시간 동안 아랫줄 글자가 깨짐 (단말기 응답과 같은 잡음 효과음) */
function scrambleLcd(radio, duration) {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789#*/=";
    sfxStatic(duration / 1000);
    return new Promise(function (resolve) {
        const started = Date.now();
        const timer = setInterval(function () {
            let text = "";
            for (let i = 0; i < 6; i++) {
                text += chars[Math.floor(Math.random() * chars.length)];
            }
            setLcd(radio, null, text, true);
            if (Date.now() - started >= duration) {
                clearInterval(timer);
                resolve();
            }
        }, 60);
    });
}

/* 이름 입력 시 버튼 상태만 갱신 (액정은 연결 전까지 "응답 없음") */
function onPartnerNameInput() {
    updateButtons();
}

/* 송신 중 무전기 입력 잠그기 */
function lockRadio(radioId, isLocked) {
    document.getElementById(radioId).querySelectorAll("button, input").forEach(function (node) {
        node.disabled = isLocked;
    });
}

/* 4칸 코드 입력 동작 */
function initCodeBoxes() {
    const boxes = document.querySelectorAll(".code-box");

    boxes.forEach(function (box, i) {
        box.addEventListener("input", function () {
            box.value = box.value.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
            if (box.value && i < 3) boxes[i + 1].focus();
            updateButtons();
        });

        box.addEventListener("keydown", function (e) {
            if (e.key === "Backspace" && !box.value && i > 0) {
                boxes[i - 1].focus();
                boxes[i - 1].value = "";
                updateButtons();
            }
            if (e.key === "Enter" && !document.getElementById("joinBtn").disabled) {
                joinRoom();
            }
        });

        box.addEventListener("paste", function (e) {
            e.preventDefault();
            const paste = (e.clipboardData || window.clipboardData).getData("text")
                .replace(/[^A-Za-z0-9]/g, "").toUpperCase().slice(0, 4);
            for (let j = 0; j < paste.length; j++) {
                boxes[j].value = paste[j];
            }
            if (paste.length > 0) boxes[Math.min(paste.length, 3)].focus();
            updateButtons();
        });
    });
}

/* 서버로 보낼 신분증 */
function buildAgent() {
    const photoImg = document.getElementById("idPhoto").querySelector("img");
    return {
        name: document.getElementById("myName").value.trim(),
        age: document.getElementById("myAge").value === "" ? null : Number(document.getElementById("myAge").value),
        birthday: document.getElementById("myBirthday").value.trim() || null,
        image: photoImg ? photoImg.src : null
    };
}

/* 오류 문구 표시 */
function showError(message) {
    document.getElementById("lobbyError").textContent = message || "";
}

/* 입장 정보 저장 후 단말기 화면으로 이동 */
function enterTerminal(entry) {
    try {
        localStorage.setItem(ENTRY_STORAGE_KEY, JSON.stringify(entry));
    } catch (e) { }
    window.location.href = "terminal.html";
}

/* 방 만들기 - 이름을 부르면 액정이 켜지고 잡음 뒤 연결, 3초 뒤 단말기로 이동 */
function createRoom() {
    showError("");
    const frequency = frequencyOf(document.getElementById("partnerName").value.trim());
    lockRadio("createRadio", true);
    setLed("create", "blink");

    Promise.all([
        api("createRoom", { agent: buildAgent(), life: selectedLife }),
        scrambleLcd("create", 900)
    ]).then(function (results) {
        const entry = results[0];
        entry.frequency = frequency;
        setLed("create", "on");
        setSpin("create", true);
        setLcd("create", "CH " + frequency + " MHz", "단말기가 연결되었습니다.");
        setTimeout(function () {
            enterTerminal(entry);
        }, CONNECT_WAIT_MS);
    }).catch(function (e) {
        setLed("create", "off");
        resetLcd("create");
        lockRadio("createRadio", false);
        showError(e.message);
        updateButtons();
    });
}

/* 코드 입장 - 이 브라우저로 이미 들어간 방이면 그 단말기로 돌아감 */
function joinRoom() {
    showError("");
    const code = getCodeFromBoxes();

    let saved = null;
    try {
        saved = JSON.parse(localStorage.getItem(ENTRY_STORAGE_KEY));
    } catch (e) { }
    if (saved && saved.roomCode === code) {
        window.location.href = "terminal.html";
        return;
    }

    lockRadio("joinRadio", true);
    setLed("join", "blink");

    Promise.all([
        api("joinRoom", { roomCode: code, agent: buildAgent() }),
        scrambleLcd("join", 900)
    ]).then(function (results) {
        setLed("join", "on");
        setSpin("join", true);
        setLcd("join", "CH ---.-- MHz", "단말기가 연결되었습니다.");
        setTimeout(function () {
            enterTerminal(results[0]);
        }, CONNECT_WAIT_MS);
    }).catch(function (e) {
        setLed("join", "off");
        resetLcd("join");
        lockRadio("joinRadio", false);
        showError(e.message);
        updateButtons();
    });
}

/* 초기화 */
document.addEventListener("DOMContentLoaded", function () {
    /* 첫 클릭·키 입력 때 효과음 파일을 미리 불러 둠 (무전기 잡음이 파일 소리로 나오도록) */
    const preloadSound = function () {
        document.removeEventListener("pointerdown", preloadSound);
        document.removeEventListener("keydown", preloadSound);
        getAudioContext();
    };
    document.addEventListener("pointerdown", preloadSound);
    document.addEventListener("keydown", preloadSound);

    restoreFromStorage();
    updateBarcode();
    initCodeBoxes();
    updateButtons();

    document.getElementById("idPhoto").addEventListener("click", function () {
        document.getElementById("imageFile").click();
    });
    document.getElementById("imageFile").addEventListener("change", handleImageUpload);

    document.getElementById("myName").addEventListener("input", onFieldChange);
    document.getElementById("myAge").addEventListener("input", onAgeInput);
    document.getElementById("myBirthday").addEventListener("input", onFieldChange);

    document.querySelectorAll(".life-btn").forEach(function (btn) {
        btn.addEventListener("click", function () {
            selectLife(btn.dataset.life);
        });
    });

    const nameInput = document.getElementById("partnerName");
    nameInput.addEventListener("input", onPartnerNameInput);
    nameInput.addEventListener("keydown", function (e) {
        if (e.key === "Enter" && !document.getElementById("createBtn").disabled) createRoom();
    });

    document.getElementById("createBtn").addEventListener("click", createRoom);
    document.getElementById("joinBtn").addEventListener("click", joinRoom);
});