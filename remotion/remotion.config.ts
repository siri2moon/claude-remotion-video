import { Config } from '@remotion/cli/config';

Config.setVideoImageFormat('jpeg');
Config.setOverwriteOutput(true);

// publicDir KHÔNG set ở đây — nó phụ thuộc cwd nên dễ sai.
// Cả studio lẫn render đều truyền --public-dir=../content một cách tường minh
// (xem package.json scripts và .claude/skills/tiktok-video/scripts/render.mjs).
