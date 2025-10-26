import json
from fastapi import FastAPI
from pydantic import BaseModel
from dotenv import load_dotenv

from storage_local import save_bytes
from qiniu_image import gen_image_binary_qiniu
from qiniu_llm import gen_storyboard_json_qiniu

load_dotenv()
app = FastAPI()

@app.get("/healthz")
def healthz(): return {"ok": True}

class ImageReq(BaseModel):
    prompt: str
    size: str = "1024x1024"

@app.post("/image")
def image(req: ImageReq):
    data = gen_image_binary_qiniu(req.prompt, req.size)
    return save_bytes(data, "png")

class StoryReq(BaseModel):
    text: str
    style: str = "黑白线稿"

@app.post("/storyboard")
def storyboard(req: StoryReq):
    j = gen_storyboard_json_qiniu(req.text, req.style)
    return {"storyboard_json": j}

class RenderReq(BaseModel):
    # 传入上一步 /storyboard 返回的字符串或对象都可以
    storyboard_json: str | dict
    size: str = "1024x1024"
    prompt_prefix: str = ""   # 可选：给每格加点统一画风提示，例如 "manga, dramatic lighting"

@app.post("/render")
def render(req: RenderReq):
    # 1) 解析分镜 JSON
    sb = req.storyboard_json
    if isinstance(sb, str):
        sb = json.loads(sb)

    # 2) 遍历每页每格生成图片
    urls = []
    for page in sb.get("pages", []):
        for panel in page.get("panels", []):
            desc = panel.get("desc") or ""
            # 组合提示词：全局前缀 + 单格描述
            prompt = (req.prompt_prefix + " " + desc).strip()
            data = gen_image_binary_qiniu(prompt, req.size)
            obj = save_bytes(data, "png")
            panel["image_url"] = obj["url"]
            urls.append(obj["url"])

    # 3) 返回带图 JSON
    return {
        "storyboard_json": json.dumps(sb, ensure_ascii=False),
        "images": urls
    }
