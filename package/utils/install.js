"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = install;
var prompts_1 = require("@clack/prompts");
var node_child_process_1 = require("node:child_process");
var picocolors_1 = require("picocolors");
function install(_a) {
    var project = _a.project;
    if (project.install) {
        var s = (0, prompts_1.spinner)();
        try {
            s.start("Installing...");
            (0, node_child_process_1.exec)("cd ".concat(project.path));
            (0, node_child_process_1.exec)("pnpm install");
            s.stop('Installed via pnpm');
        }
        catch (error) {
            prompts_1.log.error((0, picocolors_1.bgRed)((0, picocolors_1.black)('Error:')));
            console.error(error);
            (0, prompts_1.cancel)('Operation cancelled.');
            process.exit(0);
        }
    }
}
