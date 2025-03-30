/**
 * Module dependencies.
 */
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as mongoose from 'mongoose';
/**
 * Load environment variables from .env file, where API keys and passwords are configured.
 */
dotenv.config({ path: path.join(__dirname, '../', '.env') });
import logger from '../config/logger';

require('../common/ArrayExtensions');
require('../common/StringExtensions');



async function loadApp() {
   try {
      await mongoose.connect(process.env.MONGODB_URI || process.env.MONGOLAB_URI);
      return {
         mongoose: mongoose
      };
   } catch (e) {
      console.error('unable to connect', e);
      process.exit(0);
   }
}
mongoose.connection.on('error', () => {
   logger.info('MongoDB connection error. Please make sure MongoDB is running.');
   process.exit();
});

export default loadApp;