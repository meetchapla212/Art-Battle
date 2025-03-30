"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * The tracer should be imported first
 */
require("./tracer");
/**
 * Module dependencies.
 */
const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const compression = require("compression"); // compresses requests
const session = require("express-session");
const morgan = require("morgan");
const dotenv = require("dotenv");
/**
 * Load environment variables from .env file, where API keys and passwords are configured.
 */
const path = require("path");
dotenv.config({ path: path.join(__dirname, '.env') });
const logger_1 = require("./config/logger");
// @ts-ignore
const lusca = require("lusca");
const mongo = require("connect-mongo");
const flash = require("express-flash");
const mongoose = require("mongoose");
const passport = require("passport");
const socketio = require("socket.io");
const http = require("http");
// @ts-ignore
require('./common/ArrayExtensions');
require('./common/StringExtensions');
const MongoStore = mongo(session);
/**
 * Controllers (route handlers).
 */
const homeController = require("./controllers/home");
const userController = require("./controllers/user");
const contactController = require("./controllers/contact");
const eventController = require("./controllers/event");
const registrationController = require("./controllers/register");
const resultsController = require("./controllers/results");
const galleryController = require("./controllers/gallery");
const vrController = require("./controllers/vr");
const auctionController = require("./controllers/auction");
const promotionController = require("./controllers/promotion");
const promotionPhoneNUmberController = require("./controllers/promotionPhoneNumber");
const artistController = require("./controllers/artist");
/**
 * API keys and Passport configuration.
 */
const passportConfig = require("./config/passport");
const express_1 = require("express");
const passport_1 = require("./config/passport");
const ImageEditor_1 = require("./controllers/ImageEditor");
const redis = require("redis");
const util_1 = require("util");
// @ts-ignore
const multer = require("multer");
/**
 * Create Express server.
 */
const app = express();
const router = express_1.Router();
const httpServer = http.createServer(app);
const io = socketio(httpServer);
io.on('connection', (socket) => {
    logger_1.default.info('a user connected');
});
/**
 * Connect to MongoDB.
 */
// mongoose.Promise = global.Promise;
mongoose.connect(process.env.MONGODB_URI || process.env.MONGOLAB_URI, {
    useNewUrlParser: true,
    useCreateIndex: true,
    useFindAndModify: false,
    autoIndex: true,
    // @ts-ignore
    useUnifiedTopology: true
}).then(() => {
    logger_1.default.info('db connection successful');
}).catch((e) => {
    logger_1.default.error(`db connection failed  ${e}`);
    process.exit(24);
});
// for development only
// mongoose.set('debug', true);
mongoose.connection.on('error', () => {
    logger_1.default.error('MongoDB connection error. Please make sure MongoDB is running.');
    process.exit();
});
const redisClient = redis.createClient({
    host: process.env.REDIS_HOST,
    port: parseInt(process.env.REDIS_PORT)
});
redisClient.on('error', (err) => {
    logger_1.default.error('Redis Error' + err);
});
const redisGet = util_1.promisify(redisClient.get).bind(redisClient);
const redisSet = util_1.promisify(redisClient.set).bind(redisClient);
const redisDel = util_1.promisify(redisClient.del).bind(redisClient);
mongoose.Promise = global.Promise;
const dd_options = {
    response_code: true,
    method: true,
    tags: ['app:vote2']
};
const connect_datadog = require('connect-datadog')(dd_options);
/**
 * Express configuration.
 */
app.set('port', process.env.PORT || 3000);
app.set('views', path.join(__dirname, './views'));
app.set('view engine', 'pug');
app.set('cacheSet', redisSet);
app.set('cacheGet', redisGet);
app.set('cacheDel', redisDel);
app.use(cookieParser(process.env.SESSION_SECRET));
app.use(compression());
app.use(morgan('combined', { stream: new logger_1.LoggerStream() }));
// app.use(logger('dev'));
app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(session({
    resave: true,
    saveUninitialized: true,
    secret: process.env.SESSION_SECRET,
    store: new MongoStore({
        url: process.env.MONGODB_URI || process.env.MONGOLAB_URI,
        autoReconnect: true
    })
}));
const corsUrls = process.env.APP_CORS_URLS.split(',');
function initCors() {
    if (process.env.APP_CORS_URLS) {
        const allowedHeaders = [
            'Accept',
            'Accept-Version',
            'Content-Type',
            'Api-Version',
            'Origin',
            'X-Requested-With',
            'Authorization',
            'Cache-Control',
            'Pragma',
            'Expires',
        ];
        const corsMiddleWare = cors({
            maxAge: 5,
            origin: corsUrls,
            allowedHeaders: allowedHeaders
        });
        app.options('*', corsMiddleWare);
        app.use(corsMiddleWare);
    }
}
initCors();
app.use(passport.initialize());
app.use(passport.session());
app.use(flash());
app.use(lusca.xframe('SAMEORIGIN'));
app.use(lusca.xssProtection(true));
app.use((req, res, next) => {
    res.locals.user = req.user;
    next();
});
app.use((req, res, next) => {
    // After successful login, redirect back to the intended page
    if (!req.user &&
        req.path !== '/login' &&
        req.path !== '/signup' &&
        !req.path.match(/^\/auth/) &&
        !req.path.match(/\./) &&
        !req.path.match(/^\/api/)) {
        req.session.returnTo = req.path;
    }
    else if (req.user &&
        req.path == '/account') {
        req.session.returnTo = req.path;
    }
    next();
});
app.use(connect_datadog);
app.use(process.env.MP, express.static(path.join(__dirname, 'public'), {
    maxAge: 31557600000,
}));
io.on('connection', (socket) => {
    logger_1.default.info('a user connected', socket && socket.id);
});
/**
 * Boilerplate app routes.
 */
router.get('/login', userController.getLogin);
router.post('/login', userController.postLogin);
router.get('/logout', userController.logout);
router.get('/forgot', userController.getForgot);
router.post('/forgot', userController.postForgot);
router.get('/reset/:token', userController.getReset);
router.post('/reset/:token', userController.postReset);
router.get('/signup', userController.getSignup);
router.post('/signup', userController.postSignup);
router.get('/contact', contactController.getContact);
router.post('/contact', contactController.postContact);
router.get('/account', passportConfig.isAuthenticated, userController.getAccount);
router.get('/account/unlink/:provider', passportConfig.isAuthenticated, userController.getOauthUnlink);
router.post('/account/profile', passportConfig.isAuthenticated, userController.postUpdateProfile);
router.post('/account/password', passportConfig.isAuthenticated, userController.postUpdatePassword);
router.post('/account/delete', passportConfig.isAuthenticated, userController.postDeleteAccount);
router.get('/user/info/:id', passportConfig.isAuthenticated, userController.userInformation);
router.get('/user/send-test-notification/:id', passportConfig.isAuthenticated, userController.sendNotificationToUser);
router.put('/auction/manual-bid', passportConfig.isAuthenticated, auctionController.manualBid);
router.get('/registration/find/:phone/:eventId', passportConfig.isAuthenticated, registrationController.findUserByPhone);
router.get('/event/edit-images/:eventId', passportConfig.isAuthenticated, ImageEditor_1.editImages);
/**
 * Primary app routes.
 */
router.get('/', passportConfig.isAuthenticated, homeController.index);
router.get('/event/:eventId/results', passportConfig.isAuthenticated, resultsController.index);
router.post('/api/event/copy-winner', passportConfig.isAuthenticated, resultsController.copyWinner);
router.get('/event/:eventId/register', passportConfig.isAuthenticated, registrationController.index);
router.get('/event/:eventId/announce', passportConfig.isAuthenticated, eventController.getAnnounce);
router.post('/event/:eventId/announce', passportConfig.isAuthenticated, eventController.announce);
router.get('/event/eventList', passport_1.isJwtAuthorizedOptional, eventController.eventListHtml); // for public and event registrants
router.get('/event/:eventId/detail', passport_1.isJwtAuthorizedOptional, eventController.eventListHtml); // for public and event registrants
router.get('/preferences', passport_1.isJwtAuthorized, registrationController.preferences);
router.get('/p/:p', passportConfig.isAuthenticated, promotionController.userProfile);
router.post('/p/:p', passportConfig.isAuthenticated, promotionController.userProfileSendMessage);
router.get('/api/jwt-login', passport_1.isJwtAuthorized, registrationController.jwtLogin);
router.get('/alogin', passport_1.isJwtAuthorizedOptional, registrationController.appRedirect);
/**
 * Api routes.
 */
