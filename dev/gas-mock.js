/*
 * 로컬 연습용 가짜 Apps Script 환경
 * apps-script/Code.gs를 고치지 않고 그대로 Node에서 실행하기 위해
 * Code.gs가 쓰는 구글 서비스(SpreadsheetApp, CacheService, LockService ...)를 아주 작게 흉내 냅니다.
 * 시트 내용은 dev/mock-db.json에 저장되어 직접 열어볼 수 있습니다.
 */
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const crypto = require("crypto");

function createGas(options) {
    const dbFile = options && options.dbFile;
    const sheets = loadDb(dbFile);

    /* ---- SpreadsheetApp ---- */
    function makeSheet(name, rows) {
        let maxRows = Math.max(1000, rows.length);
        const sheet = {
            name: name,
            rows: rows,
            getName: function () { return name; },
            getLastRow: function () {
                let last = rows.length;
                while (last > 0 && rows[last - 1].every(function (v) { return v === "" || v === undefined; })) last--;
                return last;
            },
            getMaxRows: function () { return maxRows; },
            insertRowsAfter: function (after, count) { maxRows += count; },
            setFrozenRows: function () { },
            getRange: function (row, col, numRows, numCols) {
                return makeRange(sheet, row, col, numRows || 1, numCols || 1);
            }
        };
        return sheet;
    }

    function makeRange(sheet, row, col, numRows, numCols) {
        const range = {
            getRow: function () { return row; },
            getValues: function () {
                const out = [];
                for (let r = 0; r < numRows; r++) {
                    const src = sheet.rows[row - 1 + r] || [];
                    const line = [];
                    for (let c = 0; c < numCols; c++) {
                        const v = src[col - 1 + c];
                        line.push(v === undefined ? "" : v);
                    }
                    out.push(line);
                }
                return out;
            },
            setValues: function (values) {
                values.forEach(function (line, r) {
                    while (sheet.rows.length < row + r) sheet.rows.push([]);
                    const target = sheet.rows[row - 1 + r];
                    line.forEach(function (v, c) {
                        /* 실제 시트처럼 맨 앞 ' 는 "글자로 저장" 표시라 값에서 빠짐 */
                        target[col - 1 + c] = typeof v === "string" && v.charAt(0) === "'" ? v.slice(1) : v;
                    });
                });
                return range;
            },
            setNumberFormat: function () { return range; },
            setFontWeight: function () { return range; },
            createTextFinder: function (text) {
                let entire = false;
                let matchCase = false;
                const finder = {
                    matchEntireCell: function (v) { entire = v; return finder; },
                    matchCase: function (v) { matchCase = v; return finder; },
                    findAll: function () {
                        const found = [];
                        const values = range.getValues();
                        const needle = matchCase ? text : text.toLowerCase();
                        values.forEach(function (line, r) {
                            line.forEach(function (v, c) {
                                const hay = matchCase ? String(v) : String(v).toLowerCase();
                                if (entire ? hay === needle : hay.indexOf(needle) >= 0) {
                                    found.push(makeRange(sheet, row + r, col + c, 1, 1));
                                }
                            });
                        });
                        return found;
                    }
                };
                return finder;
            }
        };
        return range;
    }

    const sheetObjects = {};
    Object.keys(sheets).forEach(function (name) {
        sheetObjects[name] = makeSheet(name, sheets[name]);
    });

    const spreadsheet = {
        getSheetByName: function (name) { return sheetObjects[name] || null; },
        insertSheet: function (name) {
            sheets[name] = [];
            sheetObjects[name] = makeSheet(name, sheets[name]);
            return sheetObjects[name];
        },
        getSheets: function () { return Object.values(sheetObjects); },
        deleteSheet: function (sheet) {
            delete sheets[sheet.name];
            delete sheetObjects[sheet.name];
        }
    };

    /* ---- CacheService (만료 시간 + 100KB 제한까지 흉내) ---- */
    const cacheStore = new Map();
    const cache = {
        get: function (key) {
            const item = cacheStore.get(key);
            if (!item || item.expires < Date.now()) return null;
            return item.value;
        },
        put: function (key, value, seconds) {
            if (Buffer.byteLength(String(value)) > 100 * 1024) throw new Error("Argument too large: value");
            cacheStore.set(key, { value: String(value), expires: Date.now() + (seconds || 600) * 1000 });
        },
        remove: function (key) { cacheStore.delete(key); }
    };

    const context = {
        console: console,
        SpreadsheetApp: {
            getActiveSpreadsheet: function () { return spreadsheet; },
            openById: function () { return spreadsheet; }
        },
        PropertiesService: {
            getScriptProperties: function () { return { getProperty: function () { return null; } }; }
        },
        CacheService: { getScriptCache: function () { return cache; } },
        LockService: {
            getScriptLock: function () {
                return { tryLock: function () { return true; }, waitLock: function () { }, releaseLock: function () { } };
            }
        },
        Utilities: {
            getUuid: function () { return crypto.randomUUID(); },
            formatDate: function (date) {
                /* 한국 시간 "yyyy-MM-dd HH:mm:ss" 만 지원 */
                const k = new Date(date.getTime() + 9 * 3600 * 1000).toISOString();
                return k.slice(0, 10) + " " + k.slice(11, 19);
            }
        },
        ContentService: {
            MimeType: { JSON: "application/json" },
            createTextOutput: function (content) {
                return { content: content, setMimeType: function () { return this; } };
            }
        }
    };
    vm.createContext(context);
    const code = fs.readFileSync(path.join(__dirname, "..", "apps-script", "Code.gs"), "utf8");
    vm.runInContext(code, context, { filename: "Code.gs" });

    if (!spreadsheet.getSheetByName("Rooms")) context.setup();

    return {
        /* doPost 호출 → 응답 JSON 문자열 */
        post: function (bodyText) {
            const out = context.doPost({ postData: { contents: bodyText } });
            saveDb(dbFile, sheets);
            return out.content;
        },
        context: context
    };
}

function loadDb(file) {
    if (file && fs.existsSync(file)) {
        try {
            return JSON.parse(fs.readFileSync(file, "utf8"));
        } catch (e) { }
    }
    return {};
}

function saveDb(file, sheets) {
    if (file) fs.writeFileSync(file, JSON.stringify(sheets, null, 1));
}

module.exports = { createGas: createGas };
