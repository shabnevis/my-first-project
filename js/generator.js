/*
 * RouterOS script generator.
 * generate(cfg) -> { script, errors, warnings, info }
 * Every command emitted here is chosen according to the RouterOS major/minor
 * version and the hardware of the selected model.
 */
(function (root, factory) {
  var data = (typeof module === "object" && module.exports) ? require("./data.js") : root.MTData;
  var gen = factory(data);
  if (typeof module === "object" && module.exports) module.exports = gen;
  else root.MTGen = gen;
})(typeof self !== "undefined" ? self : this, function (MTData) {

  // ---------- helpers ----------
  function parseVersion(v) {
    var p = String(v).split(".");
    return { major: parseInt(p[0], 10), minor: parseInt(p[1], 10) };
  }
  function vnum(v) { var p = parseVersion(v); return p.major * 1000 + p.minor; }

  function isAscii(s) { return /^[\x20-\x7E]*$/.test(s); }

  // Quote a value as a RouterOS string. "?" must be escaped or the terminal opens help.
  function q(s) {
    return '"' + String(s)
      .replace(/\\/g, "\\\\")
      .replace(/"/g, '\\"')
      .replace(/\$/g, "\\$")
      .replace(/\?/g, "\\?") + '"';
  }

  function parseIp(s) {
    var m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(String(s).trim());
    if (!m) return null;
    var n = 0;
    for (var i = 1; i <= 4; i++) {
      var o = parseInt(m[i], 10);
      if (o > 255 || (m[i].length > 1 && m[i][0] === "0")) return null;
      n = n * 256 + o;
    }
    return n;
  }
  function ipStr(n) {
    return [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255].join(".");
  }
  function parseCidr(s) {
    var parts = String(s).trim().split("/");
    if (parts.length !== 2 || !/^\d{1,2}$/.test(parts[1])) return null;
    var ip = parseIp(parts[0]);
    var len = parseInt(parts[1], 10);
    if (ip === null || len < 1 || len > 32) return null;
    var mask = len === 0 ? 0 : (0xFFFFFFFF << (32 - len)) >>> 0;
    var net = (ip & mask) >>> 0;
    var bcast = (net | (~mask >>> 0)) >>> 0;
    return { ip: ip, len: len, mask: mask, net: net, bcast: bcast };
  }
  function inSubnet(ip, c) { return ((ip & c.mask) >>> 0) === c.net; }

  function parseIpList(s) {
    var items = String(s || "").split(/[\s,]+/).filter(Boolean);
    for (var i = 0; i < items.length; i++) if (parseIp(items[i]) === null) return null;
    return items;
  }
  function parseSourceList(s) {
    var items = String(s || "").split(/[\s,]+/).filter(Boolean);
    for (var i = 0; i < items.length; i++) {
      if (parseIp(items[i]) === null && parseCidr(items[i]) === null) return null;
    }
    return items;
  }

  function findModel(id) {
    for (var i = 0; i < MTData.models.length; i++) if (MTData.models[i].id === id) return MTData.models[i];
    return null;
  }

  function modelPorts(model, cfg) {
    if (!model.virtual) return model.ports.slice();
    var n = parseInt(cfg.portCount, 10);
    if (!(n >= 1 && n <= 32)) n = 1;
    var out = [];
    for (var i = 1; i <= n; i++) out.push("ether" + i);
    return out;
  }

  // Which wireless menu/package applies for this model + version + driver choice.
  function wifiInfo(model, cfg) {
    var v = vnum(cfg.version);
    if (!model.wifi || model.wifi === "none") return { menu: null, radios: [] };
    if (model.wifi === "ax") {
      return v >= 7013
        ? { menu: "wifi", radios: model.radios.slice(), pkg: "wifi-qcom" }
        : { menu: "wifiwave2", radios: model.radios.slice(), pkg: "wifiwave2" };
    }
    // legacy radio
    if (model.acNewDriver && v >= 7013 && cfg.wifiDriver === "wifi-qcom-ac") {
      return { menu: "wifi", radios: model.radios.map(function (r) { return r.replace("wlan", "wifi"); }), pkg: "wifi-qcom-ac" };
    }
    return { menu: "wireless", radios: model.radios.slice(), pkg: "wireless" };
  }

  // Version window the generated commands are valid for (used by the on-router check).
  function compatWindow(model, cfg, wifi, wifiUsed) {
    var v = parseVersion(cfg.version);
    var min, max;
    if (v.major === 6) { min = 6045; max = 6999; }
    else { min = 7001; max = 7999; }
    min = Math.max(min, vnum(model.minVersion));
    if (wifiUsed && wifi.menu === "wifi") min = Math.max(min, 7013);
    if (wifiUsed && wifi.menu === "wifiwave2") max = Math.min(max, 7012);
    return { min: min, max: max };
  }
  function fmtV(n) { return Math.floor(n / 1000) + "." + (n % 1000); }

  // ---------- main ----------
  function generate(cfg) {
    var errors = [], warnings = [], L = [];
    var model = findModel(cfg.modelId);
    if (!model) return { script: "", errors: ["مدل دستگاه انتخاب نشده است."], warnings: [], info: {} };

    var ver = parseVersion(cfg.version);
    var v = vnum(cfg.version);
    var isV7 = ver.major >= 7;

    // ---- device / version validation ----
    if (!isV7 && !model.v6) errors.push(model.name + " از RouterOS نسخه‌ی 6 پشتیبانی نمی‌کند. یک نسخه‌ی 7 انتخاب کنید.");
    if (v < vnum(model.minVersion)) errors.push("حداقل نسخه‌ی قابل قبول برای " + model.name + " نسخه‌ی " + model.minVersion + " است.");

    var ports = modelPorts(model, cfg);
    var wifi = wifiInfo(model, cfg);
    var wifiUsed = !!(cfg.wifi && cfg.wifi.enabled && wifi.menu);

    // ---- string fields must be plain ASCII (RouterOS terminal does not handle Persian) ----
    var asciiFields = [
      ["نام روتر (Identity)", cfg.identity],
      ["نام کاربری PPPoE", cfg.wan && cfg.wan.pppoeUser],
      ["رمز PPPoE", cfg.wan && cfg.wan.pppoePass],
      ["نام وای‌فای (SSID)", cfg.wifi && cfg.wifi.ssid],
      ["رمز وای‌فای", cfg.wifi && cfg.wifi.password],
      ["رمز admin", cfg.security && cfg.security.adminPassword],
      ["نام کاربر جدید", cfg.security && cfg.security.newUser],
      ["رمز کاربر جدید", cfg.security && cfg.security.newUserPassword]
    ];
    asciiFields.forEach(function (f) {
      if (f[1] && !isAscii(f[1])) errors.push("«" + f[0] + "» فقط می‌تواند حروف و اعداد انگلیسی و علامت‌های معمولی داشته باشد (حروف فارسی و ایموجی مجاز نیست).");
    });

    var identity = (cfg.identity || "").trim();
    if (!identity) errors.push("نام روتر (Identity) خالی است.");

    // ---- WAN ----
    var wan = cfg.wan || {};
    if (ports.indexOf(wan.port) === -1) errors.push("پورت WAN انتخاب‌شده روی این دستگاه وجود ندارد.");
    var vlanId = String(wan.vlan || "").trim();
    if (vlanId && !(/^\d+$/.test(vlanId) && +vlanId >= 1 && +vlanId <= 4094)) errors.push("شماره‌ی VLAN باید عددی بین 1 تا 4094 باشد.");
    var wanPhys = wan.port;
    var wanL3 = vlanId ? "vlan" + vlanId + "-wan" : wanPhys;
    var wanStatic = null;
    if (wan.type === "static") {
      wanStatic = parseCidr(wan.address);
      if (!wanStatic) errors.push("آدرس IP استاتیک WAN باید به شکل 1.2.3.4/24 باشد.");
      var gw = parseIp(wan.gateway);
      if (gw === null) errors.push("Gateway اینترنت معتبر نیست.");
      else if (wanStatic && !inSubnet(gw, wanStatic)) warnings.push("Gateway داخل رنج آدرس WAN نیست؛ مطمئن شوید درست است.");
    }
    if (wan.type === "pppoe") {
      if (!wan.pppoeUser) errors.push("نام کاربری PPPoE خالی است.");
      if (!wan.pppoePass) errors.push("رمز PPPoE خالی است.");
    }

    // ---- DNS ----
    var dnsServers = parseIpList(cfg.dnsServers);
    if (dnsServers === null) errors.push("یکی از آدرس‌های DNS معتبر نیست (با کاما جدا کنید، مثل 1.1.1.1,8.8.8.8).");
    else if (dnsServers.length === 0 && (wan.type === "static" || !wan.usePeerDns)) errors.push("حداقل یک سرور DNS وارد کنید.");

    // ---- LAN ----
    var lan = cfg.lan || {};
    var lanEnabled = !!lan.enabled;
    var lanPorts = (lan.ports || []).filter(function (p) { return ports.indexOf(p) !== -1 && p !== wanPhys; });
    var lanNet = null;
    if (lanEnabled) {
      if (lanPorts.length === 0 && !wifiUsed) errors.push("هیچ پورتی برای LAN انتخاب نشده است.");
      lanNet = parseCidr(lan.address);
      if (!lanNet) errors.push("آدرس LAN باید به شکل 192.168.88.1/24 باشد.");
      else if (lanNet.ip === lanNet.net || lanNet.ip === lanNet.bcast) errors.push("آدرس LAN نمی‌تواند آدرس شبکه یا Broadcast باشد.");
      else if (lanNet.len > 30) errors.push("طول ماسک LAN باید 30 یا کمتر باشد.");
      if (lanNet && wanStatic && (inSubnet(lanNet.ip, wanStatic) || inSubnet(wanStatic.ip, lanNet))) errors.push("رنج LAN و WAN با هم تداخل دارند.");
      if (lanNet && lan.dhcp) {
        var s = parseIp(lan.poolStart), e = parseIp(lan.poolEnd);
        if (s === null || e === null) errors.push("شروع و پایان رنج DHCP معتبر نیست.");
        else {
          if (!inSubnet(s, lanNet) || !inSubnet(e, lanNet)) errors.push("رنج DHCP باید داخل شبکه‌ی LAN باشد.");
          if (s > e) errors.push("شروع رنج DHCP از پایانش بزرگ‌تر است.");
          if (s === lanNet.net || e === lanNet.bcast) errors.push("رنج DHCP نباید شامل آدرس شبکه یا Broadcast باشد.");
          if (lanNet.ip >= s && lanNet.ip <= e) errors.push("آدرس خود روتر (" + ipStr(lanNet.ip) + ") داخل رنج DHCP است.");
        }
        if (!/^\d+[smhdw]$/.test(String(lan.lease || ""))) errors.push("زمان Lease باید مثل 1d یا 12h یا 30m باشد.");
      }
    } else if (wifiUsed) {
      errors.push("برای وای‌فای باید LAN فعال باشد.");
    }

    // ---- Wireless ----
    if (wifiUsed) {
      var ssid = cfg.wifi.ssid || "";
      if (!ssid) errors.push("نام وای‌فای (SSID) خالی است.");
      if (ssid.length > 32) errors.push("نام وای‌فای حداکثر 32 کاراکتر است.");
      var wp = cfg.wifi.password || "";
      if (wp.length < 8 || wp.length > 63) errors.push("رمز وای‌فای باید بین 8 تا 63 کاراکتر باشد.");
      if (cfg.wifi.wpa3 && wifi.menu === "wireless") warnings.push("درایور قدیمی wireless از WPA3 پشتیبانی نمی‌کند؛ فقط WPA2 تنظیم می‌شود.");
      if (wifi.pkg === "wifi-qcom-ac") warnings.push("قبل از اجرای اسکریپت، پکیج wifi-qcom-ac را نصب و پکیج wireless را حذف کنید، وگرنه wifi1/wifi2 وجود نخواهند داشت.");
    }

    // ---- Security ----
    var sec = cfg.security || {};
    if (!sec.adminPassword) warnings.push("رمز admin تعیین نشده است. توصیه‌ی جدی: یک رمز قوی بگذارید.");
    else if (sec.adminPassword.length < 8) warnings.push("رمز admin کوتاه است (کمتر از 8 کاراکتر).");
    if (sec.newUser) {
      if (!/^[A-Za-z0-9._-]+$/.test(sec.newUser)) errors.push("نام کاربر جدید فقط حروف انگلیسی، عدد و . _ - باشد.");
      if (sec.newUser === "admin") errors.push("نام کاربر جدید نمی‌تواند admin باشد.");
      if (!sec.newUserPassword) errors.push("برای کاربر جدید رمز وارد کنید.");
    } else if (sec.disableAdmin) {
      errors.push("برای غیرفعال کردن admin اول یک کاربر جدید بسازید.");
    }
    var mgmtSources = parseSourceList(sec.wanMgmtSources);
    if (sec.wanMgmt) {
      if (mgmtSources === null) errors.push("آدرس‌های مجاز برای مدیریت از WAN معتبر نیستند.");
      else if (mgmtSources.length === 0) warnings.push("مدیریت از WAN برای همه‌ی اینترنت باز است. بهتر است IP خودتان را محدود کنید.");
      if (!sec.keepSsh && !sec.keepWinbox) warnings.push("مدیریت از WAN روشن است ولی Winbox و SSH هر دو بسته‌اند.");
    } else if (model.id === "chr") {
      warnings.push("روی CHR معمولاً فقط از طریق WAN به روتر دسترسی دارید. با بستن مدیریت از WAN ممکن است دسترسی‌تان قطع شود!");
    }
    if (!lanEnabled && !sec.wanMgmt) errors.push("LAN خاموش است و مدیریت از WAN هم بسته است؛ دسترسی شما به روتر قطع می‌شود.");

    var win = compatWindow(model, cfg, wifi, wifiUsed);
    var info = {
      arch: model.arch, wifiMenu: wifiUsed ? wifi.menu : null, wifiPkg: wifiUsed ? wifi.pkg : null,
      range: fmtV(win.min) + " - " + (win.max === 6999 ? "6.x" : win.max === 7999 ? "7.x" : fmtV(win.max)),
      ports: ports
    };
    if (errors.length) return { script: "", errors: errors, warnings: warnings, info: info };

    // ================= SCRIPT =================
    var wanList = [wanL3];
    if (wan.type === "pppoe") wanList = [wanL3, "pppoe-out1"];
    if (vlanId) wanList.unshift(wanPhys);

    L.push("# ==================================================================");
    L.push("# MikroTik Config Builder");
    L.push("# Device : " + model.name.replace(/\u00b2/g, "2").replace(/\u00b3/g, "3").replace(/[^\x20-\x7E]/g, "") + " (" + model.code + "), arch " + model.arch);
    L.push("# Target : RouterOS " + cfg.version + " (valid for " + info.range + ")");
    L.push("# Apply on a router WITHOUT default configuration:");
    L.push("#   /system reset-configuration no-defaults=yes skip-backup=yes");
    L.push("# Recommended: upload as file and run  /import file-name=<name>.rsc verbose=yes");
    L.push("# ==================================================================");
    L.push("");

    // ---- 0. checks: abort before changing anything if this is the wrong router ----
    L.push("# ---- 0. Pre-checks (stops the import on the wrong router/version) ----");
    L.push(':do { :local v [/system resource get version]; :local d [:find $v "."]; ' +
      ':local maj [:tonum [:pick $v 0 $d]]; :local r [:pick $v ($d + 1) [:len $v]]; :local e [:len $r]; ' +
      ':foreach c in={"."; " "; "r"; "b"} do={ :local p [:find $r $c]; :if (([:typeof $p] = "num") && ($p < $e)) do={ :set e $p } }; ' +
      ':local n (($maj * 1000) + [:tonum [:pick $r 0 $e]]); ' +
      ':if (($n < ' + win.min + ') || ($n > ' + win.max + ')) do={ :error ("WRONG ROUTEROS VERSION " . $v . " - this script needs ' + info.range + '") }; ' +
      ':put ("RouterOS version OK: " . $v) }');
    L.push(':if ([/system resource get architecture-name] != ' + q(model.arch) + ') do={ :put ("WARNING: architecture is " . [/system resource get architecture-name] . ", script was made for ' + model.arch + '") }');
    var needIf = [wanPhys].concat(lanEnabled ? lanPorts : []).concat(wifiUsed ? wifi.radios : []);
    needIf = needIf.filter(function (x, i) { return needIf.indexOf(x) === i; });
    L.push(':foreach i in={' + needIf.map(q).join("; ") + '} do={ :if ([:len [/interface find default-name=$i]] = 0) do={ :error ("INTERFACE NOT FOUND: " . $i . " - wrong model or package") } }');
    L.push(':if ([:len [/interface bridge find]] > 0) do={ :error "A bridge already exists - reset with no-defaults=yes first" }');
    L.push(':if ([:len [/ip firewall filter find dynamic=no]] > 0) do={ :error "Firewall rules already exist - reset with no-defaults=yes first" }');
    L.push(':if ([:len [/interface list find name="WAN"]] > 0) do={ :error "Interface list WAN already exists - reset with no-defaults=yes first" }');
    L.push("");

    // ---- 1. system ----
    L.push("# ---- 1. System ----");
    L.push("/system identity set name=" + q(identity));
    L.push("/system clock set time-zone-autodetect=no time-zone-name=" + (cfg.timezone || "Asia/Tehran"));
    var ntp = (cfg.ntp || "").trim();
    if (ntp) {
      if (isV7) {
        L.push("/system ntp client set enabled=yes");
        L.push("/system ntp client servers add address=" + q(ntp));
      } else {
        L.push("/system ntp client set enabled=yes server-dns-names=" + q(ntp));
      }
    }
    L.push("");

    // ---- 2. interface lists ----
    L.push("# ---- 2. Interface lists ----");
    L.push("/interface list add name=WAN comment=\"internet\"");
    L.push("/interface list add name=LAN comment=\"local network\"");
    L.push("");

    // ---- 3. WAN ----
    L.push("# ---- 3. WAN (" + wan.type + " on " + wanL3 + ") ----");
    if (vlanId) L.push("/interface vlan add name=" + wanL3 + " interface=" + wanPhys + " vlan-id=" + vlanId);
    if (wan.type === "dhcp") {
      var dc = "/ip dhcp-client add interface=" + wanL3 + " add-default-route=yes use-peer-dns=" + (wan.usePeerDns ? "yes" : "no") + " disabled=no comment=\"WAN\"";
      L.push(':if ([:len [/ip dhcp-client find interface="' + wanL3 + '"]] = 0) do={ ' + dc + ' } else={ /ip dhcp-client set [find interface="' + wanL3 + '"] add-default-route=yes use-peer-dns=' + (wan.usePeerDns ? "yes" : "no") + ' disabled=no }');
    } else if (wan.type === "static") {
      L.push("/ip address add address=" + wan.address.trim() + " interface=" + wanL3 + " comment=\"WAN\"");
      L.push("/ip route add dst-address=0.0.0.0/0 gateway=" + wan.gateway.trim() + " comment=\"default route\"");
    } else if (wan.type === "pppoe") {
      L.push("/interface pppoe-client add name=pppoe-out1 interface=" + wanL3 + " user=" + q(wan.pppoeUser) +
        " password=" + q(wan.pppoePass) + " add-default-route=yes use-peer-dns=" + (wan.usePeerDns ? "yes" : "no") + " disabled=no");
    }
    wanList.forEach(function (i) { L.push("/interface list member add list=WAN interface=" + i); });
    L.push("");

    // ---- 4. Wireless ----
    if (wifiUsed) {
      var w = cfg.wifi;
      L.push("# ---- 4. Wireless (menu /interface " + wifi.menu + ", package " + wifi.pkg + ") ----");
      if (wifi.menu === "wireless") {
        L.push("/interface wireless security-profiles add name=lan-wifi mode=dynamic-keys authentication-types=wpa2-psk unicast-ciphers=aes-ccm group-ciphers=aes-ccm wpa2-pre-shared-key=" + q(w.password));
        wifi.radios.forEach(function (r) {
          L.push("/interface wireless set [find default-name=" + r + "] mode=ap-bridge ssid=" + q(w.ssid) + " security-profile=lan-wifi frequency=auto wps-mode=disabled disabled=no");
        });
      } else {
        var m = "/interface " + wifi.menu;
        var auth = w.wpa3 ? "wpa2-psk,wpa3-psk" : "wpa2-psk";
        L.push(m + " security add name=lan-wifi authentication-types=" + auth + " passphrase=" + q(w.password));
        L.push(m + " configuration add name=lan-wifi mode=ap ssid=" + q(w.ssid) + " security=lan-wifi");
        wifi.radios.forEach(function (r) {
          L.push(m + " set [find default-name=" + r + "] configuration=lan-wifi disabled=no");
        });
      }
      L.push("");
    }

    // ---- 5. LAN ----
    if (lanEnabled) {
      L.push("# ---- 5. LAN bridge ----");
      L.push("/interface bridge add name=bridge-lan comment=\"LAN\"");
      lanPorts.concat(wifiUsed ? wifi.radios : []).forEach(function (p) {
        L.push("/interface bridge port add bridge=bridge-lan interface=" + p);
      });
      L.push("/interface list member add list=LAN interface=bridge-lan");
      L.push("/ip address add address=" + lan.address.trim() + " interface=bridge-lan comment=\"LAN\"");
      L.push("");
      if (lan.dhcp) {
        L.push("# ---- 6. DHCP server ----");
        L.push("/ip pool add name=pool-lan ranges=" + lan.poolStart.trim() + "-" + lan.poolEnd.trim());
        L.push("/ip dhcp-server add name=dhcp-lan interface=bridge-lan address-pool=pool-lan lease-time=" + lan.lease + " disabled=no");
        L.push("/ip dhcp-server network add address=" + ipStr(lanNet.net) + "/" + lanNet.len + " gateway=" + ipStr(lanNet.ip) + " dns-server=" + ipStr(lanNet.ip));
        L.push("");
      }
    }

    // ---- 7. DNS ----
    L.push("# ---- 7. DNS ----");
    L.push("/ip dns set allow-remote-requests=" + (lanEnabled ? "yes" : "no") + (dnsServers.length ? " servers=" + dnsServers.join(",") : ""));
    if (lanEnabled) L.push("/ip dns static add name=router.lan address=" + ipStr(lanNet.ip));
    L.push("");

    // ---- 8. Firewall ----
    L.push("# ---- 8. Firewall ----");
    if (sec.wanMgmt && mgmtSources.length) {
      L.push("/ip firewall address-list");
      mgmtSources.forEach(function (a) { L.push("add list=mgmt-allowed address=" + a); });
    }
    L.push("/ip firewall filter");
    L.push("add chain=input action=accept connection-state=established,related,untracked comment=\"accept established,related,untracked\"");
    L.push("add chain=input action=drop connection-state=invalid comment=\"drop invalid\"");
    L.push("add chain=input action=accept protocol=icmp comment=\"accept ICMP\"");
    L.push("add chain=input action=accept dst-address=127.0.0.1 comment=\"accept to local loopback\"");
    if (sec.wanMgmt) {
      var mp = [];
      if (sec.keepWinbox) mp.push("8291");
      if (sec.keepSsh) mp.push("22");
      if (mp.length) {
        L.push("add chain=input action=accept in-interface-list=WAN protocol=tcp dst-port=" + mp.join(",") +
          (mgmtSources.length ? " src-address-list=mgmt-allowed" : "") + " comment=\"allow management from WAN\"");
      }
    }
    L.push("add chain=input action=drop in-interface-list=!LAN comment=\"drop all not coming from LAN\"");
    L.push("add chain=forward action=fasttrack-connection connection-state=established,related comment=\"fasttrack\"");
    L.push("add chain=forward action=accept connection-state=established,related,untracked comment=\"accept established,related,untracked\"");
    L.push("add chain=forward action=drop connection-state=invalid comment=\"drop invalid\"");
    L.push("add chain=forward action=drop connection-state=new connection-nat-state=!dstnat in-interface-list=WAN comment=\"drop all from WAN not DSTNATed\"");
    L.push("/ip firewall nat");
    L.push("add chain=srcnat action=masquerade out-interface-list=WAN comment=\"masquerade\"");
    L.push("");

    // ---- 9. Services ----
    L.push("# ---- 9. Services hardening ----");
    L.push("/ip service set telnet disabled=yes");
    L.push("/ip service set ftp disabled=yes");
    L.push("/ip service set www disabled=" + (sec.keepWebfig ? "no" : "yes"));
    L.push("/ip service set www-ssl disabled=yes");
    L.push("/ip service set api disabled=" + (sec.keepApi ? "no" : "yes"));
    L.push("/ip service set api-ssl disabled=yes");
    L.push("/ip service set ssh disabled=" + (sec.keepSsh ? "no" : "yes"));
    L.push("/ip service set winbox disabled=" + (sec.keepWinbox ? "no" : "yes"));
    L.push("/ip ssh set strong-crypto=yes");
    L.push("/tool bandwidth-server set enabled=no");
    L.push("/tool mac-server set allowed-interface-list=LAN");
    L.push("/tool mac-server mac-winbox set allowed-interface-list=LAN");
    L.push("/ip neighbor discovery-settings set discover-interface-list=LAN");
    L.push("");

    // ---- 10. Users ----
    L.push("# ---- 10. Users ----");
    if (sec.newUser) {
      L.push("/user add name=" + sec.newUser + " group=full password=" + q(sec.newUserPassword));
    }
    if (sec.adminPassword) L.push("/user set [find name=admin] password=" + q(sec.adminPassword));
    if (sec.newUser && sec.disableAdmin) L.push("/user disable [find name=admin]");
    L.push("");
    L.push(':put "Configuration applied successfully."');

    return { script: L.join("\n") + "\n", errors: errors, warnings: warnings, info: info };
  }

  return {
    generate: generate, findModel: findModel, modelPorts: modelPorts, wifiInfo: wifiInfo,
    parseVersion: parseVersion, vnum: vnum, q: q, parseCidr: parseCidr, parseIp: parseIp, ipStr: ipStr
  };
});
