#!/usr/bin/env python3
"""Temporary native Safari/iOS Simulator capture; no private code or credentials.

Capture-only: screenshot must be visually reviewed before accepting page render.
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

TARGET = "https://579819b1-vigia-runtime.c-gamiz93.workers.dev/es/alertas"
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
    report = {"scope": "single-page native Safari capture; not a compatibility matrix",
              "target": TARGET, "diagnosticSha": os.environ.get("GITHUB_SHA"),
              "runId": os.environ.get("GITHUB_RUN_ID"), "runnerImage": os.environ.get("ImageVersion"),
              "captureReady": False, "productPass": None, "nativeAppleSafari": False,
              "physicalIPhone": False, "safaridriverUsed": False,
              "fullCompatibilityCertified": False, "stages": [], "screenshots": [], "commands": [], "cleanup": {}}
    sim_id = None
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
        proc = subprocess.Popen(args, stdout=subprocess.PIPE, stderr=subprocess.PIPE, start_new_session=True)
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

    def expire(_sig, _frame):
        raise CaptureDeadline("Independent 300-second capture deadline exceeded")

    signal.signal(signal.SIGALRM, expire)
    signal.alarm(300)
    try:
        mark("runner")
        if platform.system() != "Darwin" or os.environ.get("GITHUB_REPOSITORY") != "cgam-coder/vigia-aesan-feed":
            raise RuntimeError("Only the authorized macOS Actions runner may execute this capture")
        sdk = command(["xcrun", "--sdk", "iphonesimulator", "--show-sdk-version"]).decode().strip()
        report["host"] = {"macOS": command(["sw_vers"]).decode().strip(), "arch": platform.machine(),
                          "xcode": command(["xcodebuild", "-version"]).decode().strip(), "simulatorSDK": sdk}
        mark("inventory")
        inventory = json.loads(command(["xcrun", "simctl", "list", "--json"], 30))
        device, runtime = choose_device(inventory, sdk)
        report["selected"] = {"model": device["name"], "runtime": runtime["name"],
                              "runtimeVersion": runtime.get("version"), "runtimeBuild": runtime.get("buildversion")}
        mark("create-disposable-simulator")
        sim_id = command(["xcrun", "simctl", "create", "UI-F1A-native-capture", device["deviceTypeIdentifier"], runtime["identifier"]], 30).decode().strip()
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
        capture("simulator-ready.png")
        mark("native-safari")
        launch = observe("launch-safari", ["xcrun", "simctl", "launch", sim_id, "com.apple.mobilesafari"], 25)
        confirmed = bool(launch["ok"] and re.search(r"com\.apple\.mobilesafari:\s*\d+", launch.get("stdout", "")))
        report["nativeAppleSafari"] = confirmed
        report["application"] = {"bundleId": "com.apple.mobilesafari", "launchConfirmed": confirmed}
        time.sleep(5)
        navigate_and_capture()
        report["reviewStatus"] = "PENDING_VISUAL_REVIEW; image presence and command status are not product PASS"
        mark("capture-complete")
    except Exception as exc:
        report["failedStage"] = active_stage
        report["error"] = f"{type(exc).__name__}: {exc}"
        if sim_id:
            try:
                capture("iphone-simulator.png")
            except Exception:
                pass
        print("IOS_SAFARI_HOLD " + report["error"], flush=True)
    finally:
        signal.alarm(0)
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
    return 0 if (report["captureReady"] and report["nativeAppleSafari"] and
                 report["cleanup"].get("shutdown") and report["cleanup"].get("delete")) else 1


if __name__ == "__main__":
    if sys.argv[1:] == ["--self-test"]:
        self_test()
    else:
        sys.exit(main())
