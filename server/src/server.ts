/**
 * The tracer should be imported first
 */
import './tracer';
/**
 * Module dependencies.
 */
import * as express from 'express';
import * as cors from 'cors';
import * as cookieParser from 'cookie-parser';
import * as compression from 'compression';  // compresses requests
import * as session from 'express-session';
import * as morgan from 'morgan';
import * as dotenv from 'dotenv';

/**
 * Load environment variables from .env file, where API keys and passwords are configured.
 */
import * as path from 'path';
dotenv.config({ path: path.join(__dirname, '.env') });
import logger, { LoggerStream } from './config/logger';
// @ts-ignore
import * as lusca from 'lusca';
import * as mongo from 'connect-mongo';
import * as flash from 'express-flash';
import * as mongoose from 'mongoose';
import * as passport from 'passport';
import * as socketio from 'socket.io';
import * as http from 'http';
// @ts-ignore

require('./common/ArrayExtensions');
require('./common/StringExtensions');


const MongoStore = mongo(session);



/**
 * Controllers (route handlers).
 */
import * as homeController from './controllers/home';
import * as userController from './controllers/user';
import * as contactController from './controllers/contact';
import * as eventController from './controllers/event';
import * as registrationController from './controllers/register';
import * as resultsController from './controllers/results';
import * as galleryController from './controllers/gallery';
import * as vrController from './controllers/vr';
import * as auctionController from './controllers/auction';
import * as promotionController from './controllers/promotion';
import * as promotionPhoneNUmberController from './controllers/promotionPhoneNumber';
import * as artistController from './controllers/artist';

/**
 * API keys and Passport configuration.
 */
import * as passportConfig from './config/passport';
import { ErrorDTO } from '../../shared/ErrorDTO';
import { Request, Router } from 'express';
import { Response } from 'express';
import { NextFunction } from 'express';
import * as SocketIO from 'socket.io';
import { isAuthenticated, isJwtAuthorized, isJwtAuthorizedOptional } from './config/passport';
import Socket = SocketIO.Socket;
import { editImages } from './controllers/ImageEditor';
import * as redis from 'redis';
import { promisify } from 'util';
// @ts-ignore
import multer = require('multer');

/**
 * Create Express server.
 */
const app = express();
const router = Router();
const httpServer = http.createServer(app);
const io = socketio(httpServer);

io.on('connection', (socket: SocketIO.Socket) => {
    logger.info('a user connected');
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
    logger.info('db connection successful');
}).catch((e: any) => {
    logger.error(`db connection failed  ${e}`);
    process.exit(24);
});
// for development only
// mongoose.set('debug', true);

mongoose.connection.on('error', () => {
    logger.error('MongoDB connection error. Please make sure MongoDB is running.');
    process.exit();
});
const redisClient = redis.createClient({
    host: process.env.REDIS_HOST,
    port: parseInt(process.env.REDIS_PORT)
});

redisClient.on('error', (err: string) => {
    logger.error('Redis Error' + err);
});

const redisGet = promisify(redisClient.get).bind(redisClient);
const redisSet = promisify(redisClient.set).bind(redisClient);
const redisDel = promisify(redisClient.del).bind(redisClient);

(<any>mongoose.Promise) = global.Promise;

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
app.use(morgan('combined', { stream: new LoggerStream() }));
// app.use(logger('dev'));
app.use(express.json({limit: '100mb'}));
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

const corsUrls: string[] = process.env.APP_CORS_URLS.split(',');
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
            maxAge: 5, // Optional
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
app.use((req: Request, res: Response, next: NextFunction) => {
    res.locals.user = req.user;
    next();
});
app.use((req: Request, res: Response, next: NextFunction) => {
    // After successful login, redirect back to the intended page
    if (!req.user &&
        req.path !== '/login' &&
        req.path !== '/signup' &&
        !req.path.match(/^\/auth/) &&
        !req.path.match(/\./) &&
        !req.path.match(/^\/api/)) {
        req.session.returnTo = req.path;
    } else if (req.user &&
        req.path == '/account') {
        req.session.returnTo = req.path;
    }
    next();
});
app.use(connect_datadog);
app.use(process.env.MP, express.static(path.join(__dirname, 'public'), {
    maxAge: 31557600000,
    /*setHeaders: function (res, path, stat) {
        res.header('Access-Control-Allow-Origin', process.env.APP_CORS_URLS);
        res.header('Access-Control-Allow-Methods', 'GET');
        res.header('Access-Control-Allow-Headers', 'Content-Type');
    }*/
}));

