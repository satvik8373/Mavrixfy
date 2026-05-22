import json
import sys

def main():
    path = r"C:\Users\ASUS\Downloads\localhost_3000-20260522T215938.json"
    try:
        with open(path, "r", encoding="utf-8") as f:
            data = json.load(f)
    except Exception as e:
        print(f"Error reading JSON: {e}")
        return

    print("Lighthouse Version:", data.get("lighthouseVersion"))
    print("Requested URL:", data.get("requestedUrl"))
    print("\n=== METRICS ===")
    metrics = [
        "first-contentful-paint",
        "largest-contentful-paint",
        "speed-index",
        "total-blocking-time",
        "max-potential-fid",
        "cumulative-layout-shift",
        "interactive"
    ]
    for m in metrics:
        audit = data["audits"].get(m, {})
        print(f"{m}: score={audit.get('score')} display={audit.get('displayValue')} ({audit.get('numericValue')})")

    print("\n=== LOW SCORE AUDITS (< 0.8) ===")
    for k, v in data["audits"].items():
        score = v.get("score")
        if score is not None and isinstance(score, (int, float)) and score < 0.8:
            print(f"{k}: score={score} display={v.get('displayValue')} | title={v.get('title')}")

    print("\n=== CUMULATIVE LAYOUT SHIFT DETAILS ===")
    cls_audit = data["audits"].get("cumulative-layout-shift", {})
    details = cls_audit.get("details", {})
    if details:
        print(json.dumps(details, indent=2)[:2000])

    print("\n=== RENDER BLOCKING RESOURCES ===")
    rb = data["audits"].get("render-blocking-resources", {})
    print(f"Render Blocking: score={rb.get('score')} display={rb.get('displayValue')}")
    rb_details = rb.get("details", {})
    if rb_details:
        print(json.dumps(rb_details, indent=2))

    print("\n=== UNUSED JAVASCRIPT ===")
    uj = data["audits"].get("unused-javascript", {})
    print(f"Unused JS: score={uj.get('score')} display={uj.get('displayValue')}")
    uj_details = uj.get("details", {})
    if uj_details:
        print(json.dumps(uj_details, indent=2)[:2000])

    print("\n=== OFFSCREEN IMAGES ===")
    oi = data["audits"].get("offscreen-images", {})
    print(f"Offscreen Images: score={oi.get('score')} display={oi.get('displayValue')}")
    oi_details = oi.get("details", {})
    if oi_details:
        print(json.dumps(oi_details, indent=2)[:2000])

    print("\n=== UNUSED CSS RULES ===")
    uc = data["audits"].get("unused-css-rules", {})
    print(f"Unused CSS: score={uc.get('score')} display={uc.get('displayValue')}")
    uc_details = uc.get("details", {})
    if uc_details:
        print(json.dumps(uc_details, indent=2)[:2000])

if __name__ == "__main__":
    main()
