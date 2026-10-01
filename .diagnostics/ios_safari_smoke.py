#!/usr/bin/env python3
"""One read-only Safari/iOS Simulator viability check. No third-party packages.

Uses only a preinstalled Xcode runtime, a fresh disposable iPhone simulator and
Apple safaridriver. A successful screenshot is NOT full UX/device certification.
"""
from __future__ import annotations
import base64
import hashlib
import json
import os
from pathlib import Path
import platform
import re
import signal
import socket
import struct
import subprocess
import sys
import time
import urllib.error
import urllib.request

TARGET = "https://579819b1-vigia-runtime.c-gamiz93.workers.dev/es/alertas"
OUT = Path("ios-safari-evidence")


def choose_device(inventory: dict) -> tuple[dict, dict]:
    runtimes = {r["identifier"]: r for r in inventory.get("runtimes", [])
                if r.get("isAvailable") and ".iOS-" in r.get("identifier", "")
                and not re.search(r"beta|preview", r.get("name", ""), re.I)}
    candidates = []
    for runtime_id, devices in inventory.get("devices", {}).items():
        if runtime_id not in runtimes:
            continue
        runtime = runtimes[runtime_id]
        version = tuple(int(n) for n in runtime.get("version", "0").split("."))
        for device in devices:
            if device.get("isAvailable") and device.get("name", "").startswith("iPhone") and device.get("deviceTypeIdentifier"):
                candidates.append((version, device["name"], device, runtime))
    if not candidates:
        raise RuntimeError("No preinstalled available iPhone/iOS runtime; no download attempted")
    _, _, device, runtime = max(candidates, key=lambda row: (row[0], row[1]))
    return device, runtime


def png_info(data: bytes) -> dict:
    if len(data) < 1024 or len(data) > 10_000_000 or data[:8] != b"\x89PNG\r\n\x1a\n" or data[12:16] != b"IHDR":
        raise RuntimeError("Missing, invalid or oversized PNG evidence")
    width, height = struct.unpack(">II", data[16:24])
    if width < 200 or height < 300:
        raise RuntimeError("Screenshot dimensions do not support a phone render")
    return {"width": width, "height": height, "bytes": len(data),
            "sha256": hashlib.sha256(data).hexdigest(), "visuallyReviewed": False}


def self_test() -> None:
    runtime = {"identifier": "com.apple.CoreSimulator.SimRuntime.iOS-18-5", "version": "18.5", "name": "iOS 18.5", "isAvailable": True}
    good = {"name": "iPhone 16", "isAvailable": True, "deviceTypeIdentifier": "type-iphone"}
    bad = {"name": "iPad Pro", "isAvailable": True, "deviceTypeIdentifier": "type-ipad"}
    assert choose_device({"runtimes": [runtime], "devices": {runtime["identifier"]: [bad, good]}})[0] == good
    for inv in [{}, {"runtimes": [{**runtime, "isAvailable": False}], "devices": {runtime["identifier"]: [good]}}]:
        try:
            choose_device(inv)
        except RuntimeError:
            pass
        else:
            raise AssertionError("Unavailable simulator incorrectly accepted")
    try:
        png_info(b"not a screenshot")
    except RuntimeError:
        pass
    else:
        raise AssertionError("Invalid screenshot incorrectly accepted")
    assert TARGET.startswith("https://") and TARGET.endswith("/es/alertas")
    print("SELF_TEST_PASS: selection, unavailable-runtime rejection and invalid-image rejection")


