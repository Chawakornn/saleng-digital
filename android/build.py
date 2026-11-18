"""Build the online APK using the official Android SDK tools and a local signing key."""
import os
import shutil
import subprocess
import tempfile
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
ANDROID = ROOT / "android"
SDK = Path(os.environ["ANDROID_HOME"])
JDK = Path(os.environ["JAVA_HOME"]) / "bin"
TOOLS = SDK / "build-tools" / "37.0.0"
PLATFORM = SDK / "platforms" / "android-35" / "android.jar"
KEY = Path(os.environ.get("SALENG_KEYSTORE", ROOT / ".android-signing/release.p12"))
PASSWORD = Path(os.environ.get("SALENG_PASSWORD_FILE", ROOT / ".android-signing/password"))
DEST = ROOT / "public/downloads/saleng-digital.apk"


def run(*args):
    subprocess.run([str(arg) for arg in args], cwd=ROOT, check=True)


def build(stage):
    classes = stage / "classes"
    dex = stage / "dex"
    icons = stage / "res/drawable-nodpi"
    for folder in (classes, dex, icons):
        folder.mkdir(parents=True)
    shutil.copyfile(ROOT / "public/icon-192.png", icons / "launcher.png")
    run(TOOLS / "aapt2", "compile", "--dir", stage / "res", "-o", stage / "res.zip")
    unsigned = stage / "unsigned.apk"
    run(TOOLS / "aapt2", "link", "-I", PLATFORM, "--manifest", ANDROID / "AndroidManifest.xml",
        "-R", stage / "res.zip", "-o", unsigned)
    run(JDK / "javac", "-encoding", "UTF-8", "--release", "8", "-cp", PLATFORM,
        "-d", classes, ANDROID / "MainActivity.java")
    run(JDK / "jar", "cf", stage / "classes.jar", "-C", classes, ".")
    run(JDK / "java", "-cp", TOOLS / "lib/d8.jar", "com.android.tools.r8.D8",
        "--min-api", "26", "--lib", PLATFORM, "--output", dex, stage / "classes.jar")
    with zipfile.ZipFile(unsigned, "a") as apk:
        apk.write(dex / "classes.dex", "classes.dex", zipfile.ZIP_DEFLATED)
    aligned, signed = stage / "aligned.apk", stage / "signed.apk"
    run(TOOLS / "zipalign", "-p", "4", unsigned, aligned)
    signer = [JDK / "java", "-jar", TOOLS / "lib/apksigner.jar"]
    run(*signer, "sign", "--ks", KEY, "--ks-key-alias", "saleng", "--ks-pass",
        "file:" + str(PASSWORD), "--v4-signing-enabled", "false", "--out", signed, aligned)
    run(*signer, "verify", "--verbose", "--print-certs", signed)
    run(TOOLS / "zipalign", "-c", "-p", "4", signed)
    DEST.parent.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(signed, DEST)
    print(DEST)


if __name__ == "__main__":
    if not (KEY.is_file() and PASSWORD.is_file()):
        raise SystemExit("Configure SALENG_KEYSTORE and SALENG_PASSWORD_FILE (see README.md).")
    with tempfile.TemporaryDirectory(prefix="saleng-apk-") as temporary:
        build(Path(temporary))
