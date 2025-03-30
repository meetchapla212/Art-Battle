"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendNotificationToUser = exports.userInformation = exports.postForgot = exports.getForgot = exports.postReset = exports.getReset = exports.getOauthUnlink = exports.postDeleteAccount = exports.postUpdatePassword = exports.postUpdateProfile = exports.getAccount = exports.postSignup = exports.getSignup = exports.logout = exports.postLogin = exports.getLogin = void 0;
const async = require("async");
const crypto = require("crypto");
const nodemailer = require("nodemailer");
const passport = require("passport");
const User_1 = require("../models/User");
const express_validator_1 = require("express-validator");
const request = require('express-validator');
const { check, validationResult } = require('express-validator');
const logger_1 = require("../config/logger");
const Registration_1 = require("../models/Registration");
const Preference_1 = require("../models/Preference");
const Apns_1 = require("../common/Apns");
const FCM_1 = require("../common/FCM");
/**
 * GET /login
 * Login page.
 */
exports.getLogin = (req, res) => {
    if (req.user) {
        return res.redirect(`${process.env.ADMIN_URL}` + '/');
    }
    res.render('account/login', {
        title: 'Login'
    });
};
/**
 * POST /login
 * Sign in using email and password.
 */
exports.postLogin = async (req, res, next) => {
    await check('email', 'Email is not valid').isEmail().run(req);
    await check('password', 'Password cannot be blank').not().isEmpty().run(req);
    await express_validator_1.sanitize('email').normalizeEmail({ gmail_remove_dots: false }).run(req);
    const result = validationResult(req);
    const hasErrors = !result.isEmpty();
    if (hasErrors) {
        req.flash('errors', result.array());
        return res.redirect(`${process.env.ADMIN_URL}` + '/login');
    }
    passport.authenticate('local', (err, user, info) => {
        if (err) {
            return next(err);
        }
        if (!user) {
            req.flash('errors', info.message);
            return res.redirect(`${process.env.ADMIN_URL}` + '/login');
        }
        req.logIn(user, (err) => {
            if (err) {
                return next(err);
            }
            req.flash('success', { msg: 'Success! You are logged in.' });
            res.redirect(req.session.returnTo || '/');
        });
    })(req, res, next);
};
/**
 * GET /logout
 * Log out.
 */
exports.logout = (req, res) => {
    res.clearCookie('jwt');
    req.logout();
    res.redirect(`${process.env.ADMIN_URL}` + '/');
};
/**
 * GET /signup
 * Signup page.
 */
exports.getSignup = (req, res) => {
    if (req.user) {
        return res.redirect(`${process.env.ADMIN_URL}`);
    }
    res.render('account/signup', {
        title: 'Create Account'
    });
};
/**
 * POST /signup
 * Create a new local account.
 */
exports.postSignup = async (req, res, next) => {
    await check('email', 'Email is not valid').isEmail().run(req);
    await check('password', 'Password must be at least 4 characters long').isLength({ min: 4 }).run(req);
    await check('confirmPassword', 'Passwords do not match').isLength({ min: 4 }).equals(req.body.password).run(req);
    await express_validator_1.sanitize('email').normalizeEmail({ gmail_remove_dots: false }).run(req);
    const result = validationResult(req);
    const hasErrors = !result.isEmpty();
    if (hasErrors) {
        req.flash('errors', result.array());
        return res.redirect('/signup');
    }
    const user = new User_1.default({
        email: req.body.email,
        password: req.body.password
    });
    User_1.default.findOne({ email: req.body.email }, (err, existingUser) => {
        if (err) {
            return next(err);
        }
        if (existingUser) {
            req.flash('errors', { msg: 'Account with that email address already exists.' });
            return res.redirect('/signup');
        }
        user.save((err) => {
            if (err) {
                return next(err);
            }
            req.logIn(user, (err) => {
                if (err) {
                    return next(err);
                }
                res.redirect(`${process.env.ADMIN_URL}`);
            });
        });
    });
};
/**
 * GET /account
 * Profile page.
 */
exports.getAccount = (req, res) => {
    if (!req.user) {
        res.clearCookie('jwt');
        req.logout();
        res.redirect(`${process.env.ADMIN_URL}`);
        return;
    }
    res.render('account/profile', {
        title: 'Account Management'
    });
};
/**
 * POST /account/profile
 * Update profile information.
 */
exports.postUpdateProfile = async (req, res, next) => {
    await check('email', 'Please enter a valid email address.').isEmail().run(req);
    await express_validator_1.sanitize('email').normalizeEmail({ gmail_remove_dots: false }).run(req);
    const errors = validationResult();
    if (errors) {
        req.flash('errors', errors);
        return res.redirect('/account');
    }
    User_1.default.findById(req.user.id, (err, user) => {
        if (err) {
            return next(err);
        }
        user.email = req.body.email || '';
        user.profile.name = req.body.name || '';
        user.profile.gender = req.body.gender || '';
        user.profile.location = req.body.location || '';
        user.profile.website = req.body.website || '';
        user.save((err) => {
            if (err) {
                if (err.code === 11000) {
                    req.flash('errors', { msg: 'The email address you have entered is already associated with an account.' });
                    return res.redirect('/account');
                }
                return next(err);
            }
            req.flash('success', { msg: 'Profile information has been updated.' });
            res.redirect('/account');
        });
    });
};
/**
 * POST /account/password
 * Update current password.
 */
exports.postUpdatePassword = async (req, res, next) => {
    await check('password', 'Password must be at least 4 characters long').isLength({ min: 4 }).run(req);
    await check('confirmPassword', 'Passwords do not match').isLength({ min: 4 }).equals(req.body.password).run(req);
    const errors = validationResult(req);
    if (errors) {
        req.flash('errors', errors);
        return res.redirect('/account');
    }
    User_1.default.findById(req.user.id, (err, user) => {
        if (err) {
            return next(err);
        }
        user.password = req.body.password;
        user.save((err) => {
            if (err) {
                return next(err);
            }
            req.flash('success', { msg: 'Password has been changed.' });
            res.redirect('/account');
        });
    });
};
/**
 * POST /account/delete
 * Delete user account.
 */
exports.postDeleteAccount = (req, res, next) => {
    User_1.default.remove({ _id: req.user.id }, (err) => {
        if (err) {
            return next(err);
        }
        req.logout();
        req.flash('info', { msg: 'Your account has been deleted.' });
        res.redirect(`${process.env.ADMIN_URL}`);
    });
};
/**
 * GET /account/unlink/:provider
 * Unlink OAuth provider.
 */
exports.getOauthUnlink = (req, res, next) => {
    const provider = req.params.provider;
    User_1.default.findById(req.user.id, (err, user) => {
        if (err) {
            return next(err);
        }
        user[provider] = undefined;
        user.tokens = user.tokens.filter((token) => token.kind !== provider);
        user.save((err) => {
            if (err) {
                return next(err);
            }
            req.flash('info', { msg: `${provider} account has been unlinked.` });
            res.redirect('/account');
        });
    });
};
/**
 * GET /reset/:token
 * Reset Password page.
 */
exports.getReset = (req, res, next) => {
    if (req.isAuthenticated()) {
        return res.redirect(`${process.env.ADMIN_URL}`);
    }
    User_1.default
        .findOne({ passwordResetToken: req.params.token })
        .where('passwordResetExpires').gt(Date.now())
        .exec((err, user) => {
        if (err) {
            return next(err);
        }
        if (!user) {
            req.flash('errors', { msg: 'Password reset token is invalid or has expired.' });
            return res.redirect('/forgot');
        }
        res.render('account/reset', {
            title: 'Password Reset'
        });
    });
};
/**
 * POST /reset/:token
 * Process the reset password request.
 */
