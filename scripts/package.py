"""Build a user-installable archive after npm run build (Python 3 standard library)."""
import json
from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED
root = Path(__file__).resolve().parent.parent
extension = root / 'extension'
version = json.loads((extension / 'manifest.json').read_text())['version']
for required in ['vendor/pdf.mjs', 'vendor/pdf.worker.mjs', 'vendor/PDFJS-LICENSE']:
    if not (extension / required).is_file():
        raise SystemExit('Missing bundled PDF resources. Run npm run build first.')
out = root / 'dist' / f'minimal-translate-v{version}.zip'
out.parent.mkdir(exist_ok=True)
with ZipFile(out, 'w', ZIP_DEFLATED) as archive:
    for path in sorted(extension.rglob('*')):
        if path.is_file() and not any(part.startswith('.') for part in path.relative_to(extension).parts):
            archive.write(path, 'minimal-translate/extension/' + path.relative_to(extension).as_posix())
    archive.writestr('minimal-translate/安装说明.txt', '''简译安装说明

1. 解压整个压缩包，并将文件夹保存在固定位置（使用期间不要删除或移动）。
2. 打开 Chrome 的 chrome://extensions/ 或 Edge 的 edge://extensions/。
3. 开启“开发者模式”，点击“加载已解压的扩展程序”。
4. 选择本文件旁边的 extension 文件夹。
5. 点击浏览器工具栏的扩展图标，打开简译，选择“连接模型，开始使用”。
6. 填写接口地址、模型名、API Key，点击“保存并测试连接”并按提示授权。
7. 返回文章，点击简译的“翻译此页 / 隐藏译文”。

不需要安装 Node.js、npm 或运行构建命令。
项目与问题反馈：https://github.com/lc-beep/minimal-translate
''')
with ZipFile(out) as archive:
    assert archive.testzip() is None
    assert 'minimal-translate/extension/manifest.json' in archive.namelist()
print(out)