router.get('/api/events', passportConfig.isAuthenticated, eventController.getEvents);
router.get('/api/bidsExport/:eventId', passportConfig.isAuthenticated, auctionController.bidsExport);
router.get('/bidsExport/:eventId', passportConfig.isAuthenticated, auctionController.bidsExport);
router.get('/api/event/:eventId', passportConfig.isAuthenticated, eventController.getEvent);
router.get('/api/event/:eventId/result', passportConfig.isAuthenticated, resultsController.result);
router.post('/api/event/', passportConfig.isAuthenticated, eventController.saveEvent);
router.delete('/api/event/:eventId', passportConfig.isAuthenticated, eventController.archiveEvent);
router.post('/api/event/:eventId/incrementround', passportConfig.isAuthenticated, eventController.incrementRound);
router.post('/api/vote/sms', eventController.voteSMS);
router.get('/api/event/:eventId/registrations', passportConfig.isAuthenticated, registrationController.getRegistrations);
router.put('/api/event/:eventId/register', passportConfig.isAuthenticated, registrationController.registerVoter);
router.get('/event/:eventId/votes', passportConfig.isAuthenticated, eventController.voterLogs);
router.get('/event/:eventId/registrations', passportConfig.isAuthenticated, eventController.registrationLogs);
router.get('/api/event/:eventId/votes-registrations', passportConfig.isAuthenticated, eventController.voteRegistrationsSeries);
router.get('/api/event/:eventId/votes-rounds', passportConfig.isAuthenticated, eventController.voteRoundSeries);
router.get('/user/:voterHash', registrationController.voterProfile);
router.get('/v/:voteHash/upload', passport_1.isJwtAuthorizedOptional, eventController.voteLink);
router.get('/v/:voteHash', passport_1.isJwtAuthorizedOptional, eventController.eventListHtml);
router.get('/api/vote/:RoundNumber/:text/:urlHash', eventController.handleVoteForm);
router.put('/api/gallery/:eventId/round/:roundNo/artist/:contestantId/hash/:hash', galleryController.upload);
router.put('/api/event/edit-images/upload/:eventId/round/:roundNo/artist/:contestantId/index/:index', passportConfig.isAuthenticated, galleryController.uploadEdit);
/*resumable upload start*/
const upload = multer({ dest: path.resolve(`${__dirname}/public/uploads/images/originals`) });
router.post('/api/gallery/getMediaId/:hash' /*, passportConfig.isAuthenticated*/, galleryController.getMediaId);
router.post('/api/gallery/upload' /*, passportConfig.isAuthenticated*/, upload.array('file'), galleryController.resumableUpload);
router.get('/api/gallery/upload' /*, passportConfig.isAuthenticated*/, galleryController.checkUpload);
router.post('/api/gallery/link-upload' /*, passportConfig.isAuthenticated*/, galleryController.linkUpload);
/*resumable upload end*/
router.get('/api/gallery/:eventId/round/:roundNo', galleryController.getRoundImages);
router.get('/api/event/:eventId/votes-rounds-channels', passportConfig.isAuthenticated, eventController.voteBarGraph);
router.get('/api/eventList', passport_1.isJwtAuthorizedOptional, eventController.eventList); // for public and event registrants, webkit
router.get('/api/event/:eventId/view', passport_1.isJwtAuthorized, eventController.viewEvent);
router.get('/api/vr/static', vrController.staticContent);
router.get('/api/vr/load/:eventPageNo/:roundPageNo', vrController.loadRoundInEvent);
router.post('/api/vr/vote/:eventId/:userId/:round/:easel', vrController.Vote);
router.get('/api/vote/:eventId/:contestantId/:roundNumber/:IsWinner', passportConfig.isAuthenticated, eventController.makeWinner);
router.get('/api/auction/:eventId/:roundNumber/:contestantId/:EnableAuction', passport_1.isJwtAuthorizedOptional, auctionController.changeAuctionStatus);
router.get('/a', passportConfig.isJwtAuthorizedOptional, auctionController.eventsWithAuctionHtml);
router.get('/auction', passportConfig.isJwtAuthorizedOptional, auctionController.eventsWithAuctionHtml);
router.get('/a/r/:registrationHash', auctionController.eventsWithAuctionHtml);
router.get('/a/:artId', passportConfig.isJwtAuthorizedOptional, auctionController.auctionDetailHtml);
router.get('/a/:artId/r/:registrationHash', passportConfig.isJwtAuthorizedOptional, auctionController.auctionDetailHtml);
router.get('/api/auction/events', passportConfig.isJwtAuthorizedOptional, auctionController.eventsWithAuction);
router.get('/api/auction/:ArtId', passportConfig.isJwtAuthorizedOptional, auctionController.auctionDetail);
router.put('/api/auction/bid/:artId/:bid', passportConfig.isJwtAuthorized, auctionController.bid);
router.get('/api/auction/notify/:eventId', passportConfig.isAuthenticated, auctionController.notifyAuctionOpen);
router.get('/api/auction/notify-short-link/:eventId', passport_1.isAuthenticated, auctionController.sendShortAuctionLink);
router.get('/api/auction/export-to-google-sheet/:eventId', passportConfig.isAuthenticated, auctionController.exportToGoogleSheet);
router.put('/api/auction/saveLotConfig/:artId', passportConfig.isJwtAuthorizedOptional, auctionController.saveLotConfig);
router.post('/api/auction/payment-status', passport_1.isAuthenticated, auctionController.AuctionPaymentStatus);
router.get('/api/auction/list/payment-status-options', passport_1.isAuthenticated, auctionController.AuctionPaymentStatusOptions);
router.post('/api/auction/mark-buyer-paid', passport_1.isAuthenticated, auctionController.MarkBuyerPaid);
router.post('/api/auction/mark-artist-paid', passport_1.isAuthenticated, auctionController.MarkArtistPaid);
router.get('/api/auction/auto-close/:eventId/:enableAutoClose', passport_1.isAuthenticated, auctionController.autoClose);
router.get('/b/:ShortUrlHash', homeController.handleShortUrl);
router.get('/api/auction /stat/:artId', auctionController.artStat);
router.get('/s/:artId', auctionController.artStatHtml);
router.get('/c/:artId', auctionController.artStatHtml);
router.get('/api/auction/send-closing-status/:eventId/:roundNo', auctionController.sendClosingNotice);
router.put('/api/registration/status/:eventId/:registrationId/:statusIndex', passportConfig.isAuthenticated, registrationController.changeStatusInEvent);
router.get('/api/events-stats', passportConfig.isAuthenticated, eventController.eventStats);
// For testing notification
router.get('/api/test-notification', passportConfig.isJwtAuthorized, registrationController.testNotification);
router.put('/api/update-online-auction-payment-sheet', auctionController.updateOnlineAuctionPaymentSheet);
router.get('/api/people/message-status/:registrationId/:isBlocked', passportConfig.isAuthenticated, promotionController.changeMessageStatus);
/**
 * App routes
 */
// for registration
router.post('/api/register', registrationController.selfRegister);
// verification of registration
router.post('/api/verifyOtp', registrationController.verifyOtp);
// for login
router.post('/api/login', registrationController.login);
// for verification
router.post('/api/verifyLoginOtp', registrationController.verifyLoginOtp);
// for saving user's profile, location and device token
router.post('/api/save', passport_1.isJwtAuthorized, registrationController.setNickName);
// set nickname
router.post('/api/set-nick-name', passport_1.isJwtAuthorized, registrationController.setNickName);
// for subsequent event registration
router.post('/api/register-with-token', passport_1.isJwtAuthorized, registrationController.selfRegister);
// for saving notification preferences
router.post('/api/settings', passport_1.isJwtAuthorized, registrationController.saveSettings);
// for getting notification preferences
router.get('/api/settings', passport_1.isJwtAuthorized, registrationController.getSettings);
// about me
router.get('/api/about-me', passport_1.isJwtAuthorized, registrationController.aboutMe);
// secretCode
router.post('/api/secret-code', passport_1.isJwtAuthorized, registrationController.secretCode);
// logout
router.post('/api/logout', passport_1.isJwtAuthorizedOptional, registrationController.logout);
// vote
router.post('/api/vote/app/:eventId/:RoundNumber/:easelNumber', passport_1.isJwtAuthorized, eventController.appVote);
// admin
router.get('/admin', passport_1.isJwtAuthorizedOptional, registrationController.admin);
router.get('/admin/:phoneHash', passport_1.isJwtAuthorizedOptional, registrationController.admin);
router.get('/profile', passport_1.isJwtAuthorizedOptional, registrationController.profile);
router.get('/tickets', (req, res, next) => {
    res.status(301).redirect(process.env.FRONTEND_LINK + '/all');
});
router.get('/api/promotion/event-list', passport_1.isAuthenticated, promotionController.getEvents);
router.get('/promotion/send', passport_1.isAuthenticated, promotionController.sendPromotion);
router.get('/api/promotion-phonenumber/', passport_1.isAuthenticated, promotionPhoneNUmberController.getEventPhoneNumber);
router.post('/api/promotion/save', passport_1.isAuthenticated, promotionController.savePromotion);
router.post('/api/promotion/guest-count', passport_1.isAuthenticated, eventController.getEventGuestCount);
router.post('/api/promotion/filter-guest-count', passport_1.isAuthenticated, eventController.getEventFilterGuestCount);
router.post('/api/promotion/send-notification', passport_1.isAuthenticated, promotionController.sendPromotionNotifications);
router.post('/api/promotion/device-count', passport_1.isAuthenticated, promotionController.getDeviceCounts);
router.get('/api/promotion/logs', passport_1.isAuthenticated, promotionController.logs);
router.get('/api/promotion/message-logs', passport_1.isAuthenticated, promotionController.promotionLogsMessage2);
router.get('/api/promotion/top-vote', passport_1.isAuthenticated, promotionController.promotionLogsTopVote);
router.get('/artists', passportConfig.isJwtAuthorizedOptional, artistController.index);
router.post('/api/artist/search', artistController.search);
router.get('/api/artist/c/:contestantId', artistController.get);
router.get('/api/artist/auto-suggest', artistController.autoSuggest);
router.put('/api/artist/:contestantId', artistController.update);
router.post('/api/artist', artistController.create);
router.get('/ar/:contestantId', passport_1.isJwtAuthorizedOptional, artistController.artistPublicProfile);
router.get('/ar/:contestantId/:hash', passport_1.isJwtAuthorizedOptional, artistController.artistPublicProfile);
router.get('/artist/:entryId', passport_1.isAuthenticated, artistController.redirectedToInternal);
router.get('/artist/:entryId/:hash', passport_1.isJwtAuthorizedOptional, artistController.redirectedToInternal);
router.post('/api/artist/follow/:contestantId', artistController.follow);
router.post('/api/artist/follow/:contestantId/:hash', artistController.follow);
router.get('/randomloadtesting1024', eventController.randomVoteUrl);
router.post('/api/artist/add-video/:artistId', artistController.addVideo);
router.post('/api/woo-commerce-artist-list', artistController.wooList);
router.post('/api/artist/save-product', artistController.saveProduct);
router.delete('/api/artist/product/:productId', artistController.deleteProduct);
router.patch('/api/artist/product/:productId', artistController.refreshProductCache);
router.get('/pr/:eventId', registrationController.publicRegistration);
router.post('/pr/:eventId', registrationController.publicRegistrationPost);
/**
 * Error Handler. Provides full stack - remove for production
 */
app.use((err, req, res, next) => {
    try {
        logger_1.default.error(`${req.url} ${err.message || JSON.stringify(err)} ${err.status} ${err.stack} query ${req.query ? JSON.stringify(req.query) : ''}
    body ${req.body ? JSON.stringify(req.body) : ''} params ${req.params ? JSON.stringify(req.params) : ''} headers ${JSON.stringify(req.headers)}`);
    }
    catch (e) {
        logger_1.default.error(`${req.url} ${err.message} ${err.status} ${err.stack} query ${req.query ? JSON.stringify(req.query) : ''}
    body ${req.body ? JSON.stringify(req.body) : ''} params ${req.params ? JSON.stringify(req.params) : ''} headers ${JSON.stringify(req.headers)}`);
    }
    if (err.status) {
        res.status(err.status);
    }
    else {
        res.status(500);
    }
    res.json(err);
});
app.use(`${process.env.MP}/` || '/a/', router);
/**
 * Start Express server.
 */
app.listen(app.get('port'), () => {
    logger_1.default.info(`App is running at http://localhost:${app.get('port')} in ${app.get('env')} mode'`);
    logger_1.default.info('  Press CTRL-C to stop\n');
});
module.exports = app;