def main() -> int:
    OUT.mkdir(exist_ok=True)
    report = {"scope": "single-page viability only", "pass": False,
              "nativeAppleSafari": False, "physicalIPhone": False,
              "fullCompatibilityCertified": False, "target": TARGET,
              "diagnosticSha": os.environ.get("GITHUB_SHA"),
              "runId": os.environ.get("GITHUB_RUN_ID"),
              "runnerImage": os.environ.get("ImageVersion"),
              "stages": [], "screenshots": [], "cleanup": {}}
    sim_id = None
    driver = None
    sid = None
    endpoint = None
    driver_log = None
    active_stage = "start"

    def persist() -> None:
        tmp = OUT / "report.tmp"
        tmp.write_text(json.dumps(report, indent=2), encoding="utf-8")
        tmp.replace(OUT / "report.json")

    def mark(stage: str) -> None:
        nonlocal active_stage
        active_stage = stage
        report["lastStage"] = stage
        report["stages"].append({"stage": stage, "utc": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())})
        persist()
        print("IOS_SAFARI_STAGE " + stage, flush=True)

    def command(args: list[str], timeout: int = 20, required: bool = True) -> str:
        with subprocess.Popen(args, stdout=subprocess.PIPE, stderr=subprocess.PIPE,
                              text=True, start_new_session=True) as proc:
            try:
                stdout, stderr = proc.communicate(timeout=timeout)
            except BaseException:
                if proc.poll() is None:
                    os.killpg(proc.pid, signal.SIGKILL)
                proc.communicate(timeout=5)
                raise
        if required and proc.returncode != 0:
            raise RuntimeError(f"{args[0]} {args[1:3]} exit={proc.returncode}: {stderr[-4000:]}")
        return stdout.strip()

    def wd(method: str, route: str, payload: dict | None = None, timeout: int = 25):
        body = None if payload is None else json.dumps(payload).encode()
        request = urllib.request.Request(endpoint + route, data=body,
                    headers={"Content-Type": "application/json"}, method=method)
        try:
            with urllib.request.urlopen(request, timeout=timeout) as response:
                data = json.load(response)
        except urllib.error.HTTPError as exc:
            raise RuntimeError(f"WebDriver HTTP {exc.code}: {exc.read(10000).decode(errors='replace')}") from exc
        value = data.get("value")
        if isinstance(value, dict) and value.get("error"):
            raise RuntimeError("WebDriver: " + json.dumps(value)[:8000])
        return value

    def expire(_sig, _frame):
        raise TimeoutError("Independent 420-second overall deadline exceeded")

    signal.signal(signal.SIGALRM, expire)
    signal.alarm(420)
    try:
        mark("runner")
        if platform.system() != "Darwin" or os.environ.get("GITHUB_REPOSITORY") != "cgam-coder/vigia-aesan-feed":
            raise RuntimeError("This network test is restricted to the authorized macOS Actions runner")
        report["host"] = {"macOS": command(["sw_vers"]), "arch": platform.machine(),
                          "xcode": command(["xcodebuild", "-version"])}
        mark("inventory")
        inventory = json.loads(command(["xcrun", "simctl", "list", "--json"], 40))
        device, runtime = choose_device(inventory)
        report["selected"] = {"model": device["name"], "runtime": runtime["name"],
                              "runtimeVersion": runtime.get("version"), "runtimeBuild": runtime.get("buildversion")}
        mark("create-disposable-simulator")
        sim_id = command(["xcrun", "simctl", "create", "UI-F1A-viability", device["deviceTypeIdentifier"], runtime["identifier"]], 40)
        if not re.fullmatch(r"[A-Fa-f0-9-]{36}", sim_id):
            raise RuntimeError("Unexpected simulator creation response")
        report["simulatorUDID"] = sim_id
        mark("boot")
        command(["xcrun", "simctl", "boot", sim_id], 30)
        command(["xcrun", "simctl", "bootstatus", sim_id, "-b"], 180)
        command(["open", "-a", "Simulator", "--args", "-CurrentDeviceUDID", sim_id], 20)
        mark("enable-safaridriver")
        command(["sudo", "-n", "/usr/bin/safaridriver", "--enable"], 25)
        with socket.socket() as sock:
            sock.bind(("127.0.0.1", 0))
            port = sock.getsockname()[1]
        endpoint = f"http://127.0.0.1:{port}"
        driver_log = (OUT / "safaridriver.log").open("w", encoding="utf-8")
        driver = subprocess.Popen(["/usr/bin/safaridriver", "-p", str(port)],
                    stdout=driver_log, stderr=subprocess.STDOUT, start_new_session=True)
        mark("webdriver-ready")
        deadline = time.monotonic() + 15
        while True:
            if driver.poll() is not None:
                raise RuntimeError("safaridriver exited before readiness")
            try:
                wd("GET", "/status", timeout=2)
                break
            except (RuntimeError, OSError):
                if time.monotonic() >= deadline:
                    raise RuntimeError("safaridriver did not become ready in 15 seconds")
                time.sleep(0.5)
        mark("ios-safari-session")
        value = wd("POST", "/session", {"capabilities": {"alwaysMatch": {
            "browserName": "Safari", "platformName": "iOS", "safari:useSimulator": True,
            "safari:deviceUDID": sim_id, "pageLoadStrategy": "eager",
            "timeouts": {"pageLoad": 45000, "script": 10000, "implicit": 0}}}}, timeout=90)
        sid = value["sessionId"]
        caps = value["capabilities"]
        report["capabilities"] = caps
        if str(caps.get("platformName", "")).lower() != "ios" or str(caps.get("browserName", "")).lower() != "safari":
            raise RuntimeError("Returned browser is not Safari/iOS; desktop fallback rejected")
        report["nativeAppleSafari"] = True
        prefix = "/session/" + sid
        mark("navigate-preview")
        wd("POST", prefix + "/url", {"url": TARGET}, timeout=55)
        mark("verify-render")
        script = """const m=document.querySelector('main');const r=m?.getBoundingClientRect();return {
          url:location.href,title:document.title,ua:navigator.userAgent,readyState:document.readyState,
          shell:!!document.querySelector('.na-public-shell'),themeControl:!!document.querySelector('.na-theme-toggle'),
          mainHeight:r?.height||0,mainWidth:r?.width||0,textLength:(m?.innerText||'').trim().length,
          width:innerWidth,height:innerHeight,deviceScale:devicePixelRatio};"""
        deadline = time.monotonic() + 20
        while True:
            dom = wd("POST", prefix + "/execute/sync", {"script": script, "args": []}, timeout=12)
            report["observed"] = dom
            if dom.get("url", "").rstrip("/") != TARGET:
                raise RuntimeError("Unexpected navigation away from the immutable Preview target")
            if dom.get("shell") and dom.get("themeControl") and dom.get("mainHeight", 0) > 20 and dom.get("mainWidth", 0) > 100 and dom.get("textLength", 0) > 80:
                break
            if time.monotonic() >= deadline:
                raise RuntimeError("Expected application render not observed in 20 seconds")
            time.sleep(1)
        if "iPhone" not in dom.get("ua", "") or "Safari" not in dom.get("ua", ""):
            raise RuntimeError("Observed user agent does not confirm an iPhone Safari page")
        mark("capture")
        data = base64.b64decode(wd("GET", prefix + "/screenshot", timeout=25), validate=True)
        info = png_info(data)
        (OUT / "safari-preview.png").write_bytes(data)
        report["screenshots"].append({"file": "safari-preview.png", **info})
        # Independent full simulator capture includes Safari chrome; no user credentials.
        command(["xcrun", "simctl", "io", sim_id, "screenshot", str(OUT / "iphone-simulator.png")], 25)
        report["screenshots"].append({"file": "iphone-simulator.png", **png_info((OUT / "iphone-simulator.png").read_bytes())})
        report["pass"] = True
        mark("viability-complete")
    except Exception as exc:
        report["pass"] = False
        report["failedStage"] = active_stage
        report["error"] = f"{type(exc).__name__}: {exc}"
        print("IOS_SAFARI_HOLD " + report["error"], flush=True)
    finally:
        signal.alarm(0)
        if sid:
            try:
                wd("DELETE", "/session/" + sid, timeout=10)
                report["cleanup"]["sessionClosed"] = True
            except Exception as exc:
                report["cleanup"]["sessionCloseError"] = str(exc)[:1000]
        if driver:
            if driver.poll() is None:
                try:
                    os.killpg(driver.pid, signal.SIGTERM)
                    driver.wait(timeout=5)
                except subprocess.TimeoutExpired:
                    os.killpg(driver.pid, signal.SIGKILL)
                    driver.wait(timeout=5)
                except ProcessLookupError:
                    pass
            report["cleanup"]["driverStopped"] = driver.poll() is not None
        if driver_log:
            driver_log.close()
        if sim_id and re.fullmatch(r"[A-Fa-f0-9-]{36}", sim_id):
            try:
                command(["xcrun", "simctl", "shutdown", sim_id], 20, required=False)
                command(["xcrun", "simctl", "delete", sim_id], 20)
                report["cleanup"]["disposableSimulatorDeleted"] = True
            except Exception as exc:
                report["cleanup"]["simulatorCleanupError"] = str(exc)[:1000]
                report["pass"] = False
        persist()
        summary = os.environ.get("GITHUB_STEP_SUMMARY")
        if summary:
            with open(summary, "a", encoding="utf-8") as stream:
                stream.write("## Safari / iOS Simulator viability\n\n```json\n" + json.dumps(report, indent=2) + "\n```\n")
    print("IOS_SAFARI_RESULT " + json.dumps(report), flush=True)
    return 0 if report["pass"] else 1


if __name__ == "__main__":
    if sys.argv[1:] == ["--self-test"]:
        self_test()
    else:
        sys.exit(main())
