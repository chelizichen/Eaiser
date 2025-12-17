# EAISER

## BUILD

### Macos Darwin

目前只支持 Macos ARM 芯片部署，其他端的可以尝试编译下，理论上 Windows 也支持所有功能

node >= 16
wails = 2.11.0
go >= 1.24.2

````sh
cd frontend
npm run build

cd ..
wails build -platform darwin
open build/bin/Eaiser.app
````

## FEATURE

1. 原生本地部署，数据库采用SQlite
2. 图片直接粘贴成 Base64，存入数据库
3. 支持分屏文档，Markdown 支持良好
4. 可以对目录加密，支持 Macos 指纹识别认证
