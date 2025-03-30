export class TwilioConfig {
    public static sid = process.env.TWILLIO_SID;
    public static key = process.env.TWILLIO_TOKEN;
    public static smsWebhook = process.env.TWILLIO_WEBHOOK;
    public static disableTwilioSigCheck = false;
}

export default TwilioConfig;