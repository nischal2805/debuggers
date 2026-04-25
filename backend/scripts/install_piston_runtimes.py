"""
Run once after starting Piston: python backend/scripts/install_piston_runtimes.py
Installs Python 3.10 and Node.js 18 into the self-hosted Piston container.
"""
import httpx, time, sys

PISTON_URL = "http://localhost:2000"

RUNTIMES = [
    {"language": "python",     "version": "3.10.0"},
    {"language": "javascript", "version": "18.15.0"},
]

def wait_for_piston(retries=10):
    for i in range(retries):
        try:
            r = httpx.get(f"{PISTON_URL}/api/v2/runtimes", timeout=5)
            if r.status_code == 200:
                print("Piston is up.")
                return True
        except Exception:
            pass
        print(f"Waiting for Piston... ({i+1}/{retries})")
        time.sleep(3)
    return False

def install(lang, version):
    print(f"Installing {lang} {version}...", end=" ", flush=True)
    try:
        r = httpx.post(
            f"{PISTON_URL}/api/v2/packages",
            json={"language": lang, "version": version},
            timeout=120,
        )
        if r.status_code in (200, 201):
            print("OK")
            return True
        print(f"FAILED ({r.status_code}): {r.text[:100]}")
        return False
    except Exception as e:
        print(f"ERROR: {e}")
        return False

if not wait_for_piston():
    print("Piston not reachable. Start it first: docker-compose up piston -d")
    sys.exit(1)

for rt in RUNTIMES:
    install(rt["language"], rt["version"])

print("\nVerifying installed runtimes:")
runtimes = httpx.get(f"{PISTON_URL}/api/v2/runtimes").json()
installed = {r["language"] for r in runtimes}
for rt in RUNTIMES:
    status = "installed" if rt["language"] in installed else "MISSING"
    print(f"  {rt['language']}: {status}")