//# sourceMappingURL=data:application/json;charset=utf8;base64,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Q0FBQztBQUNILEdBQUcsQ0FBQyxHQUFHLENBQUMsR0FBRyxPQUFPLENBQUMsR0FBRyxDQUFDLEVBQUUsR0FBRyxJQUFJLEtBQUssRUFBRSxNQUFNLENBQUMsQ0FBQztBQUMvQzs7R0FFRztBQUNILEdBQUcsQ0FBQyxNQUFNLENBQUMsR0FBRyxDQUFDLEdBQUcsQ0FBQyxNQUFNLENBQUMsRUFBRSxHQUFHLEVBQUU7SUFDN0IsZ0JBQU0sQ0FBQyxJQUFJLENBQUMsc0NBQXNDLEdBQUcsQ0FBQyxHQUFHLENBQUMsTUFBTSxDQUFDLE9BQU8sR0FBRyxDQUFDLEdBQUcsQ0FBQyxLQUFLLENBQUMsUUFBUSxDQUFDLENBQUM7SUFDaEcsZ0JBQU0sQ0FBQyxJQUFJLENBQUMsMEJBQTBCLENBQUMsQ0FBQztBQUM1QyxDQUFDLENBQUMsQ0FBQztBQUVILE1BQU0sQ0FBQyxPQUFPLEdBQUcsR0FBRyxDQUFDIiwiZmlsZSI6InNlcnZlci5qcyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogVGhlIHRyYWNlciBzaG91bGQgYmUgaW1wb3J0ZWQgZmlyc3RcbiAqL1xuaW1wb3J0ICcuL3RyYWNlcic7XG4vKipcbiAqIE1vZHVsZSBkZXBlbmRlbmNpZXMuXG4gKi9cbmltcG9ydCAqIGFzIGV4cHJlc3MgZnJvbSAnZXhwcmVzcyc7XG5pbXBvcnQgKiBhcyBjb3JzIGZyb20gJ2NvcnMnO1xuaW1wb3J0ICogYXMgY29va2llUGFyc2VyIGZyb20gJ2Nvb2tpZS1wYXJzZXInO1xuaW1wb3J0ICogYXMgY29tcHJlc3Npb24gZnJvbSAnY29tcHJlc3Npb24nOyAgLy8gY29tcHJlc3NlcyByZXF1ZXN0c1xuaW1wb3J0ICogYXMgc2Vzc2lvbiBmcm9tICdleHByZXNzLXNlc3Npb24nO1xuaW1wb3J0ICogYXMgbW9yZ2FuIGZyb20gJ21vcmdhbic7XG5pbXBvcnQgKiBhcyBkb3RlbnYgZnJvbSAnZG90ZW52JztcblxuLyoqXG4gKiBMb2FkIGVudmlyb25tZW50IHZhcmlhYmxlcyBmcm9tIC5lbnYgZmlsZSwgd2hlcmUgQVBJIGtleXMgYW5kIHBhc3N3b3JkcyBhcmUgY29uZmlndXJlZC5cbiAqL1xuaW1wb3J0ICogYXMgcGF0aCBmcm9tICdwYXRoJztcbmRvdGVudi5jb25maWcoeyBwYXRoOiBwYXRoLmpvaW4oX19kaXJuYW1lLCAnLmVudicpIH0pO1xuaW1wb3J0IGxvZ2dlciwgeyBMb2dnZXJTdHJlYW0gfSBmcm9tICcuL2NvbmZpZy9sb2dnZXInO1xuLy8gQHRzLWlnbm9yZVxuaW1wb3J0ICogYXMgbHVzY2EgZnJvbSAnbHVzY2EnO1xuaW1wb3J0ICogYXMgbW9uZ28gZnJvbSAnY29ubmVjdC1tb25nbyc7XG5pbXBvcnQgKiBhcyBmbGFzaCBmcm9tICdleHByZXNzLWZsYXNoJztcbmltcG9ydCAqIGFzIG1vbmdvb3NlIGZyb20gJ21vbmdvb3NlJztcbmltcG9ydCAqIGFzIHBhc3Nwb3J0IGZyb20gJ3Bhc3Nwb3J0JztcbmltcG9ydCAqIGFzIHNvY2tldGlvIGZyb20gJ3NvY2tldC5pbyc7XG5pbXBvcnQgKiBhcyBodHRwIGZyb20gJ2h0dHAnO1xuLy8gQHRzLWlnbm9yZVxuXG5yZXF1aXJlKCcuL2NvbW1vbi9BcnJheUV4dGVuc2lvbnMnKTtcbnJlcXVpcmUoJy4vY29tbW9uL1N0cmluZ0V4dGVuc2lvbnMnKTtcblxuXG5jb25zdCBNb25nb1N0b3JlID0gbW9uZ28oc2Vzc2lvbik7XG5cblxuXG4vKipcbiAqIENvbnRyb2xsZXJzIChyb3V0ZSBoYW5kbGVycykuXG4gKi9cbmltcG9ydCAqIGFzIGhvbWVDb250cm9sbGVyIGZyb20gJy4vY29udHJvbGxlcnMvaG9tZSc7XG5pbXBvcnQgKiBhcyB1c2VyQ29udHJvbGxlciBmcm9tICcuL2NvbnRyb2xsZXJzL3VzZXInO1xuaW1wb3J0ICogYXMgY29udGFjdENvbnRyb2xsZXIgZnJvbSAnLi9jb250cm9sbGVycy9jb250YWN0JztcbmltcG9ydCAqIGFzIGV2ZW50Q29udHJvbGxlciBmcm9tICcuL2NvbnRyb2xsZXJzL2V2ZW50JztcbmltcG9ydCAqIGFzIHJlZ2lzdHJhdGlvbkNvbnRyb2xsZXIgZnJvbSAnLi9jb250cm9sbGVycy9yZWdpc3Rlcic7XG5pbXBvcnQgKiBhcyByZXN1bHRzQ29udHJvbGxlciBmcm9tICcuL2NvbnRyb2xsZXJzL3Jlc3VsdHMnO1xuaW1wb3J0ICogYXMgZ2FsbGVyeUNvbnRyb2xsZXIgZnJvbSAnLi9jb250cm9sbGVycy9nYWxsZXJ5JztcbmltcG9ydCAqIGFzIHZyQ29udHJvbGxlciBmcm9tICcuL2NvbnRyb2xsZXJzL3ZyJztcbmltcG9ydCAqIGFzIGF1Y3Rpb25Db250cm9sbGVyIGZyb20gJy4vY29udHJvbGxlcnMvYXVjdGlvbic7XG5pbXBvcnQgKiBhcyBwcm9tb3Rpb25Db250cm9sbGVyIGZyb20gJy4vY29udHJvbGxlcnMvcHJvbW90aW9uJztcbmltcG9ydCAqIGFzIHByb21vdGlvblBob25lTlVtYmVyQ29udHJvbGxlciBmcm9tICcuL2NvbnRyb2xsZXJzL3Byb21vdGlvblBob25lTnVtYmVyJztcbmltcG9ydCAqIGFzIGFydGlzdENvbnRyb2xsZXIgZnJvbSAnLi9jb250cm9sbGVycy9hcnRpc3QnO1xuXG4vKipcbiAqIEFQSSBrZXlzIGFuZCBQYXNzcG9ydCBjb25maWd1cmF0aW9uLlxuICovXG5pbXBvcnQgKiBhcyBwYXNzcG9ydENvbmZpZyBmcm9tICcuL2NvbmZpZy9wYXNzcG9ydCc7XG5pbXBvcnQgeyBFcnJvckRUTyB9IGZyb20gJy4uLy4uL3NoYXJlZC9FcnJvckRUTyc7XG5pbXBvcnQgeyBSZXF1ZXN0LCBSb3V0ZXIgfSBmcm9tICdleHByZXNzJztcbmltcG9ydCB7IFJlc3BvbnNlIH0gZnJvbSAnZXhwcmVzcyc7XG5pbXBvcnQgeyBOZXh0RnVuY3Rpb24gfSBmcm9tICdleHByZXNzJztcbmltcG9ydCAqIGFzIFNvY2tldElPIGZyb20gJ3NvY2tldC5pbyc7XG5pbXBvcnQgeyBpc0F1dGhlbnRpY2F0ZWQsIGlzSnd0QXV0aG9yaXplZCwgaXNKd3RBdXRob3JpemVkT3B0aW9uYWwgfSBmcm9tICcuL2NvbmZpZy9wYXNzcG9ydCc7XG5pbXBvcnQgU29ja2V0ID0gU29ja2V0SU8uU29ja2V0O1xuaW1wb3J0IHsgZWRpdEltYWdlcyB9IGZyb20gJy4vY29udHJvbGxlcnMvSW1hZ2VFZGl0b3InO1xuaW1wb3J0ICogYXMgcmVkaXMgZnJvbSAncmVkaXMnO1xuaW1wb3J0IHsgcHJvbWlzaWZ5IH0gZnJvbSAndXRpbCc7XG4vLyBAdHMtaWdub3JlXG5pbXBvcnQgbXVsdGVyID0gcmVxdWlyZSgnbXVsdGVyJyk7XG5cbi8qKlxuICogQ3JlYXRlIEV4cHJlc3Mgc2VydmVyLlxuICovXG5jb25zdCBhcHAgPSBleHByZXNzKCk7XG5jb25zdCByb3V0ZXIgPSBSb3V0ZXIoKTtcbmNvbnN0IGh0dHBTZXJ2ZXIgPSBodHRwLmNyZWF0ZVNlcnZlcihhcHApO1xuY29uc3QgaW8gPSBzb2NrZXRpbyhodHRwU2VydmVyKTtcblxuaW8ub24oJ2Nvbm5lY3Rpb24nLCAoc29ja2V0OiBTb2NrZXRJTy5Tb2NrZXQpID0+IHtcbiAgICBsb2dnZXIuaW5mbygnYSB1c2VyIGNvbm5lY3RlZCcpO1xufSk7XG5cbi8qKlxuICogQ29ubmVjdCB0byBNb25nb0RCLlxuICovXG4vLyBtb25nb29zZS5Qcm9taXNlID0gZ2xvYmFsLlByb21pc2U7XG5tb25nb29zZS5jb25uZWN0KHByb2Nlc3MuZW52Lk1PTkdPREJfVVJJIHx8IHByb2Nlc3MuZW52Lk1PTkdPTEFCX1VSSSwge1xuICAgIHVzZU5ld1VybFBhcnNlcjogdHJ1ZSxcbiAgICB1c2VDcmVhdGVJbmRleDogdHJ1ZSxcbiAgICB1c2VGaW5kQW5kTW9kaWZ5OiBmYWxzZSxcbiAgICBhdXRvSW5kZXg6IHRydWUsXG4gICAgLy8gQHRzLWlnbm9yZVxuICAgIHVzZVVuaWZpZWRUb3BvbG9neTogdHJ1ZVxufSkudGhlbigoKSA9PiB7XG4gICAgbG9nZ2VyLmluZm8oJ2RiIGNvbm5lY3Rpb24gc3VjY2Vzc2Z1bCcpO1xufSkuY2F0Y2goKGU6IGFueSkgPT4ge1xuICAgIGxvZ2dlci5lcnJvcihgZGIgY29ubmVjdGlvbiBmYWlsZWQgICR7ZX1gKTtcbiAgICBwcm9jZXNzLmV4aXQoMjQpO1xufSk7XG4vLyBmb3IgZGV2ZWxvcG1lbnQgb25seVxuLy8gbW9uZ29vc2Uuc2V0KCdkZWJ1ZycsIHRydWUpO1xuXG5tb25nb29zZS5jb25uZWN0aW9uLm9uKCdlcnJvcicsICgpID0+IHtcbiAgICBsb2dnZXIuZXJyb3IoJ01vbmdvREIgY29ubmVjdGlvbiBlcnJvci4gUGxlYXNlIG1ha2Ugc3VyZSBNb25nb0RCIGlzIHJ1bm5pbmcuJyk7XG4gICAgcHJvY2Vzcy5leGl0KCk7XG59KTtcbmNvbnN0IHJlZGlzQ2xpZW50ID0gcmVkaXMuY3JlYXRlQ2xpZW50KHtcbiAgICBob3N0OiBwcm9jZXNzLmVudi5SRURJU19IT1NULFxuICAgIHBvcnQ6IHBhcnNlSW50KHByb2Nlc3MuZW52LlJFRElTX1BPUlQpXG59KTtcblxucmVkaXNDbGllbnQub24oJ2Vycm9yJywgKGVycjogc3RyaW5nKSA9PiB7XG4gICAgbG9nZ2VyLmVycm9yKCdSZWRpcyBFcnJvcicgKyBlcnIpO1xufSk7XG5cbmNvbnN0IHJlZGlzR2V0ID0gcHJvbWlzaWZ5KHJlZGlzQ2xpZW50LmdldCkuYmluZChyZWRpc0NsaWVudCk7XG5jb25zdCByZWRpc1NldCA9IHByb21pc2lmeShyZWRpc0NsaWVudC5zZXQpLmJpbmQocmVkaXNDbGllbnQpO1xuY29uc3QgcmVkaXNEZWwgPSBwcm9taXNpZnkocmVkaXNDbGllbnQuZGVsKS5iaW5kKHJlZGlzQ2xpZW50KTtcblxuKDxhbnk+bW9uZ29vc2UuUHJvbWlzZSkgPSBnbG9iYWwuUHJvbWlzZTtcblxuY29uc3QgZGRfb3B0aW9ucyA9IHtcbiAgICByZXNwb25zZV9jb2RlOiB0cnVlLFxuICAgIG1ldGhvZDogdHJ1ZSxcbiAgICB0YWdzOiBbJ2FwcDp2b3RlMiddXG59O1xuY29uc3QgY29ubmVjdF9kYXRhZG9nID0gcmVxdWlyZSgnY29ubmVjdC1kYXRhZG9nJykoZGRfb3B0aW9ucyk7XG5cbi8qKlxuICogRXhwcmVzcyBjb25maWd1cmF0aW9uLlxuICovXG5hcHAuc2V0KCdwb3J0JywgcHJvY2Vzcy5lbnYuUE9SVCB8fCAzMDAwKTtcbmFwcC5zZXQoJ3ZpZXdzJywgcGF0aC5qb2luKF9fZGlybmFtZSwgJy4vdmlld3MnKSk7XG5hcHAuc2V0KCd2aWV3IGVuZ2luZScsICdwdWcnKTtcbmFwcC5zZXQoJ2NhY2hlU2V0JywgcmVkaXNTZXQpO1xuYXBwLnNldCgnY2FjaGVHZXQnLCByZWRpc0dldCk7XG5hcHAuc2V0KCdjYWNoZURlbCcsIHJlZGlzRGVsKTtcbmFwcC51c2UoY29va2llUGFyc2VyKHByb2Nlc3MuZW52LlNFU1NJT05fU0VDUkVUKSk7XG5hcHAudXNlKGNvbXByZXNzaW9uKCkpO1xuYXBwLnVzZShtb3JnYW4oJ2NvbWJpbmVkJywgeyBzdHJlYW06IG5ldyBMb2dnZXJTdHJlYW0oKSB9KSk7XG4vLyBhcHAudXNlKGxvZ2dlcignZGV2JykpO1xuYXBwLnVzZShleHByZXNzLmpzb24oe2xpbWl0OiAnMTAwbWInfSkpO1xuYXBwLnVzZShleHByZXNzLnVybGVuY29kZWQoeyBleHRlbmRlZDogdHJ1ZSB9KSk7XG5hcHAudXNlKHNlc3Npb24oe1xuICAgIHJlc2F2ZTogdHJ1ZSxcbiAgICBzYXZlVW5pbml0aWFsaXplZDogdHJ1ZSxcbiAgICBzZWNyZXQ6IHByb2Nlc3MuZW52LlNFU1NJT05fU0VDUkVULFxuICAgIHN0b3JlOiBuZXcgTW9uZ29TdG9yZSh7XG4gICAgICAgIHVybDogcHJvY2Vzcy5lbnYuTU9OR09EQl9VUkkgfHwgcHJvY2Vzcy5lbnYuTU9OR09MQUJfVVJJLFxuICAgICAgICBhdXRvUmVjb25uZWN0OiB0cnVlXG4gICAgfSlcbn0pKTtcblxuY29uc3QgY29yc1VybHM6IHN0cmluZ1tdID0gcHJvY2Vzcy5lbnYuQVBQX0NPUlNfVVJMUy5zcGxpdCgnLCcpO1xuZnVuY3Rpb24gaW5pdENvcnMoKSB7XG4gICAgaWYgKHByb2Nlc3MuZW52LkFQUF9DT1JTX1VSTFMpIHtcbiAgICAgICAgY29uc3QgYWxsb3dlZEhlYWRlcnMgPSBbXG4gICAgICAgICAgICAnQWNjZXB0JyxcbiAgICAgICAgICAgICdBY2NlcHQtVmVyc2lvbicsXG4gICAgICAgICAgICAnQ29udGVudC1UeXBlJyxcbiAgICAgICAgICAgICdBcGktVmVyc2lvbicsXG4gICAgICAgICAgICAnT3JpZ2luJyxcbiAgICAgICAgICAgICdYLVJlcXVlc3RlZC1XaXRoJyxcbiAgICAgICAgICAgICdBdXRob3JpemF0aW9uJyxcbiAgICAgICAgICAgICdDYWNoZS1Db250cm9sJyxcbiAgICAgICAgICAgICdQcmFnbWEnLFxuICAgICAgICAgICAgJ0V4cGlyZXMnLFxuICAgICAgICBdO1xuICAgICAgICBjb25zdCBjb3JzTWlkZGxlV2FyZSA9IGNvcnMoe1xuICAgICAgICAgICAgbWF4QWdlOiA1LCAvLyBPcHRpb25hbFxuICAgICAgICAgICAgb3JpZ2luOiBjb3JzVXJscyxcbiAgICAgICAgICAgIGFsbG93ZWRIZWFkZXJzOiBhbGxvd2VkSGVhZGVyc1xuICAgICAgICB9KTtcbiAgICAgICAgYXBwLm9wdGlvbnMoJyonLCBjb3JzTWlkZGxlV2FyZSk7XG4gICAgICAgIGFwcC51c2UoY29yc01pZGRsZVdhcmUpO1xuICAgIH1cbn1cbmluaXRDb3JzKCk7XG5hcHAudXNlKHBhc3Nwb3J0LmluaXRpYWxpemUoKSk7XG5hcHAudXNlKHBhc3Nwb3J0LnNlc3Npb24oKSk7XG5hcHAudXNlKGZsYXNoKCkpO1xuYXBwLnVzZShsdXNjYS54ZnJhbWUoJ1NBTUVPUklHSU4nKSk7XG5hcHAudXNlKGx1c2NhLnhzc1Byb3RlY3Rpb24odHJ1ZSkpO1xuYXBwLnVzZSgocmVxOiBSZXF1ZXN0LCByZXM6IFJlc3BvbnNlLCBuZXh0OiBOZXh0RnVuY3Rpb24pID0+IHtcbiAgICByZXMubG9jYWxzLnVzZXIgPSByZXEudXNlcjtcbiAgICBuZXh0KCk7XG59KTtcbmFwcC51c2UoKHJlcTogUmVxdWVzdCwgcmVzOiBSZXNwb25zZSwgbmV4dDogTmV4dEZ1bmN0aW9uKSA9PiB7XG4gICAgLy8gQWZ0ZXIgc3VjY2Vzc2Z1bCBsb2dpbiwgcmVkaXJlY3QgYmFjayB0byB0aGUgaW50ZW5kZWQgcGFnZVxuICAgIGlmICghcmVxLnVzZXIgJiZcbiAgICAgICAgcmVxLnBhdGggIT09ICcvbG9naW4nICYmXG4gICAgICAgIHJlcS5wYXRoICE9PSAnL3NpZ251cCcgJiZcbiAgICAgICAgIXJlcS5wYXRoLm1hdGNoKC9eXFwvYXV0aC8pICYmXG4gICAgICAgICFyZXEucGF0aC5tYXRjaCgvXFwuLykgJiZcbiAgICAgICAgIXJlcS5wYXRoLm1hdGNoKC9eXFwvYXBpLykpIHtcbiAgICAgICAgcmVxLnNlc3Npb24ucmV0dXJuVG8gPSByZXEucGF0aDtcbiAgICB9IGVsc2UgaWYgKHJlcS51c2VyICYmXG4gICAgICAgIHJlcS5wYXRoID09ICcvYWNjb3VudCcpIHtcbiAgICAgICAgcmVxLnNlc3Npb24ucmV0dXJuVG8gPSByZXEucGF0aDtcbiAgICB9XG4gICAgbmV4dCgpO1xufSk7XG5hcHAudXNlKGNvbm5lY3RfZGF0YWRvZyk7XG5hcHAudXNlKHByb2Nlc3MuZW52Lk1QLCBleHByZXNzLnN0YXRpYyhwYXRoLmpvaW4oX19kaXJuYW1lLCAncHVibGljJyksIHtcbiAgICBtYXhBZ2U6IDMxNTU3NjAwMDAwLFxuICAgIC8qc2V0SGVhZGVyczogZnVuY3Rpb24gKHJlcywgcGF0aCwgc3RhdCkge1xuICAgICAgICByZXMuaGVhZGVyKCdBY2Nlc3MtQ29udHJvbC1BbGxvdy1PcmlnaW4nLCBwcm9jZXNzLmVudi5BUFBfQ09SU19VUkxTKTtcbiAgICAgICAgcmVzLmhlYWRlcignQWNjZXNzLUNvbnRyb2wtQWxsb3ctTWV0aG9kcycsICdHRVQnKTtcbiAgICAgICAgcmVzLmhlYWRlcignQWNjZXNzLUNvbnRyb2wtQWxsb3ctSGVhZGVycycsICdDb250ZW50LVR5cGUnKTtcbiAgICB9Ki9cbn0pKTtcblxuaW8ub24oJ2Nvbm5lY3Rpb24nLCAoc29ja2V0OiBTb2NrZXQpID0+IHtcbiAgICBsb2dnZXIuaW5mbygnYSB1c2VyIGNvbm5lY3RlZCcsIHNvY2tldCAmJiBzb2NrZXQuaWQpO1xufSk7XG5cbi8qKlxuICogQm9pbGVycGxhdGUgYXBwIHJvdXRlcy5cbiAqL1xucm91dGVyLmdldCgnL2xvZ2luJywgdXNlckNvbnRyb2xsZXIuZ2V0TG9naW4pO1xucm91dGVyLnBvc3QoJy9sb2dpbicsIHVzZXJDb250cm9sbGVyLnBvc3RMb2dpbik7XG5yb3V0ZXIuZ2V0KCcvbG9nb3V0JywgdXNlckNvbnRyb2xsZXIubG9nb3V0KTtcbnJvdXRlci5nZXQoJy9mb3Jnb3QnLCB1c2VyQ29udHJvbGxlci5nZXRGb3Jnb3QpO1xucm91dGVyLnBvc3QoJy9mb3Jnb3QnLCB1c2VyQ29udHJvbGxlci5wb3N0Rm9yZ290KTtcbnJvdXRlci5nZXQoJy9yZXNldC86dG9rZW4nLCB1c2VyQ29udHJvbGxlci5nZXRSZXNldCk7XG5yb3V0ZXIucG9zdCgnL3Jlc2V0Lzp0b2tlbicsIHVzZXJDb250cm9sbGVyLnBvc3RSZXNldCk7XG5yb3V0ZXIuZ2V0KCcvc2lnbnVwJywgdXNlckNvbnRyb2xsZXIuZ2V0U2lnbnVwKTtcbnJvdXRlci5wb3N0KCcvc2lnbnVwJywgdXNlckNvbnRyb2xsZXIucG9zdFNpZ251cCk7XG5yb3V0ZXIuZ2V0KCcvY29udGFjdCcsIGNvbnRhY3RDb250cm9sbGVyLmdldENvbnRhY3QpO1xucm91dGVyLnBvc3QoJy9jb250YWN0JywgY29udGFjdENvbnRyb2xsZXIucG9zdENvbnRhY3QpO1xucm91dGVyLmdldCgnL2FjY291bnQnLCBwYXNzcG9ydENvbmZpZy5pc0F1dGhlbnRpY2F0ZWQsIHVzZXJDb250cm9sbGVyLmdldEFjY291bnQpO1xucm91dGVyLmdldCgnL2FjY291bnQvdW5saW5rLzpwcm92aWRlcicsIHBhc3Nwb3J0Q29uZmlnLmlzQXV0aGVudGljYXRlZCwgdXNlckNvbnRyb2xsZXIuZ2V0T2F1dGhVbmxpbmspO1xucm91dGVyLnBvc3QoJy9hY2NvdW50L3Byb2ZpbGUnLCBwYXNzcG9ydENvbmZpZy5pc0F1dGhlbnRpY2F0ZWQsIHVzZXJDb250cm9sbGVyLnBvc3RVcGRhdGVQcm9maWxlKTtcbnJvdXRlci5wb3N0KCcvYWNjb3VudC9wYXNzd29yZCcsIHBhc3Nwb3J0Q29uZmlnLmlzQXV0aGVudGljYXRlZCwgdXNlckNvbnRyb2xsZXIucG9zdFVwZGF0ZVBhc3N3b3JkKTtcbnJvdXRlci5wb3N0KCcvYWNjb3VudC9kZWxldGUnLCBwYXNzcG9ydENvbmZpZy5pc0F1dGhlbnRpY2F0ZWQsIHVzZXJDb250cm9sbGVyLnBvc3REZWxldGVBY2NvdW50KTtcbnJvdXRlci5nZXQoJy91c2VyL2luZm8vOmlkJywgcGFzc3BvcnRDb25maWcuaXNBdXRoZW50aWNhdGVkLCB1c2VyQ29udHJvbGxlci51c2VySW5mb3JtYXRpb24pO1xucm91dGVyLmdldCgnL3VzZXIvc2VuZC10ZXN0LW5vdGlmaWNhdGlvbi86aWQnLCBwYXNzcG9ydENvbmZpZy5pc0F1dGhlbnRpY2F0ZWQsIHVzZXJDb250cm9sbGVyLnNlbmROb3RpZmljYXRpb25Ub1VzZXIpO1xucm91dGVyLnB1dCgnL2F1Y3Rpb24vbWFudWFsLWJpZCcsIHBhc3Nwb3J0Q29uZmlnLmlzQXV0aGVudGljYXRlZCwgYXVjdGlvbkNvbnRyb2xsZXIubWFudWFsQmlkKTtcbnJvdXRlci5nZXQoJy9yZWdpc3RyYXRpb24vZmluZC86cGhvbmUvOmV2ZW50SWQnLCBwYXNzcG9ydENvbmZpZy5pc0F1dGhlbnRpY2F0ZWQsIHJlZ2lzdHJhdGlvbkNvbnRyb2xsZXIuZmluZFVzZXJCeVBob25lKTtcbnJvdXRlci5nZXQoJy9ldmVudC9lZGl0LWltYWdlcy86ZXZlbnRJZCcsIHBhc3Nwb3J0Q29uZmlnLmlzQXV0aGVudGljYXRlZCwgZWRpdEltYWdlcyk7XG4vKipcbiAqIFByaW1hcnkgYXBwIHJvdXRlcy5cbiAqL1xucm91dGVyLmdldCgnLycsIHBhc3Nwb3J0Q29uZmlnLmlzQXV0aGVudGljYXRlZCwgaG9tZUNvbnRyb2xsZXIuaW5kZXgpO1xucm91dGVyLmdldCgnL2V2ZW50LzpldmVudElkL3Jlc3VsdHMnLCBwYXNzcG9ydENvbmZpZy5pc0F1dGhlbnRpY2F0ZWQsIHJlc3VsdHNDb250cm9sbGVyLmluZGV4KTtcbnJvdXRlci5wb3N0KCcvYXBpL2V2ZW50L2NvcHktd2lubmVyJywgcGFzc3BvcnRDb25maWcuaXNBdXRoZW50aWNhdGVkLCByZXN1bHRzQ29udHJvbGxlci5jb3B5V2lubmVyKTtcbnJvdXRlci5nZXQoJy9ldmVudC86ZXZlbnRJZC9yZWdpc3RlcicsIHBhc3Nwb3J0Q29uZmlnLmlzQXV0aGVudGljYXRlZCwgcmVnaXN0cmF0aW9uQ29udHJvbGxlci5pbmRleCk7XG5yb3V0ZXIuZ2V0KCcvZXZlbnQvOmV2ZW50SWQvYW5ub3VuY2UnLCBwYXNzcG9ydENvbmZpZy5pc0F1dGhlbnRpY2F0ZWQsIGV2ZW50Q29udHJvbGxlci5nZXRBbm5vdW5jZSk7XG5yb3V0ZXIucG9zdCgnL2V2ZW50LzpldmVudElkL2Fubm91bmNlJywgcGFzc3BvcnRDb25maWcuaXNBdXRoZW50aWNhdGVkLCBldmVudENvbnRyb2xsZXIuYW5ub3VuY2UpO1xucm91dGVyLmdldCgnL2V2ZW50L2V2ZW50TGlzdCcsIGlzSnd0QXV0aG9yaXplZE9wdGlvbmFsLCBldmVudENvbnRyb2xsZXIuZXZlbnRMaXN0SHRtbCk7IC8vIGZvciBwdWJsaWMgYW5kIGV2ZW50IHJlZ2lzdHJhbnRzXG5yb3V0ZXIuZ2V0KCcvZXZlbnQvOmV2ZW50SWQvZGV0YWlsJywgaXNKd3RBdXRob3JpemVkT3B0aW9uYWwsIGV2ZW50Q29udHJvbGxlci5ldmVudExpc3RIdG1sKTsgLy8gZm9yIHB1YmxpYyBhbmQgZXZlbnQgcmVnaXN0cmFudHNcbnJvdXRlci5nZXQoJy9wcmVmZXJlbmNlcycsIGlzSnd0QXV0aG9yaXplZCwgcmVnaXN0cmF0aW9uQ29udHJvbGxlci5wcmVmZXJlbmNlcyk7XG5yb3V0ZXIuZ2V0KCcvcC86cCcsIHBhc3Nwb3J0Q29uZmlnLmlzQXV0aGVudGljYXRlZCwgcHJvbW90aW9uQ29udHJvbGxlci51c2VyUHJvZmlsZSk7XG5yb3V0ZXIucG9zdCgnL3AvOnAnLCBwYXNzcG9ydENvbmZpZy5pc0F1dGhlbnRpY2F0ZWQsIHByb21vdGlvbkNvbnRyb2xsZXIudXNlclByb2ZpbGVTZW5kTWVzc2FnZSk7XG5yb3V0ZXIuZ2V0KCcvYXBpL2p3dC1sb2dpbicsIGlzSnd0QXV0aG9yaXplZCwgcmVnaXN0cmF0aW9uQ29udHJvbGxlci5qd3RMb2dpbik7XG5yb3V0ZXIuZ2V0KCcvYWxvZ2luJywgaXNKd3RBdXRob3JpemVkT3B0aW9uYWwsIHJlZ2lzdHJhdGlvbkNvbnRyb2xsZXIuYXBwUmVkaXJlY3QpO1xuLyoqXG4gKiBBcGkgcm91dGVzLlxuICovXG5yb3V0ZXIuZ2V0KCcvYXBpL2V2ZW50cycsIHBhc3Nwb3J0Q29uZmlnLmlzQXV0aGVudGljYXRlZCwgZXZlbnRDb250cm9sbGVyLmdldEV2ZW50cyk7XG5yb3V0ZXIuZ2V0KCcvYXBpL2JpZHNFeHBvcnQvOmV2ZW50SWQnLCBwYXNzcG9ydENvbmZpZy5pc0F1dGhlbnRpY2F0ZWQsIGF1Y3Rpb25Db250cm9sbGVyLmJpZHNFeHBvcnQpO1xucm91dGVyLmdldCgnL2JpZHNFeHBvcnQvOmV2ZW50SWQnLCBwYXNzcG9ydENvbmZpZy5pc0F1dGhlbnRpY2F0ZWQsIGF1Y3Rpb25Db250cm9sbGVyLmJpZHNFeHBvcnQpO1xucm91dGVyLmdldCgnL2FwaS9ldmVudC86ZXZlbnRJZCcsIHBhc3Nwb3J0Q29uZmlnLmlzQXV0aGVudGljYXRlZCwgZXZlbnRDb250cm9sbGVyLmdldEV2ZW50KTtcbnJvdXRlci5nZXQoJy9hcGkvZXZlbnQvOmV2ZW50SWQvcmVzdWx0JywgcGFzc3BvcnRDb25maWcuaXNBdXRoZW50aWNhdGVkLCByZXN1bHRzQ29udHJvbGxlci5yZXN1bHQpO1xucm91dGVyLnBvc3QoJy9hcGkvZXZlbnQvJywgcGFzc3BvcnRDb25maWcuaXNBdXRoZW50aWNhdGVkLCBldmVudENvbnRyb2xsZXIuc2F2ZUV2ZW50KTtcbnJvdXRlci5kZWxldGUoJy9hcGkvZXZlbnQvOmV2ZW50SWQnLCBwYXNzcG9ydENvbmZpZy5pc0F1dGhlbnRpY2F0ZWQsIGV2ZW50Q29udHJvbGxlci5hcmNoaXZlRXZlbnQpO1xucm91dGVyLnBvc3QoJy9hcGkvZXZlbnQvOmV2ZW50SWQvaW5jcmVtZW50cm91bmQnLCBwYXNzcG9ydENvbmZpZy5pc0F1dGhlbnRpY2F0ZWQsIGV2ZW50Q29udHJvbGxlci5pbmNyZW1lbnRSb3VuZCk7XG5yb3V0ZXIucG9zdCgnL2FwaS92b3RlL3NtcycsIGV2ZW50Q29udHJvbGxlci52b3RlU01TKTtcbnJvdXRlci5nZXQoJy9hcGkvZXZlbnQvOmV2ZW50SWQvcmVnaXN0cmF0aW9ucycsIHBhc3Nwb3J0Q29uZmlnLmlzQXV0aGVudGljYXRlZCwgcmVnaXN0cmF0aW9uQ29udHJvbGxlci5nZXRSZWdpc3RyYXRpb25zKTtcbnJvdXRlci5wdXQoJy9hcGkvZXZlbnQvOmV2ZW50SWQvcmVnaXN0ZXInLCBwYXNzcG9ydENvbmZpZy5pc0F1dGhlbnRpY2F0ZWQsIHJlZ2lzdHJhdGlvbkNvbnRyb2xsZXIucmVnaXN0ZXJWb3Rlcik7XG5yb3V0ZXIuZ2V0KCcvZXZlbnQvOmV2ZW50SWQvdm90ZXMnLCBwYXNzcG9ydENvbmZpZy5pc0F1dGhlbnRpY2F0ZWQsIGV2ZW50Q29udHJvbGxlci52b3RlckxvZ3MpO1xucm91dGVyLmdldCgnL2V2ZW50LzpldmVudElkL3JlZ2lzdHJhdGlvbnMnLCBwYXNzcG9ydENvbmZpZy5pc0F1dGhlbnRpY2F0ZWQsIGV2ZW50Q29udHJvbGxlci5yZWdpc3RyYXRpb25Mb2dzKTtcbnJvdXRlci5nZXQoJy9hcGkvZXZlbnQvOmV2ZW50SWQvdm90ZXMtcmVnaXN0cmF0aW9ucycsIHBhc3Nwb3J0Q29uZmlnLmlzQXV0aGVudGljYXRlZCwgZXZlbnRDb250cm9sbGVyLnZvdGVSZWdpc3RyYXRpb25zU2VyaWVzKTtcbnJvdXRlci5nZXQoJy9hcGkvZXZlbnQvOmV2ZW50SWQvdm90ZXMtcm91bmRzJywgcGFzc3BvcnRDb25maWcuaXNBdXRoZW50aWNhdGVkLCBldmVudENvbnRyb2xsZXIudm90ZVJvdW5kU2VyaWVzKTtcbnJvdXRlci5nZXQoJy91c2VyLzp2b3Rlckhhc2gnLCByZWdpc3RyYXRpb25Db250cm9sbGVyLnZvdGVyUHJvZmlsZSk7XG5yb3V0ZXIuZ2V0KCcvdi86dm90ZUhhc2gvdXBsb2FkJywgaXNKd3RBdXRob3JpemVkT3B0aW9uYWwsIGV2ZW50Q29udHJvbGxlci52b3RlTGluayk7XG5yb3V0ZXIuZ2V0KCcvdi86dm90ZUhhc2gnLCBpc0p3dEF1dGhvcml6ZWRPcHRpb25hbCwgZXZlbnRDb250cm9sbGVyLmV2ZW50TGlzdEh0bWwpO1xucm91dGVyLmdldCgnL2FwaS92b3RlLzpSb3VuZE51bWJlci86dGV4dC86dXJsSGFzaCcsIGV2ZW50Q29udHJvbGxlci5oYW5kbGVWb3RlRm9ybSk7XG5yb3V0ZXIucHV0KCcvYXBpL2dhbGxlcnkvOmV2ZW50SWQvcm91bmQvOnJvdW5kTm8vYXJ0aXN0Lzpjb250ZXN0YW50SWQvaGFzaC86aGFzaCcsIGdhbGxlcnlDb250cm9sbGVyLnVwbG9hZCk7XG5yb3V0ZXIucHV0KCcvYXBpL2V2ZW50L2VkaXQtaW1hZ2VzL3VwbG9hZC86ZXZlbnRJZC9yb3VuZC86cm91bmROby9hcnRpc3QvOmNvbnRlc3RhbnRJZC9pbmRleC86aW5kZXgnLCBwYXNzcG9ydENvbmZpZy5pc0F1dGhlbnRpY2F0ZWQsIGdhbGxlcnlDb250cm9sbGVyLnVwbG9hZEVkaXQpO1xuLypyZXN1bWFibGUgdXBsb2FkIHN0YXJ0Ki9cbmNvbnN0IHVwbG9hZCA9IG11bHRlcih7IGRlc3Q6IHBhdGgucmVzb2x2ZShgJHtfX2Rpcm5hbWV9L3B1YmxpYy91cGxvYWRzL2ltYWdlcy9vcmlnaW5hbHNgKSB9KTtcbnJvdXRlci5wb3N0KCcvYXBpL2dhbGxlcnkvZ2V0TWVkaWFJZC86aGFzaCcvKiwgcGFzc3BvcnRDb25maWcuaXNBdXRoZW50aWNhdGVkKi8sIGdhbGxlcnlDb250cm9sbGVyLmdldE1lZGlhSWQpO1xucm91dGVyLnBvc3QoJy9hcGkvZ2FsbGVyeS91cGxvYWQnLyosIHBhc3Nwb3J0Q29uZmlnLmlzQXV0aGVudGljYXRlZCovLCB1cGxvYWQuYXJyYXkoJ2ZpbGUnKSwgZ2FsbGVyeUNvbnRyb2xsZXIucmVzdW1hYmxlVXBsb2FkKTtcbnJvdXRlci5nZXQoJy9hcGkvZ2FsbGVyeS91cGxvYWQnLyosIHBhc3Nwb3J0Q29uZmlnLmlzQXV0aGVudGljYXRlZCovLCBnYWxsZXJ5Q29udHJvbGxlci5jaGVja1VwbG9hZCk7XG5yb3V0ZXIucG9zdCgnL2FwaS9nYWxsZXJ5L2xpbmstdXBsb2FkJy8qLCBwYXNzcG9ydENvbmZpZy5pc0F1dGhlbnRpY2F0ZWQqLywgZ2FsbGVyeUNvbnRyb2xsZXIubGlua1VwbG9hZCk7XG4vKnJlc3VtYWJsZSB1cGxvYWQgZW5kKi9cbnJvdXRlci5nZXQoJy9hcGkvZ2FsbGVyeS86ZXZlbnRJZC9yb3VuZC86cm91bmRObycsIGdhbGxlcnlDb250cm9sbGVyLmdldFJvdW5kSW1hZ2VzKTtcbnJvdXRlci5nZXQoJy9hcGkvZXZlbnQvOmV2ZW50SWQvdm90ZXMtcm91bmRzLWNoYW5uZWxzJywgcGFzc3BvcnRDb25maWcuaXNBdXRoZW50aWNhdGVkLCBldmVudENvbnRyb2xsZXIudm90ZUJhckdyYXBoKTtcbnJvdXRlci5nZXQoJy9hcGkvZXZlbnRMaXN0JywgaXNKd3RBdXRob3JpemVkT3B0aW9uYWwsIGV2ZW50Q29udHJvbGxlci5ldmVudExpc3QpOyAvLyBmb3IgcHVibGljIGFuZCBldmVudCByZWdpc3RyYW50cywgd2Via2l0XG5yb3V0ZXIuZ2V0KCcvYXBpL2V2ZW50LzpldmVudElkL3ZpZXcnLCBpc0p3dEF1dGhvcml6ZWQsIGV2ZW50Q29udHJvbGxlci52aWV3RXZlbnQpO1xuXG5yb3V0ZXIuZ2V0KCcvYXBpL3ZyL3N0YXRpYycsIHZyQ29udHJvbGxlci5zdGF0aWNDb250ZW50KTtcbnJvdXRlci5nZXQoJy9hcGkvdnIvbG9hZC86ZXZlbnRQYWdlTm8vOnJvdW5kUGFnZU5vJywgdnJDb250cm9sbGVyLmxvYWRSb3VuZEluRXZlbnQpO1xucm91dGVyLnBvc3QoJy9hcGkvdnIvdm90ZS86ZXZlbnRJZC86dXNlcklkLzpyb3VuZC86ZWFzZWwnLCB2ckNvbnRyb2xsZXIuVm90ZSk7XG5cbnJvdXRlci5nZXQoJy9hcGkvdm90ZS86ZXZlbnRJZC86Y29udGVzdGFudElkLzpyb3VuZE51bWJlci86SXNXaW5uZXInLCBwYXNzcG9ydENvbmZpZy5pc0F1dGhlbnRpY2F0ZWQsIGV2ZW50Q29udHJvbGxlci5tYWtlV2lubmVyKTtcbnJvdXRlci5nZXQoJy9hcGkvYXVjdGlvbi86ZXZlbnRJZC86cm91bmROdW1iZXIvOmNvbnRlc3RhbnRJZC86RW5hYmxlQXVjdGlvbicsIGlzSnd0QXV0aG9yaXplZE9wdGlvbmFsLCBhdWN0aW9uQ29udHJvbGxlci5jaGFuZ2VBdWN0aW9uU3RhdHVzKTtcbnJvdXRlci5nZXQoJy9hJywgIHBhc3Nwb3J0Q29uZmlnLmlzSnd0QXV0aG9yaXplZE9wdGlvbmFsLCBhdWN0aW9uQ29udHJvbGxlci5ldmVudHNXaXRoQXVjdGlvbkh0bWwpO1xucm91dGVyLmdldCgnL2F1Y3Rpb24nLCBwYXNzcG9ydENvbmZpZy5pc0p3dEF1dGhvcml6ZWRPcHRpb25hbCwgYXVjdGlvbkNvbnRyb2xsZXIuZXZlbnRzV2l0aEF1Y3Rpb25IdG1sKTtcbnJvdXRlci5nZXQoJy9hL3IvOnJlZ2lzdHJhdGlvbkhhc2gnLCBhdWN0aW9uQ29udHJvbGxlci5ldmVudHNXaXRoQXVjdGlvbkh0bWwpO1xucm91dGVyLmdldCgnL2EvOmFydElkJywgIHBhc3Nwb3J0Q29uZmlnLmlzSnd0QXV0aG9yaXplZE9wdGlvbmFsLCBhdWN0aW9uQ29udHJvbGxlci5hdWN0aW9uRGV0YWlsSHRtbCk7XG5yb3V0ZXIuZ2V0KCcvYS86YXJ0SWQvci86cmVnaXN0cmF0aW9uSGFzaCcsICBwYXNzcG9ydENvbmZpZy5pc0p3dEF1dGhvcml6ZWRPcHRpb25hbCwgYXVjdGlvbkNvbnRyb2xsZXIuYXVjdGlvbkRldGFpbEh0bWwpO1xucm91dGVyLmdldCgnL2FwaS9hdWN0aW9uL2V2ZW50cycsICBwYXNzcG9ydENvbmZpZy5pc0p3dEF1dGhvcml6ZWRPcHRpb25hbCwgYXVjdGlvbkNvbnRyb2xsZXIuZXZlbnRzV2l0aEF1Y3Rpb24pO1xucm91dGVyLmdldCgnL2FwaS9hdWN0aW9uLzpBcnRJZCcsICBwYXNzcG9ydENvbmZpZy5pc0p3dEF1dGhvcml6ZWRPcHRpb25hbCwgYXVjdGlvbkNvbnRyb2xsZXIuYXVjdGlvbkRldGFpbCk7XG5yb3V0ZXIucHV0KCcvYXBpL2F1Y3Rpb24vYmlkLzphcnRJZC86YmlkJywgIHBhc3Nwb3J0Q29uZmlnLmlzSnd0QXV0aG9yaXplZCwgYXVjdGlvbkNvbnRyb2xsZXIuYmlkKTtcbnJvdXRlci5nZXQoJy9hcGkvYXVjdGlvbi9ub3RpZnkvOmV2ZW50SWQnLCAgcGFzc3BvcnRDb25maWcuaXNBdXRoZW50aWNhdGVkLCBhdWN0aW9uQ29udHJvbGxlci5ub3RpZnlBdWN0aW9uT3Blbik7XG5yb3V0ZXIuZ2V0KCcvYXBpL2F1Y3Rpb24vbm90aWZ5LXNob3J0LWxpbmsvOmV2ZW50SWQnLCBpc0F1dGhlbnRpY2F0ZWQsIGF1Y3Rpb25Db250cm9sbGVyLnNlbmRTaG9ydEF1Y3Rpb25MaW5rKTtcbnJvdXRlci5nZXQoJy9hcGkvYXVjdGlvbi9leHBvcnQtdG8tZ29vZ2xlLXNoZWV0LzpldmVudElkJywgIHBhc3Nwb3J0Q29uZmlnLmlzQXV0aGVudGljYXRlZCwgYXVjdGlvbkNvbnRyb2xsZXIuZXhwb3J0VG9Hb29nbGVTaGVldCk7XG5yb3V0ZXIucHV0KCcvYXBpL2F1Y3Rpb24vc2F2ZUxvdENvbmZpZy86YXJ0SWQnLCAgcGFzc3BvcnRDb25maWcuaXNKd3RBdXRob3JpemVkT3B0aW9uYWwsIGF1Y3Rpb25Db250cm9sbGVyLnNhdmVMb3RDb25maWcpO1xucm91dGVyLnBvc3QoJy9hcGkvYXVjdGlvbi9wYXltZW50LXN0YXR1cycsIGlzQXV0aGVudGljYXRlZCwgYXVjdGlvbkNvbnRyb2xsZXIuQXVjdGlvblBheW1lbnRTdGF0dXMpO1xucm91dGVyLmdldCgnL2FwaS9hdWN0aW9uL2xpc3QvcGF5bWVudC1zdGF0dXMtb3B0aW9ucycsIGlzQXV0aGVudGljYXRlZCwgYXVjdGlvbkNvbnRyb2xsZXIuQXVjdGlvblBheW1lbnRTdGF0dXNPcHRpb25zKTtcbnJvdXRlci5wb3N0KCcvYXBpL2F1Y3Rpb24vbWFyay1idXllci1wYWlkJywgaXNBdXRoZW50aWNhdGVkLCBhdWN0aW9uQ29udHJvbGxlci5NYXJrQnV5ZXJQYWlkKTtcbnJvdXRlci5wb3N0KCcvYXBpL2F1Y3Rpb24vbWFyay1hcnRpc3QtcGFpZCcsIGlzQXV0aGVudGljYXRlZCwgYXVjdGlvbkNvbnRyb2xsZXIuTWFya0FydGlzdFBhaWQpO1xucm91dGVyLmdldCgnL2FwaS9hdWN0aW9uL2F1dG8tY2xvc2UvOmV2ZW50SWQvOmVuYWJsZUF1dG9DbG9zZScsIGlzQXV0aGVudGljYXRlZCwgYXVjdGlvbkNvbnRyb2xsZXIuYXV0b0Nsb3NlKTtcbnJvdXRlci5nZXQoJy9iLzpTaG9ydFVybEhhc2gnLCBob21lQ29udHJvbGxlci5oYW5kbGVTaG9ydFVybCk7XG5yb3V0ZXIuZ2V0KCcvYXBpL2F1Y3Rpb24gL3N0YXQvOmFydElkJywgYXVjdGlvbkNvbnRyb2xsZXIuYXJ0U3RhdCk7XG5yb3V0ZXIuZ2V0KCcvcy86YXJ0SWQnLCBhdWN0aW9uQ29udHJvbGxlci5hcnRTdGF0SHRtbCk7XG5yb3V0ZXIuZ2V0KCcvYy86YXJ0SWQnLCBhdWN0aW9uQ29udHJvbGxlci5hcnRTdGF0SHRtbCk7XG5yb3V0ZXIuZ2V0KCcvYXBpL2F1Y3Rpb24vc2VuZC1jbG9zaW5nLXN0YXR1cy86ZXZlbnRJZC86cm91bmRObycsIGF1Y3Rpb25Db250cm9sbGVyLnNlbmRDbG9zaW5nTm90aWNlKTtcblxucm91dGVyLnB1dCgnL2FwaS9yZWdpc3RyYXRpb24vc3RhdHVzLzpldmVudElkLzpyZWdpc3RyYXRpb25JZC86c3RhdHVzSW5kZXgnLCBwYXNzcG9ydENvbmZpZy5pc0F1dGhlbnRpY2F0ZWQsIHJlZ2lzdHJhdGlvbkNvbnRyb2xsZXIuY2hhbmdlU3RhdHVzSW5FdmVudCk7XG5yb3V0ZXIuZ2V0KCcvYXBpL2V2ZW50cy1zdGF0cycsIHBhc3Nwb3J0Q29uZmlnLmlzQXV0aGVudGljYXRlZCwgZXZlbnRDb250cm9sbGVyLmV2ZW50U3RhdHMpO1xuLy8gRm9yIHRlc3Rpbmcgbm90aWZpY2F0aW9uXG5yb3V0ZXIuZ2V0KCcvYXBpL3Rlc3Qtbm90aWZpY2F0aW9uJywgcGFzc3BvcnRDb25maWcuaXNKd3RBdXRob3JpemVkLCByZWdpc3RyYXRpb25Db250cm9sbGVyLnRlc3ROb3RpZmljYXRpb24pO1xuXG5yb3V0ZXIucHV0KCcvYXBpL3VwZGF0ZS1vbmxpbmUtYXVjdGlvbi1wYXltZW50LXNoZWV0JywgYXVjdGlvbkNvbnRyb2xsZXIudXBkYXRlT25saW5lQXVjdGlvblBheW1lbnRTaGVldCk7XG5yb3V0ZXIuZ2V0KCcvYXBpL3Blb3BsZS9tZXNzYWdlLXN0YXR1cy86cmVnaXN0cmF0aW9uSWQvOmlzQmxvY2tlZCcsIHBhc3Nwb3J0Q29uZmlnLmlzQXV0aGVudGljYXRlZCwgcHJvbW90aW9uQ29udHJvbGxlci5jaGFuZ2VNZXNzYWdlU3RhdHVzKTtcbi8qKlxuICogQXBwIHJvdXRlc1xuICovXG4vLyBmb3IgcmVnaXN0cmF0aW9uXG5yb3V0ZXIucG9zdCgnL2FwaS9yZWdpc3RlcicsIHJlZ2lzdHJhdGlvbkNvbnRyb2xsZXIuc2VsZlJlZ2lzdGVyKTtcbi8vIHZlcmlmaWNhdGlvbiBvZiByZWdpc3RyYXRpb25cbnJvdXRlci5wb3N0KCcvYXBpL3ZlcmlmeU90cCcsIHJlZ2lzdHJhdGlvbkNvbnRyb2xsZXIudmVyaWZ5T3RwKTtcbi8vIGZvciBsb2dpblxucm91dGVyLnBvc3QoJy9hcGkvbG9naW4nLCByZWdpc3RyYXRpb25Db250cm9sbGVyLmxvZ2luKTtcbi8vIGZvciB2ZXJpZmljYXRpb25cbnJvdXRlci5wb3N0KCcvYXBpL3ZlcmlmeUxvZ2luT3RwJywgcmVnaXN0cmF0aW9uQ29udHJvbGxlci52ZXJpZnlMb2dpbk90cCk7XG4vLyBmb3Igc2F2aW5nIHVzZXIncyBwcm9maWxlLCBsb2NhdGlvbiBhbmQgZGV2aWNlIHRva2VuXG5yb3V0ZXIucG9zdCgnL2FwaS9zYXZlJywgaXNKd3RBdXRob3JpemVkLCByZWdpc3RyYXRpb25Db250cm9sbGVyLnNldE5pY2tOYW1lKTtcbi8vIHNldCBuaWNrbmFtZVxucm91dGVyLnBvc3QoJy9hcGkvc2V0LW5pY2stbmFtZScsIGlzSnd0QXV0aG9yaXplZCwgcmVnaXN0cmF0aW9uQ29udHJvbGxlci5zZXROaWNrTmFtZSk7XG4vLyBmb3Igc3Vic2VxdWVudCBldmVudCByZWdpc3RyYXRpb25cbnJvdXRlci5wb3N0KCcvYXBpL3JlZ2lzdGVyLXdpdGgtdG9rZW4nLCBpc0p3dEF1dGhvcml6ZWQsIHJlZ2lzdHJhdGlvbkNvbnRyb2xsZXIuc2VsZlJlZ2lzdGVyKTtcbi8vIGZvciBzYXZpbmcgbm90aWZpY2F0aW9uIHByZWZlcmVuY2VzXG5yb3V0ZXIucG9zdCgnL2FwaS9zZXR0aW5ncycsIGlzSnd0QXV0aG9yaXplZCwgcmVnaXN0cmF0aW9uQ29udHJvbGxlci5zYXZlU2V0dGluZ3MpO1xuLy8gZm9yIGdldHRpbmcgbm90aWZpY2F0aW9uIHByZWZlcmVuY2VzXG5yb3V0ZXIuZ2V0KCcvYXBpL3NldHRpbmdzJywgaXNKd3RBdXRob3JpemVkLCByZWdpc3RyYXRpb25Db250cm9sbGVyLmdldFNldHRpbmdzKTtcbi8vIGFib3V0IG1lXG5yb3V0ZXIuZ2V0KCcvYXBpL2Fib3V0LW1lJywgaXNKd3RBdXRob3JpemVkLCByZWdpc3RyYXRpb25Db250cm9sbGVyLmFib3V0TWUpO1xuLy8gc2VjcmV0Q29kZVxucm91dGVyLnBvc3QoJy9hcGkvc2VjcmV0LWNvZGUnLCBpc0p3dEF1dGhvcml6ZWQsIHJlZ2lzdHJhdGlvbkNvbnRyb2xsZXIuc2VjcmV0Q29kZSk7XG4vLyBsb2dvdXRcbnJvdXRlci5wb3N0KCcvYXBpL2xvZ291dCcsIGlzSnd0QXV0aG9yaXplZE9wdGlvbmFsLCByZWdpc3RyYXRpb25Db250cm9sbGVyLmxvZ291dCk7XG4vLyB2b3RlXG5yb3V0ZXIucG9zdCgnL2FwaS92b3RlL2FwcC86ZXZlbnRJZC86Um91bmROdW1iZXIvOmVhc2VsTnVtYmVyJywgaXNKd3RBdXRob3JpemVkLCBldmVudENvbnRyb2xsZXIuYXBwVm90ZSk7XG4vLyBhZG1pblxucm91dGVyLmdldCgnL2FkbWluJywgaXNKd3RBdXRob3JpemVkT3B0aW9uYWwsIHJlZ2lzdHJhdGlvbkNvbnRyb2xsZXIuYWRtaW4pO1xucm91dGVyLmdldCgnL2FkbWluLzpwaG9uZUhhc2gnLCBpc0p3dEF1dGhvcml6ZWRPcHRpb25hbCwgcmVnaXN0cmF0aW9uQ29udHJvbGxlci5hZG1pbik7XG5yb3V0ZXIuZ2V0KCcvcHJvZmlsZScsIGlzSnd0QXV0aG9yaXplZE9wdGlvbmFsLCByZWdpc3RyYXRpb25Db250cm9sbGVyLnByb2ZpbGUpO1xucm91dGVyLmdldCgnL3RpY2tldHMnLCAocmVxOiBSZXF1ZXN0LCByZXM6IFJlc3BvbnNlLCBuZXh0OiBOZXh0RnVuY3Rpb24pID0+IHtcbiAgICAgICAgcmVzLnN0YXR1cygzMDEpLnJlZGlyZWN0KHByb2Nlc3MuZW52LkZST05URU5EX0xJTksgKyAnL2FsbCcpO1xufSk7XG5cbnJvdXRlci5nZXQoJy9hcGkvcHJvbW90aW9uL2V2ZW50LWxpc3QnLCBpc0F1dGhlbnRpY2F0ZWQsIHByb21vdGlvbkNvbnRyb2xsZXIuZ2V0RXZlbnRzKTtcbnJvdXRlci5nZXQoJy9wcm9tb3Rpb24vc2VuZCcsIGlzQXV0aGVudGljYXRlZCwgcHJvbW90aW9uQ29udHJvbGxlci5zZW5kUHJvbW90aW9uKTtcbnJvdXRlci5nZXQoJy9hcGkvcHJvbW90aW9uLXBob25lbnVtYmVyLycsIGlzQXV0aGVudGljYXRlZCwgcHJvbW90aW9uUGhvbmVOVW1iZXJDb250cm9sbGVyLmdldEV2ZW50UGhvbmVOdW1iZXIpO1xuXG5yb3V0ZXIucG9zdCgnL2FwaS9wcm9tb3Rpb24vc2F2ZScsIGlzQXV0aGVudGljYXRlZCwgcHJvbW90aW9uQ29udHJvbGxlci5zYXZlUHJvbW90aW9uKTtcbnJvdXRlci5wb3N0KCcvYXBpL3Byb21vdGlvbi9ndWVzdC1jb3VudCcsIGlzQXV0aGVudGljYXRlZCwgZXZlbnRDb250cm9sbGVyLmdldEV2ZW50R3Vlc3RDb3VudCk7XG5yb3V0ZXIucG9zdCgnL2FwaS9wcm9tb3Rpb24vZmlsdGVyLWd1ZXN0LWNvdW50JywgaXNBdXRoZW50aWNhdGVkLCBldmVudENvbnRyb2xsZXIuZ2V0RXZlbnRGaWx0ZXJHdWVzdENvdW50KTtcbnJvdXRlci5wb3N0KCcvYXBpL3Byb21vdGlvbi9zZW5kLW5vdGlmaWNhdGlvbicsIGlzQXV0aGVudGljYXRlZCwgcHJvbW90aW9uQ29udHJvbGxlci5zZW5kUHJvbW90aW9uTm90aWZpY2F0aW9ucyk7XG5yb3V0ZXIucG9zdCgnL2FwaS9wcm9tb3Rpb24vZGV2aWNlLWNvdW50JywgaXNBdXRoZW50aWNhdGVkLCBwcm9tb3Rpb25Db250cm9sbGVyLmdldERldmljZUNvdW50cyk7XG5yb3V0ZXIuZ2V0KCcvYXBpL3Byb21vdGlvbi9sb2dzJywgaXNBdXRoZW50aWNhdGVkLCBwcm9tb3Rpb25Db250cm9sbGVyLmxvZ3MpO1xucm91dGVyLmdldCgnL2FwaS9wcm9tb3Rpb24vbWVzc2FnZS1sb2dzJywgaXNBdXRoZW50aWNhdGVkLCBwcm9tb3Rpb25Db250cm9sbGVyLnByb21vdGlvbkxvZ3NNZXNzYWdlMik7XG5yb3V0ZXIuZ2V0KCcvYXBpL3Byb21vdGlvbi90b3Atdm90ZScsIGlzQXV0aGVudGljYXRlZCwgcHJvbW90aW9uQ29udHJvbGxlci5wcm9tb3Rpb25Mb2dzVG9wVm90ZSk7XG5cbnJvdXRlci5nZXQoJy9hcnRpc3RzJywgcGFzc3BvcnRDb25maWcuaXNKd3RBdXRob3JpemVkT3B0aW9uYWwsIGFydGlzdENvbnRyb2xsZXIuaW5kZXgpO1xucm91dGVyLnBvc3QoJy9hcGkvYXJ0aXN0L3NlYXJjaCcsIGFydGlzdENvbnRyb2xsZXIuc2VhcmNoKTtcbnJvdXRlci5nZXQoJy9hcGkvYXJ0aXN0L2MvOmNvbnRlc3RhbnRJZCcsIGFydGlzdENvbnRyb2xsZXIuZ2V0KTtcbnJvdXRlci5nZXQoJy9hcGkvYXJ0aXN0L2F1dG8tc3VnZ2VzdCcsIGFydGlzdENvbnRyb2xsZXIuYXV0b1N1Z2dlc3QpO1xucm91dGVyLnB1dCgnL2FwaS9hcnRpc3QvOmNvbnRlc3RhbnRJZCcsIGFydGlzdENvbnRyb2xsZXIudXBkYXRlKTtcbnJvdXRlci5wb3N0KCcvYXBpL2FydGlzdCcsIGFydGlzdENvbnRyb2xsZXIuY3JlYXRlKTtcbnJvdXRlci5nZXQoJy9hci86Y29udGVzdGFudElkJywgaXNKd3RBdXRob3JpemVkT3B0aW9uYWwsIGFydGlzdENvbnRyb2xsZXIuYXJ0aXN0UHVibGljUHJvZmlsZSk7XG5yb3V0ZXIuZ2V0KCcvYXIvOmNvbnRlc3RhbnRJZC86aGFzaCcsIGlzSnd0QXV0aG9yaXplZE9wdGlvbmFsLCBhcnRpc3RDb250cm9sbGVyLmFydGlzdFB1YmxpY1Byb2ZpbGUpO1xucm91dGVyLmdldCgnL2FydGlzdC86ZW50cnlJZCcsIGlzQXV0aGVudGljYXRlZCwgYXJ0aXN0Q29udHJvbGxlci5yZWRpcmVjdGVkVG9JbnRlcm5hbCk7XG5yb3V0ZXIuZ2V0KCcvYXJ0aXN0LzplbnRyeUlkLzpoYXNoJywgaXNKd3RBdXRob3JpemVkT3B0aW9uYWwsIGFydGlzdENvbnRyb2xsZXIucmVkaXJlY3RlZFRvSW50ZXJuYWwpO1xucm91dGVyLnBvc3QoJy9hcGkvYXJ0aXN0L2ZvbGxvdy86Y29udGVzdGFudElkJywgYXJ0aXN0Q29udHJvbGxlci5mb2xsb3cpO1xucm91dGVyLnBvc3QoJy9hcGkvYXJ0aXN0L2ZvbGxvdy86Y29udGVzdGFudElkLzpoYXNoJywgYXJ0aXN0Q29udHJvbGxlci5mb2xsb3cpO1xucm91dGVyLmdldCgnL3JhbmRvbWxvYWR0ZXN0aW5nMTAyNCcsIGV2ZW50Q29udHJvbGxlci5yYW5kb21Wb3RlVXJsKTtcbnJvdXRlci5wb3N0KCcvYXBpL2FydGlzdC9hZGQtdmlkZW8vOmFydGlzdElkJywgYXJ0aXN0Q29udHJvbGxlci5hZGRWaWRlbyk7XG5yb3V0ZXIucG9zdCgnL2FwaS93b28tY29tbWVyY2UtYXJ0aXN0LWxpc3QnLCBhcnRpc3RDb250cm9sbGVyLndvb0xpc3QpO1xucm91dGVyLnBvc3QoJy9hcGkvYXJ0aXN0L3NhdmUtcHJvZHVjdCcsIGFydGlzdENvbnRyb2xsZXIuc2F2ZVByb2R1Y3QpO1xucm91dGVyLmRlbGV0ZSgnL2FwaS9hcnRpc3QvcHJvZHVjdC86cHJvZHVjdElkJywgYXJ0aXN0Q29udHJvbGxlci5kZWxldGVQcm9kdWN0KTtcbnJvdXRlci5wYXRjaCgnL2FwaS9hcnRpc3QvcHJvZHVjdC86cHJvZHVjdElkJywgYXJ0aXN0Q29udHJvbGxlci5yZWZyZXNoUHJvZHVjdENhY2hlKTtcbnJvdXRlci5nZXQoJy9wci86ZXZlbnRJZCcsIHJlZ2lzdHJhdGlvbkNvbnRyb2xsZXIucHVibGljUmVnaXN0cmF0aW9uKTtcbnJvdXRlci5wb3N0KCcvcHIvOmV2ZW50SWQnLCByZWdpc3RyYXRpb25Db250cm9sbGVyLnB1YmxpY1JlZ2lzdHJhdGlvblBvc3QpO1xuLyoqXG4gKiBFcnJvciBIYW5kbGVyLiBQcm92aWRlcyBmdWxsIHN0YWNrIC0gcmVtb3ZlIGZvciBwcm9kdWN0aW9uXG4gKi9cbmFwcC51c2UoKGVycjogRXJyb3JEVE8sIHJlcTogUmVxdWVzdCwgcmVzOiBSZXNwb25zZSwgbmV4dDogTmV4dEZ1bmN0aW9uKSA9PiB7XG4gICAgdHJ5IHtcbiAgICAgICAgbG9nZ2VyLmVycm9yKGAke3JlcS51cmx9ICR7ZXJyLm1lc3NhZ2UgfHwgSlNPTi5zdHJpbmdpZnkoZXJyKX0gJHtlcnIuc3RhdHVzfSAke2Vyci5zdGFja30gcXVlcnkgJHtyZXEucXVlcnkgPyBKU09OLnN0cmluZ2lmeShyZXEucXVlcnkpIDogJyd9XG4gICAgYm9keSAke3JlcS5ib2R5ID8gSlNPTi5zdHJpbmdpZnkocmVxLmJvZHkpIDogJyd9IHBhcmFtcyAke3JlcS5wYXJhbXMgPyBKU09OLnN0cmluZ2lmeShyZXEucGFyYW1zKSA6ICcnfSBoZWFkZXJzICR7SlNPTi5zdHJpbmdpZnkocmVxLmhlYWRlcnMpfWApO1xuICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgICAgbG9nZ2VyLmVycm9yKGAke3JlcS51cmx9ICR7ZXJyLm1lc3NhZ2V9ICR7ZXJyLnN0YXR1c30gJHtlcnIuc3RhY2t9IHF1ZXJ5ICR7cmVxLnF1ZXJ5ID8gSlNPTi5zdHJpbmdpZnkocmVxLnF1ZXJ5KSA6ICcnfVxuICAgIGJvZHkgJHtyZXEuYm9keSA/IEpTT04uc3RyaW5naWZ5KHJlcS5ib2R5KSA6ICcnfSBwYXJhbXMgJHtyZXEucGFyYW1zID8gSlNPTi5zdHJpbmdpZnkocmVxLnBhcmFtcykgOiAnJ30gaGVhZGVycyAke0pTT04uc3RyaW5naWZ5KHJlcS5oZWFkZXJzKX1gKTtcblxuICAgIH1cbiAgICBpZiAoZXJyLnN0YXR1cykge1xuICAgICAgICByZXMuc3RhdHVzKGVyci5zdGF0dXMpO1xuICAgIH1cbiAgICBlbHNlIHtcbiAgICAgICAgcmVzLnN0YXR1cyg1MDApO1xuICAgIH1cbiAgICByZXMuanNvbihlcnIpO1xufSk7XG5hcHAudXNlKGAke3Byb2Nlc3MuZW52Lk1QfS9gIHx8ICcvYS8nLCByb3V0ZXIpO1xuLyoqXG4gKiBTdGFydCBFeHByZXNzIHNlcnZlci5cbiAqL1xuYXBwLmxpc3RlbihhcHAuZ2V0KCdwb3J0JyksICgpID0+IHtcbiAgICBsb2dnZXIuaW5mbyhgQXBwIGlzIHJ1bm5pbmcgYXQgaHR0cDovL2xvY2FsaG9zdDoke2FwcC5nZXQoJ3BvcnQnKX0gaW4gJHthcHAuZ2V0KCdlbnYnKX0gbW9kZSdgKTtcbiAgICBsb2dnZXIuaW5mbygnICBQcmVzcyBDVFJMLUMgdG8gc3RvcFxcbicpO1xufSk7XG5cbm1vZHVsZS5leHBvcnRzID0gYXBwOyJdfQ==