exports.postReset = async (req, res, next) => {
    await check('password', 'Password must be at least 4 characters long').isLength({ min: 4 }).run(req);
    await check('confirm', 'Passwords do not match').isLength({ min: 4 }).equals(req.body.password).run(req);
    const errors = validationResult(req);
    if (errors) {
        req.flash('errors', errors);
        return res.redirect('back');
    }
    async.waterfall([
        function resetPassword(done) {
            User_1.default
                .findOne({ passwordResetToken: req.params.token })
                .where('passwordResetExpires').gt(Date.now())
                .exec((err, user) => {
                if (err) {
                    return next(err);
                }
                if (!user) {
                    req.flash('errors', { msg: 'Password reset token is invalid or has expired.' });
                    return res.redirect('back');
                }
                user.password = req.body.password;
                user.passwordResetToken = undefined;
                user.passwordResetExpires = undefined;
                user.save((err) => {
                    if (err) {
                        return next(err);
                    }
                    req.logIn(user, (err) => {
                        done(err, user);
                    });
                });
            });
        },
        function sendResetPasswordEmail(user, done) {
            const transporter = nodemailer.createTransport({
                service: 'SendGrid',
                auth: {
                    user: process.env.SENDGRID_USER,
                    pass: process.env.SENDGRID_PASSWORD
                }
            });
            const mailOptions = {
                to: user.email,
                from: 'express-ts@starter.com',
                subject: 'Your password has been changed',
                text: `Hello,\n\nThis is a confirmation that the password for your account ${user.email} has just been changed.\n`
            };
            transporter.sendMail(mailOptions, (err) => {
                req.flash('success', { msg: 'Success! Your password has been changed.' });
                done(err);
            });
        }
    ], (err) => {
        if (err) {
            return next(err);
        }
        res.redirect(`${process.env.ADMIN_URL}`);
    });
};
/**
 * GET /forgot
 * Forgot Password page.
 */
exports.getForgot = (req, res) => {
    if (req.isAuthenticated()) {
        return res.redirect(`${process.env.ADMIN_URL}`);
    }
    res.render('account/forgot', {
        title: 'Forgot Password'
    });
};
/**
 * POST /forgot
 * Create a random token, then the send user an email with a reset link.
 */
exports.postForgot = async (req, res, next) => {
    await check('email', 'Please enter a valid email address.').isEmail().run(req);
    await express_validator_1.sanitize('email').normalizeEmail({ gmail_remove_dots: false }).run(req);
    const errors = validationResult(req);
    if (errors) {
        req.flash('errors', errors);
        return res.redirect(`${process.env.ADMIN_URL}` + '/forgot');
    }
    async.waterfall([
        function createRandomToken(done) {
            crypto.randomBytes(16, (err, buf) => {
                const token = buf.toString('hex');
                done(err, token);
            });
        },
        function setRandomToken(token, done) {
            User_1.default.findOne({ email: req.body.email }, (err, user) => {
                if (err) {
                    return done(err);
                }
                if (!user) {
                    req.flash('errors', { msg: 'Account with that email address does not exist.' });
                    return res.redirect(`${process.env.ADMIN_URL}` + '/forgot');
                }
                user.passwordResetToken = token;
                user.passwordResetExpires = Date.now() + 3600000; // 1 hour
                user.save((err) => {
                    done(err, token, user);
                });
            });
        },
        function sendForgotPasswordEmail(token, user, done) {
            const transporter = nodemailer.createTransport({
                service: 'SendGrid',
                auth: {
                    user: process.env.SENDGRID_USER,
                    pass: process.env.SENDGRID_PASSWORD
                }
            });
            const mailOptions = {
                to: user.email,
                from: 'hackathon@starter.com',
                subject: 'Reset your password on Hackathon Starter',
                text: `You are receiving this email because you (or someone else) have requested the reset of the password for your account.\n\n
          Please click on the following link, or paste this into your browser to complete the process:\n\n
          http://${req.headers.host}/reset/${token}\n\n
          If you did not request this, please ignore this email and your password will remain unchanged.\n`
            };
            transporter.sendMail(mailOptions, (err) => {
                req.flash('info', { msg: `An e-mail has been sent to ${user.email} with further instructions.` });
                done(err);
            });
        }
    ], (err) => {
        if (err) {
            return next(err);
        }
        res.redirect(`${process.env.ADMIN_URL}` + '/forgot');
    });
};
exports.userInformation = async (req, res, next) => {
    try {
        const results = await Promise.all([
            Registration_1.default.findById(req.params.id),
            Preference_1.default.find({})
        ]);
        const registration = results[0];
        const preferences = results[1];
        if (registration) {
            const userPreferences = [];
            for (let i = 0; i < preferences.length; i++) {
                if (registration.Preferences.indexOf(preferences[i]._id.toString()) > -1) {
                    userPreferences.push({
                        preference: preferences[i],
                        enabled: true
                    });
                }
                else {
                    userPreferences.push({
                        preference: preferences[i],
                        enabled: false
                    });
                }
            }
            res.render('user/profile', {
                title: 'User profile',
                phoneNumber: registration.PhoneNumber,
                nickName: registration.NickName,
                preferences: userPreferences,
                deviceTokens: registration.DeviceTokens || [],
                registrationId: registration._id
            });
        }
        else {
            next({
                status: 404,
                message: 'user not found'
            });
        }
    }
    catch (e) {
        next(e);
    }
};
exports.sendNotificationToUser = async (req, res, next) => {
    try {
        const registration = await Registration_1.default.findById(req.params.id);
        if (!registration) {
            next({
                status: 404,
                message: 'user not found'
            });
            return;
        }
        const badDeviceTokens = await Apns_1.default(registration.DeviceTokens, 'Artbattle test notification', 'Artbattle  test').catch(e => logger_1.default.info(`push notification failed`, e));
        const androidRes = await FCM_1.MultiCast({
            DeviceTokens: registration.AndroidDeviceTokens,
            link: 'https://app.artbattle.com/profile',
            title: 'WebView Test',
            message: 'Clicking on me would send you to a webview',
            priority: 'normal',
            analyticsLabel: 'WebView Test'
        });
        logger_1.default.info('test notification on android ' + JSON.stringify(androidRes, null, 1));
        req.flash('success', { msg: 'Success! notification sent.' });
        res.redirect(`${process.env.ADMIN_URL}` + `/user/info/${registration._id}`);
    }
    catch (e) {
        next(e);
    }
};

