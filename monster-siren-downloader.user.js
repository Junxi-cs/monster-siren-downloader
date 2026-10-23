// ==UserScript==
// @name         塞壬唱片 音乐下载器
// @name:en      Monster Siren Music Downloader
// @namespace    https://github.com/your-name/monster-siren-downloader
// @version      1.2.0
// @description  在塞壬唱片官网一键下载当前歌曲（原音质 MP3）。页面右侧出现悬浮「下载」按钮，点击即可保存到本地。
// @description:en One-click download of the currently playing song on the Monster Siren (塞壬唱片) official site.
// @author       your-name
// @match        https://monster-siren.hypergryph.com/*
// @icon         https://monster-siren.hypergryph.com/favicon.ico
// @grant        GM_xmlhttpRequest
// @grant        unsafeWindow
// @connect      monster-siren.hypergryph.com
// @connect      *.hypergryph.com
// @connect      *
// @run-at       document-idle
// @noframes
// @license      MIT
// ==/UserScript==

/*
 * MIT License
 * 本项目仅用于个人学习与本地备份已购买/已授权的音乐，请勿用于二次分发。
 * 所有音乐版权归上海鹰角网络科技有限公司（Hypergryph）及塞壬唱片所有。
 */

(function () {
  "use strict";

  // ================= 可自定义配置 =================
  const CONFIG = {
    buttonText: "下载",
    buttonSide: "right", // "right" | "left"
    buttonTop: "40%",    // 悬浮按钮距顶部的距离
  };
  // ===============================================

  const W = typeof unsafeWindow !== "undefined" ? unsafeWindow : window;
  const CTL = "__msMusicDownloader";
  const state = (W[CTL] = W[CTL] || { installed: false, mediaEls: [], mediaUrls: [] });

  /* ---------- 1. 捕获页面媒体元素（识别「正在播放」） ---------- */
  function rememberEl(el) {
    try {
      if (el && state.mediaEls.indexOf(el) < 0) state.mediaEls.push(el);
    } catch (e) {}
  }

  if (!state.installed) {
    state.installed = true;
    try {
      const d = Object.getOwnPropertyDescriptor(W.HTMLMediaElement.prototype, "src");
      if (d && d.set) {
        Object.defineProperty(W.HTMLMediaElement.prototype, "src", {
          configurable: true,
          get: d.get,
          set: function (v) {
            try {
              rememberEl(this);
              if (v) state.mediaUrls.push({ url: String(v), t: Date.now() });
            } catch (e) {}
            return d.set.call(this, v);
          },
        });
      }
    } catch (e) {}
    try {
      const op = W.HTMLMediaElement.prototype.play;
      W.HTMLMediaElement.prototype.play = function () {
        try {
          rememberEl(this);
        } catch (e) {}
        return op.apply(this, arguments);
      };
    } catch (e) {}
  }

  /* ---------- 2. 网络请求封装（优先 GM，绕过 CORS） ---------- */
  function gm(method, url, responseType) {
    return new Promise(function (resolve, reject) {
      GM_xmlhttpRequest({
        method: method,
        url: url,
        responseType: responseType || "json",
        timeout: 60000,
        onload: resolve,
        onerror: function () {
          reject(new Error("网络请求失败：" + url));
        },
        ontimeout: function () {
          reject(new Error("请求超时：" + url));
        },
      });
    });
  }

  async function getJson(url) {
    const r = await gm("GET", url, "json");
    if (r.status < 200 || r.status >= 300) throw new Error("接口返回 HTTP " + r.status);
    return typeof r.response === "string" ? JSON.parse(r.response) : r.response;
  }

  async function getBlob(url) {
    const r = await gm("GET", url, "blob");
    if (r.status < 200 || r.status >= 300) throw new Error("音频返回 HTTP " + r.status);
    return r.response;
  }

  /* ---------- 3. 塞壬唱片 API ---------- */
  async function songMeta(cid) {
    const j = await getJson(location.origin + "/api/song/" + cid);
    if (!j || j.code !== 0 || !j.data) throw new Error("歌曲接口返回异常");
    return j.data; // { cid, name, albumCid, sourceUrl, lyricUrl, mvUrl, artists }
  }

  async function nameIndex() {
    const j = await getJson(location.origin + "/api/songs");
    const map = new Map();
    if (j && j.code === 0 && j.data && Array.isArray(j.data.list)) {
      for (const s of j.data.list) if (s && s.name) map.set(s.name, s.cid);
    }
    return map;
  }

  /* ---------- 4. 解析当前曲目 ---------- */
  async function resolveTrack() {
    const cidFromUrl = (location.pathname.match(/\/music\/(\w+)/) || [])[1] || null;

    // 4a. 正在播放的媒体元素（最高优先级）
    let liveEl = null;
    try {
      liveEl = state.mediaEls.find(function (el) {
        try {
          return el.currentSrc && !el.paused;
        } catch (e) {
          return false;
        }
      });
      if (!liveEl) {
        document.querySelectorAll("audio,video").forEach(rememberEl);
        liveEl = state.mediaEls.find(function (el) {
          try {
            return el.currentSrc && !el.paused;
          } catch (e) {
            return false;
          }
        });
      }
    } catch (e) {}
    if (liveEl && liveEl.currentSrc) {
      return { url: liveEl.currentSrc, cid: cidFromUrl, name: null, method: "正在播放的媒体元素" };
    }

    // 4b. 详情页 URL 中的歌曲 ID（最可靠）
    if (cidFromUrl) {
      const meta = await songMeta(cidFromUrl);
      return {
        url: meta.sourceUrl,
        cid: cidFromUrl,
        name: meta.name,
        artist: (meta.artists && meta.artists[0]) || null,
        albumCid: meta.albumCid,
        method: "页面歌曲 ID",
      };
    }

    // 4c. 页面播放器标题匹配（兜底）
    try {
      const names = await nameIndex();
      const scopes = document.querySelectorAll(
        '[class*="infoAndControl"],[class*="musicPlay"],[class*="playWidget"],[class*="player"]'
      );
      for (const root of scopes) {
        for (const el of root.querySelectorAll("*")) {
          const t = (el.textContent || "").trim();
          if (t && t.length < 60 && names.has(t)) {
            return { url: null, cid: names.get(t), name: t, method: "页面标题匹配" };
          }
        }
      }
    } catch (e) {}

    return null;
  }

  /* ---------- 5. 下载 ---------- */
  function extOf(url) {
    try {
      const m = new URL(url).pathname.match(/\.([a-z0-9]{2,5})$/i);
      return m ? m[1].toLowerCase() : "mp3";
    } catch (e) {
      return "mp3";
    }
  }

  function safeName(s, ext) {
    const base =
      (s || "music")
        .replace(/[\\/:*?"<>|\r\n\t]+/g, "_")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 120) || "music";
    return base + "." + ext;
  }

  async function downloadCurrent() {
    const info = await resolveTrack();
    if (!info) {
      return {
        ok: false,
        summary: "未识别到当前歌曲：请打开塞壬唱片歌曲详情页（/music/xxx），或先播放音乐后再试。",
      };
    }
    if (!info.url && info.cid) {
      const meta = await songMeta(info.cid);
      info.url = meta.sourceUrl;
      info.name = info.name || meta.name;
      info.artist = info.artist || (meta.artists && meta.artists[0]) || null;
    }
    if (!info.url) return { ok: false, summary: "未能解析到音频地址。" };
    if (!info.name) {
      const t = document.title.split(" - ")[0];
      info.name = t && t.trim() ? t.trim() : "music";
    }

    const filename = safeName(info.name, extOf(info.url));
    const blob = await getBlob(info.url);
    const objUrl = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = objUrl;
    a.download = filename;
    a.style.display = "none";
    document.body.appendChild(a);
    a.click();
    setTimeout(function () {
      try {
        URL.revokeObjectURL(objUrl);
        a.remove();
      } catch (e) {}
    }, 60000);

    return {
      ok: true,
      summary: "已开始下载：" + info.name + "（" + (blob.size / 1048576).toFixed(1) + " MB）",
    };
  }

  /* ---------- 6. 悬浮按钮与提示 ---------- */
  function toast(text, ok) {
    const el = document.createElement("div");
    el.textContent = text;
    Object.assign(el.style, {
      position: "fixed",
      left: "50%",
      top: "20px",
      transform: "translateX(-50%)",
      padding: "10px 16px",
      borderRadius: "8px",
      zIndex: 100000,
      background: ok ? "#1f8f4e" : "#c0392b",
      color: "#fff",
      fontSize: "14px",
      boxShadow: "0 2px 10px rgba(0,0,0,.3)",
      maxWidth: "80vw",
    });
    document.body.appendChild(el);
    setTimeout(function () {
      try {
        el.remove();
      } catch (e) {}
    }, 4000);
  }

  function mount() {
    if (document.getElementById("ms-dl-btn")) return;
    const btn = document.createElement("button");
    btn.id = "ms-dl-btn";
    btn.textContent = CONFIG.buttonText;
    Object.assign(btn.style, {
      position: "fixed",
      zIndex: 99999,
      [CONFIG.buttonSide]: "16px",
      top: CONFIG.buttonTop,
      padding: "10px 14px",
      border: "none",
      borderRadius: "20px",
      background: "#2b2b2b",
      color: "#fff",
      fontSize: "14px",
      cursor: "pointer",
      boxShadow: "0 2px 10px rgba(0,0,0,.35)",
    });
    btn.addEventListener("click", async function () {
      btn.disabled = true;
      btn.textContent = "解析中…";
      try {
        const res = await downloadCurrent();
        toast(res.summary, res.ok);
      } catch (e) {
        toast("下载失败：" + (e && e.message ? e.message : e), false);
      }
      btn.disabled = false;
      btn.textContent = CONFIG.buttonText;
    });
    document.body.appendChild(btn);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", mount);
  } else {
    mount();
  }
})();
