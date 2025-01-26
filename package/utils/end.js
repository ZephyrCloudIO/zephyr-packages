"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = end_note;
var picocolors_1 = require("picocolors");
var prompts_1 = require("@clack/prompts");
function end_note(_a) {
    var project = _a.project;
    var next_steps = "cd ".concat(project.path, "        \n").concat(project.install ? '' : 'pnpm install\n', "git init\nCreate a new git repo and push your code to it\nnpm run build");
    (0, prompts_1.note)(next_steps, 'Next steps.');
    var end_notes = ["Discord: ".concat((0, picocolors_1.underline)((0, picocolors_1.cyan)('https://zephyr-cloud.io/discord'))), "Documentation: ".concat((0, picocolors_1.underline)((0, picocolors_1.cyan)('https://zephyr-cloud.io/docs'))), "Open an issue: ".concat((0, picocolors_1.underline)((0, picocolors_1.cyan)('https://github.com/ZephyrCloudIO/create-zephyr-apps/issues')))
    ];
    (0, prompts_1.note)(Object.values(end_notes).join('\n'), 'Problems?');
}
