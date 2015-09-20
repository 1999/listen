/**
 * @description build config from settings and other data
 */
'use strict';

let child_process = require('child_process');
let fs = require('fs');
let path = require('path');
let yargs = require('yargs');

let useReleaseTweaks = Boolean(yargs.argv.tweakmap);

const SRC_PATH = path.resolve(__dirname, '..', 'src');
const OUT_PATH = path.resolve(__dirname, '..', 'out');
const BUILD_PATH = path.resolve(__dirname, '..', 'build');

function getAppRevision() {
    return child_process.execSync('git rev-parse --verify HEAD').toString().substr(0, 10);
}

function readJSONWithComments(filePath) {
    var contents = fs.readFileSync(filePath, {encoding: 'utf8'});
    contents = contents.replace(/\/\*.+\*\//g, '');

    return JSON.parse(contents);
}

function buildConfig() {
    let tweakMap = useReleaseTweaks ? readJSONWithComments(yargs.argv.tweakmap) : {};
    let settings = readJSONWithComments(BUILD_PATH + '/settings.json')
    let constants = readJSONWithComments(BUILD_PATH + '/constants.json');

    let configChunks = {
        default_settings_local: Object.assign(settings.local, tweakMap.default_settings_local),
        default_settings_sync: Object.assign(settings.sync, tweakMap.default_settings_sync),
        constants: Object.assign(constants, tweakMap.constants),
        buildInfo: {
            revision: getAppRevision(),
            date: Math.round(Date.now() / 1000)
        }
    };

    return 'Config = ' + JSON.stringify(configChunks, null, '    ');
}

let jsConfig = buildConfig();
let outputFilePath = useReleaseTweaks ? OUT_PATH + '/config.js' : SRC_PATH + '/config.js';
fs.writeFileSync(outputFilePath, jsConfig);
