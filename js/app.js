/* UI wiring: builds the form from MTData and regenerates the script on every change. */
(function () {
  var $ = function (id) { return document.getElementById(id); };
  var lastScript = "";

  // ---- model select, grouped ----
  var modelSel = $("model");
  Object.keys(MTData.groups).forEach(function (g) {
    var og = document.createElement("optgroup");
    og.label = MTData.groups[g];
    MTData.models.filter(function (m) { return m.group === g; }).forEach(function (m) {
      var o = document.createElement("option");
      o.value = m.id;
      o.textContent = m.name + (m.code !== m.name ? "  (" + m.code + ")" : "");
      og.appendChild(o);
    });
    modelSel.appendChild(og);
  });
  modelSel.value = "hap-ac2";

  MTData.timezones.forEach(function (t) {
    var o = document.createElement("option");
    o.value = o.textContent = t;
    $("timezone").appendChild(o);
  });

  function currentModel() { return MTGen.findModel(modelSel.value); }

  function fillVersions() {
    var m = currentModel();
    var sel = $("version"), prev = sel.value;
    sel.innerHTML = "";
    var groups = {};
    MTData.versions.forEach(function (v) {
      if (v.indexOf("6.") === 0 && !m.v6) return;
      if (MTGen.vnum(v) < MTGen.vnum(m.minVersion)) return;
      var major = v.split(".")[0];
      if (!groups[major]) {
        groups[major] = document.createElement("optgroup");
        groups[major].label = "RouterOS v" + major;
        sel.appendChild(groups[major]);
      }
      var o = document.createElement("option");
      o.value = v;
      o.textContent = v + ".x";
      groups[major].appendChild(o);
    });
    var vals = Array.prototype.map.call(sel.options, function (o) { return o.value; });
    sel.value = vals.indexOf(prev) !== -1 ? prev : (vals.indexOf("7.15") !== -1 ? "7.15" : vals[vals.length - 1]);
  }

  function fillPorts() {
    var m = currentModel();
    var ports = MTGen.modelPorts(m, { portCount: $("portCount").value });
    var wanSel = $("wanPort"), prevWan = wanSel.value;
    wanSel.innerHTML = "";
    ports.forEach(function (p) {
      var o = document.createElement("option");
      o.value = o.textContent = p;
      wanSel.appendChild(o);
    });
    wanSel.value = ports.indexOf(prevWan) !== -1 ? prevWan : ports[0];

    var box = $("lanPorts");
    var prevChecked = {};
    Array.prototype.forEach.call(box.querySelectorAll("input"), function (i) { prevChecked[i.value] = i.checked; });
    var hadPrev = Object.keys(prevChecked).length > 0;
    box.innerHTML = "";
    ports.forEach(function (p) {
      var l = document.createElement("label");
      l.className = "check";
      var i = document.createElement("input");
      i.type = "checkbox";
      i.value = p;
      // default: all ethernet ports except WAN; SFP ports unchecked
      i.checked = hadPrev && p in prevChecked ? prevChecked[p] : p.indexOf("ether") === 0;
      l.appendChild(i);
      l.appendChild(document.createTextNode(" " + p));
      box.appendChild(l);
    });
  }

  function syncPortStates() {
    var wan = $("wanPort").value;
    Array.prototype.forEach.call($("lanPorts").querySelectorAll("input"), function (i) {
      i.disabled = i.value === wan;
      i.parentNode.title = i.value === wan ? "این پورت WAN است" : "";
    });
  }

  function onModelChange() {
    var m = currentModel();
    $("portCountBox").hidden = !m.virtual;
    fillVersions();
    fillPorts();
    if (m.id === "chr") $("wanMgmt").checked = true;
    onVersionChange();
  }

  function onVersionChange() {
    var m = currentModel();
    var v = MTGen.vnum($("version").value);
    $("wifiDriverBox").hidden = !(m.acNewDriver && v >= 7013);
    $("wifiCard").hidden = !m.wifi || m.wifi === "none";
    var wi = MTGen.wifiInfo(m, { version: $("version").value, wifiDriver: $("wifiDriver").value });
    $("wpa3Box").hidden = wi.menu === "wireless";
    var notes = [];
    notes.push("معماری: " + m.arch);
    if (wi.menu) notes.push("منوی وایرلس در این نسخه: /interface " + wi.menu);
    if (m.note) notes.push(m.note);
    $("deviceInfo").textContent = notes.join(" — ");
  }

  function readConfig() {
    var lanPorts = Array.prototype.filter.call($("lanPorts").querySelectorAll("input"), function (i) { return i.checked && !i.disabled; })
      .map(function (i) { return i.value; });
    var m = currentModel();
    return {
      modelId: m.id,
      version: $("version").value,
      portCount: $("portCount").value,
      wifiDriver: $("wifiDriver").value,
      identity: $("identity").value,
      timezone: $("timezone").value,
      ntp: $("ntp").value,
      dnsServers: $("dnsServers").value,
      wan: {
        port: $("wanPort").value, type: $("wanType").value, vlan: $("wanVlan").value,
        address: $("wanAddress").value, gateway: $("wanGateway").value,
        pppoeUser: $("pppoeUser").value, pppoePass: $("pppoePass").value,
        usePeerDns: $("usePeerDns").checked && $("wanType").value !== "static"
      },
      lan: {
        enabled: $("lanEnabled").checked, ports: lanPorts, address: $("lanAddress").value,
        dhcp: $("dhcp").checked, poolStart: $("poolStart").value, poolEnd: $("poolEnd").value, lease: $("lease").value
      },
      wifi: {
        enabled: !$("wifiCard").hidden && $("wifiEnabled").checked,
        ssid: $("ssid").value, password: $("wifiPass").value, wpa3: $("wpa3").checked && !$("wpa3Box").hidden
      },
      security: {
        adminPassword: $("adminPassword").value, newUser: $("newUser").value.trim(),
        newUserPassword: $("newUserPassword").value, disableAdmin: $("disableAdmin").checked,
        keepWinbox: $("keepWinbox").checked, keepSsh: $("keepSsh").checked,
        keepWebfig: $("keepWebfig").checked, keepApi: $("keepApi").checked,
        wanMgmt: $("wanMgmt").checked, wanMgmtSources: $("wanMgmtSources").value
      }
    };
  }

  function evalCond(cond) {
    var p = cond.split("=");
    var el = $(p[0]);
    if (p.length === 2) return el.value === p[1];
    if (el.type === "checkbox") return el.checked;
    return el.value.trim() !== "";
  }
  function syncVisibility() {
    Array.prototype.forEach.call(document.querySelectorAll("[data-show]"), function (el) { el.hidden = !evalCond(el.getAttribute("data-show")); });
    Array.prototype.forEach.call(document.querySelectorAll("[data-hide]"), function (el) { el.hidden = evalCond(el.getAttribute("data-hide")); });
  }

  function list(ul, items) {
    ul.innerHTML = "";
    items.forEach(function (t) { var li = document.createElement("li"); li.textContent = t; ul.appendChild(li); });
  }

  function render() {
    syncVisibility();
    syncPortStates();
    var r = MTGen.generate(readConfig());
    list($("errors"), r.errors);
    list($("warnings"), r.warnings);
    var b = $("badges");
    b.innerHTML = "";
    if (r.info && r.info.arch) {
      var items = ["arch: " + r.info.arch, "RouterOS " + r.info.range];
      if (r.info.wifiMenu) items.push("/interface " + r.info.wifiMenu + " (" + r.info.wifiPkg + ")");
      items.forEach(function (t) { var s = document.createElement("span"); s.className = "badge"; s.textContent = t; b.appendChild(s); });
    }
    lastScript = r.script;
    $("script").textContent = r.script;
    $("copyBtn").disabled = $("downloadBtn").disabled = !r.script;
  }

  $("copyBtn").addEventListener("click", function () {
    var btn = this;
    function done() { btn.textContent = "کپی شد ✓"; btn.classList.add("done"); setTimeout(function () { btn.textContent = "کپی"; btn.classList.remove("done"); }, 1800); }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(lastScript).then(done, fallback);
    } else fallback();
    function fallback() {
      var ta = document.createElement("textarea");
      ta.value = lastScript; document.body.appendChild(ta); ta.select();
      try { document.execCommand("copy"); done(); } catch (e) { /* ignore */ }
      document.body.removeChild(ta);
    }
  });

  $("downloadBtn").addEventListener("click", function () {
    // CRLF-free plain ASCII file, as RouterOS expects
    var blob = new Blob([lastScript], { type: "text/plain" });
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "mikrotik-config.rsc";
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
  });

  modelSel.addEventListener("change", function () { onModelChange(); render(); });
  $("version").addEventListener("change", function () { onVersionChange(); render(); });
  $("wifiDriver").addEventListener("change", function () { onVersionChange(); render(); });
  $("portCount").addEventListener("input", function () { fillPorts(); render(); });
  $("form").addEventListener("input", render);
  $("form").addEventListener("change", render);

  onModelChange();
  render();
})();
