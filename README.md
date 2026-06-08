# Personal Web Tools

一个个人 Chrome 工具箱扩展。目前包含长网页阅读锚点和网页笔记功能，后续可以继续加入更多个人常用工具。

## 快捷键

- `Alt+Shift+A`: 在当前滚动位置设置锚点
- `Alt+Shift+G`: 回到锚点，并记录跳转前的位置
- `Alt+Shift+B`: 回到跳转前的位置
- `Alt+Shift+N`: 进入添加笔记模式，然后点击网页任意位置添加笔记

快捷键可以在 `chrome://extensions/shortcuts` 里修改。

## 安装

1. 打开 `chrome://extensions/`
2. 打开右上角“开发者模式”
3. 点击“加载已解压的扩展程序”
4. 选择这个目录：`D:\workspace\private\github\personal-web-tools-extension`
5. 如果已经加载过旧版本，点击扩展卡片上的刷新按钮

## 说明

- 锚点按页面 URL 保存在当前标签页的 `sessionStorage` 中。
- 刷新同一个页面后仍可使用；关闭标签页后会清除。
- 网页笔记按页面 URL 保存在 Chrome 扩展本地存储中，打开同一页面时会自动显示。
- 可在扩展弹窗中点击“设置保存文件夹”，选择本地文件夹后，笔记会同步写入 `web-page-notes.json`。
- Chrome 内部页面、Chrome 网上应用店、部分 PDF 页面不允许内容脚本运行。

## 排查

如果快捷键没有反应：

1. 先点浏览器右上角扩展图标，打开 Personal Web Tools 弹窗，用按钮测试。
2. 打开 `chrome://extensions/shortcuts`，确认三个快捷键已经分配。
3. 修改扩展代码后，需要在 `chrome://extensions/` 点一次“重新加载”。
4. 在普通网页测试，避免 `chrome://`、Chrome 网上应用店、浏览器内置 PDF 页面。
5. 如果本地文件没有写入，打开扩展的“设置保存文件夹”，重新选择文件夹并点“立即写入文件”。
