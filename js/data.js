/*
 * MikroTik device and RouterOS version database.
 *
 * wifi:
 *   "none"   - no wireless
 *   "legacy" - 802.11n/ac radios driven by the "wireless" package (wlan1, wlan2)
 *   "ax"     - 802.11ax radios (menu "wifiwave2" before 7.13, "wifi" from 7.13)
 * acNewDriver: legacy ARM ac radio that can also run the "wifi-qcom-ac" package (7.13+)
 * minVersion / v6: lowest supported RouterOS for this config, and whether v6 is supported at all
 * virtual: port count is chosen by the user (CHR / x86)
 */
(function (root, factory) {
  var data = factory();
  if (typeof module === "object" && module.exports) module.exports = data;
  else root.MTData = data;
})(typeof self !== "undefined" ? self : this, function () {
  function range(prefix, from, to) {
    var out = [];
    for (var i = from; i <= to; i++) out.push(prefix + i);
    return out;
  }

  var models = [
    // ---- Home / office wireless ----
    { id: "hap-lite", group: "home", name: "hAP lite", code: "RB941-2nD", arch: "smips",
      ports: range("ether", 1, 4), wifi: "legacy", radios: ["wlan1"], v6: true, minVersion: "6.45",
      note: "حافظه‌ی این مدل ۱۶ مگابایت است؛ برای v7 جای خالی کمی دارد." },
    { id: "hap-ac-lite", group: "home", name: "hAP ac lite", code: "RB952Ui-5ac2nD", arch: "mipsbe",
      ports: range("ether", 1, 5), wifi: "legacy", radios: ["wlan1", "wlan2"], v6: true, minVersion: "6.45" },
    { id: "hap-ac", group: "home", name: "hAP ac", code: "RB962UiGS-5HacT2HnT", arch: "mipsbe",
      ports: range("ether", 1, 5).concat(["sfp1"]), wifi: "legacy", radios: ["wlan1", "wlan2"], v6: true, minVersion: "6.45" },
    { id: "hap-ac2", group: "home", name: "hAP ac²", code: "RBD52G-5HacD2HnD", arch: "arm",
      ports: range("ether", 1, 5), wifi: "legacy", radios: ["wlan1", "wlan2"], acNewDriver: true, v6: true, minVersion: "6.45" },
    { id: "hap-ac3", group: "home", name: "hAP ac³", code: "RBD53iG-5HacD2HnD", arch: "arm",
      ports: range("ether", 1, 5), wifi: "legacy", radios: ["wlan1", "wlan2"], acNewDriver: true, v6: true, minVersion: "6.47" },
    { id: "cap-ac", group: "home", name: "cAP ac", code: "RBcAPGi-5acD2nD", arch: "arm",
      ports: range("ether", 1, 2), wifi: "legacy", radios: ["wlan1", "wlan2"], acNewDriver: true, v6: true, minVersion: "6.45" },
    { id: "hap-ax-lite", group: "home", name: "hAP ax lite", code: "L41G-2axD", arch: "arm",
      ports: range("ether", 1, 4), wifi: "ax", radios: ["wifi1"], v6: false, minVersion: "7.13",
      note: "فقط RouterOS v7 (برای این ابزار از 7.13 به بالا)." },
    { id: "hap-ax2", group: "home", name: "hAP ax²", code: "C52iG-5HaxD2HaxD", arch: "arm64",
      ports: range("ether", 1, 5), wifi: "ax", radios: ["wifi1", "wifi2"], v6: false, minVersion: "7.7",
      note: "فقط RouterOS v7." },
    { id: "hap-ax3", group: "home", name: "hAP ax³", code: "C53UiG+5HPaxD2HPaxD", arch: "arm64",
      ports: range("ether", 1, 5), wifi: "ax", radios: ["wifi1", "wifi2"], v6: false, minVersion: "7.7",
      note: "فقط RouterOS v7. پورت ether1 از نوع 2.5 گیگابیت است." },
    { id: "cap-ax", group: "home", name: "cAP ax", code: "cAPGi-5HaxD2HaxD", arch: "arm64",
      ports: range("ether", 1, 2), wifi: "ax", radios: ["wifi1", "wifi2"], v6: false, minVersion: "7.10",
      note: "فقط RouterOS v7." },

    // ---- Wired routers ----
    { id: "hex-lite", group: "wired", name: "hEX lite", code: "RB750r2", arch: "smips",
      ports: range("ether", 1, 5), wifi: "none", v6: true, minVersion: "6.45" },
    { id: "hex", group: "wired", name: "hEX", code: "RB750Gr3", arch: "mmips",
      ports: range("ether", 1, 5), wifi: "none", v6: true, minVersion: "6.45" },
    { id: "hex-s", group: "wired", name: "hEX S", code: "RB760iGS", arch: "mmips",
      ports: range("ether", 1, 5).concat(["sfp1"]), wifi: "none", v6: true, minVersion: "6.45" },
    { id: "rb951", group: "wired", name: "RB951Ui-2HnD", code: "RB951Ui-2HnD", arch: "mipsbe",
      ports: range("ether", 1, 5), wifi: "legacy", radios: ["wlan1"], v6: true, minVersion: "6.45" },
    { id: "rb2011", group: "wired", name: "RB2011UiAS-RM", code: "RB2011UiAS-RM", arch: "mipsbe",
      ports: range("ether", 1, 10).concat(["sfp1"]), wifi: "none", v6: true, minVersion: "6.45" },
    { id: "rb3011", group: "wired", name: "RB3011UiAS-RM", code: "RB3011UiAS-RM", arch: "arm",
      ports: range("ether", 1, 10).concat(["sfp1"]), wifi: "none", v6: true, minVersion: "6.45" },
    { id: "rb4011", group: "wired", name: "RB4011iGS+RM", code: "RB4011iGS+RM", arch: "arm",
      ports: range("ether", 1, 10).concat(["sfp-sfpplus1"]), wifi: "none", v6: true, minVersion: "6.45" },
    { id: "l009", group: "wired", name: "L009UiGS-RM", code: "L009UiGS-RM", arch: "arm",
      ports: range("ether", 1, 8).concat(["sfp1"]), wifi: "none", v6: false, minVersion: "7.9",
      note: "فقط RouterOS v7." },
    { id: "rb5009", group: "wired", name: "RB5009UG+S+IN", code: "RB5009UG+S+IN", arch: "arm64",
      ports: range("ether", 1, 8).concat(["sfp-sfpplus1"]), wifi: "none", v6: false, minVersion: "7.1",
      note: "فقط RouterOS v7." },

    // ---- Cloud Core Routers ----
    { id: "ccr1009", group: "ccr", name: "CCR1009-7G-1C-1S+", code: "CCR1009-7G-1C-1S+", arch: "tile",
      ports: range("ether", 1, 7).concat(["sfp-sfpplus1"]), wifi: "none", v6: true, minVersion: "6.45" },
    { id: "ccr1036", group: "ccr", name: "CCR1036-12G-4S", code: "CCR1036-12G-4S", arch: "tile",
      ports: range("ether", 1, 12).concat(range("sfp", 1, 4)), wifi: "none", v6: true, minVersion: "6.45" },
    { id: "ccr2004", group: "ccr", name: "CCR2004-16G-2S+", code: "CCR2004-16G-2S+", arch: "arm64",
      ports: range("ether", 1, 16).concat(range("sfp-sfpplus", 1, 2)), wifi: "none", v6: true, minVersion: "6.48" },
    { id: "ccr2116", group: "ccr", name: "CCR2116-12G-4S+", code: "CCR2116-12G-4S+", arch: "arm64",
      ports: range("ether", 1, 12).concat(range("sfp-sfpplus", 1, 4)), wifi: "none", v6: false, minVersion: "7.1",
      note: "فقط RouterOS v7." },

    // ---- Virtual / PC ----
    { id: "chr", group: "virtual", name: "CHR (Cloud Hosted Router)", code: "CHR", arch: "x86_64",
      virtual: true, wifi: "none", v6: true, minVersion: "6.45",
      note: "روی سرور مجازی/ابری. اگر از راه دور (WAN) وصل می‌شوید، حتماً «مدیریت از WAN» را روشن بگذارید." },
    { id: "x86", group: "virtual", name: "x86 (نصب روی PC)", code: "x86", arch: "x86",
      virtual: true, wifi: "none", v6: true, minVersion: "6.45" }
  ];

  var groups = {
    home: "روترهای خانگی و اداری (وایرلس‌دار)",
    wired: "روترهای باسیم",
    ccr: "Cloud Core Router (CCR)",
    virtual: "مجازی / PC"
  };

  var versions = [];
  for (var a = 45; a <= 49; a++) versions.push("6." + a);
  for (var b = 1; b <= 21; b++) versions.push("7." + b);

  var timezones = [
    "Asia/Tehran", "Asia/Dubai", "Asia/Baku", "Asia/Kabul", "Europe/Istanbul",
    "Europe/Berlin", "Europe/London", "Europe/Moscow", "America/New_York"
  ];

  return { models: models, groups: groups, versions: versions, timezones: timezones };
});
