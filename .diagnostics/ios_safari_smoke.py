#!/usr/bin/env python3
"""Temporary native Safari/iOS Simulator capture; no private code or credentials.

Bounded SafariDriver feasibility only; no full compatibility certification.
Uses the existing Xcode-matching runtime and explicitly opens Simulator.app.
Capture before navigation and after command failure; no SDK downloads or SafariDriver.
"""
from __future__ import annotations
import hashlib
import json
import os
from pathlib import Path
import platform
import re
import signal
import struct
import subprocess
import sys
import time
import urllib.request

TARGET = "https://8c4df878-vigia-runtime.c-gamiz93.workers.dev/es/alertas"
OUT = Path("ios-safari-evidence")


class CaptureDeadline(TimeoutError):
    """Whole-probe deadline; never swallowed by a per-command observation."""


def choose_device(inventory: dict, sdk_version: str) -> tuple[dict, dict]:
    version = lambda value: tuple(int(n) for n in value.split(".")[:2])
    candidates = []
    for runtime in inventory.get("runtimes", []):
        rid = runtime.get("identifier", "")
        if not runtime.get("isAvailable") or ".iOS-" not in rid:
            continue
        if re.search("beta|preview", runtime.get("name", ""), re.I):
            continue
        if version(runtime.get("version", "0")) != version(sdk_version):
            continue
        for device in inventory.get("devices", {}).get(rid, []):
            name = device.get("name", "")
            if not (device.get("isAvailable") and name.startswith("iPhone") and device.get("deviceTypeIdentifier")):
                continue
            number = int(re.search(r"\d+", name).group()) if re.search(r"\d+", name) else 0
            candidates.append(((name == "iPhone 16", "SE" not in name, number, name), device, runtime))
    if not candidates:
        raise RuntimeError("No preinstalled iPhone runtime matching the selected Xcode SDK; no download attempted")
    _, device, runtime = max(candidates, key=lambda item: item[0])
    return device, runtime


def png_info(data: bytes) -> dict:
    if not (1024 <= len(data) <= 10_000_000) or data[:8] != b"\x89PNG\r\n\x1a\n" or data[12:16] != b"IHDR":
        raise RuntimeError("Invalid or oversized screenshot")
    width, height = struct.unpack(">II", data[16:24])
    if min(width, height) < 200:
        raise RuntimeError("Unexpected screenshot dimensions")
    return {"width": width, "height": height, "bytes": len(data),
            "sha256": hashlib.sha256(data).hexdigest(), "visuallyReviewed": False}


def self_test() -> None:
    def runtime(v):
        return {"identifier": "com.apple.CoreSimulator.SimRuntime.iOS-" + v.replace(".", "-"),
                "version": v, "name": "iOS " + v, "isAvailable": True}
    a, b = runtime("18.5"), runtime("26.2")
    phone = {"name": "iPhone 16", "deviceTypeIdentifier": "iphone", "isAvailable": True}
    inv = {"runtimes": [a, b], "devices": {a["identifier"]: [phone], b["identifier"]: [phone]}}
    assert choose_device(inv, "18.5")[1] == a
    assert choose_device(inv, "26.2")[1] == b
    for source, sdk in [({}, "18.5"), (inv, "17.0")]:
        try:
            choose_device(source, sdk)
        except RuntimeError:
            pass
        else:
            raise AssertionError("Missing or mismatched runtime accepted")
    try:
        png_info(b"not a PNG")
    except RuntimeError:
        pass
    else:
        raise AssertionError("Invalid capture accepted")
    print("SELF_TEST_PASS: matching runtime, mismatch rejection and invalid capture rejection")


