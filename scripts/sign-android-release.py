#!/usr/bin/env python3
"""Sign locally built STM MEXA artifacts without an Expo or Google login.

Passwords come from a private JSON file and reach Java tools only through their
environment. Never pass passwords as command-line arguments or print them.
"""
import argparse
import base64
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import struct
import subprocess
import tempfile
import zipfile


def run(args, env):
    result = subprocess.run([str(arg) for arg in args], env=env, capture_output=True, text=True)
    if result.returncode:
        raise RuntimeError(f"{Path(str(args[0])).name} failed: {result.stderr or result.stdout}")
    return result.stdout


def certificate_hash(pem):
    match = re.search(r"-----BEGIN CERTIFICATE-----\s*(.*?)\s*-----END CERTIFICATE-----", pem, re.S)
    if not match:
        raise RuntimeError("Signing certificate could not be verified")
    return hashlib.sha256(base64.b64decode(match[1])).hexdigest()


def android_tools(sdk):
    candidates = [p for p in (sdk / "build-tools").iterdir() if all((p / tool).is_file() for tool in ("apksigner", "zipalign", "aapt2"))]
    candidates.sort(key=lambda p: tuple(int(n) for n in re.findall(r"\d+", p.name)), reverse=True)
    if not candidates:
        raise RuntimeError("Android build tools are not installed; empty .installer folders do not count")
    return candidates[0]