//# sourceMappingURL=data:application/json;charset=utf8;base64,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UyxFQUFFLEVBQUUsR0FBRyxFQUFFLDZCQUE2QixFQUFFLENBQUMsQ0FBQztRQUM3RCxHQUFHLENBQUMsUUFBUSxDQUFDLEdBQUcsT0FBTyxDQUFDLEdBQUcsQ0FBQyxTQUFTLEVBQUUsR0FBRyxjQUFjLFlBQVksQ0FBQyxHQUFHLEVBQUUsQ0FBQyxDQUFDO0tBQy9FO0lBQUMsT0FBTyxDQUFDLEVBQUU7UUFDVixJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUM7S0FDVDtBQUNILENBQUMsQ0FBQyIsImZpbGUiOiJjb250cm9sbGVycy91c2VyLmpzIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0ICogYXMgYXN5bmMgZnJvbSAnYXN5bmMnO1xuaW1wb3J0ICogYXMgY3J5cHRvIGZyb20gJ2NyeXB0byc7XG5pbXBvcnQgKiBhcyBub2RlbWFpbGVyIGZyb20gJ25vZGVtYWlsZXInO1xuaW1wb3J0ICogYXMgcGFzc3BvcnQgZnJvbSAncGFzc3BvcnQnO1xuaW1wb3J0IHsgZGVmYXVsdCBhcyBVc2VyLCBVc2VyRG9jdW1lbnQgfSBmcm9tICcuLi9tb2RlbHMvVXNlcic7XG5pbXBvcnQgVXNlckRUTywgeyBBdXRoVG9rZW4gfSBmcm9tICcuLi8uLi8uLi9zaGFyZWQvVXNlckRUTyc7XG5pbXBvcnQgeyBSZXF1ZXN0LCBSZXNwb25zZSwgTmV4dEZ1bmN0aW9uIH0gZnJvbSAnZXhwcmVzcyc7XG5pbXBvcnQgeyBMb2NhbFN0cmF0ZWd5SW5mbyB9IGZyb20gJ3Bhc3Nwb3J0LWxvY2FsJztcbmltcG9ydCB7IFdyaXRlRXJyb3IgfSBmcm9tICdtb25nb2RiJztcbmltcG9ydCB7IHNhbml0aXplIH0gZnJvbSAnZXhwcmVzcy12YWxpZGF0b3InO1xuY29uc3QgcmVxdWVzdCA9IHJlcXVpcmUoJ2V4cHJlc3MtdmFsaWRhdG9yJyk7XG5jb25zdCB7IGNoZWNrLCB2YWxpZGF0aW9uUmVzdWx0IH0gPSByZXF1aXJlKCdleHByZXNzLXZhbGlkYXRvcicpO1xuaW1wb3J0IGxvZ2dlciBmcm9tICcuLi9jb25maWcvbG9nZ2VyJztcbmltcG9ydCBSZWdpc3RyYXRpb25Nb2RlbCBmcm9tICcuLi9tb2RlbHMvUmVnaXN0cmF0aW9uJztcbmltcG9ydCBQcmVmZXJlbmNlTW9kZWwgZnJvbSAnLi4vbW9kZWxzL1ByZWZlcmVuY2UnO1xuaW1wb3J0IHNlbmROb3RpZmljYXRpb24gZnJvbSAnLi4vY29tbW9uL0FwbnMnO1xuaW1wb3J0IHsgTXVsdGlDYXN0IH0gZnJvbSAnLi4vY29tbW9uL0ZDTSc7XG4vKipcbiAqIEdFVCAvbG9naW5cbiAqIExvZ2luIHBhZ2UuXG4gKi9cbmV4cG9ydCBsZXQgZ2V0TG9naW4gPSAocmVxOiBSZXF1ZXN0LCByZXM6IFJlc3BvbnNlKSA9PiB7XG4gIGlmIChyZXEudXNlcikge1xuICAgIHJldHVybiByZXMucmVkaXJlY3QoYCR7cHJvY2Vzcy5lbnYuQURNSU5fVVJMfWAgKyAnLycpO1xuICB9XG4gIHJlcy5yZW5kZXIoJ2FjY291bnQvbG9naW4nLCB7XG4gICAgdGl0bGU6ICdMb2dpbidcbiAgfSk7XG59O1xuXG4vKipcbiAqIFBPU1QgL2xvZ2luXG4gKiBTaWduIGluIHVzaW5nIGVtYWlsIGFuZCBwYXNzd29yZC5cbiAqL1xuZXhwb3J0IGxldCBwb3N0TG9naW4gPSBhc3luYyhyZXE6IFJlcXVlc3QsIHJlczogUmVzcG9uc2UsIG5leHQ6IE5leHRGdW5jdGlvbikgPT4ge1xuICBhd2FpdCBjaGVjaygnZW1haWwnLCAnRW1haWwgaXMgbm90IHZhbGlkJykuaXNFbWFpbCgpLnJ1bihyZXEpO1xuICBhd2FpdCBjaGVjaygncGFzc3dvcmQnLCAnUGFzc3dvcmQgY2Fubm90IGJlIGJsYW5rJykubm90KCkuaXNFbXB0eSgpLnJ1bihyZXEpO1xuICBhd2FpdCBzYW5pdGl6ZSgnZW1haWwnKS5ub3JtYWxpemVFbWFpbCh7IGdtYWlsX3JlbW92ZV9kb3RzOiBmYWxzZSB9KS5ydW4ocmVxKTtcblxuICBjb25zdCByZXN1bHQgPSB2YWxpZGF0aW9uUmVzdWx0KHJlcSk7XG4gIGNvbnN0IGhhc0Vycm9ycyA9ICFyZXN1bHQuaXNFbXB0eSgpO1xuICBpZiAoaGFzRXJyb3JzKSB7XG4gICAgcmVxLmZsYXNoKCdlcnJvcnMnLCByZXN1bHQuYXJyYXkoKSk7XG4gICAgcmV0dXJuIHJlcy5yZWRpcmVjdChgJHtwcm9jZXNzLmVudi5BRE1JTl9VUkx9YCArICcvbG9naW4nKTtcbiAgfVxuXG4gIHBhc3Nwb3J0LmF1dGhlbnRpY2F0ZSgnbG9jYWwnLCAoZXJyOiBFcnJvciwgdXNlcjogVXNlckRvY3VtZW50LCBpbmZvOiBMb2NhbFN0cmF0ZWd5SW5mbykgPT4ge1xuICAgIGlmIChlcnIpIHsgcmV0dXJuIG5leHQoZXJyKTsgfVxuICAgIGlmICghdXNlcikge1xuICAgICAgcmVxLmZsYXNoKCdlcnJvcnMnLCBpbmZvLm1lc3NhZ2UpO1xuICAgICAgcmV0dXJuIHJlcy5yZWRpcmVjdChgJHtwcm9jZXNzLmVudi5BRE1JTl9VUkx9YCArICcvbG9naW4nKTtcbiAgICB9XG4gICAgcmVxLmxvZ0luKHVzZXIsIChlcnI6IEVycm9yKSA9PiB7XG4gICAgICBpZiAoZXJyKSB7IHJldHVybiBuZXh0KGVycik7IH1cbiAgICAgIHJlcS5mbGFzaCgnc3VjY2VzcycsIHsgbXNnOiAnU3VjY2VzcyEgWW91IGFyZSBsb2dnZWQgaW4uJyB9KTtcbiAgICAgIHJlcy5yZWRpcmVjdChyZXEuc2Vzc2lvbi5yZXR1cm5UbyB8fCAnLycpO1xuICAgIH0pO1xuICB9KShyZXEsIHJlcywgbmV4dCk7XG59O1xuXG4vKipcbiAqIEdFVCAvbG9nb3V0XG4gKiBMb2cgb3V0LlxuICovXG5leHBvcnQgbGV0IGxvZ291dCA9IChyZXE6IFJlcXVlc3QsIHJlczogUmVzcG9uc2UpID0+IHtcbiAgcmVzLmNsZWFyQ29va2llKCdqd3QnKTtcbiAgcmVxLmxvZ291dCgpO1xuICByZXMucmVkaXJlY3QoYCR7cHJvY2Vzcy5lbnYuQURNSU5fVVJMfWAgKyAnLycpO1xufTtcblxuLyoqXG4gKiBHRVQgL3NpZ251cFxuICogU2lnbnVwIHBhZ2UuXG4gKi9cbmV4cG9ydCBsZXQgZ2V0U2lnbnVwID0gKHJlcTogUmVxdWVzdCwgcmVzOiBSZXNwb25zZSkgPT4ge1xuICBpZiAocmVxLnVzZXIpIHtcbiAgICByZXR1cm4gcmVzLnJlZGlyZWN0KGAke3Byb2Nlc3MuZW52LkFETUlOX1VSTH1gKTtcbiAgfVxuICByZXMucmVuZGVyKCdhY2NvdW50L3NpZ251cCcsIHtcbiAgICB0aXRsZTogJ0NyZWF0ZSBBY2NvdW50J1xuICB9KTtcbn07XG5cbi8qKlxuICogUE9TVCAvc2lnbnVwXG4gKiBDcmVhdGUgYSBuZXcgbG9jYWwgYWNjb3VudC5cbiAqL1xuZXhwb3J0IGxldCBwb3N0U2lnbnVwID0gYXN5bmMocmVxOiBSZXF1ZXN0LCByZXM6IFJlc3BvbnNlLCBuZXh0OiBOZXh0RnVuY3Rpb24pID0+IHtcbiAgYXdhaXQgY2hlY2soJ2VtYWlsJywgJ0VtYWlsIGlzIG5vdCB2YWxpZCcpLmlzRW1haWwoKS5ydW4ocmVxKTtcbiAgYXdhaXQgY2hlY2soJ3Bhc3N3b3JkJywgJ1Bhc3N3b3JkIG11c3QgYmUgYXQgbGVhc3QgNCBjaGFyYWN0ZXJzIGxvbmcnKS5pc0xlbmd0aCh7IG1pbjogNCB9KS5ydW4ocmVxKTtcbiAgYXdhaXQgY2hlY2soJ2NvbmZpcm1QYXNzd29yZCcsICdQYXNzd29yZHMgZG8gbm90IG1hdGNoJykuaXNMZW5ndGgoeyBtaW46IDQgfSkuZXF1YWxzKHJlcS5ib2R5LnBhc3N3b3JkKS5ydW4ocmVxKTtcbiAgYXdhaXQgc2FuaXRpemUoJ2VtYWlsJykubm9ybWFsaXplRW1haWwoeyBnbWFpbF9yZW1vdmVfZG90czogZmFsc2UgfSkucnVuKHJlcSk7XG5cbiAgY29uc3QgcmVzdWx0ID0gdmFsaWRhdGlvblJlc3VsdChyZXEpO1xuICBjb25zdCBoYXNFcnJvcnMgPSAhcmVzdWx0LmlzRW1wdHkoKTtcblxuICBpZiAoaGFzRXJyb3JzKSB7XG4gICAgcmVxLmZsYXNoKCdlcnJvcnMnLCByZXN1bHQuYXJyYXkoKSk7XG4gICAgcmV0dXJuIHJlcy5yZWRpcmVjdCgnL3NpZ251cCcpO1xuICB9XG5cbiAgY29uc3QgdXNlciA9IG5ldyBVc2VyKHtcbiAgICBlbWFpbDogcmVxLmJvZHkuZW1haWwsXG4gICAgcGFzc3dvcmQ6IHJlcS5ib2R5LnBhc3N3b3JkXG4gIH0pO1xuXG4gIFVzZXIuZmluZE9uZSh7IGVtYWlsOiByZXEuYm9keS5lbWFpbCB9LCAoZXJyLCBleGlzdGluZ1VzZXIpID0+IHtcbiAgICBpZiAoZXJyKSB7IHJldHVybiBuZXh0KGVycik7IH1cbiAgICBpZiAoZXhpc3RpbmdVc2VyKSB7XG4gICAgICByZXEuZmxhc2goJ2Vycm9ycycsIHsgbXNnOiAnQWNjb3VudCB3aXRoIHRoYXQgZW1haWwgYWRkcmVzcyBhbHJlYWR5IGV4aXN0cy4nIH0pO1xuICAgICAgcmV0dXJuIHJlcy5yZWRpcmVjdCgnL3NpZ251cCcpO1xuICAgIH1cbiAgICB1c2VyLnNhdmUoKGVycjogRXJyb3IpID0+IHtcbiAgICAgIGlmIChlcnIpIHsgcmV0dXJuIG5leHQoZXJyKTsgfVxuICAgICAgcmVxLmxvZ0luKHVzZXIsIChlcnI6IEVycm9yKSA9PiB7XG4gICAgICAgIGlmIChlcnIpIHtcbiAgICAgICAgICByZXR1cm4gbmV4dChlcnIpO1xuICAgICAgICB9XG4gICAgICAgIHJlcy5yZWRpcmVjdChgJHtwcm9jZXNzLmVudi5BRE1JTl9VUkx9YCk7XG4gICAgICB9KTtcbiAgICB9KTtcbiAgfSk7XG59O1xuXG4vKipcbiAqIEdFVCAvYWNjb3VudFxuICogUHJvZmlsZSBwYWdlLlxuICovXG5leHBvcnQgbGV0IGdldEFjY291bnQgPSAocmVxOiBSZXF1ZXN0LCByZXM6IFJlc3BvbnNlKSA9PiB7XG4gIGlmICghcmVxLnVzZXIpIHtcbiAgICByZXMuY2xlYXJDb29raWUoJ2p3dCcpO1xuICAgIHJlcS5sb2dvdXQoKTtcbiAgICByZXMucmVkaXJlY3QoYCR7cHJvY2Vzcy5lbnYuQURNSU5fVVJMfWApO1xuICAgIHJldHVybiA7XG4gIH1cbiAgcmVzLnJlbmRlcignYWNjb3VudC9wcm9maWxlJywge1xuICAgIHRpdGxlOiAnQWNjb3VudCBNYW5hZ2VtZW50J1xuICB9KTtcbn07XG5cbi8qKlxuICogUE9TVCAvYWNjb3VudC9wcm9maWxlXG4gKiBVcGRhdGUgcHJvZmlsZSBpbmZvcm1hdGlvbi5cbiAqL1xuZXhwb3J0IGxldCBwb3N0VXBkYXRlUHJvZmlsZSA9IGFzeW5jIChyZXE6IFJlcXVlc3QsIHJlczogUmVzcG9uc2UsIG5leHQ6IE5leHRGdW5jdGlvbikgPT4ge1xuICBhd2FpdCBjaGVjaygnZW1haWwnLCAnUGxlYXNlIGVudGVyIGEgdmFsaWQgZW1haWwgYWRkcmVzcy4nKS5pc0VtYWlsKCkucnVuKHJlcSk7XG4gIGF3YWl0IHNhbml0aXplKCdlbWFpbCcpLm5vcm1hbGl6ZUVtYWlsKHsgZ21haWxfcmVtb3ZlX2RvdHM6IGZhbHNlIH0pLnJ1bihyZXEpO1xuXG4gIGNvbnN0IGVycm9ycyA9IHZhbGlkYXRpb25SZXN1bHQoKTtcblxuICBpZiAoZXJyb3JzKSB7XG4gICAgcmVxLmZsYXNoKCdlcnJvcnMnLCBlcnJvcnMpO1xuICAgIHJldHVybiByZXMucmVkaXJlY3QoJy9hY2NvdW50Jyk7XG4gIH1cblxuICBVc2VyLmZpbmRCeUlkKHJlcS51c2VyLmlkLCAoZXJyOiBhbnksIHVzZXI6IFVzZXJEb2N1bWVudCkgPT4ge1xuICAgIGlmIChlcnIpIHsgcmV0dXJuIG5leHQoZXJyKTsgfVxuICAgIHVzZXIuZW1haWwgPSByZXEuYm9keS5lbWFpbCB8fCAnJztcbiAgICB1c2VyLnByb2ZpbGUubmFtZSA9IHJlcS5ib2R5Lm5hbWUgfHwgJyc7XG4gICAgdXNlci5wcm9maWxlLmdlbmRlciA9IHJlcS5ib2R5LmdlbmRlciB8fCAnJztcbiAgICB1c2VyLnByb2ZpbGUubG9jYXRpb24gPSByZXEuYm9keS5sb2NhdGlvbiB8fCAnJztcbiAgICB1c2VyLnByb2ZpbGUud2Vic2l0ZSA9IHJlcS5ib2R5LndlYnNpdGUgfHwgJyc7XG4gICAgdXNlci5zYXZlKChlcnI6IFdyaXRlRXJyb3IpID0+IHtcbiAgICAgIGlmIChlcnIpIHtcbiAgICAgICAgaWYgKGVyci5jb2RlID09PSAxMTAwMCkge1xuICAgICAgICAgIHJlcS5mbGFzaCgnZXJyb3JzJywgeyBtc2c6ICdUaGUgZW1haWwgYWRkcmVzcyB5b3UgaGF2ZSBlbnRlcmVkIGlzIGFscmVhZHkgYXNzb2NpYXRlZCB3aXRoIGFuIGFjY291bnQuJyB9KTtcbiAgICAgICAgICByZXR1cm4gcmVzLnJlZGlyZWN0KCcvYWNjb3VudCcpO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBuZXh0KGVycik7XG4gICAgICB9XG4gICAgICByZXEuZmxhc2goJ3N1Y2Nlc3MnLCB7IG1zZzogJ1Byb2ZpbGUgaW5mb3JtYXRpb24gaGFzIGJlZW4gdXBkYXRlZC4nIH0pO1xuICAgICAgcmVzLnJlZGlyZWN0KCcvYWNjb3VudCcpO1xuICAgIH0pO1xuICB9KTtcbn07XG5cbi8qKlxuICogUE9TVCAvYWNjb3VudC9wYXNzd29yZFxuICogVXBkYXRlIGN1cnJlbnQgcGFzc3dvcmQuXG4gKi9cbmV4cG9ydCBsZXQgcG9zdFVwZGF0ZVBhc3N3b3JkID0gYXN5bmMocmVxOiBSZXF1ZXN0LCByZXM6IFJlc3BvbnNlLCBuZXh0OiBOZXh0RnVuY3Rpb24pID0+IHtcbiAgYXdhaXQgY2hlY2soJ3Bhc3N3b3JkJywgJ1Bhc3N3b3JkIG11c3QgYmUgYXQgbGVhc3QgNCBjaGFyYWN0ZXJzIGxvbmcnKS5pc0xlbmd0aCh7IG1pbjogNCB9KS5ydW4ocmVxKTtcbiAgYXdhaXQgY2hlY2soJ2NvbmZpcm1QYXNzd29yZCcsICdQYXNzd29yZHMgZG8gbm90IG1hdGNoJykuaXNMZW5ndGgoeyBtaW46IDQgfSkuZXF1YWxzKHJlcS5ib2R5LnBhc3N3b3JkKS5ydW4ocmVxKTtcblxuICBjb25zdCBlcnJvcnMgPSB2YWxpZGF0aW9uUmVzdWx0KHJlcSk7XG5cbiAgaWYgKGVycm9ycykge1xuICAgIHJlcS5mbGFzaCgnZXJyb3JzJywgZXJyb3JzKTtcbiAgICByZXR1cm4gcmVzLnJlZGlyZWN0KCcvYWNjb3VudCcpO1xuICB9XG5cbiAgVXNlci5maW5kQnlJZChyZXEudXNlci5pZCwgKGVycjogYW55LCB1c2VyOiBVc2VyRG9jdW1lbnQpID0+IHtcbiAgICBpZiAoZXJyKSB7IHJldHVybiBuZXh0KGVycik7IH1cbiAgICB1c2VyLnBhc3N3b3JkID0gcmVxLmJvZHkucGFzc3dvcmQ7XG4gICAgdXNlci5zYXZlKChlcnI6IFdyaXRlRXJyb3IpID0+IHtcbiAgICAgIGlmIChlcnIpIHsgcmV0dXJuIG5leHQoZXJyKTsgfVxuICAgICAgcmVxLmZsYXNoKCdzdWNjZXNzJywgeyBtc2c6ICdQYXNzd29yZCBoYXMgYmVlbiBjaGFuZ2VkLicgfSk7XG4gICAgICByZXMucmVkaXJlY3QoJy9hY2NvdW50Jyk7XG4gICAgfSk7XG4gIH0pO1xufTtcblxuLyoqXG4gKiBQT1NUIC9hY2NvdW50L2RlbGV0ZVxuICogRGVsZXRlIHVzZXIgYWNjb3VudC5cbiAqL1xuZXhwb3J0IGxldCBwb3N0RGVsZXRlQWNjb3VudCA9IChyZXE6IFJlcXVlc3QsIHJlczogUmVzcG9uc2UsIG5leHQ6IE5leHRGdW5jdGlvbikgPT4ge1xuICBVc2VyLnJlbW92ZSh7IF9pZDogcmVxLnVzZXIuaWQgfSwgKGVycikgPT4ge1xuICAgIGlmIChlcnIpIHsgcmV0dXJuIG5leHQoZXJyKTsgfVxuICAgIHJlcS5sb2dvdXQoKTtcbiAgICByZXEuZmxhc2goJ2luZm8nLCB7IG1zZzogJ1lvdXIgYWNjb3VudCBoYXMgYmVlbiBkZWxldGVkLicgfSk7XG4gICAgcmVzLnJlZGlyZWN0KGAke3Byb2Nlc3MuZW52LkFETUlOX1VSTH1gKTtcbiAgfSk7XG59O1xuXG4vKipcbiAqIEdFVCAvYWNjb3VudC91bmxpbmsvOnByb3ZpZGVyXG4gKiBVbmxpbmsgT0F1dGggcHJvdmlkZXIuXG4gKi9cbmV4cG9ydCBsZXQgZ2V0T2F1dGhVbmxpbmsgPSAocmVxOiBSZXF1ZXN0LCByZXM6IFJlc3BvbnNlLCBuZXh0OiBOZXh0RnVuY3Rpb24pID0+IHtcbiAgY29uc3QgcHJvdmlkZXIgPSByZXEucGFyYW1zLnByb3ZpZGVyO1xuICBVc2VyLmZpbmRCeUlkKHJlcS51c2VyLmlkLCAoZXJyOiBhbnksIHVzZXI6IGFueSkgPT4ge1xuICAgIGlmIChlcnIpIHsgcmV0dXJuIG5leHQoZXJyKTsgfVxuICAgIHVzZXJbcHJvdmlkZXJdID0gdW5kZWZpbmVkO1xuICAgIHVzZXIudG9rZW5zID0gdXNlci50b2tlbnMuZmlsdGVyKCh0b2tlbjogQXV0aFRva2VuKSA9PiB0b2tlbi5raW5kICE9PSBwcm92aWRlcik7XG4gICAgdXNlci5zYXZlKChlcnI6IFdyaXRlRXJyb3IpID0+IHtcbiAgICAgIGlmIChlcnIpIHsgcmV0dXJuIG5leHQoZXJyKTsgfVxuICAgICAgcmVxLmZsYXNoKCdpbmZvJywgeyBtc2c6IGAke3Byb3ZpZGVyfSBhY2NvdW50IGhhcyBiZWVuIHVubGlua2VkLmAgfSk7XG4gICAgICByZXMucmVkaXJlY3QoJy9hY2NvdW50Jyk7XG4gICAgfSk7XG4gIH0pO1xufTtcblxuLyoqXG4gKiBHRVQgL3Jlc2V0Lzp0b2tlblxuICogUmVzZXQgUGFzc3dvcmQgcGFnZS5cbiAqL1xuZXhwb3J0IGxldCBnZXRSZXNldCA9IChyZXE6IFJlcXVlc3QsIHJlczogUmVzcG9uc2UsIG5leHQ6IE5leHRGdW5jdGlvbikgPT4ge1xuICBpZiAocmVxLmlzQXV0aGVudGljYXRlZCgpKSB7XG4gICAgcmV0dXJuIHJlcy5yZWRpcmVjdChgJHtwcm9jZXNzLmVudi5BRE1JTl9VUkx9YCk7XG4gIH1cbiAgVXNlclxuICAgIC5maW5kT25lKHsgcGFzc3dvcmRSZXNldFRva2VuOiByZXEucGFyYW1zLnRva2VuIH0pXG4gICAgLndoZXJlKCdwYXNzd29yZFJlc2V0RXhwaXJlcycpLmd0KERhdGUubm93KCkpXG4gICAgLmV4ZWMoKGVycjogRXJyb3IsIHVzZXI6IFVzZXJEVE8pID0+IHtcbiAgICAgIGlmIChlcnIpIHsgcmV0dXJuIG5leHQoZXJyKTsgfVxuICAgICAgaWYgKCF1c2VyKSB7XG4gICAgICAgIHJlcS5mbGFzaCgnZXJyb3JzJywgeyBtc2c6ICdQYXNzd29yZCByZXNldCB0b2tlbiBpcyBpbnZhbGlkIG9yIGhhcyBleHBpcmVkLicgfSk7XG4gICAgICAgIHJldHVybiByZXMucmVkaXJlY3QoJy9mb3Jnb3QnKTtcbiAgICAgIH1cbiAgICAgIHJlcy5yZW5kZXIoJ2FjY291bnQvcmVzZXQnLCB7XG4gICAgICAgIHRpdGxlOiAnUGFzc3dvcmQgUmVzZXQnXG4gICAgICB9KTtcbiAgICB9KTtcbn07XG5cbi8qKlxuICogUE9TVCAvcmVzZXQvOnRva2VuXG4gKiBQcm9jZXNzIHRoZSByZXNldCBwYXNzd29yZCByZXF1ZXN0LlxuICovXG5leHBvcnQgbGV0IHBvc3RSZXNldCA9IGFzeW5jKHJlcTogUmVxdWVzdCwgcmVzOiBSZXNwb25zZSwgbmV4dDogTmV4dEZ1bmN0aW9uKSA9PiB7XG4gIGF3YWl0IGNoZWNrKCdwYXNzd29yZCcsICdQYXNzd29yZCBtdXN0IGJlIGF0IGxlYXN0IDQgY2hhcmFjdGVycyBsb25nJykuaXNMZW5ndGgoeyBtaW46IDQgfSkucnVuKHJlcSk7XG4gIGF3YWl0IGNoZWNrKCdjb25maXJtJywgJ1Bhc3N3b3JkcyBkbyBub3QgbWF0Y2gnKS5pc0xlbmd0aCh7IG1pbjogNCB9KS5lcXVhbHMocmVxLmJvZHkucGFzc3dvcmQpLnJ1bihyZXEpO1xuXG4gIGNvbnN0IGVycm9ycyA9IHZhbGlkYXRpb25SZXN1bHQocmVxKTtcblxuICBpZiAoZXJyb3JzKSB7XG4gICAgcmVxLmZsYXNoKCdlcnJvcnMnLCBlcnJvcnMpO1xuICAgIHJldHVybiByZXMucmVkaXJlY3QoJ2JhY2snKTtcbiAgfVxuXG4gIGFzeW5jLndhdGVyZmFsbChbXG4gICAgZnVuY3Rpb24gcmVzZXRQYXNzd29yZChkb25lOiBGdW5jdGlvbikge1xuICAgICAgVXNlclxuICAgICAgICAuZmluZE9uZSh7IHBhc3N3b3JkUmVzZXRUb2tlbjogcmVxLnBhcmFtcy50b2tlbiB9KVxuICAgICAgICAud2hlcmUoJ3Bhc3N3b3JkUmVzZXRFeHBpcmVzJykuZ3QoRGF0ZS5ub3coKSlcbiAgICAgICAgLmV4ZWMoKGVycjogYW55LCB1c2VyOiBhbnkpID0+IHtcbiAgICAgICAgICBpZiAoZXJyKSB7IHJldHVybiBuZXh0KGVycik7IH1cbiAgICAgICAgICBpZiAoIXVzZXIpIHtcbiAgICAgICAgICAgIHJlcS5mbGFzaCgnZXJyb3JzJywgeyBtc2c6ICdQYXNzd29yZCByZXNldCB0b2tlbiBpcyBpbnZhbGlkIG9yIGhhcyBleHBpcmVkLicgfSk7XG4gICAgICAgICAgICByZXR1cm4gcmVzLnJlZGlyZWN0KCdiYWNrJyk7XG4gICAgICAgICAgfVxuICAgICAgICAgIHVzZXIucGFzc3dvcmQgPSByZXEuYm9keS5wYXNzd29yZDtcbiAgICAgICAgICB1c2VyLnBhc3N3b3JkUmVzZXRUb2tlbiA9IHVuZGVmaW5lZDtcbiAgICAgICAgICB1c2VyLnBhc3N3b3JkUmVzZXRFeHBpcmVzID0gdW5kZWZpbmVkO1xuICAgICAgICAgIHVzZXIuc2F2ZSgoZXJyOiBXcml0ZUVycm9yKSA9PiB7XG4gICAgICAgICAgICBpZiAoZXJyKSB7IHJldHVybiBuZXh0KGVycik7IH1cbiAgICAgICAgICAgIHJlcS5sb2dJbih1c2VyLCAoZXJyOiBhbnkpID0+IHtcbiAgICAgICAgICAgICAgZG9uZShlcnIsIHVzZXIpO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgfSk7XG4gICAgICAgIH0pO1xuICAgIH0sXG4gICAgZnVuY3Rpb24gc2VuZFJlc2V0UGFzc3dvcmRFbWFpbCh1c2VyOiBVc2VyRG9jdW1lbnQsIGRvbmU6IEZ1bmN0aW9uKSB7XG4gICAgICBjb25zdCB0cmFuc3BvcnRlciA9IG5vZGVtYWlsZXIuY3JlYXRlVHJhbnNwb3J0KHtcbiAgICAgICAgc2VydmljZTogJ1NlbmRHcmlkJyxcbiAgICAgICAgYXV0aDoge1xuICAgICAgICAgIHVzZXI6IHByb2Nlc3MuZW52LlNFTkRHUklEX1VTRVIsXG4gICAgICAgICAgcGFzczogcHJvY2Vzcy5lbnYuU0VOREdSSURfUEFTU1dPUkRcbiAgICAgICAgfVxuICAgICAgfSk7XG4gICAgICBjb25zdCBtYWlsT3B0aW9ucyA9IHtcbiAgICAgICAgdG86IHVzZXIuZW1haWwsXG4gICAgICAgIGZyb206ICdleHByZXNzLXRzQHN0YXJ0ZXIuY29tJyxcbiAgICAgICAgc3ViamVjdDogJ1lvdXIgcGFzc3dvcmQgaGFzIGJlZW4gY2hhbmdlZCcsXG4gICAgICAgIHRleHQ6IGBIZWxsbyxcXG5cXG5UaGlzIGlzIGEgY29uZmlybWF0aW9uIHRoYXQgdGhlIHBhc3N3b3JkIGZvciB5b3VyIGFjY291bnQgJHt1c2VyLmVtYWlsfSBoYXMganVzdCBiZWVuIGNoYW5nZWQuXFxuYFxuICAgICAgfTtcbiAgICAgIHRyYW5zcG9ydGVyLnNlbmRNYWlsKG1haWxPcHRpb25zLCAoZXJyOiBhbnkpID0+IHtcbiAgICAgICAgcmVxLmZsYXNoKCdzdWNjZXNzJywgeyBtc2c6ICdTdWNjZXNzISBZb3VyIHBhc3N3b3JkIGhhcyBiZWVuIGNoYW5nZWQuJyB9KTtcbiAgICAgICAgZG9uZShlcnIpO1xuICAgICAgfSk7XG4gICAgfVxuICBdLCAoZXJyKSA9PiB7XG4gICAgaWYgKGVycikgeyByZXR1cm4gbmV4dChlcnIpOyB9XG4gICAgcmVzLnJlZGlyZWN0KGAke3Byb2Nlc3MuZW52LkFETUlOX1VSTH1gKTtcbiAgfSk7XG59O1xuXG4vKipcbiAqIEdFVCAvZm9yZ290XG4gKiBGb3Jnb3QgUGFzc3dvcmQgcGFnZS5cbiAqL1xuZXhwb3J0IGxldCBnZXRGb3Jnb3QgPSAocmVxOiBSZXF1ZXN0LCByZXM6IFJlc3BvbnNlKSA9PiB7XG4gIGlmIChyZXEuaXNBdXRoZW50aWNhdGVkKCkpIHtcbiAgICByZXR1cm4gcmVzLnJlZGlyZWN0KGAke3Byb2Nlc3MuZW52LkFETUlOX1VSTH1gKTtcbiAgfVxuICByZXMucmVuZGVyKCdhY2NvdW50L2ZvcmdvdCcsIHtcbiAgICB0aXRsZTogJ0ZvcmdvdCBQYXNzd29yZCdcbiAgfSk7XG59O1xuXG4vKipcbiAqIFBPU1QgL2ZvcmdvdFxuICogQ3JlYXRlIGEgcmFuZG9tIHRva2VuLCB0aGVuIHRoZSBzZW5kIHVzZXIgYW4gZW1haWwgd2l0aCBhIHJlc2V0IGxpbmsuXG4gKi9cbmV4cG9ydCBsZXQgcG9zdEZvcmdvdCA9IGFzeW5jKHJlcTogUmVxdWVzdCwgcmVzOiBSZXNwb25zZSwgbmV4dDogTmV4dEZ1bmN0aW9uKSA9PiB7XG4gIGF3YWl0IGNoZWNrKCdlbWFpbCcsICdQbGVhc2UgZW50ZXIgYSB2YWxpZCBlbWFpbCBhZGRyZXNzLicpLmlzRW1haWwoKS5ydW4ocmVxKTtcbiAgYXdhaXQgc2FuaXRpemUoJ2VtYWlsJykubm9ybWFsaXplRW1haWwoeyBnbWFpbF9yZW1vdmVfZG90czogZmFsc2UgfSkucnVuKHJlcSk7XG5cbiAgY29uc3QgZXJyb3JzID0gdmFsaWRhdGlvblJlc3VsdChyZXEpO1xuXG4gIGlmIChlcnJvcnMpIHtcbiAgICByZXEuZmxhc2goJ2Vycm9ycycsIGVycm9ycyk7XG4gICAgcmV0dXJuIHJlcy5yZWRpcmVjdChgJHtwcm9jZXNzLmVudi5BRE1JTl9VUkx9YCArICcvZm9yZ290Jyk7XG4gIH1cblxuICBhc3luYy53YXRlcmZhbGwoW1xuICAgIGZ1bmN0aW9uIGNyZWF0ZVJhbmRvbVRva2VuKGRvbmU6IEZ1bmN0aW9uKSB7XG4gICAgICBjcnlwdG8ucmFuZG9tQnl0ZXMoMTYsIChlcnIsIGJ1ZikgPT4ge1xuICAgICAgICBjb25zdCB0b2tlbiA9IGJ1Zi50b1N0cmluZygnaGV4Jyk7XG4gICAgICAgIGRvbmUoZXJyLCB0b2tlbik7XG4gICAgICB9KTtcbiAgICB9LFxuICAgIGZ1bmN0aW9uIHNldFJhbmRvbVRva2VuKHRva2VuOiBBdXRoVG9rZW4sIGRvbmU6IEZ1bmN0aW9uKSB7XG4gICAgICBVc2VyLmZpbmRPbmUoeyBlbWFpbDogcmVxLmJvZHkuZW1haWwgfSwgKGVyciwgdXNlcjogYW55KSA9PiB7XG4gICAgICAgIGlmIChlcnIpIHsgcmV0dXJuIGRvbmUoZXJyKTsgfVxuICAgICAgICBpZiAoIXVzZXIpIHtcbiAgICAgICAgICByZXEuZmxhc2goJ2Vycm9ycycsIHsgbXNnOiAnQWNjb3VudCB3aXRoIHRoYXQgZW1haWwgYWRkcmVzcyBkb2VzIG5vdCBleGlzdC4nIH0pO1xuICAgICAgICAgIHJldHVybiByZXMucmVkaXJlY3QoYCR7cHJvY2Vzcy5lbnYuQURNSU5fVVJMfWAgKyAnL2ZvcmdvdCcpO1xuICAgICAgICB9XG4gICAgICAgIHVzZXIucGFzc3dvcmRSZXNldFRva2VuID0gdG9rZW47XG4gICAgICAgIHVzZXIucGFzc3dvcmRSZXNldEV4cGlyZXMgPSBEYXRlLm5vdygpICsgMzYwMDAwMDsgLy8gMSBob3VyXG4gICAgICAgIHVzZXIuc2F2ZSgoZXJyOiBXcml0ZUVycm9yKSA9PiB7XG4gICAgICAgICAgZG9uZShlcnIsIHRva2VuLCB1c2VyKTtcbiAgICAgICAgfSk7XG4gICAgICB9KTtcbiAgICB9LFxuICAgIGZ1bmN0aW9uIHNlbmRGb3Jnb3RQYXNzd29yZEVtYWlsKHRva2VuOiBBdXRoVG9rZW4sIHVzZXI6IFVzZXJEb2N1bWVudCwgZG9uZTogRnVuY3Rpb24pIHtcbiAgICAgIGNvbnN0IHRyYW5zcG9ydGVyID0gbm9kZW1haWxlci5jcmVhdGVUcmFuc3BvcnQoe1xuICAgICAgICBzZXJ2aWNlOiAnU2VuZEdyaWQnLFxuICAgICAgICBhdXRoOiB7XG4gICAgICAgICAgdXNlcjogcHJvY2Vzcy5lbnYuU0VOREdSSURfVVNFUixcbiAgICAgICAgICBwYXNzOiBwcm9jZXNzLmVudi5TRU5ER1JJRF9QQVNTV09SRFxuICAgICAgICB9XG4gICAgICB9KTtcbiAgICAgIGNvbnN0IG1haWxPcHRpb25zID0ge1xuICAgICAgICB0bzogdXNlci5lbWFpbCxcbiAgICAgICAgZnJvbTogJ2hhY2thdGhvbkBzdGFydGVyLmNvbScsXG4gICAgICAgIHN1YmplY3Q6ICdSZXNldCB5b3VyIHBhc3N3b3JkIG9uIEhhY2thdGhvbiBTdGFydGVyJyxcbiAgICAgICAgdGV4dDogYFlvdSBhcmUgcmVjZWl2aW5nIHRoaXMgZW1haWwgYmVjYXVzZSB5b3UgKG9yIHNvbWVvbmUgZWxzZSkgaGF2ZSByZXF1ZXN0ZWQgdGhlIHJlc2V0IG9mIHRoZSBwYXNzd29yZCBmb3IgeW91ciBhY2NvdW50LlxcblxcblxuICAgICAgICAgIFBsZWFzZSBjbGljayBvbiB0aGUgZm9sbG93aW5nIGxpbmssIG9yIHBhc3RlIHRoaXMgaW50byB5b3VyIGJyb3dzZXIgdG8gY29tcGxldGUgdGhlIHByb2Nlc3M6XFxuXFxuXG4gICAgICAgICAgaHR0cDovLyR7cmVxLmhlYWRlcnMuaG9zdH0vcmVzZXQvJHt0b2tlbn1cXG5cXG5cbiAgICAgICAgICBJZiB5b3UgZGlkIG5vdCByZXF1ZXN0IHRoaXMsIHBsZWFzZSBpZ25vcmUgdGhpcyBlbWFpbCBhbmQgeW91ciBwYXNzd29yZCB3aWxsIHJlbWFpbiB1bmNoYW5nZWQuXFxuYFxuICAgICAgfTtcbiAgICAgIHRyYW5zcG9ydGVyLnNlbmRNYWlsKG1haWxPcHRpb25zLCAoZXJyKSA9PiB7XG4gICAgICAgIHJlcS5mbGFzaCgnaW5mbycsIHsgbXNnOiBgQW4gZS1tYWlsIGhhcyBiZWVuIHNlbnQgdG8gJHt1c2VyLmVtYWlsfSB3aXRoIGZ1cnRoZXIgaW5zdHJ1Y3Rpb25zLmAgfSk7XG4gICAgICAgIGRvbmUoZXJyKTtcbiAgICAgIH0pO1xuICAgIH1cbiAgXSwgKGVycikgPT4ge1xuICAgIGlmIChlcnIpIHsgcmV0dXJuIG5leHQoZXJyKTsgfVxuICAgIHJlcy5yZWRpcmVjdChgJHtwcm9jZXNzLmVudi5BRE1JTl9VUkx9YCArICcvZm9yZ290Jyk7XG4gIH0pO1xufTtcblxuZXhwb3J0IGNvbnN0IHVzZXJJbmZvcm1hdGlvbiA9IGFzeW5jKHJlcTogUmVxdWVzdCwgcmVzOiBSZXNwb25zZSwgbmV4dDogTmV4dEZ1bmN0aW9uKSA9PiB7XG4gIHRyeSB7XG4gICAgY29uc3QgcmVzdWx0cyA9IGF3YWl0IFByb21pc2UuYWxsKFtcbiAgICAgICAgUmVnaXN0cmF0aW9uTW9kZWwuZmluZEJ5SWQocmVxLnBhcmFtcy5pZCksXG4gICAgICAgIFByZWZlcmVuY2VNb2RlbC5maW5kKHt9KVxuICAgIF0pO1xuICAgIGNvbnN0IHJlZ2lzdHJhdGlvbiA9IHJlc3VsdHNbMF07XG4gICAgY29uc3QgcHJlZmVyZW5jZXMgPSByZXN1bHRzWzFdO1xuICAgIGlmIChyZWdpc3RyYXRpb24pIHtcbiAgICAgIGNvbnN0IHVzZXJQcmVmZXJlbmNlcyA9IFtdO1xuICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBwcmVmZXJlbmNlcy5sZW5ndGg7IGkrKykge1xuICAgICAgICBpZiAocmVnaXN0cmF0aW9uLlByZWZlcmVuY2VzLmluZGV4T2YocHJlZmVyZW5jZXNbaV0uX2lkLnRvU3RyaW5nKCkpID4gLTEpIHtcbiAgICAgICAgICAgdXNlclByZWZlcmVuY2VzLnB1c2goe1xuICAgICAgICAgICAgIHByZWZlcmVuY2U6IHByZWZlcmVuY2VzW2ldLFxuICAgICAgICAgICAgIGVuYWJsZWQ6IHRydWVcbiAgICAgICAgICAgfSk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgdXNlclByZWZlcmVuY2VzLnB1c2goe1xuICAgICAgICAgICAgcHJlZmVyZW5jZTogcHJlZmVyZW5jZXNbaV0sXG4gICAgICAgICAgICBlbmFibGVkOiBmYWxzZVxuICAgICAgICAgIH0pO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICByZXMucmVuZGVyKCd1c2VyL3Byb2ZpbGUnLCB7XG4gICAgICAgIHRpdGxlOiAnVXNlciBwcm9maWxlJyxcbiAgICAgICAgcGhvbmVOdW1iZXI6IHJlZ2lzdHJhdGlvbi5QaG9uZU51bWJlcixcbiAgICAgICAgbmlja05hbWU6IHJlZ2lzdHJhdGlvbi5OaWNrTmFtZSxcbiAgICAgICAgcHJlZmVyZW5jZXM6IHVzZXJQcmVmZXJlbmNlcyxcbiAgICAgICAgZGV2aWNlVG9rZW5zOiByZWdpc3RyYXRpb24uRGV2aWNlVG9rZW5zIHx8IFtdLFxuICAgICAgICByZWdpc3RyYXRpb25JZDogcmVnaXN0cmF0aW9uLl9pZFxuICAgICAgfSk7XG4gICAgfSBlbHNlIHtcbiAgICAgICBuZXh0KHtcbiAgICAgICAgIHN0YXR1czogNDA0LFxuICAgICAgICAgbWVzc2FnZTogJ3VzZXIgbm90IGZvdW5kJ1xuICAgICAgIH0pO1xuICAgIH1cbiAgfSBjYXRjaCAoZSkge1xuICAgIG5leHQoZSk7XG4gIH1cbn07XG5cbmV4cG9ydCBjb25zdCBzZW5kTm90aWZpY2F0aW9uVG9Vc2VyID0gYXN5bmMocmVxOiBSZXF1ZXN0LCByZXM6IFJlc3BvbnNlLCBuZXh0OiBOZXh0RnVuY3Rpb24pID0+IHtcbiAgdHJ5IHtcbiAgICAgIGNvbnN0IHJlZ2lzdHJhdGlvbiA9IGF3YWl0IFJlZ2lzdHJhdGlvbk1vZGVsLmZpbmRCeUlkKHJlcS5wYXJhbXMuaWQpO1xuICAgICAgaWYgKCFyZWdpc3RyYXRpb24pIHtcbiAgICAgICAgICBuZXh0KHtcbiAgICAgICAgICAgICAgc3RhdHVzOiA0MDQsXG4gICAgICAgICAgICAgIG1lc3NhZ2U6ICd1c2VyIG5vdCBmb3VuZCdcbiAgICAgICAgICB9KTtcbiAgICAgICAgICByZXR1cm4gO1xuICAgICAgfVxuICAgICAgY29uc3QgYmFkRGV2aWNlVG9rZW5zID0gYXdhaXQgc2VuZE5vdGlmaWNhdGlvbihyZWdpc3RyYXRpb24uRGV2aWNlVG9rZW5zLCAnQXJ0YmF0dGxlIHRlc3Qgbm90aWZpY2F0aW9uJywgJ0FydGJhdHRsZSAgdGVzdCcpLmNhdGNoKGUgPT4gbG9nZ2VyLmluZm8oYHB1c2ggbm90aWZpY2F0aW9uIGZhaWxlZGAsIGUpKTtcbiAgICAgIGNvbnN0IGFuZHJvaWRSZXMgPSBhd2FpdCBNdWx0aUNhc3Qoe1xuICAgICAgICBEZXZpY2VUb2tlbnM6IHJlZ2lzdHJhdGlvbi5BbmRyb2lkRGV2aWNlVG9rZW5zLFxuICAgICAgICBsaW5rOiAnaHR0cHM6Ly9hcHAuYXJ0YmF0dGxlLmNvbS9wcm9maWxlJyxcbiAgICAgICAgdGl0bGU6ICdXZWJWaWV3IFRlc3QnLFxuICAgICAgICBtZXNzYWdlOiAnQ2xpY2tpbmcgb24gbWUgd291bGQgc2VuZCB5b3UgdG8gYSB3ZWJ2aWV3JyxcbiAgICAgICAgcHJpb3JpdHk6ICdub3JtYWwnLFxuICAgICAgICBhbmFseXRpY3NMYWJlbDogJ1dlYlZpZXcgVGVzdCdcbiAgICAgIH0pO1xuICAgICAgbG9nZ2VyLmluZm8oJ3Rlc3Qgbm90aWZpY2F0aW9uIG9uIGFuZHJvaWQgJyArIEpTT04uc3RyaW5naWZ5KGFuZHJvaWRSZXMsIG51bGwsIDEpKTtcbiAgICAgIHJlcS5mbGFzaCgnc3VjY2VzcycsIHsgbXNnOiAnU3VjY2VzcyEgbm90aWZpY2F0aW9uIHNlbnQuJyB9KTtcbiAgICAgIHJlcy5yZWRpcmVjdChgJHtwcm9jZXNzLmVudi5BRE1JTl9VUkx9YCArIGAvdXNlci9pbmZvLyR7cmVnaXN0cmF0aW9uLl9pZH1gKTtcbiAgfSBjYXRjaCAoZSkge1xuICAgIG5leHQoZSk7XG4gIH1cbn07Il19
