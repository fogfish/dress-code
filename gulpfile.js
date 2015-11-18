'use strict';

// modules
var path = require('path');
var assemble = require('fabricator-assemble');
var browserSync = require('browser-sync');
var csso = require('gulp-csso');
var del = require('del');
var gutil = require('gulp-util');
var gulpif = require('gulp-if');
var imagemin = require('gulp-imagemin');
var prefix = require('gulp-autoprefixer');
var rename = require('gulp-rename');
var replace = require('gulp-replace');
var reload = browserSync.reload;
var runSequence = require('run-sequence');
var sass = require('gulp-sass');
var sourcemaps = require('gulp-sourcemaps');
var webpack = require('webpack');
var gulp = require('gulp');
var ghPages = require('gulp-gh-pages');
var gulpFilter = require('gulp-filter');
var gulpDebug = require('gulp-debug');
var iconfont = require('gulp-iconfont');
var iconfontCss = require('gulp-iconfont-css');
var pkg = require('./package.json');

// configuration
var config = {
    pkg: pkg,
    path: {
        styles: {
            toolkit: './src/styles/'
        }
    },
    src: {
        scripts: {
            fabricator: './docs/demo/assets/fabricator/scripts/fabricator.js'
        },
        styles: {
            fabricator: './docs/demo/assets/fabricator/styles/fabricator.scss',
            toolkit: './src/styles/toolkit.scss'
        },
        images: 'src/img/**/*',
        icons: 'src/icons/*.svg'

    },
    dist: 'dist',
    tmp: {
        tmp: '.tmp',
        demo: '.tmp/.demo',
        deployDemo: '.tmp/.deploy-demo',
        distBower: '.tmp/.dist-bower',
        deployBower: '.tmp/.deploy-bower',
        iconfont: '.tmp/.iconfont'
    }
};


/**
 *
 *
 *
 *  DEMO/DEVELOPMENT TASKS
 *
 *
 *
 */

// webpack
var demoWebpackConfig = require('./webpack.demo.config')(config);
var demoWebpackCompiler = webpack(demoWebpackConfig);

gulp.task('demo', function(cb) {
	runSequence('demo:clean',['demo:styles', 'demo:scripts', 'demo:images', 'demo:icons', 'demo:assemble'], cb)
});

// clean
gulp.task('demo:clean', function (cb) {
    del([config.tmp.demo], cb);
});

// styles
gulp.task('demo:styles:fabricator', function () {
    gulp.src(config.src.styles.fabricator)
        .pipe(sourcemaps.init())
        .pipe(sass().on('error', sass.logError))
        .pipe(prefix('last 1 version'))
        .pipe(rename('f.css'))
        .pipe(sourcemaps.write())
        .pipe(gulp.dest(path.join(config.tmp.demo, '/assets/fabricator/styles')))
        .pipe(reload({stream: true}));
});

gulp.task('demo:styles:toolkit', function () {
    gulp.src(config.src.styles.toolkit)
        .pipe(sourcemaps.init())
        .pipe(sass().on('error', sass.logError))
        .pipe(prefix('last 1 version'))
        .pipe(sourcemaps.write())
        .pipe(gulp.dest(path.join(config.tmp.demo, '/assets/toolkit/styles')))
        .pipe(reload({stream: true}));
});

gulp.task('demo:styles', ['demo:styles:fabricator', 'demo:styles:toolkit']);


// scripts
gulp.task('demo:scripts', function (done) {
    demoWebpackCompiler.run(function (error, result) {
        if (error) {
            gutil.log(gutil.colors.red(error));
        }
        result = result.toJson();
        if (result.errors.length) {
            result.errors.forEach(function (error) {
                gutil.log(gutil.colors.red(error));
            });
        }
        done();
    });
});


// images
gulp.task('demo:images', ['demo:favicon'], function () {
    return gulp.src(config.src.images)
        .pipe(imagemin())
        .pipe(gulp.dest(path.join(config.tmp.demo, '/assets/toolkit/img')));
});

// Generate the font by using what is found in the src/icons folder
// Generate the scss _generated/icons.scss to use icons as classes
gulp.task('demo:icons', ['demo:icons:clean'], function () {
    var runTimestamp = Math.round(Date.now()/1000);
    var fontName = 'DressCodeIcons';

    return gulp.src(config.src.icons)
        .pipe(gulp.dest(path.join(config.tmp.iconfont, '/svg-icons')))
        .pipe(iconfontCss({
            fontName: fontName,
            path: 'scss',
            targetPath: '../../../src/styles/_generated/_font-icon.scss', // this path to path.join(config.tmp.iconfont, '/fonts') ... weird
            fontPath: '../fonts/',
            cssClass: 'dc-font-icon'
        }))
        .pipe(iconfont({
            fontName: fontName, // required
            formats: ['ttf', 'eot', 'woff','svg','woof2'],
            timestamp: runTimestamp, // recommended to get consistent builds when watching files,
            normalize: true,
            centerHorizontally: true
        }))
        .pipe(gulp.dest(path.join(config.tmp.iconfont, '/fonts')))
        .pipe(gulp.dest(path.join(config.tmp.demo, '/assets/toolkit/fonts')))
});

gulp.task('demo:icons:clean', function (cb) {
    del([config.tmp.iconfont], cb);
});

gulp.task('demo:favicon', function () {
    return gulp.src('./docs/demo/favicon.ico')
        .pipe(gulp.dest(config.tmp.demo));
});


