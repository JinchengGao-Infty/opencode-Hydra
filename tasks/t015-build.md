# t015: 构建系统修复

## 目标

修复 opencode 构建问题，确保能成功编译出可执行文件。

## 背景

之前尝试构建时失败了，需要排查并修复构建流程。

## 任务

1. **分析构建配置**
   - 检查 `package.json` 中的 build 脚本
   - 检查 `tsconfig.json` 配置
   - 检查 `bun.build` 或其他构建工具配置

2. **修复构建问题**
   - 排查编译错误
   - 修复类型错误
   - 解决依赖问题

3. **验证构建**
   - 运行 `bun run build` 或相应构建命令
   - 确保生成可执行文件
   - 测试生成的二进制文件能正常运行

## 验收标准

- [ ] `bun run build` 成功完成
- [ ] 生成的可执行文件能运行 `opencode --version`
- [ ] Hydra 相关命令能正常工作：`opencode hydra status`

## 参考

- 查看 `packages/opencode/package.json` 中的 scripts
- 查看现有的构建脚本和配置
- 参考 opencode 原版的构建流程