def native_alignment(apk):
    """Check 64-bit ELF LOAD alignment and uncompressed JNI ZIP offsets."""
    checked, failures = [], []
    with zipfile.ZipFile(apk) as archive, open(apk, "rb") as source:
        for entry in archive.infolist():
            if not re.match(r"lib/(arm64-v8a|x86_64)/.*\.so$", entry.filename):
                continue
            blob = archive.read(entry)
            if blob[:6] != b"\x7fELF\x02\x01":
                failures.append(entry.filename + ": unexpected ELF format")
                continue
            offset = struct.unpack_from("<Q", blob, 32)[0]
            size, count = struct.unpack_from("<HH", blob, 54)
            loads = [struct.unpack_from("<Q", blob, offset + i * size + 48)[0]
                     for i in range(count) if struct.unpack_from("<I", blob, offset + i * size)[0] == 1]
            if not loads or min(loads) < 16384:
                failures.append(entry.filename + ": ELF LOAD alignment below 16 KB")
            if entry.compress_type == zipfile.ZIP_STORED:
                source.seek(entry.header_offset + 26)
                name_size, extra_size = struct.unpack("<HH", source.read(4))
                if (entry.header_offset + 30 + name_size + extra_size) % 16384:
                    failures.append(entry.filename + ": uncompressed JNI offset is not 16 KB aligned")
            checked.append(entry.filename)
    return {"checked_64bit_libraries": len(checked), "passed": bool(checked) and not failures, "failures": failures}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--credentials", type=Path, required=True)
    parser.add_argument("--apk", type=Path, required=True)
    parser.add_argument("--aab", type=Path, required=True)
    parser.add_argument("--out-dir", type=Path, required=True)
    parser.add_argument("--name-suffix", default="")
    parser.add_argument("--android-sdk", type=Path)
    parser.add_argument("--java-home", type=Path)
    args = parser.parse_args()
    if args.name_suffix and not re.fullmatch(r"[A-Za-z0-9-]+", args.name_suffix):
        raise RuntimeError("Artifact suffix must contain only letters, digits, or hyphens")
    config = json.loads(args.credentials.read_text())
    for key in ("keystore", "alias", "storePassword", "keyPassword", "buildContact", "playConsoleAccount"):
        if not isinstance(config.get(key), str) or not config[key]:
            raise RuntimeError(f"Private signing configuration is missing {key}")
    if args.credentials.stat().st_mode & 0o077:
        raise RuntimeError("Protect the private credentials file with owner-only permissions (chmod 600)")
    key_file = Path(config["keystore"]).resolve(strict=True)
    project = Path(__file__).resolve().parents[1]
    expected = json.loads((project / "app.json").read_text())["expo"]["android"]["package"]
    env = os.environ.copy()
    env.update(STM_STORE_PASSWORD=config["storePassword"], STM_KEY_PASSWORD=config["keyPassword"])
    java_home = args.java_home or Path(env.get("JAVA_HOME", "/Applications/Android Studio.app/Contents/jbr/Contents/Home"))
    sdk = args.android_sdk or Path(env.get("ANDROID_HOME", env.get("ANDROID_SDK_ROOT", str(Path.home() / "Library/Android/sdk"))))
    env["JAVA_HOME"] = str(java_home)
    tools = android_tools(sdk)
    keytool, jarsigner = java_home / "bin/keytool", java_home / "bin/jarsigner"
    for file in (args.apk, args.aab, keytool, jarsigner):
        if not file.is_file():
            raise RuntimeError(f"Required file is missing: {file}")
    for file in (args.apk, args.aab):
        with zipfile.ZipFile(file) as archive:
            if any(re.match(r"META-INF/.*\.(RSA|DSA|EC|SF)$", name, re.I) for name in archive.namelist()):
                raise RuntimeError(f"Input is already signed; refusing to replace an existing identity: {file.name}")
    badging = run([tools / "aapt2", "dump", "badging", args.apk], env)
    match = re.search(r"package: name='([^']+)' versionCode='(\d+)' versionName='([^']+)'", badging)
    if not match or match[1] != expected:
        raise RuntimeError("APK package does not match the configured new STM MEXA application")
    package, code, version = match.groups()
    certificate = run([keytool, "-exportcert", "-rfc", "-keystore", key_file, "-alias", config["alias"], "-storepass:env", "STM_STORE_PASSWORD"], env)
    fingerprint = certificate_hash(certificate)
    args.out_dir.mkdir(parents=True, exist_ok=True)
    stem = f"STM-MEXA-{version}-{code}" + (f"-{args.name_suffix}" if args.name_suffix else "")
    apk, aab = args.out_dir / (stem + ".apk"), args.out_dir / (stem + ".aab")
    if apk.exists() or aab.exists():
        raise RuntimeError("Release files already exist; choose a new output directory or increment the version")
    with tempfile.TemporaryDirectory(prefix="stm-sign-", dir=args.out_dir) as temporary:
        temp = Path(temporary)
        aligned, signed_apk, signed_aab = temp / "aligned.apk", temp / "signed.apk", temp / "signed.aab"
        help_result = subprocess.run([str(tools / "zipalign"), "-h"], env=env, capture_output=True, text=True)
        supports_16k = "-P" in (help_result.stdout + help_result.stderr)
        alignment_flags = ["-P", "16"] if supports_16k else []
        run([tools / "zipalign", *alignment_flags, "-f", "4", args.apk, aligned], env)
        run([tools / "apksigner", "sign", "--ks", key_file, "--ks-key-alias", config["alias"], "--ks-pass", "env:STM_STORE_PASSWORD", "--key-pass", "env:STM_KEY_PASSWORD", "--out", signed_apk, aligned], env)
        signature = run([tools / "apksigner", "verify", "--verbose", "--print-certs", signed_apk], env)
        actual = re.search(r"certificate SHA-256 digest: ([0-9a-fA-F]+)", signature)
        if not actual or actual[1].lower() != fingerprint:
            raise RuntimeError("APK signer does not match the company upload certificate")
        run([tools / "zipalign", "-c", *alignment_flags, "4", signed_apk], env)
        native = native_alignment(signed_apk)
        if not native["passed"]:
            raise RuntimeError("16 KB compatibility check failed: " + json.dumps(native))
        run([jarsigner, "-keystore", key_file, "-storepass:env", "STM_STORE_PASSWORD", "-keypass:env", "STM_KEY_PASSWORD", "-sigalg", "SHA256withRSA", "-digestalg", "SHA-256", "-signedjar", signed_aab, args.aab, config["alias"]], env)
        verified = run([jarsigner, "-verify", signed_aab], env)
        if "jar verified" not in verified.lower():
            raise RuntimeError("AAB signature verification did not succeed")
        aab_certificate = run([keytool, "-printcert", "-rfc", "-jarfile", signed_aab], env)
        if certificate_hash(aab_certificate) != fingerprint:
            raise RuntimeError("APK and AAB use different signing identities")
        shutil.move(signed_apk, apk)
        shutil.move(signed_aab, aab)
    (args.out_dir / "stm-mexa-upload-certificate.pem").write_text(certificate)
    manifest = {"appName": "STM MEXA", "package": package, "versionName": version, "versionCode": int(code),
                "playConsoleAccount": config["playConsoleAccount"], "buildContact": config["buildContact"],
                "buildMethod": "local Gradle; no Expo or Google login used", "certificateSha256": fingerprint,
                "native16KB": native, "apkSignatureVerified": True, "aabSignatureVerified": True,
                "files": [{"name": file.name, "bytes": file.stat().st_size, "sha256": hashlib.file_digest(file.open("rb"), "sha256").hexdigest()} for file in (apk, aab)]}
    (args.out_dir / "release-info.json").write_text(json.dumps(manifest, indent=2) + "\n")
    print(json.dumps(manifest, indent=2))


if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        raise SystemExit(str(error))
