import json
from openai import OpenAI
from config import QINIU_BASE_URL, QINIU_API_KEY

SYSTEM = (
    "你是专业漫画分镜师。将输入的中文小说片段拆成漫画分镜JSON。"
    "仅输出JSON：{characters:[], pages:[{layout:'2x2'|'3x3'|..., panels:[{id,desc,dialog:[{speaker,text}]}]}]}"
    "每页<=6格，每格对白<=40字，desc 为一句中文描述。"
)

def _extract_json(txt: str):
    i, j = txt.find("{"), txt.rfind("}")
    if i >= 0 and j > i:
        try:
            return json.loads(txt[i:j+1])
        except Exception:
            pass
    return {"characters": [], "pages": []}

def gen_storyboard_json_qiniu(text: str, style: str) -> str:
    if not QINIU_API_KEY:
        # 没配置 Key 时返回占位，确保链路可用
        return json.dumps({"characters": [], "pages": []}, ensure_ascii=False)

    # 注意：每次调用时根据当前 env 创建 client，避免 import 时机导致拿不到 .env
    client = OpenAI(base_url=QINIU_BASE_URL, api_key=QINIU_API_KEY)

    rsp = client.chat.completions.create(
        model="deepseek-v3",
        messages=[
            {"role":"system","content":SYSTEM},
            {"role":"user","content": f"画风：{style}\n小说：<<<{text}>>>\n只输出JSON，不要解释。"}
        ],
        response_format={"type": "json_object"},  # 强制 JSON
        stream=False,
        max_tokens=4096,
        temperature=0.3,
    )
    content = rsp.choices[0].message.content or ""
    data = _extract_json(content)
    return json.dumps(data, ensure_ascii=False)
