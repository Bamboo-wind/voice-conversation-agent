import time, uuid
from pathlib import Path
from config import PUBLIC_BASE_URL

ROOT = Path("/srv/comicgen/public/outputs")

def save_bytes(data: bytes, suffix="png"):
    day = time.strftime("%Y/%m/%d")
    folder = ROOT / day
    folder.mkdir(parents=True, exist_ok=True)
    name = f"{uuid.uuid4().hex}.{suffix}"
    path = folder / name
    with open(path, "wb") as f:
        f.write(data)
    url = f"{PUBLIC_BASE_URL}/outputs/{day}/{name}"
    return {"path": str(path), "url": url}
