import os
from dotenv import load_dotenv

# 最早加载 .env（固定路径，避免工作目录不同导致找不到）
load_dotenv(dotenv_path="/srv/comicgen/app/.env", override=False)

# 七牛云 OpenAI 兼容端点 & Key
QINIU_BASE_URL = os.getenv("OPENAI_BASE_URL", "https://openai.qiniu.com/v1")
QINIU_API_KEY  = os.getenv("OPENAI_API_KEY", "")

# 图像模型（七牛文档目前说明该模型支持生图）
QINIU_IMAGE_MODEL = os.getenv("QINIU_IMAGE_MODEL", "gemini-2.5-flash-image")

# 前端访问基址（给静态文件URL用）
PUBLIC_BASE_URL = os.getenv("PUBLIC_BASE_URL", "http://127.0.0.1")

# 将 1024x768 这类尺寸映射到七牛生图的 aspect_ratio
_ASPECT_MAP = {
    "1024x1024":"1:1","768x1344":"9:16","1344x768":"16:9",
    "832x1248":"2:3","1248x832":"3:2","864x1184":"3:4",
    "1184x864":"4:3","896x1152":"4:5","1152x896":"5:4"
}
def to_aspect_ratio(size: str) -> str:
    size = (size or "").lower()
    return _ASPECT_MAP.get(size, "1:1")
