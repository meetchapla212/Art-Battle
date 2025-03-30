const postToSlack = require("../src/common/Slack");
postToSlack({
   "text": "This is called from a test case"
}).catch((err) => console.error("test case slack call failed"));
//on windows set SLACK_CHANNEL_WEBHOOK=https://hooks.slack.com/services/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&& node server\test\slack.test.js