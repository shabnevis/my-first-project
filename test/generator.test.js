// Run with:  node test/generator.test.js
const assert = require("assert");
const G = require("../js/generator.js");
const D = require("../js/data.js");

function base(modelId, version, extra) {
  const model = G.findModel(modelId);
  const ports = G.modelPorts(model, { portCount: 2 });
  const cfg = {
    modelId, version, portCount: 2, wifiDriver: "wireless",
    identity: "MyRouter", timezone: "Asia/Tehran", ntp: "pool.ntp.org",
    dnsServers: "1.1.1.1,8.8.8.8",
    wan: { port: "ether1", type: "dhcp", vlan: "", usePeerDns: false },
    lan: { enabled: true, ports: ports.filter(p => p !== "ether1"), address: "192.168.88.1/24",
           dhcp: true, poolStart: "192.168.88.10", poolEnd: "192.168.88.254", lease: "1d" },
    wifi: { enabled: true, ssid: "MyWiFi", password: "Pass?word$1", wpa3: true },
    security: { adminPassword: "Str0ngPass", keepWinbox: true, keepSsh: true, wanMgmt: false, wanMgmtSources: "" }
  };
  return Object.assign(cfg, extra || {});
}

let n = 0;
function check(name, fn) { fn(); n++; console.log("ok -", name); }

check("every model x every allowed version produces a clean ASCII script", () => {
  D.models.forEach(m => {
    D.versions.forEach(v => {
      if (!m.v6 && v.startsWith("6.")) return;
      if (G.vnum(v) < G.vnum(m.minVersion)) return;
      const r = G.generate(base(m.id, v, m.id === "chr" ? { security: { adminPassword: "Str0ngPass", keepWinbox: true, keepSsh: true, wanMgmt: true, wanMgmtSources: "1.2.3.4" } } : {}));
      assert.deepStrictEqual(r.errors, [], m.id + " " + v + ": " + r.errors.join(" | "));
      assert.ok(/^[\x20-\x7E\n]*$/.test(r.script), m.id + " " + v + " script has non-ASCII");
    });
  });
});

check("v6 uses server-dns-names, v7 uses ntp servers menu", () => {
  assert.ok(G.generate(base("hex", "6.49")).script.includes("server-dns-names="));
  const s7 = G.generate(base("hex", "7.15")).script;
  assert.ok(s7.includes("/system ntp client servers add"));
  assert.ok(!s7.includes("server-dns-names"));
});

check("hAP ax2 uses wifiwave2 before 7.13 and wifi from 7.13", () => {
  const a = G.generate(base("hap-ax2", "7.12")).script;
  const b = G.generate(base("hap-ax2", "7.13")).script;
  assert.ok(a.includes("/interface wifiwave2 configuration add") && !a.includes("/interface wifi "));
  assert.ok(b.includes("/interface wifi configuration add") && !b.includes("wifiwave2"));
  assert.ok(a.includes("$n > 7012")); // on-router check rejects 7.13+
  assert.ok(b.includes("$n < 7013")); // on-router check rejects < 7.13
});

check("hAP ac2: legacy wireless by default, wifi-qcom-ac on request (7.13+)", () => {
  const a = G.generate(base("hap-ac2", "7.15")).script;
  assert.ok(a.includes("/interface wireless security-profiles add"));
  const b = G.generate(base("hap-ac2", "7.15", { wifiDriver: "wifi-qcom-ac" })).script;
  assert.ok(b.includes("/interface wifi set [find default-name=wifi1]"));
  const c = G.generate(base("hap-ac2", "7.12", { wifiDriver: "wifi-qcom-ac" })).script;
  assert.ok(c.includes("/interface wireless")); // not available before 7.13
});

check("v7-only models reject v6", () => {
  const r = G.generate(base("rb5009", "6.49"));
  assert.ok(r.errors.length > 0);
});

check("special characters are escaped", () => {
  const s = G.generate(base("hap-ac2", "6.49")).script;
  assert.ok(s.includes('"Pass\\?word\\$1"'));
});

check("Persian text is rejected", () => {
  const r = G.generate(base("hex", "7.15", { identity: "روتر" }));
  assert.ok(r.errors.length > 0);
});

check("DHCP pool containing router IP is rejected", () => {
  const c = base("hex", "7.15");
  c.lan.poolStart = "192.168.88.1";
  assert.ok(G.generate(c).errors.length > 0);
});

check("PPPoE over VLAN", () => {
  const c = base("hex", "7.15");
  c.wan = { port: "ether1", type: "pppoe", vlan: "35", pppoeUser: "u", pppoePass: "p", usePeerDns: true };
  const s = G.generate(c).script;
  assert.ok(s.includes("/interface vlan add name=vlan35-wan interface=ether1 vlan-id=35"));
  assert.ok(s.includes("pppoe-client add name=pppoe-out1 interface=vlan35-wan"));
  assert.ok(s.includes("list=WAN interface=pppoe-out1"));
});

console.log("\n" + n + " checks passed");
