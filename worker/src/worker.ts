/**
 * Module dependencies.
 */
import * as express from 'express';
import * as compression from 'compression';  // compresses requests
import * as bodyParser from 'body-parser';
import * as logger from 'morgan';
// @ts-ignore
import * as lusca from 'lusca';
import * as dotenv from 'dotenv';
import * as flash from 'express-flash';
import * as path from 'path';
import * as mongoose from 'mongoose';
import * as http from 'http';
// @ts-ignore
import expressValidator = require('express-validator');
require('./common/ArrayExtensions');
require('./common/StringExtensions');



/**
 * Load environment variables from .env file, where API keys and passwords are configured.
 */
dotenv.config({ path: path.join(__dirname, '.env') });

/**
 * API keys and Passport configuration.
 */
import { ErrorDTO } from '../../shared/ErrorDTO';
import { Request } from 'express';
import { Response } from 'express';
import { NextFunction } from 'express';


/**
 * Create Express server.
 */
const app = express();

const httpServer = http.createServer(app);

/**
 * Connect to MongoDB.
 */
// mongoose.Promise = global.Promise;
mongoose.connect(process.env.MONGODB_URI || process.env.MONGOLAB_URI);

mongoose.connection.on('error', () => {
    logger.info('MongoDB connection error. Please make sure MongoDB is running.');
    process.exit();
});

(<any>mongoose.Promise) = global.Promise;



/**
 * Express configuration.
 */
app.set('port', process.env.PORT || 3000);
app.set('views', path.join(__dirname, './views'));
app.set('view engine', 'pug');
app.use(compression());
app.use(logger('dev'));
app.use(bodyParser.json({limit: '20mb'}));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(expressValidator());
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
        !req.path.match(/\./)) {
        req.session.returnTo = req.path;
    } else if (req.user &&
        req.path == '/account') {
        req.session.returnTo = req.path;
    }
    next(); 
});
app.use(express.static(path.join(__dirname, 'public'), { maxAge: 31557600000 }));

io.on('connection', (socket) => {
    logger.info('a user connected', socket && socket.id);
});

/**
 * Boilerplate app routes.
 */
app.get('/login', userController.getLogin);
app.post('/login', userController.postLogin);
app.get('/logout', userController.logout);
app.get('/forgot', userController.getForgot);
app.post('/forgot', userController.postForgot);
app.get('/reset/:token', userController.getReset);
app.post('/reset/:token', userController.postReset);
app.get('/signup', userController.getSignup);
app.post('/signup', userController.postSignup);
app.get('/contact', contactController.getContact);
app.post('/contact', contactController.postContact);
app.get('/account', passportConfig.isAuthenticated, userController.getAccount);
app.get('/account/unlink/:provider', passportConfig.isAuthenticated, userController.getOauthUnlink);
app.post('/account/profile', passportConfig.isAuthenticated, userController.postUpdateProfile);
app.post('/account/password', passportConfig.isAuthenticated, userController.postUpdatePassword);
app.post('/account/delete', passportConfig.isAuthenticated, userController.postDeleteAccount);

/**
 * Primary app routes.
 */
app.get('/', homeController.index);
app.get('/event/:eventId/results', passportConfig.isAuthenticated, resultsController.index);
app.get('/event/:eventId/register', passportConfig.isAuthenticated, registrationController.index);
app.get('/event/:eventId/announce', passportConfig.isAuthenticated, eventController.getAnnounce);
app.post('/event/:eventId/announce', passportConfig.isAuthenticated, eventController.announce);
app.get('/event/eventList', eventController.eventListHtml); // for public and event registrants
/**
 * Api routes.
 */
app.get('/api/events', passportConfig.isAuthenticated, eventController.getEvents);
app.get('/api/event/:eventId', passportConfig.isAuthenticated, eventController.getEvent);
app.get('/api/event/:eventId/result', passportConfig.isAuthenticated, resultsController.result);
app.post('/api/event/', passportConfig.isAuthenticated, eventController.saveEvent);
app.delete('/api/event/:eventId', passportConfig.isAuthenticated, eventController.archiveEvent);
app.post('/api/event/:eventId/incrementround', passportConfig.isAuthenticated, eventController.incrementRound);
app.post('/api/vote/sms', eventController.voteSMS);
app.get('/api/event/:eventId/registrations', passportConfig.isAuthenticated, registrationController.getRegistrations);
app.put('/api/event/:eventId/register', passportConfig.isAuthenticated, registrationController.registerVoter);
app.get('/event/:eventId/votes', passportConfig.isAuthenticated, eventController.voterLogs);
app.get('/event/:eventId/registrations', passportConfig.isAuthenticated, eventController.registrationLogs);
app.get('/api/event/:eventId/votes-registrations', passportConfig.isAuthenticated, eventController.voteRegistrationsSeries);
app.get('/api/event/:eventId/votes-rounds', passportConfig.isAuthenticated, eventController.voteRoundSeries);
app.get('/user/:voterHash', registrationController.voterProfile);
app.get('/v/:voteHash', eventController.voteLink);
app.get('/api/vote/:text/:urlHash', eventController.handleVoteForm);
app.put('/api/gallery/:eventId/round/:roundNo/artist/:contestantId/hash/:hash', galleryController.upload);
app.get('/api/gallery/:eventId/round/:roundNo', galleryController.getRoundImages);
app.get('/api/event/:eventId/votes-rounds-channels', passportConfig.isAuthenticated, eventController.voteBarGraph);
app.get('/api/eventList', eventController.eventList); // for public and event registrants
app.get('/api/vr/static', vrController.staticContent);
app.get('/api/vote/:eventId/:contestantId/:roundNumber/:IsWinner', passportConfig.isAuthenticated, eventController.makeWinner);
app.put('/api/registration/status/:eventId/:registrationId/:statusIndex', passportConfig.isAuthenticated, registrationController.changeStatusInEvent);
app.get('/api/events-stats', passportConfig.isAuthenticated, eventController.eventStats);
/**
 * App routes
 */
// for registration
app.post('/api/register', registrationController.selfRegister);
// verification of registration
app.post('/api/verifyOtp', registrationController.verifyOtp);
// set nickname
app.post('/api/set-nick-name', passport.authenticate('jwt', { session: false }), registrationController.setNickName);
// for subsequent event registration
app.post('/api/register-with-token', passport.authenticate('jwt', { session: false }), registrationController.selfRegister);
// for saving notification preferences
app.post('/api/settings', passport.authenticate('jwt', { session: false }), registrationController.saveSettings);
// for getting notification preferences
app.get('/api/settings', passport.authenticate('jwt', { session: false }), registrationController.getSettings);
// about me
app.get('/api/about-me', passport.authenticate('jwt', { session: false }), registrationController.aboutMe);
// secretCode
app.post('/api/secret-code', passport.authenticate('jwt', { session: false }), registrationController.secretCode);
// logout
app.post('/api/logout', passport.authenticate('jwt', { session: false }), registrationController.logout);
/**
 * Error Handler. Provides full stack - remove for production
 */
app.use((err: ErrorDTO, req: Request, res: Response, next: NextFunction) => {
    console.error(err);
    if (err.status) {
        res.status(err.status);
    }
    else {
        res.status(500);
    }
    res.json(err);
});

/**
 * Start Express server.
 */
app.listen(app.get('port'), () => {
    logger.info(('  App is running at http://localhost:%d in %s mode'), app.get('port'), app.get('env'));
    logger.info('  Press CTRL-C to stop\n');
});

module.exports = app;