def main() -> int:
    OUT.mkdir(exist_ok=True)
    report = {"scope": "final native header geometry in real system themes and F7 production comparison; input/gestures not certified",
              "target": TARGET, "diagnosticSha": os.environ.get("GITHUB_SHA"),
              "runId": os.environ.get("GITHUB_RUN_ID"), "runnerImage": os.environ.get("ImageVersion"),
              "captureReady": False, "productPass": None, "nativeAppleSafari": False,
              "physicalIPhone": False, "safaridriverUsed": False,
              "fullCompatibilityCertified": False, "stages": [], "screenshots": [], "commands": [], "cleanup": {}}
    sim_id = None
    driver = None
    session_id = None
    active_stage = "start"

    def persist():
        temp = OUT / "report.tmp"
        temp.write_text(json.dumps(report, indent=2), encoding="utf-8")
        temp.replace(OUT / "report.json")

    def mark(stage):
        nonlocal active_stage
        active_stage = stage
        report["lastStage"] = stage
        report["stages"].append({"stage": stage, "utc": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())})
        persist()
        print("IOS_SAFARI_STAGE " + stage, flush=True)

    def command(args, timeout=20):
        proc = subprocess.Popen(args, stdout=subprocess.PIPE, stderr=subprocess.PIPE, start_new_session=True, stdin=subprocess.DEVNULL)
        try:
            stdout, stderr = proc.communicate(timeout=timeout)
        except BaseException:
            try:
                os.killpg(proc.pid, signal.SIGKILL)
            except ProcessLookupError:
                pass
            try:
                proc.communicate(timeout=3)
            except subprocess.TimeoutExpired:
                proc.stdout.close()
                proc.stderr.close()
            raise
        if proc.returncode:
            raise RuntimeError(f"{args[0]} {args[1:3]} exit={proc.returncode}: {stderr.decode(errors='replace')[-2000:]}")
        return stdout

    def observe(label, args, timeout=20):
        started = time.monotonic()
        record = {"label": label, "ok": False, "timedOut": False}
        try:
            record["stdout"] = command(args, timeout).decode(errors="replace")[-1600:]
            record["ok"] = True
        except CaptureDeadline:
            raise
        except subprocess.TimeoutExpired as exc:
            record["timedOut"] = True
            record["error"] = str(exc)[:1200]
        except Exception as exc:
            record["error"] = f"{type(exc).__name__}: {exc}"[:1600]
        record["seconds"] = round(time.monotonic() - started, 2)
        report["commands"].append(record)
        persist()
        return record

    def capture(filename):
        image_path = OUT / filename
        record = {"file": filename, "stage": active_stage, "ok": False}
        try:
            command(["xcrun", "simctl", "io", sim_id, "screenshot", str(image_path)], 20)
            record.update(png_info(image_path.read_bytes()))
            record["ok"] = True
        except CaptureDeadline:
            raise
        except Exception as exc:
            record["error"] = f"{type(exc).__name__}: {exc}"[:1600]
        report["screenshots"].append(record)
        persist()
        return record["ok"]

    def navigate_and_capture():
        # An OS command acknowledgment is NOT a rendered-page assertion.
        # Observe captures even when launch/openurl time out or exit nonzero.
        mark("before-navigation")
        capture("safari-before.png")
        mark("open-immutable-preview")
        result = observe("openurl", ["xcrun", "simctl", "openurl", sim_id, TARGET], 25)
        report["navigationAcknowledged"] = result["ok"]
        mark("after-navigation-command")
        capture("safari-after.png")
        time.sleep(15)
        mark("after-navigation-settle")
        report["captureReady"] = capture("iphone-simulator.png")

    def wd(method, path, payload=None, timeout=35):
        data = None if payload is None else json.dumps(payload).encode()
        request = urllib.request.Request("http://127.0.0.1:4444" + path, data=data,
                                         method=method, headers={"Content-Type": "application/json"})
        with urllib.request.urlopen(request, timeout=timeout) as response:
            result = json.load(response)
        if isinstance(result.get("value"), dict) and result["value"].get("error"):
            raise RuntimeError("WebDriver: " + str(result["value"])[:1200])
        return result.get("value")

    def interactive_probe():
        nonlocal driver, session_id
        mark("enable-safaridriver-noninteractive")
        enabled = observe("sudo-enable-driver", ["sudo", "-n", "/usr/bin/safaridriver", "--enable"], 20)
        if not enabled["ok"]:
            raise RuntimeError("Noninteractive SafariDriver enable failed; no manual authentication requested")
        mark("start-safaridriver")
        driver = subprocess.Popen(["/usr/bin/safaridriver", "-p", "4444"],
            stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, stdin=subprocess.DEVNULL,
            start_new_session=True)
        time.sleep(2)
        mark("create-native-ios-session")
        value = wd("POST", "/session", {"capabilities": {"alwaysMatch": {
            "browserName": "safari", "platformName": "ios", "safari:useSimulator": True,
            "safari:deviceUDID": sim_id}}}, 45)
        session_id = value["sessionId"]
        caps = value.get("capabilities", {})
        report["driverCapabilities"] = {k:v for k,v in caps.items() if k in
            ["browserName", "browserVersion", "platformName", "safari:deviceName", "safari:deviceUDID", "safari:platformVersion", "safari:platformBuildVersion"]}
        report["safaridriverUsed"] = True
        base = "/session/" + session_id
        wd("POST", base + "/timeouts", {"pageLoad": 35000, "script": 15000, "implicit": 0})
        mark("driver-navigate-exact-preview")
        wd("POST", base + "/url", {"url": TARGET}, 40)
        time.sleep(3)
        mark("driver-measure-header")
        script = """const q=s=>document.querySelector(s), r=e=>{if(!e)return null;const a=e.getBoundingClientRect();return {x:a.x,y:a.y,width:a.width,height:a.height,right:a.right,bottom:a.bottom}};
const brand=q('.na-public-brand'), name=q('.na-brand-name'), subtitle=q('.na-public-brand__copy small'), menu=q('.na-public-mobile-nav summary'), actions=q('.na-public-header__actions');
const overlap=(a,b)=>!!a&&!!b&&Math.min(a.right,b.right)>Math.max(a.x,b.x)&&Math.min(a.bottom,b.bottom)>Math.max(a.y,b.y);
return {url:location.href,title:document.title,viewport:{width:innerWidth,height:innerHeight,dpr:devicePixelRatio,scale:visualViewport?.scale},theme:document.documentElement.getAttribute('data-na-theme'),prefersDark:matchMedia('(prefers-color-scheme: dark)').matches,brand:r(brand),name:r(name),subtitle:r(subtitle),menu:r(menu),actions:r(actions),collision:overlap(r(name),r(menu))||overlap(r(subtitle),r(menu)),menuHit:menu?menu.contains(document.elementFromPoint(r(menu).x+r(menu).width/2,r(menu).y+r(menu).height/2)):false,content:q('#terminal-results-title')?.textContent};"""
        report["geometry"] = wd("POST", base + "/execute/sync", {"script": script, "args": []})
        report["readOnlyDriverControlVerified"] = bool(report["geometry"].get("content"))
        report["interactiveControlVerified"] = False
        mark("native-driver-capture")
        run_matrix(base)
        report["reviewStatus"] = "INTERACTIVE_MICROPROBE_ONLY; keyboard suppressed by SafariDriver; no matrix PASS"

    def run_matrix(base):
        import base64
        report['cases']=[]
        def js(script):return wd('POST',base+'/execute/sync',{'script':script,'args':[]},15)
        def snapshot():return js("return {theme:document.documentElement.getAttribute('data-na-theme'),buttonTheme:document.querySelector('.na-theme-toggle')?.getAttribute('data-theme'),prefersDark:matchMedia('(prefers-color-scheme: dark)').matches,stored:localStorage.getItem('nagamealert-theme'),dialog:!!document.querySelector('[role=dialog]'),busy:document.querySelector('.na-terminal-results')?.getAttribute('aria-busy'),scripts:Array.from(document.querySelectorAll('script[src]'),e=>({path:new URL(e.src).pathname,type:e.type})),resources:performance.getEntriesByType('resource').filter(e=>e.name.includes('/assets/')).map(e=>({path:new URL(e.name).pathname,duration:Math.round(e.duration),size:e.transferSize}))};")
        def shot(name):
            raw=base64.b64decode(wd('GET',base+'/screenshot',timeout=15));(OUT/(name+'.png')).write_bytes(raw)
            report['screenshots'].append({'file':name+'.png','stage':'readiness-probe','ok':True,**png_info(raw)})
        mark('client-readiness-hypothesis')
        report['readinessBefore']=snapshot()
        js("localStorage.removeItem('nagamealert-theme');localStorage.setItem('nagamealert.analytics-consent.v1',JSON.stringify({choice:'rejected',updatedAt:1,version:1}));return true;")
        command(['xcrun','simctl','ui',sim_id,'appearance','light'],15);wd('POST',base+'/refresh',{})
        deadline=time.monotonic()+45
        while time.monotonic()<deadline:
            state=snapshot()
            if state['buttonTheme']=='light' and not state['dialog']:break
            time.sleep(2)
        report['readinessAfter']=state
        ready=state['buttonTheme']=='light' and not state['dialog']
        report['cases'].append({'case':'native-client-hydration-ready','status':'PASS' if ready else 'FAIL','evidence':state})
        if not ready:
            mark('public-entry-import-error-diagnosis')
            report['entryImport']=wd('POST',base+'/execute/async',{'script':"const done=arguments[arguments.length-1];const s=document.querySelector('script[type=module][src]');if(!s){done({error:'No module entry'});return;}import(s.src).then(()=>done({ok:true,path:new URL(s.src).pathname})).catch(e=>done({ok:false,path:new URL(s.src).pathname,name:e.name,message:String(e.message).slice(0,1200)}));",'args':[]},20)
            shot('failure-native');persist();return
        def expect(script,wanted):
            end=time.monotonic()+12
            while time.monotonic()<end:
                value=js(script)
                if value==wanted:return value
                time.sleep(.5)
            raise AssertionError('Expected '+str(wanted)+'; got '+str(value))
        def click(selector):
            found=wd('POST',base+'/element',{'using':'css selector','value':selector})
            element=found.get('element-6066-11e4-a52e-4f735466cecf')
            wd('POST',base+'/element/'+element+'/click',{})
        def test(name,fn):
            try:report['cases'].append({'case':name,'status':'PASS','evidence':fn()})
            except Exception as e:report['cases'].append({'case':name,'status':'FAIL','error':str(e)[:1200]})
            persist()
        def theme():
            command(['xcrun','simctl','ui',sim_id,'appearance','dark'],15)
            expect("return matchMedia('(prefers-color-scheme: dark)').matches;",True)
            expect("return document.documentElement.getAttribute('data-na-theme');",'dark')
            shot('native-dark-header')
            command(['xcrun','simctl','ui',sim_id,'appearance','light'],15)
            expect("return document.documentElement.getAttribute('data-na-theme');",'light')
            click('.na-theme-toggle');expect("return localStorage.getItem('nagamealert-theme');",'dark')
            wd('POST',base+'/refresh',{});expect("return document.querySelector('.na-theme-toggle')?.getAttribute('data-theme');",'dark')
            return snapshot()
        test('native-system-follow-manual-persistence-ready',theme)
        def menu():
            click('.na-public-mobile-nav summary');expect("return document.querySelector('.na-public-mobile-nav').open;",True)
            shot('native-header');click('.na-public-mobile-nav summary');expect("return document.querySelector('.na-public-mobile-nav').open;",False)
            return {'nativeWebDriverOpenClose':True}
        test('native-menu-after-readiness',menu)
        def consent():
            js("localStorage.removeItem('nagamealert.analytics-consent.v1');return true;");wd('POST',base+'/refresh',{})
            expect("return document.querySelector('.na-theme-toggle')?.getAttribute('data-theme');",'dark')
            click('[data-consent-accept]')
            expect("return JSON.parse(localStorage.getItem('nagamealert.analytics-consent.v1')||'null')?.choice;",'accepted')
            return {'accepted':True}
        # Consent selectors are diagnosed, not guessed or replaced with a storage write.
        report['remainingNativeCases']='keyboard/gestures/rotation remain HOLD; final-head consent/filter/search matrix still required'
        persist()

    def expire(_sig, _frame):
        raise CaptureDeadline("Independent 420-second capture deadline exceeded")

    signal.signal(signal.SIGALRM, expire)
    signal.alarm(420)
    try:
        mark("runner")
        if platform.system() != "Darwin" or os.environ.get("GITHUB_REPOSITORY") != "cgam-coder/vigia-aesan-feed":
            raise RuntimeError("Only the authorized macOS Actions runner may execute this capture")
        sdk = command(["xcrun", "--sdk", "iphonesimulator", "--show-sdk-version"]).decode().strip()
        report["host"] = {"macOS": command(["sw_vers"]).decode().strip(), "arch": platform.machine(),
                          "xcode": command(["xcodebuild", "-version"]).decode().strip(), "simulatorSDK": sdk}
        mark("inventory-verified-route")
        inventory=json.loads(command(["xcrun","simctl","list","--json"],75))
        device,runtime=choose_device(inventory,sdk)
        report["selected"] = {"model": device["name"], "runtime": runtime["name"],
                              "runtimeVersion": runtime.get("version"), "runtimeBuild": runtime.get("buildversion")}
        mark("create-disposable-simulator")
        sim_id = command(["xcrun", "simctl", "create", "UI-F1A-native-"+os.environ.get("GITHUB_RUN_ID","local"), device["deviceTypeIdentifier"], runtime["identifier"]], 75).decode().strip()
        if not re.fullmatch(r"[A-Fa-f0-9-]{36}", sim_id):
            raise RuntimeError("Invalid simulator ID")
        report["simulatorUDID"] = sim_id
        mark("boot")
        command(["xcrun", "simctl", "boot", sim_id], 20)
        command(["xcrun", "simctl", "bootstatus", sim_id, "-b"], 120)
        mark("present-simulator-window")
        developer = Path(command(["xcode-select", "-p"]).decode().strip())
        simulator_app = developer / "Applications" / "Simulator.app"
        if not simulator_app.is_dir():
            raise RuntimeError("Simulator.app missing under the selected Xcode")
        report["simulatorPresentation"] = observe(
            "foreground-simulator", ["open", "-a", str(simulator_app), "--args", "-CurrentDeviceUDID", sim_id], 15)
        time.sleep(5)
        observe("framebuffer-policy", ["defaults", "read", "com.apple.CoreSimulator", "FramebufferServerRendererPolicy"], 5)
        mark("simulator-ready-capture")
        # No redundant framebuffer capture in client-readiness microprobe.
        mark("native-safari")
        launch = observe("launch-safari", ["xcrun", "simctl", "launch", sim_id, "com.apple.mobilesafari"], 25)
        confirmed = bool(launch["ok"] and re.search(r"com\.apple\.mobilesafari:\s*\d+", launch.get("stdout", "")))
        report["nativeAppleSafari"] = confirmed
        report["application"] = {"bundleId": "com.apple.mobilesafari", "launchConfirmed": confirmed}
        time.sleep(5)
        navigate_and_capture()
        interactive_probe()
        report["reviewStatus"] = "PENDING_VISUAL_REVIEW; image presence and command status are not product PASS"
        mark("capture-complete")
    except Exception as exc:
        report["failedStage"] = active_stage
        report["error"] = f"{type(exc).__name__}: {exc}"
        if sim_id:
            try:
                capture("failure-native.png")
            except Exception:
                pass
        print("IOS_SAFARI_HOLD " + report["error"], flush=True)
    finally:
        signal.alarm(0)
        if session_id:
            try:
                wd("DELETE", "/session/" + session_id, timeout=10)
                report["cleanup"]["driverSession"] = True
            except Exception as exc:
                report["cleanup"]["driverSession"] = False
        if driver:
            try:
                os.killpg(driver.pid, signal.SIGKILL)
                driver.wait(timeout=5)
                report["cleanup"]["driverProcess"] = True
            except Exception:
                report["cleanup"]["driverProcess"] = False
        if sim_id and re.fullmatch(r"[A-Fa-f0-9-]{36}", sim_id):
            for action in ["shutdown", "delete"]:
                try:
                    command(["xcrun", "simctl", action, sim_id], 20)
                    report["cleanup"][action] = True
                except Exception as exc:
                    report["cleanup"][action] = False
                    report["cleanup"][action + "Error"] = str(exc)[:1000]
        persist()
        if os.environ.get("GITHUB_STEP_SUMMARY"):
            with open(os.environ["GITHUB_STEP_SUMMARY"], "a", encoding="utf-8") as stream:
                stream.write("## Native Safari capture: visual review required\n\n```json\n" + json.dumps(report, indent=2) + "\n```\n")
    print("IOS_SAFARI_RESULT " + json.dumps(report), flush=True)
    # Green means only that final capture and cleanup completed, not a UX PASS.
    return 0 if (report.get("readOnlyDriverControlVerified") and
                 report["cleanup"].get("shutdown") and report["cleanup"].get("delete")) else 1


if __name__ == "__main__":
    if sys.argv[1:] == ["--self-test"]:
        self_test()
    else:
        sys.exit(main())
