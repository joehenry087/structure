var gulp = require('gulp');
var fs = require('fs');
var pump = require('pump');
var childProcess = require('child_process');

var clean = require('gulp-clean');
var concat = require('gulp-concat');
var less = require('gulp-less');
var livereload = require('gulp-livereload');
var noop = require('gulp-noop');
var notify = require('gulp-notify');
var sourcemaps = require('gulp-sourcemaps');
var uglify = require('gulp-uglify');

var config = require('./config.json');

var source = 'source';
var out = '_package';

var appFiles = ['config.json', 'package.json', 'Dockerfile'];

var notification = function(title, message) {
    return config.app.environment == 'dev' ? notify({
        title: title,
        message: message
    }) : noop()
};

var reload = function() {
    return config.app.environment == 'dev' ? livereload() : noop();
}

/*----------  Cleanup  ----------*/

    gulp.task('clean-dest', function(cb) {
        pump([
            gulp.src(out, {read: false}),
            clean()
        ], cb);
    });

/*----------  App Files  ----------*/

    gulp.task('app-files', function(cb) {
        var time = new Date().getTime();
        pump([
            gulp.src(appFiles),
            gulp.dest(out),
            notification('App files built', 'Took ' + (new Date().getTime() - time)/1000 + ' seconds')
        ], cb);
    });

/*----------  Server  ----------*/

    gulp.task('clean-server', function(cb) {
        try {
            var excludes = appFiles.reduce(function(str, file) {
                return str + ' ! -path "' + out + '/' + file + '"';
            }, '');
            childProcess.execSync('find ' + out + ' -maxdepth 1 -type f' + excludes + ' -delete');
        } catch(e) {
        }
        cb();
    });

    gulp.task('build-server', ['clean-server'], function(cb) {
        var time = new Date().getTime();
        pump([
            gulp.src(source + '/server/**'),
            gulp.dest(out),
            notification('Server built', 'Took ' + (new Date().getTime() - time)/1000 + ' seconds')
        ], cb);
    });

    var node;
    gulp.task('start-server', ['build-server'], function() {
        if (node) {
            node.kill()
        }
        node = childProcess.spawn('docker-compose', ['up'], {stdio: 'inherit'})
        node.on('close', function (code) {
            if (code === 8) {
                gulp.log('Error detected, waiting for changes...');
            }
        });
    });
    // Clean up if an error goes unhandled.
    process.on('exit', function() {
        if (node) {
            node.kill()
        }
    });

/*----------  Root Files  ----------*/

    gulp.task('clean-root', function(cb) {
        try {
            childProcess.execSync('find ' + out + '/frontend -maxdepth 1 -type f -delete');
        } catch(e) {
        }
        cb();
    });

    gulp.task('root', ['clean-root'], function(cb) {
        var time = new Date().getTime();
        pump([
            gulp.src(source + '/root/*'),
            gulp.dest(out + '/frontend'),
            reload(),
            notification('Root files compiled', 'Took ' + (new Date().getTime() - time)/1000 + ' seconds')
        ], cb);
    });

/*----------  CSS  ----------*/

    gulp.task ('clean-css', function(cb) {
        pump([
            gulp.src(out + '/frontend/css', {read: false}),
            clean()
        ], cb);
    });

    gulp.task('css', ['clean-css'], function(cb) {
        var time = new Date().getTime();
        pump([
            gulp.src([source + '/less/index.less']),
            less(),
            gulp.dest(out + '/frontend/css'),
            reload(),
            notification('CSS compiled', 'Took ' + (new Date().getTime() - time)/1000 + ' seconds')
        ], cb);
    });

/*----------  JS  ----------*/

    var compileJs = function(name) {
        return function(cb) {
            var time = new Date().getTime();
            var sources = JSON.parse(fs.readFileSync('sources.json', 'utf8'))[name];
            pump([
                gulp.src(sources),
                sourcemaps.init(),
                concat(name + '.js'),
                config.app.environment === 'prod' ? uglify({
                    ie8: false,
                    mangle: true,
                    compress: {
                        sequences: true,
                        dead_code: true,
                        conditionals: true,
                        booleans: true,
                        unused: true,
                        if_return: true,
                        join_vars: true,
                        drop_console: true
                    },
                    output: {
                        beautify: false,
                        preamble: "// Copyright FitCrunch, LLC"
                    }
                }) : noop(),
                sourcemaps.write(),
                gulp.dest(out + '/frontend/js'),
                reload(),
                notification(name + ' JS compiled', 'Took ' + (new Date().getTime() - time)/1000 + ' seconds')
            ], cb);
        };
    };

    gulp.task('mobile-js', compileJs('mobile'));

    gulp.task('desktop-js', compileJs('desktop'));

    gulp.task('landing-js', function() {

    });

    gulp.task('js', function() {

    });

/*----------  Fonts & Images  ----------*/

    gulp.task ('clean-fonts', function(cb) {
        pump([
            gulp.src(out + '/frontend/fonts', {read: false}),
            clean()
        ], cb);
    });

    gulp.task('fonts', ['clean-fonts'], function() {
        var time = new Date().getTime();
        pump([
            gulp.src(source + '/fonts/**'),
            gulp.dest(out + '/frontend/fonts'),
            reload(),
            notification('Fonts built', 'Took ' + (new Date().getTime() - time)/1000 + ' seconds')
        ])
    });

    gulp.task ('clean-images', function(cb) {
        pump([
            gulp.src(out + '/frontend/images', {read: false}),
            clean()
        ], cb);
    });

    gulp.task('images', ['clean-images'], function() {
        var time = new Date().getTime();
        pump([
            gulp.src(source + '/images/**'),
            gulp.dest(out + '/frontend/images'),
            reload(),
            notification('Images built', 'Took ' + (new Date().getTime() - time)/1000 + ' seconds')
        ])
    });

/*----------  Build  ----------*/

// Launch development setup
gulp.task('default', ['root', 'css', 'desktop-js', 'fonts', 'images', 'app-files', 'start-server'], function() {
    config.app.environment == 'dev' ? livereload.listen() : null;

    // Watch root
    gulp.watch(source + '/root/**', ['root']);

    // Watch LESS
    gulp.watch(source + '/less/**', ['css']);

    // Watch JS
    gulp.watch('sources.json', ['desktop-js']);
    gulp.watch(source + '/js/**', ['desktop-js']);

    // Watch Fonts
    gulp.watch(source + '/fonts/**', ['fonts']);

    // Watch Images
    gulp.watch(source + '/images/**', ['images']);

    // Watch Build Files
    gulp.watch(appFiles, ['app-files'])
    
    // Watch Server
    gulp.watch(source + '/server/**', ['start-server']);
});

gulp.task('build', ['root', 'css', 'desktop-js', 'fonts', 'images', 'app-files', 'build-server']);