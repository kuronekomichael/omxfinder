var util     = require('util');
var fs       = require('fs-extra');
var inquirer = require('inquirer');
var path     = require('path');
var _        = require('lodash');
var chalk    = require('chalk');
var omx      = require('@kuronekomihcael/omxdirector');
'use strict';

var CONFIG_FILE = '.omxfinder';

function Omxfinder() {
    if (!fs.existsSync(CONFIG_FILE)) {
        console.log('config file:', CONFIG_FILE);
        fs.writeFileSync(CONFIG_FILE, JSON.stringify({dir:['.']}));
    }
    this.config = JSON.parse(fs.readFileSync(CONFIG_FILE));
};

Omxfinder.prototype.clear = function() {
    //util.print("\u001b[2J\u001b[0;0H");
};

Omxfinder.prototype.run = function() {

    this.config.dir = this.config.dir.map(function(dir) {
        if (/^\.+$/.test(dir)) {
            dir = path.normalize(process.cwd() + '/' + dir);
        }
        return dir;
    });

    this.home();
};

Omxfinder.prototype.home = function() {
    var that = this;
    that.clear();

    var rootList = that.config.dir.map(function(dir) {
        return {
            name: 'root: ' + dir,
            value: dir
        };
    });

    // ファイルのリストを表示
    var defaultChoices = [{
        name: 'exit app',
        value: 'exit'
    }];

    inquirer.prompt([{
        name: 'whatsNext',
        type: 'list',
        message: '> What would you like to do?',
        choices: _.flatten([
            rootList,
            new inquirer.Separator(),
            defaultChoices,
            new inquirer.Separator()
            ])
        }], function (answer) {
            if (answer.whatsNext === 'exit') {
                process.exit();
                return;
            }
            var dir = answer.whatsNext;
            that.finder(dir);
        }
    );
};

Omxfinder.prototype.play = function(targetFile) {
    var that = this;
    that.clear();

    var controls = omx.isPlaying() ?
                      [{ name: '‖ pause', value: 'pause'}, { name: '> forwards',  value: 'forwards'}, { name: '< backwards',  value: 'backwards'}, { name: '■ stop',  value: 'stop'}]
                    : [{ name: '▶ play',  value: 'play'}, { name: '― cancel',  value: 'cancel'}];

    inquirer.prompt([{
        name: 'control',
        type: 'list',
        message: '> play control: ' + targetFile,
        choices: controls
        }], function (answer) {
            if (answer.control === 'pause') {
                omx.pause();
                that.play(targetFile);
            }
            if (answer.control === 'play') {
                omx.play(targetFile, {audioOutput: 'hdmi'});
                that.play(targetFile);
            }
            if (answer.control === 'forwards') {
                omx.forwards();
                that.play(targetFile);
            }
            if (answer.control === 'backwards') {
                omx.backwards();
                that.play(targetFile);
            }
            if (answer.control === 'stop') {
                omx.stop();
                that.finder(path.dirname(targetFile));
            }
            if (answer.control === 'cancel') {
                that.finder(path.dirname(targetFile));
            }
        }
    );
};

Omxfinder.prototype.playAll = function(targetDir, files, isRepeat) {
    var that = this;
    that.clear();

    var controls = omx.isPlaying() ?
                      [{ name: '‖ pause', value: 'pause'}, { name: '■ stop',  value: 'stop'}, { name: '》 skip',  value: 'skip'}]
                    : [{ name: '▶ play',  value: 'play'}, { name: '― cancel',  value: 'cancel'}];

    inquirer.prompt([{
        name: 'control',
        type: 'list',
        message: '> play control <playlist>: ' + targetDir,
        choices: controls
    }], function (answer) {
        if (answer.control === 'pause') {
            omx.pause();
            that.playAll(targetDir, files, isRepeat);
        }
        if (answer.control === 'skip') {
            omx.skip();
            that.playAll(targetDir, files, isRepeat);
        }
        if (answer.control === 'play') {
            omx.play(files, {audioOutput: 'hdmi', loop: isRepeat});
            that.playAll(targetDir, files, isRepeat);
        }
        if (answer.control === 'stop') {
            omx.stop();
            that.finder(targetDir);
        }
        if (answer.control === 'cancel') {
            that.finder(targetDir);
        }
    });
};

var normalizePath = function(targetPath) {
    return targetPath.split(path.sep).filter(function(node){ return !!node; }).join(path.sep);
}

Omxfinder.prototype.finder = function(targetDir) {
    var that = this;
    that.clear();

    var defaults = [
        {
            name: chalk.white.bgCyan.bold('..'),
            value: {
                type: 'back',
                fullpath: path.normalize(targetDir + '/..')
            }
        }
    ];

    var control = [
        {
            name: chalk.white.bgCyan.bold('play all'),
            value: {
                type: 'play-all',
                fullpath: path.normalize(targetDir)
            }
        },
        {
            name: chalk.white.bgCyan.bold('play all(repeat)'),
            value: {
                type: 'play-all-repeat',
                fullpath: path.normalize(targetDir)
            }
        }
    ];

    var files = [], dirs = [];
    fs.readdirSync(targetDir).forEach(function(file) {
        if (/^\./.test(file)) {
            return;
        }
        var fullpath = path.join(targetDir, file);
        var stats = fs.statSync(fullpath);
        if (stats.isFile()) {
            if (!/\.(wmv|mp4|m4v|avi|mkv|mov)$/.test(file)) {
                return;
            }
            files.push({
                name: file,
                value: {
                    type: 'file',
                    fullpath: fullpath
                }
            });
        } else if (stats.isDirectory()) {
            dirs.push({
                name: chalk.white.bgCyan.bold(file),
                value: {
                    type: 'dir',
                    fullpath: fullpath
                }
            });
        }
    });

    inquirer.prompt([{
        name: 'finder',
        type: 'list',
        message: '> File Explorer: ' + targetDir,
        choices: _.flatten([
            defaults,
            files,
            dirs,
            new inquirer.Separator(),
            control,
            new inquirer.Separator()
            ])
        }], function (answer) {
            if (answer.finder.type === 'file') {
                that.play(answer.finder.fullpath);
            }
            if (answer.finder.type === 'dir') {
                that.finder(answer.finder.fullpath);
            }
            if (answer.finder.type === 'back') {
                var nextPath = normalizePath(answer.finder.fullpath);
                var rootPath = normalizePath(targetDir);

                if (that.config.dir.some(function(dir){ return normalizePath(dir) === rootPath }) ||
                    that.config.dir.some(function(dir){ return normalizePath(dir) === nextPath })
                ) {
                    that.home();
                } else {
                    that.finder(answer.finder.fullpath);
                }
            }
            if (answer.finder.type === 'play-all' || answer.finder.type === 'play-all-repeat') {
                that.playAll(targetDir, files.map(function(f) { return f.value.fullpath }), answer.finder.type === 'play-all-repeat');
            }
        }
    );
};

module.exports = Omxfinder;
