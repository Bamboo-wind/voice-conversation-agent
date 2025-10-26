本包包含：
- 后端：/srv/comicgen/app（含 .env）
- 前端：/srv/comicgen/public/web
- 服务：/etc/systemd/system/comicgen.service
- Nginx：/etc/nginx/nginx.conf、sites-available、sites-enabled
- Python 依赖快照：requirements-freeze.txt

敏感信息：
- app/.env 内含 OPENAI_API_KEY（七牛 Token），请勿外泄。