io.on('connection', (socket: Socket) => {
    logger.info('a user connected', socket && socket.id);
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
router.get('/event/edit-images/:eventId', passportConfig.isAuthenticated, editImages);
/**
 * Primary app routes.
 */
router.get('/', passportConfig.isAuthenticated, homeController.index);
router.get('/event/:eventId/results', passportConfig.isAuthenticated, resultsController.index);
router.post('/api/event/copy-winner', passportConfig.isAuthenticated, resultsController.copyWinner);
router.get('/event/:eventId/register', passportConfig.isAuthenticated, registrationController.index);
router.get('/event/:eventId/announce', passportConfig.isAuthenticated, eventController.getAnnounce);
router.post('/event/:eventId/announce', passportConfig.isAuthenticated, eventController.announce);
router.get('/event/eventList', isJwtAuthorizedOptional, eventController.eventListHtml); // for public and event registrants
router.get('/event/:eventId/detail', isJwtAuthorizedOptional, eventController.eventListHtml); // for public and event registrants
router.get('/preferences', isJwtAuthorized, registrationController.preferences);
router.get('/p/:p', passportConfig.isAuthenticated, promotionController.userProfile);
router.post('/p/:p', passportConfig.isAuthenticated, promotionController.userProfileSendMessage);
router.get('/api/jwt-login', isJwtAuthorized, registrationController.jwtLogin);
router.get('/alogin', isJwtAuthorizedOptional, registrationController.appRedirect);
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
router.get('/v/:voteHash/upload', isJwtAuthorizedOptional, eventController.voteLink);
router.get('/v/:voteHash', isJwtAuthorizedOptional, eventController.eventListHtml);
router.get('/api/vote/:RoundNumber/:text/:urlHash', eventController.handleVoteForm);
router.put('/api/gallery/:eventId/round/:roundNo/artist/:contestantId/hash/:hash', galleryController.upload);
router.put('/api/event/edit-images/upload/:eventId/round/:roundNo/artist/:contestantId/index/:index', passportConfig.isAuthenticated, galleryController.uploadEdit);
/*resumable upload start*/
const upload = multer({ dest: path.resolve(`${__dirname}/public/uploads/images/originals`) });
router.post('/api/gallery/getMediaId/:hash'/*, passportConfig.isAuthenticated*/, galleryController.getMediaId);
router.post('/api/gallery/upload'/*, passportConfig.isAuthenticated*/, upload.array('file'), galleryController.resumableUpload);
router.get('/api/gallery/upload'/*, passportConfig.isAuthenticated*/, galleryController.checkUpload);
router.post('/api/gallery/link-upload'/*, passportConfig.isAuthenticated*/, galleryController.linkUpload);
/*resumable upload end*/
router.get('/api/gallery/:eventId/round/:roundNo', galleryController.getRoundImages);
router.get('/api/event/:eventId/votes-rounds-channels', passportConfig.isAuthenticated, eventController.voteBarGraph);
router.get('/api/eventList', isJwtAuthorizedOptional, eventController.eventList); // for public and event registrants, webkit
router.get('/api/event/:eventId/view', isJwtAuthorized, eventController.viewEvent);

router.get('/api/vr/static', vrController.staticContent);
router.get('/api/vr/load/:eventPageNo/:roundPageNo', vrController.loadRoundInEvent);
router.post('/api/vr/vote/:eventId/:userId/:round/:easel', vrController.Vote);

router.get('/api/vote/:eventId/:contestantId/:roundNumber/:IsWinner', passportConfig.isAuthenticated, eventController.makeWinner);
router.get('/api/auction/:eventId/:roundNumber/:contestantId/:EnableAuction', isJwtAuthorizedOptional, auctionController.changeAuctionStatus);
router.get('/a',  passportConfig.isJwtAuthorizedOptional, auctionController.eventsWithAuctionHtml);
router.get('/auction', passportConfig.isJwtAuthorizedOptional, auctionController.eventsWithAuctionHtml);
router.get('/a/r/:registrationHash', auctionController.eventsWithAuctionHtml);
router.get('/a/:artId',  passportConfig.isJwtAuthorizedOptional, auctionController.auctionDetailHtml);
router.get('/a/:artId/r/:registrationHash',  passportConfig.isJwtAuthorizedOptional, auctionController.auctionDetailHtml);
router.get('/api/auction/events',  passportConfig.isJwtAuthorizedOptional, auctionController.eventsWithAuction);
router.get('/api/auction/:ArtId',  passportConfig.isJwtAuthorizedOptional, auctionController.auctionDetail);
router.put('/api/auction/bid/:artId/:bid',  passportConfig.isJwtAuthorized, auctionController.bid);
router.get('/api/auction/notify/:eventId',  passportConfig.isAuthenticated, auctionController.notifyAuctionOpen);
router.get('/api/auction/notify-short-link/:eventId', isAuthenticated, auctionController.sendShortAuctionLink);
router.get('/api/auction/export-to-google-sheet/:eventId',  passportConfig.isAuthenticated, auctionController.exportToGoogleSheet);
router.put('/api/auction/saveLotConfig/:artId',  passportConfig.isJwtAuthorizedOptional, auctionController.saveLotConfig);
router.post('/api/auction/payment-status', isAuthenticated, auctionController.AuctionPaymentStatus);
router.get('/api/auction/list/payment-status-options', isAuthenticated, auctionController.AuctionPaymentStatusOptions);
router.post('/api/auction/mark-buyer-paid', isAuthenticated, auctionController.MarkBuyerPaid);
router.post('/api/auction/mark-artist-paid', isAuthenticated, auctionController.MarkArtistPaid);
router.get('/api/auction/auto-close/:eventId/:enableAutoClose', isAuthenticated, auctionController.autoClose);
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
router.post('/api/save', isJwtAuthorized, registrationController.setNickName);
// set nickname
router.post('/api/set-nick-name', isJwtAuthorized, registrationController.setNickName);
// for subsequent event registration
router.post('/api/register-with-token', isJwtAuthorized, registrationController.selfRegister);
// for saving notification preferences
router.post('/api/settings', isJwtAuthorized, registrationController.saveSettings);
// for getting notification preferences
router.get('/api/settings', isJwtAuthorized, registrationController.getSettings);
// about me
router.get('/api/about-me', isJwtAuthorized, registrationController.aboutMe);
// secretCode
router.post('/api/secret-code', isJwtAuthorized, registrationController.secretCode);
// logout
router.post('/api/logout', isJwtAuthorizedOptional, registrationController.logout);
// vote
router.post('/api/vote/app/:eventId/:RoundNumber/:easelNumber', isJwtAuthorized, eventController.appVote);
// admin
router.get('/admin', isJwtAuthorizedOptional, registrationController.admin);
router.get('/admin/:phoneHash', isJwtAuthorizedOptional, registrationController.admin);
router.get('/profile', isJwtAuthorizedOptional, registrationController.profile);
router.get('/tickets', (req: Request, res: Response, next: NextFunction) => {
        res.status(301).redirect(process.env.FRONTEND_LINK + '/all');
});

router.get('/api/promotion/event-list', isAuthenticated, promotionController.getEvents);
router.get('/promotion/send', isAuthenticated, promotionController.sendPromotion);
router.get('/api/promotion-phonenumber/', isAuthenticated, promotionPhoneNUmberController.getEventPhoneNumber);

router.post('/api/promotion/save', isAuthenticated, promotionController.savePromotion);
router.post('/api/promotion/guest-count', isAuthenticated, eventController.getEventGuestCount);
router.post('/api/promotion/filter-guest-count', isAuthenticated, eventController.getEventFilterGuestCount);
router.post('/api/promotion/send-notification', isAuthenticated, promotionController.sendPromotionNotifications);
router.post('/api/promotion/device-count', isAuthenticated, promotionController.getDeviceCounts);
router.get('/api/promotion/logs', isAuthenticated, promotionController.logs);
router.get('/api/promotion/message-logs', isAuthenticated, promotionController.promotionLogsMessage2);
router.get('/api/promotion/top-vote', isAuthenticated, promotionController.promotionLogsTopVote);

router.get('/artists', passportConfig.isJwtAuthorizedOptional, artistController.index);
router.post('/api/artist/search', artistController.search);
router.get('/api/artist/c/:contestantId', artistController.get);
router.get('/api/artist/auto-suggest', artistController.autoSuggest);
router.put('/api/artist/:contestantId', artistController.update);
router.post('/api/artist', artistController.create);
router.get('/ar/:contestantId', isJwtAuthorizedOptional, artistController.artistPublicProfile);
router.get('/ar/:contestantId/:hash', isJwtAuthorizedOptional, artistController.artistPublicProfile);
router.get('/artist/:entryId', isAuthenticated, artistController.redirectedToInternal);
router.get('/artist/:entryId/:hash', isJwtAuthorizedOptional, artistController.redirectedToInternal);
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
app.use((err: ErrorDTO, req: Request, res: Response, next: NextFunction) => {
    try {
        logger.error(`${req.url} ${err.message || JSON.stringify(err)} ${err.status} ${err.stack} query ${req.query ? JSON.stringify(req.query) : ''}
    body ${req.body ? JSON.stringify(req.body) : ''} params ${req.params ? JSON.stringify(req.params) : ''} headers ${JSON.stringify(req.headers)}`);
    } catch (e) {
        logger.error(`${req.url} ${err.message} ${err.status} ${err.stack} query ${req.query ? JSON.stringify(req.query) : ''}
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
    logger.info(`App is running at http://localhost:${app.get('port')} in ${app.get('env')} mode'`);
    logger.info('  Press CTRL-C to stop\n');
});

module.exports = app;