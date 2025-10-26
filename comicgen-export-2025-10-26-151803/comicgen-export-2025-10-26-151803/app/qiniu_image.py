import base64, json, requests
from config import QINIU_BASE_URL, QINIU_API_KEY, QINIU_IMAGE_MODEL, to_aspect_ratio

def _decode_data_url_to_bytes(data_url: str) -> bytes:
    if not data_url.startswith("data:"): raise ValueError("not a data URL")
    idx = data_url.find("base64,")
    if idx == -1: raise ValueError("no base64 payload")
    return base64.b64decode(data_url[idx+7:])

def gen_image_binary_qiniu(prompt: str, size: str = "1024x1024") -> bytes:
    if not (QINIU_BASE_URL and QINIU_API_KEY):
        return b"\x89PNG\r\n\x1a\nplaceholder"
    url = f"{QINIU_BASE_URL}/chat/completions"
    headers = {"Authorization": f"Bearer {QINIU_API_KEY}", "Content-Type": "application/json"}
    payload = {
        "model": QINIU_IMAGE_MODEL,
        "messages": [{"role": "user", "content": prompt}],
        "modalities": ["image", "text"],
        "image_config": {"aspect_ratio": to_aspect_ratio(size)},
        "stream": False
    }
    r = requests.post(url, headers=headers, json=payload, timeout=600)
    r.raise_for_status()
    j = r.json()
    images = j.get("choices",[{}])[0].get("message",{}).get("images",[])
    if not images: raise RuntimeError(f"qiniu image gen no images: {json.dumps(j)[:400]}")
    return _decode_data_url_to_bytes(images[0]["image_url"]["url"])
