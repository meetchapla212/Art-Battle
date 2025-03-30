const gulp = require('gulp');
const rollup = require('rollup');
const resolve = require('rollup-plugin-node-resolve');
const commonjs = require('rollup-plugin-commonjs');
const rollupTypescriptPlugin = require('rollup-plugin-typescript');
const tsc = require('gulp-typescript');
const naturalSort = require('gulp-natural-sort');
const sourcemaps = require('gulp-sourcemaps');

function compile(tsConfig, dest, inline) {
    let tsProject = tsc.createProject(tsConfig);

    let tsResult = tsProject.src() // instead of gulp.src(...)
        .pipe(naturalSort())
        .pipe(sourcemaps.init())
        .pipe(tsProject());

    return tsResult.js
        .pipe(inline ? sourcemaps.write() : sourcemaps.write('.')) 
        .pipe(gulp.dest(dest));
}

async function bundle(tsConfig, entry, dest) {
    const rollupBundle = await rollup.rollup({
        input: entry,
        external: [
            'jquery',
            'knockout'
        ],
        plugins: [
            resolve({
                mainFields: ['module', 'main', 'browser'],
                preferBuiltins: false
            }),
            commonjs({
                namedExports: {
                    'node_modules/bson/browser_build/bson.js': ['ObjectId']
                }
            }),
            rollupTypescriptPlugin({
                tsconfig: tsConfig
            })
        ]
    });

    await rollupBundle.write({
        sourceMap: true,
        file: dest,
        format: 'iife',
        globals: {
            jquery: 'jQuery',
            knockout: 'ko'
        }
    });
}

gulp.task('build-common', async function () {
    return compile('./client/src/Common/tsconfig.json', './dist/public/js');
});

gulp.task('build-home', async function () {
    return bundle('client/src/tsconfig.json', './client/src/Home/Home.ts', 'dist/public/js/home.js');
});

gulp.task('build-voteResults', async function () {
    return bundle('client/src/tsconfig.json', './client/src/VoteResults/VoteResults.ts', 'dist/public/js/results.js');
});

gulp.task('build-register', async function () {
    return bundle('client/src/tsconfig.json', './client/src/Register/Register.ts', 'dist/public/js/register.js');
});

gulp.task('build-voting', async function () {
    return bundle('client/src/tsconfig.json', './client/src/Voting/Voting.ts', 'dist/public/js/voting.js');
});

gulp.task('build-announcement', async function () {
    return bundle('client/src/tsconfig.json', './client/src/Announcement/Announcement.ts', 'dist/public/js/announcement.js');
});

gulp.task('build-eventList', async function () {
    return bundle('client/src/tsconfig.json', './client/src/EventList/EventList.ts', 'dist/public/js/eventList.js');
});

gulp.task('build-auction', async function () {
    return bundle('client/src/tsconfig.json', './client/src/Auction/Auction.ts', 'dist/public/js/auction.js');
});

gulp.task('build-editor', async function () {
    return bundle('client/src/tsconfig.json', './client/src/ImageEditor/Editor.ts', 'dist/public/js/image-editor.js');
});

gulp.task('build-people', async function () {
    return bundle('client/src/tsconfig.json', './client/src/People/People.ts', 'dist/public/js/people.js');
});

gulp.task('build-artistPp', async function () {
    return bundle('client/src/tsconfig.json', './client/src/ArtistPublicProfile/ArtistPublicProfile.ts', 'dist/public/js/artist_public_profile.js');
});

gulp.task('build-artistList', async function () {
    return bundle('client/src/tsconfig.json', './client/src/ArtistList/ArtistList.ts', 'dist/public/js/artist_list.js');
});

gulp.task('build-artistListV2', async function () {
    return bundle('client/src/tsconfig.json', './client/src/ArtistListV2/ArtistList.ts', 'dist/public/js/artist_list_v2.js');
});

gulp.task('build-redirect', async function () {
    return bundle('client/src/tsconfig.json', './client/src/RedirectToNative/RedirectToNative.ts', './dist/public/js/redirect-to-native.js');
});

gulp.task('build-client',  gulp.parallel(
   'build-common', 'build-home', 'build-voteResults', 'build-register',
   'build-voting', 'build-announcement', 'build-eventList', 'build-auction',
   'build-editor', 'build-people', 'build-artistPp', 'build-artistList',
   'build-artistListV2', 'build-redirect'
));

gulp.task('build-server', async function() {
    return compile('./server/src/tsconfig.json', './dist', true);
});