"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LoggerStream = void 0;
const winston = require("winston");
const options = {
    file: {
        level: 'info',
        filename: `${process.env.LOG_ROOT || '/var/log/vote2/'}/combined.log`,
        handleExceptions: true,
        json: true,
        maxsize: 5242880,
        maxFiles: 5,
        colorize: false,
    },
    console: {
        level: 'debug',
        handleExceptions: true,
        json: false,
        colorize: true
    },
    console2: {
        level: 'error',
        handleExceptions: true,
        json: false,
        colorize: true
    }
};
const logger = winston.createLogger({
    transports: [
        new winston.transports.File(options.file),
        new winston.transports.Console(options.console),
        new winston.transports.Console(options.console2)
    ],
    exitOnError: false,
});
class LoggerStream {
    write(message) {
        logger.info(message.substring(0, message.lastIndexOf('\n')));
    }
}
exports.LoggerStream = LoggerStream;
exports.default = logger;

//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImNvbmZpZy9sb2dnZXIudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7O0FBQUEsbUNBQW1DO0FBRW5DLE1BQU0sT0FBTyxHQUFHO0lBQ2QsSUFBSSxFQUFFO1FBQ0osS0FBSyxFQUFFLE1BQU07UUFDYixRQUFRLEVBQUUsR0FBRyxPQUFPLENBQUMsR0FBRyxDQUFDLFFBQVEsSUFBSSxpQkFBaUIsZUFBZTtRQUNyRSxnQkFBZ0IsRUFBRSxJQUFJO1FBQ3RCLElBQUksRUFBRSxJQUFJO1FBQ1YsT0FBTyxFQUFFLE9BQU87UUFDaEIsUUFBUSxFQUFFLENBQUM7UUFDWCxRQUFRLEVBQUUsS0FBSztLQUNoQjtJQUNELE9BQU8sRUFBRTtRQUNQLEtBQUssRUFBRSxPQUFPO1FBQ2QsZ0JBQWdCLEVBQUUsSUFBSTtRQUN0QixJQUFJLEVBQUUsS0FBSztRQUNYLFFBQVEsRUFBRSxJQUFJO0tBQ2Y7SUFDRCxRQUFRLEVBQUU7UUFDUixLQUFLLEVBQUUsT0FBTztRQUNkLGdCQUFnQixFQUFFLElBQUk7UUFDdEIsSUFBSSxFQUFFLEtBQUs7UUFDWCxRQUFRLEVBQUUsSUFBSTtLQUNmO0NBQ0YsQ0FBQztBQUVGLE1BQU0sTUFBTSxHQUFtQixPQUFPLENBQUMsWUFBWSxDQUFDO0lBQ2xELFVBQVUsRUFBRTtRQUNWLElBQUksT0FBTyxDQUFDLFVBQVUsQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQztRQUN6QyxJQUFJLE9BQU8sQ0FBQyxVQUFVLENBQUMsT0FBTyxDQUFDLE9BQU8sQ0FBQyxPQUFPLENBQUM7UUFDL0MsSUFBSSxPQUFPLENBQUMsVUFBVSxDQUFDLE9BQU8sQ0FBQyxPQUFPLENBQUMsUUFBUSxDQUFDO0tBQ2pEO0lBQ0QsV0FBVyxFQUFFLEtBQUs7Q0FDbkIsQ0FBQyxDQUFDO0FBRUgsTUFBYSxZQUFZO0lBQ3ZCLEtBQUssQ0FBQyxPQUFlO1FBQ25CLE1BQU0sQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLFNBQVMsQ0FBQyxDQUFDLEVBQUUsT0FBTyxDQUFDLFdBQVcsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUM7SUFDL0QsQ0FBQztDQUNGO0FBSkQsb0NBSUM7QUFFRCxrQkFBZSxNQUFNLENBQUMiLCJmaWxlIjoiY29uZmlnL2xvZ2dlci5qcyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCAqIGFzIHdpbnN0b24gZnJvbSAnd2luc3Rvbic7XG5cbmNvbnN0IG9wdGlvbnMgPSB7XG4gIGZpbGU6IHtcbiAgICBsZXZlbDogJ2luZm8nLFxuICAgIGZpbGVuYW1lOiBgJHtwcm9jZXNzLmVudi5MT0dfUk9PVCB8fCAnL3Zhci9sb2cvdm90ZTIvJ30vY29tYmluZWQubG9nYCxcbiAgICBoYW5kbGVFeGNlcHRpb25zOiB0cnVlLFxuICAgIGpzb246IHRydWUsXG4gICAgbWF4c2l6ZTogNTI0Mjg4MCwgLy8gNU1CXG4gICAgbWF4RmlsZXM6IDUsXG4gICAgY29sb3JpemU6IGZhbHNlLFxuICB9LFxuICBjb25zb2xlOiB7XG4gICAgbGV2ZWw6ICdkZWJ1ZycsXG4gICAgaGFuZGxlRXhjZXB0aW9uczogdHJ1ZSxcbiAgICBqc29uOiBmYWxzZSxcbiAgICBjb2xvcml6ZTogdHJ1ZVxuICB9LFxuICBjb25zb2xlMjoge1xuICAgIGxldmVsOiAnZXJyb3InLFxuICAgIGhhbmRsZUV4Y2VwdGlvbnM6IHRydWUsXG4gICAganNvbjogZmFsc2UsXG4gICAgY29sb3JpemU6IHRydWVcbiAgfVxufTtcblxuY29uc3QgbG9nZ2VyOiB3aW5zdG9uLkxvZ2dlciA9IHdpbnN0b24uY3JlYXRlTG9nZ2VyKHtcbiAgdHJhbnNwb3J0czogW1xuICAgIG5ldyB3aW5zdG9uLnRyYW5zcG9ydHMuRmlsZShvcHRpb25zLmZpbGUpLFxuICAgIG5ldyB3aW5zdG9uLnRyYW5zcG9ydHMuQ29uc29sZShvcHRpb25zLmNvbnNvbGUpLFxuICAgIG5ldyB3aW5zdG9uLnRyYW5zcG9ydHMuQ29uc29sZShvcHRpb25zLmNvbnNvbGUyKVxuICBdLFxuICBleGl0T25FcnJvcjogZmFsc2UsIC8vIGRvIG5vdCBleGl0IG9uIGhhbmRsZWQgZXhjZXB0aW9uc1xufSk7XG5cbmV4cG9ydCBjbGFzcyBMb2dnZXJTdHJlYW0ge1xuICB3cml0ZShtZXNzYWdlOiBzdHJpbmcpIHtcbiAgICBsb2dnZXIuaW5mbyhtZXNzYWdlLnN1YnN0cmluZygwLCBtZXNzYWdlLmxhc3RJbmRleE9mKCdcXG4nKSkpO1xuICB9XG59XG5cbmV4cG9ydCBkZWZhdWx0IGxvZ2dlcjsiXX0=
