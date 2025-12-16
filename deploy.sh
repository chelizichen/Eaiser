#!/bin/bash

# 构建前端
cd frontend
npm run build

cd ..
wails build -platform darwin
open build/bin/Eaiser.app


# 构建应用