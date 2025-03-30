"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * Module dependencies.
 */
const dotenv = require("dotenv");
const path = require("path");
const mongoose = require("mongoose");
/**
 * Load environment variables from .env file, where API keys and passwords are configured.
 */
dotenv.config({ path: path.join(__dirname, '../', '.env') });
const logger_1 = require("../config/logger");
require('../common/ArrayExtensions');
require('../common/StringExtensions');
async function loadApp() {
    try {
        await mongoose.connect(process.env.MONGODB_URI || process.env.MONGOLAB_URI);
        return {
            mongoose: mongoose
        };
    }
    catch (e) {
        console.error('unable to connect', e);
        process.exit(0);
    }
}
mongoose.connection.on('error', () => {
    logger_1.default.info('MongoDB connection error. Please make sure MongoDB is running.');
    process.exit();
});
exports.default = loadApp;

//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbInNjcmlwdHMvYm9vdHN0cmFwLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7O0FBQUE7O0dBRUc7QUFDSCxpQ0FBaUM7QUFDakMsNkJBQTZCO0FBQzdCLHFDQUFxQztBQUNyQzs7R0FFRztBQUNILE1BQU0sQ0FBQyxNQUFNLENBQUMsRUFBRSxJQUFJLEVBQUUsSUFBSSxDQUFDLElBQUksQ0FBQyxTQUFTLEVBQUUsS0FBSyxFQUFFLE1BQU0sQ0FBQyxFQUFFLENBQUMsQ0FBQztBQUM3RCw2Q0FBc0M7QUFFdEMsT0FBTyxDQUFDLDJCQUEyQixDQUFDLENBQUM7QUFDckMsT0FBTyxDQUFDLDRCQUE0QixDQUFDLENBQUM7QUFJdEMsS0FBSyxVQUFVLE9BQU87SUFDbkIsSUFBSTtRQUNELE1BQU0sUUFBUSxDQUFDLE9BQU8sQ0FBQyxPQUFPLENBQUMsR0FBRyxDQUFDLFdBQVcsSUFBSSxPQUFPLENBQUMsR0FBRyxDQUFDLFlBQVksQ0FBQyxDQUFDO1FBQzVFLE9BQU87WUFDSixRQUFRLEVBQUUsUUFBUTtTQUNwQixDQUFDO0tBQ0o7SUFBQyxPQUFPLENBQUMsRUFBRTtRQUNULE9BQU8sQ0FBQyxLQUFLLENBQUMsbUJBQW1CLEVBQUUsQ0FBQyxDQUFDLENBQUM7UUFDdEMsT0FBTyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQztLQUNsQjtBQUNKLENBQUM7QUFDRCxRQUFRLENBQUMsVUFBVSxDQUFDLEVBQUUsQ0FBQyxPQUFPLEVBQUUsR0FBRyxFQUFFO0lBQ2xDLGdCQUFNLENBQUMsSUFBSSxDQUFDLGdFQUFnRSxDQUFDLENBQUM7SUFDOUUsT0FBTyxDQUFDLElBQUksRUFBRSxDQUFDO0FBQ2xCLENBQUMsQ0FBQyxDQUFDO0FBRUgsa0JBQWUsT0FBTyxDQUFDIiwiZmlsZSI6InNjcmlwdHMvYm9vdHN0cmFwLmpzIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBNb2R1bGUgZGVwZW5kZW5jaWVzLlxuICovXG5pbXBvcnQgKiBhcyBkb3RlbnYgZnJvbSAnZG90ZW52JztcbmltcG9ydCAqIGFzIHBhdGggZnJvbSAncGF0aCc7XG5pbXBvcnQgKiBhcyBtb25nb29zZSBmcm9tICdtb25nb29zZSc7XG4vKipcbiAqIExvYWQgZW52aXJvbm1lbnQgdmFyaWFibGVzIGZyb20gLmVudiBmaWxlLCB3aGVyZSBBUEkga2V5cyBhbmQgcGFzc3dvcmRzIGFyZSBjb25maWd1cmVkLlxuICovXG5kb3RlbnYuY29uZmlnKHsgcGF0aDogcGF0aC5qb2luKF9fZGlybmFtZSwgJy4uLycsICcuZW52JykgfSk7XG5pbXBvcnQgbG9nZ2VyIGZyb20gJy4uL2NvbmZpZy9sb2dnZXInO1xuXG5yZXF1aXJlKCcuLi9jb21tb24vQXJyYXlFeHRlbnNpb25zJyk7XG5yZXF1aXJlKCcuLi9jb21tb24vU3RyaW5nRXh0ZW5zaW9ucycpO1xuXG5cblxuYXN5bmMgZnVuY3Rpb24gbG9hZEFwcCgpIHtcbiAgIHRyeSB7XG4gICAgICBhd2FpdCBtb25nb29zZS5jb25uZWN0KHByb2Nlc3MuZW52Lk1PTkdPREJfVVJJIHx8IHByb2Nlc3MuZW52Lk1PTkdPTEFCX1VSSSk7XG4gICAgICByZXR1cm4ge1xuICAgICAgICAgbW9uZ29vc2U6IG1vbmdvb3NlXG4gICAgICB9O1xuICAgfSBjYXRjaCAoZSkge1xuICAgICAgY29uc29sZS5lcnJvcigndW5hYmxlIHRvIGNvbm5lY3QnLCBlKTtcbiAgICAgIHByb2Nlc3MuZXhpdCgwKTtcbiAgIH1cbn1cbm1vbmdvb3NlLmNvbm5lY3Rpb24ub24oJ2Vycm9yJywgKCkgPT4ge1xuICAgbG9nZ2VyLmluZm8oJ01vbmdvREIgY29ubmVjdGlvbiBlcnJvci4gUGxlYXNlIG1ha2Ugc3VyZSBNb25nb0RCIGlzIHJ1bm5pbmcuJyk7XG4gICBwcm9jZXNzLmV4aXQoKTtcbn0pO1xuXG5leHBvcnQgZGVmYXVsdCBsb2FkQXBwOyJdfQ==