// assemble
gulp.task('demo:assemble', function (done) {
    assemble({
        layouts: 'docs/demo/views/layouts/*',
        layoutIncludes: 'docs/demo/views/layouts/includes/*',
        views: ['docs/demo/views/**/*', '!docs/demo/views/+(layouts)/**'],
        materials: 'docs/demo/materials/**/*',
        data: 'docs/demo/data/**/*.{json,yml}',
        docs: ['docs/**/*.md', '!docs/BOWER-README.md'],
        logErrors: true,
        dest: config.tmp.demo
    });
    done();
});


// server
gulp.task('demo:serve', function () {

    browserSync({
        server: {
            baseDir: config.tmp.demo
        },
        notify: false,
        logPrefix: 'FABRICATOR'
    });

    /**
     * Because webpackCompiler.watch() isn't being used
     * manually remove the changed file path from the cache
     */
    function webpackCache(e) {
        var keys = Object.keys(demoWebpackConfig.cache);
        var key, matchedKey;
        for (var keyIndex = 0; keyIndex < keys.length; keyIndex++) {
            key = keys[keyIndex];
            if (key.indexOf(e.path) !== -1) {
                matchedKey = key;
                break;
            }
        }
        if (matchedKey) {
            delete demoWebpackConfig.cache[matchedKey];
        }
    }

    gulp.task('demo:assemble:watch', ['demo:assemble'], reload);
    gulp.watch('docs/{demo,guides}/**/*.{html,md,json,yml}', ['demo:assemble:watch']);

    gulp.task('demo:styles:fabricator:watch', ['demo:styles:fabricator']);
    gulp.watch('docs/demo/assets/fabricator/styles/**/*.scss', ['demo:styles:fabricator:watch']);

    gulp.task('demo:styles:toolkit:watch', ['demo:styles:toolkit']);
    gulp.watch('src/styles/**/*.scss', ['demo:styles:toolkit:watch']);

    gulp.task('demo:scripts:watch', ['demo:scripts'], reload);
    gulp.watch('docs/demo/assets/fabricator/scripts/**/*.js', ['demo:scripts:watch']).on('change', webpackCache);

    gulp.task('demo:images:watch', ['demo:images'], reload);
    gulp.watch(config.src.images, ['demo:images:watch']);

    gulp.watch(config.src.icons, ['demo:icons']);

});

gulp.task('demo:deploy', ['demo'], function () {
    return gulp.src(path.join(config.tmp.demo, '/**/*'))
        .pipe(ghPages({
            cacheDir: config.tmp.deployDemo,
            remoteUrl: 'https://github.com/zalando/brand-solutions-dress-code.git'
        }));
});


/**
 *
 *
 *
 *  DISTRIBUTION TASKS
 *
 *
 *
 */

gulp.task('dist', function (cb) {
    runSequence('dist:clean', ['dist:styles', 'dist:styles:src', 'dist:images', 'dist:icons'], cb);
});

gulp.task('dist:clean', function (cb) {
    del([config.dist], cb);
});

gulp.task('dist:styles', function () {
    return gulp.src(config.src.styles.toolkit)
        .pipe(sass().on('error', sass.logError))
        .pipe(sourcemaps.init())
        .pipe(prefix('last 1 version'))
        .pipe(sourcemaps.write())
        .pipe(rename(pkg.name + '.css'))
        .pipe(gulp.dest(path.join(config.dist, 'css')))
        // minified
        .pipe(rename(pkg.name + '.min.css'))
        .pipe(csso())
        .pipe(gulp.dest(path.join(config.dist, 'css')));
});

gulp.task('dist:styles:src', function () {
    return gulp.src(path.join(config.path.styles.toolkit, '/**/*'))
        .pipe(gulp.dest(path.join(config.dist, 'sass')));
});


gulp.task('dist:images', function () {
    return gulp.src(config.src.images)
        .pipe(imagemin())
        .pipe(gulp.dest(path.join(config.dist, '/img')));
});

gulp.task('dist:icons', ['demo:icons'], function () {
    return gulp.src(path.join(config.tmp.iconfont, '/fonts/**'))
        .pipe(gulp.dest(path.join(config.dist, '/fonts')));
});

gulp.task('dist:bower:clean', function (cb) {
    del([config.tmp.distBower], cb);
});


gulp.task('dist:bower', ['dist:bower:clean', 'dist'], function () {
    var bowerReadmeFilter = gulpFilter(['BOWER-README.md'], {restore: true});
    var importFilter = gulpFilter(['**/sass/_import.scss', '**/sass/_base.scss'], {restore: true})

    return gulp.src([
        path.join(config.dist, '/**/*'),
        'bower.json',
        'LICENSE',
        'docs/BOWER-README.md',
        '.editorconfig'
    ])
        .pipe(bowerReadmeFilter)
        .pipe(rename('README.md'))
        .pipe(gulp.dest(config.tmp.distBower))
        .pipe(bowerReadmeFilter.restore)
        .pipe(importFilter)
        .pipe(replace(/@import "..\/..\/node_modules\/(.*)"/g, function (match, p1) {
            if (p1.indexOf('breakpoint-sass') > -1) {
                return '@import "../../compass-breakpoint/stylesheets/breakpoint"';
            } else {
                return '@import "../../' + p1 + '"';
            }
        }))
        .pipe(importFilter.restore)
        .pipe(gulp.dest(config.tmp.distBower));
});

gulp.task('dist:bower:deploy', ['dist:bower'], function () {
    return gulp.src(path.join(config.tmp.distBower, '/**/*'))
        .pipe(ghPages({
            cacheDir: config.tmp.deployBower,
            branch: 'master',
            remoteUrl: 'git@github.com:zalando/brand-solutions-dress-code-bower'
        }));
});


/**
 *
 *
 *
 * DEFAULT TASK
 *
 *
 *
 */
gulp.task('default', function () {
    // run demo
    runSequence('demo', function () {
        gulp.start('demo:serve');
    });
});