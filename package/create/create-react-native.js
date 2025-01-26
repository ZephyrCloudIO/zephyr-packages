"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = create_react_native;
var prompts_1 = require("@clack/prompts");
var degit_1 = require("degit");
var picocolors_1 = require("picocolors");
var constants_1 = require("../utils/constants");
function create_react_native(options) {
    var s = (0, prompts_1.spinner)();
    s.start('Creating React Native app...');
    if (!options.path) {
        prompts_1.log.error((0, picocolors_1.bgMagentaBright)((0, picocolors_1.black)('Error:')));
        console.error('Path is required');
        (0, prompts_1.cancel)('Operation cancelled.');
        process.exit(0);
    }
    try {
        var emitter = (0, degit_1.default)(constants_1.REPACK_REPO_PATH, {
            mode: 'git'
        });
        emitter.on('warn', function (error) {
            prompts_1.log.error((0, picocolors_1.bgMagentaBright)((0, picocolors_1.black)('Error:')));
            console.error(error);
            (0, prompts_1.cancel)('Operation cancelled.');
            process.exit(0);
        });
        emitter.clone(options.path);
    }
    catch (error) {
        prompts_1.log.error((0, picocolors_1.bgMagentaBright)((0, picocolors_1.black)('Error:')));
        console.error(error);
        (0, prompts_1.cancel)('Operation cancelled.');
        process.exit(0);
    }
    s.stop("React Native app created at ".concat(options.path));
}
