#!/usr/bin/env node
"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
var promises_1 = require("node:timers/promises");
var prompts_1 = require("@clack/prompts");
var picocolors_1 = require("picocolors");
var constants_1 = require("./utils/constants");
var create_1 = require("./create/create");
var end_1 = require("./utils/end");
function main() {
    return __awaiter(this, void 0, void 0, function () {
        var project;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    console.clear();
                    return [4 /*yield*/, (0, promises_1.setTimeout)(1000)];
                case 1:
                    _a.sent();
                    (0, prompts_1.updateSettings)({
                        aliases: {
                            w: 'up',
                            s: 'down',
                            a: 'left',
                            d: 'right',
                        },
                    });
                    (0, prompts_1.note)('npx create-zephyr-apps@latest');
                    (0, prompts_1.intro)("".concat((0, picocolors_1.bgCyan)((0, picocolors_1.black)(' Create federated applications with Zephyr '))));
                    return [4 /*yield*/, (0, prompts_1.group)({
                            path: function (_a) {
                                var results = _a.results;
                                return (0, prompts_1.text)({
                                    message: 'Where should we create your project?',
                                    placeholder: './sparkling-solid',
                                    validate: function (value) {
                                        if (!value)
                                            return 'Please enter a path.';
                                        if (value[0] !== '.')
                                            return 'Please enter a relative path.';
                                    },
                                });
                            },
                            type: function () {
                                return (0, prompts_1.select)({
                                    message: 'What type of project you are creating?',
                                    initialValue: 'web',
                                    options: [
                                        {
                                            value: 'web',
                                            label: 'Web',
                                        },
                                        {
                                            value: 'react-native',
                                            label: 'React Native',
                                            hint: 'You will be building React Native powered by Re.Pack.',
                                        },
                                    ],
                                });
                            },
                            templates: function (_a) {
                                var results = _a.results;
                                if (results.type === 'web') {
                                    return (0, prompts_1.select)({
                                        message: 'Pick a template: ',
                                        initialValue: 'react-rspack-mf',
                                        maxItems: 5,
                                        options: Object.keys(constants_1.TEMPLATES).map(function (template) {
                                            return {
                                                value: template,
                                                label: (0, picocolors_1.cyan)(constants_1.TEMPLATES[template].label),
                                                hint: constants_1.TEMPLATES[template].hint
                                            };
                                        })
                                    });
                                }
                            },
                            install: function (_a) {
                                var results = _a.results;
                                return (0, prompts_1.confirm)({
                                    message: 'Install dependencies?',
                                    initialValue: false,
                                });
                            },
                        }, {
                            onCancel: function () {
                                (0, prompts_1.cancel)('Operation cancelled.');
                                process.exit(0);
                            },
                        })];
                case 2:
                    project = _a.sent();
                    return [4 /*yield*/, (0, create_1.default)(project).then(function (i) { return (0, end_1.default)({ project: project }); })];
                case 3:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    });
}
main().catch(console.error);
